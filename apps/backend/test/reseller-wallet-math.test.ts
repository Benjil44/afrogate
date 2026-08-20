import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import {
  afrowsShareBps,
  computeResellerGbCost,
  computeResellerSaleAmounts,
  normalizeResellerMarginBps,
  walletCanCoverDebit,
} from '../src/billing/reseller-wallet-math.ts';

describe('normalizeResellerMarginBps', () => {
  it('returns the provided integer when in range', () => {
    assert.equal(normalizeResellerMarginBps(2500, 2500), 2500);
  });

  it('falls back when value is null/undefined', () => {
    assert.equal(normalizeResellerMarginBps(undefined, 2500), 2500);
    assert.equal(normalizeResellerMarginBps(null, 1000), 1000);
  });

  it('accepts the 0 and 8000 boundaries', () => {
    assert.equal(normalizeResellerMarginBps(0, 2500), 0);
    assert.equal(normalizeResellerMarginBps(8000, 2500), 8000);
  });

  it('rejects negative, over-max, and non-integer values', () => {
    assert.throws(() => normalizeResellerMarginBps(-1, 2500), BadRequestException);
    assert.throws(() => normalizeResellerMarginBps(8001, 2500), BadRequestException);
    assert.throws(() => normalizeResellerMarginBps(12.5, 2500), BadRequestException);
  });
});

describe('afrowsShareBps', () => {
  it('is the complement of the seller margin', () => {
    assert.equal(afrowsShareBps(2500), 7500);
    assert.equal(afrowsShareBps(0), 10000);
    assert.equal(afrowsShareBps(10000), 0);
  });

  it('never goes negative even past 100%', () => {
    assert.equal(afrowsShareBps(12000), 0);
  });
});

describe('computeResellerSaleAmounts (margin = markup on COST)', () => {
  it('debits the full cost and keeps the margin as markup on top (NOT debited)', () => {
    // Cost 200,000 @ 20% → debit the cost, keep 40,000 markup, sell at 240,000.
    assert.deepEqual(computeResellerSaleAmounts(200_000, 2000), {
      costAmount: 200_000,
      sellerMarginAmount: 40_000,
      resellerSellPrice: 240_000,
      walletDebitAmount: 200_000,
    });
  });

  it('debits the whole cost even at 25% margin (the platform only takes the cost)', () => {
    assert.deepEqual(computeResellerSaleAmounts(10_000, 2500), {
      costAmount: 10_000,
      sellerMarginAmount: 2_500,
      resellerSellPrice: 12_500,
      walletDebitAmount: 10_000,
    });
  });

  it('rounds the kept markup to the nearest integer (no fractional currency)', () => {
    // 999 * 2500 / 10000 = 249.75 -> 250; debit stays the full cost 999.
    assert.deepEqual(computeResellerSaleAmounts(999, 2500), {
      costAmount: 999,
      sellerMarginAmount: 250,
      resellerSellPrice: 1_249,
      walletDebitAmount: 999,
    });
  });

  it('keeps a zero markup when there is no seller margin (debit = cost, sell = cost)', () => {
    assert.deepEqual(computeResellerSaleAmounts(5000, 0), {
      costAmount: 5000,
      sellerMarginAmount: 0,
      resellerSellPrice: 5000,
      walletDebitAmount: 5000,
    });
  });

  it('clamps a negative/zero cost to a non-negative debit', () => {
    assert.deepEqual(computeResellerSaleAmounts(0, 2500), {
      costAmount: 0,
      sellerMarginAmount: 0,
      resellerSellPrice: 0,
      walletDebitAmount: 0,
    });
    assert.equal(computeResellerSaleAmounts(-100, 2500).walletDebitAmount, 0);
  });
});

describe('computeResellerGbCost (per-GB cost = GB × gbPrice)', () => {
  it('is the platform cost the wallet is debited for a per-GB sale', () => {
    // 20 GB × 200,000/GB = 4,000,000 (the worked example).
    assert.equal(computeResellerGbCost(20, 200_000), 4_000_000);
  });

  it('rounds to a whole currency unit', () => {
    assert.equal(computeResellerGbCost(2.5, 199_999), Math.round(2.5 * 199_999));
  });

  it('feeds the cost-based split: debit = cost, kept markup = cost × bps', () => {
    const cost = computeResellerGbCost(20, 200_000);
    const amounts = computeResellerSaleAmounts(cost, 2000);
    assert.equal(amounts.walletDebitAmount, 4_000_000); // debit = cost
    assert.equal(amounts.sellerMarginAmount, 800_000); // 20% markup, kept (not debited)
    assert.equal(amounts.resellerSellPrice, 4_800_000); // what the reseller charges
  });

  it('rejects a non-positive GB amount or a negative price', () => {
    assert.throws(() => computeResellerGbCost(0, 200_000), BadRequestException);
    assert.throws(() => computeResellerGbCost(-1, 200_000), BadRequestException);
    assert.throws(() => computeResellerGbCost(20, -1), BadRequestException);
  });
});

describe('walletCanCoverDebit', () => {
  it('allows a debit when the post-debit balance stays within the credit limit', () => {
    assert.equal(walletCanCoverDebit(0, 0), true);
    assert.equal(walletCanCoverDebit(-100, 100), true); // exactly at the credit floor
    assert.equal(walletCanCoverDebit(-100, 200), true);
  });

  it('blocks a debit that would exceed the credit limit', () => {
    assert.equal(walletCanCoverDebit(-100, 50), false);
    assert.equal(walletCanCoverDebit(-1, 0), false);
  });
});
