import { BadRequestException } from '@nestjs/common';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Positive-integer limit with a default and an upper cap. */
export function normalizeLimitParam(input: string | undefined, fallback: number, max: number): number {
  if (!input) return fallback;
  const value = Number(input);
  if (!Number.isInteger(value) || value < 1) {
    throw new BadRequestException('Limit must be a positive integer');
  }
  return Math.min(value, max);
}

/** Positive-integer range-in-hours with a default and an upper cap. */
export function normalizeRangeHoursParam(input: string | undefined, fallback: number, max: number): number {
  if (!input) return fallback;
  const value = Number(input);
  if (!Number.isInteger(value) || value < 1) {
    throw new BadRequestException('rangeHours must be a positive integer');
  }
  return Math.min(value, max);
}

/** Optional UUID query parameter; throws (with the field name) when present but malformed. */
export function normalizeUuidParam(input: string | undefined, name: string): string | undefined {
  if (!input) return undefined;
  if (!UUID_RE.test(input)) {
    throw new BadRequestException(`${name} must be a UUID`);
  }
  return input;
}

/** Alert status filter: defaults to `open`, accepts only `open`/`resolved`. */
export function normalizeAlertStatusParam(input: string | undefined): string | undefined {
  if (!input) return 'open';
  if (input === 'open' || input === 'resolved') return input;
  throw new BadRequestException('status must be open or resolved');
}

/** Optional simple-text filter (`[a-z][a-z0-9_-]{0,31}`); throws (with the field name) when malformed. */
export function normalizeSimpleTextParam(input: string | undefined, name: string): string | undefined {
  if (!input) return undefined;
  if (!/^[a-z][a-z0-9_-]{0,31}$/i.test(input)) {
    throw new BadRequestException(`${name} must be a simple text filter`);
  }
  return input;
}
