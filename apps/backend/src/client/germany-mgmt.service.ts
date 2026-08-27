import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import {
  DE_INBOUND_PORT,
  DE_INBOUND_TAG,
  buildDeAduJson,
  deAddUserArgs,
  deReadUsageArgs,
  deRemoveUserArgs,
  resolveDeMgmtConfig,
  type DeMgmtConfig,
} from './germany-mgmt';

/**
 * Thin, best-effort wrapper over the Ireland->Germany SSH management channel
 * (read-usage / rmu / adu). Every method isolates its failure: the flaky village
 * link going down NEVER throws into a caller, so Ireland's local metering and
 * provisioning are unaffected. Never logs the email (it carries the client_config
 * uuid) or any key material — only the sub-command name.
 */
@Injectable()
export class GermanyMgmtService {
  private readonly logger = new Logger(GermanyMgmtService.name);

  constructor(private readonly config: ConfigService) {}

  /** Pull the durable usage buffer. Returns the raw JSON stdout, or null on any
   *  failure (link down, key missing, non-zero exit, timeout). */
  async readUsage(): Promise<string | null> {
    const cfg = this.cfg();
    try {
      const { stdout } = await this.ssh(deReadUsageArgs(cfg));
      return stdout;
    } catch (error) {
      this.logger.warn(`Germany read-usage failed: ${this.errMsg(error)}`);
      return null;
    }
  }

  /** Remove one user from Germany's WS inbound. Best-effort; true iff it ran clean. */
  async removeUser(email: string): Promise<boolean> {
    const cfg = this.cfg();
    try {
      await this.ssh(deRemoveUserArgs(cfg, email));
      return true;
    } catch (error) {
      this.logger.warn(`Germany rmu failed: ${this.errMsg(error)}`);
      return false;
    }
  }

  /** Provision one user onto Germany (adu JSON on stdin). Best-effort. */
  async addUser(aduConfigJson: string): Promise<boolean> {
    const cfg = this.cfg();
    try {
      await this.ssh(deAddUserArgs(cfg), aduConfigJson);
      return true;
    } catch (error) {
      this.logger.warn(`Germany adu failed: ${this.errMsg(error)}`);
      return false;
    }
  }

  /** Re-provision a user onto Germany's WS inbound by identity (builds the adu
   *  JSON). Idempotent on the remote side — a user that still exists is a no-op.
   *  Used by the provisioning recovery step to restore a customer who was cut for
   *  over-quota and has since returned under quota (top-up / correction). */
  async addUserByIdentity(uuid: string, email: string): Promise<boolean> {
    const tag = this.config.get<string>('AFROWS_XRAY_DE_INBOUND_TAG')?.trim() || DE_INBOUND_TAG;
    return this.addUser(buildDeAduJson(uuid, email, tag, this.dePort()));
  }

  private dePort(): number {
    const raw = (
      this.config.get<string>('AFROWS_XRAY_DE_INBOUND_PORT') ??
      process.env.AFROWS_XRAY_DE_INBOUND_PORT ??
      ''
    ).trim();
    const n = Number(raw);
    return Number.isInteger(n) && n >= 1 && n <= 65535 ? n : DE_INBOUND_PORT;
  }

  private cfg(): DeMgmtConfig {
    return resolveDeMgmtConfig({
      AFROWS_DE_MGMT_SSH: this.config.get<string>('AFROWS_DE_MGMT_SSH') ?? process.env.AFROWS_DE_MGMT_SSH,
      AFROWS_DE_MGMT_KEY: this.config.get<string>('AFROWS_DE_MGMT_KEY') ?? process.env.AFROWS_DE_MGMT_KEY,
    });
  }

  private ssh(args: string[], stdin?: string): Promise<{ stdout: string }> {
    return new Promise((resolve, reject) => {
      const child = execFile(
        'ssh',
        args,
        { timeout: 20000, maxBuffer: 8 * 1024 * 1024 },
        (error, stdout) => {
          if (error) reject(error);
          else resolve({ stdout });
        },
      );
      if (stdin !== undefined) {
        child.stdin?.end(stdin);
      }
    });
  }

  private errMsg(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
