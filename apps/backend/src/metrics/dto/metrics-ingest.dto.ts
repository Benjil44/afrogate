import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class MetricsIngestDto {
  @IsString()
  serverId!: string;

  @IsOptional()
  @IsString()
  hostname?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  cpuPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ramPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  diskFreePercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pingMs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  jitterMs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  packetLossPercent?: number;
}

