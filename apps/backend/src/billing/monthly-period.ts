/**
 * Monthly GB validity (2026-10-21 pricing): a package with `duration_days` opens a
 * billing month on the account (`customer_accounts.expires_at`). Buying again while
 * the month is running adds the GB and keeps the end date; when the month ends the
 * unused GB is lost (the quota is cut to what was used) and the customer must buy
 * again. A package without `duration_days` keeps the old open-ended behaviour.
 *
 * Pure and self-contained (no relative imports) so `node --test` can load it and so
 * telegram-topup.ts / billing.service.ts / the expiry job share one definition.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;
/** The "your month ends tomorrow" reminder fires once the end is this close. */
export const MONTHLY_REMINDER_LEAD_MS = DAY_MS;

export interface PeriodCreditInput {
  quotaLimitBeforeBytes: number | null;
  usedBytes: number;
  volumeBytes: number;
  /** Current account end date; null = the account has never had a month. */
  expiresAt: Date | null;
  /** The package's validity; null/0 = not a monthly package. */
  durationDays: number | null;
  now: Date;
}

export interface PeriodCreditResult {
  quotaLimitAfterBytes: number;
  /** New account end date (unchanged unless a month starts). */
  expiresAt: Date | null;
  /** True when this purchase opened a new month. */
  periodStarted: boolean;
}

function safeSum(base: number, add: number): number {
  const after = base + add;
  if (!Number.isSafeInteger(after) || after < 0) throw new RangeError('Allocated quota would exceed the safe byte limit');
  return after;
}

/**
 * Quota and end date after crediting a package.
 * - not a monthly package: open-ended credit, end date untouched (legacy);
 * - month running (end in the future): add the GB, keep the end date;
 * - never had a month (end NULL): keep the current headroom, add the GB, start a month;
 * - month over: start a fresh month with only the new GB (the leftover is lost).
 */
export function computePeriodCredit(input: PeriodCreditInput): PeriodCreditResult {
  const { quotaLimitBeforeBytes, usedBytes, volumeBytes, expiresAt, now } = input;
  const days = input.durationDays && input.durationDays > 0 ? input.durationDays : null;
  const carried = quotaLimitBeforeBytes ?? usedBytes;

  if (!days) {
    return { quotaLimitAfterBytes: safeSum(carried, volumeBytes), expiresAt, periodStarted: false };
  }
  if (expiresAt && expiresAt.getTime() > now.getTime()) {
    return { quotaLimitAfterBytes: safeSum(carried, volumeBytes), expiresAt, periodStarted: false };
  }
  const newEnd = new Date(now.getTime() + days * DAY_MS);
  if (!expiresAt) {
    return { quotaLimitAfterBytes: safeSum(carried, volumeBytes), expiresAt: newEnd, periodStarted: true };
  }
  return { quotaLimitAfterBytes: safeSum(usedBytes, volumeBytes), expiresAt: newEnd, periodStarted: true };
}

export interface MonthlyAccountState {
  quotaLimitBytes: number | null;
  usedBytes: number;
  expiresAt: Date | null;
}

/** The month ends within the reminder lead time (and has not ended yet). */
export function isMonthEndingSoon(state: MonthlyAccountState, now: Date, leadMs = MONTHLY_REMINDER_LEAD_MS): boolean {
  if (!state.expiresAt || state.quotaLimitBytes === null) return false;
  const left = state.expiresAt.getTime() - now.getTime();
  return left > 0 && left <= leadMs;
}

/**
 * Bytes to forfeit now that the month is over: the unused headroom (quota - used),
 * or 0 when nothing is left / the account is unlimited / the month is still running.
 */
export function bytesToForfeit(state: MonthlyAccountState, now: Date): number {
  if (!state.expiresAt || state.quotaLimitBytes === null) return 0;
  if (state.expiresAt.getTime() > now.getTime()) return 0;
  return Math.max(0, state.quotaLimitBytes - state.usedBytes);
}
