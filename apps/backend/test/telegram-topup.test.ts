import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException } from '@nestjs/common';
import {
  approveTopupInTransaction,
  createPendingTopupInTransaction,
  rejectTopupInTransaction,
  resolveTrialQuotaBytes,
  topupReference,
} from '../src/telegram/telegram-topup.ts';
import { createFakeExecutor } from './helpers/fake-db.ts';

// Mirrors quota-math.computeAllocatedQuotaLimitBytes — the function production
// injects into approveTopupInTransaction (a null limit is treated as the used
// baseline so a top-up only grants the purchased headroom).
const computeQuotaAfter = (before: number | null, used: number, volume: number): number =>
  (before ?? used) + volume;

describe('resolveTrialQuotaBytes', () => {
  it('defaults to 1 GB decimal (1e9) when unset', () => {
    assert.equal(resolveTrialQuotaBytes(null), 1_000_000_000);
    assert.equal(resolveTrialQuotaBytes(undefined), 1_000_000_000);
  });

  it('uses a valid configured value and rejects invalid ones', () => {
    assert.equal(resolveTrialQuotaBytes(2_000_000_000), 2_000_000_000);
    assert.equal(resolveTrialQuotaBytes(-5), 1_000_000_000);
  });
});

describe('createPendingTopupInTransaction (photo -> pending topup row)', () => {
  it('inserts a pending request carrying the receipt file_id and returns its reference', async () => {
    const executor = createFakeExecutor([
      // account snapshot read (C4): used / quota / cycle anchor / expiry / lapse / lockout / latest-paid
      {
        rows: [
          {
            usedBytes: 1_000_000_000,
            quotaLimitBytes: 5_000_000_000,
            cycleStartUsedBytes: 0,
            expiresAt: null,
            lapsedAt: null,
            graceBlockedUntil: null,
            latestPaidVolumeBytes: null,
          },
        ],
      },
      { rows: [{ id: 'abc123def456' }] }, // INSERT RETURNING
    ]);

    const result = await createPendingTopupInTransaction(executor, {
      customerAccountId: 'acct-1',
      telegramId: '555',
      telegramChatId: 'chat-1',
      volumePackageId: 'pkg-1',
      amountMinor: 90_000,
      currency: 'toman',
      receiptFileId: 'PHOTO_ID',
    });

    assert.equal(result.id, 'abc123def456');
    assert.equal(result.reference, topupReference('abc123def456'));

    const insert = executor.calls.find((c) => /INSERT INTO telegram_topup_requests/.test(c.text))!;
    assert.ok(insert);
    assert.match(insert.text, /'pending'/);
    // receipt_file_id is bound as the 7th parameter; resellerAccountId the 8th; then snap_* (C4).
    assert.equal(insert.values[6], 'PHOTO_ID');
    assert.deepEqual(insert.values.slice(0, 8), ['acct-1', '555', 'chat-1', 'pkg-1', 90_000, 'toman', 'PHOTO_ID', null]);
    // snapshot params: used, quota, cycleStart, expiresAt, lapsedAt.
    assert.equal(insert.values[8], 1_000_000_000);
    assert.equal(insert.values[9], 5_000_000_000);

    // Capped receipt grace (migrations 0068/0070): the upload sets the account's 24h grace + cap.
    const grace = executor.calls.find((c) => /UPDATE customer_accounts/.test(c.text) && /grace_until/.test(c.text))!;
    assert.ok(grace, 'receipt upload sets the 24h grace');
    assert.match(grace.text, /GREATEST/);
    assert.match(grace.text, /grace_cap_bytes/);
    assert.equal(grace.values[0], 'acct-1');
    assert.equal(grace.values[2], 500_000_000); // cap = 10% of 5 GB plan
  });

  it('stamps resellerAccountId (Phase 4: routes a seller-owned customer\'s receipt to their seller)', async () => {
    const executor = createFakeExecutor([
      {
        rows: [
          {
            usedBytes: 0,
            quotaLimitBytes: 5_000_000_000,
            cycleStartUsedBytes: 0,
            expiresAt: null,
            lapsedAt: null,
            graceBlockedUntil: null,
            latestPaidVolumeBytes: null,
          },
        ],
      },
      { rows: [{ id: 'abc123def456' }] },
    ]);

    await createPendingTopupInTransaction(executor, {
      customerAccountId: 'acct-1',
      telegramId: '555',
      telegramChatId: 'chat-1',
      volumePackageId: 'pkg-1',
      amountMinor: 90_000,
      currency: 'toman',
      receiptFileId: 'PHOTO_ID',
      resellerAccountId: 'reseller-1',
    });

    const insert = executor.calls.find((c) => /INSERT INTO telegram_topup_requests/.test(c.text))!;
    assert.match(insert.text, /reseller_account_id/);
    assert.equal(insert.values[7], 'reseller-1');
  });
});

describe('approveTopupInTransaction (credit quota + set status)', () => {
  it('credits the account by the package volume (reusing the allocation math) and marks approved', async () => {
    const executor = createFakeExecutor([
      {
        rows: [
          {
            id: 'req-1',
            status: 'pending',
            customerAccountId: 'acct-1',
            telegramId: '555',
            telegramChatId: 'chat-1',
            volumePackageId: 'pkg-1',
            amountMinor: 50_000,
            currency: 'toman',
          },
        ],
      }, // lock request
      { rows: [{ name: '20 GB', volumeBytes: 20_000_000_000 }] }, // lock package
      { rows: [{ quotaLimitBytes: 1_000_000_000, usedBytes: 200_000_000 }] }, // lock account
      { rows: [] }, // UPDATE customer_accounts
      { rows: [] }, // UPDATE telegram_topup_requests
    ]);

    const outcome = await approveTopupInTransaction(executor, 'req-1', {
      reviewer: 'admin@afrows',
      computeQuotaAfter,
    });

    // 1,000,000,000 existing limit + 20,000,000,000 package = 21,000,000,000 bytes.
    assert.equal(outcome.quotaLimitBeforeBytes, 1_000_000_000);
    assert.equal(outcome.quotaLimitAfterBytes, 21_000_000_000);
    assert.equal(outcome.volumeBytes, 20_000_000_000);
    assert.equal(outcome.telegramChatId, 'chat-1');
    assert.equal(outcome.packageName, '20 GB');

    const accountUpdate = executor.calls.find((c) => /UPDATE customer_accounts/.test(c.text));
    assert.ok(accountUpdate);
    assert.deepEqual(accountUpdate.values, [21_000_000_000, 'acct-1']);

    const statusUpdate = executor.calls.find((c) => /UPDATE telegram_topup_requests/.test(c.text));
    assert.ok(statusUpdate);
    assert.match(statusUpdate.text, /status = 'approved'/);
    assert.equal(statusUpdate.values[0], 'req-1');
    assert.equal(statusUpdate.values[1], 'admin@afrows');

    // Receipt grace (migration 0068): approve recomputes grace from any remaining
    // open receipts (clears it when none remain) rather than blindly nulling.
    const grace = executor.calls.find((c) => /UPDATE customer_accounts/.test(c.text) && /grace_until/.test(c.text));
    assert.ok(grace, 'approve recomputes the receipt grace');
    assert.match(grace.text, /status = 'pending'/);
  });

  it('refuses to approve a request that is not pending (no credit)', async () => {
    const executor = createFakeExecutor([
      {
        rows: [
          {
            id: 'req-1',
            status: 'approved',
            customerAccountId: 'acct-1',
            telegramId: '555',
            telegramChatId: 'chat-1',
            volumePackageId: 'pkg-1',
            amountMinor: 50_000,
            currency: 'toman',
          },
        ],
      },
    ]);

    await assert.rejects(
      approveTopupInTransaction(executor, 'req-1', { reviewer: 'admin', computeQuotaAfter }),
      ConflictException,
    );
    assert.equal(executor.calls.length, 1, 'only the lock ran; quota was not touched');
    assert.equal(executor.calls.some((c) => /UPDATE customer_accounts/.test(c.text)), false);
  });
});

describe('rejectTopupInTransaction (set status only)', () => {
  it('marks the request rejected with the reason and never credits quota', async () => {
    const executor = createFakeExecutor([
      {
        rows: [
          {
            id: 'req-1',
            status: 'pending',
            customerAccountId: 'acct-1',
            telegramId: '555',
            telegramChatId: 'chat-1',
            volumePackageId: 'pkg-1',
            amountMinor: null,
            currency: null,
          },
        ],
      }, // lock request
      { rows: [] }, // UPDATE -> rejected
    ]);

    const outcome = await rejectTopupInTransaction(executor, 'req-1', {
      reviewer: 'admin',
      reason: 'blurry receipt',
    });

    assert.equal(outcome.telegramChatId, 'chat-1');
    assert.equal(outcome.reason, 'blurry receipt');

    const update = executor.calls.find((c) => /UPDATE telegram_topup_requests/.test(c.text));
    assert.ok(update);
    assert.match(update.text, /status = 'rejected'/);
    assert.deepEqual(update.values, ['req-1', 'admin', 'blurry receipt']);

    // Never credits quota; it DOES recompute the receipt grace (migration 0068).
    assert.equal(
      executor.calls.some((c) => /UPDATE customer_accounts/.test(c.text) && /quota_limit_bytes/.test(c.text)),
      false,
      'quota is never credited on reject',
    );
    const grace = executor.calls.find((c) => /UPDATE customer_accounts/.test(c.text) && /grace_until/.test(c.text));
    assert.ok(grace, 'reject recomputes the receipt grace');
    // penalize defaults true → a 30-day grace lockout is applied (values: [accountId, lockUntil]).
    assert.equal(grace.values[0], 'acct-1');
    assert.match(grace.text, /grace_blocked_until/);
  });

  it('refuses to reject an already-finalized request', async () => {
    const executor = createFakeExecutor([
      {
        rows: [
          {
            id: 'req-1',
            status: 'approved',
            customerAccountId: 'acct-1',
            telegramId: '555',
            telegramChatId: 'chat-1',
            volumePackageId: 'pkg-1',
            amountMinor: null,
            currency: null,
          },
        ],
      },
    ]);

    await assert.rejects(
      rejectTopupInTransaction(executor, 'req-1', { reviewer: 'admin', reason: 'x' }),
      ConflictException,
    );
    assert.equal(executor.calls.length, 1);
  });
});
