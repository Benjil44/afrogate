import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

/**
 * Hashes a password with scrypt and encodes the parameters, salt, and digest
 * into a single `scrypt$N$r$p$salt$hash` string (all base64url).
 */
export function hashPassword(passwordInput: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(passwordInput, salt, 32, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });

  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

/**
 * Verifies a password against a stored `scrypt$...` hash using a constant-time
 * comparison. Returns false (never throws) for malformed hashes or bad input.
 */
export function verifyScryptPassword(passwordInput: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, nValue, rValue, pValue, saltValue, hashValue] = parts;
  const N = Number(nValue);
  const r = Number(rValue);
  const p = Number(pValue);

  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  try {
    const salt = Buffer.from(saltValue, 'base64url');
    const expectedHash = Buffer.from(hashValue, 'base64url');
    const actualHash = scryptSync(passwordInput, salt, expectedHash.length, {
      N,
      r,
      p,
      maxmem: SCRYPT_MAXMEM,
    });

    return expectedHash.length === actualHash.length && timingSafeEqual(actualHash, expectedHash);
  } catch {
    return false;
  }
}
