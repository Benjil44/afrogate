import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  iranNationalSignificant,
  phoneClearVariants,
  phoneDigitVariants,
  phoneDigits,
} from '../src/billing/phone-identity.ts';

describe('phone-identity variants (bot registration linking)', () => {
  it('reduces any input to bare digits', () => {
    assert.equal(phoneDigits('+98 912 123 4567'), '989121234567');
    assert.equal(phoneDigits('0912-123-4567'), '09121234567');
    assert.equal(phoneDigits(null), '');
  });

  it('extracts the Iran national significant number from every shape', () => {
    assert.equal(iranNationalSignificant('989121234567'), '9121234567'); // country code
    assert.equal(iranNationalSignificant('09121234567'), '9121234567'); // trunk 0
    assert.equal(iranNationalSignificant('9121234567'), '9121234567'); // already bare
  });

  it('produces a canonical digit set that cross-matches all stored forms', () => {
    // Whether the account was stored as +98…, 0912…, or bare 912…, the same
    // registering number must yield a variant that equals the stored digits.
    const fromE164 = phoneDigitVariants('+989121234567');
    const fromNational = phoneDigitVariants('09121234567');
    const fromBare = phoneDigitVariants('9121234567');

    for (const variants of [fromE164, fromNational, fromBare]) {
      assert.ok(variants.includes('9121234567'), 'bare nsn');
      assert.ok(variants.includes('09121234567'), 'national trunk form');
      assert.ok(variants.includes('989121234567'), 'country-code form');
    }
  });

  it('ignores garbage / too-short input (no lookup)', () => {
    assert.deepEqual(phoneDigitVariants('12'), []);
    assert.deepEqual(phoneDigitVariants(''), []);
    assert.deepEqual(phoneClearVariants('x'), []);
  });

  it('offers clear-text forms (with +) for paid_number_hash probing', () => {
    const clear = phoneClearVariants('989121234567');
    assert.ok(clear.includes('+989121234567'));
    assert.ok(clear.includes('09121234567'));
    assert.ok(clear.includes('989121234567'));
  });
});
