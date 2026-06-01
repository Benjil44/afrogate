export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitWindowOptions {
  windowMs: number;
  max: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

/**
 * Pure fixed-window rate-limit step. Mutates `entries` for the given key and
 * returns the decision. A new window starts when the previous one has expired.
 */
export function consumeRateLimit(
  entries: Map<string, RateLimitEntry>,
  key: string,
  options: RateLimitWindowOptions,
  now: number,
): RateLimitDecision {
  const current = entries.get(key);
  const entry =
    current && current.resetAt > now ? current : { count: 0, resetAt: now + options.windowMs };

  entry.count += 1;
  entries.set(key, entry);

  return {
    allowed: entry.count <= options.max,
    limit: options.max,
    remaining: Math.max(options.max - entry.count, 0),
    resetAt: entry.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

/** Evicts expired entries, then the oldest entries, to keep the map within `maxKeys`. */
export function compactRateLimitEntries(entries: Map<string, RateLimitEntry>, now: number, maxKeys: number): void {
  if (entries.size <= maxKeys) return;

  for (const [key, entry] of entries) {
    if (entry.resetAt <= now) entries.delete(key);
  }

  while (entries.size > maxKeys) {
    const oldestKey = entries.keys().next().value as string | undefined;
    if (!oldestKey) break;
    entries.delete(oldestKey);
  }
}
