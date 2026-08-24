/**
 * Single source of truth for the per-customer traffic write. The native
 * Xray metering tick and the Germany edge-usage endpoint BOTH call this so
 * `used_bytes` accounting is byte-for-byte identical no matter where the
 * delta originated. Additive (never resets), so it is safe to call repeatedly.
 */
import type { DatabaseQueryExecutor } from '../database/database.service';

/**
 * Adds `bytes` (raw bytes, additive) to a client_config and rolls the same
 * delta up to the owning customer_account. `last_connected_at` is bumped only
 * when the delta is positive. Returns the number of customer_accounts rows
 * updated (0 when the clientConfigId is unknown → the call is a safe no-op).
 */
export async function applyUsageDelta(
  db: DatabaseQueryExecutor,
  clientConfigId: string,
  bytes: number,
): Promise<number> {
  const result = await db.query(
    `
      WITH cc AS (
        UPDATE client_configs
        SET used_bytes = used_bytes + $2,
            last_connected_at = CASE WHEN $2 > 0 THEN now() ELSE last_connected_at END,
            updated_at = now()
        WHERE id = $1
        RETURNING customer_account_id
      )
      UPDATE customer_accounts ca
      SET used_bytes = ca.used_bytes + $2, updated_at = now()
      FROM cc
      WHERE ca.id = cc.customer_account_id
    `,
    [clientConfigId, bytes],
  );
  return result.rowCount ?? 0;
}
