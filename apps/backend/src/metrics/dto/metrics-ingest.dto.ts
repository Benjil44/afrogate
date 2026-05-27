import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

const WIREGUARD_PEER_STATUSES = ['active', 'stale', 'never', 'unknown'] as const;
const WIREGUARD_INTERFACE_STATUSES = ['up', 'degraded', 'down', 'unknown'] as const;
const ROUTE_PROBE_PROTOCOLS = ['tcp', 'udp', 'quic', 'dns', 'wireguard'] as const;
const ROUTE_PROBE_STATUSES = ['healthy', 'degraded', 'critical', 'unknown'] as const;
const ROUTE_SCORE_PROFILES = ['balanced', 'stability', 'throughput', 'gaming', 'tcp', 'udp', 'quic', 'dns', 'wireguard'] as const;

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

class WireGuardPeerMetricDto {
  @IsString()
  publicKeyHash!: string;

  @IsOptional()
  @IsString()
  latestHandshakeAt?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  latestHandshakeAgeSeconds?: number | null;

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

  @IsOptional()
  @IsNumber()
  @Min(0)
  persistentKeepaliveSeconds?: number | null;

  @IsIn(WIREGUARD_PEER_STATUSES)
  status!: string;
}

class WireGuardInterfaceMetricDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(65535)
  listenPort?: number | null;

  @IsNumber()
  @Min(0)
  peerCount!: number;

  @IsNumber()
  @Min(0)
  activePeerCount!: number;

  @IsOptional()
  @IsString()
  latestHandshakeAt?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  latestHandshakeAgeSeconds?: number | null;

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

  @IsIn(WIREGUARD_INTERFACE_STATUSES)
  status!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WireGuardPeerMetricDto)
  peers?: WireGuardPeerMetricDto[];
}

class RouteProbeMetricDto {
  @IsIn(ROUTE_PROBE_PROTOCOLS)
  protocol!: string;

  @IsString()
  target!: string;

  @IsOptional()
  @IsString()
  mode?: string | null;

  @IsOptional()
  @IsString()
  routeGroup?: string | null;

  @IsOptional()
  @IsString()
  outboundId?: string | null;

  @IsOptional()
  @IsString()
  outboundKey?: string | null;

  @IsOptional()
  @IsString()
  outboundName?: string | null;

  @IsOptional()
  @IsString()
  operator?: string | null;

  @IsOptional()
  @IsIn(ROUTE_SCORE_PROFILES)
  scoreProfile?: string | null;

  @IsIn(ROUTE_PROBE_STATUSES)
  status!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  latencyMs?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  jitterMs?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  packetLossPercent?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  loadedLatencyMs?: number | null;

  @IsOptional()
  @IsNumber()
  loadedLatencyDeltaMs?: number | null;

  @IsOptional()
  @IsString()
  checkedAt?: string | null;
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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WireGuardInterfaceMetricDto)
  wireGuardInterfaces?: WireGuardInterfaceMetricDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteProbeMetricDto)
  routeProbes?: RouteProbeMetricDto[];

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
