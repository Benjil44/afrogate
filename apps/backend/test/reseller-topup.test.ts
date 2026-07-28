import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  approveResellerTopupInTransaction,
  rejectResellerTopupInTransaction,
  resellerTopupReference,
} from '../src/billing/reseller-topup.ts';
import { createFakeExecutor } from './helpers/fake-db.ts';

describe('approveResellerTopupInTransaction (credit wallet + set status)', () => {
  it('credits the reseller wallet by the requested amount and links the ledger entry', async () => {
    const executor = createFakeExecutor([
      // lock the request
      { rows: [{ id: 'req-1', status: 'pending', resellerAccountId: 'res-1', amount: 5_000_000, currency: 'toman' }] },
      // lock the reseller account
      { rows: [{ status: 'active', currency: 'toman', balanceAmount: 1_000_000, creditLimitAmount: 0 }] },
      { rows: [] }, // UPDATE reseller_accounts balance
      { rows: [{ id: 'ledger-9' }] }, // INSERT reseller_wallet_ledger
      { rows: [] }, // UPDATE reseller_wallet_topup_requests
    ]);

    const outcome = await approveResellerTopupInTransaction(executor, 'req-1', { reviewer: 'superadmin' });

    // 1,000,000 existing balance + 5,000,000 top-up = 6,000,000.
    assert.equal(outcome.amount, 5_000_000);
    assert.equal(outcome.balanceBeforeAmount, 1_000_000);
    assert.equal(outcome.balanceAfterAmount, 6_000_000);
    assert.equal(outcome.walletLedgerId, 'ledger-9');
    assert.equal(outcome.reference, resellerTopupReference('req-1'));

    const balanceUpdate = executor.calls.find((c) => /UPDATE reseller_accounts/.test(c.text));
    assert.ok(balanceUpdate);
    assert.equal(balanceUpdate.values[0], 6_000_000); // new balance
    assert.equal(balanceUpdate.values[2], 'res-1');

    const ledgerInsert = executor.calls.find((c) => /INSERT INTO reseller_wallet_ledger/.test(c.text));
    assert.ok(ledgerInsert);
    assert.match(ledgerInsert.text, /'topup'/);
    assert.equal(ledgerInsert.values[1], 5_000_000); // amount credited (positive)
    assert.equal(ledgerInsert.values[2], 1_000_000); // balance_before
    assert.equal(ledgerInsert.values[3], 6_000_000); // balance_after

    const statusUpdate = executor.calls.find((c) => /UPDATE reseller_wallet_topup_requests/.test(c.text));
    assert.ok(statusUpdate);
    assert.match(statusUpdate.text, /status = 'approved'/);
    assert.equal(statusUpdate.values[3], 'ledger-9'); // wallet_ledger_id linked back
  });

  it('refuses to approve a request that is not pending (no credit)', async () => {
    const executor = createFakeExecutor([
      { rows: [{ id: 'req-1', status: 'approved', resellerAccountId: 'res-1', amount: 5_000_000, currency: 'toman' }] },
    ]);

    await assert.rejects(
      approveResellerTopupInTransaction(executor, 'req-1', { reviewer: 'superadmin' }),
      ConflictException,
    );
    assert.equal(executor.calls.length, 1, 'only the lock ran; wallet was not touched');
    assert.equal(executor.calls.some((c) => /UPDATE reseller_accounts/.test(c.text)), false);
  });

  it('throws when the request does not exist', async () => {
    const executor = createFakeExecutor([{ rows: [] }]);
    await assert.rejects(
      approveResellerTopupInTransaction(executor, 'missing', { reviewer: 'superadmin' }),
      NotFoundException,
    );
  });
});

describe('rejectResellerTopupInTransaction (set status only, never credits)', () => {
  it('marks the request rejected with the reason and never touches the wallet', async () => {
    const executor = createFakeExecutor([
      { rows: [{ id: 'req-1', status: 'pending', resellerAccountId: 'res-1', amount: 5_000_000, currency: 'toman' }] },
      { rows: [] }, // UPDATE -> rejected
    ]);

    const outcome = await rejectResellerTopupInTransaction(executor, 'req-1', {
      reviewer: 'superadmin',
      reason: 'blurry receipt',
    });

    assert.equal(outcome.reason, 'blurry receipt');
    const update = executor.calls.find((c) => /UPDATE reseller_wallet_topup_requests/.test(c.text));
    assert.ok(update);
    assert.match(update.text, /status = 'rejected'/);
    assert.equal(executor.calls.some((c) => /reseller_wallet_ledger/.test(c.text)), false);
    assert.equal(executor.calls.some((c) => /UPDATE reseller_accounts/.test(c.text)), false);
  });

  it('refuses to reject an already-finalized request', async () => {
    const executor = createFakeExecutor([
      { rows: [{ id: 'req-1', status: 'rejected', resellerAccountId: 'res-1', amount: 5_000_000, currency: 'toman' }] },
    ]);
    await assert.rejects(
      rejectResellerTopupInTransaction(executor, 'req-1', { reviewer: 'superadmin', reason: 'x' }),
      ConflictException,
    );
    assert.equal(executor.calls.length, 1);
  });
});
