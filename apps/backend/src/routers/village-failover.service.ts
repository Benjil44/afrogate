import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';

import { OperationsService } from '../operations/operations.service';
import { RoutersService } from './routers.service';

/**
 * Watches the village MikroTik (the primary egress hub). When it goes **offline**
 * — a village power cut — the bought-VLESS **reserve** has to take over, but its
 * cached exits go stale (providers rotate IPs), so failover finds dead servers
 * (the operator had to press "Sync" by hand mid-blackout). This service closes
 * that loop: every ~10 min it checks the village router's live reachability
 * (`RoutersService.getStatus().online`, a real MikroTik probe), and the moment it
 * sees the router gone it **force-re-syncs the reserve subscriptions** so they
 * hold the provider's current servers to fail over to. Throttled + non-fatal.
 *
 * Config: `AFROWS_VILLAGE_FAILOVER=false` disables it; `AFROWS_VILLAGE_CHECK_MINUTES`
 * (default 10) sets the cadence; `AFROWS_VILLAGE_ROUTER_LABEL` pins which router
 * counts as the village (else role `transport` / a label containing "village").
 */
@Injectable()
export class VillageFailoverService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(VillageFailoverService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private lastSyncAt = 0;

  private static readonly MIN_SYNC_GAP_MS = 8 * 60 * 1000; // don't re-sync more than ~every 8 min

  constructor(
    private readonly routers: RoutersService,
    private readonly operations: OperationsService,
  ) {}

  onModuleInit(): void {
    if (!process.env.DATABASE_URL) return;
    if (process.env.AFROWS_VILLAGE_FAILOVER === 'false') return;
    const minutes = Number(process.env.AFROWS_VILLAGE_CHECK_MINUTES);
    const intervalMs = (Number.isFinite(minutes) && minutes >= 2 ? Math.floor(minutes) : 10) * 60 * 1000;
    this.timer = setInterval(() => void this.tick(), intervalMs);
    this.timer.unref?.();
    setTimeout(() => void this.tick(), 45_000); // first check ~45s after boot
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      if (!(await this.isVillageDown())) return;

      const now = Date.now();
      if (now - this.lastSyncAt < VillageFailoverService.MIN_SYNC_GAP_MS) return;
      this.lastSyncAt = now;

      const subs = (await this.operations.listOutboundSubscriptions()).filter((s) => s.enabled);
      if (!subs.length) {
        this.logger.warn('Village MikroTik offline but no enabled reserve subscription to sync');
        return;
      }
      this.logger.warn(`Village MikroTik offline — syncing ${subs.length} reserve subscription(s) for failover`);
      for (const sub of subs) {
        try {
          await this.operations.refreshOutboundSubscription(sub.id, undefined);
          this.logger.log(`Reserve subscription ${sub.id} re-synced (village failover)`);
        } catch (error) {
          this.logger.warn(`Reserve sync failed for ${sub.id}: ${error instanceof Error ? error.message : error}`);
        }
      }
    } catch (error) {
      this.logger.warn(`Village failover tick failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.running = false;
    }
  }

  /** True when every village egress-hub router is offline (unreachable). */
  private async isVillageDown(): Promise<boolean> {
    const { routers } = await this.routers.listRouters();
    const village = routers.filter((r) => this.isVillageRouter(r));
    if (!village.length) return false; // couldn't identify the village router → never act
    for (const r of village) {
      try {
        const { status } = await this.routers.getStatus(r.id);
        if (status.online) return false; // at least one village router is reachable
      } catch {
        // treat a failed status probe as unreachable
      }
    }
    return true;
  }

  private isVillageRouter(router: { id: string; label: string; role?: string }): boolean {
    const pin = (process.env.AFROWS_VILLAGE_ROUTER_LABEL ?? '').trim().toLowerCase();
    const label = (router.label ?? '').toLowerCase();
    if (pin) return label.includes(pin);
    const role = (router.role ?? '').toLowerCase();
    return role === 'transport' || label.includes('village');
  }
}
