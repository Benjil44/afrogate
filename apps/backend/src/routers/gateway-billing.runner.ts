import { Injectable, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { GatewayBillingService } from './gateway-billing.service';

/**
 * Drives GatewayBillingService.runCycle() on an interval, just after the usage
 * sampler's cadence so fresh samples are available. setInterval, matching the
 * other metering services.
 */
@Injectable()
export class GatewayBillingRunnerService implements OnModuleInit, OnApplicationShutdown {
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly billing: GatewayBillingService) {}

  onModuleInit(): void {
    const intervalMs = Number(process.env.AFROWS_GATEWAY_BILLING_INTERVAL_MS ?? 900000); // 15 min
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) return;
    setTimeout(() => void this.billing.runCycle().catch(() => undefined), 60000); // after first sample
    this.timer = setInterval(() => void this.billing.runCycle().catch(() => undefined), intervalMs);
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
