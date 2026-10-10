import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseService } from '../database/database.service';
import { parseUserStats } from './xray-usage';
import { applyUsageDelta } from './usage-accounting';
import { provisioningEmail } from './xray-provisioning';
import { GermanyMgmtService } from './germany-mgmt.service';
import { UsaMgmtService } from './usa-mgmt.service';

const execFileAsync = promisify(execFile);

interface OverQuotaRow {
  clientConfigId: string;
  configStatus?: string;
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
    private readonly germanyMgmt: GermanyMgmtService,
    private readonly usaMgmt: UsaMgmtService,
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
      await this.enforceAccountStatus();
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
      // (shared with the Germany edge-usage endpoint so accounting is identical)
      await applyUsageDelta(this.database, delta.clientConfigId, delta.bytes);
    }
    if (deltas.length) {
      this.logger.log(`Metered ${deltas.length} user(s), ${deltas.reduce((a, d) => a + d.bytes, 0)} bytes`);
    }
  }

  private async enforceQuota(): Promise<void> {
    // Select EVERY over-quota config that isn't disabled — both 'active' (newly
    // over quota) AND 'limited' (already cut). We re-issue the removal for the
    // already-limited ones every tick on purpose: the Ireland rmu is local+cheap,
    // and the Germany removal is best-effort over a flaky link — a single failed
    // `rmu` (link down / blackout) must NOT leave an over-quota user egressing
    // forever. Re-running is idempotent, so it self-heals once Germany is reachable.
    const result = await this.database.query<OverQuotaRow>(
      `
        SELECT cc.id AS "clientConfigId", cc.status AS "configStatus"
        FROM client_configs cc
        JOIN customer_accounts ca ON ca.id = cc.customer_account_id
        WHERE cc.status <> 'disabled'
          AND ca.quota_limit_bytes IS NOT NULL
          AND ca.used_bytes >= ca.quota_limit_bytes
      `,
    );
    let newlyLimited = 0;
    for (const row of result.rows) {
      // mark limited (Postgres = source of truth) only on the active->limited
      // transition, so the log/count reflects genuinely new cuts, not every retry.
      if (row.configStatus === 'active') {
        await this.database.query(
          `UPDATE client_configs SET status = 'limited', updated_at = now() WHERE id = $1`,
          [row.clientConfigId],
        );
        newlyLimited += 1;
      }
      // Remove from EVERY provisioned inbound (afrows-in, afrows-in-tcp, …) so an
      // over-quota user can't keep flowing via a secondary entry.
      for (const tag of this.inboundTags()) {
        try {
          await execFileAsync(
            this.bin(),
            ['api', 'rmu', `--server=${this.apiServer()}`, `-tag=${tag}`, provisioningEmail(row.clientConfigId)],
            { timeout: 15000 },
          );
        } catch {
          /* best-effort; next tick retries */
        }
      }
      // Also cut the remote exits (Germany, USA). Best-effort, each behind its own
      // breaker; retried every tick (see above) until the removal actually sticks.
      await this.removeFromRemoteExits(row.clientConfigId);
    }
    if (newlyLimited) {
      this.logger.log(`Quota enforced: limited ${newlyLimited} newly over-quota client(s)`);
    }
  }

  /**
   * Disconnect VLESS users whose ACCOUNT is no longer active (deactivated/suspended).
   * The provisioning reconcile already stops re-adding them; this removes the
   * already-live user so deactivation actually cuts VLESS (mirrors WireGuard,
   * which gates on account status). Config status is left untouched, so
   * re-activating the account lets the reconcile add the user back.
   */
  /** Trigger an immediate account-status enforcement sweep. Called right after an
   * admin disables/suspends an account so the live VLESS user is cut within
   * seconds instead of waiting up to one metering interval (~60s). Best-effort:
   * the periodic tick remains the safety net. */
  async enforceAccountStatusNow(): Promise<void> {
    try {
      await this.enforceAccountStatus();
    } catch (error) {
      this.logger.warn(`Immediate account-status enforcement failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /** Trigger an immediate over-quota enforcement sweep. Called by the Germany
   * metering service after it advances usage so an over-quota user is cut on
   * BOTH Ireland's xray and Germany within one tick instead of waiting for the
   * local metering interval. Best-effort; the periodic tick remains the net. */
  async enforceQuotaNow(): Promise<void> {
    try {
      await this.enforceQuota();
    } catch (error) {
      this.logger.warn(`Immediate quota enforcement failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async enforceAccountStatus(): Promise<void> {
    const result = await this.database.query<OverQuotaRow>(
      `
        SELECT cc.id AS "clientConfigId"
        FROM client_configs cc
        JOIN customer_accounts ca ON ca.id = cc.customer_account_id
        WHERE cc.status <> 'disabled'
          AND ca.status <> 'active'
      `,
    );
    for (const row of result.rows) {
      for (const tag of this.inboundTags()) {
        try {
          await execFileAsync(
            this.bin(),
            ['api', 'rmu', `--server=${this.apiServer()}`, `-tag=${tag}`, provisioningEmail(row.clientConfigId)],
            { timeout: 15000 },
          );
        } catch {
          /* best-effort; next tick retries */
        }
      }
      // Also cut the remote exits (Germany, USA) (best-effort; a flaky link never blocks).
      await this.removeFromRemoteExits(row.clientConfigId);
    }
    if (result.rows.length) {
      this.logger.log(`Account status enforced: disconnected ${result.rows.length} inactive-account client(s)`);
    }
  }

  /**
   * rmu on Germany AND the USA, in parallel so a down site (bounded by its ssh
   * timeout, then skipped by its breaker) never delays the other's cut. The USA
   * call is a no-op unless AFROWS_US_MGMT_ENABLED. Never throws.
   */
  private async removeFromRemoteExits(clientConfigId: string): Promise<void> {
    const email = provisioningEmail(clientConfigId);
    await Promise.all([this.germanyMgmt.removeUser(email), this.usaMgmt.removeUser(email)]);
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
  /** All inbound tags a user is provisioned onto (mirrors AFROWS_XRAY_INBOUND_TAGS = "tag:port,…"). */
  private inboundTags(): string[] {
    const raw = this.config.get<string>('AFROWS_XRAY_INBOUND_TAGS')?.trim();
    if (raw) {
      const tags = raw
        .split(',')
        .map((part) => part.split(':')[0]?.trim())
        .filter((t): t is string => Boolean(t));
      if (tags.length) return Array.from(new Set(tags));
    }
    return [this.inboundTag()];
  }
  private intervalMs(): number {
    // Meter+cutoff is purely polled, so the worst-case quota overshoot is
    // (interval x link line-rate): the user keeps transferring between the
    // moment they cross the limit and the next tick that observes it and
    // cuts them off. A 60s tick let a fast link burn several GB past a small
    // plan; 15s bounds that far tighter without hammering a low-resource VPS
    // (the Xray stats call is a cheap local gRPC query). Floor is 10s so an
    // env override can go tighter but never busy-loop the box.
    // TODO(quota-cap): add a hard inline data-plane cap (e.g. per-connection
    // byte ceiling enforced in Xray/nftables) so overshoot no longer scales
    // with the polling interval at all. Tracked as a separate follow-up.
    const raw = this.config.get<string>('AFROWS_XRAY_METERING_INTERVAL_SECONDS');
    const n = typeof raw === 'number' ? raw : Number(raw);
    return (Number.isInteger(n) ? Math.min(Math.max(n, 10), 3600) : 15) * 1000;
  }
  private flag(name: string, fallback: boolean): boolean {
    const v = this.config.get<string>(name)?.trim().toLowerCase();
    if (!v) return fallback;
    return ['1', 'true', 'yes', 'on'].includes(v);
  }
}
