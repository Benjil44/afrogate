export type HealthState = 'healthy' | 'degraded' | 'critical' | 'unknown';

export interface ServerMetricSnapshot {
  serverId: string;
  hostname?: string;
  observedAt: string;
  cpuPercent?: number | null;
  ramPercent?: number | null;
  diskFreePercent?: number | null;
  pingMs?: number | null;
  jitterMs?: number | null;
  packetLossPercent?: number | null;
  healthScore: number;
}

export interface ApiEnvelope<T> {
  data: T;
  timestamp: string;
}

