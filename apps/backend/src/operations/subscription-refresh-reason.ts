// Egress P1 — typed causal reasons for a subscription refresh failure.
//
// Each code maps to a REAL throw site in the refresh path (source-anchored; no
// invented reasons). `last_error` keeps the human message for backward
// compatibility — this code is the machine-readable classification stored in
// `outbound_subscriptions.last_failure_reason`.
//
// Throw sites (OperationsService):
//   - fetchAndParseSubscription: 'fetch failed: ...'      -> SUBSCRIPTION_FETCH_FAILED
//   - fetchAndParseSubscription: 'HTTP <status>'          -> SUBSCRIPTION_HTTP_ERROR
//   - fetchAndParseSubscription: 'No VLESS configs found' -> SUBSCRIPTION_EMPTY
//   - assertRefreshSafe (P0 gate): 'rejected (shrink|floor)'  -> SUBSCRIPTION_SHRINK_REJECTED
//   - assertRefreshSafe (P0 gate): 'rejected (active-loss)'   -> SUBSCRIPTION_ACTIVE_NODE_LOST
//   - assertRefreshSafe (P0 gate): 'rejected (dup-collapse)'  -> SUBSCRIPTION_DEDUPE_ANOMALY
//   - assertRefreshSafe (P0 gate): 'rejected (zero)'          -> SUBSCRIPTION_EMPTY
//   - any other throw inside the commit transaction (DB error) -> SUBSCRIPTION_COMMIT_FAILED
//
// NOTE: parseSubscription does NOT throw (it returns {configs, skipped}); a
// malformed body simply yields an empty set caught by the zero-guard, so there is
// no distinct SUBSCRIPTION_PARSE_FAILED reason (it would not be source-supported).
// SUBSCRIPTION_REFRESH_STALE is derived (time since last success), never thrown.

export const SUBSCRIPTION_REFRESH_REASONS = [
  'SUBSCRIPTION_FETCH_FAILED',
  'SUBSCRIPTION_HTTP_ERROR',
  'SUBSCRIPTION_EMPTY',
  'SUBSCRIPTION_SHRINK_REJECTED',
  'SUBSCRIPTION_ACTIVE_NODE_LOST',
  'SUBSCRIPTION_DEDUPE_ANOMALY',
  'SUBSCRIPTION_COMMIT_FAILED',
  'SUBSCRIPTION_REFRESH_STALE',
] as const;

export type SubscriptionRefreshReason = (typeof SUBSCRIPTION_REFRESH_REASONS)[number];

/**
 * Classify a thrown refresh error message into a typed reason. Deterministic and
 * pure. Unknown/unexpected errors fall through to SUBSCRIPTION_COMMIT_FAILED (a
 * throw that reached the commit path rather than a recognised pre-commit guard).
 */
export function classifyRefreshError(message: string): SubscriptionRefreshReason {
  const m = String(message ?? '').toLowerCase();

  // P0 gate rejections carry an explicit "(code)" token.
  if (m.includes('rejected (shrink)') || m.includes('rejected (floor)')) return 'SUBSCRIPTION_SHRINK_REJECTED';
  if (m.includes('rejected (active-loss)')) return 'SUBSCRIPTION_ACTIVE_NODE_LOST';
  if (m.includes('rejected (dup-collapse)')) return 'SUBSCRIPTION_DEDUPE_ANOMALY';
  if (m.includes('rejected (zero)')) return 'SUBSCRIPTION_EMPTY';

  // Fetch/HTTP/parse guards.
  if (m.startsWith('fetch failed')) return 'SUBSCRIPTION_FETCH_FAILED';
  if (/^http \d/.test(m)) return 'SUBSCRIPTION_HTTP_ERROR';
  if (m.includes('no vless configs')) return 'SUBSCRIPTION_EMPTY';

  return 'SUBSCRIPTION_COMMIT_FAILED';
}

/**
 * SUBSCRIPTION_REFRESH_STALE predicate: true when the last successful refresh is at
 * least `thresholdSeconds` old. A null age (never succeeded) is NOT stale here — the
 * consecutive-failure alert owns the never-succeeded case.
 */
export function isRefreshStale(ageSeconds: number | null, thresholdSeconds: number): boolean {
  return ageSeconds !== null && ageSeconds >= thresholdSeconds;
}

export type SubscriptionAlertLevel = 'none' | 'warning' | 'critical';

/**
 * Pure, deterministic alert level from the persisted consecutive-failure counter.
 * `none` below `warnAt`, `warning` at/above it, `critical` at/above `critAt`.
 * Because the counter resets to 0 on any successful refresh, recovery deterministically
 * returns `none` — the alert engine then resolves the alert (no flapping).
 */
export function subscriptionRefreshAlertLevel(
  consecutiveFailures: number,
  warnAt: number,
  critAt: number,
): SubscriptionAlertLevel {
  if (consecutiveFailures >= critAt) return 'critical';
  if (consecutiveFailures >= warnAt) return 'warning';
  return 'none';
}
