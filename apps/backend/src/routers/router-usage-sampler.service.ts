import { Injectable, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { RoutersService } from './routers.service';

/**
 * Periodically snapshots every managed MikroTik's WireGuard peer byte counters
 * into mikrotik_wg_samples, so per-tunnel data usage (e.g. the friends' usage on
 * the village) can be reported and billed. Plain setInterval, matching the other
 * metering services in this codebase.
 */
@Injectable()
export class RouterUsageSamplerService implements OnModuleInit, OnApplicationShutdown {
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly routers: RoutersService) {}

  onModuleInit(): void {
    const intervalMs = Number(process.env.AFROWS_ROUTER_USAGE_INTERVAL_MS ?? 900000); // 15 min
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) return;

    // First sample shortly after boot, then on the interval.
    setTimeout(() => void this.routers.sampleUsage().catch(() => undefined), 20000);
    this.timer = setInterval(() => void this.routers.sampleUsage().catch(() => undefined), intervalMs);
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
