import { Body, Controller, Post } from '@nestjs/common';
import type { ClientLoginResponse } from '@afrows/shared';
import { BillingService } from '../billing/billing.service';
import { ClientLoginDto } from './dto/client-login.dto';

/**
 * Public client auth (no ClientTokenGuard): email/username + password → a client
 * access token the mobile app then uses for the guarded /client/* routes.
 */
@Controller('client')
export class ClientAuthController {
  constructor(private readonly billingService: BillingService) {}

  @Post('login')
  login(@Body() body: ClientLoginDto): Promise<ClientLoginResponse> {
    return this.billingService.loginClientByPassword(body.identifier, body.password);
  }
}
