import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { CreateCustomerAccountDto } from './customer-account.dto';

export const RESELLER_ACCOUNT_STATUSES = ['active', 'suspended', 'disabled'] as const;

const MAX_AMOUNT = Number.MAX_SAFE_INTEGER;
const MAX_MARGIN_BPS = 8000;
const MAX_SALE_GB = 1_000_000;
const MAX_RESELLER_CUSTOMERS = 1_000_000;

export class CreateResellerAccountDto {
  /**
   * Link an EXISTING reseller-role login. Provide EITHER this OR the
   * newLogin* fields below (one-step onboarding). The controller validates
   * that exactly one path is used.
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  adminUserId?: string;

  /** One-step onboarding: create a fresh reseller-role login with these credentials. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  newLoginUsername?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  newLoginPassword?: string;

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

  /** Per-seller customer cap; null/omitted = unlimited. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_RESELLER_CUSTOMERS)
  maxCustomers?: number | null;

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

  /** Per-seller customer cap; null clears it (unlimited). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_RESELLER_CUSTOMERS)
  maxCustomers?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

/**
 * Seller self-service submission to link their Telegram account for bot access.
 * Goes to 'pending' review — a superadmin must approve before the bot grants a
 * seller session for this Telegram id. See migration 0061.
 */
export class RequestResellerTelegramLinkDto {
  /** The seller's phone number, for the superadmin to verify against WHO they are. */
  @IsString()
  @MinLength(5)
  @MaxLength(32)
  phone!: string;

  /** Telegram's numeric user id (e.g. via @userinfobot), NOT the @username. */
  @IsString()
  @MinLength(5)
  @MaxLength(20)
  telegramId!: string;

  /** Card number shown to the seller's customers for card-to-card payment. */
  @IsString()
  @MinLength(6)
  @MaxLength(64)
  cardInfo!: string;
}

/**
 * Seller self-service card update, decoupled from the Telegram-link request.
 * Changing the card a seller's customers pay must NOT cost them bot access, so
 * this never touches telegram_link_status (unlike RequestResellerTelegramLinkDto,
 * which always re-enters 'pending' review).
 */
export class UpdateResellerCardInfoDto {
  /** Card number (optionally "number | holder name") shown to the seller's customers. */
  @IsString()
  @MinLength(6)
  @MaxLength(64)
  cardInfo!: string;
}

export class RejectResellerTelegramLinkDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
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

export class CreateResellerGbChargeDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(MAX_SALE_GB)
  gb!: number;

  @IsOptional()
  @IsUUID('4')
  customerAccountId?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCustomerAccountDto)
  customerAccount?: CreateCustomerAccountDto | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  idempotencyKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}

export class CreateResellerTopupRequestDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_AMOUNT)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class RejectResellerTopupDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}

export class CreateResellerPackageSaleDto {
  @IsUUID('4')
  volumePackageId!: string;

  @IsOptional()
  @IsUUID('4')
  customerAccountId?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCustomerAccountDto)
  customerAccount?: CreateCustomerAccountDto | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  idempotencyKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
