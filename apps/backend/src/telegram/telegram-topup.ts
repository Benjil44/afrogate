import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { DatabaseQueryExecutor } from '../database/database.service';

/** 1 GB = 1e9 bytes (decimal), kept local so this module has no relative value imports. */
const BYTES_PER_GB = 1_000_000_000;

/**
 * Gems paid to an inviter for a referred purchase: pct% of the purchased GB,
 * expressed in gems at the redeem rate (mirrors billing/gems.ts
 * computeReferralCommissionGems — kept local to stay node --test loadable). E.g.
 * a 20 GB buy → 20 × 20% = 4 GB → 400 gems at 100 gems/GB.
 */
function computeReferralCommissionGems(volumeBytes: number, pct: number, ratePerGb: number): number {
  if (!Number.isFinite(volumeBytes) || volumeBytes <= 0) return 0;
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  if (!Number.isFinite(ratePerGb) || ratePerGb <= 0) return 0;
  return Math.floor((volumeBytes / BYTES_PER_GB) * pct * ratePerGb / 100);
}

/**
 * Pure, transaction-scoped logic for the Telegram card-to-card top-up flow.
 *
 * These functions take a `DatabaseQueryExecutor` (real tx or a fake in tests) so
 * the state machine and the quota credit are unit-testable without a database.
 * The module is intentionally self-contained (only `@nestjs/common` + a type-only
 * import) so the node --test runner can load it directly.
 *
 * IMPORTANT (quota credit): approval does NOT invent a crediting mechanism. The
 * production caller (TelegramTopupAdminService) injects `computeQuotaAfter` =
 * `computeAllocatedQuotaLimitBytes` from quota-math.ts — the SAME function the
 * reseller package-sale and payment-order allocation paths use — and the result
 * is written to `customer_accounts.quota_limit_bytes`. A top-up grants exactly
 * the package's `volume_bytes` of fresh headroom (decimal bytes, never
 * retroactively forgiving prior usage).
 */

/** Default self-serve trial quota: 1 GB decimal = 1,000,000,000 bytes. */
export const TELEGRAM_TRIAL_QUOTA_BYTES = 1_000_000_000;

export type TelegramTopupStatus = 'awaiting_receipt' | 'pending' | 'approved' | 'rejected';

/** Coerce a bigint-as-string/number column value to a finite number, else null. */
function toFiniteNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Signature of the injected quota-credit calculator (quota-math.computeAllocatedQuotaLimitBytes). */
export type ComputeQuotaAfter = (quotaLimitBeforeBytes: number | null, usedBytes: number, volumeBytes: number) => number;

/** Resolve the configured trial quota, falling back to 1 GB decimal when unset. */
export function resolveTrialQuotaBytes(configured: number | null | undefined): number {
  if (configured === null || configured === undefined) return TELEGRAM_TRIAL_QUOTA_BYTES;
  if (!Number.isSafeInteger(configured) || configured < 0) return TELEGRAM_TRIAL_QUOTA_BYTES;
  return configured;
}

/** Short, stable human reference for a request id (e.g. "A1B2C3"). */
export function topupReference(id: string): string {
  return id.replace(/-/g, '').slice(0, 6).toUpperCase();
}

interface TopupRequestRow {
  id: string;
  status: string;
  customerAccountId: string | null;
  telegramId: string | null;
  telegramChatId: string | null;
  volumePackageId: string | null;
  amountMinor: string | number | null;
  currency: string | null;
}

interface AccountRow {
  quotaLimitBytes: string | number | null;
  usedBytes: string | number | null;
  referredBy: string | null;
}

interface InviterRow {
  telegramId: string | null;
  telegramChatId: string | null;
}

/** Referral commission credited to the inviter when a referred buyer is approved. */
export interface TopupReferralCommission {
  inviterAccountId: string;
  inviterTelegramId: string | null;
  inviterTelegramChatId: string | null;
  gems: number;
  inviterGemsBalance: number;
  pct: number;
}

interface VolumePackageRow {
  name: string;
  volumeBytes: string | number;
}

const REQUEST_SELECT = `
  SELECT
    id,
    status,
    customer_account_id AS "customerAccountId",
    telegram_id AS "telegramId",
    telegram_chat_id AS "telegramChatId",
    volume_package_id AS "volumePackageId",
    amount_minor AS "amountMinor",
    currency
  FROM telegram_topup_requests
`;

/**
 * Create a top-up request directly in status 'pending' with the receipt photo's
 * file_id. Per docs §5, the in-progress charge lives in the per-user state
 * (telegram_users); when the receipt photo arrives the row is created here in one
 * step (there is no intermediate 'awaiting_receipt' row). Returns id + reference.
 */
export async function createPendingTopupInTransaction(
  executor: DatabaseQueryExecutor,
  input: {
    customerAccountId: string;
    telegramId: string | null;
    telegramChatId: string | null;
    volumePackageId: string;
    amountMinor: number | null;
    currency: string | null;
    receiptFileId: string;
  },
): Promise<{ id: string; reference: string }> {
  const result = await executor.query<{ id: string }>(
    `
      INSERT INTO telegram_topup_requests (
        customer_account_id, telegram_id, telegram_chat_id,
        volume_package_id, amount_minor, currency, receipt_file_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
      RETURNING id
    `,
    [
      input.customerAccountId,
      input.telegramId,
      input.telegramChatId,
      input.volumePackageId,
      input.amountMinor,
      input.currency,
      input.receiptFileId,
    ],
  );
  const id = result.rows[0].id;
  return { id, reference: topupReference(id) };
}

export interface ApproveTopupOutcome {
  requestId: string;
  reference: string;
  customerAccountId: string;
  telegramId: string | null;
  telegramChatId: string | null;
  packageName: string;
  volumeBytes: number;
  quotaLimitBeforeBytes: number | null;
  quotaLimitAfterBytes: number;
  amountMinor: number | null;
  currency: string | null;
  /** Referral commission credited to the inviter (buyer had `referred_by`), else null. */
  commission: TopupReferralCommission | null;
}

/** Admin-configured gem economy needed to pay the referred-purchase commission. */
export interface TopupGemEconomy {
  referralPurchasePct: number;
  gemRedeemPerGb: number;
}

/**
 * Approve a pending top-up: credit the account's quota by applying the chosen
 * volume package (same math as allocatePaymentOrder / reseller package sale) and
 * stamp the request approved. If the buyer was referred, also credit the inviter
 * the configured commission (pct% of the purchased GB, paid in gems) via the gems
 * ledger — audited, in the SAME transaction as the quota credit. Returns
 * everything the caller needs to notify the buyer + inviter and audit. Only a
 * 'pending' request can be approved.
 */
export async function approveTopupInTransaction(
  executor: DatabaseQueryExecutor,
  id: string,
  input: {
    reviewer: string | null;
    note?: string | null;
    computeQuotaAfter: ComputeQuotaAfter;
    gemEconomy?: TopupGemEconomy | null;
  },
): Promise<ApproveTopupOutcome> {
  const locked = await executor.query<TopupRequestRow>(
    `${REQUEST_SELECT}
     WHERE id = $1 FOR UPDATE`,
    [id],
  );
  const request = locked.rows[0];
  if (!request) throw new NotFoundException('Top-up request not found');
  if (request.status !== 'pending') {
    throw new ConflictException('Only a pending top-up request can be approved');
  }
  if (!request.customerAccountId) throw new BadRequestException('Top-up request has no customer account');
  if (!request.volumePackageId) throw new BadRequestException('Top-up request has no volume package');

  const packageResult = await executor.query<VolumePackageRow>(
    `SELECT name, volume_bytes AS "volumeBytes" FROM volume_packages WHERE id = $1 FOR UPDATE`,
    [request.volumePackageId],
  );
  const volumePackage = packageResult.rows[0];
  if (!volumePackage) throw new NotFoundException('Volume package not found');
  const volumeBytes = toFiniteNumber(volumePackage.volumeBytes) ?? 0;
  if (volumeBytes <= 0) throw new BadRequestException('Volume package volume must be positive');

  const accountResult = await executor.query<AccountRow>(
    `
      SELECT quota_limit_bytes AS "quotaLimitBytes", used_bytes AS "usedBytes", referred_by AS "referredBy"
      FROM customer_accounts
      WHERE id = $1
      FOR UPDATE
    `,
    [request.customerAccountId],
  );
  const account = accountResult.rows[0];
  if (!account) throw new NotFoundException('Customer account not found');

  const quotaLimitBeforeBytes = toFiniteNumber(account.quotaLimitBytes);
  const usedBytes = toFiniteNumber(account.usedBytes) ?? 0;
  const quotaLimitAfterBytes = input.computeQuotaAfter(quotaLimitBeforeBytes, usedBytes, volumeBytes);

  await executor.query(
    `UPDATE customer_accounts SET quota_limit_bytes = $1, updated_at = now() WHERE id = $2`,
    [quotaLimitAfterBytes, request.customerAccountId],
  );

  // Referral commission: if the buyer was invited by someone, credit that inviter
  // pct% of the purchased GB in gems (docs §14/plan §E). Audited via the ledger,
  // same transaction as the quota credit.
  let commission: TopupReferralCommission | null = null;
  const inviterAccountId = account.referredBy;
  if (inviterAccountId && input.gemEconomy) {
    const gems = computeReferralCommissionGems(
      volumeBytes,
      input.gemEconomy.referralPurchasePct,
      input.gemEconomy.gemRedeemPerGb,
    );
    if (gems > 0) {
      // Append the commission to the gems ledger (audit) + bump the cached balance —
      // same shape as billing/gems.ts earnGems, inlined to keep this module free of
      // relative value imports (node --test loadability).
      await executor.query(
        `INSERT INTO gems_ledger (customer_account_id, delta, reason, ref) VALUES ($1, $2, 'referral_commission', $3)`,
        [inviterAccountId, gems, id],
      );
      const balanceResult = await executor.query<{ gemsBalance: string | number }>(
        `UPDATE customer_accounts SET gems_balance = gems_balance + $2, updated_at = now() WHERE id = $1 RETURNING gems_balance AS "gemsBalance"`,
        [inviterAccountId, gems],
      );
      const inviterResult = await executor.query<InviterRow>(
        `
          SELECT ca.telegram_id AS "telegramId", tu.chat_id AS "telegramChatId"
          FROM customer_accounts ca
          LEFT JOIN telegram_users tu ON tu.telegram_id = ca.telegram_id
          WHERE ca.id = $1
        `,
        [inviterAccountId],
      );
      commission = {
        inviterAccountId,
        inviterTelegramId: inviterResult.rows[0]?.telegramId ?? null,
        inviterTelegramChatId: inviterResult.rows[0]?.telegramChatId ?? null,
        gems,
        inviterGemsBalance: toFiniteNumber(balanceResult.rows[0]?.gemsBalance) ?? gems,
        pct: input.gemEconomy.referralPurchasePct,
      };
    }
  }

  await executor.query(
    `
      UPDATE telegram_topup_requests
      SET status = 'approved', reviewed_by = $2, reviewed_at = now(), review_note = $3
      WHERE id = $1
    `,
    [id, input.reviewer, input.note ?? null],
  );

  return {
    requestId: id,
    reference: topupReference(id),
    customerAccountId: request.customerAccountId,
    telegramId: request.telegramId,
    telegramChatId: request.telegramChatId,
    packageName: volumePackage.name,
    volumeBytes,
    quotaLimitBeforeBytes,
    quotaLimitAfterBytes,
    amountMinor: toFiniteNumber(request.amountMinor),
    currency: request.currency,
    commission,
  };
}

export interface RejectTopupOutcome {
  requestId: string;
  reference: string;
  customerAccountId: string | null;
  telegramId: string | null;
  telegramChatId: string | null;
  reason: string | null;
}

/**
 * Reject a top-up request (awaiting a receipt or pending review) with a reason.
 * Never credits quota. A request already approved/rejected cannot be rejected.
 */
export async function rejectTopupInTransaction(
  executor: DatabaseQueryExecutor,
  id: string,
  input: { reviewer: string | null; reason: string | null },
): Promise<RejectTopupOutcome> {
  const locked = await executor.query<TopupRequestRow>(
    `${REQUEST_SELECT}
     WHERE id = $1 FOR UPDATE`,
    [id],
  );
  const request = locked.rows[0];
  if (!request) throw new NotFoundException('Top-up request not found');
  if (request.status !== 'pending' && request.status !== 'awaiting_receipt') {
    throw new ConflictException('Only an open top-up request can be rejected');
  }

  await executor.query(
    `
      UPDATE telegram_topup_requests
      SET status = 'rejected', reviewed_by = $2, reviewed_at = now(), review_note = $3
      WHERE id = $1
    `,
    [id, input.reviewer, input.reason],
  );

  return {
    requestId: id,
    reference: topupReference(id),
    customerAccountId: request.customerAccountId,
    telegramId: request.telegramId,
    telegramChatId: request.telegramChatId,
    reason: input.reason,
  };
}
