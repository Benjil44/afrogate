import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveActiveWireGuard, pickWireGuardCandidates } from './route-candidates.ts';

const mk = (id: string, score: number) => ({
  id, name: id, endpoint: null, routeGroup: 'main', healthStatus: 'healthy',
  score, latencyMs: 0, jitterMs: 0, packetLossPercent: 0, loadPercent: 0,
  checkedAt: null, source: 'sample' as const,
});

test('pickWireGuardCandidates prefers api, falls back to sample', () => {
  const sample = [mk('s', 1)];
  const api = [mk('a', 2)];
  assert.deepEqual(pickWireGuardCandidates(api, sample), api);
  assert.deepEqual(pickWireGuardCandidates([], sample), sample);
});

test('deriveActiveWireGuard: best = highest score', () => {
  const c = [mk('a', 50), mk('b', 90), mk('c', 70)];
  const { best } = deriveActiveWireGuard(c, 'automatic', '');
  assert.equal(best.id, 'b');
});

test('deriveActiveWireGuard: automatic → active is best; manual → active is selected', () => {
  const c = [mk('a', 50), mk('b', 90)];
  assert.equal(deriveActiveWireGuard(c, 'automatic', 'a').active.id, 'b');
  assert.equal(deriveActiveWireGuard(c, 'manual', 'a').active.id, 'a');
});

test('deriveActiveWireGuard: selected falls back to best when id not found', () => {
  const c = [mk('a', 50), mk('b', 90)];
  const { selected } = deriveActiveWireGuard(c, 'manual', 'missing');
  assert.equal(selected.id, 'b');
});
