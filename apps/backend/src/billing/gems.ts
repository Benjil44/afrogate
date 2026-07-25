import { BadRequestException, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { DatabaseQueryExecutor } from '../database/database.service';

/**
 * Decimal gigabyte (1 GB = 1e9 bytes) + the paid-allocation quota math, kept LOCAL
 * so this module has NO relative value imports and stays loadable by the
 * `node --test` runner (which cannot resolve extensionless .ts specifiers). These
 * MUST match billing/quota-math.ts (BYTES_PER_GB / computeAllocatedQuotaLimitBytes)
 * — a redeem grants only fresh headroom, never forgiving prior usage.
 */
const BYTES_PER_GB = 1_000_000_000;
const MAX_SAFE_BYTES = Number.MAX_SAFE_INTEGER;

function computeAllocatedQuotaLimitBytes(
  quotaLimitBeforeBytes: number | null,
  usedBytes: number,
  volumeBytes: number,
): number {
  const after = (quotaLimitBeforeBytes ?? usedBytes) + volumeBytes;
  if (!Number.isSafeInteger(after) || after > MAX_SAFE_BYTES) {
    throw new BadRequestException('Allocated quota would exceed the safe byte limit');
  }
  return after;
}

/**
 * afroWS gems: the pure, transaction-scoped rewards engine (docs
 * telegram-bot-v2-plan.md §"Default economy" + telegram-bot-flow-design.md §13).
 *
 * Every function takes a `DatabaseQueryExecutor` (a real tx or a test fake) so
 * balance math, the append-only `gems_ledger` audit trail, and referral
 * attribution are all unit-testable without a database. The module is
 * self-contained (only `@nestjs/common` + `crypto` + a type-only DB import + the
 * shared quota-math) so `node --test` can load it directly.
 *
 * INVARIANTS:
 *  - `gems_ledger` is append-only: every balance change writes exactly one signed
 *    row (+ earn, − spend) before/with the cached `customer_accounts.gems_balance`
 *    update — the ledger is the source of truth, the column is a running cache.
 *  - Gems redeem to GB with the SAME decimal quota math as a top-up
 *    (`computeAllocatedQuotaLimitBytes`): a redeem grants only fresh headroom,
 *    never retroactively forgiving prior usage. 1 GB = 1,000,000,000 bytes.
 *  - One-time credits (signup bonus, milestone) are de-duplicated on (reason, ref)
 *    so replays never double-pay.
 */

/** Machine tags stored in `gems_ledger.reason` (the bot maps these to gems.reason.* copy). */
export type GemsReason =
  | 'referral_signup'
  | 'referral_commission'
  | 'referral_milestone'
  | 'redeem'
  | 'admin_adjust';

/**
 * Referral-code alphabet: uppercase + digits minus the lookalikes 0/O and 1/I/L
 * (docs §13). 30 symbols × 8 chars ≈ 6.6e11 space, so random collisions are
 * vanishingly rare and are caught anyway by the DB unique index on retry.
 */
const REFERRAL_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const REFERRAL_CODE_LENGTH = 8;
const REFERRAL_CODE_MAX_ATTEMPTS = 12;

/** Coerce a bigint-as-string/number column to a finite number, else null. */
function toFiniteNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Append one signed gem movement to the ledger and update the cached balance,
 * returning the new balance. Positive delta = credited, negative = spent. Callers
 * that spend MUST have validated the balance first (the DB CHECK forbids a
 * negative balance and will abort the tx otherwise). Runs inside the caller's tx.
 */
export async function earnGems(
  executor: DatabaseQueryExecutor,
  accountId: string,
  delta: number,
  reason: GemsReason | string,
  ref: string | null = null,
): Promise<{ gemsBalance: number }> {
  if (!Number.isSafeInteger(delta)) {
    throw new BadRequestException('Gem delta must be a safe integer');
  }
  await executor.query(
    `INSERT INTO gems_ledger (customer_account_id, delta, reason, ref) VALUES ($1, $2, $3, $4)`,
    [accountId, delta, reason, ref],
  );
  const updated = await executor.query<{ gemsBalance: string | number }>(
    `UPDATE customer_accounts
        SET gems_balance = gems_balance + $2, updated_at = now()
      WHERE id = $1
      RETURNING gems_balance AS "gemsBalance"`,
    [accountId, delta],
  );
  const row = updated.rows[0];
  if (!row) throw new NotFoundException('Customer account not found');
  return { gemsBalance: toFiniteNumber(row.gemsBalance) ?? 0 };
}

export interface RedeemGemsResult {
  gemsSpent: number;
  gemsBalance: number;
  gbAdded: number;
  bytesAdded: number;
  quotaLimitBeforeBytes: number | null;
  quotaLimitAfterBytes: number;
}

/**
 * Spend gems to add GB of quota headroom. `gemsToSpend` must be a whole multiple
 * of `ratePerGb` (the bot only offers whole-GB amounts), guaranteeing integer
 * bytes. Validates the balance under a row lock, deducts the gems (ledger row,
 * reason 'redeem'), and credits the quota via the shared allocation math. Runs
 * inside the caller's tx.
 */
export async function redeemGemsForGb(
  executor: DatabaseQueryExecutor,
  accountId: string,
  gemsToSpend: number,
  ratePerGb: number,
): Promise<RedeemGemsResult> {
  if (!Number.isSafeInteger(gemsToSpend) || gemsToSpend <= 0) {
    throw new BadRequestException('gemsToSpend must be a positive integer');
  }
  if (!Number.isSafeInteger(ratePerGb) || ratePerGb <= 0) {
    throw new BadRequestException('ratePerGb must be a positive integer');
  }
  if (gemsToSpend % ratePerGb !== 0) {
    throw new BadRequestException('gemsToSpend must convert to a whole number of GB at the current rate');
  }

  const locked = await executor.query<{
    gemsBalance: string | number | null;
    quotaLimitBytes: string | number | null;
    usedBytes: string | number | null;
  }>(
    `SELECT gems_balance AS "gemsBalance", quota_limit_bytes AS "quotaLimitBytes", used_bytes AS "usedBytes"
       FROM customer_accounts
      WHERE id = $1
      FOR UPDATE`,
    [accountId],
  );
  const account = locked.rows[0];
  if (!account) throw new NotFoundException('Customer account not found');

  const balance = toFiniteNumber(account.gemsBalance) ?? 0;
  if (balance < gemsToSpend) throw new BadRequestException('Insufficient gems balance');

  const gbAdded = gemsToSpend / ratePerGb;
  const bytesAdded = gbAdded * BYTES_PER_GB;
  const quotaLimitBeforeBytes = toFiniteNumber(account.quotaLimitBytes);
  const usedBytes = toFiniteNumber(account.usedBytes) ?? 0;
  const quotaLimitAfterBytes = computeAllocatedQuotaLimitBytes(quotaLimitBeforeBytes, usedBytes, bytesAdded);

  await executor.query(
    `INSERT INTO gems_ledger (customer_account_id, delta, reason, ref) VALUES ($1, $2, 'redeem', $3)`,
    [accountId, -gemsToSpend, `${gbAdded}GB`],
  );
  const updated = await executor.query<{ gemsBalance: string | number }>(
    `UPDATE customer_accounts
        SET gems_balance = gems_balance - $2, quota_limit_bytes = $3, updated_at = now()
      WHERE id = $1
      RETURNING gems_balance AS "gemsBalance"`,
    [accountId, gemsToSpend, quotaLimitAfterBytes],
  );

  return {
    gemsSpent: gemsToSpend,
    gemsBalance: toFiniteNumber(updated.rows[0]?.gemsBalance) ?? balance - gemsToSpend,
    gbAdded,
    bytesAdded,
    quotaLimitBeforeBytes,
    quotaLimitAfterBytes,
  };
}

/**
 * Gems paid to an inviter for a referred purchase: `pct`% of the purchased GB,
 * expressed in gems at the redeem rate. Example (defaults): a 20 GB buy →
 * 20 × 20% = 4 GB → 4 × 100 gems/GB = 400 gems. Floored to a whole gem.
 */
export function computeReferralCommissionGems(
  volumeBytes: number,
  pct: number,
  ratePerGb: number,
): number {
  if (!Number.isFinite(volumeBytes) || volumeBytes <= 0) return 0;
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  if (!Number.isFinite(ratePerGb) || ratePerGb <= 0) return 0;
  const gb = volumeBytes / BYTES_PER_GB;
  return Math.floor((gb * pct * ratePerGb) / 100);
}

/** Generate one random referral code (no uniqueness check). `random` injectable for tests. */
export function generateReferralCode(random: (size: number) => Buffer = randomBytes): string {
  const bytes = random(REFERRAL_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    code += REFERRAL_ALPHABET[bytes[i] % REFERRAL_ALPHABET.length];
  }
  return code;
}

/**
 * Generate a referral code not already used by any account, retrying on the
 * (rare) collision. The DB unique index is the ultimate guard; this pre-check
 * keeps the happy path clean.
 */
export async function generateUniqueReferralCode(
  executor: DatabaseQueryExecutor,
  generate: () => string = () => generateReferralCode(),
): Promise<string> {
  for (let attempt = 0; attempt < REFERRAL_CODE_MAX_ATTEMPTS; attempt++) {
    const code = generate();
    const existing = await executor.query(
      `SELECT 1 FROM customer_accounts WHERE referral_code = $1 LIMIT 1`,
      [code],
    );
    if (existing.rows.length === 0) return code;
  }
  throw new Error('Could not generate a unique referral code');
}

/**
 * Attribute a new account to its inviter (write-once). Resolves `code` to an
 * existing account; rejects self-referral and any account already attributed.
 * Returns the inviter id, or null if the code is unknown / self / already-set —
 * a bad invite code must never block onboarding, only skip the bonus.
 */
export async function attributeReferral(
  executor: DatabaseQueryExecutor,
  newAccountId: string,
  code: string | null | undefined,
): Promise<{ inviterAccountId: string } | null> {
  const trimmed = (code ?? '').trim();
  if (!trimmed) return null;

  const inviter = await executor.query<{ id: string }>(
    `SELECT id FROM customer_accounts WHERE referral_code = $1 AND deleted_at IS NULL LIMIT 1`,
    [trimmed],
  );
  const inviterId = inviter.rows[0]?.id;
  if (!inviterId) return null;
  if (inviterId === newAccountId) return null; // no self-referral

  // Write-once: only set referred_by when it is still null.
  const updated = await executor.query<{ id: string }>(
    `UPDATE customer_accounts
        SET referred_by = $2, updated_at = now()
      WHERE id = $1 AND referred_by IS NULL
      RETURNING id`,
    [newAccountId, inviterId],
  );
  if (updated.rows.length === 0) return null; // already attributed
  return { inviterAccountId: inviterId };
}

/** Count an inviter's completed referrals (accounts with referred_by = inviter). */
export async function countCompletedReferrals(
  executor: DatabaseQueryExecutor,
  inviterAccountId: string,
): Promise<number> {
  const result = await executor.query<{ count: string | number }>(
    `SELECT COUNT(*)::int AS count FROM customer_accounts WHERE referred_by = $1 AND deleted_at IS NULL`,
    [inviterAccountId],
  );
  return toFiniteNumber(result.rows[0]?.count) ?? 0;
}

export interface ReferralMilestoneCredit {
  count: number;
  bonusGems: number;
  inviterGemsBalance: number;
}

export interface ReferralSignupCredit {
  inviterAccountId: string;
  signupGems: number;
  inviterGemsBalance: number;
  completedReferrals: number;
  milestone: ReferralMilestoneCredit | null;
}

export interface ReferralRewardConfig {
  signupGems: number;
  milestoneEvery: number;
  milestoneBonus: number;
}

/**
 * Credit the inviter the signup bonus once the referred user completes
 * registration (the anti-abuse "completed referral" gate), then check the
 * milestone. De-duplicated on the referred account id, so a replay is a no-op
 * (returns null). Returns everything the bot needs to push N3 (+N5 on milestone).
 */
export async function creditReferralSignup(
  executor: DatabaseQueryExecutor,
  referredAccountId: string,
  inviterAccountId: string,
  config: ReferralRewardConfig,
): Promise<ReferralSignupCredit | null> {
  const already = await executor.query(
    `SELECT 1 FROM gems_ledger WHERE reason = 'referral_signup' AND ref = $1 LIMIT 1`,
    [referredAccountId],
  );
  if (already.rows.length > 0) return null;

  let inviterGemsBalance: number;
  if (config.signupGems > 0) {
    const credit = await earnGems(
      executor,
      inviterAccountId,
      config.signupGems,
      'referral_signup',
      referredAccountId,
    );
    inviterGemsBalance = credit.gemsBalance;
  } else {
    inviterGemsBalance = await readGemsBalance(executor, inviterAccountId);
  }

  const completedReferrals = await countCompletedReferrals(executor, inviterAccountId);
  let milestone: ReferralMilestoneCredit | null = null;
  if (
    config.milestoneEvery > 0 &&
    config.milestoneBonus > 0 &&
    completedReferrals > 0 &&
    completedReferrals % config.milestoneEvery === 0
  ) {
    const ref = `milestone:${completedReferrals}`;
    const duplicate = await executor.query(
      `SELECT 1 FROM gems_ledger WHERE reason = 'referral_milestone' AND ref = $1 LIMIT 1`,
      [ref],
    );
    if (duplicate.rows.length === 0) {
      const credit = await earnGems(executor, inviterAccountId, config.milestoneBonus, 'referral_milestone', ref);
      inviterGemsBalance = credit.gemsBalance;
      milestone = { count: completedReferrals, bonusGems: config.milestoneBonus, inviterGemsBalance };
    }
  }

  return {
    inviterAccountId,
    signupGems: config.signupGems,
    inviterGemsBalance,
    completedReferrals,
    milestone,
  };
}

/** Read an account's current cached gems balance. */
export async function readGemsBalance(
  executor: DatabaseQueryExecutor,
  accountId: string,
): Promise<number> {
  const result = await executor.query<{ gemsBalance: string | number | null }>(
    `SELECT gems_balance AS "gemsBalance" FROM customer_accounts WHERE id = $1`,
    [accountId],
  );
  return toFiniteNumber(result.rows[0]?.gemsBalance) ?? 0;
}
