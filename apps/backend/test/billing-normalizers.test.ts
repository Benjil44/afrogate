import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import {
  normalizeCurrency,
  normalizeMoneyAmount,
  normalizeNullableString,
  normalizePaidNumber,
  normalizeProtocol,
  normalizeProvider,
  normalizeResellerStatus,
  normalizeSlug,
  normalizeTelegramUsername,
  normalizeUsageMultiplier,
  parseJsonValue,
} from '../src/billing/billing-normalizers.ts';

describe('normalizeNullableString', () => {
  it('trims to a non-empty string or null', () => {
    assert.equal(normalizeNullableString('  hi  '), 'hi');
    assert.equal(normalizeNullableString('   '), null);
    assert.equal(normalizeNullableString(null), null);
    assert.equal(normalizeNullableString(undefined), null);
  });
});

describe('parseJsonValue', () => {
  it('parses JSON strings, passes through non-strings, null on bad JSON', () => {
    assert.deepEqual(parseJsonValue('{"a":1}'), { a: 1 });
    assert.deepEqual(parseJsonValue({ a: 1 }), { a: 1 });
    assert.equal(parseJsonValue('not json'), null);
  });
});

describe('normalizeUsageMultiplier', () => {
  it('accepts integers in [1,100], defaults null/undefined to 1', () => {
    assert.equal(normalizeUsageMultiplier(5), 5);
    assert.equal(normalizeUsageMultiplier(undefined), 1);
    assert.equal(normalizeUsageMultiplier('100'), 100);
  });
  it('rejects out-of-range or non-integer multipliers', () => {
    for (const v of [0, 101, 2.5, 'abc']) assert.throws(() => normalizeUsageMultiplier(v as never), BadRequestException);
  });
});

describe('normalizePaidNumber / normalizeTelegramUsername', () => {
  it('strips formatting from a paid number', () => {
    assert.equal(normalizePaidNumber(' (123) 456-7890 '), '1234567890');
    assert.equal(normalizePaidNumber('   '), null);
  });
  it('strips leading @ from a Telegram username', () => {
    assert.equal(normalizeTelegramUsername('@user'), 'user');
    assert.equal(normalizeTelegramUsername('@@@x'), 'x');
    assert.equal(normalizeTelegramUsername(null), null);
  });
});

describe('normalizeProtocol', () => {
  it('lowercases, defaulting to custom', () => {
    assert.equal(normalizeProtocol('WireGuard'), 'wireguard');
    assert.equal(normalizeProtocol(null), 'custom');
  });
});

describe('normalizeCurrency', () => {
  it('accepts valid codes and lowercases', () => {
    assert.equal(normalizeCurrency('USD'), 'usd');
    assert.equal(normalizeCurrency('toman'), 'toman');
  });
  it('rejects codes with bad characters or empty', () => {
    for (const v of ['', '1usd', 'us$', 'a'.repeat(17)]) assert.throws(() => normalizeCurrency(v), BadRequestException);
  });
});

describe('normalizeResellerStatus', () => {
  it('accepts active/suspended/disabled', () => {
    assert.equal(normalizeResellerStatus('Active'), 'active');
  });
  it('rejects anything else', () => {
    assert.throws(() => normalizeResellerStatus('banned'), BadRequestException);
  });
});

describe('normalizeMoneyAmount', () => {
  it('accepts safe non-negative integers and applies fallback', () => {
    assert.equal(normalizeMoneyAmount(1000, 'amount'), 1000);
    assert.equal(normalizeMoneyAmount(undefined, 'amount', 0), 0);
  });
  it('rejects negative, fractional, or missing amounts', () => {
    assert.throws(() => normalizeMoneyAmount(-1, 'amount'), BadRequestException);
    assert.throws(() => normalizeMoneyAmount(1.5, 'amount'), BadRequestException);
    assert.throws(() => normalizeMoneyAmount(undefined, 'amount'), BadRequestException);
  });
});

describe('normalizeSlug', () => {
  it('slugifies and rejects empty results', () => {
    assert.equal(normalizeSlug('Gold 100 GB!'), 'gold-100-gb');
    assert.throws(() => normalizeSlug('!!!'), BadRequestException);
  });
});

describe('normalizeProvider', () => {
  it('normalizes provider keys', () => {
    assert.equal(normalizeProvider('Pay Pal'), 'pay_pal');
  });
  it('rejects empty or overly long providers', () => {
    assert.throws(() => normalizeProvider('!!!'), BadRequestException);
    assert.throws(() => normalizeProvider('a'.repeat(41)), BadRequestException);
  });
});
