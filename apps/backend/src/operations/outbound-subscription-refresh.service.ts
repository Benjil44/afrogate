import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { OperationsService } from './operations.service';

/**
 * Periodically refreshes outbound subscriptions whose update interval has
 * elapsed (default 12h, or the provider's `profile-update-interval`). Re-fetches
 * the subscription URL and re-syncs its child outbounds. No-ops in dev (no DB).
 */
@Injectable()
export class OutboundSubscriptionRefreshService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboundSubscriptionRefreshService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  // Check hourly which subscriptions are due (the 12h cadence is enforced per-row).
  private static readonly CHECK_INTERVAL_MS = 60 * 60 * 1000;

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
      const dueIds = await this.operations.listDueOutboundSubscriptionIds();
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
