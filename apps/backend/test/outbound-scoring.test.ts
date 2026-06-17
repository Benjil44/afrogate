import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankOutbounds, pickBestOutbound } from '../src/operations/outbound-scoring.ts';

const base = { jitterMs: 5, downMbps: 20, upMbps: 10 };

test('excludes critical/unknown/unreachable, ranks healthy by quality', () => {
  const ranked = rankOutbounds([
    { id: 'germany', status: 'healthy', latencyMs: 40, ...base, downMbps: 25 },
    { id: 'slow', status: 'healthy', latencyMs: 300, ...base, downMbps: 3 },
    { id: 'dead', status: 'critical', latencyMs: null, downMbps: null, upMbps: null, jitterMs: null },
    { id: 'unknown', status: 'unknown', latencyMs: null, downMbps: null, upMbps: null, jitterMs: null },
  ]);
  assert.deepEqual(ranked.map((r) => r.id), ['germany', 'slow']); // dead+unknown excluded
});

test('pickBestOutbound returns the top healthy id, or null when none', () => {
  assert.equal(
    pickBestOutbound([
      { id: 'a', status: 'healthy', latencyMs: 120, ...base, downMbps: 8 },
      { id: 'b', status: 'healthy', latencyMs: 30, ...base, downMbps: 30 },
    ]),
    'b',
  );
  assert.equal(pickBestOutbound([{ id: 'x', status: 'critical', latencyMs: null, downMbps: null, upMbps: null, jitterMs: null }]), null);
});

test('degraded ranks below healthy with similar metrics', () => {
  const ranked = rankOutbounds([
    { id: 'deg', status: 'degraded', latencyMs: 30, ...base },
    { id: 'ok', status: 'healthy', latencyMs: 35, ...base },
  ]);
  assert.equal(ranked[0].id, 'ok');
});
