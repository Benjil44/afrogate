import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class RewardedAdProviderWebhookDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  provider?: string | null;

  @IsUUID('4')
  clientConfigId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  adSessionId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  idempotencyKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  providerEventId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  adUnitId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  placementId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  rewardAmount?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  rewardCurrency?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  eventTimestamp?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
