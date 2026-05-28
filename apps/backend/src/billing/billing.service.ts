import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';
import type {
  AdminBillingCatalogResponse,
  AdminBillingSettingsSummary,
  ClientAccessTokenSummary,
  ClientPortalProfileResponse,
  ClientRouteOptionsResponse,
  ClientRoutePreferenceSummary,
  AdminClientConfigSummary,
  AdminClientRoutePreferenceSummary,
  AdminClientUsageEventSummary,
  AdminAllocatePaymentOrderResponse,
  AdminCustomerAccountDetail,
  AdminCustomerAccountSummary,
  AdminPayPalPaymentOrderResponse,
  AdminPaymentOrderAllocationSummary,
  IssuedClientAccessTokenSummary,
  AdminPaymentMethodSummary,
  AdminPaymentOrderSummary,
  AdminRecordClientUsageResponse,
  AdminVolumePackageSummary,
  PayPalWebhookHandlerResponse,
} from '@afrogate/shared';
import { AuditService } from '../audit/audit.service';
import { DatabaseService, type DatabaseQueryExecutor } from '../database/database.service';
import type { AuditActor, AuthActor, ClientAuthActor } from '../security/auth-request';
import { hashClientToken } from '../security/client-token';
import { UpdateOwnClientRoutePreferenceDto } from '../client/dto/client-route-preference.dto';
import { IssueClientAccessTokenDto } from './dto/client-access-token.dto';
import {
  CreateClientUsageEventDto,
  CreateClientConfigDto,
  CreateCustomerAccountDto,
  UpdateClientConfigDto,
  UpdateCustomerAccountDto,
  UpsertClientRoutePreferenceDto,
} from './dto/customer-account.dto';
import {
  AllocatePaymentOrderDto,
  CapturePayPalPaymentOrderDto,
  CreatePayPalCheckoutDto,
  CreatePaymentMethodDto,
  CreatePaymentOrderDto,
  CreateVolumePackageDto,
  UpdateBillingSettingsDto,
  UpdatePaymentMethodDto,
  UpdatePaymentOrderStatusDto,
  UpdateVolumePackageDto,
} from './dto/billing.dto';
import { PayPalPaymentService, type PayPalWebhookSignatureHeaders } from './paypal-payment.service';

const BYTES_PER_GB = 1024 ** 3;
const MAX_SAFE_BYTES = Number.MAX_SAFE_INTEGER;
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

interface NormalizedClientUsageEventInput {
  source: string;
  direction: string;
  usedBytesDelta: number;
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

@Injectable()
export class BillingService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
    private readonly paypal: PayPalPaymentService,
  ) {}

  async getBillingCatalog(): Promise<AdminBillingCatalogResponse> {
    return {
      settings: await this.getBillingSettings(),
      packages: await this.listVolumePackages({ limit: 100 }),
      paymentMethods: await this.listPaymentMethods({ limit: 100 }),
    };
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

      return {
        allocation: this.mapPaymentOrderAllocation(allocationState.allocation),
        paymentOrder,
        account,
        duplicate: allocationState.duplicate,
      };
    } catch (error) {
      this.throwConflictIfUniqueViolation(error, 'Payment order allocation already exists');
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

      const inserted = await this.insertClientUsageEvent(executor, client, input, actor);
      if (!inserted) {
        if (!input.idempotencyKey) throw new ConflictException('Usage event could not be recorded');

        const existing = await this.getClientUsageEventByIdempotency(
          executor,
          input.source,
          input.idempotencyKey,
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
        [input.usedBytesDelta, client.id],
      );

      await executor.query(
        `
          UPDATE customer_accounts
          SET used_bytes = used_bytes + $1,
              updated_at = now()
          WHERE id = $2
        `,
        [input.usedBytesDelta, client.customerAccountId],
      );

      await this.audit.record(
        actor,
        'client_usage_event.record',
        'client_config',
        client.id,
        {
          customerAccountId: client.customerAccountId,
          usageEventId: row.id,
          source: input.source,
          direction: input.direction,
          usedBytesDelta: input.usedBytesDelta,
          hasIdempotencyKey: Boolean(input.idempotencyKey),
          externalReference: input.externalReference,
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
          JSON.stringify(['client:read', 'route:write']),
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
          o.maintenance_mode AS "maintenanceMode"
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

    const countryMap = new Map<string, { total: number; healthy: number; bestRank: number; bestHealthStatus: string }>();
    for (const row of result.rows) {
      if (!row.countryCode) continue;
      const current = countryMap.get(row.countryCode) ?? {
        total: 0,
        healthy: 0,
        bestRank: Number.POSITIVE_INFINITY,
        bestHealthStatus: 'unknown',
      };
      const rank = this.clientRouteHealthRank(row.healthStatus);
      current.total += 1;
      current.healthy += row.healthStatus === 'healthy' ? 1 : 0;
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
      })),
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

  private mapClientUsageEvent(row: ClientUsageEventRow): AdminClientUsageEventSummary {
    return {
      id: row.id,
      customerAccountId: row.customerAccountId,
      clientConfigId: row.clientConfigId,
      source: row.source,
      direction: row.direction,
      usedBytesDelta: this.numberFromBigInt(row.usedBytesDelta) ?? 0,
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
          used_bytes_delta, rx_bytes, tx_bytes, observed_at,
          window_start, window_end, idempotency_key, external_reference,
          notes, metadata, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15)
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

  private createClientAccessToken(): string {
    return `afg_client_${randomBytes(32).toString('base64url')}`;
  }

  private clientRouteHealthRank(status: string): number {
    if (status === 'healthy') return 0;
    if (status === 'degraded') return 1;
    if (status === 'unknown') return 2;
    return 3;
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

  private normalizeClientUsageEventInput(dto: CreateClientUsageEventDto): NormalizedClientUsageEventInput {
    const source = this.normalizeClientUsageSource(dto.source);
    const rxBytes = this.normalizeOptionalUsageBytes(dto.rxBytes, 'rxBytes');
    const txBytes = this.normalizeOptionalUsageBytes(dto.txBytes, 'txBytes');
    const explicitDelta = this.normalizeOptionalUsageBytes(dto.usedBytesDelta, 'usedBytesDelta');

    if (explicitDelta === null && rxBytes === null && txBytes === null) {
      throw new BadRequestException('usedBytesDelta, rxBytes, or txBytes is required');
    }

    const usedBytesDelta = explicitDelta ?? (rxBytes ?? 0) + (txBytes ?? 0);
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
      usedBytesDelta,
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
