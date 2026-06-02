import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clientRouteAssignmentKey,
  clientRouteHealthRank,
  mapClientScoreProfileToProtocol,
  mapClientScoreProfileToSpeed,
} from '../src/billing/client-route-mapping.ts';

describe('clientRouteHealthRank', () => {
  it('orders healthy < degraded < unknown < other', () => {
    assert.equal(clientRouteHealthRank('healthy'), 0);
    assert.equal(clientRouteHealthRank('degraded'), 1);
    assert.equal(clientRouteHealthRank('unknown'), 2);
    assert.equal(clientRouteHealthRank('offline'), 3);
    assert.ok(clientRouteHealthRank('healthy') < clientRouteHealthRank('degraded'));
  });
});

describe('mapClientScoreProfileToProtocol', () => {
  it('passes through known protocol profiles', () => {
    for (const p of ['gaming', 'tcp', 'udp', 'quic', 'dns', 'wireguard']) {
      assert.equal(mapClientScoreProfileToProtocol(p), p);
    }
  });

  it('defaults unknown profiles to balanced', () => {
    assert.equal(mapClientScoreProfileToProtocol('throughput'), 'balanced');
    assert.equal(mapClientScoreProfileToProtocol(''), 'balanced');
  });
});

describe('mapClientScoreProfileToSpeed', () => {
  it('maps throughput/gaming and defaults the rest to balanced', () => {
    assert.equal(mapClientScoreProfileToSpeed('throughput'), 'highSpeed');
    assert.equal(mapClientScoreProfileToSpeed('gaming'), 'gaming');
    assert.equal(mapClientScoreProfileToSpeed('tcp'), 'balanced');
  });
});

describe('clientRouteAssignmentKey', () => {
  it('builds a namespaced key', () => {
    assert.equal(clientRouteAssignmentKey('cfg-1'), 'client_config:cfg-1');
  });
});
