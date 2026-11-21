import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  approveTopupInTransaction,
  decideReferralReward,
  resolveReferralRewardBytes,
  REFERRAL_REWARD_DEFAULT_BYTES,
  REFERRAL_REWARD_CAP_PER_WINDOW,
} from '../src/telegram/telegram-topup.ts';
import { createFakeExecutor } from './helpers/fake-db.ts';

// Mirrors quota-math.computeAllocatedQuotaLimitBytes (injected in production).
const computeQuotaAfter = (before: number | null, used: number, volume: number): number => (before ?? used) + volume;

const REWARD = 1_500_000_000; // 1.5 GB decimal
const NOW = new Date('2026-11-12T00:00:00.000Z');

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

// --- resolveReferralRewardBytes -------------------------------------------------

describe('resolveReferralRewardBytes', () => {
  it('defaults to 1.5 GB decimal (1_500_000_000) when unset', () => {
    assert.equal(resolveReferralRewardBytes(null), 1_500_000_000);
    assert.equal(resolveReferralRewardBytes(undefined), 1_500_000_000);
    assert.equal(REFERRAL_REWARD_DEFAULT_BYTES, 1_500_000_000);
  });

  it('round-trips a configured value (number or bigint-string)', () => {
    assert.equal(resolveReferralRewardBytes(2_000_000_000), 2_000_000_000);
    assert.equal(resolveReferralRewardBytes('3000000000'), 3_000_000_000);
  });

  it('honours a stored 0 (operator disabled the data reward)', () => {
    assert.equal(resolveReferralRewardBytes(0), 0);
    assert.equal(resolveReferralRewardBytes('0'), 0);
  });

  it('falls back to the default for invalid / negative values', () => {
    assert.equal(resolveReferralRewardBytes(-5), REFERRAL_REWARD_DEFAULT_BYTES);
    assert.equal(resolveReferralRewardBytes('abc'), REFERRAL_REWARD_DEFAULT_BYTES);
    assert.equal(resolveReferralRewardBytes(1.5), REFERRAL_REWARD_DEFAULT_BYTES);
  });
});

// --- decideReferralReward (pure decision) --------------------------------------

describe('decideReferralReward (pure)', () => {
  const base = {
    referralRewardBytes: REWARD,
    inviterAccountId: 'inviter-1',
    invitedAccountId: 'buyer-1',
    amountMinor: 50_000,
    inviterStatus: 'active' as string | null,
    inviterExpiresAt: null as Date | null,
    grantedInWindow: 0,
    now: NOW,
  };

  it('grants on a first paid approval from an active inviter under the cap', () => {
    const d = decideReferralReward(base);
    assert.equal(d.status, 'granted');
    assert.equal(d.creditQuota, true);
    assert.equal(d.skipReason, null);
  });

  it('skips when the reward is disabled (bytes <= 0)', () => {
    const d = decideReferralReward({ ...base, referralRewardBytes: 0 });
    assert.equal(d.status, null);
    assert.equal(d.skipReason, 'reward_disabled');
  });

  it('skips when there is no inviter', () => {
    const d = decideReferralReward({ ...base, inviterAccountId: null });
    assert.equal(d.status, null);
    assert.equal(d.skipReason, 'no_inviter');
  });

  it('blocks self-referral (inviter === invitee)', () => {
    const d = decideReferralReward({ ...base, inviterAccountId: 'buyer-1' });
    assert.equal(d.status, null);
    assert.equal(d.skipReason, 'self_referral');
  });

  it('skips an unpaid (amount_minor <= 0 / null) approval — real money required', () => {
    assert.equal(decideReferralReward({ ...base, amountMinor: 0 }).skipReason, 'unpaid');
    assert.equal(decideReferralReward({ ...base, amountMinor: null }).skipReason, 'unpaid');
  });

  it('skips when the inviter is inactive or their month expired at credit time', () => {
    assert.equal(decideReferralReward({ ...base, inviterStatus: 'suspended' }).skipReason, 'inviter_inactive');
    const past = new Date(NOW.getTime() - 1000);
    assert.equal(decideReferralReward({ ...base, inviterExpiresAt: past }).skipReason, 'inviter_inactive');
    // An expiry strictly in the future is fine.
    const future = new Date(NOW.getTime() + 1000);
    assert.equal(decideReferralReward({ ...base, inviterExpiresAt: future }).status, 'granted');
  });

  it('skips an UNLIMITED (null-quota) inviter — never caps/cuts an uncapped account', () => {
    assert.equal(decideReferralReward({ ...base, inviterQuotaLimitBytes: null }).skipReason, 'inviter_unlimited');
    // A finite quota still grants; omitting the field (undefined) is treated as finite.
    assert.equal(decideReferralReward({ ...base, inviterQuotaLimitBytes: 5_000_000_000 }).status, 'granted');
    assert.equal(decideReferralReward({ ...base }).status, 'granted');
  });

  it('records pending_review (no quota credit) when the rolling-30-day cap is reached', () => {
    const atCap = decideReferralReward({ ...base, grantedInWindow: REFERRAL_REWARD_CAP_PER_WINDOW });
    assert.equal(atCap.status, 'pending_review');
    assert.equal(atCap.creditQuota, false);
    // Exactly one below the cap still grants.
    const underCap = decideReferralReward({ ...base, grantedInWindow: REFERRAL_REWARD_CAP_PER_WINDOW - 1 });
    assert.equal(underCap.status, 'granted');
  });
});

// --- approveTopupInTransaction — DATA reward path ------------------------------

describe('approveTopupInTransaction — referral DATA reward', () => {
  it('credits the inviter 1.5 GB on the first paid approval and disables the gem commission', async () => {
    const executor = createFakeExecutor([
      { rows: [pendingRequest] }, // lock request
      { rows: [{ name: '20 GB', volumeBytes: 20_000_000_000 }] }, // lock package
      { rows: [{ quotaLimitBytes: 0, usedBytes: 0, referredBy: 'inviter-1', expiresAt: null }] }, // lock account
      { rows: [] }, // UPDATE buyer quota
      { rows: [] }, // resetCycleOnPaidCredit anchor (0070)
      {
        rows: [
          { status: 'active', expiresAt: null, quotaLimitBytes: 2_000_000_000, telegramId: '999', telegramChatId: 'chat-inviter' },
        ],
      }, // lock inviter
      { rows: [{ count: 0 }] }, // cap count
      { rows: [{ id: 'rr-1' }] }, // INSERT referral_rewards RETURNING (row inserted)
      { rows: [] }, // UPDATE inviter quota
      { rows: [] }, // UPDATE telegram_topup_requests
      { rows: [] }, // grace recompute
    ]);

    const outcome = await approveTopupInTransaction(executor, 'req-1', {
      reviewer: 'admin',
      computeQuotaAfter,
      now: NOW,
      referralRewardBytes: REWARD,
      gemEconomy: { referralPurchasePct: 20, gemRedeemPerGb: 100 },
    });

    assert.ok(outcome.referralReward);
    assert.equal(outcome.referralReward?.status, 'granted');
    assert.equal(outcome.referralReward?.inviterAccountId, 'inviter-1');
    assert.equal(outcome.referralReward?.rewardBytes, REWARD);
    assert.equal(outcome.referralReward?.inviterTelegramChatId, 'chat-inviter');
    // 2,000,000,000 + 1,500,000,000 = 3,500,000,000 bytes.
    assert.equal(outcome.referralReward?.inviterQuotaAfterBytes, 3_500_000_000);
    assert.equal(outcome.commission, null, 'gem commission is disabled when the data reward is active');

    // Idempotent ledger insert, with the RESOLVED inviter id and request id stored.
    const insert = executor.calls.find((c) => /INSERT INTO referral_rewards/.test(c.text));
    assert.ok(insert);
    assert.match(insert.text, /ON CONFLICT \(invited_account_id\) DO NOTHING/);
    assert.deepEqual(insert.values, ['buyer-1', 'inviter-1', REWARD, 'req-1', 'granted']);

    // The gem path never ran.
    assert.equal(executor.calls.some((c) => /INSERT INTO gems_ledger/.test(c.text)), false);

    // The inviter's quota was credited (second customer_accounts quota UPDATE).
    const quotaUpdates = executor.calls.filter(
      (c) => /UPDATE customer_accounts/.test(c.text) && /quota_limit_bytes/.test(c.text),
    );
    assert.equal(quotaUpdates.length, 2);
    assert.deepEqual(quotaUpdates[1].values, [3_500_000_000, 'inviter-1']);

    // C1 regression: the cycle anchor moves for the BUYER only (the purchase), never for
    // the inviter reward. Exactly one cycle-anchor UPDATE, targeting the buyer; and the
    // inviter quota credit must not carry any cycle-anchor columns.
    const anchorUpdates = executor.calls.filter((c) => /cycle_start_used_bytes = LEAST/.test(c.text));
    assert.equal(anchorUpdates.length, 1);
    assert.equal(anchorUpdates[0].values[0], 'buyer-1');
    assert.equal(/cycle_start_used_bytes = LEAST|renewal_notice_mask = 0/.test(quotaUpdates[1].text), false);
  });

  it('records pending_review and credits NO quota when the inviter is over the 30-day cap', async () => {
    const executor = createFakeExecutor([
      { rows: [pendingRequest] },
      { rows: [{ name: '20 GB', volumeBytes: 20_000_000_000 }] },
      { rows: [{ quotaLimitBytes: 0, usedBytes: 0, referredBy: 'inviter-1', expiresAt: null }] },
      { rows: [] }, // UPDATE buyer quota
      { rows: [] }, // resetCycleOnPaidCredit anchor (0070)
      {
        rows: [
          { status: 'active', expiresAt: null, quotaLimitBytes: 2_000_000_000, telegramId: '999', telegramChatId: 'chat-inviter' },
        ],
      }, // lock inviter
      { rows: [{ count: REFERRAL_REWARD_CAP_PER_WINDOW }] }, // at the cap
      { rows: [{ id: 'rr-2' }] }, // INSERT RETURNING (recorded as pending_review)
      { rows: [] }, // UPDATE status
      { rows: [] }, // grace
    ]);

    const outcome = await approveTopupInTransaction(executor, 'req-1', {
      reviewer: 'admin',
      computeQuotaAfter,
      now: NOW,
      referralRewardBytes: REWARD,
    });

    assert.equal(outcome.referralReward?.status, 'pending_review');
    const insert = executor.calls.find((c) => /INSERT INTO referral_rewards/.test(c.text));
    assert.equal(insert?.values[4], 'pending_review');
    // Only the buyer's quota was updated; the inviter's was NOT.
    const quotaUpdates = executor.calls.filter(
      (c) => /UPDATE customer_accounts/.test(c.text) && /quota_limit_bytes/.test(c.text),
    );
    assert.equal(quotaUpdates.length, 1);
  });

  it('is idempotent — an ON CONFLICT (no row returned) credits nothing a second time', async () => {
    const executor = createFakeExecutor([
      { rows: [pendingRequest] },
      { rows: [{ name: '20 GB', volumeBytes: 20_000_000_000 }] },
      { rows: [{ quotaLimitBytes: 0, usedBytes: 0, referredBy: 'inviter-1', expiresAt: null }] },
      { rows: [] }, // UPDATE buyer quota
      { rows: [] }, // resetCycleOnPaidCredit anchor (0070)
      {
        rows: [
          { status: 'active', expiresAt: null, quotaLimitBytes: 2_000_000_000, telegramId: '999', telegramChatId: 'chat-inviter' },
        ],
      },
      { rows: [{ count: 0 }] },
      { rows: [] }, // INSERT ON CONFLICT DO NOTHING → no row (already rewarded)
      { rows: [] }, // UPDATE status
      { rows: [] }, // grace
    ]);

    const outcome = await approveTopupInTransaction(executor, 'req-1', {
      reviewer: 'admin',
      computeQuotaAfter,
      now: NOW,
      referralRewardBytes: REWARD,
    });

    assert.equal(outcome.referralReward, null);
    const quotaUpdates = executor.calls.filter(
      (c) => /UPDATE customer_accounts/.test(c.text) && /quota_limit_bytes/.test(c.text),
    );
    assert.equal(quotaUpdates.length, 1, 'no second quota credit for an already-rewarded invitee');
  });

  it('skips the reward (and never locks the inviter) when the inviter is inactive', async () => {
    const executor = createFakeExecutor([
      { rows: [pendingRequest] },
      { rows: [{ name: '20 GB', volumeBytes: 20_000_000_000 }] },
      { rows: [{ quotaLimitBytes: 0, usedBytes: 0, referredBy: 'inviter-1', expiresAt: null }] },
      { rows: [] }, // UPDATE buyer quota
      { rows: [] }, // resetCycleOnPaidCredit anchor (0070)
      { rows: [{ status: 'suspended', expiresAt: null, quotaLimitBytes: 2_000_000_000, telegramId: '999', telegramChatId: 'chat-inviter' }] }, // lock inviter
      { rows: [{ count: 0 }] }, // cap count
      { rows: [] }, // UPDATE status
      { rows: [] }, // grace
    ]);

    const outcome = await approveTopupInTransaction(executor, 'req-1', {
      reviewer: 'admin',
      computeQuotaAfter,
      now: NOW,
      referralRewardBytes: REWARD,
    });

    assert.equal(outcome.referralReward, null);
    assert.equal(executor.calls.some((c) => /INSERT INTO referral_rewards/.test(c.text)), false);
  });

  it('skips the reward for an UNLIMITED (null-quota) inviter — no row, no credit, no cut-off', async () => {
    const executor = createFakeExecutor([
      { rows: [pendingRequest] },
      { rows: [{ name: '20 GB', volumeBytes: 20_000_000_000 }] },
      { rows: [{ quotaLimitBytes: 0, usedBytes: 0, referredBy: 'inviter-1', expiresAt: null }] },
      { rows: [] }, // UPDATE buyer quota
      { rows: [] }, // resetCycleOnPaidCredit anchor (0070)
      { rows: [{ status: 'active', expiresAt: null, quotaLimitBytes: null, telegramId: '999', telegramChatId: 'chat-inviter' }] }, // UNLIMITED inviter
      { rows: [{ count: 0 }] }, // cap count
      { rows: [] }, // UPDATE status
      { rows: [] }, // grace
    ]);

    const outcome = await approveTopupInTransaction(executor, 'req-1', {
      reviewer: 'admin',
      computeQuotaAfter,
      now: NOW,
      referralRewardBytes: REWARD,
    });

    assert.equal(outcome.referralReward, null);
    assert.equal(executor.calls.some((c) => /INSERT INTO referral_rewards/.test(c.text)), false);
    // Only the buyer's quota was updated; the unlimited inviter's was left untouched.
    const quotaUpdates = executor.calls.filter(
      (c) => /UPDATE customer_accounts/.test(c.text) && /quota_limit_bytes/.test(c.text),
    );
    assert.equal(quotaUpdates.length, 1);
  });

  it('skips cleanly when the buyer has no inviter (no reward queries, no gems)', async () => {
    const executor = createFakeExecutor([
      { rows: [pendingRequest] },
      { rows: [{ name: '20 GB', volumeBytes: 20_000_000_000 }] },
      { rows: [{ quotaLimitBytes: 0, usedBytes: 0, referredBy: null, expiresAt: null }] },
      { rows: [] }, // UPDATE buyer quota
      { rows: [] }, // resetCycleOnPaidCredit anchor (0070)
      { rows: [] }, // UPDATE status
      { rows: [] }, // grace
    ]);

    const outcome = await approveTopupInTransaction(executor, 'req-1', {
      reviewer: 'admin',
      computeQuotaAfter,
      now: NOW,
      referralRewardBytes: REWARD,
      gemEconomy: { referralPurchasePct: 20, gemRedeemPerGb: 100 },
    });

    assert.equal(outcome.referralReward, null);
    assert.equal(executor.calls.some((c) => /referral_rewards/.test(c.text)), false);
    assert.equal(executor.calls.some((c) => /gems_ledger/.test(c.text)), false);
  });
});
