import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { ClientLoginResponse } from '@afrows/shared';
import { BillingService } from '../billing/billing.service';
import { RateLimit } from '../security/rate-limit.decorator';
import { RateLimitGuard } from '../security/rate-limit.guard';
import { RateLimitService } from '../security/rate-limit.service';
import { normalizeLoginIdentifier } from '../security/generate-password';
import { ClientLoginDto } from './dto/client-login.dto';

/** Per-account budget: caps guesses against one login even across many source IPs. */
export const CLIENT_LOGIN_IDENTIFIER_LIMIT = { max: 10, windowMs: 60_000 } as const;

/**
 * Public client auth (no ClientTokenGuard): email/username + password → a client
 * access token the mobile app then uses for the guarded /client/* routes.
 * PUBLIC, UNAUTHENTICATED (one scrypt verify per attempt), so two budgets:
 *  - per client IP (guard): generous, because Iranian CGNAT users and anyone
 *    logging in through the shared Afrows exit IPs share an address;
 *  - per identifier (here): tight, so rotating source IPs does not buy more
 *    guesses against one account.
 */
@Controller('client')
export class ClientAuthController {
  constructor(
    private readonly billingService: BillingService,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Post('login')
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: 'client-login', max: 60, windowMs: 60_000 })
  login(@Body() body: ClientLoginDto): Promise<ClientLoginResponse> {
    // Same normalization as the account lookup; a distinct prefix so an identifier
    // that looks like an IP never shares the guard's `client-login:<ip>` bucket.
    const identifier = normalizeLoginIdentifier(body.identifier) ?? '';
    this.rateLimit.enforce(`client-login-id:${identifier}`, {
      key: 'client-login-id',
      ...CLIENT_LOGIN_IDENTIFIER_LIMIT,
    });
    return this.billingService.loginClientByPassword(body.identifier, body.password);
  }
}
