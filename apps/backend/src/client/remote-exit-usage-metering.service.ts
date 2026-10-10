import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { computeUsageDelta, parseDeUsageBuffer } from './germany-usage';
import { applyUsageDelta } from './usage-accounting';
import {
  DE_USAGE_SITE,
  US_USAGE_SITE,
  applyRemoteUserUsage,
  loadRemoteBaselines,
  pruneDeRollups,
  type DeUsageDeps,
  type RemoteUsageSite,
} from './germany-usage-db';
import { GermanyMgmtService } from './germany-mgmt.service';
import { UsaMgmtService } from './usa-mgmt.service';
import type { RemoteExitMgmt } from './remote-exit-mgmt';
import { XrayUsageMeteringService } from './xray-usage-metering.service';

/** One metered remote exit. */
interface MeteredSite {
  label: string;
  mgmt: RemoteExitMgmt;
  usage: RemoteUsageSite;
  enabled(): boolean;
  intervalKey: string;
  timer?: NodeJS.Timeout;
  running: boolean;
}

/**
 * Ireland-side consumer of each remote exit's (Germany, USA) durable usage
 * buffer. On each site's tick it pulls the buffer over that site's flaky SSH
 * channel, converts each user's monotonic cumulative total into a positive delta
 * since that site's last-seen baseline, then writes the delta identically to the
 * local Xray metering path (append-only client_usage_events row + shared
 * applyUsageDelta + hourly/daily rollups), charged to the SAME customer quota.
 * The baseline is advanced ONLY after a successful DB write, so a blackout loses
 * nothing and the next successful read catches up.
 *
 * Sites are fully independent: own timer, own re-entrancy flag, own baseline
 * table, own ledger source (germany-xray / usa-xray, so idempotency keys never
 * collide), own SSH breaker. A USA failure never delays or blocks Germany.
 * Only `cc_<id>@afrows` buffer keys are counted (parseDeUsageBuffer), so the
 * Ireland chain user `afrows-chain@afrows` is never double counted.
 *
 * Gates (default OFF): Germany = AFROWS_DE_USAGE_ENABLED (unchanged);
 * USA = AFROWS_US_MGMT_ENABLED (a provisioned USA user must always be metered,
 * so the USA is never provisioned without its meter).
 */
@Injectable()
export class RemoteExitUsageMeteringService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemoteExitUsageMeteringService.name);
  private lastPruneAt = 0;
  private readonly sites: MeteredSite[];
  /** Shared accounting pieces, wired to the REAL local-path functions so
   *  remote-path used_bytes is byte-for-byte identical to the Xray path. */
  private readonly usageDeps: DeUsageDeps = {
    computeDelta: computeUsageDelta,
    applyDelta: applyUsageDelta,
  };

  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
    germanyMgmt: GermanyMgmtService,
    usaMgmt: UsaMgmtService,
    private readonly xrayMetering: XrayUsageMeteringService,
  ) {
    this.sites = [
      {
        label: 'Germany',
        mgmt: germanyMgmt,
        usage: DE_USAGE_SITE,
        enabled: () => this.flag('AFROWS_DE_USAGE_ENABLED', false),
        intervalKey: 'AFROWS_DE_USAGE_INTERVAL_SECONDS',
        running: false,
      },
      {
        label: 'USA',
        mgmt: usaMgmt,
        usage: US_USAGE_SITE,
        enabled: () => usaMgmt.isEnabled(),
        intervalKey: 'AFROWS_US_USAGE_INTERVAL_SECONDS',
        running: false,
      },
    ];
  }

  onModuleInit(): void {
    if (!process.env.DATABASE_URL) return;
    for (const site of this.sites) {
      if (!site.enabled()) continue;
      site.timer = setInterval(() => void this.tick(site), this.intervalMs(site));
      site.timer.unref?.();
      void this.tick(site);
    }
  }

  onModuleDestroy(): void {
    for (const site of this.sites) if (site.timer) clearInterval(site.timer);
  }

  private async tick(site: MeteredSite): Promise<void> {
    if (site.running) return;
    site.running = true;
    try {
      const applied = await this.meter(site);
      // Only enforce when we actually advanced usage this tick. Enforcement hits
      // Ireland's xray AND every remote exit (the local metering service removes
      // the user on Germany and the USA), so an over-quota user is cut everywhere.
      if (applied > 0) {
        await this.xrayMetering.enforceQuotaNow();
        await this.xrayMetering.enforceAccountStatusNow();
      }
      await this.pruneRollups();
    } catch (error) {
      this.logger.warn(`${site.label} metering tick failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      site.running = false;
    }
  }

  /** Pull + apply one site's buffer snapshot. Returns total bytes applied this tick. */
  private async meter(site: MeteredSite): Promise<number> {
    const raw = await site.mgmt.readUsage();
    if (raw == null) return 0; // link down / no buffer — no baseline advance, catch up next read

    const buffer = parseDeUsageBuffer(raw);
    if (!buffer.users.length) return 0;

    const observedAtIso = this.observedAt(buffer.updatedAt);
    const baselines = await loadRemoteBaselines(this.database, site.usage);

    let appliedBytes = 0;
    let appliedUsers = 0;
    for (const user of buffer.users) {
      try {
        const delta = await this.database.transaction((ex) =>
          applyRemoteUserUsage(ex, user, baselines.get(user.clientConfigId), observedAtIso, this.usageDeps, site.usage),
        );
        if (delta > 0) {
          appliedBytes += delta;
          appliedUsers += 1;
        }
      } catch (error) {
        // Isolate per-user: one bad row never sinks the batch or advances the
        // others' baselines. Never log the id (it is the client_config uuid).
        this.logger.warn(`${site.label} per-user apply failed: ${error instanceof Error ? error.message : error}`);
      }
    }
    if (appliedUsers) {
      this.logger.log(`${site.label} metered ${appliedUsers} user(s), ${appliedBytes} bytes`);
    }
    return appliedBytes;
  }

  /** Retention on the shared rollups: hourly ~48h (charts window), daily long. Throttled to hourly. */
  private async pruneRollups(): Promise<void> {
    const now = Date.now();
    if (now - this.lastPruneAt < 3_600_000) return;
    this.lastPruneAt = now;
    try {
      await pruneDeRollups(this.database, this.hourlyRetentionHours(), this.dailyRetentionDays());
    } catch (error) {
      this.logger.warn(`Usage rollup prune failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  private observedAt(bufferUpdatedAt: string | null): string {
    if (bufferUpdatedAt) {
      const parsed = new Date(bufferUpdatedAt);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
    return new Date().toISOString();
  }

  private intervalMs(site: MeteredSite): number {
    // Enforcement latency: a remote-exit quota cutoff is bounded by this
    // interval (default 60 s, clamp 15..3600 s) plus the rmu it triggers.
    return this.intFromValue(this.config.get<string>(site.intervalKey), 60, 15, 3600) * 1000;
  }
  private hourlyRetentionHours(): number {
    return this.intFromValue(this.config.get<string>('AFROWS_DE_USAGE_HOURLY_RETENTION_HOURS'), 48, 24, 2160);
  }
  private dailyRetentionDays(): number {
    return this.intFromValue(this.config.get<string>('AFROWS_DE_USAGE_DAILY_RETENTION_DAYS'), 400, 30, 3650);
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
