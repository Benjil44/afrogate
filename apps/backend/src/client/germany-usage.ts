/**
 * Pure helpers for the Germany-path usage meter. No I/O, no decorators — so the
 * repo's `node --test` type-stripping runner can load them directly.
 *
 * Germany runs `afrows-de-usage-recorder`, writing a durable buffer
 * `/var/lib/afrows/de-usage.json`:
 *   {"updated_at":"<iso>","users":{"cc_<clientConfigId>@afrows":{"bytes":<int>}}}
 * `bytes` is a MONOTONIC cumulative per-user total (survives xray restart + the
 * daily village blackout). Ireland pulls this over SSH and converts the jump
 * since the last-seen cumulative (the baseline / high-water-mark) into a positive
 * additive delta identical in shape to the local Xray metering path.
 */

/** One user's cumulative total as read from the Germany durable buffer. */
export interface DeUserCumulative {
  clientConfigId: string;
  cumulativeBytes: number;
}

export interface DeUsageBuffer {
  /** ISO string from the buffer's `updated_at`, or null when absent/invalid. */
  updatedAt: string | null;
  users: DeUserCumulative[];
}

/**
 * Guard cap on a single computed delta. A misbehaving/rolled-back recorder can
 * report at most +1 TB per user per tick, so it can never nuke a quota in one
 * write. 1 TB = 10^12 bytes (decimal, matching the quota unit `BYTES_PER_GB`).
 */
export const MAX_DE_USAGE_DELTA_BYTES = 1_000_000_000_000;

const EMAIL_KEY = /^cc_(.+)@afrows$/;

/**
 * Parses the Germany durable-buffer JSON into a flat, validated list of
 * per-client cumulative totals. Malformed input yields an empty buffer (never
 * throws), and individual bad rows are dropped rather than sinking the batch:
 * a non-`cc_<id>@afrows` key, an empty id, or a non-finite/negative `bytes`.
 * Cumulative totals are floored to whole bytes.
 */
export function parseDeUsageBuffer(json: string): DeUsageBuffer {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { updatedAt: null, users: [] };
  }
  if (!data || typeof data !== 'object') return { updatedAt: null, users: [] };

  const rawUpdated = (data as { updated_at?: unknown }).updated_at;
  const updatedAt = typeof rawUpdated === 'string' && rawUpdated.trim() ? rawUpdated : null;

  const usersObj = (data as { users?: unknown }).users;
  const users: DeUserCumulative[] = [];
  if (usersObj && typeof usersObj === 'object') {
    for (const [key, value] of Object.entries(usersObj as Record<string, unknown>)) {
      const match = key.match(EMAIL_KEY);
      if (!match) continue;
      const clientConfigId = match[1]?.trim();
      if (!clientConfigId) continue;
      const rawBytes = (value as { bytes?: unknown })?.bytes;
      const bytes = Number(rawBytes);
      if (!Number.isFinite(bytes) || bytes < 0) continue;
      users.push({ clientConfigId, cumulativeBytes: Math.floor(bytes) });
    }
  }
  return { updatedAt, users };
}

/**
 * Turns a monotonic cumulative total into the positive delta to apply since the
 * last-seen baseline.
 *  - No/invalid baseline (first sight) => baseline treated as 0; the Germany
 *    recorder's per-user counter also starts at 0, so counting from 0 is correct.
 *  - Counter reset (`current < baseline`, e.g. buffer rebuilt) => the usage since
 *    the reset is just `current` (from 0), NOT a negative number.
 *  - Otherwise => `current - baseline` (this also catches up all usage missed
 *    during a blackout, since the baseline only advances after a successful write).
 * The result is clamped to [0, MAX_DE_USAGE_DELTA_BYTES].
 */
export function computeUsageDelta(
  current: number | string,
  baseline: number | string | null | undefined,
): number {
  // Coerce BOTH args with Number() before any finiteness check. Postgres returns
  // `bigint` columns (cumulative_bytes) as STRINGS via node-postgres, and
  // Number.isFinite("123") is false (it never coerces), so a bare isFinite guard
  // silently treats the baseline as 0 and records the whole cumulative as the
  // delta every tick — a catastrophic over-count. Number() handles both the string
  // (bigint) and number (buffer) shapes; only genuinely absent/NaN falls back to 0.
  const c0 = Number(current);
  if (!Number.isFinite(c0) || c0 < 0) return 0;
  const c = Math.floor(c0);
  const b0 = Number(baseline);
  const b = baseline == null || !Number.isFinite(b0) || b0 < 0 ? 0 : Math.floor(b0);
  const raw = c < b ? c : c - b;
  return Math.min(Math.max(raw, 0), MAX_DE_USAGE_DELTA_BYTES);
}
