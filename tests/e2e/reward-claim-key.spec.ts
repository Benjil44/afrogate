import { expect, test } from '@playwright/test';
// Direct app-module import — same pattern as ./helpers/persian.ts importing
// the dashboard i18n flag. Pure node-side assertions; no page/browser needed.
import {
  createRewardClaimKey,
  CLAIM_KEY_PREFIX,
  type ClaimKeyCrypto,
} from '../../apps/client/src/reward-claim-key';

// Regression guards for CodeQL js/insecure-randomness (alert #2): the claim key
// doubles as adSessionId AND idempotencyKey, so it must stay CSPRNG-derived on
// EVERY path. All tests below are deterministic — no statistical sampling.

test.describe('createRewardClaimKey security contract', () => {
  test('primary path: client-ad: prefix + randomUUID output, verbatim', () => {
    const stub: ClaimKeyCrypto = {
      randomUUID: () => '01234567-89ab-4cde-8f01-23456789abcd',
      getRandomValues: () => {
        throw new Error('primary path must not touch getRandomValues');
      },
    };
    expect(createRewardClaimKey(stub)).toBe(`${CLAIM_KEY_PREFIX}01234567-89ab-4cde-8f01-23456789abcd`);
  });

  test('fallback path activates when randomUUID is unavailable and uses getRandomValues', () => {
    let called = 0;
    const stub: ClaimKeyCrypto = {
      // no randomUUID — forces the fallback branch
      getRandomValues: (array) => {
        called += 1;
        for (let i = 0; i < array.length; i++) array[i] = i; // 00 01 02 ... 0f
        return array;
      },
    };
    const key = createRewardClaimKey(stub);
    expect(called).toBe(1);
    // Fully determined by the injected CSPRNG bytes: if Date.now()/Math.random
    // ever re-entered the fallback, this exact-equality assertion would fail.
    expect(key).toBe(`${CLAIM_KEY_PREFIX}000102030405060708090a0b0c0d0e0f`);
  });

  test('fallback shape: 128-bit lowercase-hex suffix, single colon, no timestamp segment', () => {
    const stub: ClaimKeyCrypto = {
      getRandomValues: (array) => {
        for (let i = 0; i < array.length; i++) array[i] = 0xff;
        return array;
      },
    };
    const key = createRewardClaimKey(stub);
    expect(key).toMatch(/^client-ad:[0-9a-f]{32}$/);
    // The old insecure format was `client-ad:<Date.now()>:<rand>` — two colons.
    expect(key.split(':').length - 1).toBe(1);
    expect(key.length).toBe(CLAIM_KEY_PREFIX.length + 32);
  });

  test('real crypto default: prefixed, well-formed, unique per call, under the backend 160-char cap', () => {
    const a = createRewardClaimKey();
    const b = createRewardClaimKey();
    const shape = /^client-ad:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32})$/;
    expect(a).toMatch(shape);
    expect(b).toMatch(shape);
    expect(a).not.toBe(b);
    expect(a.length).toBeLessThanOrEqual(160); // ClaimRewardedAdDto @MaxLength(160)
  });
});
