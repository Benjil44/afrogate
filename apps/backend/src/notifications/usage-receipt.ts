/**
 * Pure decision + copy logic for the customer USAGE RECEIPT ("you've passed 50%,
 * renew by card") Telegram notice. The service owns I/O; this file owns the
 * threshold, plan filter, dedupe, and Persian copy so they are unit-testable
 * under `node --test`.
 *
 * Policy (owner decisions, 2026-11-12):
 *   - Fires once an active account has used >= PCT% of its quota (default 50%).
 *   - ONLY for plans >= MIN_PLAN (default 50 GB): the owner does not want the
 *     small 25 GB plans nudged. Bigger plans are included.
 *   - Persian-only copy ("very easy"), card-to-card renewal, with a button that
 *     drops the customer into the EXISTING receipt -> approve flow (afws:buy).
 *
 * Dedupe (no new table, restart-safe): every DELIVERED notice is an audit_logs
 * row (action USAGE_RECEIPT_ACTION, target customer_account, metadata.quotaLimitBytes).
 * At most one notice per (account, quota value). A top-up RAISES quota_limit_bytes,
 * which re-arms the notice for the next cycle.
 *
 * No I/O, no decorators, no runtime relative imports (keeps it node --test loadable).
 */

import type { TelegramCopyId, TelegramLanguage } from '../telegram/telegram-i18n';

export const USAGE_RECEIPT_ACTION = 'customer.usage_receipt.notified';
export const USAGE_RECEIPT_AUDIT_TARGET_TYPE = 'customer_account';

/** Decimal GB (1 GB = 1e9 bytes), consistent with billing/quota-math. */
const GB = 1_000_000_000;

export const USAGE_RECEIPT_DEFAULT_PCT = 50;
export const USAGE_RECEIPT_MIN_PCT = 1;
export const USAGE_RECEIPT_MAX_PCT = 99;
export const USAGE_RECEIPT_DEFAULT_MIN_PLAN_GB = 50;
/** Check cadence; usage is metered every ~60 s, so 5 min bounds notice latency to ~6 min. */
export const USAGE_RECEIPT_CHECK_INTERVAL_MS = 5 * 60 * 1000;

export const USAGE_RECEIPT_COPY: TelegramCopyId = 'notify.usageReceipt';
export const USAGE_RECEIPT_BTN_COPY: TelegramCopyId = 'notify.usageReceipt.btn';

/** `AFROWS_USAGE_RECEIPT_ENABLED`: default on; 0/false/no/off disables. */
export function resolveUsageReceiptEnabled(raw: string | undefined): boolean {
  const value = raw?.trim().toLowerCase();
  return !value || !['0', 'false', 'no', 'off'].includes(value);
}

/** `AFROWS_USAGE_RECEIPT_PCT` (default 50, clamp 1..99). */
export function resolveUsageReceiptPct(raw: string | undefined): number {
  const parsed = raw === undefined || raw.trim() === '' ? Number.NaN : Number(raw);
  if (!Number.isFinite(parsed)) return USAGE_RECEIPT_DEFAULT_PCT;
  return Math.min(Math.max(Math.round(parsed), USAGE_RECEIPT_MIN_PCT), USAGE_RECEIPT_MAX_PCT);
}

/** `AFROWS_USAGE_RECEIPT_MIN_PLAN_GB` (decimal GB, default 50, >= 0) -> bytes. */
export function resolveUsageReceiptMinPlanBytes(raw: string | undefined): number {
  const parsed = raw === undefined || raw.trim() === '' ? Number.NaN : Number(raw);
  const gb = Number.isFinite(parsed) && parsed >= 0 ? parsed : USAGE_RECEIPT_DEFAULT_MIN_PLAN_GB;
  return Math.round(gb * GB);
}

/**
 * True when CYCLE usage >= pct% of the cycle size (C6/0.128.0: moved from absolute
 * used/quota to CYCLE percentage). cyclePct = (used − cycleStart) / (quota − cycleStart).
 * A non-positive cycle size (brand-new / just-anchored) is never due.
 */
export function classifyUsageReceipt(
  quotaLimitBytes: number | null,
  usedBytes: number,
  cycleStartUsedBytes: number,
  thresholdPct: number,
): boolean {
  if (quotaLimitBytes === null || !Number.isFinite(quotaLimitBytes) || quotaLimitBytes <= 0) return false;
  const cycleStart = Number.isFinite(cycleStartUsedBytes) ? Math.max(0, cycleStartUsedBytes) : 0;
  const denom = quotaLimitBytes - cycleStart;
  if (denom <= 0) return false;
  const used = Number.isFinite(usedBytes) ? usedBytes : 0;
  return (used - cycleStart) * 100 >= denom * thresholdPct;
}

export interface UsageReceiptDelivery {
  /** quota_limit_bytes at the time a prior notice was delivered. */
  quotaLimitBytes: number;
}

export interface UsageReceiptDecisionInput {
  quotaLimitBytes: number | null;
  usedBytes: number;
  /** used_bytes anchor at the start of the current paid cycle (customer_accounts.cycle_start_used_bytes). */
  cycleStartUsedBytes: number;
  thresholdPct: number;
  minPlanBytes: number;
  deliveries: readonly UsageReceiptDelivery[];
}

export interface UsageReceiptDecision {
  quotaLimitBytes: number;
  usedBytes: number;
  /** quota - used, clamped at 0. */
  remainingBytes: number;
  /** used / quota as a percentage, one decimal. */
  percentUsed: number;
}

/** Decide whether a usage receipt is due for one account. Deterministic in its inputs. */
export function decideUsageReceipt(input: UsageReceiptDecisionInput): UsageReceiptDecision | null {
  const quota = input.quotaLimitBytes;
  if (quota === null || !Number.isFinite(quota) || quota <= 0) return null;
  if (quota < input.minPlanBytes) return null; // plan filter (>= 50 GB)
  const used = Number.isFinite(input.usedBytes) ? input.usedBytes : 0;
  const cycleStart = Number.isFinite(input.cycleStartUsedBytes) ? Math.max(0, input.cycleStartUsedBytes) : 0;
  if (!classifyUsageReceipt(quota, used, cycleStart, input.thresholdPct)) return null;
  if (input.deliveries.some((d) => d.quotaLimitBytes === quota)) return null; // already sent this cycle
  const denom = quota - cycleStart;
  return {
    quotaLimitBytes: quota,
    usedBytes: used,
    remainingBytes: Math.max(0, quota - used),
    // Cycle usage percentage (one decimal), consistent with the new cycle threshold.
    percentUsed: denom > 0 ? Math.round((1000 * (used - cycleStart)) / denom) / 10 : 0,
  };
}

/**
 * A Telegram send failure that retrying cannot fix for this chat: 400 (chat not
 * found / bad id) or 403 (user blocked the bot). Recorded as an undelivered notice
 * so the account is not retried every tick. Everything else is transient.
 */
export function isPermanentTelegramFailure(statusCode: number | undefined): boolean {
  return statusCode === 400 || statusCode === 403;
}

// --- Persian formatting + copy -------------------------------------------------

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** Latin digits -> Persian digits (card numbers/sizes read naturally for the audience). */
export function toFaDigits(value: string): string {
  return value.replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/** Bytes -> "۸.۷ گیگ" (decimal GB, one decimal, trailing .0 trimmed, Persian digits). */
export function formatGbFa(bytes: number): string {
  const gb = (Number.isFinite(bytes) ? bytes : 0) / GB;
  const rounded = Math.round(gb * 10) / 10;
  const str = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${toFaDigits(str)} گیگ`;
}

/** Percent number -> "۸۲.۶٪" (one decimal, Persian digits). */
export function formatPercentFa(percent: number): string {
  const rounded = Math.round((Number.isFinite(percent) ? percent : 0) * 10) / 10;
  const str = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${toFaDigits(str)}٪`;
}

export interface CardToCard {
  card: string;
  holder: string;
}

/** Parse the settings `card_to_card_info` ("number|holder"); null if no card configured. */
export function parseCardToCard(info: string | null | undefined): CardToCard | null {
  if (!info) return null;
  const trimmed = info.trim();
  if (!trimmed) return null;
  const idx = trimmed.indexOf('|');
  if (idx === -1) return { card: trimmed, holder: '' };
  return { card: trimmed.slice(0, idx).trim(), holder: trimmed.slice(idx + 1).trim() };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface UsageReceiptCopyDeps {
  render: (
    id: TelegramCopyId,
    language: TelegramLanguage,
    vars?: Record<string, string | number>,
    raw?: Record<string, string>,
  ) => string;
  rtl: (text: string, language: TelegramLanguage) => string;
}

/**
 * The customer's Persian-only receipt. Card is wrapped in <code> (tap-to-copy) by
 * the i18n template; name/holder are HTML-escaped. Contains only the recipient's
 * own balance — no other identifiers.
 */
export function buildUsageReceiptMessage(
  decision: UsageReceiptDecision,
  displayName: string | null,
  card: CardToCard,
  deps: UsageReceiptCopyDeps,
): string {
  const name = displayName?.trim();
  const greeting = name ? `سلام ${escapeHtml(name)} جان 🌿` : 'سلام دوست عزیز 🌿';
  const raw: Record<string, string> = {
    greeting,
    percent: formatPercentFa(decision.percentUsed),
    plan: formatGbFa(decision.quotaLimitBytes),
    remaining: formatGbFa(decision.remainingBytes),
    card: escapeHtml(card.card),
    holder: escapeHtml(card.holder || ''),
  };
  return deps.rtl(deps.render(USAGE_RECEIPT_COPY, 'fa', {}, raw), 'fa');
}
