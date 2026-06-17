import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseService } from '../database/database.service';
import { parseUserStats } from './xray-usage';
import { provisioningEmail } from './xray-provisioning';

const execFileAsync = promisify(execFile);

interface OverQuotaRow {
  clientConfigId: string;
}

/**
 * Phase 4: meters per-user traffic from the native xray inbound and enforces
 * GB quota. Each tick reads+resets xray user stats, adds the delta to the
 * client_config and its customer_account `used_bytes`, then disconnects
 * (rmu) + marks 'limited' any client whose account is over quota. Runs on the
 * box; no-ops in dev (no xray / disabled).
 */
@Injectable()
export class XrayUsageMeteringService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(XrayUsageMeteringService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
  ) {}

  onModuleInit(): void {
    if (!process.env.DATABASE_URL) return;
    if (!this.flag('AFROWS_XRAY_METERING_ENABLED', true)) return;
    this.timer = setInterval(() => void this.tick(), this.intervalMs());
    this.timer.unref?.();
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.meter();
      await this.enforceQuota();
    } catch (error) {
      this.logger.warn(`Metering tick failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.running = false;
    }
  }

  private async meter(): Promise<void> {
    let out: string;
    try {
      const res = await execFileAsync(
        this.bin(),
        ['api', 'statsquery', `--server=${this.apiServer()}`, '-pattern', 'user>>>', '-reset'],
        { timeout: 15000, maxBuffer: 8 * 1024 * 1024 },
      );
      out = res.stdout;
    } catch {
      return; // xray/api unavailable (dev) — nothing to meter
    }
    const deltas = parseUserStats(out);
    for (const delta of deltas) {
      // add the delta to the client and roll it up to the owning account
      await this.database.query(
        `
          WITH cc AS (
            UPDATE client_configs
            SET used_bytes = used_bytes + $2, updated_at = now()
            WHERE id = $1
            RETURNING customer_account_id
          )
          UPDATE customer_accounts ca
          SET used_bytes = ca.used_bytes + $2, updated_at = now()
          FROM cc
          WHERE ca.id = cc.customer_account_id
        `,
        [delta.clientConfigId, delta.bytes],
      );
    }
    if (deltas.length) {
      this.logger.log(`Metered ${deltas.length} user(s), ${deltas.reduce((a, d) => a + d.bytes, 0)} bytes`);
    }
  }

  private async enforceQuota(): Promise<void> {
    const result = await this.database.query<OverQuotaRow>(
      `
        SELECT cc.id AS "clientConfigId"
        FROM client_configs cc
        JOIN customer_accounts ca ON ca.id = cc.customer_account_id
        WHERE cc.status = 'active'
          AND ca.quota_limit_bytes IS NOT NULL
          AND ca.used_bytes >= ca.quota_limit_bytes
      `,
    );
    for (const row of result.rows) {
      // mark limited (Postgres = source of truth) then disconnect from xray
      await this.database.query(
        `UPDATE client_configs SET status = 'limited', updated_at = now() WHERE id = $1`,
        [row.clientConfigId],
      );
      try {
        await execFileAsync(
          this.bin(),
          ['api', 'rmu', `--server=${this.apiServer()}`, `-tag=${this.inboundTag()}`, provisioningEmail(row.clientConfigId)],
          { timeout: 15000 },
        );
      } catch {
        /* best-effort; reconcile/next tick retries */
      }
    }
    if (result.rows.length) {
      this.logger.log(`Quota enforced: limited ${result.rows.length} over-quota client(s)`);
    }
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
  private intervalMs(): number {
    const raw = this.config.get<string>('AFROWS_XRAY_METERING_INTERVAL_SECONDS');
    const n = typeof raw === 'number' ? raw : Number(raw);
    return (Number.isInteger(n) ? Math.min(Math.max(n, 30), 3600) : 60) * 1000;
  }
  private flag(name: string, fallback: boolean): boolean {
    const v = this.config.get<string>(name)?.trim().toLowerCase();
    if (!v) return fallback;
    return ['1', 'true', 'yes', 'on'].includes(v);
  }
}
