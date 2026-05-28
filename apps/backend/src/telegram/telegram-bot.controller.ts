import {
  Body,
  Controller,
  Headers,
  HttpCode,
  NotFoundException,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { TelegramBotWebhookResponse } from '@afrogate/shared';
import { TelegramBotService } from './telegram-bot.service';

@Controller('telegram')
export class TelegramBotController {
  constructor(private readonly telegramBot: TelegramBotService) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Body() payload: unknown,
    @Headers('x-telegram-bot-api-secret-token') telegramSecret?: string,
    @Headers('x-afrogate-telegram-webhook-secret') afrogateSecret?: string,
  ): Promise<TelegramBotWebhookResponse> {
    if (!this.telegramBot.isWebhookEnabled()) {
      throw new NotFoundException('Telegram bot commands are disabled');
    }

    if (!this.telegramBot.isWebhookConfigured()) {
      throw new ServiceUnavailableException('Telegram bot webhook is not configured');
    }

    if (!this.telegramBot.isWebhookSecretValid(telegramSecret || afrogateSecret)) {
      throw new UnauthorizedException('Invalid Telegram webhook secret');
    }

    return this.telegramBot.handleUpdate(payload);
  }
}
