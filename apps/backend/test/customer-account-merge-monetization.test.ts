import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mergeCustomerAccountInTransaction } from '../src/billing/customer-account-merge.ts';
import { createFakeExecutor } from './helpers/fake-db.ts';

const SOURCE = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';
const LOCKOUT = new Date('2026-12-01T00:00:00.000Z');

/** Merge an unlimited-quota, no-gems, no-identity source so only the C2 extras run. */
function executorFor(sourceOverrides: Record<string, unknown> = {}) {
  const source = {
    id: SOURCE,
    deletedAt: null,
    quotaLimitBytes: null,
    usedBytes: 0,
    gemsBalance: 0,
    telegramId: null,
    telegramUsername: null,
    phone: null,
    graceBlockedUntil: null,
    ...sourceOverrides,
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
    graceBlockedUntil: null,
  };
  return createFakeExecutor([
    { rows: [source, target] }, // lock
    { rows: [{ count: 0 }] }, // wg peer count
    { rows: [] }, // client_configs UPDATE
    { rows: [] }, // source telegram/phone NULL
    { rows: [] }, // referrals re-point
    { rows: [] }, // grace_blocked_until GREATEST (conditional)
    { rows: [] }, // bonus_grants re-point
    { rows: [] }, // archive source
  ]);
}

describe('merge — monetization columns (C2)', () => {
  it('target inherits the stricter grace_blocked_until (GREATEST) and re-points bonus_grants', async () => {
    const executor = executorFor({ graceBlockedUntil: LOCKOUT });
    await mergeCustomerAccountInTransaction(executor, SOURCE, TARGET, async () => {});

    const lockUpdate = executor.calls.find(
      (c) => /UPDATE customer_accounts/.test(c.text) && /grace_blocked_until = GREATEST/.test(c.text),
    );
    assert.ok(lockUpdate, 'grace_blocked_until GREATEST update ran');
    assert.equal(lockUpdate!.values[0], TARGET, 'applied to the target');

    const bonusRepoint = executor.calls.find((c) => /UPDATE bonus_grants/.test(c.text));
    assert.ok(bonusRepoint, 'bonus_grants re-point ran');
    assert.match(bonusRepoint!.text, /NOT \(/); // once-ever kinds skipped on conflict
    assert.match(bonusRepoint!.text, /first_purchase.*invitee_referral/s);
    assert.deepEqual(bonusRepoint!.values, [SOURCE, TARGET]);
  });

  it('never copies the source cycle anchor to the target (a merge is not a purchase, C1/C2)', async () => {
    const executor = executorFor({ graceBlockedUntil: LOCKOUT });
    await mergeCustomerAccountInTransaction(executor, SOURCE, TARGET, async () => {});
    for (const call of executor.calls) {
      assert.equal(/cycle_start_used_bytes/.test(call.text), false, 'cycle anchor must not move on merge');
      assert.equal(/renewal_notice_mask/.test(call.text), false, 'notice mask must not move on merge');
    }
  });

  it('skips the grace_blocked_until update when the source has no lockout', async () => {
    const executor = executorFor({ graceBlockedUntil: null });
    await mergeCustomerAccountInTransaction(executor, SOURCE, TARGET, async () => {});
    assert.equal(
      executor.calls.some((c) => /grace_blocked_until = GREATEST/.test(c.text)),
      false,
    );
  });
});
