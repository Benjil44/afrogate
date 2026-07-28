import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { DatabaseQueryExecutor } from '../database/database.service';

/**
 * Pure, transaction-scoped logic for the reseller card-to-card wallet top-up flow.
 *
 * A reseller requests a wallet top-up (amount + a card-to-card receipt image stored
 * server-side), a superadmin/admin approves it, and approval CREDITS the reseller
 * wallet — the same ledger mechanism as a manual `topUpResellerWallet`, but linked
 * back to the request. These functions take a `DatabaseQueryExecutor` (real tx or a
 * fake in tests) so the state machine and the credit are unit-testable without a DB.
 * The module is intentionally self-contained (only `@nestjs/common` + a type-only
 * import) so the node --test runner can load it directly.
 *
 * IMPORTANT (wallet credit): approval never invents a crediting mechanism. It writes
 * a `topup` row to `reseller_wallet_ledger` and moves `reseller_accounts.balance_amount`
 * by exactly the requested amount — the SAME shape as `insertResellerWalletLedgerEntry`.
 */

export type ResellerTopupRequestStatus = 'pending' | 'approved' | 'rejected';

/** Coerce a bigint-as-string/number column value to a finite number, else null. */
function toFiniteNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Short, stable human reference for a request id (e.g. "A1B2C3"). */
export function resellerTopupReference(id: string): string {
  return id.replace(/-/g, '').slice(0, 6).toUpperCase();
}

interface TopupRequestRow {
  id: string;
  status: string;
  resellerAccountId: string;
  amount: string | number;
  currency: string;
}

interface ResellerRow {
  status: string;
  currency: string;
  balanceAmount: string | number;
  creditLimitAmount: string | number;
}

const REQUEST_SELECT = `
  SELECT
    id,
    status,
    reseller_account_id AS "resellerAccountId",
    amount,
    currency
  FROM reseller_wallet_topup_requests
`;

export interface ApproveResellerTopupOutcome {
  requestId: string;
  reference: string;
  resellerAccountId: string;
  amount: number;
  currency: string;
  balanceBeforeAmount: number;
  balanceAfterAmount: number;
  walletLedgerId: string;
}

/**
 * Approve a pending reseller wallet top-up request: credit the reseller wallet by
 * the requested amount (write a `topup` ledger entry + move the balance) and stamp
 * the request `approved` with the reviewer + the linked ledger id. Only a `pending`
 * request can be approved. Runs entirely inside the caller's transaction.
 */
export async function approveResellerTopupInTransaction(
  executor: DatabaseQueryExecutor,
  id: string,
  input: { reviewer: string | null; note?: string | null },
): Promise<ApproveResellerTopupOutcome> {
  const locked = await executor.query<TopupRequestRow>(
    `${REQUEST_SELECT}
     WHERE id = $1 FOR UPDATE`,
    [id],
  );
  const request = locked.rows[0];
  if (!request) throw new NotFoundException('Reseller top-up request not found');
  if (request.status !== 'pending') {
    throw new ConflictException('Only a pending reseller top-up request can be approved');
  }
  const amount = toFiniteNumber(request.amount) ?? 0;
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new BadRequestException('Reseller top-up amount must be a positive integer');
  }

  const resellerResult = await executor.query<ResellerRow>(
    `
      SELECT status, currency,
             balance_amount AS "balanceAmount",
             credit_limit_amount AS "creditLimitAmount"
      FROM reseller_accounts
      WHERE id = $1
      FOR UPDATE
    `,
    [request.resellerAccountId],
  );
  const reseller = resellerResult.rows[0];
  if (!reseller) throw new NotFoundException('Reseller account not found');
  if (reseller.currency !== request.currency) {
    throw new BadRequestException('Reseller top-up currency does not match the wallet currency');
  }

  const balanceBeforeAmount = toFiniteNumber(reseller.balanceAmount) ?? 0;
  const balanceAfterAmount = balanceBeforeAmount + amount;
  if (!Number.isSafeInteger(balanceAfterAmount)) {
    throw new BadRequestException('Reseller wallet balance would exceed the safe money range');
  }

  await executor.query(
    `
      UPDATE reseller_accounts
      SET balance_amount = $1, updated_by = $2, updated_at = now()
      WHERE id = $3
    `,
    [balanceAfterAmount, input.reviewer, request.resellerAccountId],
  );

  const ledgerResult = await executor.query<{ id: string }>(
    `
      INSERT INTO reseller_wallet_ledger (
        reseller_account_id, entry_type, amount, balance_before_amount,
        balance_after_amount, currency, source, source_id, notes, metadata, created_by
      )
      VALUES ($1, 'topup', $2, $3, $4, $5, 'manual_topup', $6, $7, $8::jsonb, $9)
      RETURNING id
    `,
    [
      request.resellerAccountId,
      amount,
      balanceBeforeAmount,
      balanceAfterAmount,
      request.currency,
      id,
      input.note ?? null,
      JSON.stringify({ resellerTopupRequestId: id }),
      input.reviewer,
    ],
  );
  const walletLedgerId = ledgerResult.rows[0].id;

  await executor.query(
    `
      UPDATE reseller_wallet_topup_requests
      SET status = 'approved', reviewed_by = $2, reviewed_at = now(),
          note = COALESCE($3, note), wallet_ledger_id = $4
      WHERE id = $1
    `,
    [id, input.reviewer, input.note ?? null, walletLedgerId],
  );

  return {
    requestId: id,
    reference: resellerTopupReference(id),
    resellerAccountId: request.resellerAccountId,
    amount,
    currency: request.currency,
    balanceBeforeAmount,
    balanceAfterAmount,
    walletLedgerId,
  };
}

export interface RejectResellerTopupOutcome {
  requestId: string;
  reference: string;
  resellerAccountId: string;
  reason: string | null;
}

/**
 * Reject a pending reseller top-up request with an optional reason. Never credits
 * the wallet. A request already approved/rejected cannot be rejected.
 */
export async function rejectResellerTopupInTransaction(
  executor: DatabaseQueryExecutor,
  id: string,
  input: { reviewer: string | null; reason: string | null },
): Promise<RejectResellerTopupOutcome> {
  const locked = await executor.query<TopupRequestRow>(
    `${REQUEST_SELECT}
     WHERE id = $1 FOR UPDATE`,
    [id],
  );
  const request = locked.rows[0];
  if (!request) throw new NotFoundException('Reseller top-up request not found');
  if (request.status !== 'pending') {
    throw new ConflictException('Only a pending reseller top-up request can be rejected');
  }

  await executor.query(
    `
      UPDATE reseller_wallet_topup_requests
      SET status = 'rejected', reviewed_by = $2, reviewed_at = now(),
          note = COALESCE($3, note)
      WHERE id = $1
    `,
    [id, input.reviewer, input.reason],
  );

  return {
    requestId: id,
    reference: resellerTopupReference(id),
    resellerAccountId: request.resellerAccountId,
    reason: input.reason,
  };
}
