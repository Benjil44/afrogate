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
import { DeMgmtBackoff, isDeLinkFailure, resolveDeMgmtBackoffConfig } from './germany-mgmt-backoff';

/**
 * Thin, best-effort wrapper over the Ireland->Germany SSH management channel
 * (read-usage / rmu / adu). Every method isolates its failure: the flaky village
 * link going down NEVER throws into a caller, so Ireland's local metering and
 * provisioning are unaffected. Never logs the email (it carries the client_config
 * uuid) or any key material — only the sub-command name.
 *
 * While the link is down a circuit breaker (germany-mgmt-backoff.ts) skips
 * calls with exponential backoff (15 s doubling, cap
 * AFROWS_DE_MGMT_BACKOFF_MAX_SECONDS, default 300 s) and logs only the
 * open/close edges, instead of spawning ssh for every user every tick.
 */
@Injectable()
export class GermanyMgmtService {
  private readonly logger = new Logger(GermanyMgmtService.name);
  private readonly backoff: DeMgmtBackoff;

  constructor(private readonly config: ConfigService) {
    this.backoff = new DeMgmtBackoff(
      resolveDeMgmtBackoffConfig({
        AFROWS_DE_MGMT_BACKOFF_MAX_SECONDS:
          this.config.get<string>('AFROWS_DE_MGMT_BACKOFF_MAX_SECONDS') ?? process.env.AFROWS_DE_MGMT_BACKOFF_MAX_SECONDS,
      }),
    );
  }

  /** Pull the durable usage buffer. Returns the raw JSON stdout, or null on any
   *  failure (link down / backing off, key missing, non-zero exit, timeout). */
  async readUsage(): Promise<string | null> {
    const result = await this.run('read-usage', deReadUsageArgs(this.cfg()));
    return result === null ? null : result.stdout;
  }

  /** Remove one user from Germany's WS inbound. Best-effort; true iff it ran clean. */
  async removeUser(email: string): Promise<boolean> {
    return (await this.run('rmu', deRemoveUserArgs(this.cfg(), email))) !== null;
  }

  /** Provision one user onto Germany (adu JSON on stdin). Best-effort. */
  async addUser(aduConfigJson: string): Promise<boolean> {
    return (await this.run('adu', deAddUserArgs(this.cfg()), aduConfigJson)) !== null;
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

  /**
   * One guarded ssh call. null = failed or skipped by the breaker (callers treat
   * both the same way and retry on their next tick). Never throws.
   */
  private async run(op: string, args: string[], stdin?: string): Promise<{ stdout: string } | null> {
    const gate = this.backoff.gate();
    if (gate === 'skip') return null;
    try {
      const result = await this.ssh(args, stdin);
      this.linkUp();
      return result;
    } catch (error) {
      if (!isDeLinkFailure(error)) {
        this.linkUp(); // the remote command answered: the channel itself is fine
        this.logger.warn(`Germany ${op} failed: ${this.errMsg(error)}`);
        return null;
      }
      const { opened, windowMs } = this.backoff.onFailure();
      if (opened) {
        this.logger.warn(
          `Germany mgmt link unreachable (${op}: ${this.errMsg(error)}); backing off — next probe in ${Math.round(windowMs / 1000)}s, further failures logged at debug until it recovers`,
        );
      } else if (gate === 'probe') {
        this.logger.debug(`Germany mgmt probe (${op}) failed; next probe in ${Math.round(windowMs / 1000)}s`);
      } else {
        this.logger.warn(`Germany ${op} failed: ${this.errMsg(error)}`);
      }
      return null;
    }
  }

  private linkUp(): void {
    const { closed, suppressed } = this.backoff.onSuccess();
    if (closed) this.logger.log(`Germany mgmt link restored; ${suppressed} call(s) were skipped during backoff`);
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

  /**
   * Exit status only. execFile's `error.message` is "Command failed: ssh ...
   * rmu <email>" — the full argv, which carries the client_config uuid — so it
   * must never reach the log.
   */
  private errMsg(error: unknown): string {
    if (!error || typeof error !== 'object') return 'unknown error';
    const e = error as { code?: unknown; signal?: unknown; killed?: unknown };
    if (e.killed === true) return 'timeout';
    if (typeof e.signal === 'string' && e.signal) return `signal ${e.signal}`;
    if (typeof e.code === 'number') return `exit ${e.code}`;
    if (typeof e.code === 'string') return e.code; // spawn errors (ENOENT ...)
    return 'unknown error';
  }
}
