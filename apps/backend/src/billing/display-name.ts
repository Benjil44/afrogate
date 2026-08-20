import { randomInt } from 'crypto';

/**
 * Random customer display-name generation, kept in a pure self-contained module
 * (no NestJS imports) so the `node --test` runner can load it directly and pin
 * its contract - the same structure/reasoning as ./gems.ts.
 */

/** Lookalike-free alphabet: uppercase + digits minus 0/O and 1/I/L (31 chars). */
export const DISPLAY_NAME_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const DISPLAY_NAME_CODE_LENGTH = 6;

/**
 * A friendly, unambiguous random display name for customers the operator
 * created without filling one in (e.g. "Customer-K7M3PQ").
 *
 * Uses Node's `crypto.randomInt(max)`, which draws a cryptographically-secure,
 * UNIFORM integer in [0, max) (it rejection-samples internally) - so every
 * alphabet character is equally likely. Reducing a raw random byte with
 * `% alphabet.length` would be biased: 256 = 8*31 + 8, so the first 8
 * characters (A-H) would each draw from 9 byte values instead of 8
 * (CodeQL js/biased-cryptographic-random). Same uniform-selection pattern as
 * `generateReferralCode` in ./gems.ts. `randomIndex` is injectable so tests
 * can pin the selection contract deterministically.
 */
export function generateCustomerDisplayName(
  randomIndex: (max: number) => number = randomInt,
): string {
  let code = '';
  for (let i = 0; i < DISPLAY_NAME_CODE_LENGTH; i++) {
    code += DISPLAY_NAME_ALPHABET[randomIndex(DISPLAY_NAME_ALPHABET.length)];
  }
  return `Customer-${code}`;
}
