import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
// Egress P1 — typed causal reasons + consecutive-failure alert level. Pins the
// pure decision logic that OperationsService (refresh error path) and
// AlertEngineService (subscription condition) consult.
import {
  classifyRefreshError,
  subscriptionRefreshAlertLevel,
  SUBSCRIPTION_REFRESH_REASONS,
} from '../src/operations/subscription-refresh-reason.ts';

describe('classifyRefreshError — every reason maps to a real throw site', () => {
  const cases: Array<[string, string]> = [
    ['fetch failed: connect ETIMEDOUT', 'SUBSCRIPTION_FETCH_FAILED'],
    ['HTTP 503', 'SUBSCRIPTION_HTTP_ERROR'],
    ['HTTP 302', 'SUBSCRIPTION_HTTP_ERROR'],
    ['No VLESS configs found in subscription', 'SUBSCRIPTION_EMPTY'],
    ['subscription refresh rejected (shrink): suspicious shrink 9/20', 'SUBSCRIPTION_SHRINK_REJECTED'],
    ['subscription refresh rejected (floor): shrink below floor 2 < 3', 'SUBSCRIPTION_SHRINK_REJECTED'],
    ['subscription refresh rejected (active-loss): drops all healthy', 'SUBSCRIPTION_ACTIVE_NODE_LOST'],
    ['subscription refresh rejected (dup-collapse): 5 -> 2 distinct', 'SUBSCRIPTION_DEDUPE_ANOMALY'],
    ['subscription refresh rejected (zero): candidate has zero nodes', 'SUBSCRIPTION_EMPTY'],
    ['duplicate key value violates unique constraint', 'SUBSCRIPTION_COMMIT_FAILED'],
  ];

  for (const [message, expected] of cases) {
    it(`"${message.slice(0, 42)}" -> ${expected}`, () => {
      const code = classifyRefreshError(message);
      assert.equal(code, expected);
      assert.ok(SUBSCRIPTION_REFRESH_REASONS.includes(code), 'code must be a known reason');
    });
  }

  // (case 4) shrink rejection is visibly distinguished from a plain fetch failure.
  it('distinguishes a P0 shrink rejection from a network failure', () => {
    assert.notEqual(
      classifyRefreshError('subscription refresh rejected (shrink): x'),
      classifyRefreshError('fetch failed: x'),
    );
  });

  it('is deterministic and case-insensitive', () => {
    assert.equal(classifyRefreshError('HTTP 500'), classifyRefreshError('http 500'));
  });
});

describe('subscriptionRefreshAlertLevel — consecutive-failure thresholds', () => {
  const warnAt = 3;
  const critAt = 6;

  // (case 1) a single failure does not alert.
  it('one failure is below threshold (none)', () => {
    assert.equal(subscriptionRefreshAlertLevel(1, warnAt, critAt), 'none');
    assert.equal(subscriptionRefreshAlertLevel(2, warnAt, critAt), 'none');
  });

  // (case 2) reaching the threshold warns; escalates to critical.
  it('warns at the threshold and escalates to critical', () => {
    assert.equal(subscriptionRefreshAlertLevel(3, warnAt, critAt), 'warning');
    assert.equal(subscriptionRefreshAlertLevel(5, warnAt, critAt), 'warning');
    assert.equal(subscriptionRefreshAlertLevel(6, warnAt, critAt), 'critical');
    assert.equal(subscriptionRefreshAlertLevel(99, warnAt, critAt), 'critical');
  });

  // (case 3) recovery (counter reset to 0) clears the alert deterministically.
  it('recovery (0 failures) returns none so the alert resolves', () => {
    assert.equal(subscriptionRefreshAlertLevel(0, warnAt, critAt), 'none');
  });

  // The engine clamps critAt = max(warnAt, critAt); model that here so a
  // misconfiguration (crit < warn) never yields 'critical' below the warn line.
  it('with clamped crit>=warn, never emits critical below the warning threshold', () => {
    const cw = 3;
    const cc = Math.max(cw, 1); // operator set crit=1 (< warn); engine clamps to warn
    assert.equal(subscriptionRefreshAlertLevel(2, cw, cc), 'none');
    assert.equal(subscriptionRefreshAlertLevel(3, cw, cc), 'critical'); // at warn == clamped crit
  });

  it('is monotonic across the boundary (no flapping between adjacent counts)', () => {
    const levels = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => subscriptionRefreshAlertLevel(n, warnAt, critAt));
    assert.deepEqual(levels, ['none', 'none', 'none', 'warning', 'warning', 'warning', 'critical', 'critical']);
  });
});
