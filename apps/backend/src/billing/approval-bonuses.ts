/**
 * Pure decision logic for the BUYER approval bonuses (lever C), credited to the
 * buyer on a Telegram top-up approval. Four kinds:
 *   - first_purchase  (20%) — a brand-new account's first paid top-up;
 *   - early_renewal   (10%) — renewing inside the early-renewal window (Q2);
 *   - winback         (15/20/25%) — a lapsed account that had paid before (Q5);
 *   - invitee_referral (fixed 2 GB) — a referred buyer's first paid top-up (Q-invitee).
 *
 * The three PERCENTAGE kinds are mutually exclusive (priority first_purchase >
 * early_renewal > winback). invitee_referral is independent and STACKS on the
 * percentage. The total buyer bonus is capped at 100% of the package volume, clamping
 * the percentage first and then the invitee bonus (Q9).
 *
 * This is NOT the inviter reward (applyReferralDataReward, 0069) — that credits the
 * INVITER and is unchanged. invitee_referral credits the BUYER (the invitee).
 *
 * Decimal bytes (1 GB = 1e9). No I/O, no decorators, no runtime relative-value
 * imports (node --test loadable). Each kind is behind its own AFROWS_*_ENABLED switch.
 */

const GB = 1_000_000_000;

export const FIRST_PURCHASE_PCT = 20;
export const EARLY_RENEWAL_PCT = 10;
/** Win-back percentage by lapse length: [14,30) → 15, [30,60) → 20, [60,∞) → 25. */
export const WINBACK_PCT_D14 = 15;
export const WINBACK_PCT_D30 = 20;
export const WINBACK_PCT_D60 = 25;
/** Fixed invitee-referral bonus to the buyer: 2 GB decimal. */
export const INVITEE_REFERRAL_BONUS_BYTES = 2 * GB;

export const DAY_MS = 24 * 60 * 60 * 1000;
/** A first purchase must happen within 72h of account creation (else it is not "new"). */
export const FIRST_PURCHASE_ACCOUNT_AGE_MS = 72 * 60 * 60 * 1000;
/** Early-renewal window: only when ≥80% of the cycle is used OR expiry is ≤72h away (Q2). */
export const EARLY_RENEWAL_USAGE_PCT = 80;
export const EARLY_RENEWAL_EXPIRY_MS = 72 * 60 * 60 * 1000;
/** Win-back needs the account lapsed at least this long; and fires at most once per 90 days. */
export const WINBACK_MIN_LAPSE_DAYS = 14;
export const WINBACK_WINDOW_DAYS = 90;

export type BonusKind = 'first_purchase' | 'early_renewal' | 'winback' | 'invitee_referral';

/** `AFROWS_<X>_ENABLED`: default on; 0/false/no/off disables. */
export function resolveBonusEnabled(raw: string | undefined): boolean {
  const value = raw?.trim().toLowerCase();
  return !value || !['0', 'false', 'no', 'off'].includes(value);
}

/** Win-back percentage for a lapse length in days, or null when < 14 days (not eligible). */
export function winbackPct(lapseDays: number | null): number | null {
  if (lapseDays === null || !Number.isFinite(lapseDays) || lapseDays < WINBACK_MIN_LAPSE_DAYS) return null;
  if (lapseDays < 30) return WINBACK_PCT_D14;
  if (lapseDays < 60) return WINBACK_PCT_D30;
  return WINBACK_PCT_D60;
}

/** The decision snapshot frozen at receipt upload (telegram_topup_requests.snap_*). */
export interface ApprovalSnapshot {
  usedBytes: number;
  quotaLimitBytes: number | null;
  cycleStartUsedBytes: number;
  expiresAt: Date | null;
  lapsedAt: Date | null;
}

/**
 * Early-renewal eligibility, computed from the upload snapshot (Q1/Q2). Eligible when
 * the account was paid-and-active with headroom and either deep into its cycle or near
 * expiry. Used BOTH to gate the +10% bonus AND the Q1 expiry extension (quota carried,
 * not forfeited). `now` is the request's created_at.
 */
export function decideEarlyRenewal(input: {
  snapshot: ApprovalSnapshot;
  hasPriorPaidTopup: boolean;
  amountMinor: number | null;
  now: Date;
}): { eligible: boolean } {
  const { snapshot: s } = input;
  if (!(input.amountMinor !== null && input.amountMinor > 0)) return { eligible: false };
  if (!input.hasPriorPaidTopup) return { eligible: false };
  if (s.quotaLimitBytes === null) return { eligible: false };
  if (!(s.usedBytes < s.quotaLimitBytes)) return { eligible: false }; // strict headroom
  if (s.expiresAt !== null && s.expiresAt.getTime() <= input.now.getTime()) return { eligible: false }; // already ended

  const denom = s.quotaLimitBytes - s.cycleStartUsedBytes;
  const cyclePct = denom > 0 ? ((s.usedBytes - s.cycleStartUsedBytes) * 100) / denom : 100;
  const deepIntoCycle = cyclePct >= EARLY_RENEWAL_USAGE_PCT;
  const nearExpiry =
    s.expiresAt !== null && s.expiresAt.getTime() - input.now.getTime() <= EARLY_RENEWAL_EXPIRY_MS;
  return { eligible: deepIntoCycle || nearExpiry };
}

export interface BonusGrant {
  kind: BonusKind;
  baseBytes: number;
  /** Percentage for a % kind; null for the fixed invitee bonus. */
  pct: number | null;
  bonusBytes: number;
}

export interface BonusSkip {
  kind: BonusKind | 'all';
  reason: string;
}

export interface ApprovalBonusesInput {
  volumeBytes: number;
  amountMinor: number | null;
  /** Account quota BEFORE this top-up (snapshot). null = was unlimited → no bonuses. */
  snapshotQuotaLimitBytes: number | null;
  resellerSettled: boolean;
  /** Any prior approved PAID top-up OR paid payment order (look beyond telegram_topup_requests). */
  hasPriorPaidTopup: boolean;
  earlyRenewalEligible: boolean;
  /** Account age at the request (request.created_at − account.created_at), ms. */
  accountAgeMs: number | null;
  /** Days the account was lapsed at the request (from snap_lapsed_at), or null if never lapsed. */
  lapseDays: number | null;
  /** A granted win-back bonus exists within the last 90 days. */
  winbackGrantInLast90d: boolean;
  /** Buyer's referred_by (inviter account id), or null. */
  referredBy: string | null;
  /** Buyer's own account id (to reject a self-referral). */
  accountId: string;
  enabled: {
    firstPurchase: boolean;
    earlyRenewal: boolean;
    winback: boolean;
    inviteeReferral: boolean;
  };
}

/** Pure buyer-bonus decision. Returns the grants to insert + the skips (for audit/tests). */
export function decideApprovalBonuses(input: ApprovalBonusesInput): { grants: BonusGrant[]; skips: BonusSkip[] } {
  const skips: BonusSkip[] = [];
  const volume = input.volumeBytes;

  // Global skips.
  if (input.resellerSettled) return { grants: [], skips: [{ kind: 'all', reason: 'reseller_settled' }] };
  if (!(input.amountMinor !== null && input.amountMinor > 0)) {
    return { grants: [], skips: [{ kind: 'all', reason: 'unpaid' }] };
  }
  if (input.snapshotQuotaLimitBytes === null) {
    return { grants: [], skips: [{ kind: 'all', reason: 'account_unlimited' }] };
  }
  if (!(volume > 0)) return { grants: [], skips: [{ kind: 'all', reason: 'no_volume' }] };

  // --- Percentage kind: mutually exclusive, priority first_purchase > early_renewal > winback.
  let pctKind: BonusKind | null = null;
  let pct = 0;
  const isNewAccount = input.accountAgeMs !== null && input.accountAgeMs <= FIRST_PURCHASE_ACCOUNT_AGE_MS;

  if (!input.hasPriorPaidTopup && isNewAccount) {
    if (input.enabled.firstPurchase) {
      pctKind = 'first_purchase';
      pct = FIRST_PURCHASE_PCT;
    } else {
      skips.push({ kind: 'first_purchase', reason: 'lever_disabled' });
    }
  } else if (input.earlyRenewalEligible) {
    if (input.enabled.earlyRenewal) {
      pctKind = 'early_renewal';
      pct = EARLY_RENEWAL_PCT;
    } else {
      skips.push({ kind: 'early_renewal', reason: 'lever_disabled' });
    }
  } else {
    const wbPct = winbackPct(input.lapseDays);
    if (input.hasPriorPaidTopup && wbPct !== null && !input.winbackGrantInLast90d) {
      if (input.enabled.winback) {
        pctKind = 'winback';
        pct = wbPct;
      } else {
        skips.push({ kind: 'winback', reason: 'lever_disabled' });
      }
    } else if (input.hasPriorPaidTopup && wbPct !== null && input.winbackGrantInLast90d) {
      skips.push({ kind: 'winback', reason: 'winback_within_90d' });
    }
  }

  const percentageBonus = pctKind ? Math.floor((volume * pct) / 100) : 0;

  // --- invitee_referral (fixed, stacks, buyer's FIRST approved paid, not self).
  let inviteeRaw = 0;
  if (input.referredBy && input.referredBy !== input.accountId && !input.hasPriorPaidTopup) {
    if (input.enabled.inviteeReferral) {
      inviteeRaw = INVITEE_REFERRAL_BONUS_BYTES;
    } else {
      skips.push({ kind: 'invitee_referral', reason: 'lever_disabled' });
    }
  }

  // --- 100% cap: total buyer bonus <= package volume. Clamp percentage first, then invitee.
  const inviteeBonus = inviteeRaw > 0 ? Math.min(inviteeRaw, Math.max(0, volume - percentageBonus)) : 0;

  const grants: BonusGrant[] = [];
  if (pctKind && percentageBonus > 0) {
    grants.push({ kind: pctKind, baseBytes: volume, pct, bonusBytes: percentageBonus });
  }
  if (inviteeBonus > 0) {
    grants.push({ kind: 'invitee_referral', baseBytes: volume, pct: null, bonusBytes: inviteeBonus });
    if (inviteeBonus < inviteeRaw) skips.push({ kind: 'invitee_referral', reason: 'clamped_to_100pct' });
  }
  return { grants, skips };
}
