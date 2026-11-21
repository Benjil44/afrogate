import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { DatabaseQueryExecutor } from '../database/database.service';
// TYPE-ONLY imports only: this module is loaded directly by node --test (via its .ts
// source), so it must not carry runtime relative-value imports (they resolve under
// nest's CommonJS build but not under node's ESM type-stripping). The pure DECISIONS
// (grace / approval-bonuses) live in billing/*.ts as the tested source of truth and are
// INJECTED here by the Nest caller; the small grace/cycle helpers below are inlined and
// kept in step with billing/grace.ts + billing/cycle-anchor.ts.
import type {
  ApprovalSnapshot,
  ApprovalBonusesInput,
  BonusGrant,
  BonusSkip,
} from '../billing/approval-bonuses';

/** 1 day in ms (kept local; mirrors billing/approval-bonuses.DAY_MS). */
const DAY_MS = 24 * 60 * 60 * 1000;
/** 24h receipt-grace window (mirrors billing/grace.GRACE_WINDOW_MS). */
const GRACE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Penalized-reject lockout: 30 days (mirrors billing/grace.GRACE_LOCKOUT_MS). */
const GRACE_LOCKOUT_MS = 30 * 24 * 60 * 60 * 1000;
/** Grace overage cap = min(10% of plan, 3 GB) (mirrors billing/grace.graceCapBytes). */
function graceCapBytesLocal(planBytes: number | null): number {
  if (planBytes === null || !Number.isFinite(planBytes) || planBytes <= 0) return 0;
  return Math.min(Math.floor((planBytes * 10) / 100), 3_000_000_000);
}

/** Injected pure approval deciders (billing/approval-bonuses.ts). Omitted → no bonuses. */
export interface ApprovalDeciders {
  decideEarlyRenewal: (input: {
    snapshot: ApprovalSnapshot;
    hasPriorPaidTopup: boolean;
    amountMinor: number | null;
    now: Date;
  }) => { eligible: boolean };
  decideApprovalBonuses: (input: ApprovalBonusesInput) => { grants: BonusGrant[]; skips: BonusSkip[] };
}

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
 * Default referral DATA reward: 1.5 GB decimal = 1,500,000,000 bytes (NOT GiB).
 * When active (> 0) it REPLACES the gem referral paths; 0 disables it (gems resume).
 */
export const REFERRAL_REWARD_DEFAULT_BYTES = 1_500_000_000;

/**
 * Resolve the configured referral reward bytes, falling back to the 1.5 GB decimal
 * default when unset/invalid. A stored 0 is honoured (operator disabled the reward).
 * Mirrors the gem-economy resolver: missing column / non-finite / negative → default.
 * Lives here (not in the Nest config service) so it is unit-testable under node --test.
 */
export function resolveReferralRewardBytes(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return REFERRAL_REWARD_DEFAULT_BYTES;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isSafeInteger(parsed) || parsed < 0) return REFERRAL_REWARD_DEFAULT_BYTES;
  return parsed;
}

/** Per-inviter cap of GRANTED data rewards within the rolling window (policy). */
export const REFERRAL_REWARD_CAP_PER_WINDOW = 20;
/** Rolling window the cap is measured over: 30 days, in milliseconds. */
export const REFERRAL_REWARD_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Ledger status for a referral data reward. 'reversed' is reserved for future use. */
export type ReferralRewardStatus = 'granted' | 'pending_review' | 'reversed';

export type ReferralRewardSkipReason =
  | 'reward_disabled'
  | 'no_inviter'
  | 'self_referral'
  | 'unpaid'
  | 'inviter_inactive'
  | 'inviter_unlimited';

export interface ReferralRewardDecision {
  /** Status of the ledger row to record, or null to skip entirely (no row, no credit). */
  status: ReferralRewardStatus | null;
  /** Credit the inviter's quota — true only for a 'granted' row. */
  creditQuota: boolean;
  /** Machine reason when skipped (status === null), else null. */
  skipReason: ReferralRewardSkipReason | null;
}

/**
 * Pure referral-data-reward decision (unit-testable, no DB). Given the invitee's
 * approved paid top-up and the inviter's facts, decides whether to record a reward
 * ledger row and whether it credits quota:
 *   - reward disabled (bytes <= 0), no inviter, self-referral, or an unpaid
 *     (amount_minor <= 0) approval   → skip (no row, no credit)
 *   - inviter not active, or month expired at credit time → skip (so the monthly
 *     sweep can't claw back a credit; v1, documented)
 *   - per-inviter rolling-window cap reached → record 'pending_review' (NO quota)
 *   - otherwise → 'granted' (credit the inviter's quota)
 * Idempotency (one reward per invitee, ever) is enforced at the DB layer by the
 * UNIQUE(invited_account_id) ON CONFLICT insert, not here.
 */
export function decideReferralReward(input: {
  referralRewardBytes: number;
  inviterAccountId: string | null | undefined;
  invitedAccountId: string;
  amountMinor: number | null;
  inviterStatus: string | null | undefined;
  inviterExpiresAt: Date | null;
  /** The inviter's quota_limit_bytes. `null` means UNLIMITED (no cap) — skip the
   * reward, because adding a finite 1.5 GB would CAP a previously-unlimited account
   * (and could cut it off). `undefined` = not provided (treated as finite/unknown). */
  inviterQuotaLimitBytes?: number | null;
  grantedInWindow: number;
  now: Date;
  capPerWindow?: number;
}): ReferralRewardDecision {
  const skip = (skipReason: ReferralRewardSkipReason): ReferralRewardDecision => ({
    status: null,
    creditQuota: false,
    skipReason,
  });

  if (!Number.isFinite(input.referralRewardBytes) || input.referralRewardBytes <= 0) return skip('reward_disabled');
  if (!input.inviterAccountId) return skip('no_inviter');
  if (input.inviterAccountId === input.invitedAccountId) return skip('self_referral');
  if (input.amountMinor === null || !Number.isFinite(input.amountMinor) || input.amountMinor <= 0) return skip('unpaid');

  const inviterActive =
    input.inviterStatus === 'active' &&
    (input.inviterExpiresAt === null || input.inviterExpiresAt.getTime() > input.now.getTime());
  if (!inviterActive) return skip('inviter_inactive');
  // UNLIMITED inviter (quota_limit_bytes IS NULL): crediting a finite reward would
  // cap an uncapped account at 1.5 GB (and the next provisioning tick could cut it
  // off if it already used more). Skip entirely — no row, no credit.
  if (input.inviterQuotaLimitBytes === null) return skip('inviter_unlimited');

  const cap = input.capPerWindow ?? REFERRAL_REWARD_CAP_PER_WINDOW;
  if (input.grantedInWindow >= cap) {
    return { status: 'pending_review', creditQuota: false, skipReason: null };
  }
  return { status: 'granted', creditQuota: true, skipReason: null };
}

/** Add a referral reward to a base byte count, guarding against unsafe overflow
 * (mirrors quota-math.addPositiveBytes; inlined to keep this module value-import-free). */
function addRewardBytes(baseBytes: number, deltaBytes: number): number {
  const next = baseBytes + deltaBytes;
  if (!Number.isSafeInteger(next) || next > Number.MAX_SAFE_INTEGER) {
    throw new BadRequestException('Allocated referral reward would exceed the safe byte limit');
  }
  return next;
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

/** Signature of the injected monthly-period calculator (billing/monthly-period.computePeriodCredit). */
export type ComputePeriodCredit = (input: {
  quotaLimitBeforeBytes: number | null;
  usedBytes: number;
  volumeBytes: number;
  expiresAt: Date | null;
  durationDays: number | null;
  now: Date;
  /** Early-renewal extends a running month instead of keeping the end date (Q1). */
  earlyRenewal?: boolean;
}) => { quotaLimitAfterBytes: number; expiresAt: Date | null; periodStarted: boolean };

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
  resellerAccountId: string | null;
  createdAt?: Date | string | null;
  snapUsedBytes?: string | number | null;
  snapQuotaLimitBytes?: string | number | null;
  snapCycleStartUsedBytes?: string | number | null;
  snapExpiresAt?: Date | string | null;
  snapLapsedAt?: Date | string | null;
}

interface AccountRow {
  quotaLimitBytes: string | number | null;
  usedBytes: string | number | null;
  referredBy: string | null;
  expiresAt?: Date | string | null;
  accountCreatedAt?: Date | string | null;
}

/** Per-lever kill-switches resolved from AFROWS_*_ENABLED by the caller (default all on). */
export interface ApprovalBonusesEnabled {
  firstPurchase: boolean;
  earlyRenewal: boolean;
  winback: boolean;
  inviteeReferral: boolean;
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

/**
 * Referral DATA reward recorded for the inviter on the invitee's first approved
 * paid top-up. `status` 'granted' means the quota was credited; 'pending_review'
 * means the per-inviter cap was hit — the row was recorded but NO quota credited.
 */
export interface TopupReferralDataReward {
  inviterAccountId: string;
  inviterTelegramId: string | null;
  inviterTelegramChatId: string | null;
  rewardBytes: number;
  /** The inviter's quota_limit_bytes after the credit (unchanged when not credited). */
  inviterQuotaAfterBytes: number | null;
  status: ReferralRewardStatus;
}

interface VolumePackageRow {
  name: string;
  volumeBytes: string | number;
  durationDays?: string | number | null;
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
    currency,
    reseller_account_id AS "resellerAccountId",
    created_at AS "createdAt",
    snap_used_bytes AS "snapUsedBytes",
    snap_quota_limit_bytes AS "snapQuotaLimitBytes",
    snap_cycle_start_used_bytes AS "snapCycleStartUsedBytes",
    snap_expires_at AS "snapExpiresAt",
    snap_lapsed_at AS "snapLapsedAt"
  FROM telegram_topup_requests
`;

/**
 * Create a top-up request directly in status 'pending' with the receipt photo's
 * file_id. Per docs §5, the in-progress charge lives in the per-user state
 * (telegram_users); when the receipt photo arrives the row is created here in one
 * step (there is no intermediate 'awaiting_receipt' row). Returns id + reference.
 *
 * `resellerAccountId` (Phase 4 of the seller-role plan): stamped from the buyer's
 * `customer_accounts.reseller_account_id` at creation. NULL keeps the existing
 * superadmin-approval path; non-NULL routes the request to that seller's bot
 * chat for approve/reject, settled via a reseller wallet debit instead of a
 * free superadmin grant.
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
    resellerAccountId?: string | null;
    now?: Date;
  },
): Promise<{ id: string; reference: string }> {
  const now = input.now ?? new Date();

  // C4: read the account row THEN (at upload) and freeze the decision snapshot on the
  // request, plus the grace-cap plan basis = the most recent approved PAID top-up
  // volume (Q3), falling back to the current quota for a never-paid account.
  const accountLock = await executor.query<{
    usedBytes: string | number | null;
    quotaLimitBytes: string | number | null;
    cycleStartUsedBytes: string | number | null;
    expiresAt: Date | string | null;
    lapsedAt: Date | string | null;
    graceBlockedUntil: Date | string | null;
    latestPaidVolumeBytes: string | number | null;
  }>(
    `
      SELECT ca.used_bytes AS "usedBytes",
             ca.quota_limit_bytes AS "quotaLimitBytes",
             ca.cycle_start_used_bytes AS "cycleStartUsedBytes",
             ca.expires_at AS "expiresAt",
             ca.lapsed_at AS "lapsedAt",
             ca.grace_blocked_until AS "graceBlockedUntil",
             (
               SELECT vp.volume_bytes
               FROM telegram_topup_requests t
               JOIN volume_packages vp ON vp.id = t.volume_package_id
               WHERE t.customer_account_id = ca.id AND t.status = 'approved'
                 AND t.amount_minor IS NOT NULL AND t.amount_minor > 0
               ORDER BY t.created_at DESC
               LIMIT 1
             ) AS "latestPaidVolumeBytes"
      FROM customer_accounts ca
      WHERE ca.id = $1
      FOR UPDATE OF ca
    `,
    [input.customerAccountId],
  );
  const account = accountLock.rows[0];
  const snapUsed = toFiniteNumber(account?.usedBytes) ?? 0;
  const snapQuota = toFiniteNumber(account?.quotaLimitBytes);
  const snapCycleStart = toFiniteNumber(account?.cycleStartUsedBytes) ?? 0;
  const snapExpiresAt = account?.expiresAt ? new Date(account.expiresAt) : null;
  const snapLapsedAt = account?.lapsedAt ? new Date(account.lapsedAt) : null;

  const result = await executor.query<{ id: string }>(
    `
      INSERT INTO telegram_topup_requests (
        customer_account_id, telegram_id, telegram_chat_id,
        volume_package_id, amount_minor, currency, receipt_file_id, status,
        reseller_account_id,
        snap_used_bytes, snap_quota_limit_bytes, snap_cycle_start_used_bytes,
        snap_expires_at, snap_lapsed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, $10, $11, $12, $13)
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
      input.resellerAccountId ?? null,
      snapUsed,
      snapQuota,
      snapCycleStart,
      snapExpiresAt,
      snapLapsedAt,
    ],
  );
  const id = result.rows[0].id;

  // Capped receipt grace (lever A; mirrors billing/grace.decideGrace). Unlimited accounts
  // need no grace; a penalized-reject lockout (grace_blocked_until in the future)
  // suppresses grace but still creates the request. Otherwise grant a 24h window and a
  // min(10% plan, 3 GB) overage cap. Plan basis = most recent approved PAID top-up volume,
  // else the current quota (Q3). Both grace_until and grace_cap_bytes are extend-only.
  const graceBlockedUntil = account?.graceBlockedUntil ? new Date(account.graceBlockedUntil) : null;
  const grantGrace = snapQuota !== null && !(graceBlockedUntil && graceBlockedUntil.getTime() > now.getTime());
  if (grantGrace) {
    const planBytes = toFiniteNumber(account?.latestPaidVolumeBytes) ?? snapQuota;
    const capBytes = graceCapBytesLocal(planBytes);
    const graceUntil = new Date(now.getTime() + GRACE_WINDOW_MS);
    await executor.query(
      `UPDATE customer_accounts
       SET grace_until = GREATEST(COALESCE(grace_until, now()), $2),
           grace_cap_bytes = GREATEST(COALESCE(grace_cap_bytes, 0), $3::bigint),
           updated_at = now()
       WHERE id = $1`,
      [input.customerAccountId, graceUntil, capBytes],
    );
  }
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
  /** Account end date after the credit (monthly packages), else the unchanged value. */
  expiresAt: Date | null;
  amountMinor: number | null;
  currency: string | null;
  /** Referral commission credited to the inviter (buyer had `referred_by`), else null. */
  commission: TopupReferralCommission | null;
  /**
   * Referral DATA reward recorded for the inviter (replaces the gem commission when
   * the reward is active, i.e. referralRewardBytes > 0), else null. Null when the
   * reward is disabled, the buyer had no inviter, the approval was unpaid, the
   * inviter was inactive/expired, or the invitee was already rewarded (idempotent).
   */
  referralReward: TopupReferralDataReward | null;
  /** Buyer approval bonuses actually granted (inserted) this approval; [] when none. */
  bonuses: BonusGrant[];
}

/** Admin-configured gem economy needed to pay the referred-purchase commission. */
export interface TopupGemEconomy {
  referralPurchasePct: number;
  gemRedeemPerGb: number;
}

/**
 * Record (and, when granted, credit) the inviter's referral DATA reward in the same
 * transaction as the top-up approval. Idempotent per invitee via
 * UNIQUE(invited_account_id) ON CONFLICT DO NOTHING — only the invitee's FIRST
 * approved paid top-up ever credits the inviter. The inviter row is locked FOR
 * UPDATE so concurrent rewards to the same inviter serialize and the rolling-window
 * cap is enforced correctly. The invitee account is already locked by the caller;
 * lock order is invitee → inviter (consistent across the flow).
 *
 * Returns the reward (for the inviter notice/audit) or null when nothing was
 * recorded (reward disabled, no/self inviter, unpaid, inactive inviter, or a
 * replay that hit the ON CONFLICT). The stored inviter_account_id is the RESOLVED
 * inviter at credit time and is never re-derived later (account merge re-points
 * referred_by — see customer-account-merge.ts).
 */
async function applyReferralDataReward(
  executor: DatabaseQueryExecutor,
  input: {
    invitedAccountId: string;
    inviterAccountId: string | null;
    amountMinor: number | null;
    referralRewardBytes: number;
    topupRequestId: string;
    now: Date;
  },
): Promise<TopupReferralDataReward | null> {
  // Cheap guards first (no inviter lock): reward off, no inviter, self-referral, or
  // an unpaid/gift approval. These need no inviter facts, so skip the lock entirely.
  if (!(input.referralRewardBytes > 0)) return null;
  if (!input.inviterAccountId) return null;
  if (input.inviterAccountId === input.invitedAccountId) return null;
  if (input.amountMinor === null || !(input.amountMinor > 0)) return null;

  // Lock the inviter and read status/expiry/quota/contact.
  const inviterLock = await executor.query<{
    status: string | null;
    expiresAt: Date | string | null;
    quotaLimitBytes: string | number | null;
    telegramId: string | null;
    telegramChatId: string | null;
  }>(
    `
      SELECT ca.status,
             ca.expires_at AS "expiresAt",
             ca.quota_limit_bytes AS "quotaLimitBytes",
             ca.telegram_id AS "telegramId",
             tu.chat_id AS "telegramChatId"
      FROM customer_accounts ca
      LEFT JOIN telegram_users tu ON tu.telegram_id = ca.telegram_id
      WHERE ca.id = $1
      FOR UPDATE OF ca
    `,
    [input.inviterAccountId],
  );
  const inviter = inviterLock.rows[0];
  if (!inviter) return null;

  // Count the inviter's GRANTED rewards inside the rolling window for the cap.
  const windowStart = new Date(input.now.getTime() - REFERRAL_REWARD_WINDOW_MS);
  const capResult = await executor.query<{ count: string | number }>(
    `
      SELECT COUNT(*)::int AS count
      FROM referral_rewards
      WHERE inviter_account_id = $1 AND status = 'granted' AND created_at > $2
    `,
    [input.inviterAccountId, windowStart],
  );
  const grantedInWindow = toFiniteNumber(capResult.rows[0]?.count) ?? 0;

  const decision = decideReferralReward({
    referralRewardBytes: input.referralRewardBytes,
    inviterAccountId: input.inviterAccountId,
    invitedAccountId: input.invitedAccountId,
    amountMinor: input.amountMinor,
    inviterStatus: inviter.status,
    inviterExpiresAt: inviter.expiresAt ? new Date(inviter.expiresAt) : null,
    // null quota = unlimited inviter → decideReferralReward skips (no cap/cut-off).
    inviterQuotaLimitBytes: toFiniteNumber(inviter.quotaLimitBytes),
    grantedInWindow,
    now: input.now,
  });
  if (!decision.status) return null;

  // Idempotent one-per-invitee insert: a replay hits ON CONFLICT DO NOTHING and
  // returns no row, so no second credit is ever applied.
  const inserted = await executor.query<{ id: string }>(
    `
      INSERT INTO referral_rewards (invited_account_id, inviter_account_id, reward_bytes, topup_request_id, status)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (invited_account_id) DO NOTHING
      RETURNING id
    `,
    [input.invitedAccountId, input.inviterAccountId, input.referralRewardBytes, input.topupRequestId, decision.status],
  );
  if (inserted.rows.length === 0) return null;

  const inviterQuotaBefore = toFiniteNumber(inviter.quotaLimitBytes);
  let inviterQuotaAfterBytes = inviterQuotaBefore;
  if (decision.creditQuota) {
    // Add the reward to the inviter's quota_limit_bytes (does NOT touch expires_at).
    // An unlimited (null-quota) inviter is already skipped by decideReferralReward
    // above (status null → returned), so here the baseline is always finite.
    inviterQuotaAfterBytes = addRewardBytes(inviterQuotaBefore ?? 0, input.referralRewardBytes);
    await executor.query(
      `UPDATE customer_accounts SET quota_limit_bytes = $1, updated_at = now() WHERE id = $2`,
      [inviterQuotaAfterBytes, input.inviterAccountId],
    );
  }

  return {
    inviterAccountId: input.inviterAccountId,
    inviterTelegramId: inviter.telegramId ?? null,
    inviterTelegramChatId: inviter.telegramChatId ?? null,
    rewardBytes: input.referralRewardBytes,
    inviterQuotaAfterBytes,
    status: decision.status,
  };
}

/**
 * Approve a pending top-up: credit the account's quota by applying the chosen
 * volume package (same math as allocatePaymentOrder / reseller package sale) and
 * stamp the request approved. If the buyer was referred, reward the inviter in the
 * SAME transaction as the quota credit:
 *   - when the DATA reward is active (referralRewardBytes > 0) → record a referral
 *     data reward (1.5 GB by default, once per invitee) and SKIP the gem commission;
 *   - otherwise → credit the gem commission (pct% of the purchased GB, in gems).
 * Returns everything the caller needs to notify the buyer + inviter and audit. Only
 * a 'pending' request can be approved.
 *
 * NOTE (v1 scope): reseller-settled approvals
 * (billing.approveTelegramTopupViaReseller) are OUT OF SCOPE — the data reward fires
 * only on this standard superadmin approval path.
 */
export async function approveTopupInTransaction(
  executor: DatabaseQueryExecutor,
  id: string,
  input: {
    reviewer: string | null;
    note?: string | null;
    computeQuotaAfter: ComputeQuotaAfter;
    /** When set, monthly packages (duration_days) open/extend the account month. */
    computePeriod?: ComputePeriodCredit;
    now?: Date;
    gemEconomy?: TopupGemEconomy | null;
    /**
     * Referral DATA reward size in decimal bytes (0 = disabled). When > 0 the data
     * reward replaces the gem commission on the referral path. Defaults to 0 (gems)
     * when omitted, so existing callers/tests keep the gem behavior.
     */
    referralRewardBytes?: number;
    /** Per-lever buyer-bonus kill-switches (default all on when omitted). */
    bonusesEnabled?: ApprovalBonusesEnabled;
    /** Injected pure approval deciders (billing/approval-bonuses.ts). Omitted → no bonuses. */
    deciders?: ApprovalDeciders;
  },
): Promise<ApproveTopupOutcome> {
  const now = input.now ?? new Date();
  const referralRewardBytes = input.referralRewardBytes ?? 0;
  const bonusesEnabled: ApprovalBonusesEnabled = input.bonusesEnabled ?? {
    firstPurchase: true,
    earlyRenewal: true,
    winback: true,
    inviteeReferral: true,
  };
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
    `SELECT name, volume_bytes AS "volumeBytes", duration_days AS "durationDays" FROM volume_packages WHERE id = $1 FOR UPDATE`,
    [request.volumePackageId],
  );
  const volumePackage = packageResult.rows[0];
  if (!volumePackage) throw new NotFoundException('Volume package not found');
  const volumeBytes = toFiniteNumber(volumePackage.volumeBytes) ?? 0;
  if (volumeBytes <= 0) throw new BadRequestException('Volume package volume must be positive');

  const accountResult = await executor.query<AccountRow>(
    `
      SELECT quota_limit_bytes AS "quotaLimitBytes", used_bytes AS "usedBytes", referred_by AS "referredBy",
             expires_at AS "expiresAt", created_at AS "accountCreatedAt"
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
  const expiresBefore = account.expiresAt ? new Date(account.expiresAt) : null;
  const amountMinor = toFiniteNumber(request.amountMinor);
  const resellerSettled = Boolean(request.resellerAccountId);
  // Decisions use the snapshot frozen at receipt upload (C4), at the request's own
  // created_at, so later usage drift cannot change eligibility. Older pre-0070 rows
  // have no snapshot (snap_used_bytes NULL) — fall back to the current account values.
  const hasSnapshot = toFiniteNumber(request.snapUsedBytes) !== null;
  const snapshot: ApprovalSnapshot = {
    usedBytes: hasSnapshot ? (toFiniteNumber(request.snapUsedBytes) ?? 0) : usedBytes,
    quotaLimitBytes: hasSnapshot ? toFiniteNumber(request.snapQuotaLimitBytes) : quotaLimitBeforeBytes,
    cycleStartUsedBytes: hasSnapshot ? (toFiniteNumber(request.snapCycleStartUsedBytes) ?? 0) : 0,
    expiresAt: hasSnapshot ? (request.snapExpiresAt ? new Date(request.snapExpiresAt) : null) : expiresBefore,
    lapsedAt: request.snapLapsedAt ? new Date(request.snapLapsedAt) : null,
  };
  const decisionNow = request.createdAt ? new Date(request.createdAt) : now;
  const accountCreatedAt = account.accountCreatedAt ? new Date(account.accountCreatedAt) : null;

  // Buyer approval bonuses (lever C) only run when the Nest caller injected the pure
  // deciders (billing/approval-bonuses.ts). Without them the flow is the plain base
  // credit — the original behaviour — so this module stays node --test loadable.
  const bonuses: BonusGrant[] = [];
  let bonusBytesTotal = 0;
  let earlyRenewalEligible = false;

  if (input.deciders) {
    // Prior-paid check looks BEYOND telegram_topup_requests: ANY prior paid acquisition
    // disqualifies first_purchase / invitee_referral, so a self-paid top-up can't farm
    // them within 72h. We cover every paid-credit seam that re-anchors the cycle:
    //   - a prior approved PAID Telegram top-up;
    //   - a paid payment_order (payment-order allocation AND reseller PACKAGE sales, which
    //     write a 'reseller_wallet' payment_order);
    //   - a reseller GB charge, which writes ONLY a reseller_wallet_ledger 'sale_debit'
    //     row (no payment_order) keyed by customer_account_id;
    //   - an admin paid volume charge, which writes a quota_charge_events ledger row
    //     (the dedicated operator volume-charge ledger; its only writer).
    const priorPaid = await executor.query<{ hasPriorPaid: boolean }>(
      `
        SELECT (
          EXISTS(
            SELECT 1 FROM telegram_topup_requests
            WHERE customer_account_id = $1 AND id <> $2 AND status = 'approved'
              AND amount_minor IS NOT NULL AND amount_minor > 0
          )
          OR EXISTS(
            SELECT 1 FROM payment_orders
            WHERE customer_account_id = $1 AND status = 'paid'
          )
          OR EXISTS(
            SELECT 1 FROM reseller_wallet_ledger
            WHERE customer_account_id = $1 AND entry_type = 'sale_debit'
          )
          OR EXISTS(
            SELECT 1 FROM quota_charge_events
            WHERE customer_account_id = $1
          )
        ) AS "hasPriorPaid"
      `,
      [request.customerAccountId, id],
    );
    const hasPriorPaidTopup = Boolean(priorPaid.rows[0]?.hasPriorPaid);
    earlyRenewalEligible = input.deciders.decideEarlyRenewal({ snapshot, hasPriorPaidTopup, amountMinor, now: decisionNow }).eligible;

    const lapseDays = snapshot.lapsedAt
      ? Math.floor((decisionNow.getTime() - snapshot.lapsedAt.getTime()) / DAY_MS)
      : null;
    const winbackWindow = await executor.query<{ has: boolean }>(
      `
        SELECT EXISTS(
          SELECT 1 FROM bonus_grants
          WHERE customer_account_id = $1 AND kind = 'winback' AND status = 'granted'
            AND created_at > now() - interval '90 days'
        ) AS "has"
      `,
      [request.customerAccountId],
    );
    const { grants: candidateBonuses } = input.deciders.decideApprovalBonuses({
      volumeBytes,
      amountMinor,
      snapshotQuotaLimitBytes: snapshot.quotaLimitBytes,
      resellerSettled,
      hasPriorPaidTopup,
      earlyRenewalEligible,
      accountAgeMs: accountCreatedAt ? decisionNow.getTime() - accountCreatedAt.getTime() : null,
      lapseDays,
      winbackGrantInLast90d: Boolean(winbackWindow.rows[0]?.has),
      referredBy: account.referredBy,
      accountId: request.customerAccountId,
      enabled: bonusesEnabled,
    });

    // Insert each grant ON CONFLICT DO NOTHING; credit ONLY the rows that actually
    // inserted (once-ever / once-per-request idempotency enforced by the DB indexes).
    for (const grant of candidateBonuses) {
      const inserted = await executor.query<{ id: string }>(
        `
          INSERT INTO bonus_grants (customer_account_id, kind, topup_request_id, base_bytes, pct, bonus_bytes, status)
          VALUES ($1, $2, $3, $4, $5, $6, 'granted')
          ON CONFLICT DO NOTHING
          RETURNING id
        `,
        [request.customerAccountId, grant.kind, id, grant.baseBytes, grant.pct, grant.bonusBytes],
      );
      if (inserted.rows.length > 0) {
        bonuses.push(grant);
        bonusBytesTotal += grant.bonusBytes;
      }
    }
  }

  // Base credit (CURRENT account values). Early renewal extends a running month (Q1).
  let quotaBaseAfterBytes: number;
  let expiresAt: Date | null = expiresBefore;
  if (input.computePeriod) {
    let credit;
    try {
      credit = input.computePeriod({
        quotaLimitBeforeBytes,
        usedBytes,
        volumeBytes,
        expiresAt: expiresBefore,
        durationDays: toFiniteNumber(volumePackage.durationDays ?? null),
        now,
        earlyRenewal: earlyRenewalEligible,
      });
    } catch {
      throw new BadRequestException('Allocated quota would exceed the safe byte limit');
    }
    quotaBaseAfterBytes = credit.quotaLimitAfterBytes;
    expiresAt = credit.expiresAt;
  } else {
    quotaBaseAfterBytes = input.computeQuotaAfter(quotaLimitBeforeBytes, usedBytes, volumeBytes);
  }

  // Single quota write: base credit + the bonuses that were actually granted.
  const quotaLimitAfterBytes = quotaBaseAfterBytes + bonusBytesTotal;
  if (input.computePeriod) {
    await executor.query(
      `UPDATE customer_accounts SET quota_limit_bytes = $1, expires_at = $3, updated_at = now() WHERE id = $2`,
      [quotaLimitAfterBytes, request.customerAccountId, expiresAt],
    );
  } else {
    await executor.query(
      `UPDATE customer_accounts SET quota_limit_bytes = $1, updated_at = now() WHERE id = $2`,
      [quotaLimitAfterBytes, request.customerAccountId],
    );
  }

  // Re-anchor the billing cycle on this real purchase (resets cycle_start, the renewal
  // mask and lapsed_at). Hooked here — the Telegram approval base credit (C1) — and NOT
  // inside the inviter reward below. Mirrors billing/cycle-anchor.resetCycleOnPaidCredit
  // (inlined to keep this module free of runtime relative-value imports).
  await executor.query(
    `UPDATE customer_accounts
     SET cycle_start_used_bytes = LEAST(used_bytes, $2::bigint),
         renewal_notice_mask = 0,
         lapsed_at = NULL,
         updated_at = now()
     WHERE id = $1`,
    [request.customerAccountId, quotaLimitAfterBytes],
  );

  // Referral reward (same transaction as the quota credit). When the DATA reward is
  // active (referralRewardBytes > 0) it REPLACES the gem commission: record the data
  // reward and short-circuit the gem path in code (do not rely on the operator
  // zeroing gem settings). Otherwise fall back to the gem commission.
  let commission: TopupReferralCommission | null = null;
  let referralReward: TopupReferralDataReward | null = null;
  const inviterAccountId = account.referredBy;
  if (referralRewardBytes > 0) {
    referralReward = await applyReferralDataReward(executor, {
      invitedAccountId: request.customerAccountId,
      inviterAccountId,
      amountMinor,
      referralRewardBytes,
      topupRequestId: id,
      now,
    });
  } else if (inviterAccountId && input.gemEconomy) {
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

  // Receipt grace (migration 0068): now funded, so recompute grace from any STILL-OPEN
  // receipts for this account (the just-approved one is already out of 'pending'); this
  // clears grace when none remain and never cuts an account with another receipt pending.
  // When grace clears (NULL), also null the grace cap (0070) so a later cycle recomputes it.
  await executor.query(
    `WITH g AS (
       SELECT max(created_at) + interval '24 hours' AS until
       FROM telegram_topup_requests
       WHERE customer_account_id = $1 AND status = 'pending'
     )
     UPDATE customer_accounts ca
     SET grace_until = g.until,
         grace_cap_bytes = CASE WHEN g.until IS NULL THEN NULL ELSE ca.grace_cap_bytes END,
         updated_at = now()
     FROM g
     WHERE ca.id = $1`,
    [request.customerAccountId],
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
    expiresAt,
    amountMinor,
    currency: request.currency,
    commission,
    referralReward,
    bonuses,
  };
}

export interface RejectTopupOutcome {
  requestId: string;
  reference: string;
  customerAccountId: string | null;
  telegramId: string | null;
  telegramChatId: string | null;
  reason: string | null;
  /** Whether a 30-day grace lockout was applied (penalize) or cleared (pardon). */
  penalized: boolean;
}

/**
 * Reject a top-up request (awaiting a receipt or pending review) with a reason.
 * Never credits quota. A request already approved/rejected cannot be rejected.
 *
 * `penalize` (default true): a penalized reject sets a 30-day grace lockout
 * (grace_blocked_until) so a bad/forged receipt cannot keep farming free grace. An
 * operator pardon (penalize = false) CLEARS any lockout. The lockout window/policy
 * lives in billing/grace.ts (decideRejectGraceLock).
 */
export async function rejectTopupInTransaction(
  executor: DatabaseQueryExecutor,
  id: string,
  input: { reviewer: string | null; reason: string | null; penalize?: boolean; now?: Date },
): Promise<RejectTopupOutcome> {
  const penalize = input.penalize ?? true;
  const now = input.now ?? new Date();
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

  // Receipt grace (migration 0068): recompute from any STILL-OPEN receipts for this
  // account (the just-rejected one is already out of 'pending'), so rejecting one of
  // several pending receipts never cuts an account that still has another under review.
  // Clears grace (NULL) when none remain; also nulls the grace cap (0070) then, and
  // applies the penalize/pardon lockout (mirrors grace.ts decideRejectGraceLock: extend-only).
  if (request.customerAccountId) {
    // Mirrors billing/grace.decideRejectGraceLock: penalize → 30d lockout (extend-only),
    // pardon → clear. Inlined to keep this module free of runtime relative-value imports.
    const lockUntil = penalize ? new Date(now.getTime() + GRACE_LOCKOUT_MS) : null;
    if (penalize && lockUntil) {
      await executor.query(
        `WITH g AS (
           SELECT max(created_at) + interval '24 hours' AS until
           FROM telegram_topup_requests
           WHERE customer_account_id = $1 AND status = 'pending'
         )
         UPDATE customer_accounts ca
         SET grace_until = g.until,
             grace_cap_bytes = CASE WHEN g.until IS NULL THEN NULL ELSE ca.grace_cap_bytes END,
             grace_blocked_until = GREATEST(COALESCE(ca.grace_blocked_until, now()), $2),
             updated_at = now()
         FROM g
         WHERE ca.id = $1`,
        [request.customerAccountId, lockUntil],
      );
    } else {
      // Pardon: clear any lockout outright.
      await executor.query(
        `WITH g AS (
           SELECT max(created_at) + interval '24 hours' AS until
           FROM telegram_topup_requests
           WHERE customer_account_id = $1 AND status = 'pending'
         )
         UPDATE customer_accounts ca
         SET grace_until = g.until,
             grace_cap_bytes = CASE WHEN g.until IS NULL THEN NULL ELSE ca.grace_cap_bytes END,
             grace_blocked_until = NULL,
             updated_at = now()
         FROM g
         WHERE ca.id = $1`,
        [request.customerAccountId],
      );
    }
  }

  return {
    requestId: id,
    reference: topupReference(id),
    customerAccountId: request.customerAccountId,
    telegramId: request.telegramId,
    telegramChatId: request.telegramChatId,
    reason: input.reason,
    penalized: penalize,
  };
}
