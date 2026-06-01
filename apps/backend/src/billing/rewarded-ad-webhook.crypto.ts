import { createHmac, timingSafeEqual } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';

export const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;
const MIN_TOLERANCE_SECONDS = 30;
const MAX_TOLERANCE_SECONDS = 3600;

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sortValue(item));
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortValue(item)]),
  );
}

/** Deterministic JSON with sorted keys and dropped `undefined`, so signatures are stable across key order. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

/** HMAC-SHA256 over `${timestamp}.${canonicalPayload}`, hex-encoded. */
export function computeRewardedAdSignature(secret: string, timestamp: string, canonicalPayload: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${canonicalPayload}`, 'utf8').digest('hex');
}

/** Strips an optional `sha256=` prefix and validates a 64-char hex signature (throws otherwise). */
export function normalizeHexSignature(value: string | undefined): string {
  const normalized = value?.trim().replace(/^sha256=/i, '') ?? '';
  if (!/^[a-f0-9]{64}$/i.test(normalized)) {
    throw new UnauthorizedException('Rewarded ad webhook signature is invalid');
  }
  return normalized.toLowerCase();
}

/** Constant-time comparison of two hex signatures; false on length mismatch. */
export function secureHexCompare(leftHex: string, rightHex: string): boolean {
  const left = Buffer.from(leftHex, 'hex');
  const right = Buffer.from(rightHex, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Clamps a configured tolerance to [30, 3600] seconds, falling back to the default. */
export function clampToleranceSeconds(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return DEFAULT_WEBHOOK_TOLERANCE_SECONDS;
  return Math.min(Math.max(parsed, MIN_TOLERANCE_SECONDS), MAX_TOLERANCE_SECONDS);
}

/** True when `timestamp` parses and is within `toleranceSeconds` of `nowMs`. */
export function isTimestampFresh(timestamp: string, toleranceSeconds: number, nowMs: number = Date.now()): boolean {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return false;
  const ageSeconds = Math.abs(nowMs - date.getTime()) / 1000;
  return ageSeconds <= toleranceSeconds;
}
