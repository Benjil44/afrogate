import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Role } from '@afrows/shared';

export const SESSION_VERSION = 1;

export interface AdminSessionPayload {
  v: number;
  sub: string;
  username: string;
  role: Role;
  type: 'admin';
  isSuperAdmin?: boolean;
  iat: number;
  exp: number;
}

/** Computes the base64url HMAC-SHA256 signature of an encoded session payload. */
export function signPayload(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}


/** True when the session payload exp (unix seconds) is at or before now. */
export function isSessionExpired(payload: AdminSessionPayload, nowSeconds: number = Math.floor(Date.now() / 1000)): boolean {
  return payload.exp <= nowSeconds;
}

/** Constant-time string comparison; false when lengths differ (never throws). */
export function constantTimeStringEquals(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

/**
 * Decodes and structurally validates a base64url-encoded session payload.
 * Returns null (never throws) for malformed JSON or missing/typed-wrong fields.
 */
export function parseSessionPayload(encodedPayload: string): AdminSessionPayload | null {
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<AdminSessionPayload>;

    if (
      typeof payload.v !== 'number'
      || typeof payload.sub !== 'string'
      || typeof payload.username !== 'string'
      || typeof payload.role !== 'string'
      || payload.type !== 'admin'
      || typeof payload.iat !== 'number'
      || typeof payload.exp !== 'number'
    ) {
      return null;
    }

    return payload as AdminSessionPayload;
  } catch {
    return null;
  }
}
