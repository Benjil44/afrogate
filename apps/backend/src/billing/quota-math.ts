import { BadRequestException } from '@nestjs/common';

export const MAX_SAFE_BYTES = Number.MAX_SAFE_INTEGER;

/**
 * Computes a customer account's new quota limit after a paid allocation/top-up.
 * A null current limit is treated as the current used-byte baseline, so a top-up
 * grants only the purchased volume as remaining headroom (never retroactively
 * forgiving prior usage). Throws if the result would overflow the safe range.
 */
export function computeAllocatedQuotaLimitBytes(
  quotaLimitBeforeBytes: number | null,
  usedBytes: number,
  volumeBytes: number,
): number {
  const after = (quotaLimitBeforeBytes ?? usedBytes) + volumeBytes;
  if (!Number.isSafeInteger(after) || after > MAX_SAFE_BYTES) {
    throw new BadRequestException('Allocated quota would exceed the safe byte limit');
  }
  return after;
}

/** Optional usage byte count: null passthrough, else a safe non-negative integer. */
export function normalizeOptionalUsageBytes(value: number | null | undefined, fieldName: string): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_SAFE_BYTES) {
    throw new BadRequestException(`${fieldName} must be a safe non-negative integer`);
  }
  return value;
}

/** A required, safe, strictly-positive byte delta. */
export function normalizePositiveByteDelta(value: number | null | undefined, fieldName: string): number {
  if (!Number.isSafeInteger(value) || value === null || value === undefined || value <= 0 || value > MAX_SAFE_BYTES) {
    throw new BadRequestException(`${fieldName} must be a safe positive integer`);
  }
  return value;
}

/** Add a positive delta to a base byte count, guarding against unsafe overflow. */
export function addPositiveBytes(baseBytes: number, deltaBytes: number, errorMessage: string): number {
  const nextBytes = baseBytes + deltaBytes;
  if (!Number.isSafeInteger(nextBytes) || nextBytes > MAX_SAFE_BYTES) {
    throw new BadRequestException(errorMessage);
  }
  return nextBytes;
}

export const BYTES_PER_GB = 1024 ** 3;

/** Converts gigabytes to bytes. */
export function gbToBytes(value: number): number {
  return value * BYTES_PER_GB;
}
