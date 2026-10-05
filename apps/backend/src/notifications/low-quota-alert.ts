/**
 * Pure decision + copy logic for the customer LOW-DATA / DATA-FINISHED Telegram
 * notice. The service owns I/O; this file owns the threshold and dedupe rules
 * so they are unit-testable under `node --test`.
 *
 * Units: all sizes are bytes; the env threshold is decimal GB (1 GB = 1e9
 * bytes), consistent with billing and the bot's formatDataSize.
 *
 *   remaining = quota_limit_bytes - used_bytes
 *   'low'       : 0 < remaining <= threshold
 *   'exhausted' : remaining <= 0   (quota enforcement cuts at used >= quota)
 *
 * Dedupe (no new table, restart-safe): every DELIVERED notice is an
 * `audit_logs` row (action LOW_QUOTA_ACTION[kind], target customer_account,
 * metadata.quotaLimitBytes). A kind is sent at most once per (account, quota
 * value). Top-ups RAISE quota_limit_bytes (never reset usage), so a top-up
 * re-arms both kinds; a later dip under the threshold alerts again. A failed
 * send records nothing and is retried on the next tick.
 *
 * Exhausted notices are only sent while the account was touched recently
 * (`updated_at`, bumped by every metering write) so the first rollout does not
 * nudge long-dormant, long-exhausted customers.
 *
 * No I/O, no decorators, no runtime relative imports.
 */

import type { TelegramCopyId, TelegramLanguage } from '../telegram/telegram-i18n';

export type LowQuotaAlertKind = 'low' | 'exhausted';

export const LOW_QUOTA_ACTION: Readonly<Record<LowQuotaAlertKind, string>> = {
  low: 'customer.low_quota.notified',
  exhausted: 'customer.quota_exhausted.notified',
};

export const LOW_QUOTA_AUDIT_TARGET_TYPE = 'customer_account';

const GB = 1_000_000_000;
export const LOW_QUOTA_DEFAULT_THRESHOLD_GB = 5;
export const LOW_QUOTA_MIN_THRESHOLD_GB = 1;
export const LOW_QUOTA_MAX_THRESHOLD_GB = 1000;
/** Check cadence. Usage is metered every ~60 s, so a 5 min tick bounds notice latency to ~6 min. */
export const LOW_QUOTA_CHECK_INTERVAL_MS = 5 * 60 * 1000;
/** Exhausted notice only for accounts with activity in this window (see header). */
export const LOW_QUOTA_EXHAUSTED_FRESH_MS = 24 * 60 * 60 * 1000;

/** `AFROWS_LOW_QUOTA_ALERT_ENABLED`: default on; 0/false/no/off disables. */
export function resolveLowQuotaEnabled(raw: string | undefined): boolean {
  const value = raw?.trim().toLowerCase();
  return !value || !['0', 'false', 'no', 'off'].includes(value);
}

/** `AFROWS_LOW_QUOTA_ALERT_GB` (decimal GB, default 5, clamp 1..1000) -> bytes. */
export function resolveLowQuotaThresholdBytes(raw: string | undefined): number {
  const parsed = raw === undefined || raw.trim() === '' ? Number.NaN : Number(raw);
  const gb = Number.isFinite(parsed)
    ? Math.min(Math.max(parsed, LOW_QUOTA_MIN_THRESHOLD_GB), LOW_QUOTA_MAX_THRESHOLD_GB)
    : LOW_QUOTA_DEFAULT_THRESHOLD_GB;
  return Math.round(gb * GB);
}

/** Which notice the CURRENT balance calls for, ignoring dedupe. null = none (no quota / plenty left). */
export function classifyQuota(
  quotaLimitBytes: number | null,
  usedBytes: number,
  thresholdBytes: number,
): LowQuotaAlertKind | null {
  if (quotaLimitBytes === null || !Number.isFinite(quotaLimitBytes) || quotaLimitBytes <= 0) return null;
  const remaining = quotaLimitBytes - (Number.isFinite(usedBytes) ? usedBytes : 0);
  if (remaining <= 0) return 'exhausted';
  if (remaining <= thresholdBytes) return 'low';
  return null;
}

export interface LowQuotaDelivery {
  kind: LowQuotaAlertKind;
  /** quota_limit_bytes at the time the notice was delivered. */
  quotaLimitBytes: number;
}

export interface LowQuotaDecisionInput {
  now: Date;
  quotaLimitBytes: number | null;
  usedBytes: number;
  thresholdBytes: number;
  /** Last activity on the account (customer_accounts.updated_at). */
  lastActivityAt: Date | null;
  /** Every delivered notice for this account (any quota value). */
  deliveries: readonly LowQuotaDelivery[];
  exhaustedFreshMs?: number;
}

export interface LowQuotaDecision {
  kind: LowQuotaAlertKind;
  quotaLimitBytes: number;
  /** quota - used, clamped at 0 (an exhausted account never shows a negative balance). */
  remainingBytes: number;
}

/** Decide whether a notice is due for one account. Deterministic in its inputs. */
export function decideLowQuotaAlert(input: LowQuotaDecisionInput): LowQuotaDecision | null {
  const kind = classifyQuota(input.quotaLimitBytes, input.usedBytes, input.thresholdBytes);
  if (!kind || input.quotaLimitBytes === null) return null;
  const quota = input.quotaLimitBytes;
  if (input.deliveries.some((d) => d.kind === kind && d.quotaLimitBytes === quota)) return null;
  if (kind === 'exhausted') {
    const freshMs = input.exhaustedFreshMs ?? LOW_QUOTA_EXHAUSTED_FRESH_MS;
    const last = input.lastActivityAt?.getTime();
    if (last === undefined || !Number.isFinite(last) || input.now.getTime() - last > freshMs) return null;
  }
  return { kind, quotaLimitBytes: quota, remainingBytes: Math.max(0, quota - input.usedBytes) };
}

/**
 * A Telegram send failure that retrying cannot fix for this chat: 400 (chat not
 * found / bad chat id) or 403 (user blocked the bot / deactivated). Recorded as
 * an undelivered notice so the account is not retried every tick. Everything
 * else (network, 429, 5xx) is transient: retried next tick.
 */
export function isPermanentTelegramFailure(statusCode: number | undefined): boolean {
  return statusCode === 400 || statusCode === 403;
}

export interface LowQuotaCopyDeps {
  render: (
    id: TelegramCopyId,
    language: TelegramLanguage,
    vars?: Record<string, string | number>,
    raw?: Record<string, string>,
  ) => string;
  rtl: (text: string, language: TelegramLanguage) => string;
  formatSize: (bytes: number, language: TelegramLanguage) => string;
}

export const LOW_QUOTA_COPY: Readonly<Record<LowQuotaAlertKind, TelegramCopyId>> = {
  low: 'notify.lowQuota',
  exhausted: 'notify.quotaExhausted',
};

/**
 * The customer's message. Follows the bot's push rule: the user's stored bot
 * language when they picked one; a user who never picked one gets both
 * (Persian first, then English) so it reads regardless. Contains only the
 * recipient's own balance — no other identifiers.
 */
export function buildLowQuotaMessage(
  decision: LowQuotaDecision,
  language: TelegramLanguage | null,
  deps: LowQuotaCopyDeps,
): string {
  const render = (lang: TelegramLanguage): string =>
    deps.rtl(
      deps.render(LOW_QUOTA_COPY[decision.kind], lang, {}, { remaining: deps.formatSize(decision.remainingBytes, lang) }),
      lang,
    );
  if (language) return render(language);
  return `${render('fa')}\n\n— — —\n\n${render('en')}`;
}
