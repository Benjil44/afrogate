import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';

import { VillageEgressAlertService } from '../notifications/village-egress-alert.service';
import { isVillageTransition } from '../notifications/village-egress-alert';
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
 * Each check also feeds VillageEgressAlertService, which pages the bot operators
 * (URGENT, bilingual) on online->offline, reminds while it stays down, and sends
 * a recovery notice with the outage duration. A probe result that would flip the
 * persisted state is re-probed once after ~30s before it is committed, so one
 * dropped MikroTik probe cannot page anyone or send a false "recovered".
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
  private static readonly TRANSITION_CONFIRM_MS = 30 * 1000; // re-probe before committing a state flip

  constructor(
    private readonly routers: RoutersService,
    private readonly operations: OperationsService,
    private readonly egressAlert: VillageEgressAlertService,
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
      const offline = await this.isVillageDown();
      if (offline === null) return; // village router not identifiable -> never act or alert

      // Failover first, unchanged: acts on the raw probe, never delayed by alerting.
      const enabledReserveCount = offline ? await this.syncReserve() : 0;

      if (!this.egressAlert.isEnabled()) return;
      if (isVillageTransition(offline, await this.egressAlert.hasOpenOutage())) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, VillageFailoverService.TRANSITION_CONFIRM_MS).unref?.(); // never hold shutdown
        });
        if ((await this.isVillageDown()) !== offline) return; // flapping/unknown: keep the persisted state
      }
      await this.egressAlert.observe(offline, { enabledReserveCount });
    } catch (error) {
      this.logger.warn(`Village failover tick failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.running = false;
    }
  }

  /** Force-re-sync enabled reserve subscriptions (throttled). Returns how many are enabled. */
  private async syncReserve(): Promise<number> {
    const subs = (await this.operations.listOutboundSubscriptions()).filter((s) => s.enabled);
    const now = Date.now();
    if (now - this.lastSyncAt < VillageFailoverService.MIN_SYNC_GAP_MS) return subs.length;
    this.lastSyncAt = now;

    if (!subs.length) {
      this.logger.warn('Village MikroTik offline but no enabled reserve subscription to sync');
      return 0;
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
    return subs.length;
  }

  /**
   * True when every village egress-hub router is offline (unreachable), false
   * when at least one answers, null when no village router can be identified.
   */
  private async isVillageDown(): Promise<boolean | null> {
    const { routers } = await this.routers.listRouters();
    const village = routers.filter((r) => this.isVillageRouter(r));
    if (!village.length) return null; // couldn't identify the village router → never act
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
