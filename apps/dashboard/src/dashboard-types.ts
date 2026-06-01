import type { ComponentType, ReactNode } from 'react';
import type {
  AdminServerSummary,
  AdminWireGuardCandidate,
  NetworkInterfaceMetric,
  ProtocolKind,
  ProtocolProfile,
  RouteProbeMetric,
  StorageVolumeMetric,
  WireGuardInterfaceMetric,
} from '@afrogate/shared';

export type Tone = 'good' | 'neutral' | 'warning' | 'critical';
export type DataState = 'loading' | 'live' | 'stale' | 'fallback';
export type PanelStateKind = 'empty' | 'loading' | 'stale' | 'fallback' | 'error';
export type ActiveView = 'dashboard' | 'servers' | 'users' | 'audit' | 'backups' | 'billing' | 'reports' | 'routes' | 'alerts' | 'settings';
export type AlertStatusFilter = 'open' | 'resolved';
export type AlertSeverityFilter = 'all' | Tone;
export type ServerEditTab = 'overview' | 'access' | 'monitoring' | 'interfaces' | 'audit';
export type SettingsTab = 'route' | 'wireguard' | 'protocols' | 'branding' | 'telegram';
export type BillingTab = 'catalog' | 'customers' | 'panelImport' | 'telegram' | 'orders';
export type BackupsTab = 'monitor' | 'readiness' | 'restore';
export type RoutesTab = 'overview' | 'policy' | 'canary' | 'history';
export type UsersTab = 'adminUsers' | 'permissions';
export type AfroIcon = ComponentType<{ size?: number; className?: string }>;

export interface DashboardTabItem<T extends string> {
  id: T;
  label: string;
  meta?: string;
  disabled?: boolean;
}

export type TableCellAlign = 'left' | 'center' | 'right';

export interface DataTableColumn<Row> {
  key: string;
  header: string;
  render: (row: Row) => ReactNode;
  align?: TableCellAlign;
  alignRight?: boolean;
  className?: string;
}

export interface MetricCardData {
  label: string;
  value: string;
  tone: Tone;
}

export interface TrafficTotals {
  downloadBps: number | null;
  uploadBps: number | null;
}

export interface ServerRowData {
  id: string;
  externalId?: string;
  name: string;
  meta: string;
  status?: string;
  role?: string | null;
  region?: string | null;
  tags?: string[];
  cpu: number | null;
  ram: number | null;
  diskFree: number | null;
  storages: StorageVolumeMetric[];
  networkInterfaces: NetworkInterfaceMetric[];
  wireGuardInterfaces: WireGuardInterfaceMetric[];
  routeProbes: RouteProbeMetric[];
  inboundBps: number | null;
  outboundBps: number | null;
  pingMs: number | null;
  jitterMs: number | null;
  packetLossPercent: number | null;
  score: number;
  observedAt?: string;
  accessProfile?: AdminServerSummary['accessProfile'];
  outboundCount?: number;
  openAlertCount?: number;
  updatedAt?: string;
  source?: 'admin' | 'metrics' | 'sample';
}

export interface TunnelRowData {
  id?: string;
  name: string;
  operator: string;
  ping: number | null;
  jitter: number | null;
  loss: number | null;
  score: number;
  type?: string;
  serverLabel?: string | null;
  routeGroup?: string;
  status?: string;
  lockable?: boolean;
  localInterfaceName?: string | null;
  interfaceName?: string | null;
  remoteEndpoint?: string | null;
  updatedAt?: string;
}

export interface OutboundRowData {
  id: string;
  name: string;
  type: string;
  priority: number;
  statusText: string;
  statusTone: Tone;
  latencyMs: number | null;
  mode: string;
  usageMultiplier: number;
  serverLabel?: string | null;
}

export interface RouteFailoverRowData {
  id: string;
  title: string;
  detail: string;
  tone: Tone;
  createdAt?: string;
}

export interface AlertRowData {
  id: string;
  title: string;
  source: string;
  severity: Tone;
  message?: string;
  status?: string;
  lastSeenAt?: string;
  resolvedAt?: string | null;
  isPlaceholder?: boolean;
}

export interface WireGuardSetupDraft {
  serverName: string;
  interfaceName: string;
  routeGroup: string;
  addressCidr: string;
  listenPort: string;
  privateKey: string;
  peerPublicKey: string;
  endpoint: string;
  allowedIps: string;
  persistentKeepalive: string;
  healthTarget: string;
}

export type WireGuardHealthCandidate = Omit<AdminWireGuardCandidate, 'source'> & {
  source: AdminWireGuardCandidate['source'] | 'sample';
};

export interface ProtocolSetupDraft {
  name: string;
  protocol: ProtocolKind;
  profile: ProtocolProfile;
  port: string;
  routeGroup: string;
  targetServerId: string;
}

export interface TelegramBotSettingsForm {
  botToken: string;
  webhookSecret: string;
  alertChatId: string;
  allowedAdminChatIds: string;
  alertsEnabled: boolean;
  commandsEnabled: boolean;
}

export interface TenantBrandSettingsForm {
  tenantSlug: string;
  displayName: string;
  legalName: string;
  supportEmail: string;
  supportTelegram: string;
  supportUrl: string;
  logoUrl: string;
  dashboardTitle: string;
  clientAppTitle: string;
  primaryColor: string;
  accentColor: string;
  publicBrandingEnabled: boolean;
  clientSupportMessage: string;
}

export interface NavItemData {
  id: ActiveView;
  labelKey: ActiveView;
  icon: AfroIcon;
}

export interface SidebarAlertState {
  tone: 'warning' | 'critical';
  countLabel: string;
}
