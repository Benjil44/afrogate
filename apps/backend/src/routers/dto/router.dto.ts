import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export const MIKROTIK_ROUTER_KINDS = ['village', 'home', 'other'] as const;
export const MIKROTIK_MODES = ['game', 'normal'] as const;

export class CreateMikroTikRouterDto {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{0,62}$/, { message: 'id must be lowercase letters, numbers, dashes' })
  id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label!: string;

  @IsOptional()
  @IsIn(MIKROTIK_ROUTER_KINDS)
  kind?: (typeof MIKROTIK_ROUTER_KINDS)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  host!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  restPort?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  restUser?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  password?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  webfigUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  gamingSourceIp?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdateMikroTikRouterDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsIn(MIKROTIK_ROUTER_KINDS)
  kind?: (typeof MIKROTIK_ROUTER_KINDS)[number];

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  host?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  restPort?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  restUser?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  password?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  webfigUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  gamingSourceIp?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class SetMikroTikModeDto {
  @IsIn(MIKROTIK_MODES)
  mode!: (typeof MIKROTIK_MODES)[number];
}

export class SetEgressDto {
  @IsBoolean()
  enabled!: boolean;
}

export class ReconnectModemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  interface!: string;
}

export class SetWgRateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  peerKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string | null;

  @IsNumber()
  @Min(0)
  @Max(1_000_000_000)
  pricePerGb!: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string | null;
}
