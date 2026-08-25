import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { computeUsageDelta, parseDeUsageBuffer } from './germany-usage';
import { applyUsageDelta } from './usage-accounting';
import { applyDeUserUsage, loadDeBaselines, pruneDeRollups, type DeUsageDeps } from './germany-usage-db';
import { GermanyMgmtService } from './germany-mgmt.service';
import { XrayUsageMeteringService } from './xray-usage-metering.service';

/**
 * Ireland-side consumer of the Germany durable usage buffer. On each tick it
 * pulls `/var/lib/afrows/de-usage.json` over the flaky SSH channel, converts each
 * user's monotonic cumulative total into a positive delta since the last-seen
 * baseline, then writes that delta identically to the local Xray metering path
 * (append-only client_usage_events row + shared applyUsageDelta + hourly/daily
 * rollups). The baseline is advanced ONLY after a successful DB write, so a
 * village blackout loses nothing and the next successful read catches up.
 *
 * Flag-gated (AFROWS_DE_USAGE_ENABLED, default OFF) and best-effort throughout:
 * an SSH failure logs and returns without advancing any baseline, and never
 * blocks Ireland's own metering/provisioning. All DB shaping lives in the pure,
 * unit-tested germany-usage-db module; this class only schedules + orchestrates.
 */
@Injectable()
export class GermanyUsageMeteringService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GermanyUsageMeteringService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private lastPruneAt = 0;
  /** Shared accounting pieces, wired to the REAL local-path functions so
   *  Germany-path used_bytes is byte-for-byte identical to the Xray path. */
  private readonly usageDeps: DeUsageDeps = {
    computeDelta: computeUsageDelta,
    applyDelta: applyUsageDelta,
  };

  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
    private readonly germanyMgmt: GermanyMgmtService,
    private readonly xrayMetering: XrayUsageMeteringService,
  ) {}

  onModuleInit(): void {
    if (!process.env.DATABASE_URL) return;
    if (!this.flag('AFROWS_DE_USAGE_ENABLED', false)) return;
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
      const applied = await this.meter();
      // Only enforce when we actually advanced usage this tick. Enforcement hits
      // BOTH Ireland's xray and Germany (the local metering service also rmu's on
      // Germany via GermanyMgmtService), so an over-quota user is cut on both.
      if (applied > 0) {
        await this.xrayMetering.enforceQuotaNow();
        await this.xrayMetering.enforceAccountStatusNow();
      }
      await this.pruneRollups();
    } catch (error) {
      this.logger.warn(`Germany metering tick failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.running = false;
    }
  }

  /** Pull + apply one buffer snapshot. Returns total bytes applied this tick. */
  async meter(): Promise<number> {
    const raw = await this.germanyMgmt.readUsage();
    if (raw == null) return 0; // link down / no buffer — no baseline advance, catch up next read

    const buffer = parseDeUsageBuffer(raw);
    if (!buffer.users.length) return 0;

    const observedAtIso = this.observedAt(buffer.updatedAt);
    const baselines = await loadDeBaselines(this.database);

    let appliedBytes = 0;
    let appliedUsers = 0;
    for (const user of buffer.users) {
      try {
        const delta = await this.database.transaction((ex) =>
          applyDeUserUsage(ex, user, baselines.get(user.clientConfigId), observedAtIso, this.usageDeps),
        );
        if (delta > 0) {
          appliedBytes += delta;
          appliedUsers += 1;
        }
      } catch (error) {
        // Isolate per-user: one bad row never sinks the batch or advances the
        // others' baselines. Never log the id (it is the client_config uuid).
        this.logger.warn(`Germany per-user apply failed: ${error instanceof Error ? error.message : error}`);
      }
    }
    if (appliedUsers) {
      this.logger.log(`Germany metered ${appliedUsers} user(s), ${appliedBytes} bytes`);
    }
    return appliedBytes;
  }

  /** Retention: hourly ~48h (charts window), daily long. Throttled to hourly. */
  private async pruneRollups(): Promise<void> {
    const now = Date.now();
    if (now - this.lastPruneAt < 3_600_000) return;
    this.lastPruneAt = now;
    try {
      await pruneDeRollups(this.database, this.hourlyRetentionHours(), this.dailyRetentionDays());
    } catch (error) {
      this.logger.warn(`Germany rollup prune failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  private observedAt(bufferUpdatedAt: string | null): string {
    if (bufferUpdatedAt) {
      const parsed = new Date(bufferUpdatedAt);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
    return new Date().toISOString();
  }

  private intervalMs(): number {
    // Enforcement latency: the Germany-path quota cutoff is bounded by this
    // interval plus the local metering tick that runs the rmu. Default 60s.
    return this.intFromValue(this.config.get<string>('AFROWS_DE_USAGE_INTERVAL_SECONDS'), 60, 15, 3600) * 1000;
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
