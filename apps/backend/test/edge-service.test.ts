import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ACTIVE_DE_CLIENTS_SQL, MAX_USAGE_DELTA_BYTES, normalizeUsageDeltas } from '../src/edge/edge-usage.ts';
import { applyUsageDelta } from '../src/client/usage-accounting.ts';
import { provisioningEmail } from '../src/client/xray-provisioning.ts';
import { createFakeDatabase, createFakeExecutor } from './helpers/fake-db.ts';
import { bundledSkipReason, loadBundled } from './helpers/load-bundled.ts';

const CC1 = '11111111-1111-4111-8111-111111111111';
const CC2 = '22222222-2222-4222-8222-222222222222';
const CC_OK = '33333333-3333-4333-8333-333333333333';
const CC_NEG = '44444444-4444-4444-8444-444444444444';
const CC_ZERO = '55555555-5555-4555-8555-555555555555';
const CC_NAN = '66666666-6666-4666-8666-666666666666';
const CC_INF = '77777777-7777-4777-8777-777777777777';
const CC_BAD = '88888888-8888-4888-8888-888888888888';

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
        { clientConfigId: CC1, bytes: 100 },
        { clientConfigId: CC2, bytes: 250 },
      ]),
      [
        { clientConfigId: CC1, bytes: 100 },
        { clientConfigId: CC2, bytes: 250 },
      ],
    );
  });

  it('ignores bad rows: non-positive, non-finite, non-string/empty id', () => {
    assert.deepEqual(
      normalizeUsageDeltas([
        { clientConfigId: CC_OK, bytes: 500 },
        { clientConfigId: CC_NEG, bytes: -10 },
        { clientConfigId: CC_ZERO, bytes: 0 },
        { clientConfigId: CC_NAN, bytes: Number.NaN },
        { clientConfigId: CC_INF, bytes: Number.POSITIVE_INFINITY },
        { clientConfigId: '', bytes: 100 },
        { clientConfigId: 42, bytes: 100 },
      ]),
      [{ clientConfigId: CC_OK, bytes: 500 }],
    );
  });

  it('floors fractional bytes and caps a single delta at MAX_USAGE_DELTA_BYTES (1 TB)', () => {
    assert.deepEqual(normalizeUsageDeltas([{ clientConfigId: CC1, bytes: 123.9 }]), [
      { clientConfigId: CC1, bytes: 123 },
    ]);
    assert.deepEqual(normalizeUsageDeltas([{ clientConfigId: CC1, bytes: 5 * MAX_USAGE_DELTA_BYTES }]), [
      { clientConfigId: CC1, bytes: MAX_USAGE_DELTA_BYTES },
    ]);
    assert.equal(MAX_USAGE_DELTA_BYTES, 1_000_000_000_000);
  });

  it('drops non-uuid ids so Postgres never throws mid-batch (rows before it would already be applied)', () => {
    assert.deepEqual(
      normalizeUsageDeltas([
        { clientConfigId: CC1, bytes: 100 },
        { clientConfigId: 'cc-1', bytes: 100 },
        { clientConfigId: `${CC2}'; --`, bytes: 100 },
        { clientConfigId: CC2.toUpperCase(), bytes: 7 },
      ]),
      [
        { clientConfigId: CC1, bytes: 100 },
        { clientConfigId: CC2.toUpperCase(), bytes: 7 },
      ],
    );
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
      { clientConfigId: CC1, bytes: 100 },
      { clientConfigId: CC_BAD, bytes: -1 },
      { clientConfigId: CC2, bytes: 5 * MAX_USAGE_DELTA_BYTES },
    ]);

    let applied = 0;
    for (const d of deltas) {
      if ((await applyUsageDelta(executor, d.clientConfigId, d.bytes)) > 0) applied += 1;
    }

    assert.equal(applied, 2);
    assert.equal(executor.calls.length, 2, 'the negative row was dropped before any query');
    assert.deepEqual(executor.calls[0].values, [CC1, 100]);
    assert.deepEqual(executor.calls[1].values, [CC2, MAX_USAGE_DELTA_BYTES]);
  });

  it('an unknown clientConfigId is a no-op (0 rows → not counted)', async () => {
    const executor = createFakeExecutor([{ rows: [] }]);
    const rows = await applyUsageDelta(executor, 'ghost', 100);
    assert.equal(rows, 0);
  });
});

describe('EdgeService.applyUsage (POST /api/edge/de/usage) is all-or-nothing', { skip: bundledSkipReason }, () => {
  type EdgeServiceCtor = new (db: unknown) => { applyUsage(deltas: unknown[]): Promise<number> };
  const { EdgeService } = loadBundled<{ EdgeService: EdgeServiceCtor }>('edge/edge.service.ts', { quiet: true });

  it('applies every delta through ONE transaction executor, in id order', async () => {
    const db = createFakeDatabase([{ rows: [{}] }, { rows: [{}] }]);
    let transactions = 0;
    let pooledQueries = 0;
    const service = new EdgeService({
      transaction: (cb: Parameters<typeof db.transaction>[0]) => {
        transactions += 1;
        return db.transaction(cb);
      },
      query: () => {
        pooledQueries += 1;
        throw new Error('must not bypass the transaction');
      },
    });
    const applied = await service.applyUsage([
      { clientConfigId: CC2, bytes: 5 },
      { clientConfigId: 'not-a-uuid', bytes: 9 },
      { clientConfigId: CC1, bytes: 3 },
    ]);
    assert.equal(applied, 2);
    assert.equal(transactions, 1);
    assert.equal(pooledQueries, 0);
    assert.deepEqual(db.executor.calls.map((c) => c.values), [[CC1, 3], [CC2, 5]]);
  });

  it('a failure part-way rejects the request (transaction rolls back; agent retries the batch)', async () => {
    const db = createFakeDatabase([
      { rows: [{}] },
      () => {
        throw new Error('deadlock detected');
      },
    ]);
    const service = new EdgeService({ transaction: db.transaction });
    await assert.rejects(
      service.applyUsage([
        { clientConfigId: CC1, bytes: 1 },
        { clientConfigId: CC2, bytes: 1 },
      ]),
      /deadlock/,
    );
  });

  it('an empty/invalid batch opens no transaction', async () => {
    let transactions = 0;
    const service = new EdgeService({
      transaction: () => {
        transactions += 1;
        return Promise.resolve(0);
      },
    });
    assert.equal(await service.applyUsage([{ clientConfigId: 'x', bytes: 1 }]), 0);
    assert.equal(transactions, 0);
  });
});
