import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AdminAlertSummary } from '@afrows/shared';
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
  /**
   * Optional Telegram reply_markup: an inline_keyboard for menu-driven flows, a
   * reply keyboard (the R2 request_contact step), or a remove-keyboard directive.
   */
  replyMarkup?: TelegramReplyMarkup;
  /** Telegram parse mode; the bot uses 'HTML' for its menu copy. */
  parseMode?: 'HTML' | 'MarkdownV2';
}

export type TelegramEditMessageResult =
  | { status: 'edited'; statusCode: number }
  | { status: 'unchanged' }
  | { status: 'skipped'; reason: 'missing_config' }
  | { status: 'failed'; statusCode?: number; reason: string };

export interface TelegramInlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

/** Reply-keyboard button (the R2 phone step uses `request_contact`). */
export interface TelegramReplyKeyboardButton {
  text: string;
  request_contact?: boolean;
}

export interface TelegramReplyKeyboardMarkup {
  keyboard: TelegramReplyKeyboardButton[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
}

export interface TelegramReplyKeyboardRemove {
  remove_keyboard: true;
}

export type TelegramReplyMarkup =
  | TelegramInlineKeyboardMarkup
  | TelegramReplyKeyboardMarkup
  | TelegramReplyKeyboardRemove;

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
          ...(options.parseMode ? { parse_mode: options.parseMode } : {}),
          ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
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

  /**
   * Acknowledge an inline-keyboard button tap so Telegram stops the loading
   * spinner. Best-effort: failures are swallowed (the flow already replied).
   */
  async answerCallbackQuery(callbackQueryId: string, options: { text?: string } = {}): Promise<void> {
    const runtime = await this.safeRuntimeConfig();
    const token = runtime?.botToken;
    const normalizedId = callbackQueryId.trim();
    if (!token || !normalizedId) return;

    try {
      await this.outboundHttp.postJson(
        `${this.apiBaseUrl()}/bot${token}/answerCallbackQuery`,
        {
          callback_query_id: normalizedId,
          ...(options.text ? { text: this.truncate(options.text, 180) } : {}),
        },
        { timeoutMs: this.timeoutMs() },
      );
    } catch {
      // Best-effort acknowledgement; ignore transient failures.
    }
  }

  /**
   * Edit a previously-sent message in place (used for menu navigation so the chat
   * stays tidy). Returns 'unchanged' when Telegram rejects a no-op edit, and
   * 'failed' when the message is too old / gone so the caller can send a fresh one.
   */
  async editMessageText(
    chatId: string | number,
    messageId: number,
    text: string,
    options: TelegramSendMessageOptions = {},
  ): Promise<TelegramEditMessageResult> {
    const runtime = await this.safeRuntimeConfig();
    const token = options.botToken ?? runtime?.botToken;
    const normalizedChatId = String(chatId).trim();
    if (!token || !normalizedChatId || !messageId) {
      return { status: 'skipped', reason: 'missing_config' };
    }

    try {
      const response = await this.outboundHttp.postJson(
        `${this.apiBaseUrl()}/bot${token}/editMessageText`,
        {
          chat_id: normalizedChatId,
          message_id: messageId,
          text: this.truncate(text, 3900),
          disable_web_page_preview: options.disableWebPagePreview ?? true,
          ...(options.parseMode ? { parse_mode: options.parseMode } : {}),
          ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
        },
        { timeoutMs: this.timeoutMs() },
      );

      if (response.ok) {
        const parsed = this.parseTelegramResponse(response.body);
        if (parsed.ok === false) {
          // "message is not modified" is a benign no-op edit, not a failure.
          if (parsed.description && /not modified/i.test(parsed.description)) {
            return { status: 'unchanged' };
          }
          return { status: 'failed', statusCode: response.statusCode, reason: this.truncate(parsed.description ?? 'telegram_rejected_edit', 120) };
        }
        return { status: 'edited', statusCode: response.statusCode };
      }

      return { status: 'failed', statusCode: response.statusCode, reason: `telegram_status_${response.statusCode}` };
    } catch (error) {
      return { status: 'failed', reason: error instanceof Error ? this.truncate(error.message, 120) : 'telegram_request_failed' };
    }
  }

  private formatAlert(alert: AdminAlertSummary): string {
    const sourceLabel = alert.sourceLabel || alert.sourceId;
    const lines = [
      'Afrows critical alert',
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
    return this.config.get<string>('AFROWS_TELEGRAM_API_BASE_URL')?.trim().replace(/\/+$/, '') || 'https://api.telegram.org';
  }

  private timeoutMs(): number {
    const configured = Number(this.config.get<string>('AFROWS_TELEGRAM_TIMEOUT_MS'));
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
