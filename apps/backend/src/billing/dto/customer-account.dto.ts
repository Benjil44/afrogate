import { Type } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  IsBoolean,
  IsDefined,
  IsArray,
  IsISO8601,
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

export const CUSTOMER_ACCOUNT_STATUSES = ['active', 'suspended', 'disabled'] as const;
export const CUSTOMER_QUOTA_SCOPES = ['account_shared', 'per_client'] as const;
export const CLIENT_CONFIG_STATUSES = ['active', 'limited', 'disabled', 'expired'] as const;
export const CLIENT_ROUTE_PREFERENCE_MODES = ['auto', 'country', 'outbound'] as const;
export const CLIENT_ROUTE_DETECTION_SOURCES = ['client_app', 'edge_ip', 'admin', 'unknown'] as const;
export const CLIENT_ROUTE_SCORE_PROFILES = [
  'balanced',
  'stability',
  'throughput',
  'gaming',
  'tcp',
  'udp',
  'quic',
  'dns',
  'wireguard',
] as const;
export const CLIENT_USAGE_EVENT_SOURCES = [
  'admin',
  'agent',
  'panel_sync',
  'payment_adjustment',
  'manual_adjustment',
  'client_report',
  'unknown',
] as const;
export const CLIENT_USAGE_DIRECTIONS = ['rx', 'tx', 'combined'] as const;
export const CLIENT_SUBSCRIPTION_CREDENTIAL_PROTOCOLS = ['wireguard', 'vless', 'l2tp', 'ikev2'] as const;
export const CURRENT_PANEL_VOLUME_CHARGE_SCOPES = ['account_quota', 'selected_clients', 'account_and_selected_clients'] as const;

const MAX_SAFE_BYTES = Number.MAX_SAFE_INTEGER;

export class CreateCustomerAccountDto {
  @IsOptional()
  @IsUUID('4')
  resellerAccountId?: string | null;

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
  @IsString()
  @MaxLength(160)
  loginEmail?: string | null;

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
  @IsUUID('4')
  resellerAccountId?: string | null;

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

export class CurrentPanelImportPreviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  panelKind?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceName?: string | null;

  @IsDefined()
  @Allow()
  payload!: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  defaultProtocol?: string;
}

export class CurrentPanelImportConfigsDto extends CurrentPanelImportPreviewDto {
  @IsUUID('4')
  customerAccountId!: string;
}

export class CurrentPanelUsageSyncDto extends CurrentPanelImportPreviewDto {
  @IsUUID('4')
  customerAccountId!: string;
}

export class CurrentPanelVolumeChargeDto {
  @IsUUID('4')
  customerAccountId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SAFE_BYTES)
  volumeBytesDelta!: number;

  @IsOptional()
  @IsIn(CURRENT_PANEL_VOLUME_CHARGE_SCOPES)
  scope?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  clientConfigIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(160)
  idempotencyKey?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;

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

export class UpsertClientRoutePreferenceDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  routeGroup?: string;

  @IsOptional()
  @IsIn(CLIENT_ROUTE_PREFERENCE_MODES)
  mode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  detectedCountryCode?: string | null;

  @IsOptional()
  @IsIn(CLIENT_ROUTE_DETECTION_SOURCES)
  detectedCountrySource?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  preferredExitCountryCode?: string | null;

  @IsOptional()
  @IsUUID()
  preferredOutboundId?: string | null;

  @IsOptional()
  @IsIn(CLIENT_ROUTE_SCORE_PROFILES)
  scoreProfile?: string;

  @IsOptional()
  @IsBoolean()
  autoDetectCountry?: boolean;

  @IsOptional()
  @IsBoolean()
  allowClientOverride?: boolean;

  @IsOptional()
  @IsBoolean()
  routeLocked?: boolean;

  @IsOptional()
  @IsBoolean()
  stickySessionProtection?: boolean;
}

export class CreateClientUsageEventDto {
  @IsOptional()
  @IsIn(CLIENT_USAGE_EVENT_SOURCES)
  source?: string;

  @IsOptional()
  @IsIn(CLIENT_USAGE_DIRECTIONS)
  direction?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_SAFE_BYTES)
  usedBytesDelta?: number;

  @IsOptional()
  @IsUUID()
  outboundId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_SAFE_BYTES)
  rxBytes?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_SAFE_BYTES)
  txBytes?: number | null;

  @IsOptional()
  @IsISO8601()
  observedAt?: string;

  @IsOptional()
  @IsISO8601()
  windowStart?: string | null;

  @IsOptional()
  @IsISO8601()
  windowEnd?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  idempotencyKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  externalReference?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpsertClientSubscriptionCredentialDto {
  @IsUUID()
  outboundId!: string;

  @IsOptional()
  @IsIn(CLIENT_SUBSCRIPTION_CREDENTIAL_PROTOCOLS)
  protocol?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string | null;

  @IsObject()
  secretMaterial!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  publicMetadata?: Record<string, unknown> | null;
}
