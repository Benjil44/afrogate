import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { mergeCustomerAccountInTransaction } from '../src/billing/customer-account-merge.ts';
import { createFakeExecutor } from './helpers/fake-db.ts';

const SOURCE = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';

/** A locked-row payload for the initial `SELECT ... IN ($1,$2) FOR UPDATE`. */
function lockRows(
  overrides: {
    source?: Partial<Record<string, unknown>>;
    target?: Partial<Record<string, unknown>>;
    omitSource?: boolean;
    omitTarget?: boolean;
  } = {},
) {
  const source = {
    id: SOURCE,
    deletedAt: null,
    quotaLimitBytes: null,
    usedBytes: 0,
    gemsBalance: 0,
    telegramId: null,
    telegramUsername: null,
    phone: null,
    ...overrides.source,
  };
  const target = {
    id: TARGET,
    deletedAt: null,
    quotaLimitBytes: null,
    usedBytes: 0,
    gemsBalance: 0,
    telegramId: null,
    telegramUsername: null,
    phone: null,
    ...overrides.target,
  };
  const rows: unknown[] = [];
  if (!overrides.omitSource) rows.push(source);
  if (!overrides.omitTarget) rows.push(target);
  return { rows };
}

/** Tail responses (after the lock) for the non-gems, no-config, no-referral path. */
const NO_ASSET_TAIL = [
  { rows: [] }, // quota UPDATE (skipped when unlimited/empty, but harmless if consumed)
  { rows: [{ count: 0 }] }, // wg peer count
  { rows: [] }, // client_configs UPDATE
  { rows: [] }, // source telegram/phone NULL
  { rows: [] }, // target identity UPDATE (only if identity changed)
  { rows: [] }, // referral re-point
  { rows: [] }, // archive source
];

describe('mergeCustomerAccountInTransaction — validation', () => {
  it('rejects a self-merge before touching the database', async () => {
    const executor = createFakeExecutor([]);
    await assert.rejects(
      mergeCustomerAccountInTransaction(executor, SOURCE, SOURCE, async () => {}),
      BadRequestException,
    );
    assert.equal(executor.calls.length, 0);
  });

  it('throws NotFound when the source does not exist', async () => {
    const executor = createFakeExecutor([lockRows({ omitSource: true })]);
    let audited = false;
    await assert.rejects(
      mergeCustomerAccountInTransaction(executor, SOURCE, TARGET, async () => {
        audited = true;
      }),
      NotFoundException,
    );
    assert.equal(audited, false);
    assert.equal(executor.calls.length, 1); // only the lock ran
  });

  it('throws NotFound when the target does not exist', async () => {
    const executor = createFakeExecutor([lockRows({ omitTarget: true })]);
    await assert.rejects(
      mergeCustomerAccountInTransaction(executor, SOURCE, TARGET, async () => {}),
      NotFoundException,
    );
  });

  it('rejects merging away an already-archived source', async () => {
    const executor = createFakeExecutor([lockRows({ source: { deletedAt: '2026-07-24T00:00:00Z' } })]);
    let audited = false;
    await assert.rejects(
      mergeCustomerAccountInTransaction(executor, SOURCE, TARGET, async () => {
        audited = true;
      }),
      BadRequestException,
    );
    assert.equal(audited, false);
    assert.equal(executor.calls.length, 1);
  });

  it('locks both rows in one FOR UPDATE statement bound by id', async () => {
    const executor = createFakeExecutor([lockRows(), ...NO_ASSET_TAIL]);
    await mergeCustomerAccountInTransaction(executor, SOURCE, TARGET, async () => {});
    assert.match(executor.calls[0].text, /WHERE id IN \(\$1, \$2\)[\s\S]*FOR UPDATE/);
    assert.deepEqual(executor.calls[0].values, [SOURCE, TARGET]);
  });
});

describe('mergeCustomerAccountInTransaction — remaining GB', () => {
  it('adds max(0, limit-used) of the finite source to a finite target', async () => {
    // source: 20 GB limit, 5 GB used -> 15 GB remaining. target: 10 GB limit, 2 GB used.
    const executor = createFakeExecutor([
      lockRows({
        source: { quotaLimitBytes: 20_000_000_000, usedBytes: 5_000_000_000 },
        target: { quotaLimitBytes: 10_000_000_000, usedBytes: 2_000_000_000 },
      }),
      { rows: [] }, // quota UPDATE
      { rows: [{ count: 0 }] }, // wg peer count
      { rows: [] }, // configs UPDATE
      { rows: [] }, // source identity NULL
      { rows: [] }, // referral re-point
      { rows: [] }, // archive
    ]);
    const outcome = await mergeCustomerAccountInTransaction(executor, SOURCE, TARGET, async () => {});
    assert.equal(outcome.bytesMoved, 15_000_000_000);
    assert.equal(outcome.gbMoved, 15);
    assert.equal(outcome.sourceQuotaUnlimited, false);
    assert.equal(outcome.targetQuotaUnlimited, false);

    const quotaUpdate = executor.calls.find(
      (c) => /UPDATE customer_accounts SET quota_limit_bytes/.test(c.text),
    );
    assert.ok(quotaUpdate, 'target quota must be updated');
    // 10 GB target limit + 15 GB remaining = 25 GB.
    assert.deepEqual(quotaUpdate.values, [TARGET, 25_000_000_000]);
  });

  it('never moves negative GB when the source is over quota', async () => {
    const executor = createFakeExecutor([
      lockRows({
        source: { quotaLimitBytes: 5_000_000_000, usedBytes: 9_000_000_000 },
        target: { quotaLimitBytes: 10_000_000_000, usedBytes: 0 },
      }),
      ...NO_ASSET_TAIL,
    ]);
    const outcome = await mergeCustomerAccountInTransaction(executor, SOURCE, TARGET, async () => {});
    assert.equal(outcome.bytesMoved, 0);
    assert.equal(outcome.gbMoved, 0);
    assert.equal(
      executor.calls.some((c) => /UPDATE customer_accounts SET quota_limit_bytes/.test(c.text)),
      false,
      'no quota UPDATE when nothing to move',
    );
  });

  it('skips the GB move when the source is unlimited (null), noting it', async () => {
    const executor = createFakeExecutor([
      lockRows({ source: { quotaLimitBytes: null }, target: { quotaLimitBytes: 10_000_000_000 } }),
      ...NO_ASSET_TAIL,
    ]);
    const outcome = await mergeCustomerAccountInTransaction(executor, SOURCE, TARGET, async () => {});
    assert.equal(outcome.sourceQuotaUnlimited, true);
    assert.equal(outcome.bytesMoved, 0);
    assert.equal(
      executor.calls.some((c) => /UPDATE customer_accounts SET quota_limit_bytes/.test(c.text)),
      false,
    );
  });

  it('keeps the target unlimited (no quota write) even when the source has remaining GB', async () => {
    const executor = createFakeExecutor([
      lockRows({
        source: { quotaLimitBytes: 20_000_000_000, usedBytes: 0 },
        target: { quotaLimitBytes: null },
      }),
      ...NO_ASSET_TAIL,
    ]);
    const outcome = await mergeCustomerAccountInTransaction(executor, SOURCE, TARGET, async () => {});
    assert.equal(outcome.targetQuotaUnlimited, true);
    assert.equal(outcome.bytesMoved, 20_000_000_000); // computed, but not applied to an unlimited target
    assert.equal(
      executor.calls.some((c) => /UPDATE customer_accounts SET quota_limit_bytes/.test(c.text)),
      false,
      'an unlimited target is never narrowed to a finite limit',
    );
  });
});

describe('mergeCustomerAccountInTransaction — gems', () => {
  it('credits the target and zeroes the source with signed merge ledger rows', async () => {
    const executor = createFakeExecutor([
      lockRows({ source: { gemsBalance: 250 } }),
      { rows: [] }, // credit target ledger insert
      { rows: [] }, // credit target balance
      { rows: [] }, // debit source ledger insert
      { rows: [] }, // zero source balance
      { rows: [{ count: 0 }] }, // wg peer count
      { rows: [] }, // configs
      { rows: [] }, // source identity NULL
      { rows: [] }, // referral
      { rows: [] }, // archive
    ]);
    const outcome = await mergeCustomerAccountInTransaction(executor, SOURCE, TARGET, async () => {});
    assert.equal(outcome.gemsMoved, 250);

    const ledgerInserts = executor.calls.filter((c) => /INSERT INTO gems_ledger/.test(c.text));
    assert.equal(ledgerInserts.length, 2);
    // +250 credited to the target, ref = source.
    assert.deepEqual(ledgerInserts[0].values, [TARGET, 250, 'merge', SOURCE]);
    // -250 debited from the source, ref = target.
    assert.deepEqual(ledgerInserts[1].values, [SOURCE, -250, 'merge', TARGET]);

    const zeroSource = executor.calls.find((c) => /SET gems_balance = 0/.test(c.text));
    assert.ok(zeroSource, 'source balance must be zeroed');
    assert.deepEqual(zeroSource.values, [SOURCE]);

    const creditTarget = executor.calls.find((c) => /SET gems_balance = gems_balance \+ \$2/.test(c.text));
    assert.ok(creditTarget, 'target balance must be credited');
    assert.deepEqual(creditTarget.values, [TARGET, 250]);
  });

  it('writes no gems rows when the source balance is zero', async () => {
    const executor = createFakeExecutor([lockRows({ source: { gemsBalance: 0 } }), ...NO_ASSET_TAIL]);
    const outcome = await mergeCustomerAccountInTransaction(executor, SOURCE, TARGET, async () => {});
    assert.equal(outcome.gemsMoved, 0);
    assert.equal(
      executor.calls.some((c) => /INSERT INTO gems_ledger|SET gems_balance/.test(c.text)),
      false,
    );
  });
});

describe('mergeCustomerAccountInTransaction — configs + wg peers', () => {
  it('reassigns the source configs to the target and reports moved wg peers', async () => {
    const executor = createFakeExecutor([
      lockRows(),
      { rows: [{ count: 3 }] }, // wg peer count (BEFORE reassign, bound to source)
      { rows: [{}, {}] }, // client_configs UPDATE affected 2 rows
      { rows: [] }, // source identity NULL
      { rows: [] }, // referral
      { rows: [] }, // archive
    ]);
    const outcome = await mergeCustomerAccountInTransaction(executor, SOURCE, TARGET, async () => {});
    assert.equal(outcome.configsMoved, 2);
    assert.equal(outcome.wgPeersMoved, 3);

    const peerCount = executor.calls.find((c) => /FROM wireguard_peers wp/.test(c.text));
    assert.ok(peerCount, 'wg peers counted');
    assert.deepEqual(peerCount.values, [SOURCE]); // counted on the source, before reassign

    const configUpdate = executor.calls.find((c) => /UPDATE client_configs SET customer_account_id/.test(c.text));
    assert.ok(configUpdate, 'configs reassigned');
    assert.deepEqual(configUpdate.values, [SOURCE, TARGET]);

    // Peers are counted BEFORE the configs are reassigned away from the source.
    const idxCount = executor.calls.findIndex((c) => /FROM wireguard_peers wp/.test(c.text));
    const idxReassign = executor.calls.findIndex((c) => /UPDATE client_configs SET customer_account_id/.test(c.text));
    assert.ok(idxCount < idxReassign);
  });
});

describe('mergeCustomerAccountInTransaction — telegram + phone', () => {
  it('moves telegram/phone into a target that lacks them, nulling the source first', async () => {
    const executor = createFakeExecutor([
      lockRows({
        source: { telegramId: '555', telegramUsername: 'ramin', phone: '+989120000000' },
        target: { telegramId: null, telegramUsername: null, phone: null },
      }),
      { rows: [{ count: 0 }] }, // wg peer count
      { rows: [] }, // configs
      { rows: [] }, // source identity NULL
      { rows: [] }, // target identity UPDATE
      { rows: [] }, // referral
      { rows: [] }, // archive
    ]);
    await mergeCustomerAccountInTransaction(executor, SOURCE, TARGET, async () => {});

    const nullSource = executor.calls.find((c) => /SET telegram_id = NULL/.test(c.text));
    assert.ok(nullSource, 'source telegram/phone nulled');
    assert.deepEqual(nullSource.values, [SOURCE]);

    const setTarget = executor.calls.find((c) => /SET telegram_id = \$2/.test(c.text));
    assert.ok(setTarget, 'target identity set');
    assert.deepEqual(setTarget.values, [TARGET, '555', 'ramin', '+989120000000']);

    // Source is nulled BEFORE the target claims the (unique) telegram_id.
    const idxNull = executor.calls.findIndex((c) => /SET telegram_id = NULL/.test(c.text));
    const idxSet = executor.calls.findIndex((c) => /SET telegram_id = \$2/.test(c.text));
    assert.ok(idxNull < idxSet, 'source released before target claims');
  });

  it('does NOT overwrite identity the target already has (keeps target, only nulls source)', async () => {
    const executor = createFakeExecutor([
      lockRows({
        source: { telegramId: '555', telegramUsername: 'ramin', phone: '+989120000000' },
        target: { telegramId: '999', telegramUsername: 'real', phone: '+989350000000' },
      }),
      { rows: [{ count: 0 }] }, // wg peer count
      { rows: [] }, // configs
      { rows: [] }, // source identity NULL
      { rows: [] }, // referral (NO target identity UPDATE this time)
      { rows: [] }, // archive
    ]);
    await mergeCustomerAccountInTransaction(executor, SOURCE, TARGET, async () => {});

    assert.ok(
      executor.calls.some((c) => /SET telegram_id = NULL/.test(c.text)),
      'source is still released',
    );
    assert.equal(
      executor.calls.some((c) => /SET telegram_id = \$2/.test(c.text)),
      false,
      'target keeps its own telegram/phone — no identity overwrite',
    );
  });
});

describe('mergeCustomerAccountInTransaction — referrals + archive', () => {
  it('re-points referred_by from source to target (excluding the target itself)', async () => {
    const executor = createFakeExecutor([
      lockRows(),
      { rows: [{ count: 0 }] }, // wg peer count
      { rows: [] }, // configs
      { rows: [] }, // source identity NULL
      { rows: [{}, {}, {}] }, // referral re-point affected 3 rows
      { rows: [] }, // archive
    ]);
    const outcome = await mergeCustomerAccountInTransaction(executor, SOURCE, TARGET, async () => {});
    assert.equal(outcome.referralsRepointed, 3);

    const referral = executor.calls.find((c) => /SET referred_by = \$2/.test(c.text));
    assert.ok(referral, 'referrals re-pointed');
    assert.match(referral.text, /WHERE referred_by = \$1 AND id <> \$2/);
    assert.deepEqual(referral.values, [SOURCE, TARGET]);
  });

  it('archives the source (deleted_at + disabled) and audits with the movement summary', async () => {
    const executor = createFakeExecutor([
      lockRows({
        source: { quotaLimitBytes: 3_000_000_000, usedBytes: 0, gemsBalance: 40 },
        target: { quotaLimitBytes: 1_000_000_000, usedBytes: 0 },
      }),
      { rows: [] }, // quota UPDATE
      { rows: [] }, // gems credit target ledger
      { rows: [] }, // gems credit target balance
      { rows: [] }, // gems debit source ledger
      { rows: [] }, // gems zero source
      { rows: [{ count: 1 }] }, // wg peer count
      { rows: [{}] }, // configs (1 moved)
      { rows: [] }, // source identity NULL
      { rows: [] }, // referral
      { rows: [] }, // archive
    ]);
    let auditMetadata: Record<string, unknown> | null = null;
    const outcome = await mergeCustomerAccountInTransaction(executor, SOURCE, TARGET, async (metadata) => {
      auditMetadata = metadata;
    });

    const archive = executor.calls.find((c) => /SET deleted_at = now\(\), status = \$2/.test(c.text));
    assert.ok(archive, 'source archived');
    assert.deepEqual(archive.values, [SOURCE, 'disabled']);
    assert.match(archive.text, /WHERE id = \$1 AND deleted_at IS NULL/);

    // Nothing is hard-deleted (payment/quota/ad history stays on the source).
    assert.equal(
      executor.calls.some((c) => /DELETE FROM/i.test(c.text)),
      false,
    );

    assert.ok(auditMetadata, 'audit recorded');
    assert.deepEqual(auditMetadata, {
      sourceId: SOURCE,
      targetAccountId: TARGET,
      gbMoved: 3,
      gemsMoved: 40,
      configsMoved: 1,
      wgPeersMoved: 1,
      referralsRepointed: 0,
      sourceQuotaUnlimited: false,
    });
    assert.equal(outcome.gemsMoved, 40);
    assert.equal(outcome.configsMoved, 1);
  });
});
