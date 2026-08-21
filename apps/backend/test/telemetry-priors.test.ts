import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
// F10 closed-loop priors: a pure module that turns recorded run telemetry into
// routing priors + a recent-vs-prior health signal. These tests pin its
// deterministic behavior so the router can trust it as an advisory overlay.
import {
  tierPrior,
  computePriors,
  healthSignal,
  budgetCalibration,
  routingAdvice,
  PRIORS_CONFIG,
  // @ts-expect-error — .mjs import resolved by the node --test loader
} from '../../../scripts/orchestration/telemetry-priors.mjs';

// Minimal record factory — only the fields the priors read.
function rec(complexity: string, outcome: string, extra: Record<string, unknown> = {}) {
  return {
    complexity,
    outcome,
    fallback: outcome === 'FALLBACK',
    fallback_reason: null,
    human_interventions: 0,
    total_tokens: 0,
    ...extra,
  };
}

describe('tierPrior', () => {
  const records = [
    rec('MEDIUM', 'COMPLETE', { total_tokens: 100, human_interventions: 1 }),
    rec('MEDIUM', 'COMPLETE', { total_tokens: 200, human_interventions: 2 }),
    rec('MEDIUM', 'BLOCKED', { total_tokens: 300, human_interventions: 3 }),
    rec('MEDIUM', 'FALLBACK', { total_tokens: 400, human_interventions: 2, fallback_reason: 'writers did not materialize' }),
    rec('SMALL', 'DIRECT', { total_tokens: 10 }),
  ];

  it('aggregates rate/avg for one tier and ignores other tiers', () => {
    const p = tierPrior(records, 'MEDIUM');
    assert.equal(p.runs, 4);
    assert.equal(p.confidence, 'OK'); // >= MIN_RUNS_FOR_PRIOR
    assert.equal(p.success_rate, 0.5); // 2 COMPLETE of 4
    assert.equal(p.fallback_rate, 0.5); // 1 BLOCKED + 1 fallback=true of 4
    assert.equal(p.avg_human_interventions, 2); // (1+2+3+2)/4
    assert.equal(p.avg_tokens, 250); // (100+200+300+400)/4
    assert.equal(p.avg_tokens_successful, 150); // (100+200)/2 COMPLETE
  });

  it('surfaces the most common fallback reason', () => {
    const p = tierPrior(records, 'MEDIUM');
    assert.deepEqual(p.common_fallback_reason, { reason: 'writers did not materialize', count: 1 });
  });

  it('marks LOW_CONFIDENCE below the minimum run count', () => {
    assert.equal(tierPrior(records, 'SMALL').confidence, 'LOW_CONFIDENCE');
    assert.ok(PRIORS_CONFIG.MIN_RUNS_FOR_PRIOR >= 2);
  });
});

describe('computePriors', () => {
  it('groups tiers in fixed tier order, only for tiers that appear', () => {
    const records = [rec('CRITICAL', 'COMPLETE'), rec('SMALL', 'DIRECT'), rec('MEDIUM', 'BLOCKED')];
    assert.deepEqual(Object.keys(computePriors(records)), ['SMALL', 'MEDIUM', 'CRITICAL']);
  });
});

describe('healthSignal (recent vs prior trend)', () => {
  it('INSUFFICIENT_DATA when fewer than 2*window records', () => {
    const h = healthSignal([rec('SMALL', 'COMPLETE'), rec('SMALL', 'COMPLETE'), rec('SMALL', 'COMPLETE')], 2);
    assert.equal(h.state, 'INSUFFICIENT_DATA');
    assert.equal(h.need, 4);
  });

  it('DEGRADING when recent success drops past the delta', () => {
    const records = [
      rec('SMALL', 'COMPLETE'),
      rec('SMALL', 'COMPLETE'), // prior window: 100% success
      rec('SMALL', 'BLOCKED'),
      rec('SMALL', 'FALLBACK'), // recent window: 0% success
    ];
    const h = healthSignal(records, 2);
    assert.equal(h.state, 'DEGRADING');
    assert.equal(h.recent.success_rate, 0);
    assert.equal(h.prior.success_rate, 1);
  });

  it('IMPROVING when recent success rises past the delta', () => {
    const records = [
      rec('SMALL', 'BLOCKED'),
      rec('SMALL', 'FALLBACK'), // prior: 0% success
      rec('SMALL', 'COMPLETE'),
      rec('SMALL', 'COMPLETE'), // recent: 100% success
    ];
    assert.equal(healthSignal(records, 2).state, 'IMPROVING');
  });

  it('STABLE when nothing moves', () => {
    const records = Array.from({ length: 6 }, () => rec('SMALL', 'COMPLETE'));
    assert.equal(healthSignal(records, 3).state, 'STABLE');
  });
});

describe('budgetCalibration', () => {
  const three = (tokens: number) => [
    rec('HIGH', 'COMPLETE', { total_tokens: tokens }),
    rec('HIGH', 'COMPLETE', { total_tokens: tokens }),
    rec('HIGH', 'COMPLETE', { total_tokens: tokens }),
  ];

  it('UNDER_BUDGETED recommends a higher rounded budget', () => {
    const b = budgetCalibration(three(300000), 'HIGH', 100000);
    assert.equal(b.verdict, 'UNDER_BUDGETED');
    assert.equal(b.recommended_budget, 300000);
  });

  it('OVER_BUDGETED recommends a lower rounded budget', () => {
    const b = budgetCalibration(three(20000), 'HIGH', 100000);
    assert.equal(b.verdict, 'OVER_BUDGETED');
    assert.equal(b.recommended_budget, 20000);
  });

  it('WELL_CALIBRATED keeps the static budget', () => {
    const b = budgetCalibration(three(90000), 'HIGH', 100000);
    assert.equal(b.verdict, 'WELL_CALIBRATED');
    assert.equal(b.recommended_budget, 100000);
  });

  it('INSUFFICIENT_DATA below the minimum run count', () => {
    assert.equal(budgetCalibration(three(90000).slice(0, 2), 'HIGH', 100000).verdict, 'INSUFFICIENT_DATA');
  });
});

describe('routingAdvice (the router overlay)', () => {
  it('is unavailable with no records (router falls back to static heuristics)', () => {
    const a = routingAdvice([], 'MEDIUM', 250000);
    assert.equal(a.available, false);
    assert.equal(a.runs, 0);
  });

  it('raises a reliability caution for a historically flaky tier', () => {
    const records = [
      rec('MEDIUM', 'BLOCKED', { fallback_reason: 'writers did not materialize' }),
      rec('MEDIUM', 'BLOCKED', { fallback_reason: 'writers did not materialize' }),
      rec('MEDIUM', 'COMPLETE'),
    ];
    const a = routingAdvice(records, 'MEDIUM', 250000);
    assert.equal(a.available, true);
    assert.ok(a.tier_prior.fallback_rate >= PRIORS_CONFIG.HIGH_FALLBACK_RATE);
    assert.ok(a.cautions.some((c: string) => c.includes('historically fell back')));
  });

  it('is deterministic — identical records yield byte-identical advice', () => {
    const mk = () => [
      rec('HIGH', 'COMPLETE', { total_tokens: 400000 }),
      rec('HIGH', 'BLOCKED', { fallback_reason: 'x' }),
      rec('HIGH', 'COMPLETE', { total_tokens: 420000 }),
      rec('HIGH', 'COMPLETE', { total_tokens: 410000 }),
    ];
    assert.equal(JSON.stringify(routingAdvice(mk(), 'HIGH', 400000)), JSON.stringify(routingAdvice(mk(), 'HIGH', 400000)));
  });
});
