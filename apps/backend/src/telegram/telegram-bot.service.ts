import { Injectable } from '@nestjs/common';
import { telegramWebhookSecretMatches } from './telegram-webhook-secret';
import type {
  TelegramBotAccountSummary,
  TelegramBotCommandName,
  TelegramBotWebhookResponse,
} from '@afrows/shared';
import { BillingService } from '../billing/billing.service';
import { TelegramAlertService } from '../notifications/telegram-alert.service';
import { TelegramBotConfigService } from './telegram-bot-config.service';

interface TelegramWebhookMessage {
  chatId: string;
  fromId?: string;
  username?: string;
  text: string;
}

type LinkedTelegramBotCommandName = Extract<TelegramBotCommandName, 'status' | 'quota'>;

@Injectable()
export class TelegramBotService {
  constructor(
    private readonly billing: BillingService,
    private readonly telegram: TelegramAlertService,
    private readonly telegramConfig: TelegramBotConfigService,
  ) {}

  async isWebhookEnabled(): Promise<boolean> {
    try {
      return (await this.telegramConfig.getRuntimeConfig()).commandsEnabled;
    } catch {
      return false;
    }
  }

  async isWebhookConfigured(): Promise<boolean> {
    try {
      const runtime = await this.telegramConfig.getRuntimeConfig();
      return Boolean(runtime.webhookSecret && runtime.botToken);
    } catch {
      return false;
    }
  }

  async isWebhookSecretValid(value: string | undefined): Promise<boolean> {
    const expected = await this.webhookSecret();
    return telegramWebhookSecretMatches(expected, value);
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
    if (command === 'start') {
      const linkedCommand = this.startLinkedAccountCommand(message.text);
      return linkedCommand ? this.linkedAccountReply(linkedCommand, message) : this.helpReply();
    }
    if (command === 'help') return this.helpReply();
    if (command === 'unknown') return `Unknown command.\n\n${this.helpReply()}`;

    return this.linkedAccountReply(command, message);
  }

  private async linkedAccountReply(
    command: LinkedTelegramBotCommandName,
    message: TelegramWebhookMessage,
  ): Promise<string> {
    const lookup = await this.billing.getTelegramBotAccountStatus({
      telegramId: message.fromId,
      telegramUsername: message.username,
    });

    if (lookup.status === 'ambiguous') {
      return [
        'Your Telegram username matches more than one Afrows account.',
        'Ask support to link your numeric Telegram id before account details are shown.',
      ].join('\n');
    }

    if (lookup.status === 'not_found') {
      return [
        'No linked Afrows account was found.',
        'Ask support to link your Telegram id or username to your account.',
      ].join('\n');
    }

    return this.accountStatusReply(lookup.account, command);
  }

  private accountStatusReply(account: TelegramBotAccountSummary, command: LinkedTelegramBotCommandName): string {
    const title = command === 'quota' ? 'Afrows quota' : 'Afrows account status';
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
      'Afrows account bot',
      'Commands:',
      '/status - account status and linked clients',
      '/quota - remaining account data',
      '/usage - account status and remaining data',
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
      case 'usage':
        return 'status';
      default:
        return 'unknown';
    }
  }

  private startLinkedAccountCommand(text: string): LinkedTelegramBotCommandName | null {
    const [, rawArgument] = text.trim().split(/\s+/, 2);
    const argument = rawArgument?.trim().toLowerCase();
    if (argument === 'status' || argument === 'usage') return 'status';
    if (argument === 'quota') return 'quota';
    return null;
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

  private async webhookSecret(): Promise<string | undefined> {
    try {
      return (await this.telegramConfig.getRuntimeConfig()).webhookSecret;
    } catch {
      return undefined;
    }
  }
}
