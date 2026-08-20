import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import {
  attributeReferral,
  computeReferralCommissionGems,
  creditReferralSignup,
  earnGems,
  generateReferralCode,
  redeemGemsForGb,
  REFERRAL_ALPHABET,
  REFERRAL_CODE_LENGTH,
} from '../src/billing/gems.ts';
import { createFakeExecutor } from './helpers/fake-db.ts';

describe('earnGems', () => {
  it('appends a signed ledger row then updates the cached balance', async () => {
    const executor = createFakeExecutor([
      { rows: [] }, // INSERT gems_ledger
      { rows: [{ gemsBalance: 150 }] }, // UPDATE ... RETURNING
    ]);

    const result = await earnGems(executor, 'acct-1', 50, 'referral_signup', 'ref-1');

    assert.equal(result.gemsBalance, 150);
    assert.match(executor.calls[0].text, /INSERT INTO gems_ledger/);
    assert.deepEqual(executor.calls[0].values, ['acct-1', 50, 'referral_signup', 'ref-1']);
    assert.match(executor.calls[1].text, /UPDATE customer_accounts/);
    assert.deepEqual(executor.calls[1].values, ['acct-1', 50]);
  });

  it('rejects a non-integer delta', async () => {
    const executor = createFakeExecutor([]);
    await assert.rejects(earnGems(executor, 'acct-1', 1.5, 'admin_adjust'), BadRequestException);
    assert.equal(executor.calls.length, 0);
  });
});

describe('redeemGemsForGb', () => {
  it('deducts gems and credits GB with the shared allocation math (decimal bytes)', async () => {
    const executor = createFakeExecutor([
      { rows: [{ gemsBalance: 250, quotaLimitBytes: 1_000_000_000, usedBytes: 200_000_000 }] }, // lock
      { rows: [] }, // ledger insert
      { rows: [{ gemsBalance: 50 }] }, // update
    ]);

    const result = await redeemGemsForGb(executor, 'acct-1', 200, 100);

    assert.equal(result.gbAdded, 2);
    assert.equal(result.bytesAdded, 2_000_000_000);
    // 1e9 existing limit + 2e9 redeemed = 3e9 (never forgives the 2e8 already used).
    assert.equal(result.quotaLimitBeforeBytes, 1_000_000_000);
    assert.equal(result.quotaLimitAfterBytes, 3_000_000_000);
    assert.equal(result.gemsBalance, 50);

    const ledger = executor.calls[1];
    assert.match(ledger.text, /INSERT INTO gems_ledger/);
    assert.deepEqual(ledger.values, ['acct-1', -200, '2GB']);
    const update = executor.calls[2];
    assert.deepEqual(update.values, ['acct-1', 200, 3_000_000_000]);
  });

  it('refuses an insufficient balance (locks, no deduction)', async () => {
    const executor = createFakeExecutor([
      { rows: [{ gemsBalance: 50, quotaLimitBytes: 0, usedBytes: 0 }] },
    ]);
    await assert.rejects(redeemGemsForGb(executor, 'acct-1', 100, 100), /Insufficient/);
    assert.equal(executor.calls.length, 1, 'only the lock ran');
  });

  it('refuses an amount that is not a whole number of GB at the rate', async () => {
    const executor = createFakeExecutor([]);
    await assert.rejects(redeemGemsForGb(executor, 'acct-1', 150, 100), /whole number of GB/);
    assert.equal(executor.calls.length, 0);
  });
});

describe('computeReferralCommissionGems', () => {
  it('pays pct% of the purchased GB, expressed in gems at the redeem rate', () => {
    assert.equal(computeReferralCommissionGems(20_000_000_000, 20, 100), 400);
    assert.equal(computeReferralCommissionGems(1_000_000_000, 20, 100), 20);
  });

  it('is zero for a non-positive volume / pct / rate', () => {
    assert.equal(computeReferralCommissionGems(0, 20, 100), 0);
    assert.equal(computeReferralCommissionGems(20_000_000_000, 0, 100), 0);
  });
});

describe('generateReferralCode (unbiased via crypto.randomInt)', () => {
  it('maps each drawn index onto the lookalike-free alphabet at the documented length', () => {
    const indices = [0, 1, 2, 3, 4, 5, 6, 7];
    let i = 0;
    const code = generateReferralCode(() => indices[i++]);
    assert.equal(code, 'ABCDEFGH');
    assert.equal(code.length, REFERRAL_CODE_LENGTH);
  });

  it('requests one uniform index per character, strictly within the alphabet bounds', () => {
    // Proves selection asks randomInt for [0, alphabet.length) — no biased
    // reduction of a raw byte into the index.
    const requested: number[] = [];
    generateReferralCode((max) => {
      requested.push(max);
      return 0;
    });
    assert.equal(requested.length, REFERRAL_CODE_LENGTH);
    for (const max of requested) assert.equal(max, REFERRAL_ALPHABET.length);
  });

  it('covers the full alphabet as the index sweeps its range (uniform, order-preserving)', () => {
    // index i -> alphabet[i]; sweeping 0..30 must reproduce the alphabet exactly.
    for (let idx = 0; idx < REFERRAL_ALPHABET.length; idx++) {
      const code = generateReferralCode(() => idx);
      assert.equal(code, REFERRAL_ALPHABET[idx].repeat(REFERRAL_CODE_LENGTH));
    }
  });

  it('always returns a full-length code drawn only from the alphabet (real crypto source)', () => {
    const shape = new RegExp(`^[${REFERRAL_ALPHABET}]{${REFERRAL_CODE_LENGTH}}$`);
    for (let i = 0; i < 256; i++) {
      const code = generateReferralCode(); // real crypto.randomInt, no injection
      assert.match(code, shape);
    }
  });
});

describe('attributeReferral (write-once, no self-referral)', () => {
  it('sets referred_by when the code resolves to a different account', async () => {
    const executor = createFakeExecutor([
      { rows: [{ id: 'inviter-1' }] }, // lookup by code
      { rows: [{ id: 'new-1' }] }, // UPDATE ... RETURNING (was null)
    ]);
    const result = await attributeReferral(executor, 'new-1', 'CODE');
    assert.deepEqual(result, { inviterAccountId: 'inviter-1' });
  });

  it('rejects self-referral (code resolves to the new account itself)', async () => {
    const executor = createFakeExecutor([{ rows: [{ id: 'new-1' }] }]);
    const result = await attributeReferral(executor, 'new-1', 'CODE');
    assert.equal(result, null);
    assert.equal(executor.calls.length, 1, 'no UPDATE attempted');
  });

  it('returns null for an unknown code', async () => {
    const executor = createFakeExecutor([{ rows: [] }]);
    assert.equal(await attributeReferral(executor, 'new-1', 'NOPE'), null);
  });

  it('is one-time: an already-attributed account is not overwritten', async () => {
    const executor = createFakeExecutor([
      { rows: [{ id: 'inviter-1' }] }, // lookup
      { rows: [] }, // UPDATE ... WHERE referred_by IS NULL matched nothing
    ]);
    assert.equal(await attributeReferral(executor, 'new-1', 'CODE'), null);
  });

  it('ignores an empty code', async () => {
    const executor = createFakeExecutor([]);
    assert.equal(await attributeReferral(executor, 'new-1', '  '), null);
    assert.equal(executor.calls.length, 0);
  });
});

describe('creditReferralSignup (+ milestone)', () => {
  const config = { signupGems: 50, milestoneEvery: 10, milestoneBonus: 300 };

  it('credits the signup bonus once and reports no milestone below the threshold', async () => {
    const executor = createFakeExecutor([
      { rows: [] }, // dedup: no prior signup for this referred account
      { rows: [] }, // earnGems ledger insert
      { rows: [{ gemsBalance: 50 }] }, // earnGems update
      { rows: [{ count: 3 }] }, // countCompletedReferrals
    ]);
    const result = await creditReferralSignup(executor, 'new-1', 'inviter-1', config);
    assert.equal(result?.signupGems, 50);
    assert.equal(result?.inviterGemsBalance, 50);
    assert.equal(result?.completedReferrals, 3);
    assert.equal(result?.milestone, null);
  });

  it('adds the milestone bonus when the referral count hits a multiple of N', async () => {
    const executor = createFakeExecutor([
      { rows: [] }, // dedup signup
      { rows: [] }, // signup ledger
      { rows: [{ gemsBalance: 500 }] }, // signup update
      { rows: [{ count: 10 }] }, // countCompletedReferrals
      { rows: [] }, // milestone dedup
      { rows: [] }, // milestone ledger
      { rows: [{ gemsBalance: 800 }] }, // milestone update
    ]);
    const result = await creditReferralSignup(executor, 'new-1', 'inviter-1', config);
    assert.equal(result?.milestone?.count, 10);
    assert.equal(result?.milestone?.bonusGems, 300);
    assert.equal(result?.milestone?.inviterGemsBalance, 800);
  });

  it('is de-duplicated: a replay for the same referred account is a no-op', async () => {
    const executor = createFakeExecutor([{ rows: [{ exists: 1 }] }]);
    const result = await creditReferralSignup(executor, 'new-1', 'inviter-1', config);
    assert.equal(result, null);
    assert.equal(executor.calls.length, 1, 'only the dedup check ran; no credit');
  });
});
