import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type {
  AdminTelegramBotSettingsSummary,
  AdminTelegramBotTestResponse,
  TelegramBotSettingsSecretSource,
  TelegramBotSettingsTestStatus,
} from '@afrogate/shared';
import { AuditService } from '../audit/audit.service';
import { DatabaseService, type DatabaseQueryExecutor } from '../database/database.service';
import { OutboundHttpService } from '../outbound/outbound-http.service';
import type { AuthActor } from '../security/auth-request';
import { SecretVaultService } from '../security/secret-vault.service';
import type { UpdateTelegramBotSettingsDto } from '../operations/dto/settings.dto';

type TelegramSecretKind = 'telegramBotToken' | 'telegramWebhookSecret';

interface TelegramBotSettingsRow {
  settingKey: string;
  botTokenSecretRef: string | null;
  webhookSecretRef: string | null;
  alertChatId: string | null;
  allowedAdminChatIds: unknown;
  alertsEnabled: boolean;
  commandsEnabled: boolean;
  botId: string | null;
  botUsername: string | null;
  botFirstName: string | null;
  lastTestStatus: string | null;
  lastTestedAt: Date | null;
  lastTestErrorCode: string | null;
  lastTestDurationMs: number | null;
  updatedBy: string | null;
  updatedAt: Date | null;
}

interface TelegramSecretRow {
  secretRef: string;
  kind: string;
  encryptedPayload: string;
  status: string;
}

export interface TelegramBotRuntimeConfig {
  botToken?: string;
  webhookSecret?: string;
  alertChatId?: string;
  alertsEnabled: boolean;
  commandsEnabled: boolean;
}

interface TelegramGetMeResponse {
  ok?: boolean;
  result?: {
    id?: number | string;
    is_bot?: boolean;
    username?: string;
    first_name?: string;
  };
}

@Injectable()
export class TelegramBotConfigService {
  private static readonly settingKey = 'default';

  constructor(
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
    private readonly outboundHttp: OutboundHttpService,
    private readonly secretVault: SecretVaultService,
  ) {}

  async getSettingsSummary(actor?: AuthActor): Promise<AdminTelegramBotSettingsSummary> {
    if (actor) this.assertSuperadmin(actor);

    const row = await this.getSettingsRow();
    return this.mapSettingsSummary(row);
  }

  async updateSettings(
    dto: UpdateTelegramBotSettingsDto,
    actor: AuthActor | undefined,
  ): Promise<AdminTelegramBotSettingsSummary> {
    this.assertSuperadmin(actor);

    const actorLabel = actor?.username ?? actor?.id ?? null;
    const botToken = this.normalizeOptionalSecret(dto.botToken);
    const webhookSecret = this.normalizeOptionalSecret(dto.webhookSecret);
    const alertChatId = this.normalizeOptionalChatId(dto.alertChatId, 'alertChatId');
    const allowedAdminChatIds =
      dto.allowedAdminChatIds === undefined ? undefined : this.normalizeChatIds(dto.allowedAdminChatIds);

    await this.database.transaction(async (executor) => {
      const current = await this.getSettingsRowForUpdate(executor);
      let botTokenSecretRef = current?.botTokenSecretRef ?? null;
      let webhookSecretRef = current?.webhookSecretRef ?? null;
      const changedFields: string[] = [];

      if (dto.clearBotToken) {
        if (botTokenSecretRef) await this.revokeSecret(executor, botTokenSecretRef);
        botTokenSecretRef = null;
        changedFields.push('botToken');
      } else if (botToken) {
        const nextRef = await this.storeSecret(executor, 'telegramBotToken', 'Telegram BotFather token', botToken, actor);
        if (botTokenSecretRef) await this.revokeSecret(executor, botTokenSecretRef);
        botTokenSecretRef = nextRef;
        changedFields.push('botToken');
      }

      if (dto.clearWebhookSecret) {
        if (webhookSecretRef) await this.revokeSecret(executor, webhookSecretRef);
        webhookSecretRef = null;
        changedFields.push('webhookSecret');
      } else if (webhookSecret) {
        const nextRef = await this.storeSecret(
          executor,
          'telegramWebhookSecret',
          'Telegram webhook secret',
          webhookSecret,
          actor,
        );
        if (webhookSecretRef) await this.revokeSecret(executor, webhookSecretRef);
        webhookSecretRef = nextRef;
        changedFields.push('webhookSecret');
      }

      if (dto.alertsEnabled !== undefined) changedFields.push('alertsEnabled');
      if (dto.commandsEnabled !== undefined) changedFields.push('commandsEnabled');
      if (dto.alertChatId !== undefined) changedFields.push('alertChatId');
      if (allowedAdminChatIds !== undefined) changedFields.push('allowedAdminChatIds');

      await executor.query(
        `
          INSERT INTO telegram_bot_settings (
            setting_key, bot_token_secret_ref, webhook_secret_ref, alert_chat_id,
            allowed_admin_chat_ids, alerts_enabled, commands_enabled, updated_by
          )
          VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
          ON CONFLICT (setting_key)
          DO UPDATE SET
            bot_token_secret_ref = excluded.bot_token_secret_ref,
            webhook_secret_ref = excluded.webhook_secret_ref,
            alert_chat_id = excluded.alert_chat_id,
            allowed_admin_chat_ids = excluded.allowed_admin_chat_ids,
            alerts_enabled = excluded.alerts_enabled,
            commands_enabled = excluded.commands_enabled,
            updated_by = excluded.updated_by,
            updated_at = now()
        `,
        [
          TelegramBotConfigService.settingKey,
          botTokenSecretRef,
          webhookSecretRef,
          dto.alertChatId !== undefined ? alertChatId : current?.alertChatId ?? null,
          JSON.stringify(allowedAdminChatIds ?? this.chatIdsFromUnknown(current?.allowedAdminChatIds)),
          dto.alertsEnabled ?? current?.alertsEnabled ?? false,
          dto.commandsEnabled ?? current?.commandsEnabled ?? false,
          actorLabel,
        ],
      );

      await this.audit.record(
        actor,
        'settings.telegram.update',
        'telegram_bot_settings',
        TelegramBotConfigService.settingKey,
        {
          changedFields,
          hasBotToken: Boolean(botTokenSecretRef),
          hasWebhookSecret: Boolean(webhookSecretRef),
          alertChatIdPresent: Boolean(dto.alertChatId !== undefined ? alertChatId : current?.alertChatId),
          allowedAdminChatCount: allowedAdminChatIds?.length ?? this.chatIdsFromUnknown(current?.allowedAdminChatIds).length,
          alertsEnabled: dto.alertsEnabled ?? current?.alertsEnabled ?? false,
          commandsEnabled: dto.commandsEnabled ?? current?.commandsEnabled ?? false,
        },
        executor,
      );
    });

    return this.getSettingsSummary();
  }

  async testConnection(actor: AuthActor | undefined): Promise<AdminTelegramBotTestResponse> {
    this.assertSuperadmin(actor);

    const row = await this.getSettingsRow();
    const startedAt = Date.now();
    let status: TelegramBotSettingsTestStatus = 'failed';
    let errorCode: string | null = null;
    let botId: string | null = null;
    let botUsername: string | null = null;
    let botFirstName: string | null = null;

    try {
      const botToken = await this.resolveSecretOrEnv(row, row?.botTokenSecretRef ?? null, 'telegramBotToken', 'AFROGATE_TELEGRAM_BOT_TOKEN');

      if (!botToken) {
        status = 'missingToken';
        errorCode = 'missing_bot_token';
      } else {
        const response = await this.outboundHttp.request(`${this.apiBaseUrl()}/bot${botToken}/getMe`, {
          headers: {
            Accept: 'application/json',
          },
          timeoutMs: this.timeoutMs(),
        });

        if (!response.ok) {
          status = 'failed';
          errorCode = `telegram_status_${response.statusCode}`;
        } else {
          const parsed = this.parseGetMeResponse(response.body);
          if (parsed.ok === true && parsed.result?.is_bot === true) {
            status = 'ok';
            botId = parsed.result.id === undefined ? null : String(parsed.result.id);
            botUsername = parsed.result.username?.trim() || null;
            botFirstName = parsed.result.first_name?.trim() || null;
          } else {
            status = 'failed';
            errorCode = 'telegram_rejected_get_me';
          }
        }
      }
    } catch {
      status = 'failed';
      errorCode = 'telegram_request_failed';
    }

    const durationMs = Date.now() - startedAt;
    await this.recordTestResult({
      actor,
      botId,
      botUsername,
      botFirstName,
      durationMs,
      errorCode,
      status,
    });

    return {
      ok: status === 'ok',
      status,
      durationMs,
      botUsername,
      errorCode,
      telegramBot: await this.getSettingsSummary(),
    };
  }

  async getRuntimeConfig(): Promise<TelegramBotRuntimeConfig> {
    const row = await this.getSettingsRow();

    return {
      botToken: await this.resolveSecretOrEnv(row, row?.botTokenSecretRef ?? null, 'telegramBotToken', 'AFROGATE_TELEGRAM_BOT_TOKEN'),
      webhookSecret: await this.resolveSecretOrEnv(
        row,
        row?.webhookSecretRef ?? null,
        'telegramWebhookSecret',
        'AFROGATE_TELEGRAM_WEBHOOK_SECRET',
      ),
      alertChatId: row?.alertChatId?.trim() || this.nonEmptyConfig('AFROGATE_TELEGRAM_ALERT_CHAT_ID'),
      alertsEnabled: row ? row.alertsEnabled : this.configFlag('AFROGATE_TELEGRAM_ALERTS_ENABLED', false),
      commandsEnabled: row ? row.commandsEnabled : this.configFlag('AFROGATE_TELEGRAM_BOT_COMMANDS_ENABLED', false),
    };
  }

  private async recordTestResult(input: {
    actor: AuthActor | undefined;
    botId: string | null;
    botUsername: string | null;
    botFirstName: string | null;
    durationMs: number;
    errorCode: string | null;
    status: TelegramBotSettingsTestStatus;
  }): Promise<void> {
    await this.database.transaction(async (executor) => {
      await executor.query(
        `
          INSERT INTO telegram_bot_settings (
            setting_key, bot_id, bot_username, bot_first_name,
            last_test_status, last_tested_at, last_test_error_code,
            last_test_duration_ms, alert_chat_id, alerts_enabled,
            commands_enabled, updated_by
          )
          VALUES ($1, $2, $3, $4, $5, now(), $6, $7, $8, $9, $10, $11)
          ON CONFLICT (setting_key)
          DO UPDATE SET
            bot_id = COALESCE(excluded.bot_id, telegram_bot_settings.bot_id),
            bot_username = COALESCE(excluded.bot_username, telegram_bot_settings.bot_username),
            bot_first_name = COALESCE(excluded.bot_first_name, telegram_bot_settings.bot_first_name),
            last_test_status = excluded.last_test_status,
            last_tested_at = excluded.last_tested_at,
            last_test_error_code = excluded.last_test_error_code,
            last_test_duration_ms = excluded.last_test_duration_ms,
            updated_by = excluded.updated_by,
            updated_at = now()
        `,
        [
          TelegramBotConfigService.settingKey,
          input.botId,
          input.botUsername,
          input.botFirstName,
          input.status,
          input.errorCode,
          input.durationMs,
          this.nonEmptyConfig('AFROGATE_TELEGRAM_ALERT_CHAT_ID') ?? null,
          this.configFlag('AFROGATE_TELEGRAM_ALERTS_ENABLED', false),
          this.configFlag('AFROGATE_TELEGRAM_BOT_COMMANDS_ENABLED', false),
          input.actor?.username ?? input.actor?.id ?? null,
        ],
      );

      await this.audit.record(
        input.actor,
        'settings.telegram.test',
        'telegram_bot_settings',
        TelegramBotConfigService.settingKey,
        {
          status: input.status,
          ok: input.status === 'ok',
          durationMs: input.durationMs,
          errorCode: input.errorCode,
          botUsername: input.botUsername,
        },
        executor,
      );
    });
  }

  private async storeSecret(
    executor: DatabaseQueryExecutor,
    kind: TelegramSecretKind,
    name: string,
    secret: string,
    actor: AuthActor | undefined,
  ): Promise<string> {
    const secretRef = `secret:${randomUUID()}`;
    const encrypted = this.secretVault.encryptJson(
      {
        kind,
        value: secret,
      },
      this.telegramSecretContext(secretRef, kind),
    );
    const fingerprint = this.secretVault.fingerprint(secret);

    await executor.query(
      `
        INSERT INTO secret_records (
          secret_ref, name, kind, scope, encrypted_payload, key_id,
          fingerprint, created_by
        )
        VALUES ($1, $2, $3, 'telegram_bot', $4, $5, $6, $7)
      `,
      [
        secretRef,
        name,
        kind,
        encrypted.payload,
        encrypted.keyId,
        fingerprint,
        actor?.username ?? actor?.id ?? null,
      ],
    );

    await this.audit.record(
      actor,
      'settings.telegram.secret.store',
      'secret_record',
      secretRef,
      {
        kind,
        keyId: encrypted.keyId,
        fingerprint,
      },
      executor,
    );

    return secretRef;
  }

  private async revokeSecret(executor: DatabaseQueryExecutor, secretRef: string): Promise<void> {
    await executor.query(
      `
        UPDATE secret_records
        SET status = 'revoked',
            revoked_at = COALESCE(revoked_at, now()),
            updated_at = now()
        WHERE secret_ref = $1
          AND scope = 'telegram_bot'
          AND status = 'active'
      `,
      [secretRef],
    );
  }

  private async resolveSecretOrEnv(
    row: TelegramBotSettingsRow | null,
    secretRef: string | null,
    kind: TelegramSecretKind,
    envName: string,
  ): Promise<string | undefined> {
    if (row && secretRef) return this.decryptSecret(secretRef, kind);
    return this.nonEmptyConfig(envName);
  }

  private async decryptSecret(secretRef: string, expectedKind: TelegramSecretKind): Promise<string | undefined> {
    const result = await this.database.query<TelegramSecretRow>(
      `
        SELECT
          secret_ref AS "secretRef",
          kind,
          encrypted_payload AS "encryptedPayload",
          status
        FROM secret_records
        WHERE secret_ref = $1
          AND scope = 'telegram_bot'
        LIMIT 1
      `,
      [secretRef],
    );
    const row = result.rows[0];
    if (!row || row.status !== 'active' || row.kind !== expectedKind) return undefined;

    const decrypted = this.secretVault.decryptJson(row.encryptedPayload, this.telegramSecretContext(row.secretRef, expectedKind));
    const value = decrypted.value;
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private async getSettingsRow(): Promise<TelegramBotSettingsRow | null> {
    try {
      const result = await this.database.query<TelegramBotSettingsRow>(
        this.settingsSelectSql('WHERE setting_key = $1'),
        [TelegramBotConfigService.settingKey],
      );
      return result.rows[0] ?? null;
    } catch (error) {
      if (this.isUndefinedTableError(error)) return null;
      throw error;
    }
  }

  private async getSettingsRowForUpdate(executor: DatabaseQueryExecutor): Promise<TelegramBotSettingsRow | null> {
    const result = await executor.query<TelegramBotSettingsRow>(
      this.settingsSelectSql('WHERE setting_key = $1 FOR UPDATE'),
      [TelegramBotConfigService.settingKey],
    );
    return result.rows[0] ?? null;
  }

  private settingsSelectSql(whereClause: string): string {
    return `
      SELECT
        setting_key AS "settingKey",
        bot_token_secret_ref AS "botTokenSecretRef",
        webhook_secret_ref AS "webhookSecretRef",
        alert_chat_id AS "alertChatId",
        allowed_admin_chat_ids AS "allowedAdminChatIds",
        alerts_enabled AS "alertsEnabled",
        commands_enabled AS "commandsEnabled",
        bot_id AS "botId",
        bot_username AS "botUsername",
        bot_first_name AS "botFirstName",
        last_test_status AS "lastTestStatus",
        last_tested_at AS "lastTestedAt",
        last_test_error_code AS "lastTestErrorCode",
        last_test_duration_ms AS "lastTestDurationMs",
        updated_by AS "updatedBy",
        updated_at AS "updatedAt"
      FROM telegram_bot_settings
      ${whereClause}
    `;
  }

  private mapSettingsSummary(row: TelegramBotSettingsRow | null): AdminTelegramBotSettingsSummary {
    const envBotToken = Boolean(this.nonEmptyConfig('AFROGATE_TELEGRAM_BOT_TOKEN'));
    const envWebhookSecret = Boolean(this.nonEmptyConfig('AFROGATE_TELEGRAM_WEBHOOK_SECRET'));
    const envAlertChatId = this.nonEmptyConfig('AFROGATE_TELEGRAM_ALERT_CHAT_ID');
    const botTokenSource = this.secretSource(row?.botTokenSecretRef, envBotToken);
    const webhookSecretSource = this.secretSource(row?.webhookSecretRef, envWebhookSecret);
    const alertChatIdSource: TelegramBotSettingsSecretSource = row?.alertChatId
      ? 'database'
      : envAlertChatId
        ? 'environment'
        : 'none';

    return {
      hasBotToken: botTokenSource !== 'none',
      botTokenSource,
      hasWebhookSecret: webhookSecretSource !== 'none',
      webhookSecretSource,
      alertsEnabled: row ? row.alertsEnabled : this.configFlag('AFROGATE_TELEGRAM_ALERTS_ENABLED', false),
      commandsEnabled: row ? row.commandsEnabled : this.configFlag('AFROGATE_TELEGRAM_BOT_COMMANDS_ENABLED', false),
      alertChatId: row?.alertChatId ?? envAlertChatId ?? null,
      alertChatIdSource,
      allowedAdminChatIds: this.chatIdsFromUnknown(row?.allowedAdminChatIds),
      outboundProxyConfigured: Boolean(this.nonEmptyConfig('AFROGATE_OUTBOUND_PROXY_URL')),
      botId: row?.botId ?? null,
      botUsername: row?.botUsername ?? null,
      botFirstName: row?.botFirstName ?? null,
      lastTestStatus: row?.lastTestStatus ?? 'notTested',
      lastTestedAt: row?.lastTestedAt?.toISOString() ?? null,
      lastTestErrorCode: row?.lastTestErrorCode ?? null,
      lastTestDurationMs: row?.lastTestDurationMs ?? null,
      updatedBy: row?.updatedBy ?? null,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
    };
  }

  private secretSource(secretRef: string | null | undefined, hasEnvValue: boolean): TelegramBotSettingsSecretSource {
    if (secretRef) return 'database';
    return hasEnvValue ? 'environment' : 'none';
  }

  private normalizeOptionalSecret(value: string | undefined): string | null {
    if (value === undefined) return null;
    const normalized = value.trim();
    return normalized || null;
  }

  private normalizeOptionalChatId(value: string | null | undefined, fieldName: string): string | null {
    if (value === undefined) return null;
    if (value === null) return null;
    const normalized = value.trim();
    if (!normalized) return null;
    if (!/^-?[0-9]{1,32}$/.test(normalized)) {
      throw new BadRequestException(`${fieldName} must be a numeric Telegram chat id`);
    }
    return normalized;
  }

  private normalizeChatIds(values: string[]): string[] {
    const normalized = values
      .map((value) => this.normalizeOptionalChatId(value, 'allowedAdminChatIds'))
      .filter((value): value is string => Boolean(value));

    return [...new Set(normalized)].slice(0, 50);
  }

  private chatIdsFromUnknown(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return this.normalizeChatIds(value.map((item) => String(item)));
  }

  private parseGetMeResponse(body: string): TelegramGetMeResponse {
    try {
      const parsed = JSON.parse(body) as unknown;
      return parsed && typeof parsed === 'object' ? (parsed as TelegramGetMeResponse) : {};
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

  private nonEmptyConfig(name: string): string | undefined {
    const value = this.config.get<string>(name)?.trim();
    return value || undefined;
  }

  private configFlag(name: string, fallback: boolean): boolean {
    const value = this.config.get<string>(name)?.trim().toLowerCase();
    if (!value) return fallback;
    return ['1', 'true', 'yes', 'on'].includes(value);
  }

  private telegramSecretContext(secretRef: string, kind: TelegramSecretKind): string {
    return `telegram_bot:${kind}:${secretRef}`;
  }

  private assertSuperadmin(actor: AuthActor | undefined): void {
    if (actor?.role === 'superadmin' || actor?.isSuperAdmin) return;
    throw new ForbiddenException('Only superadmin can update Telegram bot settings');
  }

  private isUndefinedTableError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && ['42P01', '42703'].includes(String(error.code));
  }
}
