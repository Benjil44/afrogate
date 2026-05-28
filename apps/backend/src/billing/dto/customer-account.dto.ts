import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const CUSTOMER_ACCOUNT_STATUSES = ['active', 'suspended', 'disabled'] as const;
export const CUSTOMER_QUOTA_SCOPES = ['account_shared', 'per_client'] as const;
export const CLIENT_CONFIG_STATUSES = ['active', 'limited', 'disabled', 'expired'] as const;

const MAX_SAFE_BYTES = Number.MAX_SAFE_INTEGER;

export class CreateCustomerAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  telegramId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  telegramUsername?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  paidNumber?: string | null;

  @IsOptional()
  @IsIn(CUSTOMER_ACCOUNT_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(CUSTOMER_QUOTA_SCOPES)
  quotaScope?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_SAFE_BYTES)
  quotaLimitBytes?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_SAFE_BYTES)
  perClientLimitBytes?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_SAFE_BYTES)
  usedBytes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdateCustomerAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  telegramId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  telegramUsername?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  paidNumber?: string | null;

  @IsOptional()
  @IsBoolean()
  clearPaidNumber?: boolean;

  @IsOptional()
  @IsIn(CUSTOMER_ACCOUNT_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(CUSTOMER_QUOTA_SCOPES)
  quotaScope?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_SAFE_BYTES)
  quotaLimitBytes?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_SAFE_BYTES)
  perClientLimitBytes?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_SAFE_BYTES)
  usedBytes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class CreateClientConfigDto {
  @IsString()
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  protocol?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  externalPanel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalPanelUserId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalPanelConfigId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  deviceLimit?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_SAFE_BYTES)
  quotaLimitBytes?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_SAFE_BYTES)
  usedBytes?: number;

  @IsOptional()
  @IsIn(CLIENT_CONFIG_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdateClientConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  protocol?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  externalPanel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalPanelUserId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalPanelConfigId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  deviceLimit?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_SAFE_BYTES)
  quotaLimitBytes?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_SAFE_BYTES)
  usedBytes?: number;

  @IsOptional()
  @IsIn(CLIENT_CONFIG_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
