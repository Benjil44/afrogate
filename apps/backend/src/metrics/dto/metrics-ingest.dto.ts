import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

class StorageVolumeMetricDto {
  @IsString()
  path!: string;

  @IsOptional()
  @IsString()
  device?: string | null;

  @IsOptional()
  @IsString()
  filesystem?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalBytes?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  freeBytes?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  usedPercent?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  freePercent?: number | null;
}

class NetworkInterfaceMetricDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rxBytes?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  txBytes?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rxBps?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  txBps?: number | null;
}

export class MetricsIngestDto {
  @IsString()
  serverId!: string;

  @IsOptional()
  @IsString()
  hostname?: string;

  @IsOptional()
  @IsString()
  platform?: string;

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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StorageVolumeMetricDto)
  storages?: StorageVolumeMetricDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NetworkInterfaceMetricDto)
  networkInterfaces?: NetworkInterfaceMetricDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  inboundBps?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  outboundBps?: number;

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
