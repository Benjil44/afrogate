import { BadRequestException, Injectable } from '@nestjs/common';
import type { AdminTenantBrandSettingsSummary } from '@afrogate/shared';
import { AuditService } from '../audit/audit.service';
import { DatabaseService, type DatabaseQueryExecutor } from '../database/database.service';
import type { AuthActor } from '../security/auth-request';
import type { UpdateTenantBrandingDto } from './dto/tenant-branding.dto';

interface TenantBrandSettingsRow {
  settingKey: string;
  tenantSlug: string;
  displayName: string;
  legalName: string | null;
  supportEmail: string | null;
  supportTelegram: string | null;
  supportUrl: string | null;
  logoUrl: string | null;
  dashboardTitle: string;
  clientAppTitle: string;
  primaryColor: string;
  accentColor: string;
  publicBrandingEnabled: boolean;
  clientSupportMessage: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AdminTenantBrandingService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async getSettings(): Promise<AdminTenantBrandSettingsSummary> {
    return this.mapSettings(await this.getSettingsRow(this.database));
  }

  async updateSettings(
    dto: UpdateTenantBrandingDto,
    actor: AuthActor | undefined,
  ): Promise<AdminTenantBrandSettingsSummary> {
    const updated = await this.database.transaction(async (executor) => {
      const current = await this.getSettingsRow(executor, true);
      const changedFields = Object.entries(dto)
        .filter(([, value]) => value !== undefined)
        .map(([key]) => key);

      if (!changedFields.length) return current;

      const next = {
        tenantSlug: dto.tenantSlug !== undefined ? this.normalizeTenantSlug(dto.tenantSlug) : current.tenantSlug,
        displayName: dto.displayName !== undefined
          ? this.normalizeRequiredText(dto.displayName, 'Brand display name', 120)
          : current.displayName,
        legalName: dto.legalName !== undefined ? this.normalizeNullableText(dto.legalName, 160) : current.legalName,
        supportEmail: dto.supportEmail !== undefined ? this.normalizeEmail(dto.supportEmail) : current.supportEmail,
        supportTelegram: dto.supportTelegram !== undefined
          ? this.normalizeTelegram(dto.supportTelegram)
          : current.supportTelegram,
        supportUrl: dto.supportUrl !== undefined ? this.normalizePublicUrl(dto.supportUrl, 'Support URL') : current.supportUrl,
        logoUrl: dto.logoUrl !== undefined ? this.normalizePublicUrl(dto.logoUrl, 'Logo URL') : current.logoUrl,
        dashboardTitle: dto.dashboardTitle !== undefined
          ? this.normalizeRequiredText(dto.dashboardTitle, 'Dashboard title', 120)
          : current.dashboardTitle,
        clientAppTitle: dto.clientAppTitle !== undefined
          ? this.normalizeRequiredText(dto.clientAppTitle, 'Client app title', 120)
          : current.clientAppTitle,
        primaryColor: dto.primaryColor !== undefined
          ? this.normalizeColor(dto.primaryColor, 'Primary color')
          : current.primaryColor,
        accentColor: dto.accentColor !== undefined
          ? this.normalizeColor(dto.accentColor, 'Accent color')
          : current.accentColor,
        publicBrandingEnabled: dto.publicBrandingEnabled ?? current.publicBrandingEnabled,
        clientSupportMessage: dto.clientSupportMessage !== undefined
          ? this.normalizeNullableText(dto.clientSupportMessage, 500)
          : current.clientSupportMessage,
      };

      const result = await executor.query<TenantBrandSettingsRow>(
        `
          UPDATE tenant_brand_settings
          SET tenant_slug = $1,
              display_name = $2,
              legal_name = $3,
              support_email = $4,
              support_telegram = $5,
              support_url = $6,
              logo_url = $7,
              dashboard_title = $8,
              client_app_title = $9,
              primary_color = $10,
              accent_color = $11,
              public_branding_enabled = $12,
              client_support_message = $13,
              updated_by = $14,
              updated_at = now()
          WHERE setting_key = 'default'
          RETURNING
            setting_key AS "settingKey",
            tenant_slug AS "tenantSlug",
            display_name AS "displayName",
            legal_name AS "legalName",
            support_email AS "supportEmail",
            support_telegram AS "supportTelegram",
            support_url AS "supportUrl",
            logo_url AS "logoUrl",
            dashboard_title AS "dashboardTitle",
            client_app_title AS "clientAppTitle",
            primary_color AS "primaryColor",
            accent_color AS "accentColor",
            public_branding_enabled AS "publicBrandingEnabled",
            client_support_message AS "clientSupportMessage",
            updated_by AS "updatedBy",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        `,
        [
          next.tenantSlug,
          next.displayName,
          next.legalName,
          next.supportEmail,
          next.supportTelegram,
          next.supportUrl,
          next.logoUrl,
          next.dashboardTitle,
          next.clientAppTitle,
          next.primaryColor,
          next.accentColor,
          next.publicBrandingEnabled,
          next.clientSupportMessage,
          actor?.id ?? actor?.username ?? null,
        ],
      );

      await this.audit.record(
        actor,
        'tenant_brand_settings.update',
        'tenant_brand_settings',
        'default',
        {
          changedFields,
          tenantSlug: next.tenantSlug,
          publicBrandingEnabled: next.publicBrandingEnabled,
        },
        executor,
      );

      return result.rows[0];
    });

    return this.mapSettings(updated);
  }

  private async getSettingsRow(
    executor: DatabaseQueryExecutor,
    forUpdate = false,
  ): Promise<TenantBrandSettingsRow> {
    await executor.query(
      `
        INSERT INTO tenant_brand_settings (setting_key)
        VALUES ('default')
        ON CONFLICT (setting_key) DO NOTHING
      `,
    );

    const result = await executor.query<TenantBrandSettingsRow>(
      `
        SELECT
          setting_key AS "settingKey",
          tenant_slug AS "tenantSlug",
          display_name AS "displayName",
          legal_name AS "legalName",
          support_email AS "supportEmail",
          support_telegram AS "supportTelegram",
          support_url AS "supportUrl",
          logo_url AS "logoUrl",
          dashboard_title AS "dashboardTitle",
          client_app_title AS "clientAppTitle",
          primary_color AS "primaryColor",
          accent_color AS "accentColor",
          public_branding_enabled AS "publicBrandingEnabled",
          client_support_message AS "clientSupportMessage",
          updated_by AS "updatedBy",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM tenant_brand_settings
        WHERE setting_key = 'default'
        ${forUpdate ? 'FOR UPDATE' : ''}
      `,
    );

    if (!result.rows[0]) throw new BadRequestException('Tenant branding settings are not available');
    return result.rows[0];
  }

  private mapSettings(row: TenantBrandSettingsRow): AdminTenantBrandSettingsSummary {
    return {
      settingKey: row.settingKey,
      tenantSlug: row.tenantSlug,
      displayName: row.displayName,
      legalName: row.legalName,
      supportEmail: row.supportEmail,
      supportTelegram: row.supportTelegram,
      supportUrl: row.supportUrl,
      logoUrl: row.logoUrl,
      dashboardTitle: row.dashboardTitle,
      clientAppTitle: row.clientAppTitle,
      primaryColor: row.primaryColor,
      accentColor: row.accentColor,
      publicBrandingEnabled: row.publicBrandingEnabled,
      clientSupportMessage: row.clientSupportMessage,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private normalizeTenantSlug(value: string): string {
    const slug = value.trim().toLowerCase();
    if (!/^(default|[a-z0-9][a-z0-9-]{1,78}[a-z0-9])$/.test(slug)) {
      throw new BadRequestException('Tenant slug must use lowercase letters, numbers, and hyphens');
    }

    return slug;
  }

  private normalizeRequiredText(value: string, label: string, maxLength: number): string {
    const normalized = value.trim();
    if (!normalized) throw new BadRequestException(`${label} is required`);
    if (normalized.length > maxLength) throw new BadRequestException(`${label} is too long`);

    return normalized;
  }

  private normalizeNullableText(value: string | null | undefined, maxLength: number): string | null {
    if (value === null || value === undefined) return null;
    const normalized = value.trim();
    if (!normalized) return null;
    if (normalized.length > maxLength) throw new BadRequestException('Text value is too long');

    return normalized;
  }

  private normalizeEmail(value: string | null | undefined): string | null {
    const normalized = this.normalizeNullableText(value, 180);
    if (!normalized) return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new BadRequestException('Support email is invalid');
    }

    return normalized.toLowerCase();
  }

  private normalizeTelegram(value: string | null | undefined): string | null {
    const normalized = this.normalizeNullableText(value, 80);
    if (!normalized) return null;
    if (!/^@?[A-Za-z0-9_]{5,32}$/.test(normalized)) {
      throw new BadRequestException('Telegram username is invalid');
    }

    return normalized.startsWith('@') ? normalized : `@${normalized}`;
  }

  private normalizePublicUrl(value: string | null | undefined, label: string): string | null {
    const normalized = this.normalizeNullableText(value, 300);
    if (!normalized) return null;

    if (normalized.startsWith('/')) {
      if (normalized.startsWith('//') || normalized.includes('..')) {
        throw new BadRequestException(`${label} must be an https URL or a safe absolute path`);
      }

      return normalized;
    }

    try {
      const parsed = new URL(normalized);
      if (parsed.protocol !== 'https:') {
        throw new BadRequestException(`${label} must use https`);
      }
    } catch {
      throw new BadRequestException(`${label} is invalid`);
    }

    return normalized;
  }

  private normalizeColor(value: string, label: string): string {
    const normalized = value.trim();
    if (!/^#[0-9A-Fa-f]{6}$/.test(normalized)) {
      throw new BadRequestException(`${label} must be a 6-digit hex color`);
    }

    return normalized.toUpperCase();
  }
}
