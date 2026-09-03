import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseService } from '../database/database.service';
import { XrayProvisioningService } from './xray-provisioning.service';
import { parseOnlineIpList } from './device-limit.util';

const execFileAsync = promisify(execFile);

interface ConfigLimitRow {
  clientConfigId: string;
  customerAccountId: string;
  limitValue: number;
  blockedUntil: Date | null;
}

/**
 * Per-VLESS concurrent-device (source-IP) limiting.
 *
 * Xray tracks the live source-IPs per user (policy.statsUserOnline=true). Each
 * customer VLESS config is one xray "user" whose email is cc_<clientConfigId>@afrows.
 * This service polls, per online config, how many DISTINCT source-IPs it is
 * connected from. If that exceeds the config's limit (per-customer
 * max_concurrent_ips, else AFROWS_DEVICE_LIMIT_DEFAULT, default 1) on two
 * CONSECUTIVE polls — so a single phone's transient WiFi↔cellular double-IP
 * during a handoff does not count — it is a violation.
 *
 * Modes (AFROWS_DEVICE_LIMIT_MODE):
 *   observe (default) — log + record the violation, block nothing. Used to
 *     validate thresholds against real traffic before arming.
 *   enforce — additionally set client_configs.blocked_until = now()+cooldown and
 *     kick the user from xray (rmu). The provisioning reconcile is block-aware
 *     (skips blocked_until > now()), so the block holds for the cooldown and the
 *     normal reconcile auto-reconnects the user afterwards. A genuine single
 *     device reconnects clean (1 IP, no re-violation); two devices keep flapping.
 *
 * Kill-switch: AFROWS_DEVICE_LIMIT_ENABLED=false disables the whole poller.
 * Box-coupled (needs the local xray API); a no-xray dev box simply sees no
 * online users and no-ops.
 */
@Injectable()
export class DeviceLimitService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeviceLimitService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  /** email -> consecutive polls observed over the limit. */
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
      const onlineEmails = await this.onlineEmails();
      if (onlineEmails.size === 0) {
        this.overCount.clear();
        return;
      }

      const limits = await this.limitsFor([...onlineEmails]);
      if (limits.size === 0) return;

      const mode = this.mode();
      const required = this.requiredConsecutive();
      const stillOnline = new Set<string>();

      for (const email of onlineEmails) {
        const info = limits.get(email);
        if (!info) continue; // not a known VLESS config
        stillOnline.add(email);

        // Already blocked (enforce mode, within cooldown): leave it alone.
        if (info.blockedUntil && info.blockedUntil.getTime() > Date.now()) {
          this.overCount.delete(email);
          continue;
        }
        // limit <= 0 => exempt / unlimited.
        if (info.limitValue <= 0) {
          this.overCount.delete(email);
          continue;
        }

        const ips = await this.onlineIps(email);
        if (ips.length <= info.limitValue) {
          this.overCount.delete(email);
          continue;
        }

        const streak = (this.overCount.get(email) ?? 0) + 1;
        if (streak < required) {
          this.overCount.set(email, streak);
          continue;
        }

        // Confirmed violation.
        this.overCount.delete(email);
        await this.handleViolation(email, info, ips, mode);
      }

      // Drop state for anyone who went offline.
      for (const email of [...this.overCount.keys()]) {
        if (!stillOnline.has(email)) this.overCount.delete(email);
      }
    } catch (error) {
      this.logger.warn(`Device-limit tick failed: ${this.errMsg(error)}`);
    } finally {
      this.running = false;
    }
  }

  private async handleViolation(
    email: string,
    info: ConfigLimitRow,
    ips: string[],
    mode: 'observe' | 'enforce',
  ): Promise<void> {
    const action = mode === 'enforce' ? 'blocked' : 'logged';
    const masked = this.maskEmail(email);
    this.logger.warn(
      `Device-limit ${mode}: ${masked} using ${ips.length} IPs > limit ${info.limitValue} — ${action}`,
    );

    await this.recordViolation(email, info, ips, mode, action);

    if (mode !== 'enforce') return;

    try {
      await this.database.query(
        `UPDATE client_configs
           SET blocked_until = now() + ($2 || ' seconds')::interval,
               block_reason = $3,
               updated_at = now()
         WHERE id = $1`,
        [info.clientConfigId, String(this.cooldownSeconds()), `ip_limit:${ips.length}ips`],
      );
    } catch (error) {
      this.logger.warn(`Device-limit block-update failed for ${masked}: ${this.errMsg(error)}`);
      return;
    }
    // Kick from xray now; the block-aware reconcile keeps them off until cooldown ends.
    await this.provisioning.removeUser(email);
  }

  private async recordViolation(
    email: string,
    info: ConfigLimitRow,
    ips: string[],
    mode: string,
    action: string,
  ): Promise<void> {
    try {
      await this.database.query(
        `INSERT INTO client_ip_violations
           (customer_account_id, client_config_id, email, ip_count, limit_value, ips, mode, action)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
        [
          info.customerAccountId,
          info.clientConfigId,
          email,
          ips.length,
          info.limitValue,
          JSON.stringify(ips),
          mode,
          action,
        ],
      );
    } catch (error) {
      this.logger.warn(`Device-limit violation-log failed: ${this.errMsg(error)}`);
    }
  }

  /** Online VLESS config emails, from xray's statsgetallonlineusers. */
  private async onlineEmails(): Promise<Set<string>> {
    try {
      const res = await execFileAsync(
        this.bin(),
        ['api', 'statsgetallonlineusers', `--server=${this.apiServer()}`],
        { timeout: 15000, maxBuffer: 8 * 1024 * 1024 },
      );
      const data = JSON.parse(res.stdout) as Record<string, unknown>;
      const users = (data.users ?? data) as Record<string, unknown>;
      const emails = users && typeof users === 'object' ? Object.keys(users) : [];
      return new Set(emails.filter((e) => /^cc_.+@afrows$/.test(e)));
    } catch {
      return new Set();
    }
  }

  /** Distinct live source-IPs for one config email. */
  private async onlineIps(email: string): Promise<string[]> {
    try {
      const res = await execFileAsync(
        this.bin(),
        ['api', 'statsonlineiplist', `--server=${this.apiServer()}`, '-email', email],
        { timeout: 15000, maxBuffer: 4 * 1024 * 1024 },
      );
      return parseOnlineIpList(res.stdout);
    } catch {
      return [];
    }
  }

  private async limitsFor(emails: string[]): Promise<Map<string, ConfigLimitRow>> {
    const map = new Map<string, ConfigLimitRow>();
    const ids = emails
      .map((e) => e.match(/^cc_(.+?)@afrows$/)?.[1])
      .filter((v): v is string => Boolean(v));
    if (ids.length === 0) return map;
    try {
      const res = await this.database.query<{
        clientConfigId: string;
        customerAccountId: string;
        limitValue: number | string;
        blockedUntil: Date | string | null;
      }>(
        `
          SELECT cc.id AS "clientConfigId",
                 cc.customer_account_id AS "customerAccountId",
                 COALESCE(ca.max_concurrent_ips, $2) AS "limitValue",
                 cc.blocked_until AS "blockedUntil"
          FROM client_configs cc
          JOIN customer_accounts ca ON ca.id = cc.customer_account_id
          WHERE cc.id = ANY($1::uuid[])
            AND ca.status = 'active'
            AND ca.deleted_at IS NULL
        `,
        [ids, this.globalDefault()],
      );
      for (const r of res.rows) {
        map.set(`cc_${r.clientConfigId}@afrows`, {
          clientConfigId: r.clientConfigId,
          customerAccountId: r.customerAccountId,
          limitValue: Number(r.limitValue),
          blockedUntil: r.blockedUntil ? new Date(r.blockedUntil) : null,
        });
      }
    } catch (error) {
      this.logger.warn(`Device-limit limits query failed: ${this.errMsg(error)}`);
    }
    return map;
  }

  private maskEmail(email: string): string {
    const id = email.match(/^cc_(.+?)@afrows$/)?.[1] ?? email;
    return id.length > 10 ? `cc_${id.slice(0, 8)}…` : email;
  }

  // --- config ---
  private mode(): 'observe' | 'enforce' {
    const v = this.config.get<string>('AFROWS_DEVICE_LIMIT_MODE')?.trim().toLowerCase();
    return v === 'enforce' ? 'enforce' : 'observe';
  }
  private globalDefault(): number {
    return this.intFromValue(this.config.get<string>('AFROWS_DEVICE_LIMIT_DEFAULT'), 1, 0, 100);
  }
  private requiredConsecutive(): number {
    return this.intFromValue(this.config.get<string>('AFROWS_DEVICE_LIMIT_CONSECUTIVE'), 2, 1, 10);
  }
  private cooldownSeconds(): number {
    return this.intFromValue(this.config.get<string>('AFROWS_DEVICE_LIMIT_COOLDOWN_SECONDS'), 180, 30, 3600);
  }
  private intervalMs(): number {
    return this.intFromValue(this.config.get<string>('AFROWS_DEVICE_LIMIT_INTERVAL_SECONDS'), 25, 10, 300) * 1000;
  }
  private bin(): string {
    return this.config.get<string>('AFROWS_XRAY_BIN')?.trim() || 'xray';
  }
  private apiServer(): string {
    return this.config.get<string>('AFROWS_XRAY_API_SERVER')?.trim() || '127.0.0.1:10085';
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
