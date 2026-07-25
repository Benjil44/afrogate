import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { AdminTelegramBotProfile } from '@afrows/shared';
import { AuditService } from '../audit/audit.service';
import { OutboundHttpService } from '../outbound/outbound-http.service';
import type { AuthActor } from '../security/auth-request';
import { TelegramBotConfigService } from './telegram-bot-config.service';
import {
  interpretTelegramApiError,
  isTelegramResponseOk,
  parseTelegramResultField,
  planTelegramProfileUpdate,
  tokenNotConfiguredState,
  type TelegramBotProfile,
  type TelegramBotProfileUpdate,
  type TelegramProfileSetterCall,
} from './telegram-profile';

interface BotApiAccess {
  botToken: string;
  apiBaseUrl: string;
  timeoutMs: number;
}

/**
 * Publishes the afroWS bot's Telegram profile (name / about / description) using
 * the server-stored, encrypted bot token. The token is resolved via
 * TelegramBotConfigService.getBotApiAccess() and stays server-side — it is never
 * returned to the dashboard. All Telegram traffic goes through
 * OutboundHttpService (SSRF policy + village/SOCKS route). Pure planning,
 * parsing and error mapping live in ./telegram-profile (node --test covered).
 */
@Injectable()
export class TelegramProfileService {
  constructor(
    private readonly audit: AuditService,
    private readonly botConfig: TelegramBotConfigService,
    private readonly outboundHttp: OutboundHttpService,
  ) {}

  /**
   * Resolve the live profile from Telegram. When no bot token is configured the
   * caller gets a clear `tokenConfigured: false` state (with null fields) instead
   * of a 500 — the dashboard prompts the operator to save a token first.
   */
  async getProfile(): Promise<AdminTelegramBotProfile> {
    const access = await this.resolveAccess();
    if (!access) {
      return tokenNotConfiguredState();
    }
    const profile = await this.fetchProfile(access);
    return { ...profile, tokenConfigured: true };
  }

  /**
   * Publish the provided, changed fields to Telegram (each via its matching
   * setMy* method), then return the refreshed profile. Audits which fields
   * changed (field names only, never the values). Telegram failures are mapped
   * to helpful 400/503 errors rather than a raw 500.
   */
  async updateProfile(
    requested: TelegramBotProfileUpdate,
    actor: AuthActor | undefined,
  ): Promise<AdminTelegramBotProfile> {
    const access = await this.resolveAccess();
    if (!access) {
      throw new BadRequestException(
        'Telegram bot token is not configured — save a BotFather token in Telegram settings first.',
      );
    }

    const current = await this.fetchProfile(access);
    const calls = planTelegramProfileUpdate(current, requested);

    for (const call of calls) {
      await this.publishField(access, call);
    }

    const refreshed = await this.fetchProfile(access);

    await this.audit.record(actor, 'telegram.bot_profile.update', 'telegram_bot_settings', 'default', {
      changedFields: calls.map((call) => call.field),
    });

    return { ...refreshed, tokenConfigured: true };
  }

  private async resolveAccess(): Promise<BotApiAccess | null> {
    const access = await this.botConfig.getBotApiAccess();
    if (!access.botToken) return null;
    return { botToken: access.botToken, apiBaseUrl: access.apiBaseUrl, timeoutMs: access.timeoutMs };
  }

  private async fetchProfile(access: BotApiAccess): Promise<TelegramBotProfile> {
    const [name, shortDescription, description] = await Promise.all([
      this.callGetter(access, 'getMyName', 'name'),
      this.callGetter(access, 'getMyShortDescription', 'short_description'),
      this.callGetter(access, 'getMyDescription', 'description'),
    ]);
    return { name, shortDescription, description };
  }

  private async callGetter(
    access: BotApiAccess,
    method: 'getMyName' | 'getMyShortDescription' | 'getMyDescription',
    field: 'name' | 'short_description' | 'description',
  ): Promise<string | null> {
    const response = await this.telegramRequest(() =>
      this.outboundHttp.request(this.endpoint(access, method), {
        headers: { Accept: 'application/json' },
        timeoutMs: access.timeoutMs,
      }),
    );
    if (!response.ok || !isTelegramResponseOk(response.body)) {
      const error = interpretTelegramApiError(response.statusCode, response.body);
      throw new BadRequestException(error.message);
    }
    return parseTelegramResultField(response.body, field);
  }

  private async publishField(access: BotApiAccess, call: TelegramProfileSetterCall): Promise<void> {
    const response = await this.telegramRequest(() =>
      this.outboundHttp.postJson(
        this.endpoint(access, call.method),
        { [call.bodyKey]: call.value },
        { timeoutMs: access.timeoutMs },
      ),
    );
    if (!response.ok || !isTelegramResponseOk(response.body)) {
      const error = interpretTelegramApiError(response.statusCode, response.body);
      throw new BadRequestException(error.message);
    }
  }

  /** Run a Telegram HTTP call, mapping transport failures to a 503 (not a 500). */
  private async telegramRequest<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch {
      throw new ServiceUnavailableException(
        'Could not reach Telegram — the server may need an outbound proxy to reach api.telegram.org.',
      );
    }
  }

  private endpoint(access: BotApiAccess, method: string): string {
    return `${access.apiBaseUrl}/bot${access.botToken}/${method}`;
  }
}
