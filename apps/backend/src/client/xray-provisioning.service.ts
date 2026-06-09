import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { DatabaseService } from '../database/database.service';
import { buildAddUserConfig, provisioningEmail } from './xray-provisioning';

const execFileAsync = promisify(execFile);

interface ActiveClientRow {
  id: string;
  entryUuid: string;
}

/**
 * Keeps the native Afrows xray inbound (afrows-in) in sync with Postgres:
 * active client_configs get a user (their entry_uuid) provisioned via the xray
 * API; non-active ones are removed. Runs on the box where xray lives; in dev
 * (no xray / disabled) it no-ops gracefully.
 */
@Injectable()
export class XrayProvisioningService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(XrayProvisioningService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
  ) {}

  onModuleInit(): void {
    if (!process.env.DATABASE_URL) return;
    if (!this.flag('AFROWS_XRAY_PROVISIONING_ENABLED', true)) return;
    this.timer = setInterval(() => void this.reconcile(), this.intervalMs());
    this.timer.unref?.();
    void this.reconcile();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Provision one user now (best-effort). */
  async addUser(uuid: string, email: string): Promise<boolean> {
    const cfg = buildAddUserConfig({
      inboundTag: this.inboundTag(),
      port: this.inboundPort(),
      uuid,
      email,
    });
    const file = path.join(os.tmpdir(), `afrows-adu-${email.replace(/[^a-z0-9_-]/gi, '')}.json`);
    try {
      await fs.writeFile(file, JSON.stringify(cfg), 'utf8');
      await this.xray(['api', 'adu', `--server=${this.apiServer()}`, file]);
      return true;
    } catch (error) {
      this.logger.warn(`adu ${email} failed: ${error instanceof Error ? error.message : error}`);
      return false;
    } finally {
      await fs.rm(file, { force: true }).catch(() => undefined);
    }
  }

  async removeUser(email: string): Promise<boolean> {
    try {
      await this.xray(['api', 'rmu', `--server=${this.apiServer()}`, `-tag=${this.inboundTag()}`, email]);
      return true;
    } catch (error) {
      this.logger.warn(`rmu ${email} failed: ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }

  /** Sync Postgres active client_configs → xray inbound users. */
  async reconcile(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.database.query<ActiveClientRow>(
        `
          SELECT id, entry_uuid AS "entryUuid"
          FROM client_configs
          WHERE status <> 'disabled'
        `,
      );
      let added = 0;
      for (const row of result.rows) {
        // adu is idempotent enough for our scale: re-adding an existing user is a no-op/ignored.
        if (await this.addUser(row.entryUuid, provisioningEmail(row.id))) added += 1;
      }
      if (added) this.logger.log(`Provisioning reconcile: ensured ${added} user(s) on ${this.inboundTag()}`);
    } catch (error) {
      this.logger.warn(`Provisioning reconcile failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.running = false;
    }
  }

  private async xray(args: string[]): Promise<void> {
    await execFileAsync(this.bin(), args, { timeout: 15000 });
  }

  private bin(): string {
    return this.config.get<string>('AFROWS_XRAY_BIN')?.trim() || 'xray';
  }
  private apiServer(): string {
    return this.config.get<string>('AFROWS_XRAY_API_SERVER')?.trim() || '127.0.0.1:10085';
  }
  private inboundTag(): string {
    return this.config.get<string>('AFROWS_XRAY_INBOUND_TAG')?.trim() || 'afrows-in';
  }
  private inboundPort(): number {
    return this.intFromValue(this.config.get<string>('AFROWS_XRAY_INBOUND_PORT'), 8443, 1, 65535);
  }
  private intervalMs(): number {
    return this.intFromValue(this.config.get<string>('AFROWS_XRAY_PROVISION_INTERVAL_SECONDS'), 60, 15, 3600) * 1000;
  }
  private intFromValue(raw: unknown, fallback: number, min: number, max: number): number {
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isInteger(n)) return fallback;
    return Math.min(Math.max(n, min), max);
  }
  private flag(name: string, fallback: boolean): boolean {
    const v = this.config.get<string>(name)?.trim().toLowerCase();
    if (!v) return fallback;
    return ['1', 'true', 'yes', 'on'].includes(v);
  }
}
