import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import type { RegisterAgentRequest } from '@afrows/shared';

export class RegisterAgentDto implements RegisterAgentRequest {
  @IsString()
  @MaxLength(120)
  serverExternalId!: string;

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
  @MaxLength(80)
  tokenName?: string;

  @IsOptional()
  @IsBoolean()
  revokeExistingTokens?: boolean;
}
