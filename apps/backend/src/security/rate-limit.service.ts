import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RateLimitOptions } from './rate-limit.decorator';
import {
  compactRateLimitEntries,
  consumeRateLimit,
  type RateLimitDecision,
  type RateLimitEntry,
} from './rate-limit-window';

export type { RateLimitDecision } from './rate-limit-window';

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
    const decision = consumeRateLimit(this.entries, key, options, now);
    compactRateLimitEntries(this.entries, now, this.maxKeys());
    return decision;
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
