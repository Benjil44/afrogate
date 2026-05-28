import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import type { PayPalWebhookHandlerResponse } from '@afrogate/shared';
import { BillingService } from './billing.service';

@Controller('payments/paypal')
export class PayPalWebhookController {
  constructor(private readonly billingService: BillingService) {}

  @Post('webhook')
  @HttpCode(200)
  handleWebhook(
    @Headers('paypal-auth-algo') authAlgo: string | undefined,
    @Headers('paypal-cert-url') certUrl: string | undefined,
    @Headers('paypal-transmission-id') transmissionId: string | undefined,
    @Headers('paypal-transmission-sig') transmissionSig: string | undefined,
    @Headers('paypal-transmission-time') transmissionTime: string | undefined,
    @Body() payload: Record<string, unknown>,
  ): Promise<PayPalWebhookHandlerResponse> {
    return this.billingService.handlePayPalWebhook(
      {
        authAlgo,
        certUrl,
        transmissionId,
        transmissionSig,
        transmissionTime,
      },
      payload,
    );
  }
}
