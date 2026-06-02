import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assessRouteBufferbloat,
  routeBufferbloatRecommendation,
  routeBufferbloatSeverity,
} from '../src/operations/route-bufferbloat.ts';

describe('routeBufferbloatSeverity', () => {
  it('uses the measured loaded-latency delta when present', () => {
    const base = { latencyMs: 20, jitterMs: 5, loadPercent: 90 };
    assert.equal(routeBufferbloatSeverity({ ...base, loadedLatencyDeltaMs: 200 }), 'high');
    assert.equal(routeBufferbloatSeverity({ ...base, loadedLatencyDeltaMs: 100 }), 'medium');
    assert.equal(routeBufferbloatSeverity({ ...base, loadedLatencyDeltaMs: 40 }), 'low');
    assert.equal(routeBufferbloatSeverity({ ...base, loadedLatencyDeltaMs: 10 }), 'none');
  });

  it('falls back to load% + idle latency/jitter when no delta', () => {
    assert.equal(
      routeBufferbloatSeverity({ latencyMs: 150, jitterMs: 0, loadPercent: 90, loadedLatencyDeltaMs: null }),
      'high',
    );
    assert.equal(
      routeBufferbloatSeverity({ latencyMs: 0, jitterMs: 30, loadPercent: 78, loadedLatencyDeltaMs: null }),
      'medium',
    );
    assert.equal(
      routeBufferbloatSeverity({ latencyMs: 95, jitterMs: 0, loadPercent: 70, loadedLatencyDeltaMs: null }),
      'low',
    );
    assert.equal(
      routeBufferbloatSeverity({ latencyMs: 10, jitterMs: 1, loadPercent: 50, loadedLatencyDeltaMs: null }),
      'none',
    );
  });

  it('returns unknown when neither delta nor load is available', () => {
    assert.equal(
      routeBufferbloatSeverity({ latencyMs: 100, jitterMs: 50, loadPercent: null, loadedLatencyDeltaMs: null }),
      'unknown',
    );
  });
});

describe('routeBufferbloatRecommendation', () => {
  it('maps severity to recommendation', () => {
    assert.equal(routeBufferbloatRecommendation('high'), 'avoidUnderLoad');
    assert.equal(routeBufferbloatRecommendation('medium'), 'sqmRecommended');
    assert.equal(routeBufferbloatRecommendation('low'), 'watch');
    assert.equal(routeBufferbloatRecommendation('none'), 'none');
    assert.equal(routeBufferbloatRecommendation('unknown'), 'none');
  });
});

describe('assessRouteBufferbloat', () => {
  it('derives the delta from loadedLatency - idle latency and rounds to 1dp', () => {
    const a = assessRouteBufferbloat({ latencyMs: 20, jitterMs: 5, loadPercent: 90, loadedLatencyMs: 200.04 });
    assert.equal(a.loadedLatencyMs, 200);
    assert.equal(a.loadedLatencyDeltaMs, 180);
    assert.equal(a.severity, 'high');
    assert.equal(a.recommendation, 'avoidUnderLoad');
  });

  it('prefers an explicit delta over the computed one', () => {
    const a = assessRouteBufferbloat({
      latencyMs: 20,
      jitterMs: 5,
      loadPercent: 90,
      loadedLatencyMs: 500,
      loadedLatencyDeltaMs: 40,
    });
    assert.equal(a.loadedLatencyDeltaMs, 40);
    assert.equal(a.severity, 'low');
  });

  it('returns null latency fields and load-based severity when no loaded sample', () => {
    const a = assessRouteBufferbloat({ latencyMs: 150, jitterMs: 0, loadPercent: 90 });
    assert.equal(a.loadedLatencyMs, null);
    assert.equal(a.loadedLatencyDeltaMs, null);
    assert.equal(a.severity, 'high');
  });
});
