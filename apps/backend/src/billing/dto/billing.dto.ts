import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const VOLUME_PACKAGE_STATUSES = ['active', 'archived'] as const;
export const PAYMENT_METHOD_STATUSES = ['active', 'disabled'] as const;
export const PAYMENT_CHECKOUT_MODES = ['manual', 'hosted_redirect', 'external_link', 'provider_sdk'] as const;
export const PAYMENT_ORDER_STATUSES = ['pending', 'paid', 'failed', 'refunded'] as const;

const MAX_PRICE = 1_000_000_000_000;
const MAX_VOLUME_GB = 1_000_000;
const MAX_DURATION_DAYS = 3650;
const MAX_AMOUNT = Number.MAX_SAFE_INTEGER;

export class UpdateBillingSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(16)
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  pricePerGb?: number;
}

export class CreateVolumePackageDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_VOLUME_GB)
  volumeGb!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_DURATION_DAYS)
  durationDays?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  pricePerGb?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  totalPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  currency?: string;

  @IsOptional()
  @IsIn(VOLUME_PACKAGE_STATUSES)
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdateVolumePackageDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_VOLUME_GB)
  volumeGb?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_DURATION_DAYS)
  durationDays?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  pricePerGb?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  totalPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  currency?: string;

  @IsOptional()
  @IsIn(VOLUME_PACKAGE_STATUSES)
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class CreatePaymentMethodDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  provider?: string;

  @IsOptional()
  @IsIn(PAYMENT_CHECKOUT_MODES)
  checkoutMode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_AMOUNT)
  minAmount?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_AMOUNT)
  maxAmount?: number | null;

  @IsOptional()
  @IsIn(PAYMENT_METHOD_STATUSES)
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  supportsAutoCapture?: boolean;

  @IsOptional()
  @IsObject()
  publicConfig?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string | null;
}

export class UpdatePaymentMethodDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  provider?: string;

  @IsOptional()
  @IsIn(PAYMENT_CHECKOUT_MODES)
  checkoutMode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_AMOUNT)
  minAmount?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_AMOUNT)
  maxAmount?: number | null;

  @IsOptional()
  @IsIn(PAYMENT_METHOD_STATUSES)
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  supportsAutoCapture?: boolean;

  @IsOptional()
  @IsObject()
  publicConfig?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string | null;
}

export class CreatePaymentOrderDto {
  @IsUUID('4')
  customerAccountId!: string;

  @IsUUID('4')
  volumePackageId!: string;

  @IsUUID('4')
  paymentMethodId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  providerOrderId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  checkoutUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  idempotencyKey?: string | null;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class UpdatePaymentOrderStatusDto {
  @IsIn(PAYMENT_ORDER_STATUSES)
  status!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  providerOrderId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  providerCaptureId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  checkoutUrl?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class CreatePayPalCheckoutDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  returnUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  cancelUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  idempotencyKey?: string | null;
}

export class CapturePayPalPaymentOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  providerOrderId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  idempotencyKey?: string | null;
}
