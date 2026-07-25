/**
 * Pure formatting helpers for the afroWS bot's bilingual, RTL-correct rendering.
 * No external imports so it stays trivially testable and safe to share between
 * the bot handler and the admin push-notification path.
 *
 * Rules implemented from docs/telegram-bot-flow-design.md §7:
 *  - Persian prose uses Persian digits + spelled-out units (گیگابایت/مگابایت),
 *    Persian thousands (U+066C) and decimal (U+066B) separators.
 *  - Copyable payloads (card number, config links) stay ASCII (handled by caller,
 *    kept out of the digit converter's prose paths).
 *  - Sizes use decimal units consistent with billing (1 GB = 1e9 bytes).
 *  - A per-line RLM (U+200F) guard lays out Persian lines that begin with an
 *    emoji / Latin / digit / tag as RTL.
 */

import type { TelegramLanguage } from './telegram-i18n';

const RLM = '‏';

/** Convert ASCII digits + grouping separators to their Persian equivalents (prose only). */
export function toPersianDigits(value: string): string {
  const digits = '۰۱۲۳۴۵۶۷۸۹';
  return value.replace(/[0-9.,]/g, (ch) => {
    if (ch === '.') return '٫'; // Arabic decimal separator
    if (ch === ',') return '٬'; // Arabic thousands separator
    return digits[ch.charCodeAt(0) - 48];
  });
}

/** Escape HTML-significant characters before interpolating into an HTML message. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function trimZeros(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/** Decimal data size, localized. EN: "20 GB" / "500 MB"; FA: "۲۰ گیگابایت". */
export function formatDataSize(bytes: number | null | undefined, language: TelegramLanguage): string {
  const value = typeof bytes === 'number' && Number.isFinite(bytes) ? bytes : 0;
  const gb = value / 1_000_000_000;
  let amountText: string;
  let unitEn: string;
  let unitFa: string;
  if (value >= 1_000_000_000) {
    amountText = trimZeros(gb);
    unitEn = 'GB';
    unitFa = 'گیگابایت';
  } else {
    amountText = trimZeros(value / 1_000_000);
    unitEn = 'MB';
    unitFa = 'مگابایت';
  }
  return language === 'fa' ? `${toPersianDigits(amountText)} ${unitFa}` : `${amountText} ${unitEn}`;
}

const CURRENCY_WORDS: Record<string, { en: string; fa: string }> = {
  toman: { en: 'Toman', fa: 'تومان' },
  tomans: { en: 'Toman', fa: 'تومان' },
  irr: { en: 'Rial', fa: 'ریال' },
  rial: { en: 'Rial', fa: 'ریال' },
  usd: { en: 'USD', fa: 'دلار' },
};

/** Localized money amount. EN: "90,000 Toman"; FA: "۹۰٬۰۰۰ تومان". */
export function formatAmount(
  amountMinor: number | null | undefined,
  currency: string | null | undefined,
  language: TelegramLanguage,
): string {
  const amount = typeof amountMinor === 'number' && Number.isFinite(amountMinor) ? amountMinor : 0;
  const grouped = amount.toLocaleString('en-US');
  const key = (currency ?? '').trim().toLowerCase();
  const word = CURRENCY_WORDS[key] ?? { en: (currency ?? '').toUpperCase(), fa: currency ?? '' };
  return language === 'fa'
    ? `${toPersianDigits(grouped)} ${word.fa}`.trim()
    : `${grouped} ${word.en}`.trim();
}

/** Localized integer count for prose (Persian digits in FA). */
export function formatCount(value: number, language: TelegramLanguage): string {
  return language === 'fa' ? toPersianDigits(String(value)) : String(value);
}

/**
 * Group the digits of a card number in 4s (ASCII), e.g. "6037991122334455" ->
 * "6037 9911 2233 4455". Non-numeric input is returned trimmed as-is.
 */
export function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 12) return raw.trim();
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Split the single `card_to_card_info` setting into a display card number +
 * holder. Operator enters "number" then holder, separated by a newline or "|"
 * (e.g. "6037 9911 2233 4455 | Ali Rezaei"). Holder is optional.
 */
export function parseCardToCard(info: string): { cardNumber: string; cardHolder: string } {
  const trimmed = info.trim();
  const splitIndex = trimmed.search(/[\n|]/);
  if (splitIndex === -1) {
    return { cardNumber: formatCardNumber(trimmed), cardHolder: '' };
  }
  const numberPart = trimmed.slice(0, splitIndex);
  const holderPart = trimmed.slice(splitIndex + 1).replace(/^[\s|]+/, '').trim();
  return { cardNumber: formatCardNumber(numberPart), cardHolder: holderPart };
}

/** Strip a phone string to its bare digits (E.164 without the leading '+'). */
export function normalizePhoneDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

/** National form for display/labels: Iran E.164 (98…) → 0…; otherwise the raw digits. */
export function phoneNationalDigits(digits: string): string {
  if (digits.startsWith('98') && digits.length > 10) return `0${digits.slice(2)}`;
  return digits;
}

/**
 * Build the ASCII, auto-pattern-safe VLESS config label from the registered name
 * + phone (docs §11 R2): keep the [A-Za-z0-9] runs of the name (≤12 chars), then
 * `-` + the phone's national digits. A fully non-Latin name contributes nothing,
 * so the label is the digits alone. Examples: `Hani-09121234567`, `09121234567`.
 */
export function buildConfigLabel(displayName: string, phone: string): string {
  const namePart = (displayName.match(/[A-Za-z0-9]+/g) ?? []).join('').slice(0, 12);
  const phonePart = phoneNationalDigits(normalizePhoneDigits(phone));
  if (!phonePart) return namePart || 'afroWS';
  return namePart ? `${namePart}-${phonePart}` : phonePart;
}

/** Whole-number usage percentage (used / quota), capped at 100; 0 when no quota. */
export function usagePercent(usedBytes: number, quotaLimitBytes: number | null | undefined): number {
  if (!quotaLimitBytes || quotaLimitBytes <= 0) return 0;
  const pct = Math.round((usedBytes / quotaLimitBytes) * 100);
  return Math.max(0, Math.min(100, pct));
}

/**
 * 10-cell text progress bar (docs §11 S3v2): filled `▓`, empty `░`,
 * `filled = clamp(round(percent/10), 0, 10)`, but `filled ≥ 1` whenever any data
 * has been used. Sits inside `<code>` so it renders LTR/monospace in both languages.
 */
export function usageProgressBar(percent: number, usedBytes: number): string {
  let filled = Math.max(0, Math.min(10, Math.round(percent / 10)));
  if (usedBytes > 0 && filled < 1) filled = 1;
  return '▓'.repeat(filled) + '░'.repeat(10 - filled);
}

/** Localized GB equivalent of a gems balance at the redeem rate (for "≈ N GB" lines). */
export function formatGemsGb(gems: number, ratePerGb: number, language: TelegramLanguage): string {
  const gb = ratePerGb > 0 ? gems / ratePerGb : 0;
  const text = trimZeros(gb);
  return language === 'fa' ? toPersianDigits(text) : text;
}

/** Signed gems delta for ledger lines: `+50` / `−100` (U+2212 minus), Persian digits in fa. */
export function formatSignedGems(delta: number, language: TelegramLanguage): string {
  const sign = delta < 0 ? '−' : '+';
  const magnitude = String(Math.abs(delta));
  const body = language === 'fa' ? toPersianDigits(magnitude) : magnitude;
  return `${sign}${body}`;
}

/** Short localized date for ledger lines: EN `Jul 25`, FA Jalali «۳ مرداد». */
export function formatShortDate(value: Date, language: TelegramLanguage): string {
  try {
    if (language === 'fa') {
      return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'long' }).format(value);
    }
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(value);
  } catch {
    return value.toISOString().slice(0, 10);
  }
}

/**
 * Per-line RTL guard for Persian: prefix any line that begins with an emoji,
 * Latin letter, digit, or markup tag with U+200F so Telegram lays it out RTL.
 * Lines that are copyable <code> payloads are left untouched (LTR). No-op for EN.
 */
export function applyRtlGuard(text: string, language: TelegramLanguage): string {
  if (language !== 'fa') return text;
  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.replace(/^\s+/, '');
      if (!trimmed) return line;
      if (trimmed.startsWith('<code>')) return line; // keep copyable payloads LTR
      const first = trimmed.codePointAt(0) ?? 0;
      const isPersianLetter = first >= 0x0600 && first <= 0x06ff;
      return isPersianLetter ? line : `${RLM}${line}`;
    })
    .join('\n');
}
