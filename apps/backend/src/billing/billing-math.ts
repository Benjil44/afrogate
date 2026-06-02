import { ConflictException } from '@nestjs/common';

/** Total order price for a volume purchase. */
export function calculateTotalPrice(volumeGb: number, pricePerGb: number): number {
  return volumeGb * pricePerGb;
}

/** Default checkout flow for a payment provider: PayPal redirects, everything else is manual. */
export function defaultCheckoutMode(provider: string): string {
  return provider === 'paypal' ? 'hosted_redirect' : 'manual';
}

/** Remaining quota bytes (never negative); null means unlimited. */
export function remainingBytes(limitBytes: number | null, usedBytes: number): number | null {
  if (limitBytes === null) return null;
  return Math.max(limitBytes - usedBytes, 0);
}

/** Coerce a bigint-as-string/number column value to a finite number, else null. */
export function numberFromBigInt(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

/** Smallest finite value among the inputs, ignoring null/undefined/non-finite; null if none. */
export function minNullableBytes(values: Array<number | null | undefined>): number | null {
  const finiteValues = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!finiteValues.length) return null;
  return Math.min(...finiteValues);
}

/** Narrows an unknown error to one carrying a Postgres-style `code` string. */
export function isErrorWithCode(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

/** Rethrows a unique-constraint violation (Postgres 23505) as a ConflictException. */
export function throwConflictIfUniqueViolation(error: unknown, message: string): void {
  if (isErrorWithCode(error) && error.code === '23505') {
    throw new ConflictException(message);
  }
}
