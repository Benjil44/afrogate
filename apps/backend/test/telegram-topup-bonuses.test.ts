import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { approveTopupInTransaction } from '../src/telegram/telegram-topup.ts';
import { decideApprovalBonuses, decideEarlyRenewal } from '../src/billing/approval-bonuses.ts';
import { createFakeExecutor } from './helpers/fake-db.ts';

const GB = 1_000_000_000;
const NOW = new Date('2026-11-13T00:00:00.000Z');
const computeQuotaAfter = (before: number | null, used: number, volume: number): number => (before ?? used) + volume;
const deciders = { decideEarlyRenewal, decideApprovalBonuses };

/** A pending request with a fresh upload snapshot (new account, referred, 20 GB buy). */
const request = {
  id: 'req-1',
  status: 'pending',
  customerAccountId: 'buyer-1',
  telegramId: '555',
  telegramChatId: 'chat-1',
  volumePackageId: 'pkg-1',
  amountMinor: 50_000,
  currency: 'toman',
  resellerAccountId: null,
  createdAt: NOW,
  snapUsedBytes: 0,
  snapQuotaLimitBytes: 0,
  snapCycleStartUsedBytes: 0,
  snapExpiresAt: null,
  snapLapsedAt: null,
};

describe('approveTopupInTransaction — buyer bonuses (lever C, injected deciders)', () => {
  it('first_purchase 20% + invitee 2 GB, single quota write = base + bonuses', async () => {
    const executor = createFakeExecutor([
      { rows: [request] }, // lock request
      { rows: [{ name: '20 GB', volumeBytes: 20 * GB }] }, // lock package
      { rows: [{ quotaLimitBytes: 0, usedBytes: 0, referredBy: 'inviter-1', expiresAt: null, accountCreatedAt: NOW }] }, // lock account (new, referred)
      { rows: [{ hasPriorPaid: false }] }, // prior-paid check
      { rows: [{ has: false }] }, // winback 90d window
      { rows: [{ id: 'bg-first' }] }, // INSERT first_purchase RETURNING
      { rows: [{ id: 'bg-invitee' }] }, // INSERT invitee_referral RETURNING
      { rows: [] }, // quota UPDATE
      { rows: [] }, // resetCycle anchor
      { rows: [] }, // status UPDATE
      { rows: [] }, // grace recompute
    ]);

    const outcome = await approveTopupInTransaction(executor, 'req-1', {
      reviewer: 'admin',
      computeQuotaAfter,
      now: NOW,
      deciders,
    });

    // base 20 GB + first_purchase 4 GB + invitee 2 GB = 26 GB.
    assert.equal(outcome.quotaLimitAfterBytes, 26 * GB);
    assert.equal(outcome.bonuses.length, 2);
    assert.equal(outcome.bonuses.find((b) => b.kind === 'first_purchase')?.bonusBytes, 4 * GB);
    assert.equal(outcome.bonuses.find((b) => b.kind === 'invitee_referral')?.bonusBytes, 2 * GB);

    const inserts = executor.calls.filter((c) => /INSERT INTO bonus_grants/.test(c.text));
    assert.equal(inserts.length, 2);
    assert.match(inserts[0].text, /ON CONFLICT DO NOTHING/);

    const quotaUpdate = executor.calls.find((c) => /UPDATE customer_accounts/.test(c.text) && /quota_limit_bytes/.test(c.text));
    assert.deepEqual(quotaUpdate!.values, [26 * GB, 'buyer-1']);
  });

  it('a grant whose INSERT hits ON CONFLICT (no row) is NOT credited', async () => {
    const executor = createFakeExecutor([
      { rows: [request] },
      { rows: [{ name: '20 GB', volumeBytes: 20 * GB }] },
      { rows: [{ quotaLimitBytes: 0, usedBytes: 0, referredBy: 'inviter-1', expiresAt: null, accountCreatedAt: NOW }] },
      { rows: [{ hasPriorPaid: false }] },
      { rows: [{ has: false }] },
      { rows: [] }, // first_purchase INSERT → conflict (no row)
      { rows: [] }, // invitee INSERT → conflict (no row)
      { rows: [] }, // quota UPDATE
      { rows: [] }, // resetCycle
      { rows: [] }, // status
      { rows: [] }, // grace
    ]);

    const outcome = await approveTopupInTransaction(executor, 'req-1', { reviewer: 'admin', computeQuotaAfter, now: NOW, deciders });
    assert.equal(outcome.bonuses.length, 0);
    assert.equal(outcome.quotaLimitAfterBytes, 20 * GB); // base only
  });

  it('a prior reseller GB charge / admin volume charge disqualifies first_purchase + invitee', async () => {
    // The priorPaid query returns hasPriorPaid=true (the reseller_wallet_ledger OR
    // quota_charge_events branch matched in SQL). A new, referred account that self-pays
    // within 72h must therefore earn NO first_purchase and NO invitee bonus.
    const executor = createFakeExecutor([
      { rows: [request] },
      { rows: [{ name: '20 GB', volumeBytes: 20 * GB }] },
      { rows: [{ quotaLimitBytes: 10 * GB, usedBytes: 5 * GB, referredBy: 'inviter-1', expiresAt: null, accountCreatedAt: NOW }] },
      { rows: [{ hasPriorPaid: true }] }, // prior-paid matched (reseller ledger / quota charge)
      { rows: [{ has: false }] }, // winback 90d window
      { rows: [] }, // quota UPDATE
      { rows: [] }, // resetCycle
      { rows: [] }, // status
      { rows: [] }, // grace
    ]);

    const outcome = await approveTopupInTransaction(executor, 'req-1', { reviewer: 'admin', computeQuotaAfter, now: NOW, deciders });

    assert.equal(outcome.bonuses.length, 0, 'no first_purchase / invitee when a prior paid acquisition exists');
    assert.equal(executor.calls.some((c) => /INSERT INTO bonus_grants/.test(c.text)), false);

    // The prior-paid query must cover BOTH the reseller GB-charge ledger and the admin
    // volume-charge ledger (the two paid seams that write no payment_orders row).
    const priorPaidQuery = executor.calls.find((c) => /hasPriorPaid/.test(c.text))!;
    assert.match(priorPaidQuery.text, /reseller_wallet_ledger[\s\S]*entry_type = 'sale_debit'/);
    assert.match(priorPaidQuery.text, /quota_charge_events/);
  });

  it('runs NO bonus queries when deciders are not injected', async () => {
    const executor = createFakeExecutor([
      { rows: [request] },
      { rows: [{ name: '20 GB', volumeBytes: 20 * GB }] },
      { rows: [{ quotaLimitBytes: 0, usedBytes: 0, referredBy: 'inviter-1', expiresAt: null, accountCreatedAt: NOW }] },
      { rows: [] }, // quota UPDATE
      { rows: [] }, // resetCycle
      { rows: [] }, // status
      { rows: [] }, // grace
    ]);
    const outcome = await approveTopupInTransaction(executor, 'req-1', { reviewer: 'admin', computeQuotaAfter, now: NOW });
    assert.equal(outcome.bonuses.length, 0);
    assert.equal(executor.calls.some((c) => /bonus_grants/.test(c.text)), false);
    assert.equal(executor.calls.some((c) => /hasPriorPaid/.test(c.text)), false);
  });
});
