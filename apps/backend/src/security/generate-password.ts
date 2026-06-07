import { randomInt } from 'node:crypto';

// Unambiguous alphabet: no 0/O, 1/I/l to avoid hand-off transcription errors.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const MIN_LENGTH = 12;

/**
 * Generates a strong, human-transcribable password (seller hands it to the user
 * once). Uses crypto.randomInt for unbiased selection over an unambiguous set.
 */
export function generatePassword(length = 16): string {
  const size = Math.max(MIN_LENGTH, Math.floor(length));
  let out = '';
  for (let i = 0; i < size; i += 1) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}

/**
 * Normalizes a login identifier (email or handle) for storage/lookup: trims and
 * lowercases. Returns null when blank.
 */
export function normalizeLoginIdentifier(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}
