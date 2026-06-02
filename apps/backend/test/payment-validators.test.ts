import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import {
  assertAmountRange,
  assertNoSecretLikeKeys,
  assertPaymentOrderStatusTransition,
  stringifyPublicRecord,
} from '../src/billing/payment-validators.ts';

describe('assertPaymentOrderStatusTransition', () => {
  it('allows a no-op transition', () => {
    assert.doesNotThrow(() => assertPaymentOrderStatusTransition('paid', 'paid'));
  });

  it('allows whitelisted transitions', () => {
    for (const [from, to] of [
      ['pending', 'paid'],
      ['pending', 'failed'],
      ['paid', 'refunded'],
    ] as const) {
      assert.doesNotThrow(() => assertPaymentOrderStatusTransition(from, to));
    }
  });

  it('rejects illegal transitions and terminal states', () => {
    for (const [from, to] of [
      ['paid', 'pending'],
      ['failed', 'paid'],
      ['refunded', 'paid'],
      ['pending', 'refunded'],
    ] as const) {
      assert.throws(() => assertPaymentOrderStatusTransition(from, to), BadRequestException);
    }
  });
});

describe('assertAmountRange', () => {
  it('allows ranges where max >= min, or either bound is null', () => {
    assert.doesNotThrow(() => assertAmountRange(10, 20));
    assert.doesNotThrow(() => assertAmountRange(10, 10));
    assert.doesNotThrow(() => assertAmountRange(null, 5));
    assert.doesNotThrow(() => assertAmountRange(5, null));
  });

  it('rejects a max below min', () => {
    assert.throws(() => assertAmountRange(20, 10), BadRequestException);
  });
});

describe('assertNoSecretLikeKeys', () => {
  it('accepts records without secret-like keys', () => {
    assert.doesNotThrow(() => assertNoSecretLikeKeys({ orderId: 'x', note: 'ok' }, 'metadata'));
    assert.doesNotThrow(() => assertNoSecretLikeKeys({ nested: { plain: 1 } }, 'metadata'));
  });

  it('rejects secret-like keys at the top level', () => {
    for (const key of ['secret', 'apiToken', 'password', 'private_key', 'client-secret', 'webhookSecret', 'credential']) {
      assert.throws(() => assertNoSecretLikeKeys({ [key]: 'v' }, 'metadata'), BadRequestException);
    }
  });

  it('rejects secret-like keys nested in sub-objects', () => {
    assert.throws(() => assertNoSecretLikeKeys({ a: { b: { token: 'v' } } }, 'metadata'), BadRequestException);
  });
});

describe('stringifyPublicRecord', () => {
  it('serializes a clean record', () => {
    assert.equal(stringifyPublicRecord({ a: 1, b: 'x' }, 'metadata'), '{"a":1,"b":"x"}');
  });

  it('throws before serializing when a secret-like key is present', () => {
    assert.throws(() => stringifyPublicRecord({ token: 'v' }, 'metadata'), BadRequestException);
  });
});
