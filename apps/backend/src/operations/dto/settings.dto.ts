import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const PROTOCOL_KINDS = ['wireguard', 'vless', 'l2tp', 'ikev2'] as const;
export const PROTOCOL_PROFILES = ['balanced', 'highSpeed', 'highSecurity', 'gaming'] as const;
export const ROUTE_PROTOCOL_PROFILES = ['balanced', 'highSpeed', 'highSecurity', 'gaming', 'tcp', 'udp', 'quic', 'dns', 'wireguard'] as const;
export const ROUTE_SELECTION_MODES = ['automatic', 'manual'] as const;
export const LOAD_BALANCE_STRATEGIES = ['balanced', 'stability', 'throughput'] as const;
export const SETTINGS_SECRET_KINDS = [
  'wireguardPrivateKey',
  'wireguardPresharedKey',
  'protocolCredential',
  'serverCredential',
] as const;

export class CreateSettingsSecretDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsIn(SETTINGS_SECRET_KINDS)
  kind!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(16000)
  secret!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  routeGroup?: string;

  @IsOptional()
  @IsIn(PROTOCOL_KINDS)
  protocol?: string;
}

export class CreateProtocolSetupDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsIn(PROTOCOL_KINDS)
  protocol!: string;

  @IsIn(PROTOCOL_PROFILES)
  profile!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  routeGroup?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  secretRef?: string | null;

  @IsOptional()
  @IsUUID()
  targetServerId?: string | null;
}

export class UpsertRouteSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  routeGroup?: string;

  @IsIn(ROUTE_SELECTION_MODES)
  mode!: string;

  @IsOptional()
  @IsUUID()
  selectedOutboundId?: string | null;

  @IsIn(LOAD_BALANCE_STRATEGIES)
  loadBalanceStrategy!: string;

  @IsOptional()
  @IsIn(ROUTE_PROTOCOL_PROFILES)
  protocolProfile?: string;

  @IsOptional()
  @IsIn(PROTOCOL_PROFILES)
  speedProfile?: string;
}

export class UpsertRouteAssignmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  routeGroup?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  assignmentKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  assignmentLabel?: string | null;

  @IsOptional()
  @IsUUID()
  currentOutboundId?: string | null;

  @IsOptional()
  @IsUUID()
  lockedOutboundId?: string | null;

  @IsOptional()
  @IsBoolean()
  autoRouteEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  routeLocked?: boolean;

  @IsOptional()
  @IsIn(ROUTE_PROTOCOL_PROFILES)
  protocolProfile?: string;

  @IsOptional()
  @IsIn(PROTOCOL_PROFILES)
  speedProfile?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  hysteresisScoreDelta?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(3600)
  cooldownSeconds?: number;
}

export class RecordRouteDecisionPreviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  routeGroup?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  assignmentKey?: string;
}

export class ApplyRouteDecisionPreviewDto extends RecordRouteDecisionPreviewDto {
  @IsOptional()
  @IsIn(['assignmentOnly'])
  applyMode?: string;
}
