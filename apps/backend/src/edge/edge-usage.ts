/**
 * Pure helpers for the Germany edge-sync endpoints — no I/O, so they are unit
 * testable under the repo's node:test runner (which cannot load decorated
 * Nest classes). EdgeService is a thin wrapper around these + the DB.
 */
import type { EdgeUsageDelta } from '@afrows/shared';

/**
 * Single-delta cap (1 TB = 10^12 bytes, decimal — matches the codebase's
 * bytes-vs-GB(10^9) convention). A misbehaving Germany agent can then overshoot
 * a customer's quota by at most 1 TB per reported delta instead of nuking it;
 * anything larger is clamped down to this ceiling.
 */
export const MAX_USAGE_DELTA_BYTES = 1_000_000_000_000;

/** Active-client selection — mirrors the provisioning reconcile predicate, plus
 *  requiring an entry_uuid (the Germany agent needs it to provision the user). */
export const ACTIVE_DE_CLIENTS_SQL = `
  SELECT cc.id AS "clientConfigId", cc.entry_uuid AS "entryUuid"
  FROM client_configs cc
  JOIN customer_accounts ca ON ca.id = cc.customer_account_id
  WHERE cc.status <> 'disabled'
    AND ca.status = 'active'
    AND ca.deleted_at IS NULL
    AND cc.entry_uuid IS NOT NULL
`;

export interface ActiveDeClientRow {
  clientConfigId: string;
  entryUuid: string;
}

/**
 * Validates + clamps reported usage deltas: drops rows with a non-string/empty
 * id or non-finite/<=0 bytes, floors to whole bytes, and caps each at
 * MAX_USAGE_DELTA_BYTES. Bad rows are silently ignored (never throw) so one
 * malformed delta can't sink an otherwise-good batch.
 */
export function normalizeUsageDeltas(deltas: unknown): EdgeUsageDelta[] {
  if (!Array.isArray(deltas)) return [];
  const out: EdgeUsageDelta[] = [];
  for (const delta of deltas) {
    const clientConfigId = typeof (delta as EdgeUsageDelta)?.clientConfigId === 'string'
      ? (delta as EdgeUsageDelta).clientConfigId
      : '';
    const bytes = Number((delta as EdgeUsageDelta)?.bytes);
    if (!clientConfigId || !Number.isFinite(bytes) || bytes <= 0) continue;
    out.push({ clientConfigId, bytes: Math.min(Math.floor(bytes), MAX_USAGE_DELTA_BYTES) });
  }
  return out;
}
