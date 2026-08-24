/**
 * Pure authorization decision for the Germany edge-sync endpoints. Kept free of
 * Nest decorators and relative imports so it is unit-testable under the repo's
 * node:test runner; EdgeTokenGuard maps the result to HTTP exceptions. Mirrors
 * the bearer-token.ts pattern (Bearer parse + constant-time compare via
 * node:crypto). Never logs the token.
 */
import { timingSafeEqual } from 'node:crypto';

export type EdgeAuthResult =
  | { ok: true }
  /** AFROWS_EDGE_TOKEN unset/empty → the whole edge surface is inert (503). */
  | { ok: false; reason: 'unconfigured' }
  /** No/blank Bearer token supplied (401). */
  | { ok: false; reason: 'missing' }
  /** Token present but not equal to the configured secret (401). */
  | { ok: false; reason: 'invalid' };

/** Constant-time equality (length-safe, never throws). Mirrors secureTokenEquals. */
function secureEquals(actual: string, expected: string): boolean {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function checkEdgeToken(
  authorization: string | undefined,
  expectedToken: string | undefined,
): EdgeAuthResult {
  const expected = expectedToken?.trim();
  if (!expected) return { ok: false, reason: 'unconfigured' };

  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : undefined;
  if (!token) return { ok: false, reason: 'missing' };

  if (!secureEquals(token, expected)) return { ok: false, reason: 'invalid' };
  return { ok: true };
}
