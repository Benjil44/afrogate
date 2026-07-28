import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { OperationsService } from './operations.service';

/**
 * Periodically re-fetches outbound subscriptions and re-syncs their child
 * outbounds so the village-independent **reserve** always has the provider's
 * CURRENT (rotated) exits. Providers rotate their exit IPs; the reserve is only
 * used when the village is down, so its cached exits would otherwise go stale and
 * be dead exactly when failover needs them (the operator had to hit "Sync" by
 * hand mid-blackout). We therefore refresh on a short cadence (default 20 min,
 * `AFROWS_SUBSCRIPTION_REFRESH_MINUTES`) rather than only every 12h, capped by the
 * provider's own interval only when that is *shorter*. No-ops in dev (no DB).
 */
@Injectable()
export class OutboundSubscriptionRefreshService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboundSubscriptionRefreshService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  private static readonly CHECK_INTERVAL_MS = 5 * 60 * 1000; // evaluate due-ness every 5 min

  /** Max staleness before a subscription is re-fetched (keeps the reserve warm). */
  static freshnessMinutes(): number {
    const raw = Number(process.env.AFROWS_SUBSCRIPTION_REFRESH_MINUTES);
    return Number.isFinite(raw) && raw >= 2 ? Math.floor(raw) : 20;
  }

  constructor(private readonly operations: OperationsService) {}

  onModuleInit(): void {
    if (!process.env.DATABASE_URL) return;
    if (process.env.AFROWS_OUTBOUND_SUBSCRIPTION_REFRESH === 'false') return;
    this.timer = setInterval(() => void this.tick(), OutboundSubscriptionRefreshService.CHECK_INTERVAL_MS);
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
      const dueIds = await this.operations.listDueOutboundSubscriptionIds(
        OutboundSubscriptionRefreshService.freshnessMinutes(),
      );
      for (const id of dueIds) {
        try {
          await this.operations.refreshOutboundSubscription(id, undefined);
          this.logger.log(`Refreshed outbound subscription ${id}`);
        } catch (error) {
          this.logger.warn(
            `Auto-refresh failed for subscription ${id}: ${error instanceof Error ? error.message : error}`,
          );
        }
      }
    } catch (error) {
      this.logger.warn(`Subscription refresh tick failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.running = false;
    }
  }
}
