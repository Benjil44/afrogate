import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { singleFlight } from '../common/single-flight';
import { RoutersService } from './routers.service';

/**
 * Periodically snapshots every managed MikroTik's WireGuard peer byte counters
 * into mikrotik_wg_samples, so per-tunnel data usage (e.g. the friends' usage on
 * the village) can be reported and billed. Plain setInterval, matching the other
 * metering services in this codebase; a pass never overlaps the previous one
 * (slow/unreachable routers can stretch a pass past a short interval).
 */
@Injectable()
export class RouterUsageSamplerService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RouterUsageSamplerService.name);
  private timer?: ReturnType<typeof setInterval>;
  private firstRun?: ReturnType<typeof setTimeout>;
  readonly runOnce = singleFlight(() =>
    this.routers.sampleUsage().catch((error: unknown) => {
      this.logger.warn(`router usage sampling failed: ${error instanceof Error ? error.message : String(error)}`);
    }),
  );

  constructor(private readonly routers: RoutersService) {}

  onModuleInit(): void {
    const intervalMs = Number(process.env.AFROWS_ROUTER_USAGE_INTERVAL_MS ?? 900000); // 15 min
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) return;

    // First sample shortly after boot, then on the interval.
    this.firstRun = setTimeout(() => void this.runOnce(), 20000);
    this.firstRun.unref?.();
    this.timer = setInterval(() => void this.runOnce(), intervalMs);
    this.timer.unref?.();
  }

  onApplicationShutdown(): void {
    if (this.firstRun) clearTimeout(this.firstRun);
    if (this.timer) clearInterval(this.timer);
  }
}
