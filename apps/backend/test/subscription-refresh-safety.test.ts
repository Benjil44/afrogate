import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
// Egress P0 — regression guards for the subscription-refresh candidate/active
// safety gate. These pin the pure decision core that OperationsService.
// syncSubscriptionChildren consults BEFORE its destructive DELETE. Pre-P0 there
// was no such gate: any parsed (>=1 config) response pruned the rest of the
// reserve. The reject cases below are exactly what a pre-P0 (always-commit)
// implementation would FAIL (see the revert-proof note in the P0 report).
import {
  evaluateSubscriptionRefresh,
  refreshSafetyConfigFromEnv,
  assertRefreshSafe,
  CURRENT_CHILDREN_SQL,
  DEFAULT_REFRESH_SAFETY,
  type CurrentChild,
} from '../src/operations/subscription-refresh-safety.ts';

// Build a current child; healthy+enabled unless overridden.
function child(key: string, over: Partial<CurrentChild> = {}): CurrentChild {
  return { key, enabled: true, healthStatus: 'healthy', ...over };
}
// N distinct current children, all enabled+healthy.
function currentSet(n: number, prefix = 'k'): CurrentChild[] {
  return Array.from({ length: n }, (_, i) => child(`${prefix}${i}`));
}
function keys(n: number, prefix = 'k'): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}${i}`);
}

describe('evaluateSubscriptionRefresh — reject paths (the P0 gap)', () => {
  // (case 4/5) partial/truncated refresh that keeps < RETENTION_RATIO of a healthy set.
  it('rejects a suspicious relative shrink (20 -> 9 = 45% < 0.5)', () => {
    const r = evaluateSubscriptionRefresh(currentSet(20), keys(9), DEFAULT_REFRESH_SAFETY);
    assert.equal(r.accept, false);
    assert.equal(r.code, 'shrink');
  });

  // (floor) shrink below the source-derived redundancy floor (POOL_MIN_HEALTHY=3).
  it('rejects a shrink below the absolute floor (4 -> 2)', () => {
    const r = evaluateSubscriptionRefresh(currentSet(4), keys(2), DEFAULT_REFRESH_SAFETY);
    assert.equal(r.accept, false);
    assert.equal(r.code, 'floor');
  });

  // floor fires even when the ratio alone would pass (4 -> 2 is exactly 0.5, not < 0.5),
  // proving the two checks are INDEPENDENT (no single AND lets a dangerous drop through).
  it('floor is independent of ratio (4 -> 2 passes ratio but fails floor)', () => {
    const r = evaluateSubscriptionRefresh(currentSet(4), keys(2), DEFAULT_REFRESH_SAFETY);
    assert.equal(r.metrics.ratio, 0.5); // not < 0.5, so B would accept
    assert.equal(r.code, 'floor'); // A rejects anyway
  });

  // (case 5) a large shrink that keeps enough count but drops EVERY healthy node.
  it('rejects a shrink that drops all proven-healthy nodes (active-loss)', () => {
    // current: 10 nodes, only k0..k1 healthy; candidate keeps 6 fresh keys, none healthy.
    const current = [
      child('k0'),
      child('k1'),
      ...Array.from({ length: 8 }, (_, i) => child(`k${i + 2}`, { healthStatus: 'critical' })),
    ];
    const candidate = ['k2', 'k3', 'k4', 'k5', 'k6', 'k7']; // 6/10=0.6 passes ratio+floor
    const r = evaluateSubscriptionRefresh(current, candidate, DEFAULT_REFRESH_SAFETY);
    assert.equal(r.accept, false);
    assert.equal(r.code, 'active-loss');
  });

  // (case 9) duplicate/collision collapse in the candidate input.
  it('rejects duplicate-collapsed candidate keys (dup-collapse)', () => {
    const r = evaluateSubscriptionRefresh(currentSet(10), ['a', 'a', 'b'], DEFAULT_REFRESH_SAFETY);
    assert.equal(r.accept, false);
    assert.equal(r.code, 'dup-collapse');
  });

  // defensive zero (upstream also guards, but the invariant is local too).
  it('rejects a zero-node candidate', () => {
    assert.equal(evaluateSubscriptionRefresh(currentSet(5), [], DEFAULT_REFRESH_SAFETY).code, 'zero');
  });
});

describe('evaluateSubscriptionRefresh — accept paths (must NOT over-reject)', () => {
  // (case 6) a valid complete refresh commits.
  it('accepts a same-size refresh (no shrink)', () => {
    assert.equal(evaluateSubscriptionRefresh(currentSet(20), keys(20), DEFAULT_REFRESH_SAFETY).accept, true);
  });

  it('accepts a growing refresh', () => {
    assert.equal(evaluateSubscriptionRefresh(currentSet(20), keys(25), DEFAULT_REFRESH_SAFETY).accept, true);
  });

  it('accepts a modest shrink above the ratio (20 -> 12 = 60%)', () => {
    const r = evaluateSubscriptionRefresh(currentSet(20), keys(12), DEFAULT_REFRESH_SAFETY);
    assert.equal(r.accept, true);
    assert.equal(r.code, 'ok');
  });

  // (case 7) active node retained -> no unnecessary rejection.
  it('accepts when the healthy active node is retained', () => {
    const current = [child('active'), ...currentSet(19, 'n')];
    const candidate = ['active', ...keys(11, 'n')]; // 12/20, active kept
    assert.equal(evaluateSubscriptionRefresh(current, candidate, DEFAULT_REFRESH_SAFETY).accept, true);
  });

  // (case 8) active node removed BUT a healthy survivor exists -> safe transition.
  it('accepts a shrink that drops the active node but keeps another healthy node', () => {
    const current = [child('active'), child('backup'), ...currentSet(18, 'n')];
    const candidate = ['backup', ...keys(11, 'n')]; // 12/20, active gone, backup (healthy) survives
    const r = evaluateSubscriptionRefresh(current, candidate, DEFAULT_REFRESH_SAFETY);
    assert.equal(r.accept, true);
    assert.equal(r.metrics.healthyRetained >= 1, true);
  });

  // full rotation keeping count: every key new, all healthy dropped, but NOT shrinking.
  it('accepts a full same-size rotation (no shrink) even though all healthy keys change', () => {
    const r = evaluateSubscriptionRefresh(currentSet(20), keys(20, 'new'), DEFAULT_REFRESH_SAFETY);
    assert.equal(r.accept, true); // not shrinking -> C does not fire
  });

  // bootstrap: first import has no active set to protect.
  it('accepts a first import (no current children) of any non-zero size', () => {
    const r = evaluateSubscriptionRefresh([], keys(1), DEFAULT_REFRESH_SAFETY);
    assert.equal(r.accept, true);
    assert.equal(r.code, 'bootstrap');
  });

  // a subscription that legitimately only has 2 nodes must still refresh (no shrink).
  it('accepts a steady 2-node subscription (2 -> 2, not a shrink, floor not triggered)', () => {
    assert.equal(evaluateSubscriptionRefresh(currentSet(2), keys(2), DEFAULT_REFRESH_SAFETY).accept, true);
  });
});

describe('assertRefreshSafe — integration gate (throw BEFORE the DELETE = children preserved)', () => {
  // A fake executor that records the SQL statements issued to it. In production the
  // gate runs on the transaction's executor; the DELETE/upsert come AFTER it, so if
  // the gate throws, only the SELECT ever runs and the live children are untouched.
  function fakeExecutor(rows: CurrentChild[]) {
    const calls: string[] = [];
    return {
      calls,
      query: async (text: string) => {
        calls.push(text);
        return { rows };
      },
    };
  }

  // (cases 1-4) a rejected refresh must throw, and must do so having issued ONLY the
  // read — never a DELETE — so the reserve survives. This is the preservation claim.
  it('throws on a suspicious shrink and issues only the SELECT (no prune)', async () => {
    const ex = fakeExecutor(currentSet(20));
    await assert.rejects(() => assertRefreshSafe(ex, 'sub-1', keys(9), DEFAULT_REFRESH_SAFETY), /rejected \(shrink\)/);
    assert.equal(ex.calls.length, 1);
    assert.equal(ex.calls[0], CURRENT_CHILDREN_SQL); // the read only; DELETE never reached
  });

  it('throws on a floor breach (children preserved)', async () => {
    const ex = fakeExecutor(currentSet(4));
    await assert.rejects(() => assertRefreshSafe(ex, 'sub-1', keys(2), DEFAULT_REFRESH_SAFETY), /rejected \(floor\)/);
    assert.equal(ex.calls.length, 1);
  });

  it('throws on active-loss (children preserved)', async () => {
    const current = [child('k0'), ...Array.from({ length: 9 }, (_, i) => child(`k${i + 1}`, { healthStatus: 'critical' }))];
    const ex = fakeExecutor(current);
    // candidate drops k0 (the only healthy node) and shrinks 10->6
    await assert.rejects(() => assertRefreshSafe(ex, 'sub-1', ['k1', 'k2', 'k3', 'k4', 'k5', 'k6'], DEFAULT_REFRESH_SAFETY), /active-loss/);
  });

  // (case 6) a valid refresh resolves so the caller proceeds to DELETE+upsert.
  it('resolves (does not throw) on a valid refresh so sync proceeds', async () => {
    const ex = fakeExecutor(currentSet(20));
    const r = await assertRefreshSafe(ex, 'sub-1', keys(20), DEFAULT_REFRESH_SAFETY);
    assert.equal(r.accept, true);
  });

  it('resolves on a first import (bootstrap, no current children)', async () => {
    const ex = fakeExecutor([]);
    const r = await assertRefreshSafe(ex, 'sub-1', keys(2), DEFAULT_REFRESH_SAFETY);
    assert.equal(r.code, 'bootstrap');
  });
});

describe('refreshSafetyConfigFromEnv', () => {
  it('defaults to floor 3 / ratio 0.5', () => {
    const c = refreshSafetyConfigFromEnv({});
    assert.equal(c.minNodes, 3);
    assert.equal(c.minRetentionRatio, 0.5);
  });

  it('honors valid overrides', () => {
    const c = refreshSafetyConfigFromEnv({ AFROWS_SUBSCRIPTION_MIN_NODES: '5', AFROWS_SUBSCRIPTION_MIN_RETENTION_RATIO: '0.67' });
    assert.equal(c.minNodes, 5);
    assert.equal(c.minRetentionRatio, 0.67);
  });

  it('rejects out-of-range overrides and falls back to defaults', () => {
    const c = refreshSafetyConfigFromEnv({ AFROWS_SUBSCRIPTION_MIN_RETENTION_RATIO: '1.5', AFROWS_SUBSCRIPTION_MIN_NODES: '0' });
    assert.equal(c.minNodes, 3);
    assert.equal(c.minRetentionRatio, 0.5);
  });

  it('is deterministic', () => {
    const env = { AFROWS_SUBSCRIPTION_MIN_RETENTION_RATIO: '0.5' };
    assert.deepEqual(refreshSafetyConfigFromEnv(env), refreshSafetyConfigFromEnv(env));
  });
});
