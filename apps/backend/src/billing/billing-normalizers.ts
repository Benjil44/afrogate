import { BadRequestException } from '@nestjs/common';

/** Trim a string to a non-empty value, or null. */
export function normalizeNullableString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/** Parse a JSON string, returning the value unchanged if not a string and null on parse error. */
export function parseJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** Integer usage multiplier in [1, 100]. */
export function normalizeUsageMultiplier(value: number | string | null | undefined): number {
  const normalized = Number(value ?? 1);
  if (!Number.isInteger(normalized) || normalized < 1 || normalized > 100) {
    throw new BadRequestException('Usage multiplier must be an integer between 1 and 100');
  }
  return normalized;
}

/** Strip spaces/punctuation from a paid number, or null. */
export function normalizePaidNumber(value: string | null | undefined): string | null {
  const normalized = normalizeNullableString(value)?.replace(/[\s().-]+/g, '') ?? null;
  return normalized || null;
}

/** Strip leading @ from a Telegram username, or null. */
export function normalizeTelegramUsername(value: string | null | undefined): string | null {
  const normalized = normalizeNullableString(value)?.replace(/^@+/, '') ?? null;
  return normalized || null;
}

/** Lowercased protocol, defaulting to 'custom'. */
export function normalizeProtocol(value: string | null | undefined): string {
  return normalizeNullableString(value)?.toLowerCase() ?? 'custom';
}

/** Lowercased currency code (letters/numbers/_/-, up to 16 chars). */
export function normalizeCurrency(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_-]{0,15}$/.test(normalized)) {
    throw new BadRequestException('Currency must use letters, numbers, underscore, or dash');
  }
  return normalized;
}

/** Validated reseller account status. */
export function normalizeResellerStatus(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!['active', 'suspended', 'disabled'].includes(normalized)) {
    throw new BadRequestException('Invalid reseller account status');
  }
  return normalized;
}

/** Safe non-negative integer money amount (with optional fallback). */
export function normalizeMoneyAmount(value: number | null | undefined, fieldName: string, fallback?: number): number {
  const normalized = value ?? fallback;
  if (normalized === undefined || !Number.isSafeInteger(normalized) || normalized < 0) {
    throw new BadRequestException(`${fieldName} must be a safe non-negative integer`);
  }
  return normalized;
}

/** Slugify a volume-package name; throws when nothing remains. */
export function normalizeSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) throw new BadRequestException('Volume package slug is required');
  return slug;
}

/** Normalized payment provider key (letters/numbers/_/-, max 40 chars). */
export function normalizeProvider(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  if (!normalized) throw new BadRequestException('Payment provider is required');
  if (normalized.length > 40) throw new BadRequestException('Payment provider is too long');
  return normalized;
}

/** Route group identifier, defaulting to 'main'; max 80 chars. */
export function normalizeRouteGroup(value: string | undefined): string {
  const normalized = normalizeNullableString(value) ?? 'main';
  if (normalized.length > 80) throw new BadRequestException('routeGroup is too long');
  return normalized;
}

/** Two-letter ISO country code (uppercased), or null. */
export function normalizeCountryCode(value: string | null | undefined): string | null {
  const normalized = normalizeNullableString(value)?.toUpperCase() ?? null;
  if (!normalized) return null;
  if (!/^[A-Z]{2}$/.test(normalized)) {
    throw new BadRequestException('Country code must use two-letter ISO format, such as IR or DE');
  }
  return normalized;
}

/** Country-detection source from a fixed set, or null. */
export function normalizeDetectionSource(value: string | null | undefined): string | null {
  const normalized = normalizeNullableString(value);
  if (!normalized) return null;
  if (!['client_app', 'edge_ip', 'admin', 'unknown'].includes(normalized)) {
    throw new BadRequestException('Invalid country detection source');
  }
  return normalized;
}

/** Parse a JSON value into an array of strings (drops non-strings). */
export function normalizeJsonStringArray(value: unknown): string[] {
  const parsed = parseJsonValue(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item): item is string => typeof item === 'string');
}
