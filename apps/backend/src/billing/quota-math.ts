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
