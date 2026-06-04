import { Body, Controller, Headers, HttpCode, Post, UseGuards } from '@nestjs/common';
import type { RewardedAdWebhookHandlerResponse } from '@afrows/shared';
import { RateLimit } from '../security/rate-limit.decorator';
import { RateLimitGuard } from '../security/rate-limit.guard';
import { BillingService } from './billing.service';
import { RewardedAdProviderWebhookDto } from './dto/rewarded-ad-webhook.dto';

@Controller('rewarded-ads')
export class RewardedAdWebhookController {
  constructor(private readonly billingService: BillingService) {}

  @Post('webhook')
  @HttpCode(200)
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: 'rewarded-ad-webhook', max: 600, windowMs: 60_000 })
  handleWebhook(
    @Headers('x-afrows-ad-signature') signature: string | undefined,
    @Headers('x-afrows-ad-timestamp') timestamp: string | undefined,
    @Body() payload: RewardedAdProviderWebhookDto,
  ): Promise<RewardedAdWebhookHandlerResponse> {
    return this.billingService.handleRewardedAdProviderWebhook({ signature, timestamp }, payload);
  }
}
