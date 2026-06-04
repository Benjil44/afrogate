import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import type { UpdateTenantBrandSettingsRequest } from '@afrows/shared';

export class UpdateTenantBrandingDto implements UpdateTenantBrandSettingsRequest {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tenantSlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  legalName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  supportEmail?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  supportTelegram?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  supportUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  logoUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  dashboardTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientAppTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  accentColor?: string;

  @IsOptional()
  @IsBoolean()
  publicBrandingEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  clientSupportMessage?: string | null;
}
