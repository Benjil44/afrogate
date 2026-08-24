import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ACTIVE_DE_CLIENTS_SQL, MAX_USAGE_DELTA_BYTES, normalizeUsageDeltas } from '../src/edge/edge-usage.ts';
import { applyUsageDelta } from '../src/client/usage-accounting.ts';
import { provisioningEmail } from '../src/client/xray-provisioning.ts';
import { createFakeExecutor } from './helpers/fake-db.ts';

describe('edge clients (GET /api/edge/de/clients)', () => {
  it('active-selection SQL mirrors the provisioning reconcile + requires entry_uuid', () => {
    assert.match(ACTIVE_DE_CLIENTS_SQL, /cc\.status <> 'disabled'/);
    assert.match(ACTIVE_DE_CLIENTS_SQL, /ca\.status = 'active'/);
    assert.match(ACTIVE_DE_CLIENTS_SQL, /ca\.deleted_at IS NULL/);
    assert.match(ACTIVE_DE_CLIENTS_SQL, /cc\.entry_uuid IS NOT NULL/);
  });

  it('derives the wire email from the client_config id (cc_<id>@afrows), never PII', () => {
    assert.equal(provisioningEmail('cc-1'), 'cc_cc-1@afrows');
  });
});

describe('normalizeUsageDeltas (POST /api/edge/de/usage validation + clamp)', () => {
  it('keeps positive whole-byte deltas', () => {
    assert.deepEqual(
      normalizeUsageDeltas([
        { clientConfigId: 'cc-1', bytes: 100 },
        { clientConfigId: 'cc-2', bytes: 250 },
      ]),
      [
        { clientConfigId: 'cc-1', bytes: 100 },
        { clientConfigId: 'cc-2', bytes: 250 },
      ],
    );
  });

  it('ignores bad rows: non-positive, non-finite, non-string/empty id', () => {
    assert.deepEqual(
      normalizeUsageDeltas([
        { clientConfigId: 'cc-ok', bytes: 500 },
        { clientConfigId: 'cc-neg', bytes: -10 },
        { clientConfigId: 'cc-zero', bytes: 0 },
        { clientConfigId: 'cc-nan', bytes: Number.NaN },
        { clientConfigId: 'cc-inf', bytes: Number.POSITIVE_INFINITY },
        { clientConfigId: '', bytes: 100 },
        { clientConfigId: 42, bytes: 100 },
      ]),
      [{ clientConfigId: 'cc-ok', bytes: 500 }],
    );
  });

  it('floors fractional bytes and caps a single delta at MAX_USAGE_DELTA_BYTES (1 TB)', () => {
    assert.deepEqual(normalizeUsageDeltas([{ clientConfigId: 'cc-1', bytes: 123.9 }]), [
      { clientConfigId: 'cc-1', bytes: 123 },
    ]);
    assert.deepEqual(normalizeUsageDeltas([{ clientConfigId: 'cc-1', bytes: 5 * MAX_USAGE_DELTA_BYTES }]), [
      { clientConfigId: 'cc-1', bytes: MAX_USAGE_DELTA_BYTES },
    ]);
    assert.equal(MAX_USAGE_DELTA_BYTES, 1_000_000_000_000);
  });

  it('handles a missing/non-array payload safely', () => {
    assert.deepEqual(normalizeUsageDeltas(undefined), []);
    assert.deepEqual(normalizeUsageDeltas(null), []);
    assert.deepEqual(normalizeUsageDeltas('nope'), []);
  });
});

describe('edge usage end-to-end via applyUsageDelta (mock db)', () => {
  it('applies each normalized delta to used_bytes, binding id + bytes as params', async () => {
    const executor = createFakeExecutor([{ rows: [{}] }, { rows: [{}] }]);
    const deltas = normalizeUsageDeltas([
      { clientConfigId: 'cc-1', bytes: 100 },
      { clientConfigId: 'cc-bad', bytes: -1 },
      { clientConfigId: 'cc-2', bytes: 5 * MAX_USAGE_DELTA_BYTES },
    ]);

    let applied = 0;
    for (const d of deltas) {
      if ((await applyUsageDelta(executor, d.clientConfigId, d.bytes)) > 0) applied += 1;
    }

    assert.equal(applied, 2);
    assert.equal(executor.calls.length, 2, 'the negative row was dropped before any query');
    assert.deepEqual(executor.calls[0].values, ['cc-1', 100]);
    assert.deepEqual(executor.calls[1].values, ['cc-2', MAX_USAGE_DELTA_BYTES]);
  });

  it('an unknown clientConfigId is a no-op (0 rows → not counted)', async () => {
    const executor = createFakeExecutor([{ rows: [] }]);
    const rows = await applyUsageDelta(executor, 'ghost', 100);
    assert.equal(rows, 0);
  });
});
