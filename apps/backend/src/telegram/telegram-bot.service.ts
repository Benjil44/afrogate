import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import type {
  TelegramBotAccountSummary,
  TelegramBotCommandName,
  TelegramBotWebhookResponse,
} from '@afrogate/shared';
import { BillingService } from '../billing/billing.service';
import { TelegramAlertService } from '../notifications/telegram-alert.service';

interface TelegramWebhookMessage {
  chatId: string;
  fromId?: string;
  username?: string;
  text: string;
}

@Injectable()
export class TelegramBotService {
  constructor(
    private readonly billing: BillingService,
    private readonly config: ConfigService,
    private readonly telegram: TelegramAlertService,
  ) {}

  isWebhookEnabled(): boolean {
    return this.configFlag('AFROGATE_TELEGRAM_BOT_COMMANDS_ENABLED', false);
  }

  isWebhookConfigured(): boolean {
    return Boolean(this.webhookSecret() && this.telegram.isBotConfigured());
  }

  isWebhookSecretValid(value: string | undefined): boolean {
    const expected = this.webhookSecret();
    if (!expected || !value) return false;

    const expectedBuffer = Buffer.from(expected);
    const valueBuffer = Buffer.from(value);
    return expectedBuffer.length === valueBuffer.length && timingSafeEqual(expectedBuffer, valueBuffer);
  }

  async handleUpdate(payload: unknown): Promise<TelegramBotWebhookResponse> {
    const message = this.extractMessage(payload);
    if (!message) return { ok: true, status: 'ignored', reason: 'unsupported_update' };

    const command = this.parseCommand(message.text);
    if (!command) return { ok: true, status: 'ignored', reason: 'non_command' };

    const text = await this.buildReply(command, message);
    const result = await this.telegram.sendMessage(message.chatId, text, { disableWebPagePreview: true });
    if (result.status === 'sent') return { ok: true, status: 'sent', command };

    return {
      ok: false,
      status: 'failed',
      command,
      reason: result.reason,
    };
  }

  private async buildReply(command: TelegramBotCommandName, message: TelegramWebhookMessage): Promise<string> {
    if (command === 'start' || command === 'help') return this.helpReply();
    if (command === 'unknown') return `Unknown command.\n\n${this.helpReply()}`;

    const lookup = await this.billing.getTelegramBotAccountStatus({
      telegramId: message.fromId,
      telegramUsername: message.username,
    });

    if (lookup.status === 'ambiguous') {
      return [
        'Your Telegram username matches more than one AfroGate account.',
        'Ask support to link your numeric Telegram id before account details are shown.',
      ].join('\n');
    }

    if (lookup.status === 'not_found') {
      return [
        'No linked AfroGate account was found.',
        'Ask support to link your Telegram id or username to your account.',
      ].join('\n');
    }

    return this.accountStatusReply(lookup.account, command);
  }

  private accountStatusReply(account: TelegramBotAccountSummary, command: TelegramBotCommandName): string {
    const title = command === 'quota' ? 'AfroGate quota' : 'AfroGate account status';
    const accountName = account.displayName?.trim() || 'Linked account';
    const quotaLine =
      account.quotaLimitBytes === null || account.quotaLimitBytes === undefined
        ? 'Quota: Unlimited'
        : `Quota: ${this.formatBytes(account.remainingBytes ?? 0)} remaining of ${this.formatBytes(account.quotaLimitBytes)}`;

    return [
      title,
      `Account: ${accountName}`,
      `Status: ${account.status}`,
      quotaLine,
      `Used: ${this.formatBytes(account.usedBytes)}`,
      `Clients: ${account.activeClientCount}/${account.clientCount} active`,
    ].join('\n');
  }

  private helpReply(): string {
    return [
      'AfroGate account bot',
      'Commands:',
      '/status - account status and linked clients',
      '/quota - remaining account data',
      '/help - command list',
      'Your Telegram id or username must be linked by support before account details are shown.',
    ].join('\n');
  }

  private extractMessage(payload: unknown): TelegramWebhookMessage | null {
    const update = this.asRecord(payload);
    const rawMessage = this.asRecord(update.message);
    const text = typeof rawMessage.text === 'string' ? rawMessage.text.trim() : '';
    const chat = this.asRecord(rawMessage.chat);
    const from = this.asRecord(rawMessage.from);
    const chatId = this.toNonEmptyString(chat.id);

    if (!text || !chatId || from.is_bot === true) return null;

    return {
      chatId,
      fromId: this.toNonEmptyString(from.id),
      username: typeof from.username === 'string' ? from.username : undefined,
      text,
    };
  }

  private parseCommand(text: string): TelegramBotCommandName | null {
    if (!text.startsWith('/')) return null;

    const [token] = text.split(/\s+/, 1);
    const [name] = token.slice(1).split('@', 1);
    switch (name.toLowerCase()) {
      case 'start':
        return 'start';
      case 'help':
        return 'help';
      case 'status':
        return 'status';
      case 'quota':
        return 'quota';
      default:
        return 'unknown';
    }
  }

  private formatBytes(value: number): string {
    if (!Number.isFinite(value) || value <= 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let amount = value;
    let unitIndex = 0;
    while (amount >= 1024 && unitIndex < units.length - 1) {
      amount /= 1024;
      unitIndex += 1;
    }

    const precision = amount >= 100 || unitIndex === 0 ? 0 : amount >= 10 ? 1 : 2;
    return `${amount.toFixed(precision)} ${units[unitIndex]}`;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  }

  private toNonEmptyString(value: unknown): string | undefined {
    if (typeof value !== 'string' && typeof value !== 'number') return undefined;
    const normalized = String(value).trim();
    return normalized || undefined;
  }

  private webhookSecret(): string | undefined {
    return this.config.get<string>('AFROGATE_TELEGRAM_WEBHOOK_SECRET')?.trim() || undefined;
  }

  private configFlag(name: string, fallback: boolean): boolean {
    const value = this.config.get<string>(name)?.trim().toLowerCase();
    if (!value) return fallback;
    return ['1', 'true', 'yes', 'on'].includes(value);
  }
}
