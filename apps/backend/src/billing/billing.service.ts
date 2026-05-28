import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import type {
  AdminBillingCatalogResponse,
  AdminBillingSettingsSummary,
  AdminClientConfigSummary,
  AdminCustomerAccountDetail,
  AdminCustomerAccountSummary,
  AdminPaymentMethodSummary,
  AdminVolumePackageSummary,
} from '@afrogate/shared';
import { AuditService } from '../audit/audit.service';
import { DatabaseService, type DatabaseQueryExecutor } from '../database/database.service';
import type { AuthActor } from '../security/auth-request';
import {
  CreateClientConfigDto,
  CreateCustomerAccountDto,
  UpdateClientConfigDto,
  UpdateCustomerAccountDto,
} from './dto/customer-account.dto';
import {
  CreatePaymentMethodDto,
  CreateVolumePackageDto,
  UpdateBillingSettingsDto,
  UpdatePaymentMethodDto,
  UpdateVolumePackageDto,
} from './dto/billing.dto';

const BYTES_PER_GB = 1024 ** 3;

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

@Injectable()
export class BillingService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
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
            JSON.stringify(dto.publicConfig ?? {}),
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
        JSON.stringify(dto.publicConfig ?? existing.publicConfig ?? {}),
        dto.instructions !== undefined ? this.normalizeNullableString(dto.instructions) : existing.instructions,
        id,
      ],
    );

    return fields;
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

  private async getClientConfig(id: string): Promise<AdminClientConfigSummary> {
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
        ORDER BY created_at DESC
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
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
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

  private assertAmountRange(minAmount: number | null, maxAmount: number | null): void {
    if (minAmount !== null && maxAmount !== null && maxAmount < minAmount) {
      throw new BadRequestException('Payment method max amount must be greater than or equal to min amount');
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
