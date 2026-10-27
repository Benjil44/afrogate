import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { ClientLoginResponse } from '@afrows/shared';
import { BillingService } from '../billing/billing.service';
import { RateLimit } from '../security/rate-limit.decorator';
import { RateLimitGuard } from '../security/rate-limit.guard';
import { ClientLoginDto } from './dto/client-login.dto';

/**
 * Public client auth (no ClientTokenGuard): email/username + password → a client
 * access token the mobile app then uses for the guarded /client/* routes.
 * PUBLIC, UNAUTHENTICATED: per-IP rate limited (one scrypt verify per attempt),
 * as the client-login design requires; nginx only applies the generic api zone.
 */
@Controller('client')
export class ClientAuthController {
  constructor(private readonly billingService: BillingService) {}

  @Post('login')
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: 'client-login', max: 20, windowMs: 60_000 })
  login(@Body() body: ClientLoginDto): Promise<ClientLoginResponse> {
    return this.billingService.loginClientByPassword(body.identifier, body.password);
  }
}
