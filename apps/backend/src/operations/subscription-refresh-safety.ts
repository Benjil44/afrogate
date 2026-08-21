// Egress P0 — subscription-refresh safety (candidate/active validation).
//
// A subscription refresh replaces a subscription's child `outbounds` rows via a
// DELETE-missing + upsert (see OperationsService.syncSubscriptionChildren). Before
// P0 the only guard was "parse produced >= 1 config"; a truncated/partial provider
// response that still parsed to a small non-empty set therefore PRUNED the rest of
// the reserve — exactly the nodes a village/MikroTik blackout needs. This module is
// the pure, deterministic decision core: given the CURRENT child set and the
// CANDIDATE key set, decide whether committing the candidate is safe.
//
// It NEVER prunes and NEVER mutates; it only returns accept/reject + a reason. The
// caller throws on reject so the surrounding transaction rolls back and the existing
// error path records `last_status='error'` while the live children stay intact.
//
// Checks are INDEPENDENT (any one can reject); none is gated behind a single AND
// that would let a large shrink slip through. Each shrink-based check is
// conditioned on `candidate < current` so a same-size or growing refresh (a normal
// provider rotation) is never blocked — otherwise every refresh of a fully-rotating
// provider would be rejected and the subscription would stale forever.

/** A current persisted child of the subscription (the "active set"). */
export interface CurrentChild {
  key: string;
  enabled: boolean;
  healthStatus: string;
}

export interface RefreshSafetyConfig {
  /** Absolute redundancy floor. Mirrors POOL_MIN_HEALTHY=3 in afrows-uplink-pool-sync.py. */
  minNodes: number;
  /** Suspicious-shrink ratio (candidate/current). HUMAN POLICY DECISION, default 0.5. */
  minRetentionRatio: number;
}

export type RefreshSafetyCode =
  | 'ok'
  | 'bootstrap'
  | 'zero'
  | 'floor'
  | 'shrink'
  | 'active-loss'
  | 'dup-collapse';

export interface RefreshSafetyResult {
  accept: boolean;
  code: RefreshSafetyCode;
  reason: string;
  metrics: {
    currentCount: number;
    candidateCount: number;
    retained: number;
    shrinking: boolean;
    ratio: number | null;
    healthyCurrent: number;
    healthyRetained: number;
  };
}

export const DEFAULT_REFRESH_SAFETY: RefreshSafetyConfig = {
  minNodes: 3,
  minRetentionRatio: 0.5,
};

/**
 * Read the refresh-safety config from the environment, falling back to the
 * documented defaults. `AFROWS_SUBSCRIPTION_MIN_NODES` mirrors POOL_MIN_HEALTHY;
 * `AFROWS_SUBSCRIPTION_MIN_RETENTION_RATIO` is the human-chosen 0.5 shrink ratio.
 */
export function refreshSafetyConfigFromEnv(env: NodeJS.ProcessEnv = process.env): RefreshSafetyConfig {
  const minNodes = Number.parseInt(env.AFROWS_SUBSCRIPTION_MIN_NODES ?? '', 10);
  const ratio = Number.parseFloat(env.AFROWS_SUBSCRIPTION_MIN_RETENTION_RATIO ?? '');
  return {
    minNodes: Number.isFinite(minNodes) && minNodes >= 1 ? minNodes : DEFAULT_REFRESH_SAFETY.minNodes,
    minRetentionRatio:
      Number.isFinite(ratio) && ratio > 0 && ratio <= 1 ? ratio : DEFAULT_REFRESH_SAFETY.minRetentionRatio,
  };
}

/**
 * Decide whether the candidate set may replace the current set. Pure and
 * deterministic: same inputs -> same result. `candidateKeys` may contain
 * duplicates (defense-in-depth: the parser de-dupes upstream, so a duplicate here
 * signals an upstream anomaly / mass key-collapse).
 */
export function evaluateSubscriptionRefresh(
  current: CurrentChild[],
  candidateKeys: string[],
  config: RefreshSafetyConfig = DEFAULT_REFRESH_SAFETY,
): RefreshSafetyResult {
  const distinct = Array.from(new Set(candidateKeys));
  const candidateCount = distinct.length;
  const currentCount = current.length;
  const distinctSet = new Set(distinct);
  const currentKeys = new Set(current.map((c) => c.key));
  const retained = distinct.filter((k) => currentKeys.has(k)).length;
  const shrinking = candidateCount < currentCount;
  const ratio = currentCount > 0 ? candidateCount / currentCount : null;
  const healthy = current.filter((c) => c.enabled && c.healthStatus === 'healthy').map((c) => c.key);
  const healthyRetained = healthy.filter((k) => distinctSet.has(k)).length;

  const metrics = {
    currentCount,
    candidateCount,
    retained,
    shrinking,
    ratio,
    healthyCurrent: healthy.length,
    healthyRetained,
  };
  const decide = (accept: boolean, code: RefreshSafetyCode, reason: string): RefreshSafetyResult => ({
    accept,
    code,
    reason,
    metrics,
  });

  // Defensive: a genuinely empty candidate is already rejected upstream (the
  // pre-transaction "No VLESS configs found" guard); keep the invariant local too.
  if (candidateCount === 0) return decide(false, 'zero', 'candidate has zero nodes');

  // First import (or a subscription with no live children yet): nothing to protect,
  // so any non-empty candidate bootstraps the set.
  if (currentCount === 0) return decide(true, 'bootstrap', 'first import; no active set to protect');

  // D — duplicate/collision collapse: distinct keys < raw keys means several inputs
  // resolved to the same stable identity (anomalous; the parser normally de-dupes).
  if (candidateKeys.length !== distinct.length) {
    return decide(false, 'dup-collapse', `candidate keys collapsed (${candidateKeys.length} -> ${distinct.length} distinct)`);
  }

  // A — absolute floor: a shrink that drops below the redundancy floor.
  if (shrinking && candidateCount < config.minNodes) {
    return decide(false, 'floor', `shrink below floor: ${candidateCount} < ${config.minNodes} (current ${currentCount})`);
  }

  // B — suspicious relative shrink.
  if (shrinking && ratio !== null && ratio < config.minRetentionRatio) {
    return decide(false, 'shrink', `suspicious shrink: ${candidateCount}/${currentCount}=${ratio.toFixed(2)} < ${config.minRetentionRatio}`);
  }

  // C — active/healthy retention: a shrink that drops EVERY currently enabled+healthy
  // node loses all proven capacity. (Same-size/growing rotation is allowed: the new
  // nodes are speed-tested promptly and provide replacement capacity.)
  if (shrinking && healthy.length > 0 && healthyRetained === 0) {
    return decide(false, 'active-loss', `shrink drops all ${healthy.length} healthy active node(s); no healthy survivor`);
  }

  return decide(true, 'ok', `accepted: ${candidateCount} nodes (current ${currentCount}, retained ${retained})`);
}

/** The exact query used to read the current child set for the gate (single source). */
export const CURRENT_CHILDREN_SQL =
  `SELECT subscription_key AS "key", COALESCE(enabled, false) AS "enabled", ` +
  `COALESCE(health_status, 'unknown') AS "healthStatus" ` +
  `FROM outbounds WHERE subscription_id = $1 AND subscription_key IS NOT NULL`;

/** Minimal executor surface the gate needs (satisfied by DatabaseQueryExecutor). */
export interface RefreshChildQuery {
  query(text: string, params: unknown[]): Promise<{ rows: CurrentChild[] }>;
}

/**
 * The integration gate: read the CURRENT children on the given executor (so it
 * participates in the caller's transaction), evaluate, and THROW on reject so the
 * transaction rolls back and the destructive DELETE that follows is never reached.
 * Returns the (accepted) result on success. Kept here — not inlined — so the
 * throw-before-DELETE contract is deterministically testable with a fake executor.
 */
export async function assertRefreshSafe(
  executor: RefreshChildQuery,
  subscriptionId: string,
  candidateKeys: string[],
  config: RefreshSafetyConfig = refreshSafetyConfigFromEnv(),
): Promise<RefreshSafetyResult> {
  const res = await executor.query(CURRENT_CHILDREN_SQL, [subscriptionId]);
  const safety = evaluateSubscriptionRefresh(res.rows, candidateKeys, config);
  if (!safety.accept) {
    throw new Error(`subscription refresh rejected (${safety.code}): ${safety.reason}`);
  }
  return safety;
}
