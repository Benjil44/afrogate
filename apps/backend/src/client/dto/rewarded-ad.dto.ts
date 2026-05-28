import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class ClaimRewardedAdDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  provider?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  adSessionId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  idempotencyKey?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
