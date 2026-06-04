import {
  Body,
  Controller,
  Headers,
  HttpCode,
  NotFoundException,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { TelegramBotWebhookResponse } from '@afrows/shared';
import { RateLimit } from '../security/rate-limit.decorator';
import { RateLimitGuard } from '../security/rate-limit.guard';
import { TelegramBotService } from './telegram-bot.service';

@Controller('telegram')
export class TelegramBotController {
  constructor(private readonly telegramBot: TelegramBotService) {}

  @Post('webhook')
  @HttpCode(200)
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: 'telegram-webhook', max: 240, windowMs: 60_000 })
  async handleWebhook(
    @Body() payload: unknown,
    @Headers('x-telegram-bot-api-secret-token') telegramSecret?: string,
    @Headers('x-afrows-telegram-webhook-secret') afrowsSecret?: string,
  ): Promise<TelegramBotWebhookResponse> {
    if (!(await this.telegramBot.isWebhookEnabled())) {
      throw new NotFoundException('Telegram bot commands are disabled');
    }

    if (!(await this.telegramBot.isWebhookConfigured())) {
      throw new ServiceUnavailableException('Telegram bot webhook is not configured');
    }

    if (!(await this.telegramBot.isWebhookSecretValid(telegramSecret || afrowsSecret))) {
      throw new UnauthorizedException('Invalid Telegram webhook secret');
    }

    return this.telegramBot.handleUpdate(payload);
  }
}
