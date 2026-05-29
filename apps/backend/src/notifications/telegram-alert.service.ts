import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AdminAlertSummary } from '@afrogate/shared';
import { OutboundHttpService } from '../outbound/outbound-http.service';
import { TelegramBotConfigService } from '../telegram/telegram-bot-config.service';

export type TelegramAlertSendResult =
  | { status: 'sent'; statusCode: number; durationMs: number }
  | { status: 'skipped'; reason: 'disabled' | 'missing_config' }
  | { status: 'failed'; statusCode?: number; reason: string; durationMs?: number };

export type TelegramMessageSendResult =
  | { status: 'sent'; statusCode: number; durationMs: number }
  | { status: 'skipped'; reason: 'missing_config' }
  | { status: 'failed'; statusCode?: number; reason: string; durationMs?: number };

interface TelegramApiResponse {
  ok?: boolean;
  description?: string;
}

interface TelegramSendMessageOptions {
  disableWebPagePreview?: boolean;
  botToken?: string;
}

@Injectable()
export class TelegramAlertService {
  constructor(
    private readonly config: ConfigService,
    private readonly outboundHttp: OutboundHttpService,
    private readonly telegramConfig: TelegramBotConfigService,
  ) {}

  async isEnabled(): Promise<boolean> {
    try {
      return (await this.telegramConfig.getSettingsSummary()).alertsEnabled;
    } catch {
      return false;
    }
  }

  async isConfigured(): Promise<boolean> {
    try {
      const settings = await this.telegramConfig.getSettingsSummary();
      return Boolean(settings.hasBotToken && settings.alertChatId);
    } catch {
      return false;
    }
  }

  async isBotConfigured(): Promise<boolean> {
    try {
      return (await this.telegramConfig.getSettingsSummary()).hasBotToken;
    } catch {
      return false;
    }
  }

  async sendAlert(alert: AdminAlertSummary): Promise<TelegramAlertSendResult> {
    const runtime = await this.safeRuntimeConfig();
    if (!runtime?.alertsEnabled) {
      return { status: 'skipped', reason: 'disabled' };
    }

    const chatId = runtime.alertChatId;
    if (!chatId) {
      return { status: 'skipped', reason: 'missing_config' };
    }

    return this.sendMessage(chatId, this.formatAlert(alert), { disableWebPagePreview: true, botToken: runtime.botToken });
  }

  async sendMessage(
    chatId: string | number,
    text: string,
    options: TelegramSendMessageOptions = {},
  ): Promise<TelegramMessageSendResult> {
    const runtime = await this.safeRuntimeConfig();
    const token = options.botToken ?? runtime?.botToken;
    const normalizedChatId = String(chatId).trim();
    if (!token || !normalizedChatId) {
      return { status: 'skipped', reason: 'missing_config' };
    }

    try {
      const response = await this.outboundHttp.postJson(
        `${this.apiBaseUrl()}/bot${token}/sendMessage`,
        {
          chat_id: normalizedChatId,
          text: this.truncate(text, 3900),
          disable_web_page_preview: options.disableWebPagePreview ?? true,
        },
        {
          timeoutMs: this.timeoutMs(),
        },
      );

      if (!response.ok) {
        return {
          status: 'failed',
          statusCode: response.statusCode,
          reason: `telegram_status_${response.statusCode}`,
          durationMs: response.durationMs,
        };
      }

      const parsed = this.parseTelegramResponse(response.body);
      if (parsed.ok === false) {
        return {
          status: 'failed',
          statusCode: response.statusCode,
          reason: parsed.description ? this.truncate(parsed.description, 120) : 'telegram_rejected_message',
          durationMs: response.durationMs,
        };
      }

      return {
        status: 'sent',
        statusCode: response.statusCode,
        durationMs: response.durationMs,
      };
    } catch (error) {
      return {
        status: 'failed',
        reason: error instanceof Error ? this.truncate(error.message, 120) : 'telegram_request_failed',
      };
    }
  }

  private formatAlert(alert: AdminAlertSummary): string {
    const sourceLabel = alert.sourceLabel || alert.sourceId;
    const lines = [
      'AfroGate critical alert',
      `Severity: ${alert.severity}`,
      `Source: ${alert.sourceType} / ${sourceLabel}`,
      `Title: ${alert.title}`,
      `Message: ${alert.message}`,
      `Last seen: ${alert.lastSeenAt}`,
    ];

    return this.truncate(lines.join('\n'), 3900);
  }

  private parseTelegramResponse(body: string): TelegramApiResponse {
    try {
      const value = JSON.parse(body) as TelegramApiResponse;
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  private apiBaseUrl(): string {
    return this.config.get<string>('AFROGATE_TELEGRAM_API_BASE_URL')?.trim().replace(/\/+$/, '') || 'https://api.telegram.org';
  }

  private timeoutMs(): number {
    const configured = Number(this.config.get<string>('AFROGATE_TELEGRAM_TIMEOUT_MS'));
    return Number.isInteger(configured) && configured >= 1000 ? configured : 10000;
  }

  private async safeRuntimeConfig() {
    try {
      return await this.telegramConfig.getRuntimeConfig();
    } catch {
      return null;
    }
  }

  private truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
  }
}
