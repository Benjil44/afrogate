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
   * Programmatic limit for keys the guard cannot derive from the request alone
   * (e.g. a per-account login identifier from the validated body). No-op when
   * rate limiting is disabled; throws 429 when the window is exhausted.
   */
  enforce(key: string, options: RateLimitOptions): void {
    if (!this.isEnabled()) return;
    const decision = this.consume(key, options);
    if (!decision.allowed) {
      throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private maxKeys(): number {
    const configured = Number(this.config.get<string>('AFROWS_RATE_LIMIT_MAX_KEYS'));
    return Number.isInteger(configured) && configured >= 100 ? configured : 5000;
  }

  private configFlag(name: string, fallback: boolean): boolean {
    return parseConfigFlag(this.config.get<string>(name), fallback);
  }
}
