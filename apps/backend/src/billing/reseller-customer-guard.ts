/**
 * Billing-integrity guard for reseller-managed customer accounts.
 *
 * Invariant: a reseller may only grant a customer data volume by DEBITING their
 * wallet — i.e. through the metered sale paths (`createResellerGbCharge` /
 * `createResellerPackageSale`). The plain reseller create/update endpoints
 * (`POST/PATCH /admin/reseller/customer-accounts`) must never let a reseller set
 * `quotaLimitBytes` or rewrite `usedBytes` directly, because that would grant
 * data with no wallet debit — a free-quota bypass.
 *
 * The reseller dashboard's customer editor round-trips `quotaLimitBytes` on every
 * save, so we STRIP these fields (rather than reject) to keep legitimate edits —
 * display name, notes, status, per-client cap — working; the wallet-debiting
 * sale paths remain the only way to change quota.
 */
export function stripResellerManagedQuotaFields<
  T extends { quotaLimitBytes?: number | null; usedBytes?: number },
>(dto: T): T {
  return {
    ...dto,
    quotaLimitBytes: undefined,
    usedBytes: undefined,
  };
}
