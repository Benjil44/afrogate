import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { singleFlight } from '../common/single-flight';
import { GatewayBillingService } from './gateway-billing.service';

/**
 * Drives GatewayBillingService.runCycle() on an interval, just after the usage
 * sampler's cadence so fresh samples are available. setInterval, matching the
 * other metering services. Passes never overlap: runCycle reads each peer's
 * cursor and only then advances it, so two concurrent passes would bill the
 * same delta twice (a slow MikroTik REST call in enforce() can stretch a pass).
 */
@Injectable()
export class GatewayBillingRunnerService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(GatewayBillingRunnerService.name);
  private timer?: ReturnType<typeof setInterval>;
  private firstRun?: ReturnType<typeof setTimeout>;
  readonly runOnce = singleFlight(() =>
    this.billing.runCycle().catch((error: unknown) => {
      this.logger.warn(`gateway billing cycle failed: ${error instanceof Error ? error.message : String(error)}`);
    }),
  );

  constructor(private readonly billing: GatewayBillingService) {}

  onModuleInit(): void {
    const intervalMs = Number(process.env.AFROWS_GATEWAY_BILLING_INTERVAL_MS ?? 900000); // 15 min
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) return;
    this.firstRun = setTimeout(() => void this.runOnce(), 60000); // after first sample
    this.firstRun.unref?.();
    this.timer = setInterval(() => void this.runOnce(), intervalMs);
    this.timer.unref?.();
  }

  onApplicationShutdown(): void {
    if (this.firstRun) clearTimeout(this.firstRun);
    if (this.timer) clearInterval(this.timer);
  }
}
