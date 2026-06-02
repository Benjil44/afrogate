import { BadRequestException } from '@nestjs/common';

/** Current UTC calendar day as `YYYY-MM-DD`. `now` is injectable for testing. */
export function currentUtcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Start of the next UTC day as an ISO timestamp (when daily counters reset). */
export function nextUtcResetAt(now: Date = new Date()): string {
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return reset.toISOString();
}

/** Normalize a grant day (Date or ISO-ish string) to a `YYYY-MM-DD` day key. */
export function formatGrantDay(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

/** Parse an optional date string, throwing BadRequestException on an invalid value. */
export function parseOptionalDate(value: string | null | undefined, fieldName: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`${fieldName} must be a valid date`);
  return date;
}
