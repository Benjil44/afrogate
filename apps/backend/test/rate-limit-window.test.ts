import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  compactRateLimitEntries,
  consumeRateLimit,
  type RateLimitEntry,
} from '../src/security/rate-limit-window.ts';

const opts = { windowMs: 60_000, max: 3 };

describe('consumeRateLimit', () => {
  it('allows requests up to the limit and reports remaining', () => {
    const entries = new Map<string, RateLimitEntry>();
    const now = 1_000_000;
    const d1 = consumeRateLimit(entries, 'ip-1', opts, now);
    assert.deepEqual([d1.allowed, d1.remaining, d1.limit], [true, 2, 3]);
    const d2 = consumeRateLimit(entries, 'ip-1', opts, now);
    assert.deepEqual([d2.allowed, d2.remaining], [true, 1]);
    const d3 = consumeRateLimit(entries, 'ip-1', opts, now);
    assert.deepEqual([d3.allowed, d3.remaining], [true, 0]);
  });

  it('blocks the request that exceeds the limit, with a positive retry-after', () => {
    const entries = new Map<string, RateLimitEntry>();
    const now = 1_000_000;
    for (let i = 0; i < opts.max; i++) consumeRateLimit(entries, 'ip-1', opts, now);
    const blocked = consumeRateLimit(entries, 'ip-1', opts, now);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.remaining, 0);
    assert.ok(blocked.retryAfterSeconds >= 1);
  });

  it('starts a fresh window after the previous one expires', () => {
    const entries = new Map<string, RateLimitEntry>();
    const start = 1_000_000;
    for (let i = 0; i < opts.max + 2; i++) consumeRateLimit(entries, 'ip-1', opts, start);
    // after the window passes, the same key is allowed again
    const afterWindow = consumeRateLimit(entries, 'ip-1', opts, start + opts.windowMs + 1);
    assert.equal(afterWindow.allowed, true);
    assert.equal(afterWindow.remaining, 2);
  });

  it('tracks keys independently', () => {
    const entries = new Map<string, RateLimitEntry>();
    const now = 1_000_000;
    for (let i = 0; i < opts.max; i++) consumeRateLimit(entries, 'ip-1', opts, now);
    const other = consumeRateLimit(entries, 'ip-2', opts, now);
    assert.equal(other.allowed, true);
    assert.equal(other.remaining, 2);
  });
});

describe('compactRateLimitEntries', () => {
  it('evicts expired entries when over the cap', () => {
    const entries = new Map<string, RateLimitEntry>();
    const now = 1_000_000;
    entries.set('expired', { count: 1, resetAt: now - 1 });
    entries.set('fresh', { count: 1, resetAt: now + 60_000 });
    compactRateLimitEntries(entries, now, 1);
    assert.equal(entries.has('expired'), false);
    assert.equal(entries.has('fresh'), true);
  });

  it('caps the map size by evicting oldest entries', () => {
    const entries = new Map<string, RateLimitEntry>();
    const now = 1_000_000;
    for (let i = 0; i < 10; i++) entries.set(`k${i}`, { count: 1, resetAt: now + 60_000 });
    compactRateLimitEntries(entries, now, 5);
    assert.ok(entries.size <= 5);
    // newest keys should survive over the oldest
    assert.equal(entries.has('k9'), true);
    assert.equal(entries.has('k0'), false);
  });

  it('does nothing when under the cap', () => {
    const entries = new Map<string, RateLimitEntry>();
    entries.set('a', { count: 1, resetAt: 2_000_000 });
    compactRateLimitEntries(entries, 1_000_000, 5000);
    assert.equal(entries.size, 1);
  });
});
