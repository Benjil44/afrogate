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
