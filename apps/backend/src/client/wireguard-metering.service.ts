import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/**
 * Meters per-peer WireGuard traffic and enforces GB quota — the WG counterpart
 * of XrayUsageMeteringService. The root reconciler writes each peer's ABSOLUTE
 * counters (`rx_bytes`/`tx_bytes`) from `wg show`; this service:
 *   1) accounts the DELTA since the last tick (reset-safe) into the owning
 *      client_config + customer_account `used_bytes`, then
 *   2) flips `wireguard_peers.desired_state` to 'absent' for over-quota accounts
 *      (the reconciler removes them from wg0) and back to 'present' when they're
 *      under quota again and active.
 * No-ops in dev (no DATABASE_URL / disabled).
 */
@Injectable()
export class WireguardMeteringService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WireguardMeteringService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(private readonly database: DatabaseService) {}

  onModuleInit(): void {
    if (!process.env.DATABASE_URL) return;
    if ((process.env.AFROWS_WG_METERING_ENABLED ?? 'true').toLowerCase() === 'false') return;
    const intervalMs = Number(process.env.AFROWS_WG_METERING_INTERVAL_MS ?? 30000) || 30000;
    this.timer = setInterval(() => void this.tick(), intervalMs);
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
      await this.meter();
      await this.enforceQuota();
    } catch (error) {
      this.logger.warn(`WG metering tick failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.running = false;
    }
  }

  /** Account the per-peer delta (current absolute minus last metered) into the
   *  owning client_config + customer_account used_bytes. Reset-safe: when a peer
   *  is re-added its counters restart, so a negative delta is treated as a fresh
   *  start (delta = current). */
  private async meter(): Promise<void> {
    // 1) add each peer's delta (reset-safe) to its client_config.used_bytes
    const res = await this.database.query<{ accountId: string }>(
      `
        WITH d AS (
          SELECT
            wp.id,
            wp.client_config_id,
            CASE
              WHEN (wp.rx_bytes + wp.tx_bytes) >= (wp.metered_rx_bytes + wp.metered_tx_bytes)
                THEN (wp.rx_bytes + wp.tx_bytes) - (wp.metered_rx_bytes + wp.metered_tx_bytes)
              ELSE (wp.rx_bytes + wp.tx_bytes)
            END AS delta
          FROM wireguard_peers wp
          WHERE (wp.rx_bytes + wp.tx_bytes) <> (wp.metered_rx_bytes + wp.metered_tx_bytes)
        ),
        upd_peer AS (
          UPDATE wireguard_peers wp
          SET metered_rx_bytes = wp.rx_bytes, metered_tx_bytes = wp.tx_bytes, updated_at = now()
          FROM d WHERE wp.id = d.id
          RETURNING d.client_config_id, d.delta
        ),
        upd_cfg AS (
          UPDATE client_configs cc
          SET used_bytes = cc.used_bytes + up.delta,
              last_connected_at = CASE WHEN up.delta > 0 THEN now() ELSE cc.last_connected_at END,
              updated_at = now()
          FROM upd_peer up WHERE cc.id = up.client_config_id
          RETURNING cc.customer_account_id
        )
        SELECT DISTINCT customer_account_id AS "accountId" FROM upd_cfg
      `,
    );
    // 2) recompute affected accounts' used_bytes = SUM(their configs) — the
    // authoritative total (covers WG + VLESS, no incremental drift).
    for (const row of res.rows) {
      await this.database.query(
        `
          UPDATE customer_accounts ca
          SET used_bytes = COALESCE((SELECT SUM(used_bytes) FROM client_configs WHERE customer_account_id = ca.id), 0),
              updated_at = now()
          WHERE ca.id = $1
        `,
        [row.accountId],
      );
    }
    if (res.rows.length) this.logger.log(`WG metered + reconciled ${res.rows.length} account(s)`);
  }

  /** Disconnect over-quota peers and re-arm recovered ones (the reconciler applies). */
  private async enforceQuota(): Promise<void> {
    const over = await this.database.query<{ id: string }>(
      `
        UPDATE wireguard_peers wp
        SET desired_state = 'absent', updated_at = now()
        FROM client_configs cc
        JOIN customer_accounts ca ON ca.id = cc.customer_account_id
        WHERE wp.client_config_id = cc.id
          AND wp.desired_state = 'present'
          AND ca.quota_limit_bytes IS NOT NULL
          AND ca.used_bytes >= ca.quota_limit_bytes
        RETURNING wp.id
      `,
    );
    const back = await this.database.query<{ id: string }>(
      `
        UPDATE wireguard_peers wp
        SET desired_state = 'present', updated_at = now()
        FROM client_configs cc
        JOIN customer_accounts ca ON ca.id = cc.customer_account_id
        WHERE wp.client_config_id = cc.id
          AND wp.desired_state = 'absent'
          AND ca.status = 'active'
          AND cc.status <> 'disabled'
          AND (ca.quota_limit_bytes IS NULL OR ca.used_bytes < ca.quota_limit_bytes)
        RETURNING wp.id
      `,
    );
    if (over.rowCount) this.logger.log(`WG quota: disconnected ${over.rowCount} over-quota peer(s)`);
    if (back.rowCount) this.logger.log(`WG quota: re-armed ${back.rowCount} recovered peer(s)`);
  }
}
