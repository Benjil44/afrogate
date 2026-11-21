/**
 * The ONE shared helper that re-anchors a customer's billing cycle on a real
 * PURCHASE / RENEWAL event (lever B/C support).
 *
 * It is hooked ONLY behind genuine purchase seams (payment-order allocation,
 * reseller package sale, reseller GB charge, admin paid charge, and the Telegram
 * approval base credit). It MUST NOT fire on a rewarded-ad grant, the inviter
 * referral reward, an account merge, or the monthly forfeiture sweep — those move
 * quota but do NOT start a new paid cycle, so the usage receipt / renewal ladder
 * must keep measuring against the real purchase anchor. Keep it as its own
 * statement, never folded into the raw `UPDATE … quota_limit_bytes`.
 *
 * On a purchase it:
 *   - sets cycle_start_used_bytes = LEAST(used_bytes, quotaAfterBytes)  (new anchor),
 *   - clears renewal_notice_mask (= 0) so the next cycle's rungs can fire again,
 *   - clears lapsed_at (the account is back in good standing).
 *
 * Takes a DatabaseQueryExecutor (real tx or a fake) via a TYPE-ONLY import so the
 * module stays node --test loadable (no Nest DI pulled in).
 */

import type { DatabaseQueryExecutor } from '../database/database.service';

/**
 * Re-anchor the cycle after a paid credit. `quotaAfterBytes` is the account's
 * quota_limit_bytes AFTER the purchase (base + any bonuses). Runs in the caller's
 * transaction, as a statement separate from the quota write.
 */
export async function resetCycleOnPaidCredit(
  executor: DatabaseQueryExecutor,
  accountId: string,
  quotaAfterBytes: number,
): Promise<void> {
  await executor.query(
    `
      UPDATE customer_accounts
      SET cycle_start_used_bytes = LEAST(used_bytes, $2::bigint),
          renewal_notice_mask = 0,
          lapsed_at = NULL,
          updated_at = now()
      WHERE id = $1
    `,
    [accountId, quotaAfterBytes],
  );
}
