import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RoutersService } from './routers.service';
import { computeDelta, isCustomerBlocked } from './gateway-billing.util';

export { computeDelta, isCustomerBlocked } from './gateway-billing.util';
export type { Counter, BlockReason } from './gateway-billing.util';

@Injectable()
export class GatewayBillingService {
  private readonly logger = new Logger(GatewayBillingService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly routers: RoutersService,
  ) {}

  /** One metering + enforcement pass over all gateway routers with a customer. */
  async runCycle(): Promise<void> {
    const gateways = await this.database.query<{
      id: string;
      customer_account_id: string;
      egress_enabled: boolean;
    }>(
      `SELECT id, customer_account_id, egress_enabled
         FROM mikrotik_routers
        WHERE role = 'gateway' AND customer_account_id IS NOT NULL`,
    );

    for (const g of gateways.rows) {
      try {
        const delta = await this.meterGateway(g.id);
        if (delta > 0) {
          await this.database.query(
            `UPDATE customer_accounts SET used_bytes = used_bytes + $1, updated_at = now() WHERE id = $2`,
            [delta, g.customer_account_id],
          );
        }
        await this.enforce(g);
      } catch (err) {
        this.logger.warn(`gateway billing failed for ${g.id}: ${String(err)}`);
      }
    }
  }

  /**
   * Sums the reset-aware delta across ALL of the gateway's WG peers (a gateway's
   * tunnels are all Afrows-bound) using the newest sample per peer vs the stored
   * cursor, then advances the cursor. Returns the total new bytes to bill.
   */
  private async meterGateway(routerId: string): Promise<number> {
    const samples = await this.database.query<{ peer_key: string; rx_bytes: string; tx_bytes: string }>(
      `SELECT DISTINCT ON (peer_key) peer_key, rx_bytes, tx_bytes
         FROM mikrotik_wg_samples
        WHERE router_id = $1
        ORDER BY peer_key, sampled_at DESC`,
      [routerId],
    );
    if (samples.rows.length === 0) return 0;

    const cursors = await this.database.query<{ peer_key: string; last_rx: string; last_tx: string }>(
      `SELECT peer_key, last_rx, last_tx FROM mikrotik_gateway_usage_cursor WHERE router_id = $1`,
      [routerId],
    );
    const cursorByPeer = new Map(
      cursors.rows.map((c) => [c.peer_key, { rx: Number(c.last_rx), tx: Number(c.last_tx) }]),
    );

    let total = 0;
    for (const s of samples.rows) {
      const newest = { rx: Number(s.rx_bytes), tx: Number(s.tx_bytes) };
      total += computeDelta(newest, cursorByPeer.get(s.peer_key) ?? null);
      await this.database.query(
        `INSERT INTO mikrotik_gateway_usage_cursor (router_id, peer_key, last_rx, last_tx, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (router_id, peer_key)
         DO UPDATE SET last_rx = excluded.last_rx, last_tx = excluded.last_tx, updated_at = now()`,
        [routerId, s.peer_key, newest.rx, newest.tx],
      );
    }
    return total;
  }

  /**
   * Auto-disable a gateway's Afrows egress when its customer is expired/over-quota/
   * inactive, and raise an alert. Only acts when blocked AND egress is currently on.
   * Re-enable is manual (operator flips Afrows internet back on after renewal).
   */
  private async enforce(g: {
    id: string;
    customer_account_id: string;
    egress_enabled: boolean;
  }): Promise<void> {
    const res = await this.database.query<{
      status: string;
      expires_at: Date | null;
      used_bytes: string;
      quota_limit_bytes: string | null;
      display_name: string | null;
    }>(
      `SELECT status, expires_at, used_bytes, quota_limit_bytes, display_name
         FROM customer_accounts WHERE id = $1`,
      [g.customer_account_id],
    );
    const row = res.rows[0];
    if (!row) return;
    const reason = isCustomerBlocked({
      status: row.status,
      expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
      usedBytes: Number(row.used_bytes),
      quotaLimitBytes: row.quota_limit_bytes == null ? null : Number(row.quota_limit_bytes),
    });
    if (!reason || !g.egress_enabled) return; // act only when blocked AND currently on

    await this.routers.setEgress(g.id, false); // disable Afrows egress via REST + record state
    await this.database.query(
      `INSERT INTO alerts (severity, status, source_type, source_id, title, message)
       VALUES ('warning', 'open', 'router', $1, $2, $3)
       ON CONFLICT (source_type, source_id, title) WHERE status = 'open'
       DO UPDATE SET message = excluded.message, last_seen_at = now()`,
      [
        g.id,
        'Gateway customer blocked — Afrows egress disabled',
        `Router ${g.id} disabled: customer ${row.display_name ?? g.customer_account_id} is ${reason}.`,
      ],
    );
  }
}
