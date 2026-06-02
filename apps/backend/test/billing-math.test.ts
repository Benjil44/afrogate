import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException } from '@nestjs/common';
import {
  calculateTotalPrice,
  defaultCheckoutMode,
  isErrorWithCode,
  minNullableBytes,
  numberFromBigInt,
  remainingBytes,
  throwConflictIfUniqueViolation,
} from '../src/billing/billing-math.ts';

describe('calculateTotalPrice', () => {
  it('multiplies volume by unit price', () => {
    assert.equal(calculateTotalPrice(10, 2.5), 25);
    assert.equal(calculateTotalPrice(0, 99), 0);
  });
});

describe('defaultCheckoutMode', () => {
  it('uses hosted redirect for PayPal and manual otherwise', () => {
    assert.equal(defaultCheckoutMode('paypal'), 'hosted_redirect');
    assert.equal(defaultCheckoutMode('card'), 'manual');
    assert.equal(defaultCheckoutMode(''), 'manual');
  });
});

describe('remainingBytes', () => {
  it('returns null for an unlimited (null) limit', () => {
    assert.equal(remainingBytes(null, 500), null);
  });

  it('returns the non-negative remainder', () => {
    assert.equal(remainingBytes(1000, 300), 700);
    assert.equal(remainingBytes(1000, 1000), 0);
  });

  it('never goes negative when usage exceeds the limit', () => {
    assert.equal(remainingBytes(1000, 1500), 0);
  });
});

describe('numberFromBigInt', () => {
  it('coerces numeric strings/numbers to finite numbers', () => {
    assert.equal(numberFromBigInt('42'), 42);
    assert.equal(numberFromBigInt(7), 7);
  });

  it('returns null for null/undefined/non-finite', () => {
    assert.equal(numberFromBigInt(null), null);
    assert.equal(numberFromBigInt(undefined), null);
    assert.equal(numberFromBigInt('not-a-number'), null);
  });
});

describe('minNullableBytes', () => {
  it('returns the smallest finite value, ignoring null/undefined/non-finite', () => {
    assert.equal(minNullableBytes([300, null, 100, undefined, 200]), 100);
    assert.equal(minNullableBytes([Number.NaN, 5]), 5);
  });

  it('returns null when there is no finite value', () => {
    assert.equal(minNullableBytes([null, undefined]), null);
    assert.equal(minNullableBytes([]), null);
  });
});

describe('isErrorWithCode', () => {
  it('narrows objects carrying a code', () => {
    assert.equal(isErrorWithCode({ code: '23505' }), true);
    assert.equal(isErrorWithCode(new Error('x')), false);
    assert.equal(isErrorWithCode(null), false);
    assert.equal(isErrorWithCode('boom'), false);
  });
});

describe('throwConflictIfUniqueViolation', () => {
  it('rethrows a 23505 as ConflictException', () => {
    assert.throws(() => throwConflictIfUniqueViolation({ code: '23505' }, 'dup'), ConflictException);
  });

  it('ignores other errors (no throw)', () => {
    assert.doesNotThrow(() => throwConflictIfUniqueViolation({ code: '23503' }, 'dup'));
    assert.doesNotThrow(() => throwConflictIfUniqueViolation(new Error('x'), 'dup'));
  });
});
