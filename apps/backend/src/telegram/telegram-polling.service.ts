import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboundHttpService } from '../outbound/outbound-http.service';
import { TelegramBotConfigService } from './telegram-bot-config.service';
import { TelegramBotService } from './telegram-bot.service';

/**
 * Long-polling driver for the afroWS bot.
 *
 * The Afrows VPS is reachable domestically but NOT from the public internet, so
 * Telegram webhooks (Telegram -> server, inbound) time out — getWebhookInfo shows
 * "Connection timed out". Outbound works (server -> api.telegram.org via the
 * village route), so instead of a webhook we PULL updates with getUpdates and feed
 * each into the same TelegramBotService.handleUpdate logic the webhook used.
 *
 * It follows the same enable switch as the webhook path (`commandsEnabled` + a bot
 * token). On start it clears any stale webhook (getUpdates refuses to run while a
 * webhook is registered) and drops the backlog so old /start spam isn't replayed.
 * Set AFROWS_TELEGRAM_POLLING_DISABLED=true on a publicly-reachable deployment
 * that prefers the webhook instead.
 */
@Injectable()
export class TelegramPollingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramPollingService.name);
  private stopped = false;
  private started = false;
  private offset = 0;

  constructor(
    private readonly telegramBot: TelegramBotService,
    private readonly telegramConfig: TelegramBotConfigService,
    private readonly outboundHttp: OutboundHttpService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (this.pollingDisabled()) {
      this.logger.log('Telegram long-polling disabled (AFROWS_TELEGRAM_POLLING_DISABLED)');
      return;
    }
    void this.run();
  }

  onModuleDestroy(): void {
    this.stopped = true;
  }

  private async run(): Promise<void> {
    if (this.started) return;
    this.started = true;
    let webhookCleared = false;
    let menuPublished = false;

    while (!this.stopped) {
      try {
        const runtime = await this.telegramConfig.getRuntimeConfig();
        if (!runtime.commandsEnabled || !runtime.botToken) {
          webhookCleared = false;
          menuPublished = false;
          await this.sleep(5000);
          continue;
        }

        // getUpdates refuses to run while a webhook is registered; clear it once
        // (dropping the pending backlog so stale /start messages aren't replayed).
        if (!webhookCleared) {
          await this.telegramApi(runtime.botToken, 'deleteWebhook', { drop_pending_updates: true });
          webhookCleared = true;
          this.logger.log('Telegram webhook cleared; long-polling active');
        }

        // Register the command list + the ☰ menu button (shown next to the input)
        // once, so users can tap commands instead of typing them.
        if (!menuPublished) {
          await this.publishBotMenu(runtime.botToken);
          menuPublished = true;
        }

        const updates = await this.getUpdates(runtime.botToken);
        for (const update of updates) {
          const updateId = Number((update as { update_id?: unknown })?.update_id);
          if (Number.isFinite(updateId)) this.offset = Math.max(this.offset, updateId + 1);
          try {
            await this.telegramBot.handleUpdate(update);
          } catch (error) {
            this.logger.warn(`handleUpdate failed: ${(error as Error)?.message ?? String(error)}`);
          }
        }
      } catch (error) {
        // Any failure (incl. 409 = webhook still active) → re-clear + brief backoff.
        webhookCleared = false;
        this.logger.warn(`Telegram poll cycle failed: ${(error as Error)?.message ?? String(error)}`);
        await this.sleep(3000);
      }
    }
  }

  /**
   * Register the bot's command list (default + Persian) and set the chat menu
   * button to "commands", so Telegram shows the ☰ menu next to the attachment
   * icon listing the bot's actions. Best-effort — logs and moves on if it fails.
   */
  private async publishBotMenu(botToken: string): Promise<void> {
    // command names MUST match what telegram-bot.service parseCommand handles
    // (status, charge — not account/buy) or the tap shows "unknown command".
    const commandsEn = [
      { command: 'start', description: 'Start / register' },
      { command: 'menu', description: 'Main menu' },
      { command: 'status', description: 'My account & usage' },
      { command: 'charge', description: 'Buy data' },
      { command: 'invite', description: 'Invite & earn' },
      { command: 'gems', description: 'Gems wallet' },
      { command: 'connect', description: 'Connect my account' },
      { command: 'help', description: 'Help' },
    ];
    const commandsFa = [
      { command: 'start', description: 'شروع / ثبت‌نام' },
      { command: 'menu', description: 'منوی اصلی' },
      { command: 'status', description: 'حساب و مصرف من' },
      { command: 'charge', description: 'خرید حجم' },
      { command: 'invite', description: 'دعوت و جایزه' },
      { command: 'gems', description: 'کیف جم' },
      { command: 'connect', description: 'اتصال حساب من' },
      { command: 'help', description: 'راهنما' },
    ];
    try {
      await this.telegramApi(botToken, 'setMyCommands', { commands: commandsEn });
      await this.telegramApi(botToken, 'setMyCommands', { commands: commandsFa, language_code: 'fa' });
      await this.telegramApi(botToken, 'setChatMenuButton', { menu_button: { type: 'commands' } });
      this.logger.log('Telegram bot commands + menu button published');
    } catch (error) {
      this.logger.warn(`publishBotMenu failed: ${(error as Error)?.message ?? String(error)}`);
    }
  }

  private async getUpdates(botToken: string): Promise<unknown[]> {
    const response = await this.outboundHttp.request(`${this.apiBase()}/bot${botToken}/getUpdates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ offset: this.offset, timeout: 25, allowed_updates: ['message', 'callback_query'] }),
      timeoutMs: 30000,
      maxResponseBytes: 1024 * 1024,
    });
    if (!response.ok) {
      throw new Error(`getUpdates HTTP ${response.statusCode}`);
    }
    const parsed = JSON.parse(response.body) as { ok?: boolean; result?: unknown };
    return Array.isArray(parsed.result) ? parsed.result : [];
  }

  private async telegramApi(botToken: string, method: string, payload: unknown): Promise<void> {
    await this.outboundHttp.request(`${this.apiBase()}/bot${botToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: 10000,
    });
  }

  private apiBase(): string {
    return (
      this.config.get<string>('AFROWS_TELEGRAM_API_BASE_URL')?.trim().replace(/\/+$/, '') ||
      'https://api.telegram.org'
    );
  }

  private pollingDisabled(): boolean {
    const value = this.config.get<string>('AFROWS_TELEGRAM_POLLING_DISABLED')?.trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(value ?? '');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
