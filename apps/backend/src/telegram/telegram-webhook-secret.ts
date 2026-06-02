import { timingSafeEqual } from 'node:crypto';

/**
 * Constant-time match of the configured Telegram webhook secret against the
 * value presented in the request header. False when either side is missing or
 * lengths differ (never throws).
 */
export function telegramWebhookSecretMatches(expected: string | undefined, provided: string | undefined): boolean {
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}
