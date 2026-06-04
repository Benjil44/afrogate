import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import {
  afrowsShareBps,
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

describe('computeResellerSaleAmounts', () => {
  it('splits price into seller margin and wallet debit (Afrows share)', () => {
    assert.deepEqual(computeResellerSaleAmounts(10000, 2500), { sellerMarginAmount: 2500, walletDebitAmount: 7500 });
  });

  it('rounds the seller margin to the nearest integer (no fractional currency)', () => {
    // 999 * 2500 / 10000 = 249.75 -> 250; debit = 999 - 250 = 749
    assert.deepEqual(computeResellerSaleAmounts(999, 2500), { sellerMarginAmount: 250, walletDebitAmount: 749 });
  });

  it('debits nothing when the seller keeps the full price (100% margin)', () => {
    assert.deepEqual(computeResellerSaleAmounts(5000, 10000), { sellerMarginAmount: 5000, walletDebitAmount: 0 });
  });

  it('debits the full price when there is no seller margin', () => {
    assert.deepEqual(computeResellerSaleAmounts(5000, 0), { sellerMarginAmount: 0, walletDebitAmount: 5000 });
  });

  it('never produces a negative wallet debit', () => {
    const { walletDebitAmount } = computeResellerSaleAmounts(0, 2500);
    assert.equal(walletDebitAmount, 0);
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
