import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RateLimitOptions } from './rate-limit.decorator';
import {
  compactRateLimitEntries,
  consumeRateLimit,
  type RateLimitDecision,
  type RateLimitEntry,
} from './rate-limit-window';
import { parseConfigFlag } from '../common/config-flag';

export type { RateLimitDecision } from './rate-limit-window';

@Injectable()
export class RateLimitService {
  private readonly entries = new Map<string, RateLimitEntry>();

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return this.configFlag('AFROWS_RATE_LIMIT_ENABLED', true);
  }

  shouldTrustProxyHeaders(): boolean {
    return this.configFlag('AFROWS_RATE_LIMIT_TRUST_PROXY_HEADERS', false);
  }

  consume(key: string, options: RateLimitOptions): RateLimitDecision {
    const now = Date.now();
    const decision = consumeRateLimit(this.entries, key, options, now);
    compactRateLimitEntries(this.entries, now, this.maxKeys());
    return decision;
  }

  /**
   * Failure-only budget: throws 429 while `key` already has `max` recorded
   * failures in its window, without counting this attempt. Pair with
   * `recordFailure` after a failed check, so successful logins never spend it.
   */
  assertBelowFailureBudget(key: string, options: RateLimitOptions): void {
    if (!this.isEnabled()) return;
    const entry = this.entries.get(key);
    if (entry && entry.resetAt > Date.now() && entry.count >= options.max) {
      throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  recordFailure(key: string, options: RateLimitOptions): void {
    if (!this.isEnabled()) return;
    this.consume(key, options);
  }

  private maxKeys(): number {
    const configured = Number(this.config.get<string>('AFROWS_RATE_LIMIT_MAX_KEYS'));
    return Number.isInteger(configured) && configured >= 100 ? configured : 5000;
  }

  private configFlag(name: string, fallback: boolean): boolean {
    return parseConfigFlag(this.config.get<string>(name), fallback);
  }
}
