export interface Counter {
  rx: number;
  tx: number;
}

/**
 * Reset-aware byte delta between the newest absolute WG counters and the last
 * billed cursor. A null cursor means "first time seen" -> 0 (baseline only, never
 * back-bill historical usage). If a counter dropped below the cursor (wg restart)
 * the newest value is taken as the full delta.
 */
export function computeDelta(newest: Counter, cursor: Counter | null): number {
  if (!cursor) return 0;
  const rx = newest.rx >= cursor.rx ? newest.rx - cursor.rx : newest.rx;
  const tx = newest.tx >= cursor.tx ? newest.tx - cursor.tx : newest.tx;
  return rx + tx;
}

export type BlockReason = 'expired' | 'over_quota' | 'inactive';

/**
 * Why a gateway's linked customer is blocked (so its Afrows egress should be
 * disabled), or null if the customer is in good standing.
 */
export function isCustomerBlocked(c: {
  status: string;
  expiresAt: string | null;
  usedBytes: number;
  quotaLimitBytes: number | null;
}): BlockReason | null {
  if (c.status !== 'active') return 'inactive';
  if (c.expiresAt && Date.parse(c.expiresAt) <= Date.now()) return 'expired';
  if (c.quotaLimitBytes != null && c.usedBytes >= c.quotaLimitBytes) return 'over_quota';
  return null;
}
