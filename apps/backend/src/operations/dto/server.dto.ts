import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const SERVER_ACCESS_METHODS = [
  'ssh_key',
  'temporary_root_password',
  'temporary_root_key',
  'existing_admin_key',
] as const;

export const SERVER_BOOTSTRAP_STATES = ['not_started', 'pending', 'installed', 'failed', 'revoked'] as const;

export class UpsertServerAccessProfileDto {
  @IsString()
  @MaxLength(255)
  address!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  sshPort?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  username?: string;

  @IsOptional()
  @IsIn(SERVER_ACCESS_METHODS)
  accessMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  credentialRef?: string | null;

  @IsOptional()
  @IsIn(SERVER_BOOTSTRAP_STATES)
  bootstrapState?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lastTestStatus?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class CreateServerDto {
  @IsString()
  @MaxLength(120)
  externalId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  hostname?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  platform?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  region?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  role?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpsertServerAccessProfileDto)
  accessProfile?: UpsertServerAccessProfileDto;
}

export class UpdateServerDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  hostname?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  platform?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  region?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  role?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpsertServerAccessProfileDto)
  accessProfile?: UpsertServerAccessProfileDto;
}
