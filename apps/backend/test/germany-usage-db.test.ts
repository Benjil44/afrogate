import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyDeUserUsage,
  queryClientUsageSeries,
  type DeBaselineRow,
  type DeUsageDeps,
} from '../src/client/germany-usage-db.ts';
import { computeUsageDelta } from '../src/client/germany-usage.ts';
import { applyUsageDelta } from '../src/client/usage-accounting.ts';
import { createFakeExecutor } from './helpers/fake-db.ts';

const OBS = '2026-08-25T10:00:00.000Z';
const user = { clientConfigId: 'cc-1', cumulativeBytes: 5000 };
// The service wires exactly these two — use them so the test exercises the real
// shared accounting write + delta math, not a stub.
const deps: DeUsageDeps = { computeDelta: computeUsageDelta, applyDelta: applyUsageDelta };

describe('applyDeUserUsage (per-user transaction body, mock db)', () => {
  it('happy path: event -> used_bytes -> hourly/daily rollups -> baseline advance', async () => {
    const ex = createFakeExecutor([
      { rows: [{ customerAccountId: 'acct-1' }] }, // account lookup
      { rows: [{ id: 'ev-1' }] }, // event insert (not a conflict)
      { rows: [{}] }, // applyUsageDelta
      { rows: [{}] }, // hourly upsert
      { rows: [{}] }, // daily upsert
      { rows: [{}] }, // baseline upsert
    ]);

    const baseline: DeBaselineRow = { clientConfigId: 'cc-1', cumulativeBytes: 3000, observedAt: '2026-08-25T09:00:00.000Z' };
    const applied = await applyDeUserUsage(ex, user, baseline, OBS, deps);

    assert.equal(applied, 2000, 'delta = current(5000) - baseline(3000)');
    assert.equal(ex.calls.length, 6);

    assert.match(ex.calls[0].text, /FROM client_configs WHERE id = \$1/);
    assert.deepEqual(ex.calls[0].values, ['cc-1']);

    assert.match(ex.calls[1].text, /INSERT INTO client_usage_events/);
    assert.match(ex.calls[1].text, /'germany-xray'/);
    assert.match(ex.calls[1].text, /ON CONFLICT \(source, idempotency_key\)/);
    // account, client, delta, observedAt, windowStart, idempotency key
    assert.deepEqual(ex.calls[1].values, ['acct-1', 'cc-1', 2000, OBS, '2026-08-25T09:00:00.000Z', 'cc-1:5000']);

    assert.match(ex.calls[2].text, /UPDATE client_configs/);
    assert.match(ex.calls[2].text, /UPDATE customer_accounts/);
    assert.deepEqual(ex.calls[2].values, ['cc-1', 2000]);

    assert.match(ex.calls[3].text, /INSERT INTO client_usage_hourly/);
    assert.match(ex.calls[3].text, /used_bytes = client_usage_hourly\.used_bytes \+ excluded\.used_bytes/);
    assert.match(ex.calls[4].text, /INSERT INTO client_usage_daily/);
    assert.match(ex.calls[4].text, /used_bytes = client_usage_daily\.used_bytes \+ excluded\.used_bytes/);

    assert.match(ex.calls[5].text, /INSERT INTO client_usage_de_baseline/);
    assert.deepEqual(ex.calls[5].values, ['cc-1', 'acct-1', 5000, OBS]);
  });

  it('unknown client is a no-op and creates NO baseline row (catches up from 0 later)', async () => {
    const ex = createFakeExecutor([{ rows: [] }]); // account lookup misses
    const applied = await applyDeUserUsage(ex, user, undefined, OBS, deps);
    assert.equal(applied, 0);
    assert.equal(ex.calls.length, 1, 'no event / delta / rollup / baseline writes');
  });

  it('no new bytes (delta 0) advances only the baseline — no event/usage double count', async () => {
    const ex = createFakeExecutor([
      { rows: [{ customerAccountId: 'acct-1' }] },
      { rows: [{}] }, // baseline upsert
    ]);
    const baseline: DeBaselineRow = { clientConfigId: 'cc-1', cumulativeBytes: 5000, observedAt: OBS };
    const applied = await applyDeUserUsage(ex, user, baseline, OBS, deps);
    assert.equal(applied, 0);
    assert.equal(ex.calls.length, 2);
    assert.match(ex.calls[1].text, /INSERT INTO client_usage_de_baseline/);
  });

  it('idempotency: an already-recorded cumulative (event conflict) does NOT re-apply usage', async () => {
    const ex = createFakeExecutor([
      { rows: [{ customerAccountId: 'acct-1' }] },
      { rows: [] }, // INSERT ... ON CONFLICT DO NOTHING -> 0 rows (already present)
      { rows: [{}] }, // baseline upsert only
    ]);
    const applied = await applyDeUserUsage(ex, user, undefined, OBS, deps);
    assert.equal(applied, 0, 'no double count');
    assert.equal(ex.calls.length, 3, 'no applyUsageDelta / rollup writes after the conflict');
    assert.match(ex.calls[2].text, /INSERT INTO client_usage_de_baseline/);
  });
});

describe('queryClientUsageSeries (charts shape, mock db)', () => {
  it('48h window: 48 hourly hours + last 2 daily days, ISO buckets + numeric bytes', async () => {
    const ex = createFakeExecutor([
      { rows: [{ bucketStart: '2026-08-25T09:00:00.000Z', usedBytes: '2000' }] },
      { rows: [{ bucketStart: '2026-08-24T00:00:00.000Z', usedBytes: 50000 }] },
    ]);
    const series = await queryClientUsageSeries(ex, 'cc-1', '48h');

    assert.deepEqual(series.hourly, [{ bucketStart: '2026-08-25T09:00:00.000Z', usedBytes: 2000 }]);
    assert.deepEqual(series.daily, [{ bucketStart: '2026-08-24T00:00:00.000Z', usedBytes: 50000 }]);
    // daily window bound param = 2 days for 48h
    assert.deepEqual(ex.calls[1].values, ['cc-1', 2]);
  });

  it('30d window widens the daily bound to 30 days', async () => {
    const ex = createFakeExecutor([{ rows: [] }, { rows: [] }]);
    await queryClientUsageSeries(ex, 'cc-1', '30d');
    assert.deepEqual(ex.calls[1].values, ['cc-1', 30]);
    assert.match(ex.calls[0].text, /client_usage_hourly/);
    assert.match(ex.calls[1].text, /client_usage_daily/);
  });
});
