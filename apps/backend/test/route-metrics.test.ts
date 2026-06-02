import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import {
  averageMetric,
  calculateHandshakePenalty,
  clientConfigIdFromRouteAssignmentKey,
  defaultSpeedProfileForProtocol,
  extractEndpoint,
  extractLoadPercent,
  mapWireGuardTelemetryStatus,
  maximumMetric,
  minimumMetric,
  normalizeAssignmentKey,
  normalizeRouteDecisionCountryCode,
  normalizeRouteGroup,
  numberFromConfig,
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
