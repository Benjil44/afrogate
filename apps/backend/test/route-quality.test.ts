import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RouteQualityWindowSummary } from '@afrogate/shared';
import {
  isBestRouteQualityWindow,
  isDegradedRouteQualityWindow,
  minimumRouteAnalyticsSamples,
  nextRouteQualityWindowStart,
  routeQualityConfidence,
  routeQualityPredictionLookaheadHours,
} from '../src/operations/route-quality.ts';

const window = (over: Partial<RouteQualityWindowSummary>): RouteQualityWindowSummary =>
  over as RouteQualityWindowSummary;

describe('isBestRouteQualityWindow', () => {
  it('requires high score and low degraded percent', () => {
    assert.equal(isBestRouteQualityWindow(window({ averageScore: 80, degradedSamplePercent: 10 })), true);
    assert.equal(isBestRouteQualityWindow(window({ averageScore: 80, degradedSamplePercent: 30 })), false);
    assert.equal(isBestRouteQualityWindow(window({ averageScore: 70, degradedSamplePercent: 10 })), false);
  });
});

describe('isDegradedRouteQualityWindow', () => {
  it('flags low score or high degraded percent', () => {
    assert.equal(isDegradedRouteQualityWindow(window({ averageScore: 55, degradedSamplePercent: 0 })), true);
    assert.equal(isDegradedRouteQualityWindow(window({ averageScore: 90, degradedSamplePercent: 40 })), true);
    assert.equal(isDegradedRouteQualityWindow(window({ averageScore: 90, degradedSamplePercent: 10 })), false);
  });
});

describe('nextRouteQualityWindowStart', () => {
  it('returns null when day/hour is missing or non-finite', () => {
    assert.equal(nextRouteQualityWindowStart(window({ dayOfWeek: null, hourOfDay: 10 })), null);
    assert.equal(nextRouteQualityWindowStart(window({ dayOfWeek: Number.NaN, hourOfDay: 10 })), null);
  });

  it('computes the next occurrence at the right weekday/hour', () => {
    // 2026-06-01 is a Monday (getDay() === 1).
    const now = new Date('2026-06-01T09:00:00');
    const next = nextRouteQualityWindowStart(window({ dayOfWeek: 3, hourOfDay: 14 }), now); // Wednesday 14:00
    assert.ok(next);
    assert.equal(next?.getDay(), 3);
    assert.equal(next?.getHours(), 14);
    assert.ok(next!.getTime() > now.getTime());
  });

  it('rolls to next week when the window has already passed by >1h', () => {
    const now = new Date('2026-06-01T12:00:00'); // Monday noon
    const next = nextRouteQualityWindowStart(window({ dayOfWeek: 1, hourOfDay: 9 }), now); // Monday 09:00 (passed)
    assert.equal(next?.getDay(), 1);
    assert.ok(next!.getTime() - now.getTime() > 6 * 24 * 60 * 60 * 1000);
  });
});

describe('routeQualityPredictionLookaheadHours', () => {
  const KEY = 'AFROGATE_ROUTE_QUALITY_PREDICTION_LOOKAHEAD_HOURS';

  it('defaults to 8 when unset or non-integer', () => {
    const prev = process.env[KEY];
    delete process.env[KEY];
    assert.equal(routeQualityPredictionLookaheadHours(), 8);
    process.env[KEY] = '2.5';
    assert.equal(routeQualityPredictionLookaheadHours(), 8);
    if (prev === undefined) delete process.env[KEY];
    else process.env[KEY] = prev;
  });

  it('clamps configured values to [1, 168]', () => {
    const prev = process.env[KEY];
    process.env[KEY] = '500';
    assert.equal(routeQualityPredictionLookaheadHours(), 168);
    process.env[KEY] = '0';
    assert.equal(routeQualityPredictionLookaheadHours(), 1);
    process.env[KEY] = '24';
    assert.equal(routeQualityPredictionLookaheadHours(), 24);
    if (prev === undefined) delete process.env[KEY];
    else process.env[KEY] = prev;
  });
});

describe('routeQualityConfidence', () => {
  it('tiers by sample volume and range', () => {
    assert.equal(routeQualityConfidence(40, 4, 168), 'high');
    assert.equal(routeQualityConfidence(40, 4, 100), 'medium'); // enough samples, range too short for high
    assert.equal(routeQualityConfidence(8, 4, 24), 'medium');
    assert.equal(routeQualityConfidence(3, 4, 24), 'low');
  });
});

describe('minimumRouteAnalyticsSamples', () => {
  it('scales the minimum with the range length', () => {
    assert.equal(minimumRouteAnalyticsSamples(800), 8);
    assert.equal(minimumRouteAnalyticsSamples(200), 4);
    assert.equal(minimumRouteAnalyticsSamples(24), 2);
  });
});
