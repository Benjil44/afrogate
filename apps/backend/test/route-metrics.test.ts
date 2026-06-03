import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import {
  averageMetric,
  calculateHandshakePenalty,
  calculateWireGuardScore,
  calculateWireGuardTelemetryScore,
  clientConfigIdFromRouteAssignmentKey,
  createUniformRouteScores,
  defaultSpeedProfileForProtocol,
  extractEndpoint,
  extractLoadPercent,
  getRouteProbes,
  isProtocolSpecificScoreProfile,
  isRecord,
  isRouteProbeMetric,
  mapWireGuardTelemetryStatus,
  maximumMetric,
  minimumMetric,
  normalizeAssignmentKey,
  normalizeRouteDecisionCountryCode,
  normalizeRouteGroup,
  numberFromConfig,
  protocolsForScoreProfile,
  roundRouteScore,
  roundRouteScores,
  summarizeRouteProbes,
} from '../src/operations/route-metrics.ts';

describe('averageMetric / minimumMetric / maximumMetric', () => {
  it('aggregates finite values, ignoring null/undefined/non-finite', () => {
    assert.equal(averageMetric([10, 20, null, undefined, Number.NaN]), 15);
    assert.equal(minimumMetric([10, 20, 5]), 5);
    assert.equal(maximumMetric([10, 20, 5]), 20);
  });

  it('rounds the average to one decimal and min/max to integers', () => {
    assert.equal(averageMetric([1, 2]), 1.5);
    assert.equal(minimumMetric([1.4, 2.6]), 1);
    assert.equal(maximumMetric([1.4, 2.6]), 3);
  });

  it('returns null when there are no finite values', () => {
    assert.equal(averageMetric([null, undefined]), null);
    assert.equal(minimumMetric([]), null);
    assert.equal(maximumMetric([Number.NaN]), null);
  });
});

describe('calculateHandshakePenalty', () => {
  it('penalizes unknown age, ramps after 180s, caps at 35', () => {
    assert.equal(calculateHandshakePenalty(null), 18);
    assert.equal(calculateHandshakePenalty(120), 0);
    assert.equal(calculateHandshakePenalty(180), 0);
    assert.equal(calculateHandshakePenalty(240), 5);
    assert.equal(calculateHandshakePenalty(100000), 35);
  });
});

describe('mapWireGuardTelemetryStatus', () => {
  it('maps raw statuses to health states', () => {
    assert.equal(mapWireGuardTelemetryStatus('up'), 'healthy');
    assert.equal(mapWireGuardTelemetryStatus('degraded'), 'degraded');
    assert.equal(mapWireGuardTelemetryStatus('down'), 'critical');
    assert.equal(mapWireGuardTelemetryStatus('weird'), 'unknown');
  });
});

describe('numberFromConfig', () => {
  it('accepts numbers and numeric strings, rejects the rest', () => {
    assert.equal(numberFromConfig(42), 42);
    assert.equal(numberFromConfig('42'), 42);
    assert.equal(numberFromConfig('  '), null);
    assert.equal(numberFromConfig('abc'), null);
    assert.equal(numberFromConfig(Number.POSITIVE_INFINITY), null);
    assert.equal(numberFromConfig(null), null);
  });
});

describe('extractEndpoint', () => {
  it('prefers explicit endpoint keys', () => {
    assert.equal(extractEndpoint({ endpoint: '  vpn:443 ' }), 'vpn:443');
    assert.equal(extractEndpoint({ targetEndpoint: 'x' }), 'x');
  });

  it('falls back to host[:port]', () => {
    assert.equal(extractEndpoint({ host: 'h', port: 51820 }), 'h:51820');
    assert.equal(extractEndpoint({ healthHost: 'h' }), 'h');
    assert.equal(extractEndpoint({ nothing: 1 }), null);
  });
});

describe('extractLoadPercent', () => {
  it('clamps explicit load values to 0-100', () => {
    assert.equal(extractLoadPercent({ loadPercent: 42 }, 0), 42);
    assert.equal(extractLoadPercent({ load: 150 }, 0), 100);
  });

  it('derives from weight when no explicit value, null when weight <= 0', () => {
    assert.equal(extractLoadPercent({}, 30), 70);
    assert.equal(extractLoadPercent({}, 0), null);
  });
});

describe('normalizeRouteDecisionCountryCode', () => {
  it('uppercases valid 2-letter codes, else null', () => {
    assert.equal(normalizeRouteDecisionCountryCode('nl'), 'NL');
    assert.equal(normalizeRouteDecisionCountryCode('USA'), null);
    assert.equal(normalizeRouteDecisionCountryCode(''), null);
  });
});

describe('clientConfigIdFromRouteAssignmentKey', () => {
  it('extracts a UUID from a client_config key', () => {
    assert.equal(
      clientConfigIdFromRouteAssignmentKey('client_config:123e4567-e89b-12d3-a456-426614174000'),
      '123e4567-e89b-12d3-a456-426614174000',
    );
  });

  it('returns null for a wrong prefix or non-UUID', () => {
    assert.equal(clientConfigIdFromRouteAssignmentKey('other:123'), null);
    assert.equal(clientConfigIdFromRouteAssignmentKey('client_config:not-a-uuid'), null);
  });
});

describe('normalizeRouteGroup / normalizeAssignmentKey', () => {
  it('defaults and accepts simple text', () => {
    assert.equal(normalizeRouteGroup(undefined), 'main');
    assert.equal(normalizeRouteGroup('eu-west'), 'eu-west');
    assert.equal(normalizeAssignmentKey(undefined), 'default');
    assert.equal(normalizeAssignmentKey('client_config:abc.1'), 'client_config:abc.1');
  });

  it('rejects disallowed characters', () => {
    assert.throws(() => normalizeRouteGroup('bad group!'), BadRequestException);
    assert.throws(() => normalizeAssignmentKey('bad key!'), BadRequestException);
  });
});

describe('defaultSpeedProfileForProtocol', () => {
  it('passes through known profiles, defaults the rest', () => {
    for (const p of ['balanced', 'highSpeed', 'highSecurity', 'gaming']) {
      assert.equal(defaultSpeedProfileForProtocol(p), p);
    }
    assert.equal(defaultSpeedProfileForProtocol('weird'), 'balanced');
  });
});

describe('roundRouteScore / createUniformRouteScores / roundRouteScores', () => {
  it('rounds and clamps a single score to [0, 100]', () => {
    assert.equal(roundRouteScore(42.4), 42);
    assert.equal(roundRouteScore(-5), 0);
    assert.equal(roundRouteScore(150), 100);
  });

  it('builds a uniform score map across all profiles', () => {
    const s = createUniformRouteScores(70);
    assert.deepEqual(s, {
      balanced: 70, stability: 70, throughput: 70, gaming: 70,
      tcp: 70, udp: 70, quic: 70, dns: 70, wireguard: 70,
    });
  });

  it('rounds+clamps every profile in a score map', () => {
    const s = roundRouteScores(createUniformRouteScores(120.6));
    assert.equal(s.balanced, 100);
    assert.equal(s.wireguard, 100);
  });
});

describe('isProtocolSpecificScoreProfile / protocolsForScoreProfile', () => {
  it('identifies protocol-specific profiles', () => {
    for (const p of ['tcp', 'udp', 'quic', 'dns', 'wireguard']) {
      assert.equal(isProtocolSpecificScoreProfile(p), true);
    }
    assert.equal(isProtocolSpecificScoreProfile('balanced'), false);
    assert.equal(isProtocolSpecificScoreProfile('gaming'), false);
  });

  it('returns the protocol probe set for a profile, defaulting to all', () => {
    assert.deepEqual(protocolsForScoreProfile('tcp'), ['tcp', 'mtu']);
    assert.deepEqual(protocolsForScoreProfile('gaming'), ['udp', 'quic', 'wireguard', 'tcp', 'mtu']);
    assert.deepEqual(protocolsForScoreProfile('balanced'), ['tcp', 'udp', 'quic', 'dns', 'wireguard', 'mtu']);
  });
});

describe('calculateWireGuardScore', () => {
  const base = { enabled: true, maintenanceMode: false, healthStatus: 'healthy', latencyMs: null, jitterMs: null, packetLossPercent: null };

  it('returns 0 when disabled or in maintenance', () => {
    assert.equal(calculateWireGuardScore({ ...base, enabled: false }), 0);
    assert.equal(calculateWireGuardScore({ ...base, maintenanceMode: true }), 0);
  });

  it('scores healthy candidates high and applies latency/jitter/loss penalties', () => {
    assert.equal(calculateWireGuardScore(base), 90);
    assert.equal(calculateWireGuardScore({ ...base, healthStatus: 'critical' }), 35);
    assert.equal(calculateWireGuardScore({ ...base, healthStatus: 'mystery' }), 55); // default
    // 90 - (250-50)/4 = 90 - 50 = 40
    assert.equal(calculateWireGuardScore({ ...base, latencyMs: 250 }), 40);
    // heavy loss floors at 0
    assert.equal(calculateWireGuardScore({ ...base, packetLossPercent: 10 }), 0);
  });
});

describe('calculateWireGuardTelemetryScore', () => {
  const up = { status: 'up', peerCount: 10, activePeerCount: 10, latestHandshakeAgeSeconds: 0 };

  it('scores a fully-active up interface high', () => {
    assert.equal(calculateWireGuardTelemetryScore(up, 100), 92);
  });

  it('penalizes inactive peers, stale handshake, and a weak server', () => {
    // half peers inactive: 92 - 0.5*25 = 79.5 -> 80
    assert.equal(calculateWireGuardTelemetryScore({ ...up, activePeerCount: 5 }, 100), 80);
    // unknown handshake age adds an 18 penalty: 92 - 18 = 74
    assert.equal(calculateWireGuardTelemetryScore({ ...up, latestHandshakeAgeSeconds: null }, 100), 74);
    // weak server (score 40): 92 - (60-40)/2 = 92 - 10 = 82
    assert.equal(calculateWireGuardTelemetryScore(up, 40), 82);
  });
});

describe('isRecord', () => {
  it('accepts plain objects, rejects null/arrays/primitives', () => {
    assert.equal(isRecord({ a: 1 }), true);
    assert.equal(isRecord(null), false);
    assert.equal(isRecord([1, 2]), false);
    assert.equal(isRecord('x'), false);
    assert.equal(isRecord(7), false);
  });
});

describe('isRouteProbeMetric', () => {
  it('requires protocol/target/status strings', () => {
    assert.equal(isRouteProbeMetric({ protocol: 'tcp', target: 'h', status: 'ok' }), true);
    assert.equal(isRouteProbeMetric({ protocol: 'tcp', target: 'h' }), false);
    assert.equal(isRouteProbeMetric({ protocol: 1, target: 'h', status: 'ok' }), false);
    assert.equal(isRouteProbeMetric(null), false);
  });
});

describe('getRouteProbes', () => {
  it('returns [] for missing/invalid input and filters out malformed probes', () => {
    assert.deepEqual(getRouteProbes(null), []);
    assert.deepEqual(getRouteProbes({}), []);
    const raw = {
      routeProbes: [
        { protocol: 'tcp', target: 'h', status: 'ok' },
        { protocol: 'bad' }, // dropped
        'nope', // dropped
      ],
    } as never;
    assert.equal(getRouteProbes(raw).length, 1);
  });
});

describe('summarizeRouteProbes', () => {
  it('averages latency/jitter/loss and derives MTU min/max', () => {
    const probes = [
      { protocol: 'tcp', target: 'h', status: 'ok', latencyMs: 10, jitterMs: 2, packetLossPercent: 0 },
      { protocol: 'tcp', target: 'h', status: 'ok', latencyMs: 30, jitterMs: 4, packetLossPercent: 1 },
      { protocol: 'mtu', target: 'h', status: 'ok', pathMtuBytes: 1400, recommendedTunnelMtuBytes: 1320, configuredMtuBytes: 1380 },
      { protocol: 'mtu', target: 'h', status: 'ok', pathMtuBytes: 1380, recommendedTunnelMtuBytes: 1300, configuredMtuBytes: 1420 },
    ] as never;
    const s = summarizeRouteProbes(probes);
    assert.equal(s.latencyMs, 20);
    assert.equal(s.jitterMs, 3);
    assert.equal(s.packetLossPercent, 0.5);
    assert.equal(s.pathMtuBytes, 1380); // min
    assert.equal(s.recommendedTunnelMtuBytes, 1300); // min
    assert.equal(s.configuredMtuBytes, 1420); // max
  });

  it('derives loadedLatencyDelta from loadedLatency - latency when no explicit delta', () => {
    const probes = [
      { protocol: 'tcp', target: 'h', status: 'ok', latencyMs: 20, loadedLatencyMs: 120 },
    ] as never;
    assert.equal(summarizeRouteProbes(probes).loadedLatencyDeltaMs, 100);
  });

  it('returns nulls for an empty probe set', () => {
    const s = summarizeRouteProbes([]);
    assert.equal(s.latencyMs, null);
    assert.equal(s.pathMtuBytes, null);
  });
});
