import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RateLimitOptions } from './rate-limit.decorator';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

@Injectable()
export class RateLimitService {
  private readonly entries = new Map<string, RateLimitEntry>();

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return this.configFlag('AFROGATE_RATE_LIMIT_ENABLED', true);
  }

  shouldTrustProxyHeaders(): boolean {
    return this.configFlag('AFROGATE_RATE_LIMIT_TRUST_PROXY_HEADERS', false);
  }

  consume(key: string, options: RateLimitOptions): RateLimitDecision {
    const now = Date.now();
    const current = this.entries.get(key);
    const entry =
      current && current.resetAt > now
        ? current
        : {
            count: 0,
            resetAt: now + options.windowMs,
          };

    entry.count += 1;
    this.entries.set(key, entry);
    this.compact(now);

    const remaining = Math.max(options.max - entry.count, 0);
    return {
      allowed: entry.count <= options.max,
      limit: options.max,
      remaining,
      resetAt: entry.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  private compact(now: number): void {
    if (this.entries.size <= this.maxKeys()) return;

    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(key);
    }

    const maxKeys = this.maxKeys();
    while (this.entries.size > maxKeys) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.entries.delete(oldestKey);
    }
  }

  private maxKeys(): number {
    const configured = Number(this.config.get<string>('AFROGATE_RATE_LIMIT_MAX_KEYS'));
    return Number.isInteger(configured) && configured >= 100 ? configured : 5000;
  }

  private configFlag(name: string, fallback: boolean): boolean {
    const value = this.config.get<string>(name)?.trim().toLowerCase();
    if (!value) return fallback;
    return ['1', 'true', 'yes', 'on'].includes(value);
  }
}
