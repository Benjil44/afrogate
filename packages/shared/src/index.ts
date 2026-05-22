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
  pingMs?: number | null;
  jitterMs?: number | null;
  packetLossPercent?: number | null;
  healthScore: number;
}

export interface ApiEnvelope<T> {
  data: T;
  timestamp: string;
}
