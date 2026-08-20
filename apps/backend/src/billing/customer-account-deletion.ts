import { NotFoundException } from '@nestjs/common';
import type { DatabaseQueryExecutor } from '../database/database.service';

/**
 * Soft delete (archive) of a customer account.
 *
 * Operator "delete" ARCHIVES the account rather than destroying it: all
 * payment/accounting history and the account's client_configs are RETAINED so
 * the archive is recoverable. Live access is cut without deleting recoverable
 * data:
 *   - `deleted_at` is stamped so the account drops out of the operator Customers
 *     listing (and is defense-in-depth on entitlement lookups).
 *   - `status` is set to 'disabled' so the enforcement joins (which gate on
 *     `customer_accounts.status = 'active'`, e.g. xray provisioning) stop serving
 *     the account and its VLESS clients get deprovisioned.
 *   - Every WireGuard peer is marked `desired_state = 'absent'` so the root
 *     reconciler removes it from wg0.
 *
 * Nothing is hard-deleted, so the `rewarded_ad_grants` / `payment_orders`
 * RESTRICT foreign keys are never touched. `client_configs` are kept for
 * recovery (their WG peers just leave the interface).
 *
 * The audit row is written through the injected `recordAudit` callback so this
 * module stays free of NestJS service wiring and is unit-testable against the
 * fake-db harness.
 */

/** Status an archived account is forced into so enforcement cuts its access. */
export const ARCHIVED_ACCOUNT_STATUS = 'disabled' as const;

/** Live status an account is restored to so enforcement serves it again. */
export const ACTIVE_ACCOUNT_STATUS = 'active' as const;

export interface AccountClientConfigRow {
  id: string;
  protocol: string | null;
}

export interface CustomerAccountArchiveOutcome {
  /** True when the account was already archived on entry (idempotent no-op). */
  alreadyArchived: boolean;
  /** How many WireGuard peers were marked absent (caller reconciles wg0 if > 0). */
  wgPeersMarkedAbsent: number;
}

export function isWireguardConfig(protocol: string | null | undefined): boolean {
  return (protocol ?? '').toLowerCase() === 'wireguard';
}

export type CustomerAccountArchivedFilter = 'active' | 'only' | 'all';

/**
 * SQL WHERE fragment (on alias `ca`) for the customer-accounts listing archived
 * visibility. Returns null for 'all' (no archived predicate). Defaults to
 * 'active' (live only) so the historical listing behavior is preserved.
 */
export function customerAccountArchivedWhereClause(
  archived: CustomerAccountArchivedFilter | undefined,
): string | null {
  switch (archived ?? 'active') {
    case 'only':
      return 'ca.deleted_at IS NOT NULL';
    case 'all':
      return null;
    case 'active':
    default:
      return 'ca.deleted_at IS NULL';
  }
}

/**
 * Archives a customer account inside a caller-owned transaction. Locks the
 * account row (throws NotFound if it does not exist). If it is already archived,
 * returns immediately without redoing work (idempotent). Otherwise stamps
 * `deleted_at`, disables the account, marks its WireGuard peers absent, and
 * records the audit event. Returns the counts the caller needs to decide whether
 * to trigger a wg reconcile.
 */
export async function archiveCustomerAccountInTransaction(
  executor: DatabaseQueryExecutor,
  id: string,
  recordAudit: (metadata: Record<string, unknown>) => Promise<void>,
): Promise<CustomerAccountArchiveOutcome> {
  const account = await executor.query<{ id: string; deletedAt: Date | string | null }>(
    `SELECT id, deleted_at AS "deletedAt" FROM customer_accounts WHERE id = $1 FOR UPDATE`,
    [id],
  );
  const row = account.rows[0];
  if (!row) throw new NotFoundException('Customer account not found');

  // Idempotent: an already-archived account is left exactly as it is.
  if (row.deletedAt != null) {
    return { alreadyArchived: true, wgPeersMarkedAbsent: 0 };
  }

  // Retain the client_configs for recovery; only cut live WireGuard access by
  // marking each peer absent (same pattern as deleteClientConfig).
  const configs = await executor.query<AccountClientConfigRow>(
    `SELECT id, protocol FROM client_configs WHERE customer_account_id = $1 FOR UPDATE`,
    [id],
  );

  let wgPeersMarkedAbsent = 0;
  for (const config of configs.rows) {
    if (!isWireguardConfig(config.protocol)) continue;
    const updated = await executor.query(
      `UPDATE wireguard_peers
         SET desired_state = 'absent', updated_at = now()
       WHERE client_config_id = $1 AND desired_state <> 'absent'`,
      [config.id],
    );
    wgPeersMarkedAbsent += updated.rowCount ?? 0;
  }

  // Stamp the archive + disable so enforcement (ca.status = 'active') stops
  // serving the account. Guarded on deleted_at IS NULL for safe concurrency.
  await executor.query(
    `UPDATE customer_accounts
       SET deleted_at = now(), status = $2, updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL`,
    [id, ARCHIVED_ACCOUNT_STATUS],
  );

  await recordAudit({ soft: true, wgPeersMarkedAbsent });
  return { alreadyArchived: false, wgPeersMarkedAbsent };
}

export interface CustomerAccountRestoreOutcome {
  /** True when the account was already live on entry (idempotent no-op). */
  alreadyActive: boolean;
  /** How many WireGuard peers were flipped back to 'present' (caller reconciles if > 0). */
  wgPeersRestored: number;
}

/**
 * Restores (un-archives) a customer account inside a caller-owned transaction.
 * Locks the account row (throws NotFound if it does not exist). If it is not
 * archived (`deleted_at IS NULL`), returns immediately (idempotent). Otherwise
 * clears `deleted_at`, re-enables the account to 'active' so enforcement
 * re-provisions VLESS, and flips its WireGuard peers back to 'present' so the
 * reconciler re-adds them to wg0.
 *
 * The peer restore mirrors the WireGuard quota-metering re-arm guards
 * (`enforceQuota`): only peers of non-disabled configs are re-armed, and only
 * where the account is under quota, so restoring never re-enables an
 * individually-disabled config or an over-quota account. The quota/provisioning
 * reconcilers remain the ongoing source of truth after restore.
 */
export async function restoreCustomerAccountInTransaction(
  executor: DatabaseQueryExecutor,
  id: string,
  recordAudit: (metadata: Record<string, unknown>) => Promise<void>,
): Promise<CustomerAccountRestoreOutcome> {
  const account = await executor.query<{ id: string; deletedAt: Date | string | null }>(
    `SELECT id, deleted_at AS "deletedAt" FROM customer_accounts WHERE id = $1 FOR UPDATE`,
    [id],
  );
  const row = account.rows[0];
  if (!row) throw new NotFoundException('Customer account not found');

  // Idempotent: a live account is left exactly as it is.
  if (row.deletedAt == null) {
    return { alreadyActive: true, wgPeersRestored: 0 };
  }

  // Clear the archive + re-enable so enforcement (ca.status = 'active') serves it
  // again. Guarded on deleted_at IS NOT NULL for safe concurrency.
  await executor.query(
    `UPDATE customer_accounts
       SET deleted_at = NULL, status = $2, updated_at = now()
     WHERE id = $1 AND deleted_at IS NOT NULL`,
    [id, ACTIVE_ACCOUNT_STATUS],
  );

  // Re-arm WireGuard peers that were parked 'absent', mirroring the metering
  // re-arm guards (non-disabled config, under quota). Set-based so a single
  // statement handles all of the account's configs.
  const restored = await executor.query(
    `UPDATE wireguard_peers wp
       SET desired_state = 'present', updated_at = now()
     FROM client_configs cc
     JOIN customer_accounts ca ON ca.id = cc.customer_account_id
     WHERE wp.client_config_id = cc.id
       AND cc.customer_account_id = $1
       AND wp.desired_state = 'absent'
       AND cc.status <> 'disabled'
       AND (ca.quota_limit_bytes IS NULL OR ca.used_bytes < ca.quota_limit_bytes)`,
    [id],
  );
  const wgPeersRestored = restored.rowCount ?? 0;

  await recordAudit({ restored: true, wgPeersRestored });
  return { alreadyActive: false, wgPeersRestored };
}
