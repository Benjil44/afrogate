import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAX_DE_USAGE_DELTA_BYTES,
  computeUsageDelta,
  parseDeUsageBuffer,
} from '../src/client/germany-usage.ts';

describe('parseDeUsageBuffer (Germany durable buffer)', () => {
  it('extracts cc_<id>@afrows cumulative totals + updated_at', () => {
    const json = JSON.stringify({
      updated_at: '2026-08-25T10:00:00.000Z',
      users: {
        'cc_5b69359d-214b-47f8-b46c-55f52ce57f27@afrows': { bytes: 123456 },
        'cc_other-id@afrows': { bytes: 10 },
      },
    });
    const buffer = parseDeUsageBuffer(json);
    assert.equal(buffer.updatedAt, '2026-08-25T10:00:00.000Z');
    const map = new Map(buffer.users.map((u) => [u.clientConfigId, u.cumulativeBytes]));
    assert.equal(map.get('5b69359d-214b-47f8-b46c-55f52ce57f27'), 123456);
    assert.equal(map.get('other-id'), 10);
    assert.equal(map.size, 2);
  });

  it('drops bad rows (non-cc key, empty id, negative/non-finite bytes) and floors', () => {
    const json = JSON.stringify({
      users: {
        'cc_ok@afrows': { bytes: 99.9 },
        'inbound>>>afrows-de-ws': { bytes: 5 }, // not a cc_ key
        'cc_@afrows': { bytes: 5 }, // empty id
        'cc_neg@afrows': { bytes: -1 },
        'cc_nan@afrows': { bytes: 'x' },
      },
    });
    const buffer = parseDeUsageBuffer(json);
    assert.equal(buffer.updatedAt, null);
    assert.deepEqual(buffer.users, [{ clientConfigId: 'ok', cumulativeBytes: 99 }]);
  });

  it('never throws on malformed / non-object input', () => {
    assert.deepEqual(parseDeUsageBuffer('not json'), { updatedAt: null, users: [] });
    assert.deepEqual(parseDeUsageBuffer('null'), { updatedAt: null, users: [] });
    assert.deepEqual(parseDeUsageBuffer('[]'), { updatedAt: null, users: [] });
    assert.deepEqual(parseDeUsageBuffer(JSON.stringify({ users: {} })), { updatedAt: null, users: [] });
  });
});

describe('computeUsageDelta (baseline / high-water-mark math)', () => {
  it('first sight (no baseline) counts from 0 — recorder counter also starts at 0', () => {
    assert.equal(computeUsageDelta(5000, undefined), 5000);
    assert.equal(computeUsageDelta(5000, null), 5000);
  });

  it('steady state counts only the increment since the baseline', () => {
    assert.equal(computeUsageDelta(5000, 3000), 2000);
    assert.equal(computeUsageDelta(3000, 3000), 0);
  });

  it('counter reset (current < baseline) counts current from 0, never negative', () => {
    // buffer rebuilt / xray reinstalled: cumulative dropped below the baseline
    assert.equal(computeUsageDelta(200, 9000), 200);
  });

  it('blackout catch-up: a big jump since a STALE baseline is fully counted (no loss)', () => {
    // baseline was 1 GB before a ~2h village blackout; on reconnect it is 6 GB.
    // Because the baseline only advances after a successful write, the full 5 GB
    // missed during the blackout is recovered on the next successful read.
    assert.equal(computeUsageDelta(6_000_000_000, 1_000_000_000), 5_000_000_000);
  });

  it('caps a single delta at 1 TB and clamps invalid current to 0', () => {
    assert.equal(computeUsageDelta(5 * MAX_DE_USAGE_DELTA_BYTES, 0), MAX_DE_USAGE_DELTA_BYTES);
    assert.equal(MAX_DE_USAGE_DELTA_BYTES, 1_000_000_000_000);
    assert.equal(computeUsageDelta(Number.NaN, 100), 0);
    assert.equal(computeUsageDelta(-5, 100), 0);
  });
});
