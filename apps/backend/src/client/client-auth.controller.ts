import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { ClientLoginResponse } from '@afrows/shared';
import { BillingService } from '../billing/billing.service';
import { RateLimit } from '../security/rate-limit.decorator';
import { RateLimitGuard } from '../security/rate-limit.guard';
import { RateLimitService } from '../security/rate-limit.service';
import { resolveClientIp, type HeaderBag } from '../security/client-ip';
import { normalizeLoginIdentifier } from '../security/generate-password';
import { ClientLoginDto } from './dto/client-login.dto';

/**
 * Failed-password budgets (successful logins never spend them):
 *  - per account + client IP: caps guessing from one address;
 *  - per account overall: caps guessing spread over many addresses, set high
 *    enough that a stranger cannot cheaply lock a customer out of login.
 */
export const CLIENT_LOGIN_IDENTIFIER_IP_LIMIT = { max: 10, windowMs: 60_000 } as const;
export const CLIENT_LOGIN_IDENTIFIER_LIMIT = { max: 100, windowMs: 60_000 } as const;

/**
 * Public client auth (no ClientTokenGuard): email/username + password → a client
 * access token the mobile app then uses for the guarded /client/* routes.
 * PUBLIC, UNAUTHENTICATED (one scrypt verify per attempt), so besides the
 * failure budgets above the guard caps all attempts per client IP, generously,
 * because Iranian CGNAT users and anyone logging in through the shared Afrows
 * exit IPs share an address.
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
  async login(
    @Body() body: ClientLoginDto,
    @Req() request?: { headers?: HeaderBag; ip?: string; socket?: { remoteAddress?: string } },
  ): Promise<ClientLoginResponse> {
    // Same normalization as the account lookup; distinct prefixes so an identifier
    // that looks like an IP never shares the guard's `client-login:<ip>` bucket.
    const identifier = normalizeLoginIdentifier(body.identifier) ?? '';
    const ip = resolveClientIp(
      request?.headers,
      request?.ip ?? request?.socket?.remoteAddress,
      this.rateLimit.shouldTrustProxyHeaders(),
    );
    const budgets = [
      { key: `client-login-id-ip:${identifier}|${ip}`, options: { key: 'client-login-id-ip', ...CLIENT_LOGIN_IDENTIFIER_IP_LIMIT } },
      { key: `client-login-id:${identifier}`, options: { key: 'client-login-id', ...CLIENT_LOGIN_IDENTIFIER_LIMIT } },
    ];
    for (const budget of budgets) this.rateLimit.assertBelowFailureBudget(budget.key, budget.options);
    try {
      return await this.billingService.loginClientByPassword(body.identifier, body.password);
    } catch (error) {
      for (const budget of budgets) this.rateLimit.recordFailure(budget.key, budget.options);
      throw error;
    }
  }
}
