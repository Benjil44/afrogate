export type HealthState = 'healthy' | 'degraded' | 'critical' | 'unknown';

export type Role = 'owner' | 'admin' | 'support' | 'auditor' | 'agent';

export const ROLE_PERMISSIONS = {
  owner: ['*'],
  admin: ['servers:write', 'routes:write', 'users:write', 'alerts:write'],
  support: ['users:read', 'users:support', 'alerts:read'],
  auditor: ['audit:read', 'reports:read'],
  agent: ['metrics:write'],
} as const;

export interface ServerMetricSnapshot {
  serverId: string;
  hostname?: string;
  platform?: string;
  observedAt: string;
  cpuPercent?: number | null;
  ramPercent?: number | null;
  diskFreePercent?: number | null;
  storages?: StorageVolumeMetric[];
  networkInterfaces?: NetworkInterfaceMetric[];
  inboundBps?: number | null;
  outboundBps?: number | null;
  pingMs?: number | null;
  jitterMs?: number | null;
  packetLossPercent?: number | null;
  healthScore: number;
}

export interface StorageVolumeMetric {
  path: string;
  device?: string | null;
  filesystem?: string | null;
  totalBytes?: number | null;
  freeBytes?: number | null;
  usedPercent?: number | null;
  freePercent?: number | null;
}

export interface NetworkInterfaceMetric {
  name: string;
  rxBytes?: number | null;
  txBytes?: number | null;
  rxBps?: number | null;
  txBps?: number | null;
}

export interface LatestMetricsResponse {
  servers: ServerMetricSnapshot[];
}

export type MetricsTimeRange = '15m' | '1h' | '6h' | '24h';

export interface MetricTimeseriesPoint {
  observedAt: string;
  cpuPercent?: number | null;
  ramPercent?: number | null;
  diskFreePercent?: number | null;
  inboundBps?: number | null;
  outboundBps?: number | null;
  pingMs?: number | null;
  jitterMs?: number | null;
  packetLossPercent?: number | null;
  healthScore: number;
}

export interface ServerMetricTimeseries {
  serverId: string;
  hostname?: string;
  platform?: string;
  points: MetricTimeseriesPoint[];
}

export interface MetricsTimeseriesResponse {
  range: MetricsTimeRange;
  bucketSeconds: number;
  series: ServerMetricTimeseries[];
}

export interface ApiEnvelope<T> {
  data: T;
  timestamp: string;
}

export type ServerAccessMethod = 'ssh_key' | 'temporary_root_password' | 'temporary_root_key' | 'existing_admin_key';

export type ServerBootstrapState = 'not_started' | 'pending' | 'installed' | 'failed' | 'revoked';

export interface ServerAccessProfileSummary {
  id: string;
  address: string;
  sshPort: number;
  username: string;
  accessMethod: ServerAccessMethod | string;
  bootstrapState: ServerBootstrapState | string;
  hasCredentialRef: boolean;
  lastTestedAt?: string | null;
  lastTestStatus?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminServerSummary {
  id: string;
  externalId: string;
  hostname?: string | null;
  platform?: string | null;
  country?: string | null;
  region?: string | null;
  role?: string | null;
  tags: string[];
  status: HealthState | string;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
  latestMetric?: ServerMetricSnapshot;
  accessProfile?: ServerAccessProfileSummary;
  outboundCount: number;
  openAlertCount: number;
}

export interface AdminServerDetail extends AdminServerSummary {
  outbounds: AdminOutboundSummary[];
}

export type OutboundType =
  | 'wireguard'
  | 'vless-local-proxy'
  | 'http-proxy'
  | 'socks-proxy'
  | 'direct'
  | 'custom';

export type OutboundHealthStatus = 'healthy' | 'degraded' | 'critical' | 'unknown';

export interface AdminOutboundSummary {
  id: string;
  serverId?: string | null;
  serverExternalId?: string | null;
  serverHostname?: string | null;
  name: string;
  type: OutboundType | string;
  routeGroup: string;
  priority: number;
  enabled: boolean;
  maintenanceMode: boolean;
  config: Record<string, unknown>;
  hasSecretRef: boolean;
  healthStatus: OutboundHealthStatus | string;
  healthIntervalSeconds: number;
  failThreshold: number;
  recoveryThreshold: number;
  cooldownSeconds: number;
  weight: number;
  maxUsers?: number | null;
  lastCheckedAt?: string | null;
  lastHealthyAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RouteFailoverEventSummary {
  id: string;
  routeGroup: string;
  fromOutboundId?: string | null;
  toOutboundId?: string | null;
  reason: string;
  triggerMetric: Record<string, unknown>;
  createdAt: string;
}

export interface AdminServersResponse {
  servers: AdminServerSummary[];
}

export interface AdminOutboundsResponse {
  outbounds: AdminOutboundSummary[];
}

export interface RouteFailoverEventsResponse {
  events: RouteFailoverEventSummary[];
}
