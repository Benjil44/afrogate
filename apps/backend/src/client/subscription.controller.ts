import { Controller, Get, Logger, NotFoundException, Param, Res, UseGuards } from '@nestjs/common';
import { BillingService } from '../billing/billing.service';
import { RateLimit } from '../security/rate-limit.decorator';
import { RateLimitGuard } from '../security/rate-limit.guard';
import { isWellFormedSubscriptionToken, subscriptionLogTag } from './subscription-token';

interface RawResponse {
  setHeader(name: string, value: string): void;
  status(code: number): RawResponse;
  send(body: string): void;
}

/**
 * PUBLIC, UNAUTHENTICATED: `GET /api/sub/:token` (nginx maps `/sub/` here). VPN
 * apps fetch it to refresh a customer's links. Guarded by: a strict token shape
 * check before any DB access, a sha256 lookup + timing-safe HMAC compare, a
 * per-IP rate limit, and a single uniform 404 for every failure (unknown token,
 * feature off, disabled/expired/deleted config, archived/non-active account).
 * Logs only a hash prefix of the token, never the token or account identity.
 */
@Controller('sub')
export class SubscriptionController {
  private readonly logger = new Logger(SubscriptionController.name);

  constructor(private readonly billingService: BillingService) {}

  @Get(':token')
  @UseGuards(RateLimitGuard)
  // nginx (afrows_sub, per client IP) is the real limiter; this is defense in depth, sized so
  // a shared key (proxy headers not trusted) can't 429 every customer's refresh at once.
  @RateLimit({ key: 'public-subscription', max: 120, windowMs: 60_000 })
  async getSubscription(@Param('token') token: string, @Res() response: RawResponse): Promise<void> {
    if (!isWellFormedSubscriptionToken(token)) throw new NotFoundException();
    const payload = await this.billingService.resolvePublicSubscription(token);
    if (!payload) {
      this.logger.debug(`subscription miss tag=${subscriptionLogTag(token)}`);
      throw new NotFoundException();
    }
    for (const [name, value] of Object.entries(payload.headers)) response.setHeader(name, value);
    response.status(200).send(payload.body);
  }
}
