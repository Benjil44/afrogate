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

/** Canonical Postgres uuid text (any version/variant), the `client_configs.id` type. */
const CLIENT_CONFIG_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates + clamps reported usage deltas: drops rows whose id is not a uuid
 * or whose bytes are non-finite/<=0, floors to whole bytes, and caps each at
 * MAX_USAGE_DELTA_BYTES. Bad rows are silently ignored (never throw) so one
 * malformed delta can't sink an otherwise-good batch. The uuid check matters:
 * a non-uuid id made Postgres throw mid-batch (rows before it already applied,
 * no transaction), so any retry of the whole batch would double-count them.
 */
export function normalizeUsageDeltas(deltas: unknown): EdgeUsageDelta[] {
  if (!Array.isArray(deltas)) return [];
  const out: EdgeUsageDelta[] = [];
  for (const delta of deltas) {
    const clientConfigId = typeof (delta as EdgeUsageDelta)?.clientConfigId === 'string'
      ? (delta as EdgeUsageDelta).clientConfigId
      : '';
    const bytes = Number((delta as EdgeUsageDelta)?.bytes);
    if (!CLIENT_CONFIG_ID_RE.test(clientConfigId) || !Number.isFinite(bytes) || bytes <= 0) continue;
    out.push({ clientConfigId, bytes: Math.min(Math.floor(bytes), MAX_USAGE_DELTA_BYTES) });
  }
  return out;
}
