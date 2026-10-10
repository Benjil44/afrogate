/**
 * Public, refreshable subscription URL for a client config (`GET /sub/:token`).
 *
 * The token is DERIVED, never stored: token = base64url(HMAC-SHA256(secret,
 * `${clientConfigId}:${version}`)) truncated to 32 chars (192 bits). The DB keeps
 * only sha256(token) (unique index) for lookup, so a DB leak does not leak live
 * URLs, while the dashboard can still re-display the URL at any time. Rotating
 * bumps `subscription_token_version`, which changes the token and kills the old URL.
 *
 * The response is fetched by VPN apps without auth, so it carries NO customer
 * name or PII: fixed ASCII remarks and a fixed profile title.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/** A secret shorter than this disables the whole feature (no URL, route 404s). */
export const MIN_SUBSCRIPTION_SECRET_LENGTH = 32;
/** Token length in base64url chars: 32 chars = 24 bytes = 192 bits. */
export const SUBSCRIPTION_TOKEN_LENGTH = 32;
export const DEFAULT_SUBSCRIPTION_BASE_URL = 'https://app.afrows.com/sub';
/** Hours between app refreshes (`profile-update-interval`). */
export const SUBSCRIPTION_UPDATE_INTERVAL_HOURS = 12;
export const SUBSCRIPTION_PROFILE_TITLE = 'Afrows';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export interface SubscriptionSettings {
  secret: string;
  baseUrl: string;
}

/** Null (feature off) unless AFROWS_SUBSCRIPTION_SECRET is at least 32 chars. */
export function readSubscriptionSettings(env: Record<string, string | undefined>): SubscriptionSettings | null {
  const secret = env.AFROWS_SUBSCRIPTION_SECRET?.trim() ?? '';
  if (secret.length < MIN_SUBSCRIPTION_SECRET_LENGTH) return null;
  const rawBase = env.AFROWS_SUBSCRIPTION_BASE_URL?.trim() || DEFAULT_SUBSCRIPTION_BASE_URL;
  return { secret, baseUrl: rawBase.replace(/\/+$/, '') };
}

export function deriveSubscriptionToken(secret: string, clientConfigId: string, version: number): string {
  return createHmac('sha256', secret)
    .update(`${clientConfigId}:${version}`)
    .digest('base64url')
    .slice(0, SUBSCRIPTION_TOKEN_LENGTH);
}

/** sha256 hex of the token, the only form persisted (lookup key). */
export function hashSubscriptionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Strict shape check, run BEFORE any DB access. */
export function isWellFormedSubscriptionToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_PATTERN.test(value);
}

/** Constant-time comparison of a presented token with the one recomputed for the row. */
export function subscriptionTokenMatches(
  secret: string,
  clientConfigId: string,
  version: number,
  presented: string,
): boolean {
  if (!isWellFormedSubscriptionToken(presented)) return false;
  const expected = Buffer.from(deriveSubscriptionToken(secret, clientConfigId, version), 'utf8');
  const actual = Buffer.from(presented, 'utf8');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function buildSubscriptionUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/${token}`;
}

/** Short, non-reversible tag safe to log (never log the token itself). */
export function subscriptionLogTag(token: string): string {
  return hashSubscriptionToken(token).slice(0, 8);
}

export interface SubscriptionUsageInput {
  accountUsedBytes: number;
  accountQuotaLimitBytes: number | null;
  clientUsedBytes: number;
  /** Config-level limit, falling back to the account's per-client limit. */
  clientQuotaLimitBytes: number | null;
}

/**
 * The (used, total) pair shown by the app: whichever limit binds first (least
 * remaining), so the app's bar matches what enforcement cuts on. No limit at all
 * reports total 0 (= unlimited in the subscription-userinfo convention) with the
 * account usage.
 */
export function pickSubscriptionUsage(input: SubscriptionUsageInput): { usedBytes: number; totalBytes: number } {
  const candidates: Array<{ usedBytes: number; totalBytes: number }> = [];
  if (input.accountQuotaLimitBytes !== null) {
    candidates.push({ usedBytes: input.accountUsedBytes, totalBytes: input.accountQuotaLimitBytes });
  }
  if (input.clientQuotaLimitBytes !== null) {
    candidates.push({ usedBytes: input.clientUsedBytes, totalBytes: input.clientQuotaLimitBytes });
  }
  if (!candidates.length) return { usedBytes: clampBytes(input.accountUsedBytes), totalBytes: 0 };
  const binding = candidates.reduce((best, next) =>
    next.totalBytes - next.usedBytes < best.totalBytes - best.usedBytes ? next : best,
  );
  return { usedBytes: clampBytes(binding.usedBytes), totalBytes: clampBytes(binding.totalBytes) };
}

export interface SubscriptionPayloadInput {
  uris: string[];
  usedBytes: number;
  totalBytes: number;
  /** Account expiry, or null for never. */
  expiresAt: Date | null;
}

export interface SubscriptionPayload {
  body: string;
  headers: Record<string, string>;
}

/** Body = base64 of the URIs joined by "\n"; headers per the v2rayN/Hiddify convention. */
export function buildSubscriptionPayload(input: SubscriptionPayloadInput): SubscriptionPayload {
  const expire = input.expiresAt && Number.isFinite(input.expiresAt.getTime())
    ? Math.max(0, Math.floor(input.expiresAt.getTime() / 1000))
    : 0;
  return {
    body: Buffer.from(input.uris.join('\n'), 'utf8').toString('base64'),
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'profile-title': `base64:${Buffer.from(SUBSCRIPTION_PROFILE_TITLE, 'utf8').toString('base64')}`,
      'profile-update-interval': String(SUBSCRIPTION_UPDATE_INTERVAL_HOURS),
      'subscription-userinfo':
        `upload=0; download=${clampBytes(input.usedBytes)}; total=${clampBytes(input.totalBytes)}; expire=${expire}`,
    },
  };
}

function clampBytes(value: number): number {
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}
