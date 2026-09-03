import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { XrayProvisioningService } from './xray-provisioning.service';
import { provisioningEmail } from './xray-provisioning';

interface OverLimitRow {
  clientConfigId: string;
  customerAccountId: string;
  limitValue: number;
  blockedUntil: Date | null;
  ipCount: number;
  ips: string[];
}

/**
 * Per-VLESS concurrent-device (source-IP) limiting.
 *
 * SOURCE OF TRUTH = `client_device_sightings` (populated by XrayAccessLogService
 * tailing the xray access log — real client IPs per config). On this box xray's
 * online-IP API (statsgetallonlineusers/statsonlineiplist) returns empty even
 * when clients are connected, so we count DISTINCT recent source-IPs per config
 * from the sightings table instead. A config with more distinct IPs than its
 * limit (per-customer `max_concurrent_ips`, else AFROWS_DEVICE_LIMIT_DEFAULT,
 * default 1; 0/NULL-override = exempt) within the recency window
 * (AFROWS_DEVICE_LIMIT_WINDOW_SECONDS, default 300) — on two CONSECUTIVE polls,
 * so a single phone's brief WiFi↔cellular IP change is smoothed — is a violation.
 *
 * Modes (AFROWS_DEVICE_LIMIT_MODE):
 *   observe (default) — record (client_ip_violations) + WARN log; block nothing.
 *   enforce — additionally set client_configs.blocked_until = now()+cooldown and
 *     kick the user (rmu). The provisioning reconcile is block-aware (skips
 *     blocked_until > now()), so the block holds for the cooldown and the normal
 *     reconcile auto-reconnects the user afterwards.
 *
 * Kill-switch: AFROWS_DEVICE_LIMIT_ENABLED=false.
 */
@Injectable()
export class DeviceLimitService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeviceLimitService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  /** clientConfigId -> consecutive polls observed over the limit. */
  private readonly overCount = new Map<string, number>();

  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
    private readonly provisioning: XrayProvisioningService,
  ) {}

  onModuleInit(): void {
    if (!process.env.DATABASE_URL) return;
    if (!this.flag('AFROWS_DEVICE_LIMIT_ENABLED', true)) return;
    this.timer = setInterval(() => void this.tick(), this.intervalMs());
    this.timer.unref?.();
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const over = await this.overLimitConfigs();
      const seen = new Set<string>();
      const mode = this.mode();
      const required = this.requiredConsecutive();

      for (const row of over) {
        seen.add(row.clientConfigId);
        // Already blocked within cooldown → leave alone, reset streak.
        if (row.blockedUntil && row.blockedUntil.getTime() > Date.now()) {
          this.overCount.delete(row.clientConfigId);
          continue;
        }
        const streak = (this.overCount.get(row.clientConfigId) ?? 0) + 1;
        if (streak < required) {
          this.overCount.set(row.clientConfigId, streak);
          continue;
        }
        this.overCount.delete(row.clientConfigId);
        await this.handleViolation(row, mode);
      }

      // Drop streaks for configs no longer over-limit.
      for (const id of [...this.overCount.keys()]) {
        if (!seen.has(id)) this.overCount.delete(id);
      }
    } catch (error) {
      this.logger.warn(`Device-limit tick failed: ${this.errMsg(error)}`);
    } finally {
      this.running = false;
    }
  }

  /**
   * Configs whose DISTINCT recent (within the window) source-IP count exceeds
   * their effective limit. Exempt (limit <= 0) configs are filtered out in SQL.
   */
  private async overLimitConfigs(): Promise<OverLimitRow[]> {
    const windowSeconds = this.windowSeconds();
    try {
      const res = await this.database.query<{
        clientConfigId: string;
        customerAccountId: string;
        limitValue: number | string;
        blockedUntil: Date | string | null;
        ipCount: number | string;
        ips: string[];
      }>(
        `
          SELECT cc.id AS "clientConfigId",
                 cc.customer_account_id AS "customerAccountId",
                 COALESCE(ca.max_concurrent_ips, $1) AS "limitValue",
                 cc.blocked_until AS "blockedUntil",
                 count(DISTINCT s.source_ip) AS "ipCount",
                 (array_agg(DISTINCT s.source_ip))[1:20] AS "ips"
          FROM client_device_sightings s
          JOIN client_configs cc ON cc.id = s.client_config_id
          JOIN customer_accounts ca ON ca.id = cc.customer_account_id
          WHERE s.last_seen_at > now() - make_interval(secs => $2)
            AND ca.status = 'active'
            AND ca.deleted_at IS NULL
            AND cc.status <> 'disabled'
          GROUP BY cc.id, cc.customer_account_id, ca.max_concurrent_ips, cc.blocked_until
          HAVING COALESCE(ca.max_concurrent_ips, $1) > 0
             AND count(DISTINCT s.source_ip) > COALESCE(ca.max_concurrent_ips, $1)
        `,
        [this.globalDefault(), windowSeconds],
      );
      return res.rows.map((r) => ({
        clientConfigId: r.clientConfigId,
        customerAccountId: r.customerAccountId,
        limitValue: Number(r.limitValue),
        blockedUntil: r.blockedUntil ? new Date(r.blockedUntil) : null,
        ipCount: Number(r.ipCount),
        ips: Array.isArray(r.ips) ? r.ips : [],
      }));
    } catch (error) {
      this.logger.warn(`Device-limit query failed: ${this.errMsg(error)}`);
      return [];
    }
  }

  private async handleViolation(row: OverLimitRow, mode: 'observe' | 'enforce'): Promise<void> {
    const email = provisioningEmail(row.clientConfigId);
    const action = mode === 'enforce' ? 'blocked' : 'logged';
    this.logger.warn(
      `Device-limit ${mode}: ${this.maskId(row.clientConfigId)} using ${row.ipCount} IPs > limit ${row.limitValue} — ${action}`,
    );

    await this.recordViolation(row, mode, action);

    if (mode !== 'enforce') return;

    try {
      await this.database.query(
        `UPDATE client_configs
           SET blocked_until = now() + make_interval(secs => $2),
               block_reason = $3,
               updated_at = now()
         WHERE id = $1`,
        [row.clientConfigId, this.cooldownSeconds(), `ip_limit:${row.ipCount}ips`],
      );
    } catch (error) {
      this.logger.warn(`Device-limit block-update failed for ${this.maskId(row.clientConfigId)}: ${this.errMsg(error)}`);
      return;
    }
    await this.provisioning.removeUser(email);
  }

  private async recordViolation(row: OverLimitRow, mode: string, action: string): Promise<void> {
    try {
      await this.database.query(
        `INSERT INTO client_ip_violations
           (customer_account_id, client_config_id, email, ip_count, limit_value, ips, mode, action)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
        [
          row.customerAccountId,
          row.clientConfigId,
          provisioningEmail(row.clientConfigId),
          row.ipCount,
          row.limitValue,
          JSON.stringify(row.ips),
          mode,
          action,
        ],
      );
    } catch (error) {
      this.logger.warn(`Device-limit violation-log failed: ${this.errMsg(error)}`);
    }
  }

  private maskId(id: string): string {
    return id.length > 8 ? `${id.slice(0, 8)}…` : id;
  }

  // --- config ---
  private mode(): 'observe' | 'enforce' {
    const v = this.config.get<string>('AFROWS_DEVICE_LIMIT_MODE')?.trim().toLowerCase();
    return v === 'enforce' ? 'enforce' : 'observe';
  }
  private globalDefault(): number {
    return this.intFromValue(this.config.get<string>('AFROWS_DEVICE_LIMIT_DEFAULT'), 1, 0, 100);
  }
  private windowSeconds(): number {
    return this.intFromValue(this.config.get<string>('AFROWS_DEVICE_LIMIT_WINDOW_SECONDS'), 300, 30, 3600);
  }
  private requiredConsecutive(): number {
    return this.intFromValue(this.config.get<string>('AFROWS_DEVICE_LIMIT_CONSECUTIVE'), 2, 1, 10);
  }
  private cooldownSeconds(): number {
    return this.intFromValue(this.config.get<string>('AFROWS_DEVICE_LIMIT_COOLDOWN_SECONDS'), 180, 30, 3600);
  }
  private intervalMs(): number {
    return this.intFromValue(this.config.get<string>('AFROWS_DEVICE_LIMIT_INTERVAL_SECONDS'), 30, 10, 300) * 1000;
  }
  private flag(name: string, fallback: boolean): boolean {
    const v = this.config.get<string>(name)?.trim().toLowerCase();
    if (!v) return fallback;
    return ['1', 'true', 'yes', 'on'].includes(v);
  }
  private intFromValue(raw: unknown, fallback: number, min: number, max: number): number {
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isInteger(n)) return fallback;
    return Math.min(Math.max(n, min), max);
  }
  private errMsg(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
