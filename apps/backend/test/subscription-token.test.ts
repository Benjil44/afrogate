import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  buildSubscriptionPayload,
  buildSubscriptionUrl,
  DEFAULT_SUBSCRIPTION_BASE_URL,
  deriveSubscriptionToken,
  hashSubscriptionToken,
  isWellFormedSubscriptionToken,
  pickSubscriptionUsage,
  readSubscriptionSettings,
  SUBSCRIPTION_TOKEN_LENGTH,
  subscriptionLogTag,
  subscriptionTokenMatches,
} from '../src/client/subscription-token.ts';

const SECRET = 'x'.repeat(40);
const CONFIG_ID = '0f6c2c3a-8a59-4c1e-9d0e-5b8f7a1d2e3f';

describe('subscription token', () => {
  it('is deterministic HMAC-SHA256 base64url truncated to 32 chars (192 bits)', () => {
    const token = deriveSubscriptionToken(SECRET, CONFIG_ID, 1);
    const expected = createHmac('sha256', SECRET).update(`${CONFIG_ID}:1`).digest('base64url').slice(0, 32);
    assert.equal(token, expected);
    assert.equal(token.length, SUBSCRIPTION_TOKEN_LENGTH);
    assert.equal(deriveSubscriptionToken(SECRET, CONFIG_ID, 1), token);
    assert.ok(isWellFormedSubscriptionToken(token));
  });

  it('changes when the version is rotated, the config differs, or the secret differs', () => {
    const v1 = deriveSubscriptionToken(SECRET, CONFIG_ID, 1);
    assert.notEqual(deriveSubscriptionToken(SECRET, CONFIG_ID, 2), v1);
    assert.notEqual(deriveSubscriptionToken(SECRET, '11111111-1111-4111-8111-111111111111', 1), v1);
    assert.notEqual(deriveSubscriptionToken('y'.repeat(40), CONFIG_ID, 1), v1);
  });

  it('stores only the sha256 hex of the token', () => {
    const token = deriveSubscriptionToken(SECRET, CONFIG_ID, 1);
    assert.equal(hashSubscriptionToken(token), createHash('sha256').update(token).digest('hex'));
    assert.match(hashSubscriptionToken(token), /^[0-9a-f]{64}$/);
  });

  it('validates the token shape strictly', () => {
    const token = deriveSubscriptionToken(SECRET, CONFIG_ID, 1);
    for (const bad of [
      '',
      token.slice(0, 31),
      `${token}A`,
      `${token.slice(0, 31)}=`,
      `${token.slice(0, 31)}/`,
      `${token.slice(0, 31)}.`,
      '../../../../etc/passwd/aaaaaaaaaaa',
      ' '.repeat(32),
      undefined,
      null,
      12345,
    ]) {
      assert.equal(isWellFormedSubscriptionToken(bad), false, `accepted ${String(bad)}`);
    }
  });

  it('compares in constant time and rejects a stale (pre-rotation) token', () => {
    const v1 = deriveSubscriptionToken(SECRET, CONFIG_ID, 1);
    assert.equal(subscriptionTokenMatches(SECRET, CONFIG_ID, 1, v1), true);
    assert.equal(subscriptionTokenMatches(SECRET, CONFIG_ID, 2, v1), false);
    assert.equal(subscriptionTokenMatches(SECRET, CONFIG_ID, 1, `${v1.slice(0, 31)}${v1[31] === 'A' ? 'B' : 'A'}`), false);
    assert.equal(subscriptionTokenMatches(SECRET, CONFIG_ID, 1, 'short'), false);
  });

  it('is disabled when the secret is missing or shorter than 32 chars', () => {
    assert.equal(readSubscriptionSettings({}), null);
    assert.equal(readSubscriptionSettings({ AFROWS_SUBSCRIPTION_SECRET: 'a'.repeat(31) }), null);
    assert.equal(readSubscriptionSettings({ AFROWS_SUBSCRIPTION_SECRET: `  ${'a'.repeat(31)}  ` }), null);
    const on = readSubscriptionSettings({ AFROWS_SUBSCRIPTION_SECRET: 'a'.repeat(32) });
    assert.deepEqual(on, { secret: 'a'.repeat(32), baseUrl: DEFAULT_SUBSCRIPTION_BASE_URL });
  });

  it('builds the URL from the configured base, trimming trailing slashes', () => {
    const settings = readSubscriptionSettings({
      AFROWS_SUBSCRIPTION_SECRET: SECRET,
      AFROWS_SUBSCRIPTION_BASE_URL: 'https://panel.example/sub//',
    });
    assert.equal(settings?.baseUrl, 'https://panel.example/sub');
    assert.equal(buildSubscriptionUrl(settings!.baseUrl, 'T'.repeat(32)), `https://panel.example/sub/${'T'.repeat(32)}`);
  });

  it('logs only an 8-char hash prefix', () => {
    const token = deriveSubscriptionToken(SECRET, CONFIG_ID, 1);
    const tag = subscriptionLogTag(token);
    assert.equal(tag.length, 8);
    assert.ok(!token.includes(tag));
  });
});

describe('subscription payload', () => {
  const germany = 'vless://u@de.example:443?security=tls#Afrows%20Germany';
  const iran = 'vless://u@1.2.3.4:443?security=tls#Afrows%20Shatel';

  it('body is base64 of both URIs joined by newline', () => {
    const { body } = buildSubscriptionPayload({ uris: [germany, iran], usedBytes: 5, totalBytes: 10, expiresAt: null });
    assert.equal(Buffer.from(body, 'base64').toString('utf8'), `${germany}\n${iran}`);
    assert.ok(body.length < 4096);
  });

  it('emits the subscription headers in the exact format', () => {
    const { headers } = buildSubscriptionPayload({
      uris: [germany],
      usedBytes: 1_500_000_000,
      totalBytes: 20_000_000_000,
      expiresAt: new Date('2026-12-01T00:00:00Z'),
    });
    assert.equal(headers['Content-Type'], 'text/plain; charset=utf-8');
    assert.equal(headers['Cache-Control'], 'no-store');
    assert.equal(headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(headers['profile-update-interval'], '12');
    assert.equal(headers['profile-title'], `base64:${Buffer.from('Afrows').toString('base64')}`);
    assert.equal(
      headers['subscription-userinfo'],
      'upload=0; download=1500000000; total=20000000000; expire=1796083200',
    );
  });

  it('reports unlimited/no-expiry as 0 and clamps bad numbers', () => {
    const { headers } = buildSubscriptionPayload({ uris: [germany], usedBytes: -3, totalBytes: Number.NaN, expiresAt: null });
    assert.equal(headers['subscription-userinfo'], 'upload=0; download=0; total=0; expire=0');
  });

  it('carries no customer name or PII (fixed title and remarks only)', () => {
    const payload = buildSubscriptionPayload({ uris: [germany, iran], usedBytes: 0, totalBytes: 0, expiresAt: null });
    const everything = `${Buffer.from(payload.body, 'base64').toString('utf8')}\n${Object.values(payload.headers).join('\n')}`;
    assert.ok(!/ben|sara|\+98|@gmail/i.test(everything));
    assert.ok(Object.values(payload.headers).every((value) => /^[\x20-\x7e]*$/.test(value)), 'headers are ASCII');
  });
});

describe('pickSubscriptionUsage', () => {
  it('uses the binding (least remaining) limit', () => {
    assert.deepEqual(
      pickSubscriptionUsage({ accountUsedBytes: 8e9, accountQuotaLimitBytes: 10e9, clientUsedBytes: 1e9, clientQuotaLimitBytes: 5e9 }),
      { usedBytes: 8e9, totalBytes: 10e9 },
    );
    assert.deepEqual(
      pickSubscriptionUsage({ accountUsedBytes: 1e9, accountQuotaLimitBytes: 50e9, clientUsedBytes: 4e9, clientQuotaLimitBytes: 5e9 }),
      { usedBytes: 4e9, totalBytes: 5e9 },
    );
  });

  it('reports total 0 (unlimited) with account usage when no limit applies', () => {
    assert.deepEqual(
      pickSubscriptionUsage({ accountUsedBytes: 7, accountQuotaLimitBytes: null, clientUsedBytes: 3, clientQuotaLimitBytes: null }),
      { usedBytes: 7, totalBytes: 0 },
    );
  });

  it('keeps over-quota usage visible (used > total)', () => {
    assert.deepEqual(
      pickSubscriptionUsage({ accountUsedBytes: 12e9, accountQuotaLimitBytes: 10e9, clientUsedBytes: 0, clientQuotaLimitBytes: null }),
      { usedBytes: 12e9, totalBytes: 10e9 },
    );
  });
});
