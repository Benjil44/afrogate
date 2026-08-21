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
  stripSurroundingUnderscores,
  bytesAtMultiplier,
  usageMultiplierLabel,
  parseJsonValue,
  normalizeRouteGroup,
  normalizeCountryCode,
  normalizeDetectionSource,
  normalizeJsonStringArray,
  normalizeRewardedAdSettingsToken,
  normalizeSubscriptionProtocol,
  normalizePublicEndpointValue,
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

describe('bytesAtMultiplier', () => {
  it('floors charged bytes divided by the multiplier', () => {
    assert.equal(bytesAtMultiplier(1000, 3), 333);
    assert.equal(bytesAtMultiplier(1000, 1), 1000);
    assert.equal(bytesAtMultiplier(1000, undefined), 1000);
  });
  it('passes through null charged bytes', () => {
    assert.equal(bytesAtMultiplier(null, 3), null);
  });
  it('rejects an invalid multiplier via the underlying validator', () => {
    assert.throws(() => bytesAtMultiplier(1000, 0), BadRequestException);
  });
});

describe('usageMultiplierLabel', () => {
  it('formats the normalized multiplier with an x prefix', () => {
    assert.equal(usageMultiplierLabel(3), 'x3');
    assert.equal(usageMultiplierLabel(undefined), 'x1');
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
  it('preserves the full normalization contract (lowercase, collapse, strip, length)', () => {
    assert.equal(normalizeProvider('STRIPE'), 'stripe'); // lowercase
    assert.equal(normalizeProvider('a b   c'), 'a_b_c'); // non-alnum runs collapse to one _
    assert.equal(normalizeProvider('__paypal'), 'paypal'); // leading _ stripped
    assert.equal(normalizeProvider('paypal__'), 'paypal'); // trailing _ stripped
    assert.equal(normalizeProvider('__pay_pal__'), 'pay_pal'); // both sides, inner kept
    assert.equal(normalizeProvider('a_b-c'), 'a_b-c'); // hyphen kept, no collapse
    assert.throws(() => normalizeProvider('___'), BadRequestException); // all-underscore -> required
    assert.equal(normalizeProvider('a'.repeat(40)), 'a'.repeat(40)); // exactly 40 ok
  });
  it('handles the polynomial-ReDoS shape without catastrophic backtracking (js/polynomial-redos guard)', () => {
    // The old `.replace(/^_+|_+$/g,'')` was O(n^2) on this input (~seconds for
    // 50k). The linear strip returns the correct value effectively instantly;
    // the test completing at all proves no catastrophic backtracking — no
    // timing assertion (which would be machine-flaky) is used.
    const pathological = 'a' + '_'.repeat(50000) + 'b';
    // Result exceeds 40 chars (underscores are kept, not collapsed) -> rejected,
    // exactly as the old impl would have after the (now-linear) strip.
    assert.throws(() => normalizeProvider(pathological), BadRequestException);
  });
});

describe('stripSurroundingUnderscores', () => {
  it('strips leading and trailing underscores only, keeping the interior', () => {
    assert.equal(stripSurroundingUnderscores('__ab__'), 'ab');
    assert.equal(stripSurroundingUnderscores('a__b'), 'a__b');
    assert.equal(stripSurroundingUnderscores('___'), '');
    assert.equal(stripSurroundingUnderscores(''), '');
    assert.equal(stripSurroundingUnderscores('nostrip'), 'nostrip');
  });
  it('is linear on a long underscore run flanked by non-underscores (no backtracking)', () => {
    const s = 'a' + '_'.repeat(50000) + 'b';
    // Interior underscores are neither leading nor trailing -> returned intact.
    assert.equal(stripSurroundingUnderscores(s), s);
  });
});

describe("normalizeRouteGroup", () => {
  it("defaults to main and rejects over-long groups", () => {
    assert.equal(normalizeRouteGroup(undefined), "main");
    assert.equal(normalizeRouteGroup("  gaming  "), "gaming");
    assert.throws(() => normalizeRouteGroup("x".repeat(81)), BadRequestException);
  });
});

describe("normalizeCountryCode", () => {
  it("uppercases valid two-letter codes, null when empty", () => {
    assert.equal(normalizeCountryCode("ir"), "IR");
    assert.equal(normalizeCountryCode(null), null);
  });
  it("rejects non-ISO codes", () => {
    assert.throws(() => normalizeCountryCode("Ireland"), BadRequestException);
    assert.throws(() => normalizeCountryCode("1R"), BadRequestException);
  });
});

describe("normalizeDetectionSource", () => {
  it("accepts known sources, null when empty", () => {
    assert.equal(normalizeDetectionSource("client_app"), "client_app");
    assert.equal(normalizeDetectionSource(null), null);
  });
  it("rejects unknown sources", () => {
    assert.throws(() => normalizeDetectionSource("gps"), BadRequestException);
  });
});

describe("normalizeJsonStringArray", () => {
  it("parses a JSON array and keeps only strings", () => {
    assert.deepEqual(normalizeJsonStringArray(JSON.stringify(["a", 1, "b", null])), ["a", "b"]);
  });
  it("returns [] for non-array / bad JSON", () => {
    assert.deepEqual(normalizeJsonStringArray("not json"), []);
    assert.deepEqual(normalizeJsonStringArray("{}"), []);
  });
});

describe("normalizeRewardedAdSettingsToken", () => {
  it("lowercases and sanitizes, rejects empty/too-long", () => {
    assert.equal(normalizeRewardedAdSettingsToken("My Provider!", "provider"), "my_provider_");
    assert.throws(() => normalizeRewardedAdSettingsToken("", "provider"), BadRequestException);
    assert.throws(() => normalizeRewardedAdSettingsToken("a".repeat(81), "provider"), BadRequestException);
  });
});

describe("normalizeSubscriptionProtocol", () => {
  it("lowercases and maps the local-proxy alias to vless", () => {
    assert.equal(normalizeSubscriptionProtocol("VLESS"), "vless");
    assert.equal(normalizeSubscriptionProtocol("vless-local-proxy"), "vless");
    assert.equal(normalizeSubscriptionProtocol("WireGuard"), "wireguard");
  });
});

describe("normalizePublicEndpointValue", () => {
  it("accepts a clean endpoint", () => {
    assert.equal(normalizePublicEndpointValue(" de.example.com:443 "), "de.example.com:443");
  });
  it("rejects quotes/brackets/backslash and secret-like words", () => {
    assert.equal(normalizePublicEndpointValue("a<b"), null);
    assert.equal(normalizePublicEndpointValue(`x${String.fromCharCode(92)}y`), null);
    assert.equal(normalizePublicEndpointValue("my-secret-host"), null);
    assert.equal(normalizePublicEndpointValue("a".repeat(161)), null);
  });
});
