import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const SERVER_INTERFACE_STATUSES = ['up', 'down', 'degraded', 'unknown'] as const;
export const TUNNEL_STATUSES = ['up', 'down', 'degraded', 'unknown'] as const;
export const TUNNEL_TYPES = ['wireguard', 'vless', 'l2tp', 'ikev2', 'custom'] as const;

export class CreateServerInterfaceDto {
  @IsUUID()
  serverId!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  operator?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  kind?: string;

  @IsOptional()
  @IsIn(SERVER_INTERFACE_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  macAddress?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  addressCidr?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdateServerInterfaceDto {
  @IsOptional()
  @IsUUID()
  serverId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  operator?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  kind?: string;

  @IsOptional()
  @IsIn(SERVER_INTERFACE_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  macAddress?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  addressCidr?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class CreateTunnelDto {
  @IsUUID()
  serverId!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsIn(TUNNEL_TYPES)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remoteEndpoint?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  interfaceName?: string | null;

  @IsOptional()
  @IsUUID()
  localInterfaceId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  routeGroup?: string;

  @IsOptional()
  @IsIn(TUNNEL_STATUSES)
  status?: string;

  @IsOptional()
  @IsBoolean()
  lockable?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdateTunnelDto {
  @IsOptional()
  @IsUUID()
  serverId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(TUNNEL_TYPES)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remoteEndpoint?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  interfaceName?: string | null;

  @IsOptional()
  @IsUUID()
  localInterfaceId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  routeGroup?: string;

  @IsOptional()
  @IsIn(TUNNEL_STATUSES)
  status?: string;

  @IsOptional()
  @IsBoolean()
  lockable?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
