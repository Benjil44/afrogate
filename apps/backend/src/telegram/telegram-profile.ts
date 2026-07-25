import { BadRequestException } from '@nestjs/common';

/**
 * Pure, node --test loadable logic for the Telegram bot-profile publisher
 * (name / about / description shown on the bot's Telegram profile).
 *
 * The Telegram Bot API exposes these as three getter/setter pairs, each with a
 * hard length cap (documented at core.telegram.org/bots/api):
 *   - name              → getMyName / setMyName                (<= 64 chars)
 *   - short_description → getMyShortDescription / setMyShortDescription (<= 120)
 *   - description       → getMyDescription / setMyDescription  (<= 512)
 *
 * This module intentionally imports ONLY `@nestjs/common` so the state machine
 * (which changed fields turn into which setter calls) and the Telegram response
 * parsing/error mapping are unit-testable without a database or network. The bot
 * token never appears here — it is injected by TelegramProfileService at the
 * HTTP boundary and never crosses back to any client.
 */

export type TelegramProfileFieldKey = 'name' | 'shortDescription' | 'description';

/** Resolved profile as shown in the dashboard (nulls when Telegram has none set). */
export interface TelegramBotProfile {
  name: string | null;
  shortDescription: string | null;
  description: string | null;
}

/** Publish request: each field is optional; only provided + changed fields publish. */
export interface TelegramBotProfileUpdate {
  name?: string;
  shortDescription?: string;
  description?: string;
}

/** Resolved profile plus whether a bot token is configured server-side. */
export interface TelegramBotProfileState extends TelegramBotProfile {
  tokenConfigured: boolean;
}

/**
 * The graceful "no bot token saved" state: null fields + tokenConfigured false.
 * Returned by GET so a missing token is a clear prompt, never a 500.
 */
export function tokenNotConfiguredState(): TelegramBotProfileState {
  return { name: null, shortDescription: null, description: null, tokenConfigured: false };
}

/** Hard Telegram Bot API length caps (characters), enforced before publishing. */
export const TELEGRAM_PROFILE_LIMITS: Readonly<Record<TelegramProfileFieldKey, number>> = {
  name: 64,
  shortDescription: 120,
  description: 512,
};

/** Telegram getter method + the field it returns inside `result`. */
type TelegramGetterMethod = 'getMyName' | 'getMyShortDescription' | 'getMyDescription';
/** Telegram setter method + the JSON body key it expects. */
type TelegramSetterMethod = 'setMyName' | 'setMyShortDescription' | 'setMyDescription';
type TelegramResultField = 'name' | 'short_description' | 'description';

interface TelegramProfileFieldSpec {
  field: TelegramProfileFieldKey;
  getter: TelegramGetterMethod;
  setter: TelegramSetterMethod;
  /** JSON key used both in the getMy* `result` and in the setMy* request body. */
  apiKey: TelegramResultField;
  limit: number;
}

/** Single source of truth for the field ↔ Telegram method mapping. */
export const TELEGRAM_PROFILE_FIELDS: readonly TelegramProfileFieldSpec[] = [
  { field: 'name', getter: 'getMyName', setter: 'setMyName', apiKey: 'name', limit: TELEGRAM_PROFILE_LIMITS.name },
  {
    field: 'shortDescription',
    getter: 'getMyShortDescription',
    setter: 'setMyShortDescription',
    apiKey: 'short_description',
    limit: TELEGRAM_PROFILE_LIMITS.shortDescription,
  },
  {
    field: 'description',
    getter: 'getMyDescription',
    setter: 'setMyDescription',
    apiKey: 'description',
    limit: TELEGRAM_PROFILE_LIMITS.description,
  },
];

/** One planned Telegram setter invocation for a changed field. */
export interface TelegramProfileSetterCall {
  field: TelegramProfileFieldKey;
  method: TelegramSetterMethod;
  /** Request-body key Telegram expects (name | short_description | description). */
  bodyKey: TelegramResultField;
  /** Trimmed value to publish (already length-validated). */
  value: string;
}

/**
 * Decide which setter calls a publish request implies. A field is published only
 * when it is (a) provided, (b) non-empty after trim, and (c) different from the
 * current live value — so unchanged fields never hit Telegram. Length is
 * validated (throwing 400) BEFORE the changed-check so an over-long value is
 * always rejected. Empty/undefined fields are skipped (never clear an existing
 * value — clearing a Telegram profile field is done in @BotFather).
 */
export function planTelegramProfileUpdate(
  current: TelegramBotProfile,
  requested: TelegramBotProfileUpdate,
): TelegramProfileSetterCall[] {
  const calls: TelegramProfileSetterCall[] = [];

  for (const spec of TELEGRAM_PROFILE_FIELDS) {
    const raw = requested[spec.field];
    if (raw === undefined || raw === null) continue;

    const value = String(raw).trim();
    if (value === '') continue;

    if (value.length > spec.limit) {
      throw new BadRequestException(`${spec.field} must be at most ${spec.limit} characters`);
    }

    const currentValue = (current[spec.field] ?? '').trim();
    if (value === currentValue) continue;

    calls.push({ field: spec.field, method: spec.setter, bodyKey: spec.apiKey, value });
  }

  return calls;
}

/**
 * Extract a string field from a Telegram getMy* response body. Returns null when
 * the response is not ok, malformed, or the field is empty/absent (an unset
 * Telegram profile field comes back as ok:true with result:{ field: "" }).
 */
export function parseTelegramResultField(body: string, field: TelegramResultField): string | null {
  const parsed = safeParse(body);
  if (!parsed || parsed.ok !== true) return null;
  const result = parsed.result;
  if (!result || typeof result !== 'object') return null;
  const value = (result as Record<string, unknown>)[field];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** True when a Telegram response body reports `ok: true` (setters return ok/result:true). */
export function isTelegramResponseOk(body: string): boolean {
  const parsed = safeParse(body);
  return parsed?.ok === true;
}

export interface TelegramApiError {
  /** Stable machine code for logs/audit (never contains secrets). */
  code: string;
  /** Operator-facing message; safe to show in the dashboard. */
  message: string;
}

/**
 * Map a failing Telegram response (non-2xx, or ok:false) to a helpful, stable
 * error — so the caller surfaces "token invalid" / "rate-limited" rather than a
 * raw 500. `statusCode` is the HTTP status; `body` may carry Telegram's
 * `{ ok:false, error_code, description }`.
 */
export function interpretTelegramApiError(statusCode: number, body: string): TelegramApiError {
  const parsed = safeParse(body);
  const description = typeof parsed?.description === 'string' ? parsed.description : '';
  const errorCode = typeof parsed?.error_code === 'number' ? parsed.error_code : statusCode;

  if (errorCode === 401 || /unauthorized/i.test(description)) {
    return {
      code: 'telegram_unauthorized',
      message: 'Telegram rejected the bot token (401 Unauthorized) — it may be invalid or revoked.',
    };
  }
  if (errorCode === 429 || /too many requests/i.test(description)) {
    return {
      code: 'telegram_rate_limited',
      message: 'Telegram is rate-limiting the bot (429) — please retry in a moment.',
    };
  }
  const suffix = description ? `: ${description}` : '';
  return {
    code: `telegram_status_${errorCode}`,
    message: `Telegram returned an error (${errorCode})${suffix}.`,
  };
}

interface TelegramEnvelope {
  ok?: unknown;
  result?: unknown;
  description?: unknown;
  error_code?: unknown;
}

function safeParse(body: string): TelegramEnvelope | null {
  try {
    const parsed = JSON.parse(body) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as TelegramEnvelope) : null;
  } catch {
    return null;
  }
}
