/**
 * Pure decision + SQL-fragment logic for the CAPPED receipt grace (lever A).
 *
 * Receipt grace keeps an account connected for 24h after it uploads a payment
 * receipt, even once it crosses quota — but only up to a byte CAP, so grace can no
 * longer be farmed for unlimited free data. The cap is min(10% of the plan, 3 GB).
 *
 * Fail-closed: the shared enforcement fragment only allows overage while
 *   used_bytes < quota_limit_bytes + COALESCE(grace_cap_bytes, 0)
 * so a NULL cap grants ZERO overage. The 0070 migration backfills grace_cap_bytes
 * for in-flight grace rows BEFORE this enforcement goes live (HARD GATE).
 *
 * A penalized reject sets grace_blocked_until = now + 30d; while that is in the
 * future, uploading a receipt no longer grants grace (the request is still created).
 * An operator pardon (reject with penalize = false) clears the lockout.
 *
 * No I/O, no decorators, no runtime relative-value imports (node --test loadable).
 * Numbers live here as constants; the lever is behind AFROWS_GRACE_ENABLED (default on).
 */

/** Decimal GB (1 GB = 1e9 bytes), consistent with billing/quota-math. */
const GB = 1_000_000_000;

/** Grace window opened by a receipt upload: 24 hours. */
export const GRACE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Grace overage cap = this percentage of the plan volume… */
export const GRACE_CAP_PCT = 10;
/** …but never more than 3 GB of overage. */
export const GRACE_CAP_MAX_BYTES = 3 * GB;
/** Penalized-reject lockout: no new grace for 30 days. */
export const GRACE_LOCKOUT_MS = 30 * 24 * 60 * 60 * 1000;

/** `AFROWS_GRACE_ENABLED`: default on; 0/false/no/off disables the lever. */
export function resolveGraceEnabled(raw: string | undefined): boolean {
  const value = raw?.trim().toLowerCase();
  return !value || !['0', 'false', 'no', 'off'].includes(value);
}

/**
 * The grace overage cap for a plan: floor(10% of planBytes), clamped to 3 GB and
 * never negative. planBytes is the most recent approved PAID top-up volume, or the
 * current quota_limit_bytes for a never-paid account (Q3). A non-finite/≤0 plan
 * yields a 0 cap (fail-closed: grace grants no overage).
 */
export function graceCapBytes(planBytes: number | null | undefined): number {
  if (planBytes === null || planBytes === undefined || !Number.isFinite(planBytes) || planBytes <= 0) return 0;
  return Math.min(Math.floor((planBytes * GRACE_CAP_PCT) / 100), GRACE_CAP_MAX_BYTES);
}

export type GraceAction = 'account_unlimited' | 'grace_locked' | 'grant';

export interface GraceDecision {
  action: GraceAction;
  /** When action === 'grant': the new window end (now + 24h). GREATEST-merged with any existing grace in SQL. */
  graceUntil: Date | null;
  /** When action === 'grant': the freshly-computed cap. GREATEST-merged with any existing cap in SQL. */
  capBytes: number | null;
}

/**
 * Decide the grace outcome at receipt upload. Pure.
 *  - unlimited account (quota NULL) → skip (never cut; no grace needed);
 *  - locked (grace_blocked_until in the future, from a penalized reject) → skip,
 *    but the top-up request is still created and grace_until is left untouched;
 *  - otherwise → grant a 24h window with the computed cap.
 */
export function decideGrace(input: {
  graceBlockedUntil: Date | null;
  quotaLimitBytes: number | null;
  planBytes: number | null;
  now: Date;
}): GraceDecision {
  if (input.quotaLimitBytes === null) {
    return { action: 'account_unlimited', graceUntil: null, capBytes: null };
  }
  if (input.graceBlockedUntil && input.graceBlockedUntil.getTime() > input.now.getTime()) {
    return { action: 'grace_locked', graceUntil: null, capBytes: null };
  }
  return {
    action: 'grant',
    graceUntil: new Date(input.now.getTime() + GRACE_WINDOW_MS),
    capBytes: graceCapBytes(input.planBytes),
  };
}

/**
 * The new grace_blocked_until after a reject.
 *  - penalize (default) → the later of the existing lockout and now + 30d;
 *  - pardon (penalize = false) → NULL, clearing any lockout.
 */
export function decideRejectGraceLock(input: {
  penalize: boolean;
  existingBlockedUntil: Date | null;
  now: Date;
}): { graceBlockedUntil: Date | null } {
  if (!input.penalize) return { graceBlockedUntil: null };
  const fresh = input.now.getTime() + GRACE_LOCKOUT_MS;
  const existing = input.existingBlockedUntil?.getTime() ?? 0;
  return { graceBlockedUntil: new Date(Math.max(fresh, existing)) };
}

/**
 * The shared quota-enforcement grace-allowance SQL fragment, qualified by a table
 * alias. True only while the account is inside its 24h window AND still under the
 * capped overage ceiling. Used by every metering/provisioning cut & restore query so
 * the fail-closed rule lives in exactly one place.
 *
 *   in_grace_allowance := grace_until > now()
 *                         AND used_bytes < quota_limit_bytes + COALESCE(grace_cap_bytes, 0)
 */
export function inGraceAllowanceSql(alias: string): string {
  return (
    `(${alias}.grace_until IS NOT NULL AND ${alias}.grace_until > now() ` +
    `AND ${alias}.used_bytes < ${alias}.quota_limit_bytes + COALESCE(${alias}.grace_cap_bytes, 0))`
  );
}
