// Rewarded-ad claim-key generation, extracted to a pure module so the e2e
// suite can import it directly (same pattern as tests/e2e/helpers/persian.ts
// importing dashboard i18n) and pin its security contract.
//
// The key doubles as BOTH adSessionId and idempotencyKey for reward claims,
// so predictability is security-relevant (CodeQL js/insecure-randomness).
// Every path below draws from a CSPRNG; there is deliberately no Math.random
// or Date.now() anywhere in this module.

/** The subset of the Web Crypto surface this module needs; injectable for tests. */
export interface ClaimKeyCrypto {
  randomUUID?: () => string;
  getRandomValues: (array: Uint8Array) => Uint8Array;
}

export const CLAIM_KEY_PREFIX = 'client-ad:';

export function createRewardClaimKey(
  cryptoLike: ClaimKeyCrypto = globalThis.crypto,
): string {
  if (typeof cryptoLike.randomUUID === 'function') {
    return `${CLAIM_KEY_PREFIX}${cryptoLike.randomUUID()}`;
  }

  // Non-secure-context fallback (randomUUID unavailable): build a 128-bit
  // CSPRNG hex suffix so the claim key stays unpredictable per click.
  const bytes = cryptoLike.getRandomValues(new Uint8Array(16));
  const suffix = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${CLAIM_KEY_PREFIX}${suffix}`;
}
