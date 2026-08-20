import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { approveTopupInTransaction } from '../src/telegram/telegram-topup.ts';
import { createFakeExecutor } from './helpers/fake-db.ts';

// Mirrors quota-math.computeAllocatedQuotaLimitBytes.
const computeQuotaAfter = (before: number | null, used: number, volume: number): number => (before ?? used) + volume;

const pendingRequest = {
  id: 'req-1',
  status: 'pending',
  customerAccountId: 'buyer-1',
  telegramId: '555',
  telegramChatId: 'chat-buyer',
  volumePackageId: 'pkg-1',
  amountMinor: 50_000,
  currency: 'toman',
};

describe('approveTopupInTransaction — referral commission', () => {
  it('credits the inviter 20% of the purchased GB in gems and returns their contact', async () => {
    const executor = createFakeExecutor([
      { rows: [pendingRequest] }, // lock request
      { rows: [{ name: '20 GB', volumeBytes: 20_000_000_000 }] }, // lock package
      { rows: [{ quotaLimitBytes: 0, usedBytes: 0, referredBy: 'inviter-1' }] }, // lock account (referred!)
      { rows: [] }, // UPDATE customer_accounts quota
      { rows: [] }, // earnGems ledger insert (commission)
      { rows: [{ gemsBalance: 400 }] }, // earnGems update RETURNING
      { rows: [{ telegramId: '999', telegramChatId: 'chat-inviter' }] }, // inviter contact
      { rows: [] }, // UPDATE telegram_topup_requests
    ]);

    const outcome = await approveTopupInTransaction(executor, 'req-1', {
      reviewer: 'admin',
      computeQuotaAfter,
      gemEconomy: { referralPurchasePct: 20, gemRedeemPerGb: 100 },
    });

    // 20 GB × 20% = 4 GB → 400 gems at 100 gems/GB.
    assert.ok(outcome.commission);
    assert.equal(outcome.commission?.gems, 400);
    assert.equal(outcome.commission?.inviterAccountId, 'inviter-1');
    assert.equal(outcome.commission?.inviterTelegramChatId, 'chat-inviter');
    assert.equal(outcome.commission?.inviterGemsBalance, 400);
    assert.equal(outcome.commission?.pct, 20);

    const ledger = executor.calls.find((c) => /INSERT INTO gems_ledger/.test(c.text));
    assert.ok(ledger);
    assert.match(ledger.text, /'referral_commission'/);
    assert.deepEqual(ledger.values, ['inviter-1', 400, 'req-1']);
  });

  it('skips the commission when the buyer has no inviter', async () => {
    const executor = createFakeExecutor([
      { rows: [pendingRequest] }, // lock request
      { rows: [{ name: '20 GB', volumeBytes: 20_000_000_000 }] }, // lock package
      { rows: [{ quotaLimitBytes: 0, usedBytes: 0, referredBy: null }] }, // no inviter
      { rows: [] }, // UPDATE quota
      { rows: [] }, // UPDATE status
    ]);

    const outcome = await approveTopupInTransaction(executor, 'req-1', {
      reviewer: 'admin',
      computeQuotaAfter,
      gemEconomy: { referralPurchasePct: 20, gemRedeemPerGb: 100 },
    });

    assert.equal(outcome.commission, null);
    assert.equal(executor.calls.some((c) => /gems_ledger/.test(c.text)), false, 'no gem ledger write');
  });
});
