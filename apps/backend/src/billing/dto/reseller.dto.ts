import { Type } from 'class-transformer';
import { IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export const RESELLER_ACCOUNT_STATUSES = ['active', 'suspended', 'disabled'] as const;

const MAX_AMOUNT = Number.MAX_SAFE_INTEGER;
const MAX_MARGIN_BPS = 8000;

export class CreateResellerAccountDto {
  @IsString()
  @MaxLength(120)
  adminUserId!: string;

  @IsString()
  @MaxLength(120)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  telegramUsername?: string | null;

  @IsOptional()
  @IsIn(RESELLER_ACCOUNT_STATUSES)
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_MARGIN_BPS)
  sellerMarginBps?: number;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_AMOUNT)
  creditLimitAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdateResellerAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  telegramUsername?: string | null;

  @IsOptional()
  @IsIn(RESELLER_ACCOUNT_STATUSES)
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_MARGIN_BPS)
  sellerMarginBps?: number;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_AMOUNT)
  creditLimitAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class TopUpResellerWalletDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_AMOUNT)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  idempotencyKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  sourceId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}

export class DebitResellerWalletForPackageDto {
  @IsUUID('4')
  volumePackageId!: string;

  @IsOptional()
  @IsUUID('4')
  customerAccountId?: string | null;

  @IsOptional()
  @IsUUID('4')
  clientConfigId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  idempotencyKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  sourceId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
