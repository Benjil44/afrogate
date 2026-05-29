import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, randomBytes, randomUUID } from 'crypto';
import type {
  AdminClientSubscriptionCredentialSummary,
  AdminBillingCatalogResponse,
  AdminBillingSettingsSummary,
  AdminCurrentPanelImportConfigsResponse,
  AdminCurrentPanelImportPreviewResponse,
  AdminCurrentPanelUsageSyncResponse,
  AdminCurrentPanelVolumeChargeEventSummary,
  AdminCurrentPanelVolumeChargeResponse,
  AdminRewardedAdSettingsSummary,
  ClientAccessTokenSummary,
  ClientPortalProfileResponse,
  ClientRouteOptionsResponse,
  ClientRoutePreferenceSummary,
  ClientSubscriptionConfigLinkSummary,
  ClientSubscriptionEndpointSummary,
  ClientSubscriptionResponse,
  TelegramBotAccountLookup,
  TelegramBotAccountSummary,
  AdminClientConfigSummary,
  AdminClientConfigsExportResponse,
  AdminClientRoutePreferenceSummary,
  AdminClientUsageEventSummary,
  AdminAllocatePaymentOrderResponse,
  AdminCustomerAccountDetail,
  AdminCustomerAccountSummary,
  AdminPayPalPaymentOrderResponse,
  AdminPaymentProviderAdapterSummary,
  AdminPaymentProviderCheckoutResponse,
  AdminPaymentOrderAllocationSummary,
  AdminTelegramPurchaseFulfillmentSummary,
  IssuedClientAccessTokenSummary,
  AdminPaymentMethodSummary,
  AdminPaymentOrderSummary,
  AdminRecordClientUsageResponse,
  AdminVolumePackageSummary,
  CurrentPanelImportCandidate,
  CurrentPanelImportConfigsRequest,
  CurrentPanelImportPreviewRequest,
  CurrentPanelImportSkippedCandidate,
  CurrentPanelUsageSyncRequest,
  CurrentPanelVolumeChargeScope,
  ClientRewardedAdClaimResponse,
  ClientRewardedAdGrantSummary,
  ClientRewardedAdStatus,
  RewardedAdWebhookHandlerResponse,
  PayPalWebhookHandlerResponse,
} from '@afrogate/shared';
import { AuditService } from '../audit/audit.service';
import { DatabaseService, type DatabaseQueryExecutor } from '../database/database.service';
import type { AuditActor, AuthActor, ClientAuthActor } from '../security/auth-request';
import { hashClientToken } from '../security/client-token';
import { SecretVaultService } from '../security/secret-vault.service';
import { TelegramAlertService, type TelegramMessageSendResult } from '../notifications/telegram-alert.service';
import { TelegramBotConfigService } from '../telegram/telegram-bot-config.service';
import { UpdateOwnClientRoutePreferenceDto } from '../client/dto/client-route-preference.dto';
import { ClaimRewardedAdDto } from '../client/dto/rewarded-ad.dto';
import { RewardedAdProviderWebhookDto } from './dto/rewarded-ad-webhook.dto';
import { IssueClientAccessTokenDto } from './dto/client-access-token.dto';
import {
  CurrentPanelImportConfigsDto,
  CurrentPanelImportPreviewDto,
  CurrentPanelUsageSyncDto,
  CurrentPanelVolumeChargeDto,
  CreateClientUsageEventDto,
  CreateClientConfigDto,
  CreateCustomerAccountDto,
  UpdateClientConfigDto,
  UpdateCustomerAccountDto,
  UpsertClientSubscriptionCredentialDto,
  UpsertClientRoutePreferenceDto,
} from './dto/customer-account.dto';
import {
  AllocatePaymentOrderDto,
  CapturePayPalPaymentOrderDto,
  CreatePayPalCheckoutDto,
  CreatePaymentProviderCheckoutDto,
  CreatePaymentMethodDto,
  CreatePaymentOrderDto,
  CreateVolumePackageDto,
  UpdateBillingSettingsDto,
  UpdateRewardedAdSettingsDto,
  UpdatePaymentMethodDto,
  UpdatePaymentOrderStatusDto,
  UpdateVolumePackageDto,
} from './dto/billing.dto';
import { PayPalPaymentService, type PayPalWebhookSignatureHeaders } from './paypal-payment.service';
import { buildCurrentPanelImportPreview } from './current-panel-import.adapters';
import {
  listPaymentProviderAdapters,
  prepareAdditionalPaymentProviderCheckout,
  type PreparedPaymentProviderCheckout,
} from './payment-provider-adapters';
import { RewardedAdWebhookService, type RewardedAdWebhookSignatureHeaders } from './rewarded-ad-webhook.service';

const BYTES_PER_GB = 1024 ** 3;
const DEFAULT_REWARDED_AD_PROVIDER = 'mvp_rewarded_ad';
const DEFAULT_REWARDED_AD_REWARD_BYTES = 100 * 1024 ** 2;
const DEFAULT_REWARDED_AD_DAILY_LIMIT = 20;
const DEFAULT_REWARDED_AD_VERIFICATION_MODE = 'client_callback_mvp';
const MAX_REWARDED_AD_REWARD_BYTES = 10 * BYTES_PER_GB;
const MAX_REWARDED_AD_DAILY_LIMIT = 1000;
const MAX_SAFE_BYTES = Number.MAX_SAFE_INTEGER;
const CURRENT_PANEL_IMPORTABLE_STATUSES = new Set(['active', 'limited', 'disabled', 'expired']);
const CURRENT_PANEL_VOLUME_CHARGE_SCOPES = new Set<CurrentPanelVolumeChargeScope>([
  'account_quota',
  'selected_clients',
  'account_and_selected_clients',
]);
const CLIENT_USAGE_EVENT_SOURCES = new Set([
  'admin',
  'agent',
  'panel_sync',
  'payment_adjustment',
  'manual_adjustment',
  'client_report',
  'unknown',
]);
const CLIENT_USAGE_DIRECTIONS = new Set(['rx', 'tx', 'combined']);
const CLIENT_SUBSCRIPTION_PROTOCOLS = new Set(['wireguard', 'vless', 'l2tp', 'ikev2']);
const CLIENT_SUBSCRIPTION_SECRET_MAX_BYTES = 16_000;
const CLIENT_SUBSCRIPTION_PUBLIC_METADATA_MAX_BYTES = 4_000;
const CLIENT_SUBSCRIPTION_PUBLIC_METADATA_KEYS = new Set([
  'allowedIPs',
  'allowedIps',
  'alpn',
  'clientDns',
  'dns',
  'encryption',
  'fingerprint',
  'flow',
  'headerType',
  'hostHeader',
  'keepalive',
  'mtu',
  'network',
  'path',
  'peerPublicKey',
  'persistentKeepalive',
  'publicKey',
  'remoteId',
  'security',
  'serverId',
  'serverName',
  'serverPublicKey',
  'serviceName',
  'sni',
  'transport',
  'type',
]);

interface CustomerAccountRow {
  id: string;
  displayName: string | null;
  telegramId: string | null;
  telegramUsername: string | null;
  paidNumberHash: string | null;
  status: string;
  quotaScope: string;
  quotaLimitBytes: string | number | null;
  perClientLimitBytes: string | number | null;
  usedBytes: string | number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  clientCount: number;
  activeClientCount: number;
}

interface ClientConfigRow {
  id: string;
  customerAccountId: string;
  label: string;
  protocol: string;
  externalPanel: string | null;
  externalPanelUserId: string | null;
  externalPanelConfigId: string | null;
  deviceLimit: number | null;
  quotaLimitBytes: string | number | null;
  usedBytes: string | number;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  routePreferenceId?: string | null;
  routePreferenceRouteGroup?: string | null;
  routePreferenceMode?: string | null;
  routePreferenceDetectedCountryCode?: string | null;
  routePreferenceDetectedCountrySource?: string | null;
  routePreferencePreferredExitCountryCode?: string | null;
  routePreferencePreferredOutboundId?: string | null;
  routePreferencePreferredOutboundName?: string | null;
  routePreferenceScoreProfile?: string | null;
  routePreferenceAutoDetectCountry?: boolean | null;
  routePreferenceAllowClientOverride?: boolean | null;
  routePreferenceRouteLocked?: boolean | null;
  routePreferenceStickySessionProtection?: boolean | null;
  routePreferenceLastDetectedAt?: Date | null;
  routePreferenceCreatedBy?: string | null;
  routePreferenceCreatedAt?: Date | null;
  routePreferenceUpdatedAt?: Date | null;
}

interface TelegramFulfillmentClientRow {
  id: string;
  customerAccountId: string;
  label: string;
  protocol: string;
  status: string;
  accountStatus: string;
}

interface ClientRoutePreferenceRow {
  id: string;
  clientConfigId: string;
  customerAccountId: string;
  clientLabel: string;
  routeGroup: string;
  mode: string;
  detectedCountryCode: string | null;
  detectedCountrySource: string | null;
  preferredExitCountryCode: string | null;
  preferredOutboundId: string | null;
  preferredOutboundName: string | null;
  preferredOutboundRouteGroup: string | null;
  scoreProfile: string;
  autoDetectCountry: boolean;
  allowClientOverride: boolean;
  routeLocked: boolean;
  stickySessionProtection: boolean;
  lastDetectedAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ClientRoutePreferencePatch {
  mode: string;
  detectedCountryCode: string | null;
  detectedCountrySource: string | null;
  preferredExitCountryCode: string | null;
  preferredOutboundId: string | null;
  scoreProfile: string;
  autoDetectCountry: boolean;
  allowClientOverride: boolean;
  routeLocked: boolean;
  stickySessionProtection: boolean;
  lastDetectedAt: Date | null;
}

interface ClientAccessTokenRow {
  id: string;
  clientConfigId: string;
  name: string;
  scopes: unknown;
  createdBy: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

interface ClientAccessTokenAuthRow extends ClientAccessTokenRow {
  customerAccountId: string;
  clientStatus: string;
  accountStatus: string;
}

interface ClientSubscriptionCredentialRow {
  id: string;
  clientConfigId: string;
  customerAccountId: string;
  outboundId: string;
  outboundName: string | null;
  protocol: string;
  name: string | null;
  encryptedPayload: string;
  keyId: string;
  publicMetadata: Record<string, unknown>;
  status: string;
  createdBy: string | null;
  lastUsedAt: Date | null;
  lastRotatedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ClientSubscriptionCredentialRenderResult {
  status: 'rendered' | 'blocked_secret_unavailable' | 'blocked_secret_invalid';
  uri?: string | null;
  configText?: string | null;
  missingFields: string[];
  warnings: string[];
}

interface ClientPortalRow {
  customerAccountId: string;
  accountDisplayName: string | null;
  accountStatus: string;
  quotaScope: string;
  accountQuotaLimitBytes: string | number | null;
  accountUsedBytes: string | number;
  perClientLimitBytes: string | number | null;
  clientConfigId: string;
  clientLabel: string;
  protocol: string;
  deviceLimit: number | null;
  clientQuotaLimitBytes: string | number | null;
  clientUsedBytes: string | number;
  clientStatus: string;
}

interface ClientUsageEventRow {
  id: string;
  customerAccountId: string;
  clientConfigId: string;
  source: string;
  direction: string;
  usedBytesDelta: string | number;
  rawUsedBytesDelta: string | number;
  usageMultiplier: number;
  ratedOutboundId: string | null;
  ratedOutboundName: string | null;
  rxBytes: string | number | null;
  txBytes: string | number | null;
  observedAt: Date;
  windowStart: Date | null;
  windowEnd: Date | null;
  idempotencyKey: string | null;
  externalReference: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: Date;
}

interface RewardedAdSettingsRow {
  settingKey: string;
  enabled: boolean;
  rewardBytes: string | number;
  dailyLimit: number;
  provider: string;
  verificationMode: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface RewardedAdGrantRow {
  id: string;
  customerAccountId: string;
  clientConfigId: string;
  grantDay: string | Date;
  dailyGrantNumber: number;
  provider: string;
  adSessionId: string | null;
  idempotencyKey: string;
  rewardBytes: string | number;
  accountQuotaBeforeBytes: string | number | null;
  accountQuotaAfterBytes: string | number;
  clientQuotaBeforeBytes: string | number | null;
  clientQuotaAfterBytes: string | number | null;
  verificationMode: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

interface NormalizedClientUsageEventInput {
  source: string;
  direction: string;
  rawUsedBytesDelta: number;
  usedBytesDelta: number;
  usageMultiplier: number;
  ratedOutboundId: string | null;
  ratedOutboundName: string | null;
  rxBytes: number | null;
  txBytes: number | null;
  observedAt: Date;
  windowStart: Date | null;
  windowEnd: Date | null;
  idempotencyKey: string | null;
  externalReference: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
}

interface RatedOutboundRow {
  id: string;
  name: string;
  usageMultiplier: number;
}

interface ClientRouteOptionOutboundRow {
  id: string;
  name: string;
  type: string;
  routeGroup: string;
  countryCode: string | null;
  region: string | null;
  healthStatus: string;
  enabled: boolean;
  maintenanceMode: boolean;
  usageMultiplier: number;
  config: Record<string, unknown> | null;
  updatedAt: Date;
}

interface PreferredOutboundRow {
  id: string;
  name: string;
  routeGroup: string;
}

interface BillingSettingsRow {
  settingKey: string;
  currency: string;
  pricePerGb: string | number;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface VolumePackageRow {
  id: string;
  name: string;
  slug: string;
  volumeBytes: string | number;
  durationDays: number | null;
  pricePerGb: string | number;
  totalPrice: string | number;
  currency: string;
  status: string;
  sortOrder: number;
  notes: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PaymentMethodRow {
  id: string;
  name: string;
  slug: string;
  provider: string;
  checkoutMode: string;
  currency: string;
  minAmount: string | number | null;
  maxAmount: string | number | null;
  status: string;
  sortOrder: number;
  supportsAutoCapture: boolean;
  publicConfig: Record<string, unknown>;
  instructions: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PaymentOrderRow {
  id: string;
  customerAccountId: string;
  customerDisplayName: string | null;
  customerTelegramUsername: string | null;
  volumePackageId: string | null;
  paymentMethodId: string | null;
  paymentMethodName: string | null;
  paymentMethodSlug: string | null;
  packageName: string;
  packageSlug: string;
  volumeBytes: string | number;
  durationDays: number | null;
  pricePerGb: string | number;
  amount: string | number;
  currency: string;
  status: string;
  provider: string;
  providerOrderId: string | null;
  providerCaptureId: string | null;
  checkoutUrl: string | null;
  idempotencyKey: string | null;
  paidAt: Date | null;
  failedAt: Date | null;
  refundedAt: Date | null;
  expiresAt: Date | null;
  allocationStatus?: string | null;
  allocationId?: string | null;
  allocatedAt?: Date | null;
  allocatedVolumeBytes?: string | number | null;
  allocationDelaySeconds?: string | number | null;
  metadata: Record<string, unknown>;
  notes: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PaymentOrderAllocationRow {
  id: string;
  paymentOrderId: string;
  customerAccountId: string;
  allocationScope: string;
  volumeBytesDelta: string | number;
  quotaLimitBeforeBytes: string | number | null;
  quotaLimitAfterBytes: string | number;
  idempotencyKey: string | null;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: Date;
}

interface CurrentPanelVolumeChargeEventRow {
  id: string;
  customerAccountId: string;
  chargeScope: string;
  volumeBytesDelta: string | number;
  accountQuotaBeforeBytes: string | number | null;
  accountQuotaAfterBytes: string | number | null;
  clientConfigIds: unknown;
  clientQuotaChanges: unknown;
  externalPanelWriteStatus: string;
  idempotencyKey: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: Date;
}

interface CurrentPanelVolumeChargeClientQuotaChange {
  clientConfigId: string;
  quotaLimitBeforeBytes: number | null;
  quotaLimitAfterBytes: number;
}

interface CustomerAccountFilters {
  status?: string;
  search?: string;
  limit: number;
}

interface VolumePackageFilters {
  status?: string;
  limit: number;
}

interface PaymentMethodFilters {
  status?: string;
  provider?: string;
  limit: number;
}

interface PaymentOrderFilters {
  status?: string;
  customerAccountId?: string;
  paymentMethodId?: string;
  provider?: string;
  allocationStatus?: string;
  limit: number;
}

interface ClientUsageEventFilters {
  source?: string;
  limit: number;
}

interface RewardedAdGrantCreateState {
  grant: RewardedAdGrantRow;
  duplicate: boolean;
  clientConfigId: string;
  customerAccountId: string;
  provider: string;
}

@Injectable()
export class BillingService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
    private readonly paypal: PayPalPaymentService,
    private readonly rewardedAdWebhook: RewardedAdWebhookService,
    private readonly secretVault: SecretVaultService,
    private readonly telegram: TelegramAlertService,
    private readonly telegramConfig: TelegramBotConfigService,
  ) {}

  async getBillingCatalog(): Promise<AdminBillingCatalogResponse> {
    return {
      settings: await this.getBillingSettings(),
      packages: await this.listVolumePackages({ limit: 100 }),
      paymentMethods: await this.listPaymentMethods({ limit: 100 }),
      paymentProviderAdapters: this.listPaymentProviderAdapters(),
    };
  }

  listPaymentProviderAdapters(): AdminPaymentProviderAdapterSummary[] {
    return listPaymentProviderAdapters();
  }

  async getBillingSettings(): Promise<AdminBillingSettingsSummary> {
    return this.mapBillingSettings(await this.getBillingSettingsRow(this.database));
  }

  async updateBillingSettings(
    dto: UpdateBillingSettingsDto,
    actor: AuthActor | undefined,
  ): Promise<AdminBillingSettingsSummary> {
    const settings = await this.database.transaction(async (executor) => {
      const current = await this.getBillingSettingsRow(executor, true);
      const currency = dto.currency !== undefined ? this.normalizeCurrency(dto.currency) : current.currency;
      const pricePerGb = dto.pricePerGb ?? this.numberFromBigInt(current.pricePerGb) ?? 0;

      const result = await executor.query<BillingSettingsRow>(
        `
          UPDATE billing_settings
          SET currency = $1,
              price_per_gb = $2,
              updated_by = $3,
              updated_at = now()
          WHERE setting_key = 'default'
          RETURNING
            setting_key AS "settingKey",
            currency,
            price_per_gb AS "pricePerGb",
            updated_by AS "updatedBy",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        `,
        [currency, pricePerGb, actor?.id ?? null],
      );

      await this.audit.record(
        actor,
        'billing_settings.update',
        'billing_settings',
        'default',
        {
          currency,
          pricePerGb,
          changedFields: Object.keys(dto),
        },
        executor,
      );

      return result.rows[0];
    });

    return this.mapBillingSettings(settings);
  }

  async getAdminRewardedAdSettings(): Promise<AdminRewardedAdSettingsSummary> {
    return this.mapAdminRewardedAdSettings(await this.getRewardedAdSettings());
  }

  async updateRewardedAdSettings(
    dto: UpdateRewardedAdSettingsDto,
    actor: AuthActor | undefined,
  ): Promise<AdminRewardedAdSettingsSummary> {
    const settings = await this.database.transaction(async (executor) => {
      await this.ensureRewardedAdSettingsRow(executor);
      const current = await this.getRewardedAdSettings(executor, true);
      const changedFields = Object.entries(dto)
        .filter(([, value]) => value !== undefined)
        .map(([key]) => key);

      if (!changedFields.length) return current;

      const rewardBytes = dto.rewardBytes ?? this.numberFromBigInt(current.rewardBytes) ?? DEFAULT_REWARDED_AD_REWARD_BYTES;
      const dailyLimit = dto.dailyLimit ?? current.dailyLimit;
      const provider =
        dto.provider !== undefined
          ? this.normalizeRewardedAdSettingsToken(dto.provider, 'Rewarded ad provider')
          : current.provider || DEFAULT_REWARDED_AD_PROVIDER;
      const verificationMode =
        dto.verificationMode !== undefined
          ? this.normalizeRewardedAdSettingsToken(dto.verificationMode, 'Rewarded ad verification mode')
          : current.verificationMode || DEFAULT_REWARDED_AD_VERIFICATION_MODE;
      this.assertRewardedAdSettingsLimits(rewardBytes, dailyLimit);

      const result = await executor.query<RewardedAdSettingsRow>(
        `
          UPDATE rewarded_ad_settings
          SET enabled = $1,
              reward_bytes = $2,
              daily_limit = $3,
              provider = $4,
              verification_mode = $5,
              updated_by = $6,
              updated_at = now()
          WHERE setting_key = 'default'
          RETURNING
            setting_key AS "settingKey",
            enabled,
            reward_bytes AS "rewardBytes",
            daily_limit AS "dailyLimit",
            provider,
            verification_mode AS "verificationMode",
            updated_by AS "updatedBy",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        `,
        [
          dto.enabled ?? current.enabled,
          rewardBytes,
          dailyLimit,
          provider,
          verificationMode,
          actor?.id ?? null,
        ],
      );

      await this.audit.record(
        actor,
        'rewarded_ad_settings.update',
        'rewarded_ad_settings',
        'default',
        {
          enabled: dto.enabled ?? current.enabled,
          rewardBytes,
          dailyLimit,
          provider,
          verificationMode,
          changedFields,
        },
        executor,
      );

      return result.rows[0];
    });

    return this.mapAdminRewardedAdSettings(settings);
  }

  async listVolumePackages(filters: VolumePackageFilters): Promise<AdminVolumePackageSummary[]> {
    const values: unknown[] = [];
    const where: string[] = [];

    if (filters.status?.trim()) {
      values.push(filters.status.trim());
      where.push(`status = $${values.length}`);
    }

    values.push(filters.limit);
    const result = await this.database.query<VolumePackageRow>(
      `
        ${this.volumePackageSelectSql()}
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY sort_order ASC, created_at DESC
        LIMIT $${values.length}
      `,
      values,
    );

    return result.rows.map((row) => this.mapVolumePackage(row));
  }

  async getVolumePackage(id: string): Promise<AdminVolumePackageSummary> {
    const result = await this.database.query<VolumePackageRow>(
      `${this.volumePackageSelectSql()} WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Volume package not found');
    return this.mapVolumePackage(row);
  }

  async createVolumePackage(
    dto: CreateVolumePackageDto,
    actor: AuthActor | undefined,
  ): Promise<AdminVolumePackageSummary> {
    try {
      const packageId = await this.database.transaction(async (executor) => {
        const settings = await this.getBillingSettingsRow(executor);
        const pricePerGb = dto.pricePerGb ?? this.numberFromBigInt(settings.pricePerGb) ?? 0;
        const currency = dto.currency !== undefined ? this.normalizeCurrency(dto.currency) : settings.currency;
        const volumeBytes = this.gbToBytes(dto.volumeGb);
        const totalPrice = dto.totalPrice ?? this.calculateTotalPrice(dto.volumeGb, pricePerGb);
        const slug = this.normalizeSlug(dto.slug ?? dto.name);
        const name = dto.name.trim();
        if (!name) throw new BadRequestException('Volume package name is required');

        const result = await executor.query<{ id: string }>(
          `
            INSERT INTO volume_packages (
              name, slug, volume_bytes, duration_days, price_per_gb,
              total_price, currency, status, sort_order, notes, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id
          `,
          [
            name,
            slug,
            volumeBytes,
            dto.durationDays ?? null,
            pricePerGb,
            totalPrice,
            currency,
            dto.status ?? 'active',
            dto.sortOrder ?? 1000,
            this.normalizeNullableString(dto.notes),
            actor?.id ?? null,
          ],
        );
        const id = result.rows[0].id;

        await this.audit.record(
          actor,
          'volume_package.create',
          'volume_package',
          id,
          {
            slug,
            volumeGb: dto.volumeGb,
            durationDays: dto.durationDays ?? null,
            pricePerGb,
            totalPrice,
            currency,
          },
          executor,
        );

        return id;
      });

      return this.getVolumePackage(packageId);
    } catch (error) {
      this.throwConflictIfUniqueViolation(error, 'Volume package slug already exists');
      throw error;
    }
  }

  async updateVolumePackage(
    id: string,
    dto: UpdateVolumePackageDto,
    actor: AuthActor | undefined,
  ): Promise<AdminVolumePackageSummary> {
    try {
      await this.database.transaction(async (executor) => {
        const existing = await this.getVolumePackageRowForUpdate(executor, id);
        const changedFields = await this.updateVolumePackageFields(executor, id, existing, dto);

        await this.audit.record(
          actor,
          'volume_package.update',
          'volume_package',
          id,
          {
            slug: existing.slug,
            changedFields,
          },
          executor,
        );
      });

      return this.getVolumePackage(id);
    } catch (error) {
      this.throwConflictIfUniqueViolation(error, 'Volume package slug already exists');
      throw error;
    }
  }

  async listPaymentMethods(filters: PaymentMethodFilters): Promise<AdminPaymentMethodSummary[]> {
    const values: unknown[] = [];
    const where: string[] = [];

    if (filters.status?.trim()) {
      values.push(filters.status.trim());
      where.push(`status = $${values.length}`);
    }

    if (filters.provider?.trim()) {
      values.push(this.normalizeProvider(filters.provider));
      where.push(`provider = $${values.length}`);
    }

    values.push(filters.limit);
    const result = await this.database.query<PaymentMethodRow>(
      `
        ${this.paymentMethodSelectSql()}
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY sort_order ASC, created_at DESC
        LIMIT $${values.length}
      `,
      values,
    );

    return result.rows.map((row) => this.mapPaymentMethod(row));
  }

  async getPaymentMethod(id: string): Promise<AdminPaymentMethodSummary> {
    const result = await this.database.query<PaymentMethodRow>(
      `${this.paymentMethodSelectSql()} WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Payment method not found');
    return this.mapPaymentMethod(row);
  }

  async createPaymentMethod(
    dto: CreatePaymentMethodDto,
    actor: AuthActor | undefined,
  ): Promise<AdminPaymentMethodSummary> {
    try {
      const methodId = await this.database.transaction(async (executor) => {
        const name = dto.name.trim();
        if (!name) throw new BadRequestException('Payment method name is required');

        const provider = this.normalizeProvider(dto.provider ?? 'manual');
        const checkoutMode = dto.checkoutMode ?? this.defaultCheckoutMode(provider);
        const currency = dto.currency !== undefined ? this.normalizeCurrency(dto.currency) : 'toman';
        const slug = this.normalizeSlug(dto.slug ?? name);
        const minAmount = dto.minAmount ?? null;
        const maxAmount = dto.maxAmount ?? null;
        this.assertAmountRange(minAmount, maxAmount);

        const result = await executor.query<{ id: string }>(
          `
            INSERT INTO payment_methods (
              name, slug, provider, checkout_mode, currency, min_amount, max_amount,
              status, sort_order, supports_auto_capture, public_config, instructions, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13)
            RETURNING id
          `,
          [
            name,
            slug,
            provider,
            checkoutMode,
            currency,
            minAmount,
            maxAmount,
            dto.status ?? 'active',
            dto.sortOrder ?? 1000,
            dto.supportsAutoCapture ?? provider === 'paypal',
            this.stringifyPublicRecord(dto.publicConfig ?? {}, 'Payment method public config'),
            this.normalizeNullableString(dto.instructions),
            actor?.id ?? null,
          ],
        );
        const id = result.rows[0].id;

        await this.audit.record(
          actor,
          'payment_method.create',
          'payment_method',
          id,
          {
            slug,
            provider,
            checkoutMode,
            currency,
            status: dto.status ?? 'active',
          },
          executor,
        );

        return id;
      });

      return this.getPaymentMethod(methodId);
    } catch (error) {
      this.throwConflictIfUniqueViolation(error, 'Payment method slug already exists');
      throw error;
    }
  }

  async updatePaymentMethod(
    id: string,
    dto: UpdatePaymentMethodDto,
    actor: AuthActor | undefined,
  ): Promise<AdminPaymentMethodSummary> {
    try {
      await this.database.transaction(async (executor) => {
        const existing = await this.getPaymentMethodRowForUpdate(executor, id);
        const changedFields = await this.updatePaymentMethodFields(executor, id, existing, dto);

        await this.audit.record(
          actor,
          'payment_method.update',
          'payment_method',
          id,
          {
            slug: existing.slug,
            provider: existing.provider,
            changedFields,
          },
          executor,
        );
      });

      return this.getPaymentMethod(id);
    } catch (error) {
      this.throwConflictIfUniqueViolation(error, 'Payment method slug already exists');
      throw error;
    }
  }

  async listPaymentOrders(filters: PaymentOrderFilters): Promise<AdminPaymentOrderSummary[]> {
    const values: unknown[] = [];
    const where: string[] = [];

    if (filters.status?.trim()) {
      values.push(filters.status.trim());
      where.push(`po.status = $${values.length}`);
    }

    if (filters.customerAccountId?.trim()) {
      values.push(filters.customerAccountId.trim());
      where.push(`po.customer_account_id = $${values.length}`);
    }

    if (filters.paymentMethodId?.trim()) {
      values.push(filters.paymentMethodId.trim());
      where.push(`po.payment_method_id = $${values.length}`);
    }

    if (filters.provider?.trim()) {
      values.push(this.normalizeProvider(filters.provider));
      where.push(`po.provider = $${values.length}`);
    }

    if (filters.allocationStatus?.trim()) {
      where.push(this.paymentOrderAllocationStatusWhere(filters.allocationStatus));
    }

    values.push(filters.limit);
    const result = await this.database.query<PaymentOrderRow>(
      `
        ${this.paymentOrderSelectSql()}
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY po.created_at DESC
        LIMIT $${values.length}
      `,
      values,
    );

    return result.rows.map((row) => this.mapPaymentOrder(row));
  }

  async getPaymentOrder(id: string): Promise<AdminPaymentOrderSummary> {
    const result = await this.database.query<PaymentOrderRow>(
      `${this.paymentOrderSelectSql()} WHERE po.id = $1`,
      [id],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Payment order not found');
    return this.mapPaymentOrder(row);
  }

  async createPaymentOrder(
    dto: CreatePaymentOrderDto,
    actor: AuthActor | undefined,
  ): Promise<AdminPaymentOrderSummary> {
    try {
      const orderId = await this.database.transaction(async (executor) => {
        await this.ensureCustomerAccountExists(executor, dto.customerAccountId);
        const volumePackage = await this.getVolumePackageRowForUpdate(executor, dto.volumePackageId);
        const paymentMethod = await this.getPaymentMethodRowForUpdate(executor, dto.paymentMethodId);

        if (volumePackage.status !== 'active') throw new BadRequestException('Volume package is not active');
        this.assertPaymentMethodAccepts(paymentMethod, volumePackage.currency, this.numberFromBigInt(volumePackage.totalPrice) ?? 0);

        const providerOrderId = this.normalizeNullableString(dto.providerOrderId);
        const checkoutUrl = this.normalizeNullableString(dto.checkoutUrl);
        const idempotencyKey = this.normalizeNullableString(dto.idempotencyKey);
        const expiresAt = this.parseOptionalDate(dto.expiresAt, 'expiresAt');
        const metadata = dto.metadata ?? {};
        const amount = this.numberFromBigInt(volumePackage.totalPrice) ?? 0;
        const volumeBytes = this.numberFromBigInt(volumePackage.volumeBytes) ?? 0;
        const pricePerGb = this.numberFromBigInt(volumePackage.pricePerGb) ?? 0;

        const result = await executor.query<{ id: string }>(
          `
            INSERT INTO payment_orders (
              customer_account_id, volume_package_id, payment_method_id,
              package_name, package_slug, volume_bytes, duration_days, price_per_gb,
              amount, currency, status, provider, provider_order_id, checkout_url,
              idempotency_key, expires_at, metadata, notes, created_by
            )
            VALUES (
              $1, $2, $3,
              $4, $5, $6, $7, $8,
              $9, $10, 'pending', $11, $12, $13,
              $14, $15, $16::jsonb, $17, $18
            )
            RETURNING id
          `,
          [
            dto.customerAccountId,
            volumePackage.id,
            paymentMethod.id,
            volumePackage.name,
            volumePackage.slug,
            volumeBytes,
            volumePackage.durationDays,
            pricePerGb,
            amount,
            volumePackage.currency,
            paymentMethod.provider,
            providerOrderId,
            checkoutUrl,
            idempotencyKey,
            expiresAt,
            this.stringifyPublicRecord(metadata, 'Payment order metadata'),
            this.normalizeNullableString(dto.notes),
            actor?.id ?? null,
          ],
        );
        const id = result.rows[0].id;

        await this.audit.record(
          actor,
          'payment_order.create',
          'payment_order',
          id,
          {
            customerAccountId: dto.customerAccountId,
            volumePackageId: volumePackage.id,
            paymentMethodId: paymentMethod.id,
            provider: paymentMethod.provider,
            status: 'pending',
            amount,
            currency: volumePackage.currency,
            idempotencyKey,
          },
          executor,
        );

        return id;
      });

      return this.getPaymentOrder(orderId);
    } catch (error) {
      this.throwConflictIfUniqueViolation(error, 'Payment order idempotency or provider order already exists');
      throw error;
    }
  }

  async allocatePaymentOrder(
    id: string,
    dto: AllocatePaymentOrderDto,
    actor: AuthActor | undefined,
  ): Promise<AdminAllocatePaymentOrderResponse> {
    try {
      const allocationState = await this.database.transaction(async (executor) => {
        const paymentOrder = await this.getPaymentOrderRowForUpdate(executor, id);
        if (paymentOrder.status !== 'paid') {
          throw new BadRequestException('Only paid payment orders can be allocated to quota');
        }

        const existingForOrder = await this.getPaymentOrderAllocationByOrderIdForUpdate(executor, id);
        if (existingForOrder) {
          return {
            allocation: existingForOrder,
            customerAccountId: existingForOrder.customerAccountId,
            duplicate: true,
          };
        }

        const idempotencyKey = this.normalizeNullableString(dto.idempotencyKey) ?? `payment_order:${id}`;
        const existingForKey = await this.getPaymentOrderAllocationByIdempotencyForUpdate(executor, idempotencyKey);
        if (existingForKey) {
          if (existingForKey.paymentOrderId !== id) {
            throw new ConflictException('Payment order allocation idempotency key already belongs to another order');
          }

          return {
            allocation: existingForKey,
            customerAccountId: existingForKey.customerAccountId,
            duplicate: true,
          };
        }

        const account = await this.getCustomerAccountRowForUpdate(executor, paymentOrder.customerAccountId);
        const volumeBytes = this.numberFromBigInt(paymentOrder.volumeBytes) ?? 0;
        if (volumeBytes <= 0) throw new BadRequestException('Payment order volume must be positive before allocation');

        const quotaLimitBeforeBytes = this.numberFromBigInt(account.quotaLimitBytes);
        const usedBytes = this.numberFromBigInt(account.usedBytes) ?? 0;
        const quotaLimitAfterBytes = (quotaLimitBeforeBytes ?? usedBytes) + volumeBytes;
        if (!Number.isSafeInteger(quotaLimitAfterBytes) || quotaLimitAfterBytes > MAX_SAFE_BYTES) {
          throw new BadRequestException('Allocated quota would exceed the safe byte limit');
        }

        const allocation = await this.insertPaymentOrderAllocation(
          executor,
          paymentOrder,
          {
            idempotencyKey,
            volumeBytes,
            quotaLimitBeforeBytes,
            quotaLimitAfterBytes,
            metadata: dto.metadata ?? {},
          },
          actor,
        );

        await executor.query(
          `
            UPDATE customer_accounts
            SET quota_limit_bytes = $1,
                updated_at = now()
            WHERE id = $2
          `,
          [quotaLimitAfterBytes, paymentOrder.customerAccountId],
        );

        await this.audit.record(
          actor,
          'payment_order.allocate_quota',
          'payment_order',
          id,
          {
            customerAccountId: paymentOrder.customerAccountId,
            allocationId: allocation.id,
            volumeBytesDelta: volumeBytes,
            quotaLimitBeforeBytes,
            quotaLimitAfterBytes,
            provider: paymentOrder.provider,
          },
          executor,
        );

        return {
          allocation,
          customerAccountId: paymentOrder.customerAccountId,
          duplicate: false,
        };
      });

      const [paymentOrder, accountDetail] = await Promise.all([
        this.getPaymentOrder(id),
        this.getCustomerAccount(allocationState.customerAccountId),
      ]);
      const { clientConfigs: _clientConfigs, ...account } = accountDetail;
      const allocation = this.mapPaymentOrderAllocation(allocationState.allocation);
      const telegramFulfillment = await this.fulfillTelegramPurchaseAfterAllocation(
        paymentOrder,
        accountDetail,
        allocation,
        allocationState.duplicate,
        actor,
      );

      return {
        allocation,
        paymentOrder,
        account,
        duplicate: allocationState.duplicate,
        telegramFulfillment,
      };
    } catch (error) {
      this.throwConflictIfUniqueViolation(error, 'Payment order allocation already exists');
      throw error;
    }
  }

  async createPaymentProviderCheckout(
    id: string,
    dto: CreatePaymentProviderCheckoutDto,
    actor: AuthActor | undefined,
  ): Promise<AdminPaymentProviderCheckoutResponse> {
    try {
      const prepared = await this.database.transaction(async (executor) => {
        const existing = await this.getPaymentOrderRowForUpdate(executor, id);
        if (existing.status !== 'pending') {
          throw new BadRequestException('Provider checkout can only be prepared for pending payment orders');
        }
        if (!existing.paymentMethodId) {
          throw new BadRequestException('Payment order no longer has a payment method');
        }

        const method = await this.getPaymentMethodRowForUpdate(executor, existing.paymentMethodId);
        const providerCheckout = prepareAdditionalPaymentProviderCheckout({
          order: {
            id: existing.id,
            packageName: existing.packageName,
            packageSlug: existing.packageSlug,
            amount: this.numberFromBigInt(existing.amount) ?? 0,
            currency: existing.currency,
            provider: existing.provider,
            providerOrderId: existing.providerOrderId,
          },
          method: {
            id: method.id,
            name: method.name,
            slug: method.slug,
            provider: method.provider,
            checkoutMode: method.checkoutMode,
            publicConfig: method.publicConfig ?? {},
            instructions: method.instructions,
          },
          returnUrl: dto.returnUrl,
          cancelUrl: dto.cancelUrl,
          idempotencyKey: dto.idempotencyKey,
        });
        const metadata = this.mergePaymentProviderAdapterMetadata(existing.metadata, providerCheckout);

        await executor.query(
          `
            UPDATE payment_orders
            SET provider_order_id = $1,
                checkout_url = $2,
                metadata = $3::jsonb,
                updated_at = now()
            WHERE id = $4
          `,
          [
            providerCheckout.paymentReference,
            providerCheckout.checkoutUrl,
            this.stringifyPublicRecord(metadata, 'Payment order metadata'),
            id,
          ],
        );

        await this.audit.record(
          actor,
          'payment_order.provider_checkout_prepare',
          'payment_order',
          id,
          {
            provider: providerCheckout.provider,
            paymentReference: providerCheckout.paymentReference,
            adapterStatus: providerCheckout.adapterStatus,
            settlementMode: providerCheckout.settlementMode,
            hostedCheckout: Boolean(providerCheckout.checkoutUrl),
          },
          executor,
        );

        return providerCheckout;
      });

      return {
        paymentOrder: await this.getPaymentOrder(id),
        provider: prepared.provider,
        paymentReference: prepared.paymentReference,
        checkoutUrl: prepared.checkoutUrl,
        instructions: prepared.instructions,
        adapterStatus: prepared.adapterStatus,
        action: 'provider_checkout_prepared',
      };
    } catch (error) {
      this.throwConflictIfUniqueViolation(error, 'Payment order provider order already exists');
      throw error;
    }
  }

  async createPayPalCheckout(
    id: string,
    dto: CreatePayPalCheckoutDto,
    actor: AuthActor | undefined,
  ): Promise<AdminPayPalPaymentOrderResponse> {
    try {
      let action = 'checkout_created';

      await this.database.transaction(async (executor) => {
        const existing = await this.getPaymentOrderRowForUpdate(executor, id);
        this.assertPayPalPaymentOrder(existing);
        if (existing.status !== 'pending') {
          throw new BadRequestException('PayPal checkout can only be created for pending payment orders');
        }

        if (existing.providerOrderId) {
          if (!existing.checkoutUrl) {
            throw new BadRequestException('Payment order already has a PayPal provider order without a checkout URL');
          }
          action = 'checkout_already_exists';
          return;
        }

        const checkout = await this.paypal.createCheckout({
          paymentOrderId: id,
          packageName: existing.packageName,
          amount: this.numberFromBigInt(existing.amount) ?? 0,
          currency: existing.currency,
          returnUrl: dto.returnUrl,
          cancelUrl: dto.cancelUrl,
          idempotencyKey: dto.idempotencyKey ?? existing.idempotencyKey,
        });
        const metadata = this.mergePayPalMetadata(existing.metadata, {
          providerOrderStatus: checkout.providerStatus,
          checkoutCreatedAt: new Date().toISOString(),
        });

        await executor.query(
          `
            UPDATE payment_orders
            SET provider_order_id = $1,
                checkout_url = $2,
                metadata = $3::jsonb,
                updated_at = now()
            WHERE id = $4
          `,
          [
            checkout.providerOrderId,
            checkout.checkoutUrl,
            this.stringifyPublicRecord(metadata, 'Payment order metadata'),
            id,
          ],
        );

        await this.audit.record(
          actor,
          'payment_order.paypal_checkout_create',
          'payment_order',
          id,
          {
            provider: 'paypal',
            providerOrderId: checkout.providerOrderId,
            providerOrderStatus: checkout.providerStatus,
          },
          executor,
        );
      });

      const paymentOrder = await this.getPaymentOrder(id);
      return {
        paymentOrder,
        providerOrderId: paymentOrder.providerOrderId,
        checkoutUrl: paymentOrder.checkoutUrl,
        action,
      };
    } catch (error) {
      this.throwConflictIfUniqueViolation(error, 'Payment order provider order already exists');
      throw error;
    }
  }

  async capturePayPalPaymentOrder(
    id: string,
    dto: CapturePayPalPaymentOrderDto,
    actor: AuthActor | undefined,
  ): Promise<AdminPayPalPaymentOrderResponse> {
    try {
      let action = 'captured';

      await this.database.transaction(async (executor) => {
        const existing = await this.getPaymentOrderRowForUpdate(executor, id);
        this.assertPayPalPaymentOrder(existing);

        if (existing.status === 'paid') {
          action = 'already_paid';
          return;
        }
        if (existing.status !== 'pending') {
          throw new BadRequestException('PayPal capture can only be run for pending payment orders');
        }

        const providerOrderId = this.normalizeNullableString(dto.providerOrderId) ?? existing.providerOrderId;
        if (!providerOrderId) throw new BadRequestException('PayPal provider order id is required before capture');
        if (existing.providerOrderId && existing.providerOrderId !== providerOrderId) {
          throw new BadRequestException('PayPal provider order id does not match the payment order');
        }

        const capture = await this.paypal.captureOrder({
          paymentOrderId: id,
          providerOrderId,
          idempotencyKey: dto.idempotencyKey ?? existing.idempotencyKey,
        });
        const now = new Date();
        const metadata = this.mergePayPalMetadata(existing.metadata, {
          providerOrderStatus: capture.providerStatus,
          providerCaptureStatus: capture.providerCaptureStatus,
          capturedAt: now.toISOString(),
        });

        await executor.query(
          `
            UPDATE payment_orders
            SET status = 'paid',
                provider_order_id = $1,
                provider_capture_id = $2,
                paid_at = $3,
                metadata = $4::jsonb,
                updated_at = now()
            WHERE id = $5
          `,
          [
            capture.providerOrderId,
            capture.providerCaptureId,
            now,
            this.stringifyPublicRecord(metadata, 'Payment order metadata'),
            id,
          ],
        );

        await this.audit.record(
          actor,
          'payment_order.paypal_capture',
          'payment_order',
          id,
          {
            provider: 'paypal',
            fromStatus: existing.status,
            toStatus: 'paid',
            providerOrderId: capture.providerOrderId,
            providerCaptureId: capture.providerCaptureId,
          },
          executor,
        );
      });

      const paymentOrder = await this.getPaymentOrder(id);
      return {
        paymentOrder,
        providerOrderId: paymentOrder.providerOrderId,
        providerCaptureId: paymentOrder.providerCaptureId,
        checkoutUrl: paymentOrder.checkoutUrl,
        action,
      };
    } catch (error) {
      this.throwConflictIfUniqueViolation(error, 'Payment order provider order already exists');
      throw error;
    }
  }

  async handlePayPalWebhook(
    headers: PayPalWebhookSignatureHeaders,
    payload: Record<string, unknown>,
  ): Promise<PayPalWebhookHandlerResponse> {
    const webhookPayload = this.asRecord(payload);
    if (!webhookPayload) throw new BadRequestException('PayPal webhook body must be an object');

    const verified = await this.paypal.verifyWebhook(headers, webhookPayload);
    const eventType = verified.eventType;
    const resource = this.asRecord(webhookPayload.resource);
    const providerOrderId = this.extractPayPalWebhookOrderId(eventType, resource);
    const providerCaptureId = this.extractPayPalWebhookCaptureId(eventType, resource);
    const providerResourceStatus = this.stringFromRecord(resource, 'status');

    if (!providerOrderId) {
      await this.audit.record(undefined, 'payment_order.paypal_webhook_ignored', 'payment_order', null, {
        eventId: verified.eventId,
        eventType,
        reason: 'missing_provider_order_id',
      });
      return {
        ok: true,
        action: 'ignored',
        eventId: verified.eventId,
        eventType,
      };
    }

    const result = await this.database.transaction(async (executor): Promise<PayPalWebhookHandlerResponse> => {
      const existing = await this.getPaymentOrderRowForUpdateByProviderOrderId(executor, 'paypal', providerOrderId);
      if (!existing) {
        await this.audit.record(undefined, 'payment_order.paypal_webhook_unmatched', 'payment_order', null, {
          eventId: verified.eventId,
          eventType,
          providerOrderId,
          providerCaptureId,
        });

        return {
          ok: true,
          action: 'unmatched',
          eventId: verified.eventId,
          eventType,
          providerOrderId,
          providerCaptureId,
        };
      }

      const now = new Date();
      const paymentUpdate = this.payPalWebhookPaymentUpdate(existing, eventType);
      const nextProviderCaptureId = providerCaptureId ?? existing.providerCaptureId;
      const metadata = this.mergePayPalMetadata(existing.metadata, {
        lastWebhookEventId: verified.eventId,
        lastWebhookEventType: eventType,
        lastWebhookReceivedAt: now.toISOString(),
        providerOrderStatus: eventType?.startsWith('CHECKOUT.ORDER.') ? providerResourceStatus : undefined,
        providerCaptureStatus: eventType?.startsWith('PAYMENT.CAPTURE.') ? providerResourceStatus : undefined,
      });

      const providerCaptureChanged = nextProviderCaptureId !== existing.providerCaptureId;
      if (paymentUpdate.nextStatus !== existing.status) {
        this.assertPaymentOrderStatusTransition(existing.status, paymentUpdate.nextStatus);
      }

      if (paymentUpdate.shouldUpdate || providerCaptureChanged) {
        await executor.query(
          `
            UPDATE payment_orders
            SET status = $1,
                provider_capture_id = $2,
                paid_at = $3,
                failed_at = $4,
                refunded_at = $5,
                metadata = $6::jsonb,
                updated_at = now()
            WHERE id = $7
          `,
          [
            paymentUpdate.nextStatus,
            nextProviderCaptureId,
            paymentUpdate.nextStatus === 'paid' && existing.status !== 'paid' ? now : existing.paidAt,
            paymentUpdate.nextStatus === 'failed' && existing.status !== 'failed' ? now : existing.failedAt,
            paymentUpdate.nextStatus === 'refunded' && existing.status !== 'refunded' ? now : existing.refundedAt,
            this.stringifyPublicRecord(metadata, 'Payment order metadata'),
            existing.id,
          ],
        );
      }

      await this.audit.record(
        undefined,
        'payment_order.paypal_webhook',
        'payment_order',
        existing.id,
        {
          eventId: verified.eventId,
          eventType,
          action: paymentUpdate.action,
          fromStatus: existing.status,
          toStatus: paymentUpdate.nextStatus,
          providerOrderId,
          providerCaptureId: nextProviderCaptureId,
        },
        executor,
      );

      return {
        ok: true,
        action: paymentUpdate.action,
        eventId: verified.eventId,
        eventType,
        paymentOrderId: existing.id,
        providerOrderId,
        providerCaptureId: nextProviderCaptureId,
      };
    });

    return result;
  }

  async updatePaymentOrderStatus(
    id: string,
    dto: UpdatePaymentOrderStatusDto,
    actor: AuthActor | undefined,
  ): Promise<AdminPaymentOrderSummary> {
    try {
      await this.database.transaction(async (executor) => {
        const existing = await this.getPaymentOrderRowForUpdate(executor, id);
        const status = dto.status;
        this.assertPaymentOrderStatusTransition(existing.status, status);

        const now = new Date();
        const paidAt = status === 'paid' && existing.status !== 'paid' ? now : existing.paidAt;
        const failedAt = status === 'failed' && existing.status !== 'failed' ? now : existing.failedAt;
        const refundedAt = status === 'refunded' && existing.status !== 'refunded' ? now : existing.refundedAt;
        const metadata = dto.metadata !== undefined ? dto.metadata ?? {} : existing.metadata ?? {};

        await executor.query(
          `
            UPDATE payment_orders
            SET status = $1,
                provider_order_id = $2,
                provider_capture_id = $3,
                checkout_url = $4,
                paid_at = $5,
                failed_at = $6,
                refunded_at = $7,
                metadata = $8::jsonb,
                notes = $9,
                updated_at = now()
            WHERE id = $10
          `,
          [
            status,
            dto.providerOrderId !== undefined ? this.normalizeNullableString(dto.providerOrderId) : existing.providerOrderId,
            dto.providerCaptureId !== undefined ? this.normalizeNullableString(dto.providerCaptureId) : existing.providerCaptureId,
            dto.checkoutUrl !== undefined ? this.normalizeNullableString(dto.checkoutUrl) : existing.checkoutUrl,
            paidAt,
            failedAt,
            refundedAt,
            this.stringifyPublicRecord(metadata, 'Payment order metadata'),
            dto.notes !== undefined ? this.normalizeNullableString(dto.notes) : existing.notes,
            id,
          ],
        );

        await this.audit.record(
          actor,
          'payment_order.status_update',
          'payment_order',
          id,
          {
            fromStatus: existing.status,
            toStatus: status,
            provider: existing.provider,
            providerOrderId: dto.providerOrderId !== undefined ? this.normalizeNullableString(dto.providerOrderId) : existing.providerOrderId,
          },
          executor,
        );
      });

      return this.getPaymentOrder(id);
    } catch (error) {
      this.throwConflictIfUniqueViolation(error, 'Payment order provider order already exists');
      throw error;
    }
  }

  async listCustomerAccounts(filters: CustomerAccountFilters): Promise<AdminCustomerAccountSummary[]> {
    const values: unknown[] = [];
    const where: string[] = [];

    if (filters.status?.trim()) {
      values.push(filters.status.trim());
      where.push(`ca.status = $${values.length}`);
    }

    if (filters.search?.trim()) {
      values.push(`%${filters.search.trim()}%`);
      where.push(`(
        ca.display_name ILIKE $${values.length}
        OR ca.telegram_id ILIKE $${values.length}
        OR ca.telegram_username ILIKE $${values.length}
      )`);
    }

    values.push(filters.limit);
    const result = await this.database.query<CustomerAccountRow>(
      `
        ${this.customerAccountSelectSql()}
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        GROUP BY ca.id
        ORDER BY ca.created_at DESC
        LIMIT $${values.length}
      `,
      values,
    );

    return result.rows.map((row) => this.mapCustomerAccount(row));
  }

  async previewCurrentPanelImport(
    dto: CurrentPanelImportPreviewDto,
    actor: AuthActor | undefined,
  ): Promise<AdminCurrentPanelImportPreviewResponse> {
    const preview = buildCurrentPanelImportPreview(dto as CurrentPanelImportPreviewRequest);

    await this.audit.record(actor, 'current_panel.import_preview', 'current_panel', null, {
      panelKind: preview.panelKind,
      adapterVersion: preview.adapterVersion,
      candidateCount: preview.candidateCount,
      rejectedRowCount: preview.rejectedRows.length,
      warningCount: preview.warnings.length,
      hasSourceName: Boolean(preview.sourceName),
    });

    return preview;
  }

  async importCurrentPanelConfigs(
    dto: CurrentPanelImportConfigsDto,
    actor: AuthActor | undefined,
  ): Promise<AdminCurrentPanelImportConfigsResponse> {
    const preview = buildCurrentPanelImportPreview(dto as CurrentPanelImportConfigsRequest);
    const importState = await this.database.transaction(async (executor) => {
      await this.lockCustomerAccount(executor, dto.customerAccountId);

      const importedConfigIds: string[] = [];
      const skippedCandidates: CurrentPanelImportSkippedCandidate[] = [];
      let baselineUsageEventCount = 0;
      let baselineUsedBytes = 0;
      const importObservedAt = new Date(preview.generatedAt);

      for (const candidate of preview.candidates) {
        const skipReasonCodes = await this.currentPanelImportSkipReasonCodes(executor, dto.customerAccountId, candidate);
        if (skipReasonCodes.length > 0) {
          skippedCandidates.push(this.mapSkippedCurrentPanelCandidate(candidate, skipReasonCodes));
          continue;
        }

        const usedBytes = this.normalizeOptionalUsageBytes(candidate.usedBytes ?? null, 'usedBytes') ?? 0;
        const result = await executor.query<{ id: string }>(
          `
            INSERT INTO client_configs (
              customer_account_id, label, protocol, external_panel,
              external_panel_user_id, external_panel_config_id, device_limit,
              quota_limit_bytes, used_bytes, status, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, NULL)
            ON CONFLICT (external_panel, external_panel_config_id)
              WHERE external_panel IS NOT NULL
                AND external_panel <> ''
                AND external_panel_config_id IS NOT NULL
                AND external_panel_config_id <> ''
              DO NOTHING
            RETURNING id
          `,
          [
            dto.customerAccountId,
            candidate.label.trim(),
            this.normalizeProtocol(candidate.protocol),
            this.normalizeNullableString(candidate.externalPanel),
            this.normalizeNullableString(candidate.externalPanelUserId),
            this.normalizeNullableString(candidate.externalPanelConfigId),
            candidate.deviceLimit ?? null,
            candidate.quotaBytes ?? null,
            candidate.status,
          ],
        );
        const clientId = result.rows[0]?.id;
        if (!clientId) {
          skippedCandidates.push(this.mapSkippedCurrentPanelCandidate(candidate, ['duplicate_external_config']));
          continue;
        }

        importedConfigIds.push(clientId);

        if (usedBytes > 0) {
          const client = await this.getClientConfigRowForUpdate(executor, clientId);
          const usageEvent = await this.recordPanelSyncUsageDelta(
            executor,
            client,
            {
              adapterVersion: preview.adapterVersion,
              deltaBytes: usedBytes,
              externalReference: candidate.externalPanelConfigId ?? candidate.externalPanelUserId ?? null,
              idempotencyKey: this.currentPanelImportUsageIdempotencyKey(preview.panelKind, candidate, clientId),
              metadata: {
                baselineImport: true,
                currentPanelFlow: 'config_import',
              },
              observedAt: importObservedAt,
              panelKind: preview.panelKind,
            },
            actor,
          );

          if (usageEvent) {
            baselineUsageEventCount += 1;
            baselineUsedBytes += usedBytes;
          }
        }
      }

      await this.audit.record(
        actor,
        'current_panel.import_configs',
        'customer_account',
        dto.customerAccountId,
        {
          adapterVersion: preview.adapterVersion,
          baselineUsageEventCount,
          baselineUsedBytes,
          candidateCount: preview.candidateCount,
          hasSourceName: Boolean(preview.sourceName),
          importedCount: importedConfigIds.length,
          panelKind: preview.panelKind,
          skippedCount: skippedCandidates.length,
        },
        executor,
      );

      return {
        baselineUsageEventCount,
        baselineUsedBytes,
        importedConfigIds,
        skippedCandidates,
      };
    });

    const importedConfigs = await Promise.all(importState.importedConfigIds.map((id) => this.getClientConfig(id)));
    const warnings = new Set(preview.warnings.filter((warning) => warning !== 'read_only_preview_no_changes_applied'));
    warnings.add('controlled_import_applied_to_client_configs');
    if (importState.baselineUsageEventCount > 0) warnings.add('baseline_usage_events_recorded');
    if (importState.skippedCandidates.length > 0) warnings.add('skipped_candidates_present');

    return {
      adapterVersion: preview.adapterVersion,
      baselineUsageEventCount: importState.baselineUsageEventCount,
      baselineUsedBytes: importState.baselineUsedBytes,
      candidateCount: preview.candidateCount,
      customerAccountId: dto.customerAccountId,
      generatedAt: preview.generatedAt,
      importedConfigs,
      importedCount: importedConfigs.length,
      panelKind: preview.panelKind,
      skippedCandidates: importState.skippedCandidates,
      skippedCount: importState.skippedCandidates.length,
      warnings: Array.from(warnings).sort(),
    };
  }

  async syncCurrentPanelUsage(
    dto: CurrentPanelUsageSyncDto,
    actor: AuthActor | undefined,
  ): Promise<AdminCurrentPanelUsageSyncResponse> {
    const preview = buildCurrentPanelImportPreview(dto as CurrentPanelUsageSyncRequest);
    const syncState = await this.database.transaction(async (executor) => {
      await this.lockCustomerAccount(executor, dto.customerAccountId);

      const updatedConfigIds: string[] = [];
      const skippedCandidates: CurrentPanelImportSkippedCandidate[] = [];
      let matchedCount = 0;
      let syncedUsedBytesDelta = 0;
      let usageEventCount = 0;
      const syncObservedAt = new Date(preview.generatedAt);

      for (const candidate of preview.candidates) {
        const panelUsedBytes = this.normalizeOptionalUsageBytes(candidate.usedBytes ?? null, 'usedBytes');
        if (panelUsedBytes === null) {
          skippedCandidates.push(this.mapSkippedCurrentPanelCandidate(candidate, ['missing_used_bytes']));
          continue;
        }

        const match = await this.getCurrentPanelUsageSyncClientForUpdate(executor, dto.customerAccountId, candidate);
        if (match.reasonCodes.length > 0 || !match.client) {
          skippedCandidates.push(this.mapSkippedCurrentPanelCandidate(candidate, match.reasonCodes.length > 0 ? match.reasonCodes : ['missing_existing_config']));
          continue;
        }

        matchedCount += 1;
        const currentUsedBytes = this.numberFromBigInt(match.client.usedBytes) ?? 0;
        if (panelUsedBytes <= currentUsedBytes) {
          skippedCandidates.push(this.mapSkippedCurrentPanelCandidate(candidate, ['panel_usage_not_ahead']));
          continue;
        }

        const deltaBytes = panelUsedBytes - currentUsedBytes;
        if (!Number.isSafeInteger(deltaBytes) || deltaBytes <= 0 || deltaBytes > MAX_SAFE_BYTES) {
          skippedCandidates.push(this.mapSkippedCurrentPanelCandidate(candidate, ['invalid_usage_delta']));
          continue;
        }

        const usageEvent = await this.recordPanelSyncUsageDelta(
          executor,
          match.client,
          {
            adapterVersion: preview.adapterVersion,
            deltaBytes,
            externalReference: candidate.externalPanelConfigId ?? candidate.externalPanelUserId ?? null,
            idempotencyKey: this.currentPanelUsageSyncIdempotencyKey(preview.panelKind, candidate, panelUsedBytes, match.client.id),
            metadata: {
              currentPanelFlow: 'usage_sync',
              panelObservedUsedBytes: panelUsedBytes,
              previousUsedBytes: currentUsedBytes,
              usageSync: true,
            },
            observedAt: syncObservedAt,
            panelKind: preview.panelKind,
          },
          actor,
        );

        if (!usageEvent) {
          skippedCandidates.push(this.mapSkippedCurrentPanelCandidate(candidate, ['duplicate_usage_sync']));
          continue;
        }

        updatedConfigIds.push(match.client.id);
        syncedUsedBytesDelta += deltaBytes;
        usageEventCount += 1;
      }

      await this.audit.record(
        actor,
        'current_panel.sync_usage',
        'customer_account',
        dto.customerAccountId,
        {
          adapterVersion: preview.adapterVersion,
          candidateCount: preview.candidateCount,
          hasSourceName: Boolean(preview.sourceName),
          matchedCount,
          panelKind: preview.panelKind,
          skippedCount: skippedCandidates.length,
          syncedCount: updatedConfigIds.length,
          syncedUsedBytesDelta,
          usageEventCount,
        },
        executor,
      );

      return {
        matchedCount,
        skippedCandidates,
        syncedUsedBytesDelta,
        updatedConfigIds,
        usageEventCount,
      };
    });

    const uniqueUpdatedConfigIds = Array.from(new Set(syncState.updatedConfigIds));
    const updatedConfigs = await Promise.all(uniqueUpdatedConfigIds.map((id) => this.getClientConfig(id)));
    const warnings = new Set(preview.warnings.filter((warning) => warning !== 'read_only_preview_no_changes_applied'));
    warnings.add('controlled_usage_sync_applied_to_client_configs');
    if (syncState.usageEventCount > 0) warnings.add('usage_sync_events_recorded');
    if (syncState.skippedCandidates.length > 0) warnings.add('skipped_candidates_present');

    return {
      adapterVersion: preview.adapterVersion,
      candidateCount: preview.candidateCount,
      customerAccountId: dto.customerAccountId,
      generatedAt: preview.generatedAt,
      matchedCount: syncState.matchedCount,
      panelKind: preview.panelKind,
      skippedCandidates: syncState.skippedCandidates,
      skippedCount: syncState.skippedCandidates.length,
      syncedCount: updatedConfigs.length,
      syncedUsedBytesDelta: syncState.syncedUsedBytesDelta,
      updatedConfigs,
      usageEventCount: syncState.usageEventCount,
      warnings: Array.from(warnings).sort(),
    };
  }

  async chargeCurrentPanelVolume(
    dto: CurrentPanelVolumeChargeDto,
    actor: AuthActor | undefined,
  ): Promise<AdminCurrentPanelVolumeChargeResponse> {
    try {
      const scope = this.normalizeCurrentPanelVolumeChargeScope(dto.scope);
      const volumeBytes = this.normalizePositiveByteDelta(dto.volumeBytesDelta, 'volumeBytesDelta');
      const clientConfigIds = this.normalizeCurrentPanelChargeClientIds(dto.clientConfigIds ?? []);
      const shouldChargeAccount = scope === 'account_quota' || scope === 'account_and_selected_clients';
      const shouldChargeClients = scope === 'selected_clients' || scope === 'account_and_selected_clients';
      const idempotencyKey = this.normalizeNullableString(dto.idempotencyKey);

      if (scope === 'account_quota' && clientConfigIds.length > 0) {
        throw new BadRequestException('Client config ids require a selected-client charge scope');
      }
      if (shouldChargeClients && clientConfigIds.length === 0) {
        throw new BadRequestException('Selected-client volume charge requires at least one client config id');
      }

      const chargeState = await this.database.transaction(async (executor) => {
        if (idempotencyKey) {
          const existingForKey = await this.getCurrentPanelVolumeChargeByIdempotencyForUpdate(executor, idempotencyKey);
          if (existingForKey) {
            this.assertCurrentPanelVolumeChargeDuplicateMatches(existingForKey, {
              customerAccountId: dto.customerAccountId,
              scope,
              volumeBytes,
              clientConfigIds,
            });

            return {
              chargeEvent: existingForKey,
              duplicate: true,
            };
          }
        }

        const account = await this.getCustomerAccountRowForUpdate(executor, dto.customerAccountId);
        const accountQuotaBeforeBytes = shouldChargeAccount ? this.numberFromBigInt(account.quotaLimitBytes) : null;
        const accountUsedBytes = this.numberFromBigInt(account.usedBytes) ?? 0;
        const accountQuotaAfterBytes = shouldChargeAccount
          ? this.addPositiveBytes(accountQuotaBeforeBytes ?? accountUsedBytes, volumeBytes, 'Charged account quota would exceed the safe byte limit')
          : null;
        const clientQuotaChanges: CurrentPanelVolumeChargeClientQuotaChange[] = [];

        if (shouldChargeClients) {
          const perClientLimitBytes = this.numberFromBigInt(account.perClientLimitBytes);

          for (const clientConfigId of clientConfigIds) {
            const client = await this.getClientConfigRowForUpdate(executor, clientConfigId);
            if (client.customerAccountId !== dto.customerAccountId) {
              throw new BadRequestException('Client config must belong to the selected customer account');
            }

            const clientQuotaBeforeBytes = this.numberFromBigInt(client.quotaLimitBytes);
            const clientUsedBytes = this.numberFromBigInt(client.usedBytes) ?? 0;
            const clientQuotaAfterBytes = this.addPositiveBytes(
              clientQuotaBeforeBytes ?? perClientLimitBytes ?? clientUsedBytes,
              volumeBytes,
              'Charged client quota would exceed the safe byte limit',
            );

            await executor.query(
              `
                UPDATE client_configs
                SET quota_limit_bytes = $1,
                    updated_at = now()
                WHERE id = $2
              `,
              [clientQuotaAfterBytes, clientConfigId],
            );

            clientQuotaChanges.push({
              clientConfigId,
              quotaLimitBeforeBytes: clientQuotaBeforeBytes,
              quotaLimitAfterBytes: clientQuotaAfterBytes,
            });
          }
        }

        if (accountQuotaAfterBytes !== null) {
          await executor.query(
            `
              UPDATE customer_accounts
              SET quota_limit_bytes = $1,
                  updated_at = now()
              WHERE id = $2
            `,
            [accountQuotaAfterBytes, dto.customerAccountId],
          );
        }

        const chargeEvent = await this.insertCurrentPanelVolumeChargeEvent(
          executor,
          {
            accountQuotaBeforeBytes,
            accountQuotaAfterBytes,
            chargeScope: scope,
            clientConfigIds,
            clientQuotaChanges,
            customerAccountId: dto.customerAccountId,
            idempotencyKey,
            metadata: dto.metadata ?? {},
            notes: this.normalizeNullableString(dto.notes),
            volumeBytes,
          },
          actor,
        );

        await this.audit.record(
          actor,
          'current_panel.charge_volume',
          'customer_account',
          dto.customerAccountId,
          {
            chargeEventId: chargeEvent.id,
            clientConfigCount: clientConfigIds.length,
            externalPanelWriteAttempted: false,
            externalPanelWriteStatus: chargeEvent.externalPanelWriteStatus,
            scope,
            volumeBytesDelta: volumeBytes,
          },
          executor,
        );

        return {
          chargeEvent,
          duplicate: false,
        };
      });

      const chargeEvent = this.mapCurrentPanelVolumeChargeEvent(chargeState.chargeEvent);
      const [accountDetail, updatedClients] = await Promise.all([
        this.getCustomerAccount(chargeEvent.customerAccountId),
        Promise.all(chargeEvent.clientConfigIds.map((id) => this.getClientConfig(id))),
      ]);
      const { clientConfigs: _clientConfigs, ...account } = accountDetail;
      const warnings = new Set<string>([
        'external_panel_write_not_executed',
        'local_quota_charge_recorded',
      ]);
      if (chargeState.duplicate) warnings.add('idempotent_duplicate_returned');
      if (chargeEvent.clientConfigIds.length > 0) warnings.add('selected_client_quota_updated');

      return {
        account,
        chargeEvent,
        duplicate: chargeState.duplicate,
        externalPanelWrite: {
          attempted: false,
          status: chargeEvent.externalPanelWriteStatus,
          reasonCode: 'live_external_panel_write_not_enabled',
        },
        updatedClients,
        warnings: Array.from(warnings).sort(),
      };
    } catch (error) {
      this.throwConflictIfUniqueViolation(error, 'Current panel volume charge already exists');
      throw error;
    }
  }

  async getCustomerAccount(id: string): Promise<AdminCustomerAccountDetail> {
    const result = await this.database.query<CustomerAccountRow>(
      `
        ${this.customerAccountSelectSql()}
        WHERE ca.id = $1
        GROUP BY ca.id
      `,
      [id],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Customer account not found');

    const account = this.mapCustomerAccount(row);
    return {
      ...account,
      clientConfigs: await this.listClientConfigs(id, account.perClientLimitBytes ?? null),
    };
  }

  async exportCustomerClientConfigs(
    id: string,
    actor: AuthActor | undefined,
  ): Promise<AdminClientConfigsExportResponse> {
    const account = await this.getCustomerAccount(id);
    await this.audit.record(actor, 'client_configs.export', 'customer_account', id, {
      configCount: account.clientConfigs.length,
      exportFormat: 'afrogate_client_configs_export_v1',
      hasExternalPanelRefs: account.clientConfigs.some((config) => Boolean(config.externalPanel)),
      subscriptionCredentialsIncluded: false,
    });

    return {
      configCount: account.clientConfigs.length,
      configs: account.clientConfigs,
      customerAccountId: id,
      exportFormat: 'afrogate_client_configs_export_v1',
      generatedAt: new Date().toISOString(),
      warnings: [
        'sanitized_config_export_no_secrets',
        'subscription_credentials_not_included',
        'raw_panel_payload_not_included',
      ],
    };
  }

  async createCustomerAccount(
    dto: CreateCustomerAccountDto,
    actor: AuthActor | undefined,
  ): Promise<AdminCustomerAccountDetail> {
    try {
      const paidNumberHash = this.hashPaidNumberIfPresent(dto.paidNumber);
      const result = await this.database.transaction(async (executor) => {
        const insertResult = await executor.query<{ id: string }>(
          `
            INSERT INTO customer_accounts (
              display_name, telegram_id, telegram_username, paid_number_hash,
              status, quota_scope, quota_limit_bytes, per_client_limit_bytes,
              used_bytes, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
          `,
          [
            this.normalizeNullableString(dto.displayName),
            this.normalizeNullableString(dto.telegramId),
            this.normalizeTelegramUsername(dto.telegramUsername),
            paidNumberHash,
            dto.status ?? 'active',
            dto.quotaScope ?? 'account_shared',
            dto.quotaLimitBytes ?? null,
            dto.perClientLimitBytes ?? null,
            dto.usedBytes ?? 0,
            this.normalizeNullableString(dto.notes),
          ],
        );
        const id = insertResult.rows[0].id;

        await this.audit.record(
          actor,
          'customer_account.create',
          'customer_account',
          id,
          {
            hasTelegramId: Boolean(this.normalizeNullableString(dto.telegramId)),
            hasPaidNumberHash: Boolean(paidNumberHash),
            quotaScope: dto.quotaScope ?? 'account_shared',
            quotaLimitBytes: dto.quotaLimitBytes ?? null,
            perClientLimitBytes: dto.perClientLimitBytes ?? null,
          },
          executor,
        );

        return id;
      });

      return this.getCustomerAccount(result);
    } catch (error) {
      this.throwConflictIfUniqueViolation(error, 'Customer account identity already exists');
      throw error;
    }
  }

  async updateCustomerAccount(
    id: string,
    dto: UpdateCustomerAccountDto,
    actor: AuthActor | undefined,
  ): Promise<AdminCustomerAccountDetail> {
    if (dto.clearPaidNumber && this.normalizeNullableString(dto.paidNumber)) {
      throw new BadRequestException('Use either paidNumber or clearPaidNumber, not both');
    }

    try {
      await this.database.transaction(async (executor) => {
        await this.ensureCustomerAccountExists(executor, id);
        const changedFields = await this.updateCustomerAccountFields(executor, id, dto);

        await this.audit.record(
          actor,
          'customer_account.update',
          'customer_account',
          id,
          {
            changedFields,
            paidNumberChanged: changedFields.includes('paidNumberHash'),
          },
          executor,
        );
      });

      return this.getCustomerAccount(id);
    } catch (error) {
      this.throwConflictIfUniqueViolation(error, 'Customer account identity already exists');
      throw error;
    }
  }

  async createClientConfig(
    customerAccountId: string,
    dto: CreateClientConfigDto,
    actor: AuthActor | undefined,
  ): Promise<AdminClientConfigSummary> {
    try {
      const clientId = await this.database.transaction(async (executor) => {
        await this.ensureCustomerAccountExists(executor, customerAccountId);

        const result = await executor.query<{ id: string }>(
          `
            INSERT INTO client_configs (
              customer_account_id, label, protocol, external_panel,
              external_panel_user_id, external_panel_config_id, device_limit,
              quota_limit_bytes, used_bytes, status, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id
          `,
          [
            customerAccountId,
            dto.label.trim(),
            this.normalizeProtocol(dto.protocol),
            this.normalizeNullableString(dto.externalPanel),
            this.normalizeNullableString(dto.externalPanelUserId),
            this.normalizeNullableString(dto.externalPanelConfigId),
            dto.deviceLimit ?? null,
            dto.quotaLimitBytes ?? null,
            dto.usedBytes ?? 0,
            dto.status ?? 'active',
            this.normalizeNullableString(dto.notes),
          ],
        );
        const id = result.rows[0].id;

        await this.audit.record(
          actor,
          'client_config.create',
          'client_config',
          id,
          {
            customerAccountId,
            protocol: this.normalizeProtocol(dto.protocol),
            hasExternalPanelConfigId: Boolean(this.normalizeNullableString(dto.externalPanelConfigId)),
            quotaLimitBytes: dto.quotaLimitBytes ?? null,
            deviceLimit: dto.deviceLimit ?? null,
          },
          executor,
        );

        return id;
      });

      return this.getClientConfig(clientId);
    } catch (error) {
      this.throwConflictIfUniqueViolation(error, 'Client config external identity already exists');
      throw error;
    }
  }

  async updateClientConfig(
    id: string,
    dto: UpdateClientConfigDto,
    actor: AuthActor | undefined,
  ): Promise<AdminClientConfigSummary> {
    try {
      await this.database.transaction(async (executor) => {
        const existing = await this.getClientConfigRowForUpdate(executor, id);
        const changedFields = await this.updateClientConfigFields(executor, id, dto);

        await this.audit.record(
          actor,
          'client_config.update',
          'client_config',
          id,
          {
            customerAccountId: existing.customerAccountId,
            changedFields,
          },
          executor,
        );
      });

      return this.getClientConfig(id);
    } catch (error) {
      this.throwConflictIfUniqueViolation(error, 'Client config external identity already exists');
      throw error;
    }
  }

  async listClientUsageEvents(
    clientConfigId: string,
    filters: ClientUsageEventFilters,
  ): Promise<AdminClientUsageEventSummary[]> {
    await this.getClientConfigRow(clientConfigId);
    const values: unknown[] = [clientConfigId];
    const where = ['client_config_id = $1'];

    if (filters.source?.trim()) {
      values.push(this.normalizeClientUsageSource(filters.source));
      where.push(`source = $${values.length}`);
    }

    values.push(filters.limit);
    const result = await this.database.query<ClientUsageEventRow>(
      `
        ${this.clientUsageEventSelectSql()}
        WHERE ${where.join(' AND ')}
        ORDER BY observed_at DESC, created_at DESC
        LIMIT $${values.length}
      `,
      values,
    );

    return result.rows.map((row) => this.mapClientUsageEvent(row));
  }

  async recordClientUsageEvent(
    clientConfigId: string,
    dto: CreateClientUsageEventDto,
    actor: AuthActor | undefined,
  ): Promise<AdminRecordClientUsageResponse> {
    const input = this.normalizeClientUsageEventInput(dto);
    const eventState = await this.database.transaction(async (executor) => {
      const client = await this.getClientConfigRowForUpdate(executor, clientConfigId);
      await this.lockCustomerAccount(executor, client.customerAccountId);

      if (input.idempotencyKey) {
        const existing = await this.getClientUsageEventByIdempotency(
          executor,
          input.source,
          input.idempotencyKey,
        );
        if (existing) {
          if (existing.clientConfigId !== clientConfigId) {
            throw new ConflictException('Usage event idempotency key already belongs to another client config');
          }

          return {
            row: existing,
            customerAccountId: existing.customerAccountId,
            duplicate: true,
          };
        }
      }

      const ratedInput = await this.rateClientUsageEvent(executor, input);
      const inserted = await this.insertClientUsageEvent(executor, client, ratedInput, actor);
      if (!inserted) {
        if (!ratedInput.idempotencyKey) throw new ConflictException('Usage event could not be recorded');

        const existing = await this.getClientUsageEventByIdempotency(
          executor,
          ratedInput.source,
          ratedInput.idempotencyKey,
        );
        if (!existing) throw new ConflictException('Usage event idempotency conflict could not be resolved');
        if (existing.clientConfigId !== clientConfigId) {
          throw new ConflictException('Usage event idempotency key already belongs to another client config');
        }

        return {
          row: existing,
          customerAccountId: existing.customerAccountId,
          duplicate: true,
        };
      }

      const row = inserted;

      await executor.query(
        `
          UPDATE client_configs
          SET used_bytes = used_bytes + $1,
              updated_at = now()
          WHERE id = $2
        `,
        [ratedInput.usedBytesDelta, client.id],
      );

      await executor.query(
        `
          UPDATE customer_accounts
          SET used_bytes = used_bytes + $1,
              updated_at = now()
          WHERE id = $2
        `,
        [ratedInput.usedBytesDelta, client.customerAccountId],
      );

      await this.audit.record(
        actor,
        'client_usage_event.record',
        'client_config',
        client.id,
        {
          customerAccountId: client.customerAccountId,
          usageEventId: row.id,
          source: ratedInput.source,
          direction: ratedInput.direction,
          rawUsedBytesDelta: ratedInput.rawUsedBytesDelta,
          usedBytesDelta: ratedInput.usedBytesDelta,
          usageMultiplier: ratedInput.usageMultiplier,
          ratedOutboundId: ratedInput.ratedOutboundId,
          hasIdempotencyKey: Boolean(ratedInput.idempotencyKey),
          externalReference: ratedInput.externalReference,
        },
        executor,
      );

      return {
        row,
        customerAccountId: client.customerAccountId,
        duplicate: false,
      };
    });

    const [clientConfig, accountDetail] = await Promise.all([
      this.getClientConfig(clientConfigId),
      this.getCustomerAccount(eventState.customerAccountId),
    ]);
    const { clientConfigs: _clientConfigs, ...account } = accountDetail;

    return {
      usageEvent: this.mapClientUsageEvent(eventState.row),
      clientConfig,
      account,
      duplicate: eventState.duplicate,
    };
  }

  async listClientAccessTokens(clientConfigId: string): Promise<ClientAccessTokenSummary[]> {
    await this.getClientConfigRow(clientConfigId);
    const result = await this.database.query<ClientAccessTokenRow>(
      `
        SELECT
          id,
          client_config_id AS "clientConfigId",
          name,
          scopes,
          created_by AS "createdBy",
          created_at AS "createdAt",
          last_used_at AS "lastUsedAt",
          revoked_at AS "revokedAt"
        FROM client_access_tokens
        WHERE client_config_id = $1
        ORDER BY created_at DESC
      `,
      [clientConfigId],
    );

    return result.rows.map((row) => this.mapClientAccessToken(row));
  }

  async issueClientAccessToken(
    clientConfigId: string,
    dto: IssueClientAccessTokenDto,
    actor: AuthActor | undefined,
  ): Promise<IssuedClientAccessTokenSummary> {
    const token = this.createClientAccessToken();
    const tokenHash = hashClientToken(token);
    const nameInput = this.normalizeNullableString(dto.name);

    const created = await this.database.transaction(async (executor) => {
      const client = await this.getClientConfigRowForUpdate(executor, clientConfigId);
      if (client.status === 'disabled') {
        throw new BadRequestException('Client config is disabled');
      }

      const tokenName = nameInput ?? `${client.label} mobile`;

      if (dto.revokeExistingTokens) {
        await executor.query(
          `
            UPDATE client_access_tokens
            SET revoked_at = COALESCE(revoked_at, now())
            WHERE client_config_id = $1
              AND revoked_at IS NULL
          `,
          [clientConfigId],
        );
      }

      const result = await executor.query<ClientAccessTokenRow>(
        `
          INSERT INTO client_access_tokens (client_config_id, name, token_hash, scopes, created_by)
          VALUES ($1, $2, $3, $4::jsonb, $5)
          RETURNING
            id,
            client_config_id AS "clientConfigId",
            name,
            scopes,
            created_by AS "createdBy",
            created_at AS "createdAt",
            last_used_at AS "lastUsedAt",
            revoked_at AS "revokedAt"
        `,
        [
          clientConfigId,
          tokenName,
          tokenHash,
          JSON.stringify(['client:read', 'route:write', 'reward:claim']),
          actor?.id ?? null,
        ],
      );
      const row = result.rows[0];

      await this.audit.record(
        actor,
        'client_access_token.issue',
        'client_config',
        clientConfigId,
        {
          tokenId: row.id,
          tokenName: row.name,
          revokedExistingTokens: Boolean(dto.revokeExistingTokens),
        },
        executor,
      );

      return row;
    });

    return {
      ...this.mapClientAccessToken(created),
      token,
    };
  }

  async revokeClientAccessToken(
    tokenId: string,
    actor: AuthActor | undefined,
  ): Promise<{ tokens: ClientAccessTokenSummary[] }> {
    const clientConfigId = await this.database.transaction(async (executor) => {
      const existing = await executor.query<ClientAccessTokenRow>(
        `
          SELECT
            id,
            client_config_id AS "clientConfigId",
            name,
            scopes,
            created_by AS "createdBy",
            created_at AS "createdAt",
            last_used_at AS "lastUsedAt",
            revoked_at AS "revokedAt"
          FROM client_access_tokens
          WHERE id = $1
          FOR UPDATE
        `,
        [tokenId],
      );
      const row = existing.rows[0];
      if (!row) throw new NotFoundException('Client access token not found');

      await executor.query(
        `
          UPDATE client_access_tokens
          SET revoked_at = COALESCE(revoked_at, now())
          WHERE id = $1
        `,
        [tokenId],
      );

      await this.audit.record(
        actor,
        'client_access_token.revoke',
        'client_access_token',
        tokenId,
        {
          clientConfigId: row.clientConfigId,
          tokenName: row.name,
          alreadyRevoked: Boolean(row.revokedAt),
        },
        executor,
      );

      return row.clientConfigId;
    });

    return {
      tokens: await this.listClientAccessTokens(clientConfigId),
    };
  }

  async listClientSubscriptionCredentials(
    clientConfigId: string,
  ): Promise<AdminClientSubscriptionCredentialSummary[]> {
    await this.getClientConfigRow(clientConfigId);
    const rows = await this.getClientSubscriptionCredentialRows(clientConfigId);
    return rows.map((row) => this.mapClientSubscriptionCredential(row));
  }

  async upsertClientSubscriptionCredential(
    clientConfigId: string,
    dto: UpsertClientSubscriptionCredentialDto,
    actor: AuthActor | undefined,
  ): Promise<AdminClientSubscriptionCredentialSummary> {
    const secretMaterial = this.normalizeClientSubscriptionSecretMaterial(dto.secretMaterial);
    const publicMetadata = this.normalizeClientSubscriptionPublicMetadata(dto.publicMetadata);
    const name = this.normalizeNullableString(dto.name);
    const credentialId = await this.database.transaction(async (executor) => {
      const client = await this.getClientConfigRowForUpdate(executor, clientConfigId);
      const outbound = await this.getOutboundForSubscriptionCredential(executor, dto.outboundId);
      const protocol = this.normalizeClientSubscriptionCredentialProtocol(
        dto.protocol ?? this.normalizeSubscriptionProtocol(outbound.type),
      );
      const credentialId = randomUUID();
      const encrypted = this.secretVault.encryptJson(
        secretMaterial,
        this.clientSubscriptionCredentialEncryptionContext(clientConfigId, outbound.id, protocol, credentialId),
      );
      const fingerprint = this.secretVault.fingerprint(stableStringifyRecord(secretMaterial));

      const existing = await executor.query<{ id: string }>(
        `
          SELECT id
          FROM client_subscription_credentials
          WHERE client_config_id = $1
            AND outbound_id = $2
            AND protocol = $3
            AND revoked_at IS NULL
          FOR UPDATE
        `,
        [clientConfigId, outbound.id, protocol],
      );
      const existingIds = existing.rows.map((row) => row.id);

      if (existingIds.length) {
        await executor.query(
          `
            UPDATE client_subscription_credentials
            SET status = 'revoked',
                revoked_at = COALESCE(revoked_at, now()),
                updated_at = now()
            WHERE id = ANY($1::uuid[])
          `,
          [existingIds],
        );
      }

      await executor.query(
        `
          INSERT INTO client_subscription_credentials (
            id, client_config_id, outbound_id, name, protocol,
            encrypted_payload, key_id, fingerprint, public_metadata,
            status, created_by, last_rotated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, 'active', $10, now())
        `,
        [
          credentialId,
          clientConfigId,
          outbound.id,
          name,
          protocol,
          encrypted.payload,
          encrypted.keyId,
          fingerprint,
          JSON.stringify(publicMetadata),
          actor?.id ?? null,
        ],
      );

      await this.audit.record(
        actor,
        'client_subscription_credential.store',
        'client_subscription_credential',
        credentialId,
        {
          clientConfigId,
          customerAccountId: client.customerAccountId,
          outboundId: outbound.id,
          protocol,
          name,
          replacedCredentialCount: existingIds.length,
          secretFieldCount: Object.keys(secretMaterial).length,
          publicMetadataFieldCount: Object.keys(publicMetadata).length,
        },
        executor,
      );

      return credentialId;
    });

    return this.getClientSubscriptionCredential(credentialId);
  }

  async revokeClientSubscriptionCredential(
    credentialId: string,
    actor: AuthActor | undefined,
  ): Promise<AdminClientSubscriptionCredentialSummary> {
    await this.database.transaction(async (executor) => {
      const result = await executor.query<ClientSubscriptionCredentialRow>(
        `
          ${this.clientSubscriptionCredentialSelectSql()}
          WHERE csc.id = $1
          FOR UPDATE
        `,
        [credentialId],
      );
      const credential = result.rows[0];
      if (!credential) throw new NotFoundException('Client subscription credential not found');

      await executor.query(
        `
          UPDATE client_subscription_credentials
          SET status = 'revoked',
              revoked_at = COALESCE(revoked_at, now()),
              updated_at = now()
          WHERE id = $1
        `,
        [credentialId],
      );

      await this.audit.record(
        actor,
        'client_subscription_credential.revoke',
        'client_subscription_credential',
        credentialId,
        {
          clientConfigId: credential.clientConfigId,
          customerAccountId: credential.customerAccountId,
          outboundId: credential.outboundId,
          protocol: credential.protocol,
          alreadyRevoked: Boolean(credential.revokedAt),
        },
        executor,
      );
    });

    return this.getClientSubscriptionCredential(credentialId);
  }

  async authenticateClientAccessToken(token: string): Promise<ClientAuthActor> {
    try {
      const result = await this.database.query<ClientAccessTokenAuthRow>(
        `
          UPDATE client_access_tokens cat
          SET last_used_at = now()
          FROM client_configs cc
          JOIN customer_accounts ca ON ca.id = cc.customer_account_id
          WHERE cat.client_config_id = cc.id
            AND cat.token_hash = $1
            AND cat.revoked_at IS NULL
            AND cat.scopes ? 'client:read'
            AND ca.status = 'active'
            AND cc.status <> 'disabled'
          RETURNING
            cat.id,
            cat.client_config_id AS "clientConfigId",
            cat.name,
            cat.scopes,
            cat.created_by AS "createdBy",
            cat.created_at AS "createdAt",
            cat.last_used_at AS "lastUsedAt",
            cat.revoked_at AS "revokedAt",
            cc.customer_account_id AS "customerAccountId",
            cc.status AS "clientStatus",
            ca.status AS "accountStatus"
        `,
        [hashClientToken(token)],
      );
      const row = result.rows[0];

      if (!row) throw new UnauthorizedException('Invalid client token');

      return {
        id: row.clientConfigId,
        type: 'client',
        clientConfigId: row.clientConfigId,
        customerAccountId: row.customerAccountId,
        tokenId: row.id,
        scopes: this.normalizeScopes(row.scopes),
        clientStatus: row.clientStatus,
        accountStatus: row.accountStatus,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new ServiceUnavailableException('Client token lookup is unavailable');
    }
  }

  async getClientPortalProfile(actor: ClientAuthActor): Promise<ClientPortalProfileResponse> {
    const [profile, routePreference] = await Promise.all([
      this.getClientPortalRow(actor),
      this.getClientOwnedRoutePreference(actor),
    ]);
    const accountQuotaLimitBytes = this.numberFromBigInt(profile.accountQuotaLimitBytes);
    const accountUsedBytes = this.numberFromBigInt(profile.accountUsedBytes) ?? 0;
    const perClientLimitBytes = this.numberFromBigInt(profile.perClientLimitBytes);
    const clientQuotaLimitBytes = this.numberFromBigInt(profile.clientQuotaLimitBytes);
    const clientUsedBytes = this.numberFromBigInt(profile.clientUsedBytes) ?? 0;
    const effectiveQuotaLimitBytes = clientQuotaLimitBytes ?? perClientLimitBytes;

    return {
      account: {
        id: profile.customerAccountId,
        displayName: profile.accountDisplayName,
        status: profile.accountStatus,
        quotaScope: profile.quotaScope,
        quotaLimitBytes: accountQuotaLimitBytes,
        usedBytes: accountUsedBytes,
        remainingBytes: this.remainingBytes(accountQuotaLimitBytes, accountUsedBytes),
      },
      clientConfig: {
        id: profile.clientConfigId,
        label: profile.clientLabel,
        protocol: profile.protocol,
        deviceLimit: profile.deviceLimit,
        effectiveQuotaLimitBytes,
        usedBytes: clientUsedBytes,
        remainingBytes: this.remainingBytes(effectiveQuotaLimitBytes, clientUsedBytes),
        status: profile.clientStatus,
      },
      routePreference,
    };
  }

  async getTelegramBotAccountStatus(input: {
    telegramId?: string | null;
    telegramUsername?: string | null;
  }): Promise<TelegramBotAccountLookup> {
    const telegramId = this.normalizeNullableString(input.telegramId);
    const telegramUsername = this.normalizeTelegramUsername(input.telegramUsername);

    if (telegramId) {
      const result = await this.database.query<CustomerAccountRow>(
        `
          ${this.customerAccountSelectSql()}
          WHERE ca.telegram_id = $1
          GROUP BY ca.id
          ORDER BY ca.created_at DESC
          LIMIT 1
        `,
        [telegramId],
      );

      if (result.rows[0]) {
        return { status: 'found', account: this.mapTelegramBotAccount(result.rows[0]) };
      }
    }

    if (!telegramUsername) return { status: 'not_found' };

    const result = await this.database.query<CustomerAccountRow>(
      `
        ${this.customerAccountSelectSql()}
        WHERE lower(ca.telegram_username) = lower($1)
        GROUP BY ca.id
        ORDER BY ca.created_at DESC
        LIMIT 2
      `,
      [telegramUsername],
    );

    if (result.rows.length > 1) return { status: 'ambiguous' };
    if (!result.rows[0]) return { status: 'not_found' };

    return { status: 'found', account: this.mapTelegramBotAccount(result.rows[0]) };
  }

  private async fulfillTelegramPurchaseAfterAllocation(
    paymentOrder: AdminPaymentOrderSummary,
    account: AdminCustomerAccountDetail,
    allocation: AdminPaymentOrderAllocationSummary,
    duplicate: boolean,
    actor: AuthActor | undefined,
  ): Promise<AdminTelegramPurchaseFulfillmentSummary> {
    const telegramChatId = this.normalizeNullableString(account.telegramId);
    const base: AdminTelegramPurchaseFulfillmentSummary = {
      paymentOrderId: paymentOrder.id,
      customerAccountId: account.id,
      attempted: false,
      status: 'skipped',
      reasonCodes: [],
      telegramChatIdAvailable: Boolean(telegramChatId),
      clientConfigId: null,
      configDelivered: false,
      usageStatusLink: null,
      messageStatus: null,
      messageReason: null,
    };

    if (duplicate) {
      return this.finalizeTelegramPurchaseFulfillment(
        {
          ...base,
          reasonCodes: ['duplicate_allocation'],
        },
        actor,
        allocation,
      );
    }

    if (!telegramChatId) {
      return this.finalizeTelegramPurchaseFulfillment(
        {
          ...base,
          reasonCodes: ['missing_telegram_chat_id'],
        },
        actor,
        allocation,
      );
    }

    if (account.status !== 'active') {
      return this.finalizeTelegramPurchaseFulfillment(
        {
          ...base,
          reasonCodes: ['account_not_active'],
        },
        actor,
        allocation,
      );
    }

    try {
      if (!(await this.telegram.isBotConfigured())) {
        return this.finalizeTelegramPurchaseFulfillment(
          {
            ...base,
            reasonCodes: ['missing_bot_config'],
          },
          actor,
          allocation,
        );
      }

      const clients = await this.listTelegramFulfillmentVlessClients(account.id);
      if (!clients.length) {
        return this.finalizeTelegramPurchaseFulfillment(
          {
            ...base,
            reasonCodes: ['no_enabled_vless_client'],
          },
          actor,
          allocation,
        );
      }
      if (clients.length > 1) {
        return this.finalizeTelegramPurchaseFulfillment(
          {
            ...base,
            reasonCodes: ['multiple_enabled_vless_clients'],
          },
          actor,
          allocation,
        );
      }

      const client = clients[0];
      const clientActor: ClientAuthActor = {
        id: client.id,
        type: 'client',
        clientConfigId: client.id,
        customerAccountId: client.customerAccountId,
        tokenId: 'telegram-purchase-fulfillment',
        scopes: ['client:read'],
        clientStatus: client.status,
        accountStatus: client.accountStatus,
      };
      const subscription = await this.getClientSubscription(clientActor, 'main');
      const configLink = this.selectTelegramFulfillmentVlessConfig(subscription.subscription.configLinks);
      if (!configLink?.uri) {
        return this.finalizeTelegramPurchaseFulfillment(
          {
            ...base,
            clientConfigId: client.id,
            reasonCodes: ['no_rendered_vless_config'],
          },
          actor,
          allocation,
        );
      }

      const usageStatusLink = await this.telegramUsageStatusLink();
      const sendResult = await this.telegram.sendMessage(
        telegramChatId,
        this.telegramPurchaseFulfillmentMessage({
          paymentOrder,
          allocation,
          account,
          client,
          configUri: configLink.uri,
          usageStatusLink,
        }),
        { disableWebPagePreview: true },
      );
      const nonBlockingReasonCodes = usageStatusLink ? [] : ['usage_status_link_unavailable'];
      const reasonCodes =
        sendResult.status === 'sent'
          ? nonBlockingReasonCodes
          : [...nonBlockingReasonCodes, `telegram_${sendResult.reason}`];

      return this.finalizeTelegramPurchaseFulfillment(
        {
          ...base,
          attempted: true,
          status: sendResult.status === 'sent' ? 'sent' : sendResult.status,
          reasonCodes,
          clientConfigId: client.id,
          configDelivered: sendResult.status === 'sent',
          usageStatusLink,
          messageStatus: sendResult.status,
          messageReason: this.telegramSendMessageReason(sendResult),
        },
        actor,
        allocation,
      );
    } catch (error) {
      return this.finalizeTelegramPurchaseFulfillment(
        {
          ...base,
          attempted: true,
          status: 'failed',
          reasonCodes: ['telegram_fulfillment_exception'],
          messageReason: this.safeErrorMessage(error),
        },
        actor,
        allocation,
      );
    }
  }

  private async finalizeTelegramPurchaseFulfillment(
    summary: AdminTelegramPurchaseFulfillmentSummary,
    actor: AuthActor | undefined,
    allocation: AdminPaymentOrderAllocationSummary,
  ): Promise<AdminTelegramPurchaseFulfillmentSummary> {
    try {
      await this.audit.record(
        actor,
        'payment_order.telegram_purchase_fulfillment',
        'payment_order',
        summary.paymentOrderId,
        {
          customerAccountId: summary.customerAccountId,
          allocationId: allocation.id,
          status: summary.status,
          attempted: summary.attempted,
          reasonCodes: summary.reasonCodes,
          telegramChatIdAvailable: summary.telegramChatIdAvailable,
          clientConfigId: summary.clientConfigId,
          configDelivered: summary.configDelivered,
          usageStatusLinkAvailable: Boolean(summary.usageStatusLink),
          messageStatus: summary.messageStatus,
          messageReason: summary.messageReason,
        },
      );
    } catch {
      return summary;
    }

    return summary;
  }

  private async listTelegramFulfillmentVlessClients(customerAccountId: string): Promise<TelegramFulfillmentClientRow[]> {
    const result = await this.database.query<TelegramFulfillmentClientRow>(
      `
        SELECT
          cc.id,
          cc.customer_account_id AS "customerAccountId",
          cc.label,
          cc.protocol,
          cc.status,
          ca.status AS "accountStatus"
        FROM client_configs cc
        JOIN customer_accounts ca ON ca.id = cc.customer_account_id
        WHERE cc.customer_account_id = $1
          AND cc.status <> 'disabled'
          AND lower(cc.protocol) IN ('vless', 'vless-local-proxy')
        ORDER BY
          CASE cc.status
            WHEN 'active' THEN 0
            WHEN 'limited' THEN 1
            ELSE 2
          END,
          cc.created_at DESC
        LIMIT 2
      `,
      [customerAccountId],
    );

    return result.rows;
  }

  private selectTelegramFulfillmentVlessConfig(
    configLinks: ClientSubscriptionConfigLinkSummary[],
  ): ClientSubscriptionConfigLinkSummary | null {
    return (
      configLinks.find(
        (link) =>
          this.normalizeSubscriptionProtocol(link.type) === 'vless' &&
          link.renderStatus === 'rendered' &&
          typeof link.uri === 'string' &&
          link.uri.trim().startsWith('vless://'),
      ) ?? null
    );
  }

  private async telegramUsageStatusLink(): Promise<string | null> {
    try {
      const settings = await this.telegramConfig.getSettingsSummary();
      const username = this.normalizeNullableString(settings.botUsername)?.replace(/^@+/, '');
      if (!settings.commandsEnabled || !username) return null;
      return `https://t.me/${username}?start=status`;
    } catch {
      return null;
    }
  }

  private telegramPurchaseFulfillmentMessage(input: {
    paymentOrder: AdminPaymentOrderSummary;
    allocation: AdminPaymentOrderAllocationSummary;
    account: AdminCustomerAccountDetail;
    client: TelegramFulfillmentClientRow;
    configUri: string;
    usageStatusLink: string | null;
  }): string {
    const accountName = input.account.displayName?.trim() || 'Linked account';
    const quotaLine =
      input.account.quotaLimitBytes === null || input.account.quotaLimitBytes === undefined
        ? 'Account quota: Unlimited'
        : `Account remaining: ${this.formatTelegramBytes(input.account.remainingBytes ?? 0)} of ${this.formatTelegramBytes(input.account.quotaLimitBytes)}`;
    const usageLine = input.usageStatusLink
      ? `Usage/status: ${input.usageStatusLink}`
      : 'Usage/status: send /status to this bot.';

    return [
      'AfroGate purchase is active',
      `Account: ${accountName}`,
      `Package: ${input.paymentOrder.packageName}`,
      `Added: ${this.formatTelegramBytes(input.allocation.volumeBytesDelta)}`,
      quotaLine,
      `Client: ${input.client.label}`,
      usageLine,
      '',
      'VLESS config:',
      input.configUri,
      '',
      'Keep this config private. Support will never ask for your full config.',
    ].join('\n');
  }

  private telegramSendMessageReason(result: TelegramMessageSendResult): string | null {
    return result.status === 'sent' ? null : this.truncateTelegramText(result.reason, 120);
  }

  private safeErrorMessage(error: unknown): string {
    return this.truncateTelegramText(error instanceof Error ? error.message : 'unknown_error', 120);
  }

  private truncateTelegramText(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
  }

  private formatTelegramBytes(value: number): string {
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

  async getClientRewardedAdStatus(actor: ClientAuthActor): Promise<ClientRewardedAdStatus> {
    this.assertClientScope(actor, 'client:read');
    const today = this.currentUtcDay();
    const [settings, watchedToday] = await Promise.all([
      this.getRewardedAdSettings(),
      this.countRewardedAdGrants(actor.clientConfigId, today),
    ]);

    return this.mapClientRewardedAdStatus(settings, watchedToday);
  }

  async claimClientRewardedAd(
    actor: ClientAuthActor,
    dto: ClaimRewardedAdDto,
  ): Promise<ClientRewardedAdClaimResponse> {
    this.assertClientScope(actor, 'reward:claim');
    if (!['active', 'limited'].includes(actor.clientStatus)) {
      throw new ForbiddenException('Rewarded ad grants are not available for this client status');
    }

    try {
      const claimState = await this.createRewardedAdGrantForClient({
        auditActor: actor,
        clientConfigId: actor.clientConfigId,
        customerAccountId: actor.customerAccountId,
        provider: dto.provider,
        adSessionId: dto.adSessionId,
        idempotencyKey: dto.idempotencyKey,
        metadata: dto.metadata ?? {},
      });

      const [rewardedAds, profile] = await Promise.all([
        this.getClientRewardedAdStatus(actor),
        this.getClientPortalProfile(actor),
      ]);

      return {
        grant: this.mapRewardedAdGrant(claimState.grant),
        rewardedAds,
        profile,
        duplicate: claimState.duplicate,
      };
    } catch (error) {
      this.throwConflictIfUniqueViolation(error, 'Rewarded ad grant already exists');
      throw error;
    }
  }

  async handleRewardedAdProviderWebhook(
    headers: RewardedAdWebhookSignatureHeaders,
    dto: RewardedAdProviderWebhookDto,
  ): Promise<RewardedAdWebhookHandlerResponse> {
    const verified = this.rewardedAdWebhook.verify(headers, dto);

    try {
      const grantState = await this.createRewardedAdGrantForClient({
        clientConfigId: verified.clientConfigId,
        provider: verified.provider,
        adSessionId: verified.adSessionId,
        idempotencyKey: verified.idempotencyKey,
        metadata: verified.metadata,
        requiredVerificationModes: ['signed_webhook', 'provider_signed_webhook'],
        strictProviderMatch: true,
      });

      return {
        ok: true,
        action: grantState.duplicate ? 'duplicate' : 'granted',
        provider: grantState.provider,
        clientConfigId: grantState.clientConfigId,
        adSessionId: grantState.grant.adSessionId,
        idempotencyKey: grantState.grant.idempotencyKey,
        grant: this.mapRewardedAdGrant(grantState.grant),
        duplicate: grantState.duplicate,
      };
    } catch (error) {
      this.throwConflictIfUniqueViolation(error, 'Rewarded ad grant already exists');
      throw error;
    }
  }

  async getClientOwnedRoutePreference(
    actor: ClientAuthActor,
    routeGroupInput?: string,
  ): Promise<ClientRoutePreferenceSummary> {
    this.assertClientScope(actor, 'client:read');
    const preference = await this.getClientRoutePreference(actor.clientConfigId, routeGroupInput);
    return this.mapClientRoutePreferenceForClient(preference);
  }

  async upsertClientOwnedRoutePreference(
    actor: ClientAuthActor,
    dto: UpdateOwnClientRoutePreferenceDto,
  ): Promise<ClientRoutePreferenceSummary> {
    this.assertClientScope(actor, 'route:write');
    if (!['active', 'limited'].includes(actor.clientStatus)) {
      throw new ForbiddenException('Client route preference cannot be changed for this client status');
    }

    const routeGroup = this.normalizeRouteGroup(dto.routeGroup);
    const existing = await this.getClientRoutePreference(actor.clientConfigId, routeGroup);
    if (!existing.allowClientOverride) {
      throw new ForbiddenException('Client route override is disabled for this config');
    }

    const mode = dto.mode ?? existing.mode;
    const payload: UpsertClientRoutePreferenceDto = {
      routeGroup,
      mode,
      detectedCountryCode: dto.detectedCountryCode,
      detectedCountrySource: dto.detectedCountryCode !== undefined ? (dto.detectedCountryCode ? 'client_app' : null) : undefined,
      preferredExitCountryCode: mode === 'country' ? dto.preferredExitCountryCode : null,
      preferredOutboundId: mode === 'outbound' ? dto.preferredOutboundId : null,
      scoreProfile: dto.scoreProfile ?? existing.scoreProfile,
      autoDetectCountry: dto.autoDetectCountry ?? existing.autoDetectCountry,
      allowClientOverride: true,
      routeLocked: mode === 'outbound',
      stickySessionProtection: true,
    };

    if (mode === 'country' && !payload.preferredExitCountryCode) {
      throw new BadRequestException('preferredExitCountryCode is required for country route mode');
    }

    if (mode === 'outbound' && !payload.preferredOutboundId) {
      throw new BadRequestException('preferredOutboundId is required for outbound route mode');
    }

    if (payload.preferredOutboundId) {
      await this.ensureClientSelectableOutbound(payload.preferredOutboundId, routeGroup);
    }

    const saved = await this.upsertClientRoutePreference(actor.clientConfigId, payload, actor);
    return this.mapClientRoutePreferenceForClient(saved);
  }

  async listClientRouteOptions(
    actor: ClientAuthActor,
    routeGroupInput?: string,
  ): Promise<ClientRouteOptionsResponse> {
    this.assertClientScope(actor, 'client:read');
    const routeGroup = this.normalizeRouteGroup(routeGroupInput);
    const result = await this.database.query<ClientRouteOptionOutboundRow>(
      `
        SELECT
          o.id,
          o.name,
          o.type,
          o.route_group AS "routeGroup",
          UPPER(NULLIF(TRIM(s.country), '')) AS "countryCode",
          NULLIF(TRIM(s.region), '') AS "region",
          o.health_status AS "healthStatus",
          o.enabled,
          o.maintenance_mode AS "maintenanceMode",
          o.usage_multiplier AS "usageMultiplier",
          o.config,
          o.updated_at AS "updatedAt"
        FROM outbounds o
        LEFT JOIN servers s ON s.id = o.server_id
        WHERE o.route_group = $1
          AND o.enabled = true
          AND o.maintenance_mode = false
          AND o.health_status <> 'critical'
        ORDER BY
          CASE o.health_status
            WHEN 'healthy' THEN 0
            WHEN 'degraded' THEN 1
            ELSE 2
          END,
          o.priority ASC,
          o.name ASC
      `,
      [routeGroup],
    );

    const chargedRemainingBytes = await this.getClientChargedRemainingBytes(actor);
    const countryMap = new Map<string, {
      total: number;
      healthy: number;
      bestRank: number;
      bestHealthStatus: string;
      minUsageMultiplier: number;
    }>();
    for (const row of result.rows) {
      if (!row.countryCode) continue;
      const current = countryMap.get(row.countryCode) ?? {
        total: 0,
        healthy: 0,
        bestRank: Number.POSITIVE_INFINITY,
        bestHealthStatus: 'unknown',
        minUsageMultiplier: Number.POSITIVE_INFINITY,
      };
      const rank = this.clientRouteHealthRank(row.healthStatus);
      const usageMultiplier = this.normalizeUsageMultiplier(row.usageMultiplier);
      current.total += 1;
      current.healthy += row.healthStatus === 'healthy' ? 1 : 0;
      current.minUsageMultiplier = Math.min(current.minUsageMultiplier, usageMultiplier);
      if (rank < current.bestRank) {
        current.bestRank = rank;
        current.bestHealthStatus = row.healthStatus;
      }
      countryMap.set(row.countryCode, current);
    }

    return {
      routeGroup,
      countries: [...countryMap.entries()]
        .map(([countryCode, summary]) => ({
          countryCode,
          routeGroup,
          availableOutboundCount: summary.total,
          healthyOutboundCount: summary.healthy,
          bestHealthStatus: summary.bestHealthStatus,
          minUsageMultiplier: Number.isFinite(summary.minUsageMultiplier) ? summary.minUsageMultiplier : 1,
        }))
        .sort((left, right) => left.countryCode.localeCompare(right.countryCode)),
      outbounds: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        routeGroup: row.routeGroup,
        countryCode: row.countryCode,
        region: row.region,
        healthStatus: row.healthStatus,
        available: row.enabled && !row.maintenanceMode && row.healthStatus !== 'critical',
        usageMultiplier: this.normalizeUsageMultiplier(row.usageMultiplier),
        chargeLabel: this.usageMultiplierLabel(row.usageMultiplier),
        usableBytesAtMultiplier: this.bytesAtMultiplier(chargedRemainingBytes, row.usageMultiplier),
        subscriptionEndpoint: this.publicSubscriptionEndpoint(row, chargedRemainingBytes),
      })),
    };
  }

  async getClientSubscription(
    actor: ClientAuthActor,
    routeGroupInput?: string,
  ): Promise<ClientSubscriptionResponse> {
    this.assertClientScope(actor, 'client:read');
    const routeGroup = this.normalizeRouteGroup(routeGroupInput);
    const routeOptions = await this.listClientRouteOptions(actor, routeGroup);
    const chargedRemainingBytes = await this.getClientChargedRemainingBytes(actor);
    const credentialRows = await this.getActiveClientSubscriptionCredentialRows(actor.clientConfigId, routeGroup);
    const credentialsByOutboundProtocol = new Map(
      credentialRows.map((row) => [`${row.outboundId}:${row.protocol}`, row] as const),
    );

    return {
      subscription: {
        clientConfigId: actor.clientConfigId,
        routeGroup,
        generatedAt: new Date().toISOString(),
        chargedRemainingBytes,
        endpoints: routeOptions.outbounds
          .map((outbound) => outbound.subscriptionEndpoint)
          .filter((endpoint): endpoint is ClientSubscriptionEndpointSummary => Boolean(endpoint)),
        configLinks: routeOptions.outbounds.map((outbound) => {
          const protocol = this.normalizeSubscriptionProtocol(outbound.type);
          const credential = credentialsByOutboundProtocol.get(`${outbound.id}:${protocol}`) ?? null;
          return this.subscriptionConfigLink(outbound, credential);
        }),
      },
    };
  }

  async getClientRoutePreference(
    clientConfigId: string,
    routeGroupInput?: string,
  ): Promise<AdminClientRoutePreferenceSummary> {
    const routeGroup = this.normalizeRouteGroup(routeGroupInput);
    const result = await this.database.query<ClientRoutePreferenceRow>(
      this.clientRoutePreferenceSelectSql(true),
      [clientConfigId, routeGroup],
    );
    const row = result.rows[0];

    if (row) return this.mapClientRoutePreference(row);

    const client = await this.getClientConfigRow(clientConfigId);
    return this.defaultClientRoutePreference(client, routeGroup);
  }

  async upsertClientRoutePreference(
    clientConfigId: string,
    dto: UpsertClientRoutePreferenceDto,
    actor: AuditActor | undefined,
  ): Promise<AdminClientRoutePreferenceSummary> {
    const routeGroup = this.normalizeRouteGroup(dto.routeGroup);

    await this.database.transaction(async (executor) => {
      const client = await this.getClientConfigRowForUpdate(executor, clientConfigId);
      const existing = await this.getClientRoutePreferenceRowForUpdate(executor, clientConfigId, routeGroup);
      const patch = this.buildClientRoutePreferencePatch(dto, existing ?? null);

      if (patch.preferredOutboundId) {
        await this.ensurePreferredOutbound(executor, patch.preferredOutboundId, routeGroup);
      }

      if (patch.mode === 'country' && !patch.preferredExitCountryCode) {
        throw new BadRequestException('preferredExitCountryCode is required for country route mode');
      }

      if (patch.mode === 'outbound' && !patch.preferredOutboundId) {
        throw new BadRequestException('preferredOutboundId is required for outbound route mode');
      }

      if (patch.routeLocked && !patch.preferredOutboundId) {
        throw new BadRequestException('routeLocked requires preferredOutboundId so the locked route is explicit');
      }

      const result = await executor.query<{ id: string }>(
        `
          INSERT INTO client_route_preferences (
            client_config_id, route_group, mode, detected_country_code,
            detected_country_source, preferred_exit_country_code, preferred_outbound_id,
            score_profile, auto_detect_country, allow_client_override, route_locked,
            sticky_session_protection, last_detected_at, created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (client_config_id, route_group) DO UPDATE
          SET mode = EXCLUDED.mode,
              detected_country_code = EXCLUDED.detected_country_code,
              detected_country_source = EXCLUDED.detected_country_source,
              preferred_exit_country_code = EXCLUDED.preferred_exit_country_code,
              preferred_outbound_id = EXCLUDED.preferred_outbound_id,
              score_profile = EXCLUDED.score_profile,
              auto_detect_country = EXCLUDED.auto_detect_country,
              allow_client_override = EXCLUDED.allow_client_override,
              route_locked = EXCLUDED.route_locked,
              sticky_session_protection = EXCLUDED.sticky_session_protection,
              last_detected_at = EXCLUDED.last_detected_at,
              updated_at = now()
          RETURNING id
        `,
        [
          clientConfigId,
          routeGroup,
          patch.mode,
          patch.detectedCountryCode,
          patch.detectedCountrySource,
          patch.preferredExitCountryCode,
          patch.preferredOutboundId,
          patch.scoreProfile,
          patch.autoDetectCountry,
          patch.allowClientOverride,
          patch.routeLocked,
          patch.stickySessionProtection,
          patch.lastDetectedAt,
          actor?.id ?? null,
        ],
      );

      await this.upsertClientRouteAssignment(executor, client, routeGroup, patch);

      await this.audit.record(
        actor,
        existing ? 'client_route_preference.update' : 'client_route_preference.create',
        'client_route_preference',
        result.rows[0].id,
        {
          clientConfigId,
          customerAccountId: client.customerAccountId,
          routeGroup,
          assignmentKey: this.clientRouteAssignmentKey(clientConfigId),
          mode: patch.mode,
          scoreProfile: patch.scoreProfile,
          detectedCountryStored: Boolean(patch.detectedCountryCode),
          preferredExitCountryCode: patch.preferredExitCountryCode,
          preferredOutboundId: patch.preferredOutboundId,
          routeLocked: patch.routeLocked,
          stickySessionProtection: patch.stickySessionProtection,
        },
        executor,
      );
    });

    return this.getClientRoutePreference(clientConfigId, routeGroup);
  }

  normalizeLimit(input: string | undefined, fallback: number, max: number): number {
    const value = Number(input);

    if (!Number.isInteger(value) || value <= 0) return fallback;
    return Math.min(value, max);
  }

  private async getBillingSettingsRow(
    executor: DatabaseQueryExecutor,
    forUpdate = false,
  ): Promise<BillingSettingsRow> {
    await executor.query(
      `
        INSERT INTO billing_settings (setting_key, currency, price_per_gb)
        VALUES ('default', 'toman', 0)
        ON CONFLICT (setting_key) DO NOTHING
      `,
    );

    const result = await executor.query<BillingSettingsRow>(
      `
        SELECT
          setting_key AS "settingKey",
          currency,
          price_per_gb AS "pricePerGb",
          updated_by AS "updatedBy",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM billing_settings
        WHERE setting_key = 'default'
        ${forUpdate ? 'FOR UPDATE' : ''}
      `,
    );
    const row = result.rows[0];

    if (!row) throw new ServiceUnavailableException('Billing settings are not available');
    return row;
  }

  private volumePackageSelectSql(): string {
    return `
      SELECT
        id,
        name,
        slug,
        volume_bytes AS "volumeBytes",
        duration_days AS "durationDays",
        price_per_gb AS "pricePerGb",
        total_price AS "totalPrice",
        currency,
        status,
        sort_order AS "sortOrder",
        notes,
        created_by AS "createdBy",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM volume_packages
    `;
  }

  private async getVolumePackageRowForUpdate(
    executor: DatabaseQueryExecutor,
    id: string,
  ): Promise<VolumePackageRow> {
    const result = await executor.query<VolumePackageRow>(
      `${this.volumePackageSelectSql()} WHERE id = $1 FOR UPDATE`,
      [id],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Volume package not found');
    return row;
  }

  private async updateVolumePackageFields(
    executor: DatabaseQueryExecutor,
    id: string,
    existing: VolumePackageRow,
    dto: UpdateVolumePackageDto,
  ): Promise<string[]> {
    const fields = Object.keys(dto);
    const existingVolumeBytes = this.numberFromBigInt(existing.volumeBytes) ?? 0;
    const existingPricePerGb = this.numberFromBigInt(existing.pricePerGb) ?? 0;
    const existingTotalPrice = this.numberFromBigInt(existing.totalPrice) ?? 0;
    const volumeGb = dto.volumeGb ?? existingVolumeBytes / BYTES_PER_GB;
    const pricePerGb = dto.pricePerGb ?? existingPricePerGb;
    const shouldRecalculateTotal = dto.totalPrice === undefined && (dto.volumeGb !== undefined || dto.pricePerGb !== undefined);
    const totalPrice = dto.totalPrice ?? (shouldRecalculateTotal ? this.calculateTotalPrice(volumeGb, pricePerGb) : existingTotalPrice);

    if (shouldRecalculateTotal) fields.push('totalPrice');
    if (!fields.length) return fields;

    const name = dto.name !== undefined ? dto.name.trim() : existing.name;
    if (!name) throw new BadRequestException('Volume package name is required');

    await executor.query(
      `
        UPDATE volume_packages
        SET name = $1,
            slug = $2,
            volume_bytes = $3,
            duration_days = $4,
            price_per_gb = $5,
            total_price = $6,
            currency = $7,
            status = $8,
            sort_order = $9,
            notes = $10,
            updated_at = now()
        WHERE id = $11
      `,
      [
        name,
        dto.slug !== undefined ? this.normalizeSlug(dto.slug) : existing.slug,
        dto.volumeGb !== undefined ? this.gbToBytes(dto.volumeGb) : existingVolumeBytes,
        dto.durationDays !== undefined ? dto.durationDays : existing.durationDays,
        pricePerGb,
        totalPrice,
        dto.currency !== undefined ? this.normalizeCurrency(dto.currency) : existing.currency,
        dto.status ?? existing.status,
        dto.sortOrder ?? existing.sortOrder,
        dto.notes !== undefined ? this.normalizeNullableString(dto.notes) : existing.notes,
        id,
      ],
    );

    return fields;
  }

  private paymentMethodSelectSql(): string {
    return `
      SELECT
        id,
        name,
        slug,
        provider,
        checkout_mode AS "checkoutMode",
        currency,
        min_amount AS "minAmount",
        max_amount AS "maxAmount",
        status,
        sort_order AS "sortOrder",
        supports_auto_capture AS "supportsAutoCapture",
        public_config AS "publicConfig",
        instructions,
        created_by AS "createdBy",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM payment_methods
    `;
  }

  private async getPaymentMethodRowForUpdate(
    executor: DatabaseQueryExecutor,
    id: string,
  ): Promise<PaymentMethodRow> {
    const result = await executor.query<PaymentMethodRow>(
      `${this.paymentMethodSelectSql()} WHERE id = $1 FOR UPDATE`,
      [id],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Payment method not found');
    return row;
  }

  private async updatePaymentMethodFields(
    executor: DatabaseQueryExecutor,
    id: string,
    existing: PaymentMethodRow,
    dto: UpdatePaymentMethodDto,
  ): Promise<string[]> {
    const fields = Object.keys(dto);
    if (!fields.length) return fields;

    const name = dto.name !== undefined ? dto.name.trim() : existing.name;
    if (!name) throw new BadRequestException('Payment method name is required');

    const provider = dto.provider !== undefined ? this.normalizeProvider(dto.provider) : existing.provider;
    const checkoutMode = dto.checkoutMode ?? (dto.provider !== undefined ? this.defaultCheckoutMode(provider) : existing.checkoutMode);
    const minAmount = dto.minAmount !== undefined ? dto.minAmount : this.numberFromBigInt(existing.minAmount);
    const maxAmount = dto.maxAmount !== undefined ? dto.maxAmount : this.numberFromBigInt(existing.maxAmount);
    const supportsAutoCapture =
      dto.supportsAutoCapture ?? (dto.provider !== undefined && provider === 'paypal' ? true : existing.supportsAutoCapture);
    this.assertAmountRange(minAmount, maxAmount);

    await executor.query(
      `
        UPDATE payment_methods
        SET name = $1,
            slug = $2,
            provider = $3,
            checkout_mode = $4,
            currency = $5,
            min_amount = $6,
            max_amount = $7,
            status = $8,
            sort_order = $9,
            supports_auto_capture = $10,
            public_config = $11::jsonb,
            instructions = $12,
            updated_at = now()
        WHERE id = $13
      `,
      [
        name,
        dto.slug !== undefined ? this.normalizeSlug(dto.slug) : existing.slug,
        provider,
        checkoutMode,
        dto.currency !== undefined ? this.normalizeCurrency(dto.currency) : existing.currency,
        minAmount,
        maxAmount,
        dto.status ?? existing.status,
        dto.sortOrder ?? existing.sortOrder,
        supportsAutoCapture,
        this.stringifyPublicRecord(dto.publicConfig ?? existing.publicConfig ?? {}, 'Payment method public config'),
        dto.instructions !== undefined ? this.normalizeNullableString(dto.instructions) : existing.instructions,
        id,
      ],
    );

    return fields;
  }

  private paymentOrderSelectSql(): string {
    return `
      SELECT
        po.id,
        po.customer_account_id AS "customerAccountId",
        ca.display_name AS "customerDisplayName",
        ca.telegram_username AS "customerTelegramUsername",
        po.volume_package_id AS "volumePackageId",
        po.payment_method_id AS "paymentMethodId",
        pm.name AS "paymentMethodName",
        pm.slug AS "paymentMethodSlug",
        po.package_name AS "packageName",
        po.package_slug AS "packageSlug",
        po.volume_bytes AS "volumeBytes",
        po.duration_days AS "durationDays",
        po.price_per_gb AS "pricePerGb",
        po.amount,
        po.currency,
        po.status,
        po.provider,
        po.provider_order_id AS "providerOrderId",
        po.provider_capture_id AS "providerCaptureId",
        po.checkout_url AS "checkoutUrl",
        po.idempotency_key AS "idempotencyKey",
        po.paid_at AS "paidAt",
        po.failed_at AS "failedAt",
        po.refunded_at AS "refundedAt",
        po.expires_at AS "expiresAt",
        po.metadata,
        po.notes,
        po.created_by AS "createdBy",
        po.created_at AS "createdAt",
        po.updated_at AS "updatedAt",
        CASE
          WHEN poa.id IS NOT NULL THEN 'allocated'
          WHEN po.status = 'paid' THEN 'pending'
          ELSE 'not_applicable'
        END AS "allocationStatus",
        poa.id AS "allocationId",
        poa.created_at AS "allocatedAt",
        poa.volume_bytes_delta AS "allocatedVolumeBytes",
        CASE
          WHEN po.status = 'paid' AND poa.id IS NULL AND po.paid_at IS NOT NULL
            THEN FLOOR(EXTRACT(EPOCH FROM (now() - po.paid_at)))::bigint
          ELSE 0
        END AS "allocationDelaySeconds"
      FROM payment_orders po
      JOIN customer_accounts ca ON ca.id = po.customer_account_id
      LEFT JOIN payment_methods pm ON pm.id = po.payment_method_id
      LEFT JOIN payment_order_allocations poa ON poa.payment_order_id = po.id
    `;
  }

  private paymentOrderAllocationStatusWhere(value: string): string {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'allocated') return 'poa.id IS NOT NULL';
    if (normalized === 'pending') return "po.status = 'paid' AND poa.id IS NULL";
    if (normalized === 'not_applicable') return "po.status <> 'paid' AND poa.id IS NULL";
    throw new BadRequestException('Invalid payment order allocation status');
  }

  private async getPaymentOrderRowForUpdate(
    executor: DatabaseQueryExecutor,
    id: string,
  ): Promise<PaymentOrderRow> {
    const result = await executor.query<PaymentOrderRow>(
      `${this.paymentOrderSelectSql()} WHERE po.id = $1 FOR UPDATE OF po`,
      [id],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Payment order not found');
    return row;
  }

  private async getPaymentOrderRowForUpdateByProviderOrderId(
    executor: DatabaseQueryExecutor,
    provider: string,
    providerOrderId: string,
  ): Promise<PaymentOrderRow | null> {
    const result = await executor.query<PaymentOrderRow>(
      `${this.paymentOrderSelectSql()} WHERE po.provider = $1 AND po.provider_order_id = $2 FOR UPDATE OF po`,
      [provider, providerOrderId],
    );

    return result.rows[0] ?? null;
  }

  private async getCustomerAccountRowForUpdate(
    executor: DatabaseQueryExecutor,
    id: string,
  ): Promise<CustomerAccountRow> {
    const result = await executor.query<CustomerAccountRow>(
      `
        SELECT
          id,
          display_name AS "displayName",
          telegram_id AS "telegramId",
          telegram_username AS "telegramUsername",
          paid_number_hash AS "paidNumberHash",
          status,
          quota_scope AS "quotaScope",
          quota_limit_bytes AS "quotaLimitBytes",
          per_client_limit_bytes AS "perClientLimitBytes",
          used_bytes AS "usedBytes",
          notes,
          created_at AS "createdAt",
          updated_at AS "updatedAt",
          0::int AS "clientCount",
          0::int AS "activeClientCount"
        FROM customer_accounts
        WHERE id = $1
        FOR UPDATE
      `,
      [id],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Customer account not found');
    return row;
  }

  private async getPaymentOrderAllocationByOrderIdForUpdate(
    executor: DatabaseQueryExecutor,
    paymentOrderId: string,
  ): Promise<PaymentOrderAllocationRow | null> {
    const result = await executor.query<PaymentOrderAllocationRow>(
      `${this.paymentOrderAllocationSelectSql()} WHERE payment_order_id = $1 FOR UPDATE`,
      [paymentOrderId],
    );

    return result.rows[0] ?? null;
  }

  private async getPaymentOrderAllocationByIdempotencyForUpdate(
    executor: DatabaseQueryExecutor,
    idempotencyKey: string,
  ): Promise<PaymentOrderAllocationRow | null> {
    const result = await executor.query<PaymentOrderAllocationRow>(
      `${this.paymentOrderAllocationSelectSql()} WHERE idempotency_key = $1 FOR UPDATE`,
      [idempotencyKey],
    );

    return result.rows[0] ?? null;
  }

  private async insertPaymentOrderAllocation(
    executor: DatabaseQueryExecutor,
    paymentOrder: PaymentOrderRow,
    input: {
      idempotencyKey: string;
      volumeBytes: number;
      quotaLimitBeforeBytes: number | null;
      quotaLimitAfterBytes: number;
      metadata: Record<string, unknown>;
    },
    actor: AuditActor | undefined,
  ): Promise<PaymentOrderAllocationRow> {
    const result = await executor.query<PaymentOrderAllocationRow>(
      `
        INSERT INTO payment_order_allocations (
          payment_order_id, customer_account_id, allocation_scope, volume_bytes_delta,
          quota_limit_before_bytes, quota_limit_after_bytes, idempotency_key,
          metadata, created_by
        )
        VALUES ($1, $2, 'account_quota', $3, $4, $5, $6, $7::jsonb, $8)
        RETURNING
          id,
          payment_order_id AS "paymentOrderId",
          customer_account_id AS "customerAccountId",
          allocation_scope AS "allocationScope",
          volume_bytes_delta AS "volumeBytesDelta",
          quota_limit_before_bytes AS "quotaLimitBeforeBytes",
          quota_limit_after_bytes AS "quotaLimitAfterBytes",
          idempotency_key AS "idempotencyKey",
          metadata,
          created_by AS "createdBy",
          created_at AS "createdAt"
      `,
      [
        paymentOrder.id,
        paymentOrder.customerAccountId,
        input.volumeBytes,
        input.quotaLimitBeforeBytes,
        input.quotaLimitAfterBytes,
        input.idempotencyKey,
        this.stringifyPublicRecord(input.metadata, 'Payment order allocation metadata'),
        actor?.id ?? null,
      ],
    );

    return result.rows[0];
  }

  private async getCurrentPanelVolumeChargeByIdempotencyForUpdate(
    executor: DatabaseQueryExecutor,
    idempotencyKey: string,
  ): Promise<CurrentPanelVolumeChargeEventRow | null> {
    const result = await executor.query<CurrentPanelVolumeChargeEventRow>(
      `${this.currentPanelVolumeChargeSelectSql()} WHERE idempotency_key = $1 FOR UPDATE`,
      [idempotencyKey],
    );

    return result.rows[0] ?? null;
  }

  private async insertCurrentPanelVolumeChargeEvent(
    executor: DatabaseQueryExecutor,
    input: {
      customerAccountId: string;
      chargeScope: CurrentPanelVolumeChargeScope;
      volumeBytes: number;
      accountQuotaBeforeBytes: number | null;
      accountQuotaAfterBytes: number | null;
      clientConfigIds: string[];
      clientQuotaChanges: CurrentPanelVolumeChargeClientQuotaChange[];
      idempotencyKey: string | null;
      notes: string | null;
      metadata: Record<string, unknown>;
    },
    actor: AuditActor | undefined,
  ): Promise<CurrentPanelVolumeChargeEventRow> {
    const result = await executor.query<CurrentPanelVolumeChargeEventRow>(
      `
        INSERT INTO quota_charge_events (
          customer_account_id, charge_scope, volume_bytes_delta,
          account_quota_before_bytes, account_quota_after_bytes,
          client_config_ids, client_quota_changes, external_panel_write_status,
          idempotency_key, notes, metadata, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, 'not_executed', $8, $9, $10::jsonb, $11)
        RETURNING
          id,
          customer_account_id AS "customerAccountId",
          charge_scope AS "chargeScope",
          volume_bytes_delta AS "volumeBytesDelta",
          account_quota_before_bytes AS "accountQuotaBeforeBytes",
          account_quota_after_bytes AS "accountQuotaAfterBytes",
          client_config_ids AS "clientConfigIds",
          client_quota_changes AS "clientQuotaChanges",
          external_panel_write_status AS "externalPanelWriteStatus",
          idempotency_key AS "idempotencyKey",
          notes,
          metadata,
          created_by AS "createdBy",
          created_at AS "createdAt"
      `,
      [
        input.customerAccountId,
        input.chargeScope,
        input.volumeBytes,
        input.accountQuotaBeforeBytes,
        input.accountQuotaAfterBytes,
        JSON.stringify(input.clientConfigIds),
        JSON.stringify(input.clientQuotaChanges),
        input.idempotencyKey,
        input.notes,
        this.stringifyPublicRecord(input.metadata, 'Current panel volume charge metadata'),
        actor?.id ?? null,
      ],
    );

    return result.rows[0];
  }

  private currentPanelVolumeChargeSelectSql(): string {
    return `
      SELECT
        id,
        customer_account_id AS "customerAccountId",
        charge_scope AS "chargeScope",
        volume_bytes_delta AS "volumeBytesDelta",
        account_quota_before_bytes AS "accountQuotaBeforeBytes",
        account_quota_after_bytes AS "accountQuotaAfterBytes",
        client_config_ids AS "clientConfigIds",
        client_quota_changes AS "clientQuotaChanges",
        external_panel_write_status AS "externalPanelWriteStatus",
        idempotency_key AS "idempotencyKey",
        notes,
        metadata,
        created_by AS "createdBy",
        created_at AS "createdAt"
      FROM quota_charge_events
    `;
  }

  private paymentOrderAllocationSelectSql(): string {
    return `
      SELECT
        id,
        payment_order_id AS "paymentOrderId",
        customer_account_id AS "customerAccountId",
        allocation_scope AS "allocationScope",
        volume_bytes_delta AS "volumeBytesDelta",
        quota_limit_before_bytes AS "quotaLimitBeforeBytes",
        quota_limit_after_bytes AS "quotaLimitAfterBytes",
        idempotency_key AS "idempotencyKey",
        metadata,
        created_by AS "createdBy",
        created_at AS "createdAt"
      FROM payment_order_allocations
    `;
  }

  private mapBillingSettings(row: BillingSettingsRow): AdminBillingSettingsSummary {
    return {
      settingKey: row.settingKey,
      currency: row.currency,
      pricePerGb: this.numberFromBigInt(row.pricePerGb) ?? 0,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapAdminRewardedAdSettings(row: RewardedAdSettingsRow): AdminRewardedAdSettingsSummary {
    const rewardBytes = this.numberFromBigInt(row.rewardBytes) ?? DEFAULT_REWARDED_AD_REWARD_BYTES;

    return {
      settingKey: row.settingKey,
      enabled: row.enabled,
      rewardBytes,
      rewardMb: rewardBytes / (1024 ** 2),
      dailyLimit: Math.max(row.dailyLimit, 0),
      provider: row.provider || DEFAULT_REWARDED_AD_PROVIDER,
      verificationMode: row.verificationMode || DEFAULT_REWARDED_AD_VERIFICATION_MODE,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapVolumePackage(row: VolumePackageRow): AdminVolumePackageSummary {
    const volumeBytes = this.numberFromBigInt(row.volumeBytes) ?? 0;
    const volumeGb = volumeBytes / BYTES_PER_GB;

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      volumeBytes,
      volumeGb,
      durationDays: row.durationDays,
      pricePerGb: this.numberFromBigInt(row.pricePerGb) ?? 0,
      totalPrice: this.numberFromBigInt(row.totalPrice) ?? 0,
      currency: row.currency,
      status: row.status,
      sortOrder: row.sortOrder,
      notes: row.notes,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapPaymentMethod(row: PaymentMethodRow): AdminPaymentMethodSummary {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      provider: row.provider,
      checkoutMode: row.checkoutMode,
      currency: row.currency,
      minAmount: this.numberFromBigInt(row.minAmount),
      maxAmount: this.numberFromBigInt(row.maxAmount),
      status: row.status,
      sortOrder: row.sortOrder,
      supportsAutoCapture: row.supportsAutoCapture,
      publicConfig: row.publicConfig ?? {},
      instructions: row.instructions,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapPaymentOrder(row: PaymentOrderRow): AdminPaymentOrderSummary {
    const volumeBytes = this.numberFromBigInt(row.volumeBytes) ?? 0;

    return {
      id: row.id,
      customerAccountId: row.customerAccountId,
      customerDisplayName: row.customerDisplayName,
      customerTelegramUsername: row.customerTelegramUsername,
      volumePackageId: row.volumePackageId,
      paymentMethodId: row.paymentMethodId,
      paymentMethodName: row.paymentMethodName,
      paymentMethodSlug: row.paymentMethodSlug,
      packageName: row.packageName,
      packageSlug: row.packageSlug,
      volumeBytes,
      volumeGb: volumeBytes / BYTES_PER_GB,
      durationDays: row.durationDays,
      pricePerGb: this.numberFromBigInt(row.pricePerGb) ?? 0,
      amount: this.numberFromBigInt(row.amount) ?? 0,
      currency: row.currency,
      status: row.status,
      provider: row.provider,
      providerOrderId: row.providerOrderId,
      providerCaptureId: row.providerCaptureId,
      checkoutUrl: row.checkoutUrl,
      idempotencyKey: row.idempotencyKey,
      paidAt: row.paidAt?.toISOString() ?? null,
      failedAt: row.failedAt?.toISOString() ?? null,
      refundedAt: row.refundedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      allocationStatus: row.allocationStatus ?? 'not_applicable',
      allocationId: row.allocationId ?? null,
      allocatedAt: row.allocatedAt?.toISOString() ?? null,
      allocatedVolumeBytes: this.numberFromBigInt(row.allocatedVolumeBytes),
      allocationDelaySeconds: this.numberFromBigInt(row.allocationDelaySeconds) ?? 0,
      metadata: row.metadata ?? {},
      notes: row.notes,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapPaymentOrderAllocation(row: PaymentOrderAllocationRow): AdminPaymentOrderAllocationSummary {
    return {
      id: row.id,
      paymentOrderId: row.paymentOrderId,
      customerAccountId: row.customerAccountId,
      allocationScope: row.allocationScope,
      volumeBytesDelta: this.numberFromBigInt(row.volumeBytesDelta) ?? 0,
      quotaLimitBeforeBytes: this.numberFromBigInt(row.quotaLimitBeforeBytes),
      quotaLimitAfterBytes: this.numberFromBigInt(row.quotaLimitAfterBytes) ?? 0,
      idempotencyKey: row.idempotencyKey,
      metadata: row.metadata ?? {},
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private mapCurrentPanelVolumeChargeEvent(
    row: CurrentPanelVolumeChargeEventRow,
  ): AdminCurrentPanelVolumeChargeEventSummary {
    return {
      id: row.id,
      customerAccountId: row.customerAccountId,
      scope: row.chargeScope,
      volumeBytesDelta: this.numberFromBigInt(row.volumeBytesDelta) ?? 0,
      accountQuotaLimitBeforeBytes: this.numberFromBigInt(row.accountQuotaBeforeBytes),
      accountQuotaLimitAfterBytes: this.numberFromBigInt(row.accountQuotaAfterBytes),
      clientConfigIds: this.normalizeJsonStringArray(row.clientConfigIds),
      clientQuotaChanges: this.normalizeCurrentPanelClientQuotaChanges(row.clientQuotaChanges),
      externalPanelWriteStatus: row.externalPanelWriteStatus,
      idempotencyKey: row.idempotencyKey,
      notes: row.notes,
      metadata: row.metadata ?? {},
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private mapClientUsageEvent(row: ClientUsageEventRow): AdminClientUsageEventSummary {
    return {
      id: row.id,
      customerAccountId: row.customerAccountId,
      clientConfigId: row.clientConfigId,
      source: row.source,
      direction: row.direction,
      usedBytesDelta: this.numberFromBigInt(row.usedBytesDelta) ?? 0,
      rawUsedBytesDelta: this.numberFromBigInt(row.rawUsedBytesDelta),
      usageMultiplier: row.usageMultiplier,
      ratedOutboundId: row.ratedOutboundId,
      ratedOutboundName: row.ratedOutboundName,
      rxBytes: this.numberFromBigInt(row.rxBytes),
      txBytes: this.numberFromBigInt(row.txBytes),
      observedAt: row.observedAt.toISOString(),
      windowStart: row.windowStart?.toISOString() ?? null,
      windowEnd: row.windowEnd?.toISOString() ?? null,
      idempotencyKey: row.idempotencyKey,
      externalReference: row.externalReference,
      notes: row.notes,
      metadata: row.metadata ?? {},
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async getClientConfig(id: string): Promise<AdminClientConfigSummary> {
    const result = await this.database.query<ClientConfigRow>(
      `
        SELECT
          cc.id,
          cc.customer_account_id AS "customerAccountId",
          cc.label,
          cc.protocol,
          cc.external_panel AS "externalPanel",
          cc.external_panel_user_id AS "externalPanelUserId",
          cc.external_panel_config_id AS "externalPanelConfigId",
          cc.device_limit AS "deviceLimit",
          cc.quota_limit_bytes AS "quotaLimitBytes",
          cc.used_bytes AS "usedBytes",
          cc.status,
          cc.notes,
          cc.created_at AS "createdAt",
          cc.updated_at AS "updatedAt",
          crp.id AS "routePreferenceId",
          crp.route_group AS "routePreferenceRouteGroup",
          crp.mode AS "routePreferenceMode",
          crp.detected_country_code AS "routePreferenceDetectedCountryCode",
          crp.detected_country_source AS "routePreferenceDetectedCountrySource",
          crp.preferred_exit_country_code AS "routePreferencePreferredExitCountryCode",
          crp.preferred_outbound_id AS "routePreferencePreferredOutboundId",
          po.name AS "routePreferencePreferredOutboundName",
          crp.score_profile AS "routePreferenceScoreProfile",
          crp.auto_detect_country AS "routePreferenceAutoDetectCountry",
          crp.allow_client_override AS "routePreferenceAllowClientOverride",
          crp.route_locked AS "routePreferenceRouteLocked",
          crp.sticky_session_protection AS "routePreferenceStickySessionProtection",
          crp.last_detected_at AS "routePreferenceLastDetectedAt",
          crp.created_by AS "routePreferenceCreatedBy",
          crp.created_at AS "routePreferenceCreatedAt",
          crp.updated_at AS "routePreferenceUpdatedAt"
        FROM client_configs cc
        LEFT JOIN client_route_preferences crp ON crp.client_config_id = cc.id AND crp.route_group = 'main'
        LEFT JOIN outbounds po ON po.id = crp.preferred_outbound_id
        WHERE cc.id = $1
      `,
      [id],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Client config not found');

    const accountResult = await this.database.query<{ perClientLimitBytes: string | number | null }>(
      `
        SELECT per_client_limit_bytes AS "perClientLimitBytes"
        FROM customer_accounts
        WHERE id = $1
      `,
      [row.customerAccountId],
    );

    return this.mapClientConfig(row, this.numberFromBigInt(accountResult.rows[0]?.perClientLimitBytes ?? null));
  }

  private async listClientConfigs(
    customerAccountId: string,
    defaultPerClientLimitBytes: number | null,
  ): Promise<AdminClientConfigSummary[]> {
    const result = await this.database.query<ClientConfigRow>(
      `
        SELECT
          cc.id,
          cc.customer_account_id AS "customerAccountId",
          cc.label,
          cc.protocol,
          cc.external_panel AS "externalPanel",
          cc.external_panel_user_id AS "externalPanelUserId",
          cc.external_panel_config_id AS "externalPanelConfigId",
          cc.device_limit AS "deviceLimit",
          cc.quota_limit_bytes AS "quotaLimitBytes",
          cc.used_bytes AS "usedBytes",
          cc.status,
          cc.notes,
          cc.created_at AS "createdAt",
          cc.updated_at AS "updatedAt",
          crp.id AS "routePreferenceId",
          crp.route_group AS "routePreferenceRouteGroup",
          crp.mode AS "routePreferenceMode",
          crp.detected_country_code AS "routePreferenceDetectedCountryCode",
          crp.detected_country_source AS "routePreferenceDetectedCountrySource",
          crp.preferred_exit_country_code AS "routePreferencePreferredExitCountryCode",
          crp.preferred_outbound_id AS "routePreferencePreferredOutboundId",
          po.name AS "routePreferencePreferredOutboundName",
          crp.score_profile AS "routePreferenceScoreProfile",
          crp.auto_detect_country AS "routePreferenceAutoDetectCountry",
          crp.allow_client_override AS "routePreferenceAllowClientOverride",
          crp.route_locked AS "routePreferenceRouteLocked",
          crp.sticky_session_protection AS "routePreferenceStickySessionProtection",
          crp.last_detected_at AS "routePreferenceLastDetectedAt",
          crp.created_by AS "routePreferenceCreatedBy",
          crp.created_at AS "routePreferenceCreatedAt",
          crp.updated_at AS "routePreferenceUpdatedAt"
        FROM client_configs cc
        LEFT JOIN client_route_preferences crp ON crp.client_config_id = cc.id AND crp.route_group = 'main'
        LEFT JOIN outbounds po ON po.id = crp.preferred_outbound_id
        WHERE cc.customer_account_id = $1
        ORDER BY cc.created_at DESC
      `,
      [customerAccountId],
    );

    return result.rows.map((row) => this.mapClientConfig(row, defaultPerClientLimitBytes));
  }

  private async getClientSubscriptionCredential(
    credentialId: string,
  ): Promise<AdminClientSubscriptionCredentialSummary> {
    const result = await this.database.query<ClientSubscriptionCredentialRow>(
      `
        ${this.clientSubscriptionCredentialSelectSql()}
        WHERE csc.id = $1
      `,
      [credentialId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Client subscription credential not found');
    return this.mapClientSubscriptionCredential(row);
  }

  private async getClientSubscriptionCredentialRows(
    clientConfigId: string,
  ): Promise<ClientSubscriptionCredentialRow[]> {
    const result = await this.database.query<ClientSubscriptionCredentialRow>(
      `
        ${this.clientSubscriptionCredentialSelectSql()}
        WHERE csc.client_config_id = $1
        ORDER BY csc.created_at DESC
      `,
      [clientConfigId],
    );

    return result.rows;
  }

  private async getActiveClientSubscriptionCredentialRows(
    clientConfigId: string,
    routeGroup: string,
  ): Promise<ClientSubscriptionCredentialRow[]> {
    const result = await this.database.query<ClientSubscriptionCredentialRow>(
      `
        ${this.clientSubscriptionCredentialSelectSql()}
        WHERE csc.client_config_id = $1
          AND o.route_group = $2
          AND csc.status = 'active'
          AND csc.revoked_at IS NULL
        ORDER BY csc.created_at DESC
      `,
      [clientConfigId, routeGroup],
    );

    return result.rows;
  }

  private clientSubscriptionCredentialSelectSql(): string {
    return `
      SELECT
        csc.id,
        csc.client_config_id AS "clientConfigId",
        cc.customer_account_id AS "customerAccountId",
        csc.outbound_id AS "outboundId",
        o.name AS "outboundName",
        csc.protocol,
        csc.name,
        csc.encrypted_payload AS "encryptedPayload",
        csc.key_id AS "keyId",
        csc.public_metadata AS "publicMetadata",
        csc.status,
        csc.created_by AS "createdBy",
        csc.last_used_at AS "lastUsedAt",
        csc.last_rotated_at AS "lastRotatedAt",
        csc.revoked_at AS "revokedAt",
        csc.created_at AS "createdAt",
        csc.updated_at AS "updatedAt"
      FROM client_subscription_credentials csc
      JOIN client_configs cc ON cc.id = csc.client_config_id
      JOIN outbounds o ON o.id = csc.outbound_id
    `;
  }

  private async getOutboundForSubscriptionCredential(
    executor: DatabaseQueryExecutor,
    outboundId: string,
  ): Promise<{ id: string; type: string; name: string }> {
    const result = await executor.query<{ id: string; type: string; name: string }>(
      `
        SELECT id, type, name
        FROM outbounds
        WHERE id = $1
        FOR SHARE
      `,
      [outboundId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Outbound was not found');
    return row;
  }

  private customerAccountSelectSql(): string {
    return `
      SELECT
        ca.id,
        ca.display_name AS "displayName",
        ca.telegram_id AS "telegramId",
        ca.telegram_username AS "telegramUsername",
        ca.paid_number_hash AS "paidNumberHash",
        ca.status,
        ca.quota_scope AS "quotaScope",
        ca.quota_limit_bytes AS "quotaLimitBytes",
        ca.per_client_limit_bytes AS "perClientLimitBytes",
        ca.used_bytes AS "usedBytes",
        ca.notes,
        ca.created_at AS "createdAt",
        ca.updated_at AS "updatedAt",
        COUNT(cc.id)::int AS "clientCount",
        COUNT(cc.id) FILTER (WHERE cc.status = 'active')::int AS "activeClientCount"
      FROM customer_accounts ca
      LEFT JOIN client_configs cc ON cc.customer_account_id = ca.id
    `;
  }

  private async currentPanelImportSkipReasonCodes(
    executor: DatabaseQueryExecutor,
    customerAccountId: string,
    candidate: CurrentPanelImportCandidate,
  ): Promise<string[]> {
    const reasonCodes: string[] = [];
    const status = this.normalizeNullableString(candidate.status) ?? 'unknown';
    const externalPanel = this.normalizeNullableString(candidate.externalPanel);
    const externalPanelUserId = this.normalizeNullableString(candidate.externalPanelUserId);
    const externalPanelConfigId = this.normalizeNullableString(candidate.externalPanelConfigId);

    if (!candidate.label.trim()) reasonCodes.push('missing_label');
    if (!CURRENT_PANEL_IMPORTABLE_STATUSES.has(status)) reasonCodes.push('unsupported_status');
    if (!externalPanel) reasonCodes.push('missing_external_panel');
    if (
      candidate.deviceLimit !== null &&
      candidate.deviceLimit !== undefined &&
      (!Number.isInteger(candidate.deviceLimit) || candidate.deviceLimit < 1 || candidate.deviceLimit > 1000)
    ) {
      reasonCodes.push('invalid_device_limit');
    }
    if (
      candidate.quotaBytes !== null &&
      candidate.quotaBytes !== undefined &&
      (!Number.isSafeInteger(candidate.quotaBytes) || candidate.quotaBytes < 0 || candidate.quotaBytes > MAX_SAFE_BYTES)
    ) {
      reasonCodes.push('invalid_quota_bytes');
    }
    if (
      candidate.usedBytes !== null &&
      candidate.usedBytes !== undefined &&
      (!Number.isSafeInteger(candidate.usedBytes) || candidate.usedBytes < 0 || candidate.usedBytes > MAX_SAFE_BYTES)
    ) {
      reasonCodes.push('invalid_used_bytes');
    }

    if (reasonCodes.length > 0 || !externalPanel) return reasonCodes;

    if (externalPanelConfigId) {
      const duplicateConfig = await executor.query<{ id: string }>(
        `
          SELECT id
          FROM client_configs
          WHERE external_panel = $1
            AND external_panel_config_id = $2
          LIMIT 1
        `,
        [externalPanel, externalPanelConfigId],
      );
      if (duplicateConfig.rows.length > 0) reasonCodes.push('duplicate_external_config');
      return reasonCodes;
    }

    if (externalPanelUserId) {
      const duplicateUser = await executor.query<{ id: string }>(
        `
          SELECT id
          FROM client_configs
          WHERE customer_account_id = $1
            AND external_panel = $2
            AND external_panel_user_id = $3
          LIMIT 1
        `,
        [customerAccountId, externalPanel, externalPanelUserId],
      );
      if (duplicateUser.rows.length > 0) reasonCodes.push('duplicate_external_user');
    }

    return reasonCodes;
  }

  private async getCurrentPanelUsageSyncClientForUpdate(
    executor: DatabaseQueryExecutor,
    customerAccountId: string,
    candidate: CurrentPanelImportCandidate,
  ): Promise<{ client: ClientConfigRow | null; reasonCodes: string[] }> {
    const externalPanel = this.normalizeNullableString(candidate.externalPanel);
    const externalPanelConfigId = this.normalizeNullableString(candidate.externalPanelConfigId);
    const externalPanelUserId = this.normalizeNullableString(candidate.externalPanelUserId);

    if (!externalPanel) return { client: null, reasonCodes: ['missing_external_panel'] };
    if (!externalPanelConfigId && !externalPanelUserId) return { client: null, reasonCodes: ['missing_external_identity'] };

    if (externalPanelConfigId) {
      const result = await executor.query<ClientConfigRow>(
        `
          SELECT
            id,
            customer_account_id AS "customerAccountId",
            label,
            protocol,
            external_panel AS "externalPanel",
            external_panel_user_id AS "externalPanelUserId",
            external_panel_config_id AS "externalPanelConfigId",
            device_limit AS "deviceLimit",
            quota_limit_bytes AS "quotaLimitBytes",
            used_bytes AS "usedBytes",
            status,
            notes,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM client_configs
          WHERE external_panel = $1
            AND external_panel_config_id = $2
          ORDER BY updated_at DESC
          LIMIT 2
          FOR UPDATE
        `,
        [externalPanel, externalPanelConfigId],
      );

      if (result.rows.length > 1) return { client: null, reasonCodes: ['ambiguous_external_config'] };
      const client = result.rows[0];
      if (client) {
        if (client.customerAccountId !== customerAccountId) return { client: null, reasonCodes: ['client_belongs_to_other_account'] };
        return { client, reasonCodes: [] };
      }
    }

    if (!externalPanelUserId) return { client: null, reasonCodes: ['missing_existing_config'] };
    const result = await executor.query<ClientConfigRow>(
      `
        SELECT
          id,
          customer_account_id AS "customerAccountId",
          label,
          protocol,
          external_panel AS "externalPanel",
          external_panel_user_id AS "externalPanelUserId",
          external_panel_config_id AS "externalPanelConfigId",
          device_limit AS "deviceLimit",
          quota_limit_bytes AS "quotaLimitBytes",
          used_bytes AS "usedBytes",
          status,
          notes,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM client_configs
        WHERE customer_account_id = $1
          AND external_panel = $2
          AND external_panel_user_id = $3
        ORDER BY updated_at DESC
        LIMIT 2
        FOR UPDATE
      `,
      [customerAccountId, externalPanel, externalPanelUserId],
    );

    if (result.rows.length > 1) return { client: null, reasonCodes: ['ambiguous_external_user'] };
    return { client: result.rows[0] ?? null, reasonCodes: result.rows[0] ? [] : ['missing_existing_config'] };
  }

  private async recordPanelSyncUsageDelta(
    executor: DatabaseQueryExecutor,
    client: ClientConfigRow,
    input: {
      adapterVersion: string;
      deltaBytes: number;
      externalReference: string | null;
      idempotencyKey: string;
      metadata: Record<string, unknown>;
      observedAt: Date;
      panelKind: string;
    },
    actor: AuditActor | undefined,
  ): Promise<ClientUsageEventRow | null> {
    const usageEvent = await this.insertClientUsageEvent(
      executor,
      client,
      {
        direction: 'combined',
        externalReference: input.externalReference,
        idempotencyKey: input.idempotencyKey,
        metadata: {
          ...input.metadata,
          adapterVersion: input.adapterVersion,
          panelKind: input.panelKind,
        },
        notes: null,
        observedAt: input.observedAt,
        ratedOutboundId: null,
        ratedOutboundName: null,
        rawUsedBytesDelta: input.deltaBytes,
        rxBytes: null,
        source: 'panel_sync',
        txBytes: null,
        usageMultiplier: 1,
        usedBytesDelta: input.deltaBytes,
        windowEnd: null,
        windowStart: null,
      },
      actor,
    );

    if (!usageEvent) return null;

    await executor.query(
      `
        UPDATE client_configs
        SET used_bytes = used_bytes + $1,
            updated_at = now()
        WHERE id = $2
      `,
      [input.deltaBytes, client.id],
    );

    await executor.query(
      `
        UPDATE customer_accounts
        SET used_bytes = used_bytes + $1,
            updated_at = now()
        WHERE id = $2
      `,
      [input.deltaBytes, client.customerAccountId],
    );

    await this.audit.record(
      actor,
      'client_usage_event.record',
      'client_config',
      client.id,
      {
        customerAccountId: client.customerAccountId,
        currentPanelFlow: input.metadata.currentPanelFlow ?? null,
        externalReference: usageEvent.externalReference,
        hasIdempotencyKey: Boolean(usageEvent.idempotencyKey),
        panelKind: input.panelKind,
        source: 'panel_sync',
        usageEventId: usageEvent.id,
        usedBytesDelta: input.deltaBytes,
      },
      executor,
    );

    return usageEvent;
  }

  private mapSkippedCurrentPanelCandidate(
    candidate: CurrentPanelImportCandidate,
    reasonCodes: string[],
  ): CurrentPanelImportSkippedCandidate {
    return {
      externalPanel: candidate.externalPanel,
      externalPanelConfigId: candidate.externalPanelConfigId ?? null,
      externalPanelUserId: candidate.externalPanelUserId ?? null,
      label: candidate.label,
      reasonCodes,
    };
  }

  private currentPanelImportUsageIdempotencyKey(
    panelKind: string,
    candidate: CurrentPanelImportCandidate,
    clientConfigId: string,
  ): string {
    const identity = candidate.externalPanelConfigId ?? candidate.externalPanelUserId ?? clientConfigId;
    const normalizedIdentity = identity.replace(/\s+/g, '_').slice(0, 180);
    return `current_panel_import:${panelKind}:${candidate.externalPanel}:${normalizedIdentity}:baseline_usage`;
  }

  private currentPanelUsageSyncIdempotencyKey(
    panelKind: string,
    candidate: CurrentPanelImportCandidate,
    targetUsedBytes: number,
    clientConfigId: string,
  ): string {
    const externalPanel = this.normalizeNullableString(candidate.externalPanel) ?? 'unknown_panel';
    const identity = candidate.externalPanelConfigId ?? candidate.externalPanelUserId ?? clientConfigId;
    const normalizedIdentity = identity.replace(/\s+/g, '_').slice(0, 150);
    return `current_panel_usage_sync:${panelKind}:${externalPanel}:${normalizedIdentity}:${targetUsedBytes}`;
  }

  private async ensureCustomerAccountExists(executor: DatabaseQueryExecutor, id: string): Promise<void> {
    const result = await executor.query('SELECT id FROM customer_accounts WHERE id = $1', [id]);
    if (!result.rows.length) throw new NotFoundException('Customer account not found');
  }

  private async getClientConfigRow(id: string): Promise<ClientConfigRow> {
    const result = await this.database.query<ClientConfigRow>(
      `
        SELECT
          id,
          customer_account_id AS "customerAccountId",
          label,
          protocol,
          external_panel AS "externalPanel",
          external_panel_user_id AS "externalPanelUserId",
          external_panel_config_id AS "externalPanelConfigId",
          device_limit AS "deviceLimit",
          quota_limit_bytes AS "quotaLimitBytes",
          used_bytes AS "usedBytes",
          status,
          notes,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM client_configs
        WHERE id = $1
      `,
      [id],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Client config not found');
    return row;
  }

  private async getClientConfigRowForUpdate(executor: DatabaseQueryExecutor, id: string): Promise<ClientConfigRow> {
    const result = await executor.query<ClientConfigRow>(
      `
        SELECT
          id,
          customer_account_id AS "customerAccountId",
          label,
          protocol,
          external_panel AS "externalPanel",
          external_panel_user_id AS "externalPanelUserId",
          external_panel_config_id AS "externalPanelConfigId",
          device_limit AS "deviceLimit",
          quota_limit_bytes AS "quotaLimitBytes",
          used_bytes AS "usedBytes",
          status,
          notes,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM client_configs
        WHERE id = $1
        FOR UPDATE
      `,
      [id],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Client config not found');
    return row;
  }

  private async lockCustomerAccount(executor: DatabaseQueryExecutor, id: string): Promise<void> {
    const result = await executor.query('SELECT id FROM customer_accounts WHERE id = $1 FOR UPDATE', [id]);
    if (!result.rows.length) throw new NotFoundException('Customer account not found');
  }

  private async getClientUsageEventByIdempotency(
    executor: DatabaseQueryExecutor,
    source: string,
    idempotencyKey: string,
  ): Promise<ClientUsageEventRow | null> {
    const result = await executor.query<ClientUsageEventRow>(
      `
        ${this.clientUsageEventSelectSql()}
        WHERE source = $1 AND idempotency_key = $2
        FOR UPDATE
      `,
      [source, idempotencyKey],
    );

    return result.rows[0] ?? null;
  }

  private async rateClientUsageEvent(
    executor: DatabaseQueryExecutor,
    input: NormalizedClientUsageEventInput,
  ): Promise<NormalizedClientUsageEventInput> {
    if (!input.ratedOutboundId) return input;

    const result = await executor.query<RatedOutboundRow>(
      `
        SELECT
          id,
          name,
          usage_multiplier AS "usageMultiplier"
        FROM outbounds
        WHERE id = $1
      `,
      [input.ratedOutboundId],
    );
    const outbound = result.rows[0];
    if (!outbound) throw new BadRequestException('Rated outbound was not found');

    const multiplier = this.normalizeUsageMultiplier(outbound.usageMultiplier);
    const usedBytesDelta = input.rawUsedBytesDelta * multiplier;
    if (!Number.isSafeInteger(usedBytesDelta) || usedBytesDelta > MAX_SAFE_BYTES) {
      throw new BadRequestException('Rated usage exceeds the safe billing limit');
    }

    return {
      ...input,
      usedBytesDelta,
      usageMultiplier: multiplier,
      ratedOutboundId: outbound.id,
      ratedOutboundName: outbound.name,
      metadata: {
        ...input.metadata,
        rawUsedBytesDelta: input.rawUsedBytesDelta,
        usageMultiplier: multiplier,
        ratedOutboundId: outbound.id,
      },
    };
  }

  private async insertClientUsageEvent(
    executor: DatabaseQueryExecutor,
    client: ClientConfigRow,
    input: NormalizedClientUsageEventInput,
    actor: AuditActor | undefined,
  ): Promise<ClientUsageEventRow | null> {
    const result = await executor.query<ClientUsageEventRow>(
      `
        INSERT INTO client_usage_events (
          customer_account_id, client_config_id, source, direction,
          used_bytes_delta, raw_used_bytes_delta, usage_multiplier, rated_outbound_id,
          rx_bytes, tx_bytes, observed_at, window_start, window_end,
          idempotency_key, external_reference, notes, metadata, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18)
        ON CONFLICT (source, idempotency_key)
          WHERE idempotency_key IS NOT NULL AND idempotency_key <> ''
          DO NOTHING
        RETURNING
          id,
          customer_account_id AS "customerAccountId",
          client_config_id AS "clientConfigId",
          source,
          direction,
          used_bytes_delta AS "usedBytesDelta",
          raw_used_bytes_delta AS "rawUsedBytesDelta",
          usage_multiplier AS "usageMultiplier",
          rated_outbound_id AS "ratedOutboundId",
          (
            SELECT name
            FROM outbounds
            WHERE id = client_usage_events.rated_outbound_id
          ) AS "ratedOutboundName",
          rx_bytes AS "rxBytes",
          tx_bytes AS "txBytes",
          observed_at AS "observedAt",
          window_start AS "windowStart",
          window_end AS "windowEnd",
          idempotency_key AS "idempotencyKey",
          external_reference AS "externalReference",
          notes,
          metadata,
          created_by AS "createdBy",
          created_at AS "createdAt"
      `,
      [
        client.customerAccountId,
        client.id,
        input.source,
        input.direction,
        input.usedBytesDelta,
        input.rawUsedBytesDelta,
        input.usageMultiplier,
        input.ratedOutboundId,
        input.rxBytes,
        input.txBytes,
        input.observedAt,
        input.windowStart,
        input.windowEnd,
        input.idempotencyKey,
        input.externalReference,
        input.notes,
        this.stringifyPublicRecord(input.metadata, 'Usage event metadata'),
        actor?.id ?? null,
      ],
    );

    return result.rows[0];
  }

  private clientUsageEventSelectSql(): string {
    return `
      SELECT
        id,
        customer_account_id AS "customerAccountId",
        client_config_id AS "clientConfigId",
        source,
        direction,
        used_bytes_delta AS "usedBytesDelta",
        raw_used_bytes_delta AS "rawUsedBytesDelta",
        usage_multiplier AS "usageMultiplier",
        rated_outbound_id AS "ratedOutboundId",
        (
          SELECT name
          FROM outbounds
          WHERE id = client_usage_events.rated_outbound_id
        ) AS "ratedOutboundName",
        rx_bytes AS "rxBytes",
        tx_bytes AS "txBytes",
        observed_at AS "observedAt",
        window_start AS "windowStart",
        window_end AS "windowEnd",
        idempotency_key AS "idempotencyKey",
        external_reference AS "externalReference",
        notes,
        metadata,
        created_by AS "createdBy",
        created_at AS "createdAt"
      FROM client_usage_events
    `;
  }

  private async createRewardedAdGrantForClient(input: {
    clientConfigId: string;
    customerAccountId?: string | null;
    provider?: string | null;
    adSessionId?: string | null;
    idempotencyKey?: string | null;
    metadata: Record<string, unknown>;
    auditActor?: AuditActor | undefined;
    requiredVerificationModes?: string[];
    strictProviderMatch?: boolean;
  }): Promise<RewardedAdGrantCreateState> {
    const today = this.currentUtcDay();

    return this.database.transaction(async (executor) => {
      const settings = await this.getRewardedAdSettings(executor);
      if (!settings.enabled) throw new ForbiddenException('Rewarded ad grants are disabled');
      if (settings.dailyLimit <= 0) throw new ForbiddenException('Rewarded ad daily limit is zero');
      if (
        input.requiredVerificationModes?.length &&
        !input.requiredVerificationModes.includes(settings.verificationMode)
      ) {
        throw new ForbiddenException('Rewarded ad signed webhooks are not enabled');
      }

      const provider = this.normalizeRewardedAdProvider(input.provider, settings.provider);
      if (input.strictProviderMatch && provider !== settings.provider) {
        throw new BadRequestException('Rewarded ad provider does not match active settings');
      }

      const adSessionId = this.normalizeNullableString(input.adSessionId);
      const idempotencyKey = this.normalizeNullableString(input.idempotencyKey) ?? adSessionId;
      if (!idempotencyKey) {
        throw new BadRequestException('Rewarded ad claim requires an idempotency key or ad session id');
      }

      const existingForKey = await this.getRewardedAdGrantByIdempotencyForUpdate(
        executor,
        input.clientConfigId,
        provider,
        idempotencyKey,
      );
      if (existingForKey) {
        return {
          grant: existingForKey,
          duplicate: true,
          clientConfigId: existingForKey.clientConfigId,
          customerAccountId: existingForKey.customerAccountId,
          provider,
        };
      }

      if (adSessionId) {
        const existingForSession = await this.getRewardedAdGrantBySessionForUpdate(executor, provider, adSessionId);
        if (existingForSession) {
          if (existingForSession.clientConfigId !== input.clientConfigId) {
            throw new ConflictException('Rewarded ad session already belongs to another client');
          }

          return {
            grant: existingForSession,
            duplicate: true,
            clientConfigId: existingForSession.clientConfigId,
            customerAccountId: existingForSession.customerAccountId,
            provider,
          };
        }
      }

      const client = await this.getClientConfigRowForUpdate(executor, input.clientConfigId);
      const customerAccountId = input.customerAccountId ?? client.customerAccountId;
      if (client.customerAccountId !== customerAccountId) {
        throw new ForbiddenException('Client token does not match this account');
      }

      const account = await this.getCustomerAccountRowForUpdate(executor, customerAccountId);
      if (account.status !== 'active') throw new ForbiddenException('Rewarded ad grants require an active account');
      if (!['active', 'limited'].includes(client.status)) {
        throw new ForbiddenException('Rewarded ad grants are not available for this client status');
      }

      const watchedToday = await this.countRewardedAdGrants(input.clientConfigId, today, executor);
      if (watchedToday >= settings.dailyLimit) {
        throw new BadRequestException('Rewarded ad daily limit reached');
      }

      const rewardBytes = this.numberFromBigInt(settings.rewardBytes) ?? DEFAULT_REWARDED_AD_REWARD_BYTES;
      if (rewardBytes <= 0) throw new BadRequestException('Rewarded ad reward amount must be positive');

      const accountQuotaBeforeBytes = this.numberFromBigInt(account.quotaLimitBytes);
      const accountUsedBytes = this.numberFromBigInt(account.usedBytes) ?? 0;
      const accountQuotaAfterBytes = (accountQuotaBeforeBytes ?? accountUsedBytes) + rewardBytes;
      if (!Number.isSafeInteger(accountQuotaAfterBytes) || accountQuotaAfterBytes > MAX_SAFE_BYTES) {
        throw new BadRequestException('Rewarded ad account quota would exceed the safe byte limit');
      }

      const clientQuotaBeforeBytes = this.numberFromBigInt(client.quotaLimitBytes);
      const perClientLimitBytes = this.numberFromBigInt(account.perClientLimitBytes);
      const clientUsedBytes = this.numberFromBigInt(client.usedBytes) ?? 0;
      const shouldCreditClientQuota =
        account.quotaScope === 'per_client' || clientQuotaBeforeBytes !== null || perClientLimitBytes !== null;
      const clientQuotaAfterBytes = shouldCreditClientQuota
        ? (clientQuotaBeforeBytes ?? perClientLimitBytes ?? clientUsedBytes) + rewardBytes
        : null;
      if (
        clientQuotaAfterBytes !== null &&
        (!Number.isSafeInteger(clientQuotaAfterBytes) || clientQuotaAfterBytes > MAX_SAFE_BYTES)
      ) {
        throw new BadRequestException('Rewarded ad client quota would exceed the safe byte limit');
      }

      const grant = await this.insertRewardedAdGrant(
        executor,
        {
          customerAccountId,
          clientConfigId: input.clientConfigId,
          grantDay: today,
          dailyGrantNumber: watchedToday + 1,
          provider,
          adSessionId,
          idempotencyKey,
          rewardBytes,
          accountQuotaBeforeBytes,
          accountQuotaAfterBytes,
          clientQuotaBeforeBytes,
          clientQuotaAfterBytes,
          verificationMode: settings.verificationMode,
          metadata: input.metadata,
        },
      );

      await executor.query(
        `
          UPDATE customer_accounts
          SET quota_limit_bytes = $1,
              updated_at = now()
          WHERE id = $2
        `,
        [accountQuotaAfterBytes, customerAccountId],
      );

      if (clientQuotaAfterBytes !== null) {
        await executor.query(
          `
            UPDATE client_configs
            SET quota_limit_bytes = $1,
                updated_at = now()
            WHERE id = $2
          `,
          [clientQuotaAfterBytes, input.clientConfigId],
        );
      }

      await this.audit.record(
        input.auditActor,
        'rewarded_ad.grant_quota',
        'client_config',
        input.clientConfigId,
        {
          customerAccountId,
          grantId: grant.id,
          provider,
          rewardBytes,
          dailyGrantNumber: watchedToday + 1,
          dailyLimit: settings.dailyLimit,
          accountQuotaBeforeBytes,
          accountQuotaAfterBytes,
          clientQuotaBeforeBytes,
          clientQuotaAfterBytes,
          verificationMode: settings.verificationMode,
          signedWebhook: Boolean(input.metadata.signedWebhook),
        },
        executor,
      );

      return {
        grant,
        duplicate: false,
        clientConfigId: input.clientConfigId,
        customerAccountId,
        provider,
      };
    });
  }

  private async getRewardedAdSettings(
    executor: DatabaseQueryExecutor = this.database,
    forUpdate = false,
  ): Promise<RewardedAdSettingsRow> {
    const result = await executor.query<RewardedAdSettingsRow>(
      `
        SELECT
          setting_key AS "settingKey",
          enabled,
          reward_bytes AS "rewardBytes",
          daily_limit AS "dailyLimit",
          provider,
          verification_mode AS "verificationMode",
          updated_by AS "updatedBy",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM rewarded_ad_settings
        WHERE setting_key = 'default'
        ${forUpdate ? 'FOR UPDATE' : ''}
      `,
    );

    return result.rows[0] ?? {
      settingKey: 'default',
      enabled: true,
      rewardBytes: DEFAULT_REWARDED_AD_REWARD_BYTES,
      dailyLimit: DEFAULT_REWARDED_AD_DAILY_LIMIT,
      provider: DEFAULT_REWARDED_AD_PROVIDER,
      verificationMode: DEFAULT_REWARDED_AD_VERIFICATION_MODE,
      updatedBy: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
  }

  private async ensureRewardedAdSettingsRow(executor: DatabaseQueryExecutor): Promise<void> {
    await executor.query(
      `
        INSERT INTO rewarded_ad_settings (setting_key)
        VALUES ('default')
        ON CONFLICT (setting_key) DO NOTHING
      `,
    );
  }

  private async countRewardedAdGrants(
    clientConfigId: string,
    grantDay: string,
    executor: DatabaseQueryExecutor = this.database,
  ): Promise<number> {
    const result = await executor.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM rewarded_ad_grants
        WHERE client_config_id = $1
          AND grant_day = $2::date
      `,
      [clientConfigId, grantDay],
    );

    return Number(result.rows[0]?.count ?? 0);
  }

  private async getRewardedAdGrantByIdempotencyForUpdate(
    executor: DatabaseQueryExecutor,
    clientConfigId: string,
    provider: string,
    idempotencyKey: string,
  ): Promise<RewardedAdGrantRow | null> {
    const result = await executor.query<RewardedAdGrantRow>(
      `${this.rewardedAdGrantSelectSql()} WHERE client_config_id = $1 AND provider = $2 AND idempotency_key = $3 FOR UPDATE`,
      [clientConfigId, provider, idempotencyKey],
    );

    return result.rows[0] ?? null;
  }

  private async getRewardedAdGrantBySessionForUpdate(
    executor: DatabaseQueryExecutor,
    provider: string,
    adSessionId: string,
  ): Promise<RewardedAdGrantRow | null> {
    const result = await executor.query<RewardedAdGrantRow>(
      `${this.rewardedAdGrantSelectSql()} WHERE provider = $1 AND ad_session_id = $2 FOR UPDATE`,
      [provider, adSessionId],
    );

    return result.rows[0] ?? null;
  }

  private async insertRewardedAdGrant(
    executor: DatabaseQueryExecutor,
    input: {
      customerAccountId: string;
      clientConfigId: string;
      grantDay: string;
      dailyGrantNumber: number;
      provider: string;
      adSessionId: string | null;
      idempotencyKey: string;
      rewardBytes: number;
      accountQuotaBeforeBytes: number | null;
      accountQuotaAfterBytes: number;
      clientQuotaBeforeBytes: number | null;
      clientQuotaAfterBytes: number | null;
      verificationMode: string;
      metadata: Record<string, unknown>;
    },
  ): Promise<RewardedAdGrantRow> {
    const result = await executor.query<RewardedAdGrantRow>(
      `
        INSERT INTO rewarded_ad_grants (
          customer_account_id, client_config_id, grant_day, daily_grant_number,
          provider, ad_session_id, idempotency_key, reward_bytes,
          account_quota_before_bytes, account_quota_after_bytes,
          client_quota_before_bytes, client_quota_after_bytes,
          verification_mode, metadata
        )
        VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
        RETURNING
          id,
          customer_account_id AS "customerAccountId",
          client_config_id AS "clientConfigId",
          grant_day AS "grantDay",
          daily_grant_number AS "dailyGrantNumber",
          provider,
          ad_session_id AS "adSessionId",
          idempotency_key AS "idempotencyKey",
          reward_bytes AS "rewardBytes",
          account_quota_before_bytes AS "accountQuotaBeforeBytes",
          account_quota_after_bytes AS "accountQuotaAfterBytes",
          client_quota_before_bytes AS "clientQuotaBeforeBytes",
          client_quota_after_bytes AS "clientQuotaAfterBytes",
          verification_mode AS "verificationMode",
          metadata,
          created_at AS "createdAt"
      `,
      [
        input.customerAccountId,
        input.clientConfigId,
        input.grantDay,
        input.dailyGrantNumber,
        input.provider,
        input.adSessionId,
        input.idempotencyKey,
        input.rewardBytes,
        input.accountQuotaBeforeBytes,
        input.accountQuotaAfterBytes,
        input.clientQuotaBeforeBytes,
        input.clientQuotaAfterBytes,
        input.verificationMode,
        this.stringifyPublicRecord(input.metadata, 'Rewarded ad metadata'),
      ],
    );

    return result.rows[0];
  }

  private rewardedAdGrantSelectSql(): string {
    return `
      SELECT
        id,
        customer_account_id AS "customerAccountId",
        client_config_id AS "clientConfigId",
        grant_day AS "grantDay",
        daily_grant_number AS "dailyGrantNumber",
        provider,
        ad_session_id AS "adSessionId",
        idempotency_key AS "idempotencyKey",
        reward_bytes AS "rewardBytes",
        account_quota_before_bytes AS "accountQuotaBeforeBytes",
        account_quota_after_bytes AS "accountQuotaAfterBytes",
        client_quota_before_bytes AS "clientQuotaBeforeBytes",
        client_quota_after_bytes AS "clientQuotaAfterBytes",
        verification_mode AS "verificationMode",
        metadata,
        created_at AS "createdAt"
      FROM rewarded_ad_grants
    `;
  }

  private async getClientRoutePreferenceRowForUpdate(
    executor: DatabaseQueryExecutor,
    clientConfigId: string,
    routeGroup: string,
  ): Promise<ClientRoutePreferenceRow | null> {
    const result = await executor.query<ClientRoutePreferenceRow>(
      `${this.clientRoutePreferenceSelectSql(false)} FOR UPDATE OF crp`,
      [clientConfigId, routeGroup],
    );

    return result.rows[0] ?? null;
  }

  private clientRoutePreferenceSelectSql(includeMissingClient = false): string {
    const joinType = includeMissingClient ? 'LEFT JOIN' : 'JOIN';
    return `
      SELECT
        crp.id,
        cc.id AS "clientConfigId",
        cc.customer_account_id AS "customerAccountId",
        cc.label AS "clientLabel",
        crp.route_group AS "routeGroup",
        crp.mode,
        crp.detected_country_code AS "detectedCountryCode",
        crp.detected_country_source AS "detectedCountrySource",
        crp.preferred_exit_country_code AS "preferredExitCountryCode",
        crp.preferred_outbound_id AS "preferredOutboundId",
        po.name AS "preferredOutboundName",
        po.route_group AS "preferredOutboundRouteGroup",
        crp.score_profile AS "scoreProfile",
        crp.auto_detect_country AS "autoDetectCountry",
        crp.allow_client_override AS "allowClientOverride",
        crp.route_locked AS "routeLocked",
        crp.sticky_session_protection AS "stickySessionProtection",
        crp.last_detected_at AS "lastDetectedAt",
        crp.created_by AS "createdBy",
        crp.created_at AS "createdAt",
        crp.updated_at AS "updatedAt"
      FROM client_route_preferences crp
      ${joinType} client_configs cc ON cc.id = crp.client_config_id
      LEFT JOIN outbounds po ON po.id = crp.preferred_outbound_id
      WHERE crp.client_config_id = $1 AND crp.route_group = $2
    `;
  }

  private async ensurePreferredOutbound(
    executor: DatabaseQueryExecutor,
    outboundId: string,
    routeGroup: string,
  ): Promise<PreferredOutboundRow> {
    const result = await executor.query<PreferredOutboundRow>(
      `
        SELECT id, name, route_group AS "routeGroup"
        FROM outbounds
        WHERE id = $1
      `,
      [outboundId],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Preferred outbound not found');
    if (row.routeGroup !== routeGroup) {
      throw new BadRequestException('Preferred outbound must belong to the same route group');
    }

    return row;
  }

  private async getClientPortalRow(actor: ClientAuthActor): Promise<ClientPortalRow> {
    const result = await this.database.query<ClientPortalRow>(
      `
        SELECT
          ca.id AS "customerAccountId",
          ca.display_name AS "accountDisplayName",
          ca.status AS "accountStatus",
          ca.quota_scope AS "quotaScope",
          ca.quota_limit_bytes AS "accountQuotaLimitBytes",
          ca.used_bytes AS "accountUsedBytes",
          ca.per_client_limit_bytes AS "perClientLimitBytes",
          cc.id AS "clientConfigId",
          cc.label AS "clientLabel",
          cc.protocol,
          cc.device_limit AS "deviceLimit",
          cc.quota_limit_bytes AS "clientQuotaLimitBytes",
          cc.used_bytes AS "clientUsedBytes",
          cc.status AS "clientStatus"
        FROM client_configs cc
        JOIN customer_accounts ca ON ca.id = cc.customer_account_id
        WHERE cc.id = $1
          AND cc.customer_account_id = $2
      `,
      [actor.clientConfigId, actor.customerAccountId],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Client profile not found');
    return row;
  }

  private async ensureClientSelectableOutbound(outboundId: string, routeGroup: string): Promise<void> {
    const result = await this.database.query<ClientRouteOptionOutboundRow>(
      `
        SELECT
          id,
          name,
          type,
          route_group AS "routeGroup",
          NULL::text AS "countryCode",
          NULL::text AS "region",
          health_status AS "healthStatus",
          enabled,
          maintenance_mode AS "maintenanceMode"
        FROM outbounds
        WHERE id = $1
      `,
      [outboundId],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Preferred outbound not found');
    if (row.routeGroup !== routeGroup) throw new BadRequestException('Preferred outbound must belong to the same route group');
    if (!row.enabled || row.maintenanceMode || row.healthStatus === 'critical') {
      throw new BadRequestException('Preferred outbound is not available for client selection');
    }
  }

  private mapClientRewardedAdStatus(settings: RewardedAdSettingsRow, watchedToday: number): ClientRewardedAdStatus {
    const rewardBytes = this.numberFromBigInt(settings.rewardBytes) ?? DEFAULT_REWARDED_AD_REWARD_BYTES;
    const dailyLimit = Math.max(settings.dailyLimit, 0);

    return {
      enabled: settings.enabled,
      rewardBytes,
      dailyLimit,
      watchedToday,
      remainingToday: Math.max(dailyLimit - watchedToday, 0),
      nextResetAt: this.nextUtcResetAt(),
      provider: settings.provider || DEFAULT_REWARDED_AD_PROVIDER,
      verificationMode: settings.verificationMode || DEFAULT_REWARDED_AD_VERIFICATION_MODE,
    };
  }

  private mapRewardedAdGrant(row: RewardedAdGrantRow): ClientRewardedAdGrantSummary {
    return {
      id: row.id,
      customerAccountId: row.customerAccountId,
      clientConfigId: row.clientConfigId,
      grantDay: this.formatGrantDay(row.grantDay),
      dailyGrantNumber: row.dailyGrantNumber,
      provider: row.provider,
      adSessionId: row.adSessionId,
      idempotencyKey: row.idempotencyKey,
      rewardBytes: this.numberFromBigInt(row.rewardBytes) ?? 0,
      accountQuotaBeforeBytes: this.numberFromBigInt(row.accountQuotaBeforeBytes),
      accountQuotaAfterBytes: this.numberFromBigInt(row.accountQuotaAfterBytes) ?? 0,
      clientQuotaBeforeBytes: this.numberFromBigInt(row.clientQuotaBeforeBytes),
      clientQuotaAfterBytes: this.numberFromBigInt(row.clientQuotaAfterBytes),
      verificationMode: row.verificationMode,
      metadata: row.metadata ?? {},
      createdAt: row.createdAt.toISOString(),
    };
  }

  private mapClientAccessToken(row: ClientAccessTokenRow): ClientAccessTokenSummary {
    return {
      id: row.id,
      clientConfigId: row.clientConfigId,
      name: row.name,
      scopes: this.normalizeScopes(row.scopes),
      status: row.revokedAt ? 'revoked' : 'active',
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
    };
  }

  private mapClientSubscriptionCredential(
    row: ClientSubscriptionCredentialRow,
  ): AdminClientSubscriptionCredentialSummary {
    return {
      id: row.id,
      clientConfigId: row.clientConfigId,
      customerAccountId: row.customerAccountId,
      outboundId: row.outboundId,
      outboundName: row.outboundName,
      protocol: row.protocol,
      name: row.name,
      status: row.revokedAt ? 'revoked' : row.status,
      publicMetadata: this.asRecord(row.publicMetadata) ?? {},
      hasSecretMaterial: true,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      lastRotatedAt: row.lastRotatedAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
    };
  }

  private mapClientRoutePreferenceForClient(
    row: AdminClientRoutePreferenceSummary,
  ): ClientRoutePreferenceSummary {
    return {
      routeGroup: row.routeGroup,
      assignmentKey: row.assignmentKey,
      mode: row.mode,
      detectedCountryCode: row.detectedCountryCode ?? null,
      detectedCountrySource: row.detectedCountrySource ?? null,
      preferredExitCountryCode: row.preferredExitCountryCode ?? null,
      preferredOutboundId: row.preferredOutboundId ?? null,
      preferredOutboundName: row.preferredOutboundName ?? null,
      scoreProfile: row.scoreProfile,
      autoDetectCountry: row.autoDetectCountry,
      allowClientOverride: row.allowClientOverride,
      routeLocked: row.routeLocked,
      stickySessionProtection: row.stickySessionProtection,
      lastDetectedAt: row.lastDetectedAt ?? null,
      updatedAt: row.updatedAt ?? null,
    };
  }

  private assertClientScope(actor: ClientAuthActor, scope: string): void {
    if (!actor.scopes.includes(scope)) {
      throw new ForbiddenException('Client token does not allow this action');
    }
  }

  private normalizeScopes(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((scope): scope is string => typeof scope === 'string' && scope.length > 0))];
  }

  private normalizeRewardedAdProvider(value: string | null | undefined, fallback: string): string {
    const normalized = this.normalizeNullableString(value)?.toLowerCase().replace(/[^a-z0-9_.:-]/g, '_');
    const provider = normalized || fallback || DEFAULT_REWARDED_AD_PROVIDER;
    if (!provider || provider.length > 80) throw new BadRequestException('Rewarded ad provider is invalid');
    return provider;
  }

  private normalizeRewardedAdSettingsToken(value: string | null | undefined, label: string): string {
    const normalized = this.normalizeNullableString(value)?.toLowerCase().replace(/[^a-z0-9_.:-]/g, '_');
    if (!normalized || normalized.length > 80) throw new BadRequestException(`${label} is invalid`);
    return normalized;
  }

  private assertRewardedAdSettingsLimits(rewardBytes: number, dailyLimit: number): void {
    if (!Number.isSafeInteger(rewardBytes) || rewardBytes <= 0 || rewardBytes > MAX_REWARDED_AD_REWARD_BYTES) {
      throw new BadRequestException('Rewarded ad reward amount is outside the allowed range');
    }
    if (!Number.isInteger(dailyLimit) || dailyLimit < 0 || dailyLimit > MAX_REWARDED_AD_DAILY_LIMIT) {
      throw new BadRequestException('Rewarded ad daily limit is outside the allowed range');
    }
  }

  private currentUtcDay(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private nextUtcResetAt(): string {
    const now = new Date();
    const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return reset.toISOString();
  }

  private formatGrantDay(value: string | Date): string {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return value.slice(0, 10);
  }

  private createClientAccessToken(): string {
    return `afg_client_${randomBytes(32).toString('base64url')}`;
  }

  private clientRouteHealthRank(status: string): number {
    if (status === 'healthy') return 0;
    if (status === 'degraded') return 1;
    if (status === 'unknown') return 2;
    return 3;
  }

  private async getClientChargedRemainingBytes(actor: ClientAuthActor): Promise<number | null> {
    const profile = await this.getClientPortalRow(actor);
    const accountQuotaLimitBytes = this.numberFromBigInt(profile.accountQuotaLimitBytes);
    const accountUsedBytes = this.numberFromBigInt(profile.accountUsedBytes) ?? 0;
    const perClientLimitBytes = this.numberFromBigInt(profile.perClientLimitBytes);
    const clientQuotaLimitBytes = this.numberFromBigInt(profile.clientQuotaLimitBytes);
    const clientUsedBytes = this.numberFromBigInt(profile.clientUsedBytes) ?? 0;
    const effectiveClientQuotaLimitBytes = clientQuotaLimitBytes ?? perClientLimitBytes;

    return this.minNullableBytes([
      this.remainingBytes(accountQuotaLimitBytes, accountUsedBytes),
      this.remainingBytes(effectiveClientQuotaLimitBytes, clientUsedBytes),
    ]);
  }

  private publicSubscriptionEndpoint(
    row: ClientRouteOptionOutboundRow,
    chargedRemainingBytes: number | null,
  ): ClientSubscriptionEndpointSummary | null {
    const config = this.asRecord(row.config) ?? {};
    const address = this.firstSafeEndpointString(config, [
      'subscriptionAddress',
      'clientAddress',
      'publicAddress',
      'publicEndpoint',
      'endpoint',
    ]);
    const host = this.firstSafeEndpointString(config, [
      'subscriptionHost',
      'clientHost',
      'publicHost',
      'host',
    ]);
    const port = this.firstSafeEndpointNumber(config, [
      'subscriptionPort',
      'clientPort',
      'publicPort',
      'port',
    ]);
    const transport = this.firstSafeEndpointString(config, [
      'transport',
      'network',
      'protocolTransport',
    ]);

    if (!address && !host) return null;

    return {
      outboundId: row.id,
      name: row.name,
      type: row.type,
      routeGroup: row.routeGroup,
      countryCode: row.countryCode,
      region: row.region,
      healthStatus: row.healthStatus,
      usageMultiplier: this.normalizeUsageMultiplier(row.usageMultiplier),
      chargeLabel: this.usageMultiplierLabel(row.usageMultiplier),
      address,
      host,
      port,
      transport,
      updatedAt: row.updatedAt.toISOString(),
      usableBytesAtMultiplier: this.bytesAtMultiplier(chargedRemainingBytes, row.usageMultiplier),
    };
  }

  private subscriptionConfigLink(
    outbound: ClientRouteOptionsResponse['outbounds'][number],
    credential: ClientSubscriptionCredentialRow | null,
  ): ClientSubscriptionConfigLinkSummary {
    const endpoint = outbound.subscriptionEndpoint ?? null;
    const protocol = this.normalizeSubscriptionProtocol(outbound.type);
    const format = this.subscriptionConfigFormat(protocol);
    const supported = ['wireguard', 'vless', 'l2tp', 'ikev2'].includes(protocol);
    const hasPublicEndpoint = Boolean(endpoint?.address || endpoint?.host);
    const base = {
      outboundId: outbound.id,
      name: outbound.name,
      type: outbound.type,
      routeGroup: outbound.routeGroup,
      countryCode: outbound.countryCode,
      region: outbound.region,
      usageMultiplier: outbound.usageMultiplier,
      chargeLabel: outbound.chargeLabel,
      address: endpoint?.address ?? null,
      host: endpoint?.host ?? null,
      port: endpoint?.port ?? null,
      transport: endpoint?.transport ?? null,
      format,
      uri: null,
      configText: null,
      credentialId: credential?.id ?? null,
      renderedAt: null,
      sensitive: false,
      updatedAt: endpoint?.updatedAt ?? null,
      usableBytesAtMultiplier: outbound.usableBytesAtMultiplier ?? endpoint?.usableBytesAtMultiplier ?? null,
    };

    if (!supported) {
      return {
        ...base,
        renderStatus: 'unsupported_protocol',
        profile: endpoint ? this.subscriptionPublicProfile(protocol, outbound, endpoint) : undefined,
        missingFields: [],
        warnings: ['unsupported_protocol'],
        requiresClientSecret: false,
      };
    }

    if (!hasPublicEndpoint || !endpoint) {
      return {
        ...base,
        renderStatus: 'missing_public_config',
        missingFields: ['public_endpoint_or_host'],
        warnings: ['publish_explicit_public_endpoint_metadata'],
        requiresClientSecret: true,
      };
    }

    if (!credential) {
      return {
        ...base,
        renderStatus: 'blocked_secret_required',
        profile: this.subscriptionPublicProfile(protocol, outbound, endpoint),
        missingFields: this.subscriptionSecretMissingFields(protocol),
        warnings: ['per_client_secret_credential_required'],
        requiresClientSecret: true,
      };
    }

    const rendered = this.renderClientSubscriptionCredential(protocol, outbound, endpoint, credential);
    if (rendered.status !== 'rendered') {
      return {
        ...base,
        credentialId: credential.id,
        renderStatus: rendered.status,
        profile: this.subscriptionPublicProfile(protocol, outbound, endpoint),
        missingFields: rendered.missingFields,
        warnings: rendered.warnings,
        requiresClientSecret: true,
      };
    }

    return {
      ...base,
      renderStatus: 'rendered',
      uri: rendered.uri,
      configText: rendered.configText,
      credentialId: credential.id,
      renderedAt: new Date().toISOString(),
      profile: this.subscriptionPublicProfile(protocol, outbound, endpoint),
      missingFields: [],
      warnings: ['contains_authenticated_client_secret_material'],
      requiresClientSecret: false,
      sensitive: true,
    };
  }

  private normalizeSubscriptionProtocol(type: string): string {
    const normalized = type.trim().toLowerCase();
    if (normalized === 'vless-local-proxy') return 'vless';
    return normalized;
  }

  private subscriptionConfigFormat(protocol: string): string {
    if (protocol === 'wireguard') return 'wireguard-profile';
    if (protocol === 'vless') return 'vless-uri';
    if (protocol === 'l2tp') return 'l2tp-profile';
    if (protocol === 'ikev2') return 'ikev2-profile';
    return 'manual-profile';
  }

  private subscriptionSecretMissingFields(protocol: string): string[] {
    if (protocol === 'wireguard') return ['client_private_key', 'client_public_key', 'peer_public_key'];
    if (protocol === 'vless') return ['client_uuid'];
    if (protocol === 'l2tp') return ['username', 'password_or_psk'];
    if (protocol === 'ikev2') return ['client_identity_or_certificate'];
    return [];
  }

  private renderClientSubscriptionCredential(
    protocol: string,
    outbound: ClientRouteOptionsResponse['outbounds'][number],
    endpoint: ClientSubscriptionEndpointSummary,
    credential: ClientSubscriptionCredentialRow,
  ): ClientSubscriptionCredentialRenderResult {
    let secretMaterial: Record<string, unknown>;
    try {
      secretMaterial = this.secretVault.decryptJson(
        credential.encryptedPayload,
        this.clientSubscriptionCredentialEncryptionContext(
          credential.clientConfigId,
          credential.outboundId,
          credential.protocol,
          credential.id,
        ),
      );
    } catch {
      return {
        status: 'blocked_secret_unavailable',
        missingFields: [],
        warnings: ['stored_client_secret_material_unavailable'],
      };
    }

    const publicMetadata = this.asRecord(credential.publicMetadata) ?? {};
    if (protocol === 'wireguard') {
      return this.renderWireGuardClientConfig(endpoint, secretMaterial, publicMetadata);
    }
    if (protocol === 'vless') {
      return this.renderVlessClientUri(outbound, endpoint, secretMaterial, publicMetadata);
    }
    if (protocol === 'l2tp') {
      return this.renderL2tpClientProfile(endpoint, secretMaterial, publicMetadata);
    }
    if (protocol === 'ikev2') {
      return this.renderIkev2ClientProfile(endpoint, secretMaterial, publicMetadata);
    }

    return {
      status: 'blocked_secret_invalid',
      missingFields: [],
      warnings: ['unsupported_protocol'],
    };
  }

  private renderVlessClientUri(
    outbound: ClientRouteOptionsResponse['outbounds'][number],
    endpoint: ClientSubscriptionEndpointSummary,
    secretMaterial: Record<string, unknown>,
    publicMetadata: Record<string, unknown>,
  ): ClientSubscriptionCredentialRenderResult {
    const target = this.subscriptionEndpointTarget(endpoint);
    const uuid = this.firstCredentialString([secretMaterial], ['clientUuid', 'uuid', 'clientId', 'id'], 80);
    const missingFields: string[] = [];

    if (!target.host) missingFields.push('public_host');
    if (!target.port) missingFields.push('public_port');
    if (!uuid || !isUuidValue(uuid)) missingFields.push('client_uuid');

    if (missingFields.length) return this.invalidSubscriptionCredential(missingFields);

    const network =
      this.firstCredentialString([publicMetadata, secretMaterial], ['transport', 'network', 'type'], 32) ??
      endpoint.transport ??
      'tcp';
    const encryption = this.firstCredentialString([publicMetadata, secretMaterial], ['encryption'], 32) ?? 'none';
    const params = new URLSearchParams();
    params.set('type', network);
    params.set('encryption', encryption);

    for (const [key, queryName, maxLength] of [
      ['security', 'security', 32],
      ['sni', 'sni', 160],
      ['serverName', 'sni', 160],
      ['flow', 'flow', 80],
      ['path', 'path', 180],
      ['hostHeader', 'host', 160],
      ['serviceName', 'serviceName', 160],
      ['headerType', 'headerType', 64],
      ['fingerprint', 'fp', 64],
      ['alpn', 'alpn', 80],
    ] as const) {
      const value = this.firstCredentialString([publicMetadata, secretMaterial], [key], maxLength);
      if (value) params.set(queryName, value);
    }

    const targetHost = target.host as string;
    const targetPort = target.port as number;
    const host = targetHost.includes(':') && !targetHost.startsWith('[') ? `[${targetHost}]` : targetHost;
    const label = encodeURIComponent(outbound.name || 'AfroGate');
    return {
      status: 'rendered',
      uri: `vless://${uuid}@${host}:${targetPort}?${params.toString()}#${label}`,
      configText: null,
      missingFields: [],
      warnings: [],
    };
  }

  private renderWireGuardClientConfig(
    endpoint: ClientSubscriptionEndpointSummary,
    secretMaterial: Record<string, unknown>,
    publicMetadata: Record<string, unknown>,
  ): ClientSubscriptionCredentialRenderResult {
    const target = this.subscriptionEndpointTarget(endpoint);
    const privateKey = this.firstCredentialString([secretMaterial], ['clientPrivateKey', 'privateKey'], 2048);
    const address = this.firstCredentialList([secretMaterial], ['clientAddress', 'address', 'addressCidr'], 256);
    const peerPublicKey = this.firstCredentialString(
      [publicMetadata, secretMaterial],
      ['peerPublicKey', 'serverPublicKey', 'publicKey'],
      2048,
    );
    const missingFields: string[] = [];

    if (!target.authority) missingFields.push('public_endpoint');
    if (!privateKey) missingFields.push('client_private_key');
    if (!address) missingFields.push('client_address');
    if (!peerPublicKey) missingFields.push('peer_public_key');

    if (missingFields.length) return this.invalidSubscriptionCredential(missingFields);

    const dns = this.firstCredentialList([secretMaterial, publicMetadata], ['dns', 'clientDns'], 256);
    const allowedIps =
      this.firstCredentialList([secretMaterial, publicMetadata], ['allowedIps', 'allowedIPs'], 512) ??
      '0.0.0.0/0, ::/0';
    const mtu = this.firstCredentialString([secretMaterial, publicMetadata], ['mtu'], 16);
    const presharedKey = this.firstCredentialString(
      [secretMaterial],
      ['presharedKey', 'preSharedKey', 'psk'],
      2048,
    );
    const keepalive = this.firstCredentialString(
      [secretMaterial, publicMetadata],
      ['persistentKeepalive', 'keepalive'],
      16,
    );

    const lines = [
      '[Interface]',
      `PrivateKey = ${privateKey}`,
      `Address = ${address}`,
      dns ? `DNS = ${dns}` : null,
      mtu ? `MTU = ${mtu}` : null,
      '',
      '[Peer]',
      `PublicKey = ${peerPublicKey}`,
      presharedKey ? `PresharedKey = ${presharedKey}` : null,
      `AllowedIPs = ${allowedIps}`,
      `Endpoint = ${target.authority}`,
      keepalive ? `PersistentKeepalive = ${keepalive}` : null,
    ].filter((line): line is string => line !== null);

    return {
      status: 'rendered',
      uri: null,
      configText: lines.join('\n'),
      missingFields: [],
      warnings: [],
    };
  }

  private renderL2tpClientProfile(
    endpoint: ClientSubscriptionEndpointSummary,
    secretMaterial: Record<string, unknown>,
    publicMetadata: Record<string, unknown>,
  ): ClientSubscriptionCredentialRenderResult {
    const target = this.subscriptionEndpointTarget(endpoint);
    const username = this.firstCredentialString([secretMaterial], ['username', 'user'], 256);
    const password = this.firstCredentialString([secretMaterial], ['password', 'clientPassword'], 2048);
    const psk = this.firstCredentialString([secretMaterial], ['preSharedKey', 'presharedKey', 'ipsecPsk', 'psk'], 2048);
    const missingFields: string[] = [];

    if (!target.authority) missingFields.push('public_endpoint');
    if (!username) missingFields.push('username');
    if (!password) missingFields.push('password');
    if (!psk) missingFields.push('ipsec_psk');

    if (missingFields.length) return this.invalidSubscriptionCredential(missingFields);

    const remoteId = this.firstCredentialString([publicMetadata, secretMaterial], ['remoteId', 'serverId'], 256);
    const lines = [
      'Protocol: L2TP/IPsec',
      `Server: ${target.authority}`,
      remoteId ? `Remote ID: ${remoteId}` : null,
      `Username: ${username}`,
      `Password: ${password}`,
      `PreSharedKey: ${psk}`,
    ].filter((line): line is string => line !== null);

    return {
      status: 'rendered',
      uri: null,
      configText: lines.join('\n'),
      missingFields: [],
      warnings: [],
    };
  }

  private renderIkev2ClientProfile(
    endpoint: ClientSubscriptionEndpointSummary,
    secretMaterial: Record<string, unknown>,
    publicMetadata: Record<string, unknown>,
  ): ClientSubscriptionCredentialRenderResult {
    const target = this.subscriptionEndpointTarget(endpoint);
    const identity = this.firstCredentialString(
      [secretMaterial],
      ['identity', 'clientIdentity', 'localId', 'username'],
      256,
    );
    const username = this.firstCredentialString([secretMaterial], ['username', 'user'], 256);
    const password = this.firstCredentialString([secretMaterial], ['password', 'eapPassword'], 2048);
    const certificate = this.firstCredentialString(
      [secretMaterial],
      ['certificateAlias', 'certificateRef', 'clientCertificate'],
      4096,
    );
    const missingFields: string[] = [];

    if (!target.authority) missingFields.push('public_endpoint');
    if (!identity && !username) missingFields.push('client_identity');
    if (!password && !certificate) missingFields.push('client_auth_material');

    if (missingFields.length) return this.invalidSubscriptionCredential(missingFields);

    const remoteId =
      this.firstCredentialString([publicMetadata, secretMaterial], ['remoteId', 'serverId'], 256) ??
      target.host ??
      null;
    const lines = [
      'Protocol: IKEv2',
      `Server: ${target.authority}`,
      remoteId ? `Remote ID: ${remoteId}` : null,
      identity ? `Local ID: ${identity}` : null,
      username ? `Username: ${username}` : null,
      password ? `Password: ${password}` : null,
      certificate ? `Certificate: ${certificate}` : null,
    ].filter((line): line is string => line !== null);

    return {
      status: 'rendered',
      uri: null,
      configText: lines.join('\n'),
      missingFields: [],
      warnings: [],
    };
  }

  private invalidSubscriptionCredential(missingFields: string[]): ClientSubscriptionCredentialRenderResult {
    return {
      status: 'blocked_secret_invalid',
      missingFields,
      warnings: ['stored_client_secret_material_incomplete'],
    };
  }

  private subscriptionPublicProfile(
    protocol: string,
    outbound: ClientRouteOptionsResponse['outbounds'][number],
    endpoint: ClientSubscriptionEndpointSummary,
  ): Record<string, string | number | boolean | null> {
    return {
      protocol,
      outboundId: outbound.id,
      routeGroup: outbound.routeGroup,
      endpoint: endpoint.address ?? this.endpointHostPort(endpoint),
      host: endpoint.host ?? null,
      port: endpoint.port ?? null,
      transport: endpoint.transport ?? null,
      countryCode: endpoint.countryCode ?? null,
      usageMultiplier: endpoint.usageMultiplier,
      secretSafe: true,
    };
  }

  private endpointHostPort(endpoint: ClientSubscriptionEndpointSummary): string | null {
    if (!endpoint.host) return null;
    return endpoint.port ? `${endpoint.host}:${endpoint.port}` : endpoint.host;
  }

  private subscriptionEndpointTarget(
    endpoint: ClientSubscriptionEndpointSummary,
  ): { host: string | null; port: number | null; authority: string | null } {
    const parsed = parseSubscriptionAddress(endpoint.address);
    const host = endpoint.host ?? parsed.host;
    const port = endpoint.port ?? parsed.port;

    if (!host && endpoint.address) {
      return { host: null, port, authority: this.sanitizeSubscriptionConfigValue(endpoint.address, 220) };
    }

    const safeHost = host ? this.sanitizeSubscriptionConfigValue(host, 180) : null;
    const authority = safeHost ? `${safeHost}${port ? `:${port}` : ''}` : null;
    return { host: safeHost, port, authority };
  }

  private firstCredentialString(
    records: Array<Record<string, unknown>>,
    keys: string[],
    maxLength: number,
  ): string | null {
    for (const record of records) {
      for (const key of keys) {
        const value = record[key];
        const normalized = scalarCredentialValue(value);
        const safe = normalized ? this.sanitizeSubscriptionConfigValue(normalized, maxLength) : null;
        if (safe) return safe;
      }
    }

    return null;
  }

  private firstCredentialList(
    records: Array<Record<string, unknown>>,
    keys: string[],
    maxLength: number,
  ): string | null {
    for (const record of records) {
      for (const key of keys) {
        const value = record[key];
        const normalized = Array.isArray(value)
          ? value.map((item) => scalarCredentialValue(item)).filter((item): item is string => Boolean(item)).join(', ')
          : scalarCredentialValue(value);
        const safe = normalized ? this.sanitizeSubscriptionConfigValue(normalized, maxLength) : null;
        if (safe) return safe;
      }
    }

    return null;
  }

  private sanitizeSubscriptionConfigValue(value: string, maxLength: number): string | null {
    const normalized = value.trim();
    if (!normalized || normalized.length > maxLength) return null;
    if (/[\r\n\u0000]/.test(normalized)) return null;
    return normalized;
  }

  private firstSafeEndpointString(config: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = config[key];
      const normalized = typeof value === 'string' || typeof value === 'number'
        ? this.normalizePublicEndpointValue(String(value))
        : null;
      if (normalized) return normalized;
    }

    return null;
  }

  private firstSafeEndpointNumber(config: Record<string, unknown>, keys: string[]): number | null {
    for (const key of keys) {
      const value = config[key];
      const parsed = Number(value);
      if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) return parsed;
    }

    return null;
  }

  private normalizePublicEndpointValue(value: string): string | null {
    const normalized = value.trim();
    if (!normalized || normalized.length > 160) return null;
    if (/[@<>"'`\\]/.test(normalized)) return null;
    if (/(secret|token|password|private[_-]?key|credential)/i.test(normalized)) return null;

    return normalized;
  }

  private bytesAtMultiplier(chargedRemainingBytes: number | null, multiplierValue: number | string | null | undefined): number | null {
    if (chargedRemainingBytes === null) return null;

    return Math.floor(chargedRemainingBytes / this.normalizeUsageMultiplier(multiplierValue));
  }

  private usageMultiplierLabel(multiplierValue: number | string | null | undefined): string {
    return `x${this.normalizeUsageMultiplier(multiplierValue)}`;
  }

  private minNullableBytes(values: Array<number | null | undefined>): number | null {
    const finiteValues = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (!finiteValues.length) return null;

    return Math.min(...finiteValues);
  }

  private async updateCustomerAccountFields(
    executor: DatabaseQueryExecutor,
    id: string,
    dto: UpdateCustomerAccountDto,
  ): Promise<string[]> {
    const fields: string[] = [];
    const values: unknown[] = [];
    const setClauses: string[] = [];

    const add = (field: string, column: string, value: unknown) => {
      fields.push(field);
      values.push(value);
      setClauses.push(`${column} = $${values.length}`);
    };

    if (dto.displayName !== undefined) add('displayName', 'display_name', this.normalizeNullableString(dto.displayName));
    if (dto.telegramId !== undefined) add('telegramId', 'telegram_id', this.normalizeNullableString(dto.telegramId));
    if (dto.telegramUsername !== undefined) {
      add('telegramUsername', 'telegram_username', this.normalizeTelegramUsername(dto.telegramUsername));
    }
    if (dto.paidNumber !== undefined) add('paidNumberHash', 'paid_number_hash', this.hashPaidNumberIfPresent(dto.paidNumber));
    if (dto.clearPaidNumber) add('paidNumberHash', 'paid_number_hash', null);
    if (dto.status !== undefined) add('status', 'status', dto.status);
    if (dto.quotaScope !== undefined) add('quotaScope', 'quota_scope', dto.quotaScope);
    if (dto.quotaLimitBytes !== undefined) add('quotaLimitBytes', 'quota_limit_bytes', dto.quotaLimitBytes);
    if (dto.perClientLimitBytes !== undefined) {
      add('perClientLimitBytes', 'per_client_limit_bytes', dto.perClientLimitBytes);
    }
    if (dto.usedBytes !== undefined) add('usedBytes', 'used_bytes', dto.usedBytes);
    if (dto.notes !== undefined) add('notes', 'notes', this.normalizeNullableString(dto.notes));

    if (!setClauses.length) return fields;

    values.push(id);
    await executor.query(
      `
        UPDATE customer_accounts
        SET ${setClauses.join(', ')},
            updated_at = now()
        WHERE id = $${values.length}
      `,
      values,
    );

    return fields;
  }

  private async updateClientConfigFields(
    executor: DatabaseQueryExecutor,
    id: string,
    dto: UpdateClientConfigDto,
  ): Promise<string[]> {
    const fields: string[] = [];
    const values: unknown[] = [];
    const setClauses: string[] = [];

    const add = (field: string, column: string, value: unknown) => {
      fields.push(field);
      values.push(value);
      setClauses.push(`${column} = $${values.length}`);
    };

    if (dto.label !== undefined) add('label', 'label', dto.label.trim());
    if (dto.protocol !== undefined) add('protocol', 'protocol', this.normalizeProtocol(dto.protocol));
    if (dto.externalPanel !== undefined) add('externalPanel', 'external_panel', this.normalizeNullableString(dto.externalPanel));
    if (dto.externalPanelUserId !== undefined) {
      add('externalPanelUserId', 'external_panel_user_id', this.normalizeNullableString(dto.externalPanelUserId));
    }
    if (dto.externalPanelConfigId !== undefined) {
      add('externalPanelConfigId', 'external_panel_config_id', this.normalizeNullableString(dto.externalPanelConfigId));
    }
    if (dto.deviceLimit !== undefined) add('deviceLimit', 'device_limit', dto.deviceLimit);
    if (dto.quotaLimitBytes !== undefined) add('quotaLimitBytes', 'quota_limit_bytes', dto.quotaLimitBytes);
    if (dto.usedBytes !== undefined) add('usedBytes', 'used_bytes', dto.usedBytes);
    if (dto.status !== undefined) add('status', 'status', dto.status);
    if (dto.notes !== undefined) add('notes', 'notes', this.normalizeNullableString(dto.notes));

    if (!setClauses.length) return fields;

    values.push(id);
    await executor.query(
      `
        UPDATE client_configs
        SET ${setClauses.join(', ')},
            updated_at = now()
        WHERE id = $${values.length}
      `,
      values,
    );

    return fields;
  }

  private mapCustomerAccount(row: CustomerAccountRow): AdminCustomerAccountSummary {
    const quotaLimitBytes = this.numberFromBigInt(row.quotaLimitBytes);
    const perClientLimitBytes = this.numberFromBigInt(row.perClientLimitBytes);
    const usedBytes = this.numberFromBigInt(row.usedBytes) ?? 0;

    return {
      id: row.id,
      displayName: row.displayName,
      telegramId: row.telegramId,
      telegramUsername: row.telegramUsername,
      hasPaidNumberHash: Boolean(row.paidNumberHash),
      status: row.status,
      quotaScope: row.quotaScope,
      quotaLimitBytes,
      perClientLimitBytes,
      usedBytes,
      remainingBytes: this.remainingBytes(quotaLimitBytes, usedBytes),
      clientCount: Number(row.clientCount ?? 0),
      activeClientCount: Number(row.activeClientCount ?? 0),
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapTelegramBotAccount(row: CustomerAccountRow): TelegramBotAccountSummary {
    const quotaLimitBytes = this.numberFromBigInt(row.quotaLimitBytes);
    const usedBytes = this.numberFromBigInt(row.usedBytes) ?? 0;

    return {
      id: row.id,
      displayName: row.displayName,
      status: row.status,
      quotaScope: row.quotaScope,
      quotaLimitBytes,
      usedBytes,
      remainingBytes: this.remainingBytes(quotaLimitBytes, usedBytes),
      clientCount: Number(row.clientCount ?? 0),
      activeClientCount: Number(row.activeClientCount ?? 0),
    };
  }

  private mapClientConfig(
    row: ClientConfigRow,
    defaultPerClientLimitBytes: number | null,
  ): AdminClientConfigSummary {
    const quotaLimitBytes = this.numberFromBigInt(row.quotaLimitBytes);
    const usedBytes = this.numberFromBigInt(row.usedBytes) ?? 0;
    const effectiveQuotaLimitBytes = quotaLimitBytes ?? defaultPerClientLimitBytes;

    return {
      id: row.id,
      customerAccountId: row.customerAccountId,
      label: row.label,
      protocol: row.protocol,
      externalPanel: row.externalPanel,
      externalPanelUserId: row.externalPanelUserId,
      externalPanelConfigId: row.externalPanelConfigId,
      deviceLimit: row.deviceLimit,
      quotaLimitBytes,
      effectiveQuotaLimitBytes,
      usedBytes,
      remainingBytes: this.remainingBytes(effectiveQuotaLimitBytes, usedBytes),
      status: row.status,
      notes: row.notes,
      routePreference: this.mapClientRoutePreferenceFromClientRow(row),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapClientRoutePreference(row: ClientRoutePreferenceRow): AdminClientRoutePreferenceSummary {
    return {
      id: row.id,
      clientConfigId: row.clientConfigId,
      customerAccountId: row.customerAccountId,
      routeGroup: row.routeGroup,
      assignmentKey: this.clientRouteAssignmentKey(row.clientConfigId),
      mode: row.mode,
      detectedCountryCode: row.detectedCountryCode,
      detectedCountrySource: row.detectedCountrySource,
      preferredExitCountryCode: row.preferredExitCountryCode,
      preferredOutboundId: row.preferredOutboundId,
      preferredOutboundName: row.preferredOutboundName,
      scoreProfile: row.scoreProfile,
      autoDetectCountry: row.autoDetectCountry,
      allowClientOverride: row.allowClientOverride,
      routeLocked: row.routeLocked,
      stickySessionProtection: row.stickySessionProtection,
      lastDetectedAt: row.lastDetectedAt?.toISOString() ?? null,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapClientRoutePreferenceFromClientRow(row: ClientConfigRow): AdminClientRoutePreferenceSummary | null {
    if (!row.routePreferenceId || !row.routePreferenceRouteGroup || !row.routePreferenceMode) return null;

    return {
      id: row.routePreferenceId,
      clientConfigId: row.id,
      customerAccountId: row.customerAccountId,
      routeGroup: row.routePreferenceRouteGroup,
      assignmentKey: this.clientRouteAssignmentKey(row.id),
      mode: row.routePreferenceMode,
      detectedCountryCode: row.routePreferenceDetectedCountryCode ?? null,
      detectedCountrySource: row.routePreferenceDetectedCountrySource ?? null,
      preferredExitCountryCode: row.routePreferencePreferredExitCountryCode ?? null,
      preferredOutboundId: row.routePreferencePreferredOutboundId ?? null,
      preferredOutboundName: row.routePreferencePreferredOutboundName ?? null,
      scoreProfile: row.routePreferenceScoreProfile ?? 'balanced',
      autoDetectCountry: row.routePreferenceAutoDetectCountry ?? true,
      allowClientOverride: row.routePreferenceAllowClientOverride ?? true,
      routeLocked: row.routePreferenceRouteLocked ?? false,
      stickySessionProtection: row.routePreferenceStickySessionProtection ?? true,
      lastDetectedAt: row.routePreferenceLastDetectedAt?.toISOString() ?? null,
      createdBy: row.routePreferenceCreatedBy ?? null,
      createdAt: row.routePreferenceCreatedAt?.toISOString() ?? null,
      updatedAt: row.routePreferenceUpdatedAt?.toISOString() ?? null,
    };
  }

  private defaultClientRoutePreference(
    row: ClientConfigRow,
    routeGroup: string,
  ): AdminClientRoutePreferenceSummary {
    return {
      id: null,
      clientConfigId: row.id,
      customerAccountId: row.customerAccountId,
      routeGroup,
      assignmentKey: this.clientRouteAssignmentKey(row.id),
      mode: 'auto',
      detectedCountryCode: null,
      detectedCountrySource: null,
      preferredExitCountryCode: null,
      preferredOutboundId: null,
      preferredOutboundName: null,
      scoreProfile: 'balanced',
      autoDetectCountry: true,
      allowClientOverride: true,
      routeLocked: false,
      stickySessionProtection: true,
      lastDetectedAt: null,
      createdBy: null,
      createdAt: null,
      updatedAt: null,
    };
  }

  private buildClientRoutePreferencePatch(
    dto: UpsertClientRoutePreferenceDto,
    existing: ClientRoutePreferenceRow | null,
  ): ClientRoutePreferencePatch {
    const mode = dto.mode ?? existing?.mode ?? 'auto';
    const detectedCountryCode =
      dto.detectedCountryCode !== undefined
        ? this.normalizeCountryCode(dto.detectedCountryCode)
        : existing?.detectedCountryCode ?? null;
    const detectedCountrySource =
      dto.detectedCountrySource !== undefined
        ? this.normalizeDetectionSource(dto.detectedCountrySource)
        : existing?.detectedCountrySource ?? null;
    const preferredExitCountryCode =
      dto.preferredExitCountryCode !== undefined
        ? this.normalizeCountryCode(dto.preferredExitCountryCode)
        : existing?.preferredExitCountryCode ?? null;
    const preferredOutboundId =
      dto.preferredOutboundId !== undefined
        ? this.normalizeNullableString(dto.preferredOutboundId)
        : existing?.preferredOutboundId ?? null;
    const scoreProfile = dto.scoreProfile ?? existing?.scoreProfile ?? 'balanced';
    const routeLocked = dto.routeLocked ?? (mode === 'outbound' ? true : dto.mode ? false : existing?.routeLocked ?? false);

    return {
      mode,
      detectedCountryCode,
      detectedCountrySource: detectedCountryCode ? detectedCountrySource ?? 'admin' : detectedCountrySource,
      preferredExitCountryCode,
      preferredOutboundId,
      scoreProfile,
      autoDetectCountry: dto.autoDetectCountry ?? existing?.autoDetectCountry ?? true,
      allowClientOverride: dto.allowClientOverride ?? existing?.allowClientOverride ?? true,
      routeLocked: mode === 'outbound' ? true : routeLocked,
      stickySessionProtection: dto.stickySessionProtection ?? existing?.stickySessionProtection ?? true,
      lastDetectedAt:
        dto.detectedCountryCode !== undefined
          ? detectedCountryCode
            ? new Date()
            : null
          : existing?.lastDetectedAt ?? null,
    };
  }

  private async upsertClientRouteAssignment(
    executor: DatabaseQueryExecutor,
    client: ClientConfigRow,
    routeGroup: string,
    preference: ClientRoutePreferencePatch,
  ): Promise<void> {
    const assignmentKey = this.clientRouteAssignmentKey(client.id);
    const currentOutboundId = preference.mode === 'outbound' ? preference.preferredOutboundId : null;
    const lockedOutboundId = preference.routeLocked ? preference.preferredOutboundId : null;
    const protocolProfile = this.mapClientScoreProfileToProtocol(preference.scoreProfile);
    const speedProfile = this.mapClientScoreProfileToSpeed(preference.scoreProfile);

    await executor.query(
      `
        INSERT INTO route_assignments (
          route_group, assignment_key, assignment_label, current_outbound_id,
          locked_outbound_id, auto_route_enabled, route_locked,
          protocol_profile, speed_profile, hysteresis_score_delta, cooldown_seconds
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 15, 180)
        ON CONFLICT (route_group, assignment_key) DO UPDATE
        SET assignment_label = EXCLUDED.assignment_label,
            current_outbound_id = EXCLUDED.current_outbound_id,
            locked_outbound_id = EXCLUDED.locked_outbound_id,
            auto_route_enabled = EXCLUDED.auto_route_enabled,
            route_locked = EXCLUDED.route_locked,
            protocol_profile = EXCLUDED.protocol_profile,
            speed_profile = EXCLUDED.speed_profile,
            updated_at = now()
      `,
      [
        routeGroup,
        assignmentKey,
        client.label,
        currentOutboundId,
        lockedOutboundId,
        preference.mode !== 'outbound',
        preference.routeLocked,
        protocolProfile,
        speedProfile,
      ],
    );
  }

  private normalizeRouteGroup(value: string | undefined): string {
    const normalized = this.normalizeNullableString(value) ?? 'main';
    if (normalized.length > 80) throw new BadRequestException('routeGroup is too long');
    return normalized;
  }

  private normalizeCountryCode(value: string | null | undefined): string | null {
    const normalized = this.normalizeNullableString(value)?.toUpperCase() ?? null;
    if (!normalized) return null;
    if (!/^[A-Z]{2}$/.test(normalized)) {
      throw new BadRequestException('Country code must use two-letter ISO format, such as IR or DE');
    }
    return normalized;
  }

  private normalizeDetectionSource(value: string | null | undefined): string | null {
    const normalized = this.normalizeNullableString(value);
    if (!normalized) return null;
    if (!['client_app', 'edge_ip', 'admin', 'unknown'].includes(normalized)) {
      throw new BadRequestException('Invalid country detection source');
    }
    return normalized;
  }

  private mapClientScoreProfileToProtocol(scoreProfile: string): string {
    if (['gaming', 'tcp', 'udp', 'quic', 'dns', 'wireguard'].includes(scoreProfile)) return scoreProfile;
    return 'balanced';
  }

  private mapClientScoreProfileToSpeed(scoreProfile: string): string {
    if (scoreProfile === 'throughput') return 'highSpeed';
    if (scoreProfile === 'gaming') return 'gaming';
    return 'balanced';
  }

  private clientRouteAssignmentKey(clientConfigId: string): string {
    return `client_config:${clientConfigId}`;
  }

  private normalizeClientSubscriptionCredentialProtocol(value: string | null | undefined): string {
    const normalized = this.normalizeSubscriptionProtocol(this.normalizeNullableString(value) ?? '');
    if (!CLIENT_SUBSCRIPTION_PROTOCOLS.has(normalized)) {
      throw new BadRequestException('Client subscription credential protocol is not supported');
    }
    return normalized;
  }

  private normalizeClientSubscriptionSecretMaterial(value: unknown): Record<string, unknown> {
    const record = this.asRecord(value);
    if (!record) throw new BadRequestException('secretMaterial must be an object');

    const normalized = normalizeFlatCredentialRecord(record, 'secretMaterial');
    if (!Object.keys(normalized).length) throw new BadRequestException('secretMaterial must contain at least one field');
    this.assertJsonSize(normalized, CLIENT_SUBSCRIPTION_SECRET_MAX_BYTES, 'secretMaterial');
    return normalized;
  }

  private normalizeClientSubscriptionPublicMetadata(
    value: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> {
    const record = value === null || value === undefined ? {} : this.asRecord(value);
    if (!record) throw new BadRequestException('publicMetadata must be an object');

    const normalized = normalizeFlatCredentialRecord(record, 'publicMetadata');
    for (const key of Object.keys(normalized)) {
      if (!CLIENT_SUBSCRIPTION_PUBLIC_METADATA_KEYS.has(key)) {
        throw new BadRequestException(`publicMetadata contains unsupported non-secret field "${key}"`);
      }
    }
    this.assertNoSecretLikeKeys(normalized, 'Client subscription public metadata');
    this.assertJsonSize(normalized, CLIENT_SUBSCRIPTION_PUBLIC_METADATA_MAX_BYTES, 'publicMetadata');
    return normalized;
  }

  private assertJsonSize(value: Record<string, unknown>, maxBytes: number, fieldName: string): void {
    const bytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
    if (bytes > maxBytes) throw new BadRequestException(`${fieldName} is too large`);
  }

  private clientSubscriptionCredentialEncryptionContext(
    clientConfigId: string,
    outboundId: string,
    protocol: string,
    credentialId: string,
  ): string {
    return ['client-subscription-credential', clientConfigId, outboundId, protocol, credentialId].join(':');
  }

  private normalizeClientUsageEventInput(dto: CreateClientUsageEventDto): NormalizedClientUsageEventInput {
    const source = this.normalizeClientUsageSource(dto.source);
    const rxBytes = this.normalizeOptionalUsageBytes(dto.rxBytes, 'rxBytes');
    const txBytes = this.normalizeOptionalUsageBytes(dto.txBytes, 'txBytes');
    const explicitDelta = this.normalizeOptionalUsageBytes(dto.usedBytesDelta, 'usedBytesDelta');

    if (explicitDelta === null && rxBytes === null && txBytes === null) {
      throw new BadRequestException('usedBytesDelta, rxBytes, or txBytes is required');
    }

    const rawUsedBytesDelta = explicitDelta ?? (rxBytes ?? 0) + (txBytes ?? 0);
    const direction = this.normalizeClientUsageDirection(
      dto.direction ?? (rxBytes !== null && txBytes === null ? 'rx' : txBytes !== null && rxBytes === null ? 'tx' : 'combined'),
    );
    const observedAt = this.parseOptionalDate(dto.observedAt, 'observedAt') ?? new Date();
    const windowStart = this.parseOptionalDate(dto.windowStart, 'windowStart');
    const windowEnd = this.parseOptionalDate(dto.windowEnd, 'windowEnd');
    if (windowStart && windowEnd && windowEnd.getTime() < windowStart.getTime()) {
      throw new BadRequestException('windowEnd must be greater than or equal to windowStart');
    }

    const metadata = dto.metadata ?? {};
    this.assertNoSecretLikeKeys(metadata, 'Usage event metadata');

    return {
      source,
      direction,
      rawUsedBytesDelta,
      usedBytesDelta: rawUsedBytesDelta,
      usageMultiplier: 1,
      ratedOutboundId: this.normalizeNullableString(dto.outboundId),
      ratedOutboundName: null,
      rxBytes,
      txBytes,
      observedAt,
      windowStart,
      windowEnd,
      idempotencyKey: this.normalizeNullableString(dto.idempotencyKey),
      externalReference: this.normalizeNullableString(dto.externalReference),
      notes: this.normalizeNullableString(dto.notes),
      metadata,
    };
  }

  private normalizeClientUsageSource(value: string | undefined): string {
    const normalized = this.normalizeNullableString(value)?.toLowerCase() ?? 'admin';
    if (!CLIENT_USAGE_EVENT_SOURCES.has(normalized)) throw new BadRequestException('Invalid client usage source');
    return normalized;
  }

  private normalizeClientUsageDirection(value: string | undefined): string {
    const normalized = this.normalizeNullableString(value)?.toLowerCase() ?? 'combined';
    if (!CLIENT_USAGE_DIRECTIONS.has(normalized)) throw new BadRequestException('Invalid client usage direction');
    return normalized;
  }

  private normalizeOptionalUsageBytes(value: number | null | undefined, fieldName: string): number | null {
    if (value === null || value === undefined) return null;
    if (!Number.isSafeInteger(value) || value < 0 || value > MAX_SAFE_BYTES) {
      throw new BadRequestException(`${fieldName} must be a safe non-negative integer`);
    }
    return value;
  }

  private normalizePositiveByteDelta(value: number | null | undefined, fieldName: string): number {
    if (!Number.isSafeInteger(value) || value === null || value === undefined || value <= 0 || value > MAX_SAFE_BYTES) {
      throw new BadRequestException(`${fieldName} must be a safe positive integer`);
    }
    return value;
  }

  private addPositiveBytes(baseBytes: number, deltaBytes: number, errorMessage: string): number {
    const nextBytes = baseBytes + deltaBytes;
    if (!Number.isSafeInteger(nextBytes) || nextBytes > MAX_SAFE_BYTES) {
      throw new BadRequestException(errorMessage);
    }
    return nextBytes;
  }

  private normalizeCurrentPanelVolumeChargeScope(value: string | null | undefined): CurrentPanelVolumeChargeScope {
    const normalized = this.normalizeNullableString(value) ?? 'account_quota';
    if (!CURRENT_PANEL_VOLUME_CHARGE_SCOPES.has(normalized as CurrentPanelVolumeChargeScope)) {
      throw new BadRequestException('Invalid current panel volume charge scope');
    }
    return normalized as CurrentPanelVolumeChargeScope;
  }

  private normalizeCurrentPanelChargeClientIds(value: string[]): string[] {
    return Array.from(new Set(value.map((id) => id.trim()).filter(Boolean))).sort();
  }

  private assertCurrentPanelVolumeChargeDuplicateMatches(
    row: CurrentPanelVolumeChargeEventRow,
    request: {
      customerAccountId: string;
      scope: CurrentPanelVolumeChargeScope;
      volumeBytes: number;
      clientConfigIds: string[];
    },
  ): void {
    const existingVolumeBytes = this.numberFromBigInt(row.volumeBytesDelta) ?? 0;
    const existingClientConfigIds = this.normalizeJsonStringArray(row.clientConfigIds).sort();
    const requestedClientConfigIds = request.clientConfigIds.slice().sort();
    const sameClientConfigIds =
      existingClientConfigIds.length === requestedClientConfigIds.length &&
      existingClientConfigIds.every((id, index) => id === requestedClientConfigIds[index]);

    if (
      row.customerAccountId !== request.customerAccountId ||
      row.chargeScope !== request.scope ||
      existingVolumeBytes !== request.volumeBytes ||
      !sameClientConfigIds
    ) {
      throw new ConflictException('Current panel volume charge idempotency key already belongs to another request');
    }
  }

  private normalizeJsonStringArray(value: unknown): string[] {
    const parsed = this.parseJsonValue(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  }

  private normalizeCurrentPanelClientQuotaChanges(value: unknown): CurrentPanelVolumeChargeClientQuotaChange[] {
    const parsed = this.parseJsonValue(value);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const record = item as Record<string, unknown>;
      const clientConfigId = typeof record.clientConfigId === 'string' ? record.clientConfigId : null;
      const quotaLimitAfterBytes = this.numberFromBigInt(record.quotaLimitAfterBytes as string | number | null | undefined);
      if (!clientConfigId || quotaLimitAfterBytes === null) return [];

      return [{
        clientConfigId,
        quotaLimitBeforeBytes: this.numberFromBigInt(record.quotaLimitBeforeBytes as string | number | null | undefined),
        quotaLimitAfterBytes,
      }];
    });
  }

  private parseJsonValue(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  private normalizeUsageMultiplier(value: number | string | null | undefined): number {
    const normalized = Number(value ?? 1);
    if (!Number.isInteger(normalized) || normalized < 1 || normalized > 100) {
      throw new BadRequestException('Usage multiplier must be an integer between 1 and 100');
    }
    return normalized;
  }

  private hashPaidNumberIfPresent(value: string | null | undefined): string | null {
    const normalized = this.normalizePaidNumber(value);
    if (!normalized) return null;

    const key = process.env.AFROGATE_IDENTITY_HASH_KEY?.trim() || process.env.AFROGATE_SECRETS_KEY?.trim();
    if (!key) {
      throw new ServiceUnavailableException(
        'AFROGATE_IDENTITY_HASH_KEY or AFROGATE_SECRETS_KEY is required before storing paid numbers',
      );
    }

    return `hmac-sha256:${createHmac('sha256', key).update(normalized, 'utf8').digest('hex')}`;
  }

  private normalizePaidNumber(value: string | null | undefined): string | null {
    const normalized = this.normalizeNullableString(value)?.replace(/[\s().-]+/g, '') ?? null;
    return normalized || null;
  }

  private normalizeTelegramUsername(value: string | null | undefined): string | null {
    const normalized = this.normalizeNullableString(value)?.replace(/^@+/, '') ?? null;
    return normalized || null;
  }

  private normalizeProtocol(value: string | null | undefined): string {
    return this.normalizeNullableString(value)?.toLowerCase() ?? 'custom';
  }

  private normalizeCurrency(value: string): string {
    const normalized = value.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_-]{0,15}$/.test(normalized)) {
      throw new BadRequestException('Currency must use letters, numbers, underscore, or dash');
    }
    return normalized;
  }

  private normalizeSlug(value: string): string {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!slug) throw new BadRequestException('Volume package slug is required');
    return slug;
  }

  private normalizeProvider(value: string): string {
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
    if (!normalized) throw new BadRequestException('Payment provider is required');
    if (normalized.length > 40) throw new BadRequestException('Payment provider is too long');
    return normalized;
  }

  private normalizeNullableString(value: string | null | undefined): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
  }

  private gbToBytes(value: number): number {
    return value * BYTES_PER_GB;
  }

  private calculateTotalPrice(volumeGb: number, pricePerGb: number): number {
    return volumeGb * pricePerGb;
  }

  private defaultCheckoutMode(provider: string): string {
    return provider === 'paypal' ? 'hosted_redirect' : 'manual';
  }

  private assertPaymentMethodAccepts(method: PaymentMethodRow, currency: string, amount: number): void {
    if (method.status !== 'active') throw new BadRequestException('Payment method is not active');
    if (method.currency !== currency) {
      throw new BadRequestException('Payment method currency does not match the package currency');
    }

    const minAmount = this.numberFromBigInt(method.minAmount);
    const maxAmount = this.numberFromBigInt(method.maxAmount);
    if (minAmount !== null && amount < minAmount) throw new BadRequestException('Payment order amount is below method minimum');
    if (maxAmount !== null && amount > maxAmount) throw new BadRequestException('Payment order amount is above method maximum');
  }

  private assertPayPalPaymentOrder(order: PaymentOrderRow): void {
    if (order.provider !== 'paypal') {
      throw new BadRequestException('Payment order provider must be paypal');
    }
  }

  private mergePayPalMetadata(
    existing: Record<string, unknown> | null | undefined,
    patch: Record<string, unknown>,
  ): Record<string, unknown> {
    const current = existing ?? {};
    const currentPayPal = this.asRecord(current.paypal) ?? {};
    const cleanPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));

    return {
      ...current,
      paypal: {
        ...currentPayPal,
        ...cleanPatch,
      },
    };
  }

  private mergePaymentProviderAdapterMetadata(
    existing: Record<string, unknown> | null | undefined,
    prepared: PreparedPaymentProviderCheckout,
  ): Record<string, unknown> {
    const current = existing ?? {};
    const currentAdapters = this.asRecord(current.paymentProviderAdapters) ?? {};
    const currentProvider = this.asRecord(currentAdapters[prepared.provider]) ?? {};

    return {
      ...current,
      paymentProviderAdapters: {
        ...currentAdapters,
        [prepared.provider]: {
          ...currentProvider,
          adapterVersion: prepared.adapterVersion,
          adapterStatus: prepared.adapterStatus,
          checkoutPreparedAt: new Date().toISOString(),
          hostedCheckout: Boolean(prepared.checkoutUrl),
          paymentReference: prepared.paymentReference,
          settlementMode: prepared.settlementMode,
        },
      },
    };
  }

  private payPalWebhookPaymentUpdate(
    existing: PaymentOrderRow,
    eventType: string | null,
  ): { nextStatus: string; action: string; shouldUpdate: boolean } {
    if (eventType === 'CHECKOUT.ORDER.APPROVED') {
      return { nextStatus: existing.status, action: 'approval_recorded', shouldUpdate: true };
    }

    if (eventType === 'PAYMENT.CAPTURE.PENDING') {
      return { nextStatus: existing.status, action: 'capture_pending_recorded', shouldUpdate: true };
    }

    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      if (existing.status === 'paid') return { nextStatus: existing.status, action: 'already_paid', shouldUpdate: true };
      if (existing.status !== 'pending') {
        return { nextStatus: existing.status, action: `ignored_${existing.status}`, shouldUpdate: false };
      }
      return { nextStatus: 'paid', action: 'marked_paid', shouldUpdate: true };
    }

    if (
      eventType === 'PAYMENT.CAPTURE.DENIED' ||
      eventType === 'PAYMENT.CAPTURE.DECLINED' ||
      eventType === 'PAYMENT.CAPTURE.FAILED'
    ) {
      if (existing.status !== 'pending') {
        return { nextStatus: existing.status, action: `ignored_${existing.status}`, shouldUpdate: false };
      }
      return { nextStatus: 'failed', action: 'marked_failed', shouldUpdate: true };
    }

    if (eventType === 'PAYMENT.CAPTURE.REFUNDED' || eventType === 'PAYMENT.CAPTURE.REVERSED') {
      if (existing.status !== 'paid') {
        return { nextStatus: existing.status, action: `ignored_${existing.status}`, shouldUpdate: false };
      }
      return { nextStatus: 'refunded', action: 'marked_refunded', shouldUpdate: true };
    }

    return { nextStatus: existing.status, action: 'ignored', shouldUpdate: false };
  }

  private extractPayPalWebhookOrderId(
    eventType: string | null,
    resource: Record<string, unknown> | null,
  ): string | null {
    const supplementary = this.asRecord(resource?.supplementary_data);
    const relatedIds = this.asRecord(supplementary?.related_ids);
    const relatedOrderId = this.stringFromRecord(relatedIds, 'order_id');
    if (relatedOrderId) return relatedOrderId;

    if (eventType?.startsWith('CHECKOUT.ORDER.')) {
      return this.stringFromRecord(resource, 'id');
    }

    return null;
  }

  private extractPayPalWebhookCaptureId(
    eventType: string | null,
    resource: Record<string, unknown> | null,
  ): string | null {
    if (!eventType?.startsWith('PAYMENT.CAPTURE.')) return null;
    return this.stringFromRecord(resource, 'id');
  }

  private stringFromRecord(record: Record<string, unknown> | null | undefined, key: string): string | null {
    const value = record?.[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  }

  private assertPaymentOrderStatusTransition(currentStatus: string, nextStatus: string): void {
    if (currentStatus === nextStatus) return;

    const allowed: Record<string, string[]> = {
      pending: ['paid', 'failed'],
      paid: ['refunded'],
      failed: [],
      refunded: [],
    };

    if (!allowed[currentStatus]?.includes(nextStatus)) {
      throw new BadRequestException(`Payment order cannot move from ${currentStatus} to ${nextStatus}`);
    }
  }

  private assertAmountRange(minAmount: number | null, maxAmount: number | null): void {
    if (minAmount !== null && maxAmount !== null && maxAmount < minAmount) {
      throw new BadRequestException('Payment method max amount must be greater than or equal to min amount');
    }
  }

  private parseOptionalDate(value: string | null | undefined, fieldName: string): Date | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`${fieldName} must be a valid date`);
    return date;
  }

  private stringifyPublicRecord(value: Record<string, unknown>, context: string): string {
    this.assertNoSecretLikeKeys(value, context);
    return JSON.stringify(value);
  }

  private assertNoSecretLikeKeys(value: unknown, context: string, path = 'metadata'): void {
    if (!value || typeof value !== 'object') return;

    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (/(secret|token|password|private[_-]?key|client[_-]?secret|webhook[_-]?secret|credential)/i.test(key)) {
        throw new BadRequestException(`${context} must not contain secret-like key "${path}.${key}"`);
      }
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        this.assertNoSecretLikeKeys(nested, context, `${path}.${key}`);
      }
    }
  }

  private remainingBytes(limitBytes: number | null, usedBytes: number): number | null {
    if (limitBytes === null) return null;
    return Math.max(limitBytes - usedBytes, 0);
  }

  private numberFromBigInt(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  private throwConflictIfUniqueViolation(error: unknown, message: string): void {
    if (this.isErrorWithCode(error) && error.code === '23505') {
      throw new ConflictException(message);
    }
  }

  private isErrorWithCode(error: unknown): error is { code: string } {
    return typeof error === 'object' && error !== null && 'code' in error;
  }
}

function normalizeFlatCredentialRecord(value: Record<string, unknown>, context: string): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = rawKey.trim();
    if (!/^[A-Za-z0-9_.-]{1,80}$/.test(key)) {
      throw new BadRequestException(`${context} contains an invalid field name`);
    }

    if (rawValue === null || rawValue === undefined) {
      normalized[key] = null;
      continue;
    }

    if (Array.isArray(rawValue)) {
      if (rawValue.length > 32) throw new BadRequestException(`${context}.${key} has too many values`);
      normalized[key] = rawValue.map((item) => normalizeCredentialScalar(item, `${context}.${key}`));
      continue;
    }

    normalized[key] = normalizeCredentialScalar(rawValue, `${context}.${key}`);
  }

  return normalized;
}

function normalizeCredentialScalar(value: unknown, fieldName: string): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new BadRequestException(`${fieldName} must be finite`);
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return null;
    if (normalized.length > 4096) throw new BadRequestException(`${fieldName} is too long`);
    if (/[\u0000]/.test(normalized)) throw new BadRequestException(`${fieldName} contains invalid characters`);
    return normalized;
  }

  throw new BadRequestException(`${fieldName} must be a string, number, boolean, null, or array of scalar values`);
}

function stableStringifyRecord(value: Record<string, unknown>): string {
  const ordered = Object.keys(value)
    .sort((left, right) => left.localeCompare(right))
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = value[key];
      return result;
    }, {});
  return JSON.stringify(ordered);
}

function scalarCredentialValue(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return null;
}

function isUuidValue(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseSubscriptionAddress(address: string | null | undefined): { host: string | null; port: number | null } {
  const normalized = address?.trim();
  if (!normalized) return { host: null, port: null };

  const addressWithoutScheme = normalized.replace(/^[A-Za-z][A-Za-z0-9+.-]*:\/\//, '');
  const authority = addressWithoutScheme.split('/')[0]?.trim() || '';
  if (!authority) return { host: null, port: null };

  if (authority.startsWith('[')) {
    const closing = authority.indexOf(']');
    if (closing > 0) {
      const host = authority.slice(1, closing);
      const portValue = authority.slice(closing + 1).replace(/^:/, '');
      const port = parsePort(portValue);
      return { host, port };
    }
  }

  const lastColon = authority.lastIndexOf(':');
  if (lastColon > -1 && authority.indexOf(':') === lastColon) {
    const host = authority.slice(0, lastColon);
    const port = parsePort(authority.slice(lastColon + 1));
    return { host: host || null, port };
  }

  return { host: authority, port: null };
}

function parsePort(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : null;
}
