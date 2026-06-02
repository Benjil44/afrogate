import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RouteProbeMetric } from '@afrogate/shared';
import {
  calculateMtuProbeScore,
  calculateProtocolProbeScore,
  calculateSingleProbeScore,
  clamp,
  loadedLatencyDeltaFromProbe,
  roundMetric,
  thresholdPenalty,
} from '../src/operations/route-scoring.ts';

const probe = (over: Partial<RouteProbeMetric>): RouteProbeMetric =>
  ({ protocol: 'tcp', status: 'healthy', latencyMs: null, jitterMs: null, packetLossPercent: null, ...over }) as RouteProbeMetric;

describe('clamp', () => {
  it('bounds values into [min, max]', () => {
    assert.equal(clamp(150, 0, 100), 100);
    assert.equal(clamp(-5, 0, 100), 0);
    assert.equal(clamp(42, 0, 100), 42);
  });
});

describe('thresholdPenalty', () => {
  it('is zero at/below threshold and linear above it', () => {
    assert.equal(thresholdPenalty(50, 100, 0.09), 0);
    assert.equal(thresholdPenalty(200, 100, 0.09), 9);
  });
  it('is zero for null/non-finite values', () => {
    assert.equal(thresholdPenalty(null, 0, 1), 0);
    assert.equal(thresholdPenalty(Number.NaN, 0, 1), 0);
  });
});

describe('roundMetric', () => {
  it('rounds to the requested precision, null for invalid', () => {
    assert.equal(roundMetric(1234.567, 0), 1235);
    assert.equal(roundMetric(1.239, 2), 1.24);
    assert.equal(roundMetric(null, 0), null);
  });
});

describe('loadedLatencyDeltaFromProbe', () => {
  it('prefers an explicit delta', () => {
    assert.equal(loadedLatencyDeltaFromProbe(probe({ loadedLatencyDeltaMs: 25 })), 25);
  });
  it('derives delta from loaded minus base latency', () => {
    assert.equal(loadedLatencyDeltaFromProbe(probe({ loadedLatencyMs: 90, latencyMs: 30 })), 60);
  });
  it('is null when no loaded-latency signal is present', () => {
    assert.equal(loadedLatencyDeltaFromProbe(probe({ latencyMs: 30 })), null);
  });
});

describe('calculateSingleProbeScore', () => {
  it('gives a healthy, low-latency probe a top score', () => {
    assert.equal(calculateSingleProbeScore(probe({ status: 'healthy', latencyMs: 10, jitterMs: 2, packetLossPercent: 0 })), 100);
  });
  it('penalizes packet loss heavily and stays within 0-100', () => {
    const score = calculateSingleProbeScore(probe({ status: 'healthy', packetLossPercent: 10 }));
    assert.ok(score >= 0 && score < 100);
    assert.ok(score < calculateSingleProbeScore(probe({ status: 'healthy', packetLossPercent: 0 })));
  });
  it('a critical probe scores low', () => {
    assert.ok(calculateSingleProbeScore(probe({ status: 'critical' })) <= 20);
  });
  it('routes mtu probes to the MTU scorer', () => {
    const mtu = probe({ protocol: 'mtu', status: 'healthy', pathMtuBytes: 1500, recommendedTunnelMtuBytes: 1420, configuredMtuBytes: 1420 } as Partial<RouteProbeMetric>);
    assert.equal(calculateSingleProbeScore(mtu), calculateMtuProbeScore(mtu));
  });
});

describe('calculateMtuProbeScore', () => {
  it('full score for a healthy MTU with safe path', () => {
    assert.equal(calculateMtuProbeScore(probe({ protocol: 'mtu', status: 'healthy', pathMtuBytes: 1500, recommendedTunnelMtuBytes: 1420, configuredMtuBytes: 1420 } as Partial<RouteProbeMetric>)), 100);
  });
  it('penalizes a configured MTU well above the recommended', () => {
    const score = calculateMtuProbeScore(probe({ protocol: 'mtu', status: 'healthy', pathMtuBytes: 1500, recommendedTunnelMtuBytes: 1280, configuredMtuBytes: 1500 } as Partial<RouteProbeMetric>));
    assert.ok(score < 100);
  });
});

describe('calculateProtocolProbeScore', () => {
  it('returns null when no probe matches the requested protocols', () => {
    assert.equal(calculateProtocolProbeScore([probe({ protocol: 'dns' })], ['tcp']), null);
  });
  it('weights the average and the worst probe', () => {
    const score = calculateProtocolProbeScore(
      [probe({ protocol: 'tcp', status: 'healthy', latencyMs: 10 }), probe({ protocol: 'tcp', status: 'critical' })],
      ['tcp'],
    );
    assert.ok(score !== null && score > 20 && score < 100);
  });
});
