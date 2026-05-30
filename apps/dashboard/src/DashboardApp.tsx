import { useEffect, useMemo, useState, type ComponentType, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import type {
  AdminAlertSummary,
  AdminAuditLogSummary,
  AdminBackupRestoreCheckSummary,
  AdminBackupRestorePlanStepSummary,
  AdminBackupRestorePlanSummary,
  AdminBackupStatusSummary,
  AdminBillingSettingsSummary,
  AdminClientConfigsExportResponse,
  AdminCurrentPanelImportConfigsResponse,
  AdminCurrentPanelImportPreviewResponse,
  AdminCurrentPanelUsageSyncResponse,
  AdminCurrentPanelVolumeChargeResponse,
  AdminCustomerAccountSummary,
  AdminPaymentMethodSummary,
  AdminPaymentOrderSummary,
  AdminPaymentProviderAdapterSummary,
  AdminPermissionId,
  AdminPermissionsResponse,
  AdminResellerAccountSummary,
  AdminResellerPackageSaleResponse,
  AdminResellerWalletLedgerEntry,
  AdminProtocolServerApplyAdapterSummary,
  AdminProtocolServerApplyEventDetail,
  AdminProtocolServerApplyEventSummary,
  AdminProtocolSetupSummary,
  AdminProtocolServerApplyPlanSummary,
  AdminProtocolServerApplyPreflightSummary,
  AdminOutboundSummary,
  AdminIncidentTimelineEvent,
  AdminIncidentTimelineResponse,
  AdminRouteAssignmentSummary,
  AdminRouteCanaryStatusResponse,
  AdminRouteDecisionApplyAdapterSummary,
  AdminRouteDecisionApplyPlanSummary,
  AdminRouteDecisionApplyPlanStep,
  AdminRouteDecisionEventDetail,
  AdminRouteDecisionEventSummary,
  AdminRouteHealthHistoryResponse,
  AdminRouteQualityAnalyticsResponse,
  AdminRouteDecisionCandidateSummary,
  AdminRouteDecisionCandidateReviewSummary,
  AdminRouteDecisionClientPreferenceSummary,
  AdminRouteDecisionLoadBalancingSummary,
  AdminRouteDecisionProfileRecommendation,
  AdminRouteDecisionPreviewResponse,
  AdminRouteDecisionSessionSafetySummary,
  AdminRouteDecisionSwitchExecutionSummary,
  AdminRouteDecisionSwitchEngineSummary,
  AdminRouteDecisionSwitchOrchestrationSummary,
  AdminRouteDecisionSwitchPreflightSummary,
  AdminRouteDecisionSwitchRolloutEvaluationSummary,
  AdminRouteDecisionSwitchRolloutSummary,
  AdminServerSummary,
  AdminServerInterfaceSummary,
  AdminRewardedAdSettingsSummary,
  AdminReportsSummaryResponse,
  AdminSettingsResponse,
  AdminSessionResponse,
  AdminTelegramBotSettingsSummary,
  AdminTenantBrandSettingsSummary,
  AdminTunnelSummary,
  AdminVolumePackageSummary,
  AdminWireGuardCandidate,
  CurrentPanelKind,
  CustomerAccountStatus,
  CustomerQuotaScope,
  LoadBalanceStrategy,
  AdminUserSummary,
  MetricsTimeRange,
  NetworkInterfaceMetric,
  ProtocolKind,
  ProtocolProfile,
  RouteFailoverEventSummary,
  RouteDecisionAction,
  RouteQualityRecommendation,
  RouteProbeMetric,
  RouteSelectionMode,
  Role,
  ServerAccessMethod,
  ServerBootstrapState,
  ServerCredentialKind,
  AdminServerDetail,
  ServerMetricSnapshot,
  ServerMetricTimeseries,
  StorageVolumeMetric,
  WireGuardInterfaceMetric,
  RouteHealthHistoryPoint,
} from '@afrogate/shared';
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowDownUp,
  Bell,
  Bot,
  CheckCircle2,
  Clock,
  CreditCard,
  Cpu,
  Download,
  Eye,
  EyeOff,
  Gauge,
  HardDrive,
  Inbox,
  Languages,
  LockKeyhole,
  Loader2,
  LogIn,
  LogOut,
  Maximize2,
  MemoryStick,
  Minimize2,
  Network,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Route,
  ScrollText,
  Server,
  Settings as SettingsIcon,
  ShieldCheck,
  Upload,
  UserRound,
  Gift,
  WifiOff,
} from 'lucide-react';
import rootPackage from '../../../package.json';
import { useAdminSession } from './auth';
import {
  createAdminCustomerAccount,
  createAdminResellerPackageSale,
  createAdminResellerCustomerAccount,
  chargeAdminCurrentPanelVolume,
  createAdminProtocolSetup,
  createAdminSettingsSecret,
  createAdminUser,
  deleteAdminUser,
  exportAdminCustomerClientConfigs,
  fetchAdminAlerts,
  fetchAdminAuditLogs,
  fetchAdminBackupRestorePlan,
  fetchAdminBackupStatus,
  fetchAdminBillingCatalog,
  fetchAdminCustomerAccounts,
  fetchAdminOutbounds,
  fetchAdminPermissions,
  fetchAdminPaymentOrders,
  fetchAdminReportsSummary,
  fetchAdminRewardedAdSettings,
  fetchAdminResellerWorkspace,
  fetchAdminServer,
  fetchAdminServerInterfaces,
  fetchAdminServers,
  fetchAdminSettings,
  fetchAdminTelegramBotSettings,
  fetchAdminTenantBranding,
  fetchAdminTunnel,
  fetchAdminTunnels,
  fetchAdminUsers,
  fetchIncidentTimeline,
  importAdminCurrentPanelConfigs,
  previewAdminCurrentPanelImport,
  syncAdminCurrentPanelUsage,
  fetchProtocolServerApplyEvent,
  fetchProtocolServerApplyEvents,
  fetchRouteAssignment,
  fetchRouteCanaryStatus,
  fetchRouteFailoverEvents,
  fetchRouteHealthHistory,
  fetchRouteQualityAnalytics,
  fetchRouteDecisionEvent,
  fetchRouteDecisionEvents,
  fetchRouteDecisionPreview,
  provisionAdminProtocolSetup,
  recordAdminProtocolServerApplyDryRun,
  recordRouteDecisionPreview,
  requestAdminProtocolServerApply,
  storeAdminServerCredential,
  testAdminTelegramBotConnection,
  updateAdminRouteAssignment,
  updateAdminRouteSettings,
  updateAdminCustomerAccount,
  updateAdminResellerCustomerAccount,
  updateAdminRewardedAdSettings,
  updateAdminServer,
  updateAdminTelegramBotSettings,
  updateAdminTenantBranding,
  updateAdminUser,
  updateAdminUserPassword,
  applyRouteDecisionPreview,
} from './api/admin';
import { fetchLatestMetrics, fetchMetricsTimeseries } from './api/metrics';
import { EChart, type AfroChartOption } from './components/EChart';
import { useDashboardLanguage, type DashboardLanguage, type DashboardStrings } from './i18n';

type Tone = 'good' | 'neutral' | 'warning' | 'critical';
type DataState = 'loading' | 'live' | 'stale' | 'fallback';
type PanelStateKind = 'empty' | 'loading' | 'stale' | 'fallback' | 'error';
type ActiveView = 'dashboard' | 'servers' | 'users' | 'audit' | 'backups' | 'billing' | 'reports' | 'routes' | 'alerts' | 'settings';
type AlertStatusFilter = 'open' | 'resolved';
type AlertSeverityFilter = 'all' | Tone;
type ServerEditTab = 'overview' | 'access' | 'monitoring' | 'interfaces' | 'audit';
type AfroIcon = ComponentType<{ size?: number; className?: string }>;
type AdminSessionHook = ReturnType<typeof useAdminSession>;

interface MetricCardData {
  label: string;
  value: string;
  tone: Tone;
}

interface TrafficTotals {
  downloadBps: number | null;
  uploadBps: number | null;
}

interface ServerRowData {
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

interface TunnelRowData {
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

interface OutboundRowData {
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

interface RouteFailoverRowData {
  id: string;
  title: string;
  detail: string;
  tone: Tone;
  createdAt?: string;
}

interface AlertRowData {
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

interface WireGuardSetupDraft {
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

type WireGuardHealthCandidate = Omit<AdminWireGuardCandidate, 'source'> & {
  source: AdminWireGuardCandidate['source'] | 'sample';
};

interface ProtocolSetupDraft {
  name: string;
  protocol: ProtocolKind;
  profile: ProtocolProfile;
  port: string;
  routeGroup: string;
  targetServerId: string;
}

interface TelegramBotSettingsForm {
  botToken: string;
  webhookSecret: string;
  alertChatId: string;
  allowedAdminChatIds: string;
  alertsEnabled: boolean;
  commandsEnabled: boolean;
}

interface TenantBrandSettingsForm {
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

interface NavItemData {
  id: ActiveView;
  labelKey: ActiveView;
  icon: AfroIcon;
}

interface SidebarAlertState {
  tone: 'warning' | 'critical';
  countLabel: string;
}

type DashboardFormatters = ReturnType<typeof createDashboardFormatters>;

const refreshIntervalMs = 10_000;
const timeRanges: Array<{ label: string; value: MetricsTimeRange }> = [
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '6h', value: '6h' },
  { label: '24h', value: '24h' },
];

const fallbackServers: ServerRowData[] = [
  {
    id: 'iran-edge-01',
    name: 'Iran Edge 01',
    meta: 'IR',
    cpu: 38,
    ram: 51,
    diskFree: 64,
    storages: [{ path: '/', freePercent: 64, usedPercent: 36 }],
    networkInterfaces: [{ name: 'ether1', rxBps: 7_800_000, txBps: 3_200_000 }],
    routeProbes: [],
    wireGuardInterfaces: [
      {
        name: 'wg1',
        listenPort: 51820,
        peerCount: 12,
        activePeerCount: 11,
        latestHandshakeAgeSeconds: 24,
        rxBps: 4_900_000,
        txBps: 2_100_000,
        status: 'degraded',
      },
    ],
    inboundBps: 7_800_000,
    outboundBps: 3_200_000,
    pingMs: 48,
    jitterMs: 5,
    packetLossPercent: 0.1,
    score: 94,
  },
  {
    id: 'iran-edge-02',
    name: 'Iran Edge 02',
    meta: 'IR',
    cpu: 44,
    ram: 58,
    diskFree: 71,
    storages: [{ path: '/', freePercent: 71, usedPercent: 29 }],
    networkInterfaces: [{ name: 'ether2', rxBps: 6_400_000, txBps: 2_700_000 }],
    routeProbes: [],
    wireGuardInterfaces: [
      {
        name: 'wireguard2',
        listenPort: 51821,
        peerCount: 8,
        activePeerCount: 8,
        latestHandshakeAgeSeconds: 18,
        rxBps: 3_700_000,
        txBps: 1_800_000,
        status: 'up',
      },
    ],
    inboundBps: 6_400_000,
    outboundBps: 2_700_000,
    pingMs: 63,
    jitterMs: 9,
    packetLossPercent: 0.3,
    score: 91,
  },
  {
    id: 'germany-core-01',
    name: 'Germany Core 01',
    meta: 'DE',
    cpu: 29,
    ram: 47,
    diskFree: 82,
    storages: [{ path: '/', freePercent: 82, usedPercent: 18 }],
    networkInterfaces: [{ name: 'wg-core', rxBps: 12_500_000, txBps: 9_100_000 }],
    routeProbes: [],
    wireGuardInterfaces: [
      {
        name: 'wg-core',
        listenPort: 51820,
        peerCount: 24,
        activePeerCount: 24,
        latestHandshakeAgeSeconds: 11,
        rxBps: 12_500_000,
        txBps: 9_100_000,
        status: 'up',
      },
    ],
    inboundBps: 12_500_000,
    outboundBps: 9_100_000,
    pingMs: 42,
    jitterMs: 4,
    packetLossPercent: 0.0,
    score: 96,
  },
];

const tunnels: TunnelRowData[] = [
  { name: 'wg1', operator: 'Mobinnet', ping: 46, jitter: 8, loss: 0.1, score: 95 },
  { name: 'wireguard2', operator: 'Irancell', ping: 62, jitter: 14, loss: 0.3, score: 86 },
  { name: 'wireguard3', operator: 'Irancell', ping: 58, jitter: 11, loss: 0.2, score: 89 },
];

const outbounds: OutboundRowData[] = [
  {
    id: 'sample-germany-gateway',
    name: 'Germany gateway',
    type: 'WireGuard',
    priority: 1,
    statusText: 'healthy',
    statusTone: 'good',
    latencyMs: 50,
    mode: 'primary',
    usageMultiplier: 1,
  },
  {
    id: 'sample-control-egress',
    name: 'Control egress',
    type: 'VLESS proxy',
    priority: 2,
    statusText: 'standby',
    statusTone: 'neutral',
    latencyMs: 67,
    mode: 'telegram/api',
    usageMultiplier: 2,
  },
  {
    id: 'sample-iran-direct',
    name: 'Iran direct',
    type: 'Direct',
    priority: 3,
    statusText: 'restricted',
    statusTone: 'warning',
    latencyMs: null,
    mode: 'last resort',
    usageMultiplier: 1,
  },
];

const navItems: NavItemData[] = [
  { id: 'dashboard', labelKey: 'dashboard', icon: Activity },
  { id: 'servers', labelKey: 'servers', icon: Server },
  { id: 'users', labelKey: 'users', icon: UserRound },
  { id: 'audit', labelKey: 'audit', icon: ScrollText },
  { id: 'backups', labelKey: 'backups', icon: Archive },
  { id: 'billing', labelKey: 'billing', icon: CreditCard },
  { id: 'reports', labelKey: 'reports', icon: Gauge },
  { id: 'routes', labelKey: 'routes', icon: Route },
  { id: 'alerts', labelKey: 'alerts', icon: Bell },
  { id: 'settings', labelKey: 'settings', icon: SettingsIcon },
];
const resellerNavViews = new Set<ActiveView>(['dashboard', 'users', 'billing']);
const managedAdminRoles: Role[] = ['owner', 'admin', 'supervisor', 'support', 'auditor', 'reseller'];
const protocolDefaultPorts: Record<ProtocolKind, string> = {
  wireguard: '51820',
  vless: '443',
  l2tp: '1701',
  ikev2: '500',
};

const panelClass = 'min-w-0 rounded-md border border-afro-line bg-afro-panel p-2.5';
const mutedTextClass = 'text-[13px] text-afro-muted';
const formLabelClass = 'text-[13px] font-bold text-afro-muted';
const inputClass = 'min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45';
const fieldLabelClass = 'grid gap-1 text-[12px] font-bold text-afro-muted';
const fieldInputClass = 'min-h-9 rounded-md border border-afro-line bg-white px-2 text-[13px] text-afro-ink outline-none focus:border-afro-blue disabled:bg-[#eef3f5] disabled:text-afro-muted';
const primaryButtonClass = 'min-h-9 rounded-md bg-afro-blue px-3 text-[13px] font-bold text-white disabled:cursor-not-allowed disabled:bg-[#9fb1bd]';

function primitiveTooltip(value: ReactNode): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return undefined;
}
const appVersion = rootPackage.version;
const sidebarStorageKey = 'afrogate.dashboard.sidebar';
const kioskStorageKey = 'afrogate.dashboard.kiosk';

function loadInitialSidebarCollapsed() {
  return window.localStorage.getItem(sidebarStorageKey) === 'collapsed';
}

function loadInitialKioskMode() {
  return window.localStorage.getItem(kioskStorageKey) === 'enabled';
}

export function DashboardApp() {
  const { isRtl, language, nextLanguage, setLanguage, strings: t } = useDashboardLanguage();
  const format = useMemo(() => createDashboardFormatters(language), [language]);
  const adminSession = useAdminSession();

  if (adminSession.status !== 'signedIn' || !adminSession.session || !adminSession.sessionToken) {
    return (
      <AdminLoginPage
        auth={adminSession}
        format={format}
        isRtl={isRtl}
        language={language}
        nextLanguage={nextLanguage}
        onLanguageChange={setLanguage}
        t={t}
      />
    );
  }

  return (
    <AuthenticatedDashboard
      format={format}
      isRtl={isRtl}
      language={language}
      nextLanguage={nextLanguage}
      onLanguageChange={setLanguage}
      onSignOut={adminSession.signOut}
      session={adminSession.session}
      sessionToken={adminSession.sessionToken}
      t={t}
    />
  );
}

function AuthenticatedDashboard({
  format,
  isRtl,
  language,
  nextLanguage,
  onLanguageChange,
  onSignOut,
  session,
  sessionToken,
  t,
}: {
  format: DashboardFormatters;
  isRtl: boolean;
  language: DashboardLanguage;
  nextLanguage: DashboardLanguage;
  onLanguageChange: (language: DashboardLanguage) => void;
  onSignOut: () => void;
  session: AdminSessionResponse;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const isResellerSession = session.actor.role === 'reseller';
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [metrics, setMetrics] = useState<ServerMetricSnapshot[]>([]);
  const [timeseries, setTimeseries] = useState<ServerMetricTimeseries[]>([]);
  const [timeRange, setTimeRange] = useState<MetricsTimeRange>('1h');
  const [dataState, setDataState] = useState<DataState>('loading');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [apiAlerts, setApiAlerts] = useState<AdminAlertSummary[]>([]);
  const [alertDataState, setAlertDataState] = useState<DataState>('loading');
  const [adminServers, setAdminServers] = useState<AdminServerSummary[]>([]);
  const [serverDataState, setServerDataState] = useState<DataState>('loading');
  const [adminOutbounds, setAdminOutbounds] = useState<AdminOutboundSummary[]>([]);
  const [adminTunnels, setAdminTunnels] = useState<AdminTunnelSummary[]>([]);
  const [routeFailoverEvents, setRouteFailoverEvents] = useState<RouteFailoverEventSummary[]>([]);
  const [routeDataState, setRouteDataState] = useState<DataState>('loading');
  const [tunnelDataState, setTunnelDataState] = useState<DataState>('loading');
  const [backupStatus, setBackupStatus] = useState<AdminBackupStatusSummary | null>(null);
  const [backupDataState, setBackupDataState] = useState<DataState>('loading');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(loadInitialSidebarCollapsed);
  const [isKioskMode, setIsKioskMode] = useState(loadInitialKioskMode);
  const wallClock = useWallClock(format);

  useEffect(() => {
    if (isResellerSession) {
      setMetrics([]);
      setTimeseries([]);
      setDataState('fallback');
      setLastUpdated(null);
      return;
    }

    let isActive = true;
    let controller: AbortController | null = null;

    const loadMetrics = async () => {
      controller?.abort();
      controller = new AbortController();

      try {
        const [latestResponse, timeseriesResponse] = await Promise.all([
          fetchLatestMetrics(controller.signal),
          fetchMetricsTimeseries(timeRange, controller.signal),
        ]);
        if (!isActive) return;

        setMetrics(latestResponse.servers);
        setTimeseries(timeseriesResponse.series);
        setDataState('live');
        setLastUpdated(new Date().toISOString());
      } catch (error) {
        if (!isActive || error instanceof DOMException && error.name === 'AbortError') return;

        setDataState((current) => (current === 'live' || current === 'stale' ? 'stale' : 'fallback'));
      }
    };

    void loadMetrics();
    const timer = window.setInterval(loadMetrics, refreshIntervalMs);

    return () => {
      isActive = false;
      controller?.abort();
      window.clearInterval(timer);
    };
  }, [isResellerSession, timeRange]);

  useEffect(() => {
    if (isResellerSession) {
      setApiAlerts([]);
      setAlertDataState('fallback');
      return;
    }

    let isActive = true;
    let controller: AbortController | null = null;

    const loadAlerts = async () => {
      controller?.abort();
      controller = new AbortController();

      try {
        const response = await fetchAdminAlerts(sessionToken, { limit: 100, status: 'open' }, controller.signal);
        if (!isActive) return;

        setApiAlerts(response.alerts);
        setAlertDataState('live');
      } catch (error) {
        if (!isActive || error instanceof DOMException && error.name === 'AbortError') return;

        setAlertDataState((current) => (current === 'live' || current === 'stale' ? 'stale' : 'fallback'));
      }
    };

    void loadAlerts();
    const timer = window.setInterval(loadAlerts, refreshIntervalMs);

    return () => {
      isActive = false;
      controller?.abort();
      window.clearInterval(timer);
    };
  }, [isResellerSession, sessionToken]);

  useEffect(() => {
    if (!canViewBackupStatus(session)) {
      setBackupStatus(null);
      setBackupDataState('fallback');
      return;
    }

    let isActive = true;
    let controller: AbortController | null = null;

    const loadBackupStatus = async () => {
      controller?.abort();
      controller = new AbortController();

      try {
        const response = await fetchAdminBackupStatus(sessionToken, controller.signal);
        if (!isActive) return;

        setBackupStatus(response.backup);
        setBackupDataState('live');
      } catch (error) {
        if (!isActive || error instanceof DOMException && error.name === 'AbortError') return;

        setBackupDataState((current) => (current === 'live' || current === 'stale' ? 'stale' : 'fallback'));
      }
    };

    void loadBackupStatus();
    const timer = window.setInterval(loadBackupStatus, 60_000);

    return () => {
      isActive = false;
      controller?.abort();
      window.clearInterval(timer);
    };
  }, [session, sessionToken]);

  useEffect(() => {
    if (isResellerSession) {
      setAdminServers([]);
      setServerDataState('fallback');
      setAdminOutbounds([]);
      setAdminTunnels([]);
      setRouteFailoverEvents([]);
      setRouteDataState('fallback');
      setTunnelDataState('fallback');
      return;
    }

    let isActive = true;
    let controller: AbortController | null = null;

    const loadManagementData = async () => {
      controller?.abort();
      controller = new AbortController();

      try {
        const [serverResponse, outboundResponse, failoverResponse] = await Promise.all([
          fetchAdminServers(sessionToken, controller.signal),
          fetchAdminOutbounds(sessionToken, controller.signal),
          fetchRouteFailoverEvents(sessionToken, controller.signal),
        ]);
        if (!isActive) return;

        setAdminServers(serverResponse.servers);
        setServerDataState('live');
        setAdminOutbounds(outboundResponse.outbounds);
        setRouteFailoverEvents(failoverResponse.events);
        setRouteDataState('live');

        try {
          const tunnelResponse = await fetchAdminTunnels(sessionToken, undefined, undefined, 200, controller.signal);
          if (!isActive) return;

          setAdminTunnels(tunnelResponse.tunnels);
          setTunnelDataState('live');
        } catch (error) {
          if (!isActive || error instanceof DOMException && error.name === 'AbortError') return;

          setAdminTunnels([]);
          setTunnelDataState((current) => (current === 'live' || current === 'stale' ? 'stale' : 'fallback'));
        }
      } catch (error) {
        if (!isActive || error instanceof DOMException && error.name === 'AbortError') return;

        setServerDataState((current) => (current === 'live' || current === 'stale' ? 'stale' : 'fallback'));
        setRouteDataState((current) => (current === 'live' || current === 'stale' ? 'stale' : 'fallback'));
        setTunnelDataState((current) => (current === 'live' || current === 'stale' ? 'stale' : 'fallback'));
      }
    };

    void loadManagementData();
    const timer = window.setInterval(loadManagementData, refreshIntervalMs);

    return () => {
      isActive = false;
      controller?.abort();
      window.clearInterval(timer);
    };
  }, [isResellerSession, sessionToken]);

  useEffect(() => {
    if (isResellerSession && !resellerNavViews.has(activeView)) {
      setActiveView('dashboard');
    }
  }, [activeView, isResellerSession]);

  useEffect(() => {
    window.localStorage.setItem(sidebarStorageKey, isSidebarCollapsed ? 'collapsed' : 'expanded');
  }, [isSidebarCollapsed]);

  useEffect(() => {
    window.localStorage.setItem(kioskStorageKey, isKioskMode ? 'enabled' : 'disabled');
  }, [isKioskMode]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) setIsKioskMode(false);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleKioskToggle = () => {
    const nextMode = !isKioskMode;
    setIsKioskMode(nextMode);

    if (nextMode) {
      const rootElement = document.documentElement;
      if (!document.fullscreenElement && rootElement.requestFullscreen) {
        void rootElement.requestFullscreen().catch(() => undefined);
      }
      return;
    }

    if (document.fullscreenElement && document.exitFullscreen) {
      void document.exitFullscreen().catch(() => undefined);
    }
  };

  const metricServerRows = useMemo(
    () => (metrics.length > 0 ? metrics.map(mapSnapshotToServerRow) : fallbackServers),
    [metrics],
  );
  const adminServerRows = useMemo(() => adminServers.map(mapAdminServerToServerRow), [adminServers]);
  const managementServerRows = useMemo(
    () => (serverDataState === 'live' || serverDataState === 'stale' ? adminServerRows : metricServerRows),
    [adminServerRows, metricServerRows, serverDataState],
  );
  const serverRows = useMemo(
    () => (adminServerRows.length > 0 ? adminServerRows : metricServerRows),
    [adminServerRows, metricServerRows],
  );
  const routeOutbounds = useMemo(
    () => (routeDataState === 'live' || routeDataState === 'stale'
      ? adminOutbounds.map(mapAdminOutboundToRow)
      : outbounds),
    [adminOutbounds, routeDataState],
  );
  const routeTunnels = useMemo(
    () => (tunnelDataState === 'live' || tunnelDataState === 'stale'
      ? adminTunnels.map(mapAdminTunnelToRow)
      : tunnels),
    [adminTunnels, tunnelDataState],
  );
  const failoverRows = useMemo(
    () => (routeDataState === 'live' || routeDataState === 'stale'
      ? routeFailoverEvents.map(mapRouteFailoverEventToRow)
      : createFallbackFailoverRows(t)),
    [routeDataState, routeFailoverEvents, t],
  );
  const handleAdminServerUpdated = (server: AdminServerDetail) => {
    setAdminServers((current) => (
      current.some((item) => item.id === server.id)
        ? current.map((item) => (item.id === server.id ? server : item))
        : [server, ...current]
    ));
    setServerDataState('live');
  };
  const trafficTotals = useMemo(() => createTrafficTotals(serverRows), [serverRows]);
  const computedAlerts = useMemo(() => createComputedAlertRows(serverRows, t), [serverRows, t]);
  const apiAlertRows = useMemo(() => mapAdminAlertsToRows(apiAlerts, t), [apiAlerts, t]);
  const alerts = useMemo(() => {
    if (alertDataState === 'live' || alertDataState === 'stale') {
      return apiAlertRows.length > 0 ? apiAlertRows : [createNoOpenAlertsRow(t)];
    }

    return computedAlerts;
  }, [alertDataState, apiAlertRows, computedAlerts, t]);
  const summary = useMemo(() => createSummary(serverRows, trafficTotals, alerts, t, format), [alerts, format, serverRows, trafficTotals, t]);
  const chartSeries = useMemo(
    () => (timeseries.length > 0 ? timeseries : createFallbackTimeseries(serverRows, timeRange)),
    [serverRows, timeRange, timeseries],
  );
  const sidebarAlertState = useMemo(() => createSidebarAlertState(alerts, format), [alerts, format]);
  const status = getDataStatus(dataState, lastUpdated, t, format);
  const header = getPageHeader(activeView, t, session);
  const shellGridClass = isKioskMode
    ? 'lg:grid-cols-[minmax(0,1fr)]'
    : isSidebarCollapsed ? 'lg:grid-cols-[80px_minmax(0,1fr)]' : 'lg:grid-cols-[248px_minmax(0,1fr)]';

  return (
    <main
      className={`grid min-h-screen grid-cols-1 overflow-x-hidden bg-afro-page text-afro-ink lg:h-screen lg:min-h-0 lg:overflow-hidden ${shellGridClass}`}
      data-dashboard-kiosk={isKioskMode ? 'true' : 'false'}
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={language}
    >
      {isKioskMode ? null : (
        <Sidebar
          activeView={activeView}
          isCollapsed={isSidebarCollapsed}
          isRtl={isRtl}
          nextLanguage={nextLanguage}
          onLanguageChange={onLanguageChange}
          onSignOut={onSignOut}
          onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
          onViewChange={setActiveView}
          sidebarAlertState={sidebarAlertState}
          session={session}
          t={t}
        />
      )}

      <section className="min-w-0 max-w-full p-3 md:p-4 lg:h-screen lg:overflow-y-auto">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-0.5 text-[11px] font-bold uppercase text-afro-teal">{header.eyebrow}</p>
            <h1 className="text-[21px] leading-tight font-bold md:text-[22px]">{header.title}</h1>
          </div>
          {activeView === 'users' ? null : (
            <div className="flex flex-wrap gap-2">
              {activeView === 'dashboard' && !isResellerSession ? (
                <KioskToggleButton isActive={isKioskMode} onToggle={handleKioskToggle} t={t} />
              ) : null}
              <div className="inline-flex min-h-7 w-fit items-center gap-1.5 rounded-full border border-afro-line bg-white px-2.5 text-[12px] font-bold text-afro-ink">
                <Clock size={15} />
                {wallClock}
              </div>
              {!isResellerSession ? (
              <div className={`inline-flex min-h-7 w-fit items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-bold ${status.className}`}>
                <span className={`size-2 rounded-full ${status.dotClassName}`} />
                {status.label}
              </div>
              ) : null}
            </div>
          )}
        </header>

        {activeView === 'dashboard' && !isResellerSession ? (
          <>
            <SystemResourceHeader format={format} servers={serverRows} t={t} trafficTotals={trafficTotals} />

            <div className="mt-2.5 border-t border-afro-line" />
          </>
        ) : null}

        <ActivePage
          activeView={activeView}
          alertDataState={alertDataState}
          alerts={alerts}
          backupDataState={backupDataState}
          backupStatus={backupStatus}
          chartSeries={chartSeries}
          dataState={dataState}
          format={format}
          onServerUpdated={handleAdminServerUpdated}
          onRangeChange={setTimeRange}
          routeDataState={routeDataState}
          routeFailoverRows={failoverRows}
          routeOutbounds={routeOutbounds}
          routeTunnelSummaries={tunnelDataState === 'live' || tunnelDataState === 'stale' ? adminTunnels : []}
          routeTunnels={routeTunnels}
          serverDataState={serverDataState}
          managementServers={managementServerRows}
          servers={serverRows}
          session={session}
          sessionToken={sessionToken}
          summary={summary}
          t={t}
          tunnelDataState={tunnelDataState}
          timeRange={timeRange}
          trafficTotals={trafficTotals}
        />
      </section>
    </main>
  );
}

function AdminLoginPage({
  auth,
  format,
  isRtl,
  language,
  nextLanguage,
  onLanguageChange,
  t,
}: {
  auth: AdminSessionHook;
  format: DashboardFormatters;
  isRtl: boolean;
  language: DashboardLanguage;
  nextLanguage: DashboardLanguage;
  onLanguageChange: (language: DashboardLanguage) => void;
  t: DashboardStrings;
}) {
  const [username, setUsername] = useState('superadmin');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const isChecking = auth.status === 'checking';
  const errorMessage = auth.errorCode ? t.auth.errors[auth.errorCode] : null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void auth.signIn({ username, password });
  };

  return (
    <main
      className="grid min-h-screen place-items-center overflow-x-hidden bg-afro-page px-4 py-6 text-afro-ink"
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={language}
    >
      <section className="w-full max-w-[420px] rounded-md border border-afro-line bg-afro-panel p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1 text-[11px] font-bold uppercase text-afro-teal">{t.auth.eyebrow}</p>
            <h1 className="text-[22px] leading-tight font-bold">{t.auth.title}</h1>
          </div>
          <LanguageButton nextLanguage={nextLanguage} onLanguageChange={onLanguageChange} t={t} variant="light" />
        </div>

        <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
          <label className="grid gap-1.5">
            <span className="text-[13px] font-bold text-afro-muted">{t.auth.username}</span>
            <span className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-afro-muted" size={16} />
              <input
                autoComplete="username"
                className="min-h-11 w-full rounded-md border border-afro-line bg-white px-10 text-sm font-bold outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4"
                dir="ltr"
                disabled={isChecking}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={t.auth.usernamePlaceholder}
                required
                type="text"
                value={username}
              />
            </span>
          </label>

          <label className="grid gap-1.5">
            <span className="text-[13px] font-bold text-afro-muted">{t.auth.password}</span>
            <span className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-afro-muted" size={16} />
              <input
                autoComplete="current-password"
                autoFocus
                className="min-h-11 w-full rounded-md border border-afro-line bg-white px-10 text-sm font-bold outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4"
                dir="ltr"
                disabled={isChecking}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t.auth.passwordPlaceholder}
                required
                type={isPasswordVisible ? 'text' : 'password'}
                value={password}
              />
              <button
                aria-label={isPasswordVisible ? t.auth.hidePassword : t.auth.showPassword}
                className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-afro-muted hover:bg-[#f4f7f8] hover:text-afro-ink disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isChecking}
                onClick={() => setIsPasswordVisible((current) => !current)}
                title={isPasswordVisible ? t.auth.hidePassword : t.auth.showPassword}
                type="button"
              >
                {isPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>

          {errorMessage ? (
            <div className="rounded-md border border-[#f0b7b7] bg-[#fff1f1] px-3 py-2 text-[13px] font-bold text-[#b91c1c]">
              {errorMessage}
            </div>
          ) : null}

          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-afro-sidebar px-4 text-sm font-bold text-white hover:bg-[#1f3138] disabled:cursor-wait disabled:opacity-70"
            disabled={isChecking}
            type="submit"
          >
            <LogIn size={17} />
            {isChecking ? t.auth.signingIn : t.auth.signIn}
          </button>
        </form>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-afro-line pt-3 text-[12px] text-afro-muted">
          <span>{isChecking ? t.auth.checking : t.auth.mfaReady}</span>
          <span className="font-bold text-afro-ink">v{appVersion}</span>
        </div>
      </section>
    </main>
  );
}

function SystemResourceHeader({
  format,
  servers,
  t,
  trafficTotals,
}: {
  format: DashboardFormatters;
  servers: ServerRowData[];
  t: DashboardStrings;
  trafficTotals: TrafficTotals;
}) {
  const cpuAverage = averagePercent(servers.map((server) => server.cpu));
  const ramAverage = averagePercent(servers.map((server) => server.ram));
  const storages = servers.flatMap((server) =>
    server.storages.map((storage) => ({
      ...storage,
      serverName: server.name,
    })),
  );
  const lowestStorage = storages.reduce<number | null>((lowest, storage) => {
    if (typeof storage.freePercent !== 'number') return lowest;
    return lowest === null ? storage.freePercent : Math.min(lowest, storage.freePercent);
  }, null);

  return (
    <section className="mt-2.5" aria-label={t.aria.systemResources}>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5 xl:gap-2">
        <ResourceStat icon={Cpu} label={t.resources.cpuAverage} tone={getUsageTone(cpuAverage)} value={format.percent(cpuAverage)} />
        <ResourceStat icon={MemoryStick} label={t.resources.ramAverage} tone={getUsageTone(ramAverage)} value={format.percent(ramAverage)} />
        <ResourceStat icon={HardDrive} label={t.resources.lowestStorage} tone={getStorageTone(lowestStorage)} value={format.percent(lowestStorage)} />
        <ResourceStat icon={Download} label={t.resources.download} tone="neutral" value={format.bytesPerSecond(trafficTotals.downloadBps)} />
        <ResourceStat icon={Upload} label={t.resources.upload} tone="neutral" value={format.bytesPerSecond(trafficTotals.uploadBps)} />
      </div>

      <div className="mt-2 overflow-x-auto rounded-md border border-afro-line bg-afro-panel">
        <div className="grid auto-cols-[minmax(138px,1fr)] grid-flow-col gap-1.5 p-1.5 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-2 xl:grid-cols-3">
          {storages.map((storage) => {
            const serverName = format.label(storage.serverName);
            const freePercent = format.percent(storage.freePercent ?? null);
            const storageTooltip = `${serverName} ${storage.path} ${freePercent}`;

            return (
              <div
                aria-label={storageTooltip}
                className="min-w-0 rounded-md border border-afro-line px-2 py-1"
                key={`${storage.serverName}-${storage.path}`}
                title={storageTooltip}
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="min-w-0 truncate text-[13px]" title={serverName}>{serverName}</strong>
                  <StatusBadge title={freePercent} tone={getStorageTone(storage.freePercent ?? null)}>
                    {freePercent}
                  </StatusBadge>
                </div>
                <div className={`${mutedTextClass} truncate`} title={storage.path}>{storage.path}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ResourceStat({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: AfroIcon;
  label: string;
  tone: Tone;
  value: string;
}) {
  const borderClass = {
    good: 'border-t-afro-green',
    neutral: 'border-t-afro-blue',
    warning: 'border-t-[#c27a1a]',
    critical: 'border-t-[#b91c1c]',
  }[tone];
  const tooltip = `${label} ${value}`;

  return (
    <div
      aria-label={tooltip}
      className={`grid min-h-[50px] gap-0.5 rounded-md border border-t-[3px] border-afro-line bg-afro-panel px-2 py-1.5 sm:min-h-[54px] sm:gap-1 sm:border-t-4 sm:p-2 ${borderClass}`}
      title={tooltip}
    >
      <div className="flex min-w-0 items-center justify-between gap-1.5">
        <span className="min-w-0 truncate text-[11px] text-afro-muted sm:text-[12px]" title={label}>{label}</span>
        <Icon className="shrink-0" size={15} />
      </div>
      <strong className="min-w-0 truncate text-[15px] leading-tight sm:text-[17px]" title={value}>{value}</strong>
    </div>
  );
}

function ActivePage({
  activeView,
  alertDataState,
  alerts,
  backupDataState,
  backupStatus,
  chartSeries,
  dataState,
  format,
  onServerUpdated,
  onRangeChange,
  routeDataState,
  routeFailoverRows,
  routeOutbounds,
  routeTunnelSummaries,
  routeTunnels,
  serverDataState,
  managementServers,
  servers,
  session,
  sessionToken,
  summary,
  t,
  tunnelDataState,
  timeRange,
  trafficTotals,
}: {
  activeView: ActiveView;
  alertDataState: DataState;
  alerts: AlertRowData[];
  backupDataState: DataState;
  backupStatus: AdminBackupStatusSummary | null;
  chartSeries: ServerMetricTimeseries[];
  dataState: DataState;
  format: DashboardFormatters;
  onServerUpdated: (server: AdminServerDetail) => void;
  onRangeChange: (range: MetricsTimeRange) => void;
  routeDataState: DataState;
  routeFailoverRows: RouteFailoverRowData[];
  routeOutbounds: OutboundRowData[];
  routeTunnelSummaries: AdminTunnelSummary[];
  routeTunnels: TunnelRowData[];
  serverDataState: DataState;
  managementServers: ServerRowData[];
  servers: ServerRowData[];
  session: AdminSessionResponse;
  sessionToken: string;
  summary: MetricCardData[];
  t: DashboardStrings;
  tunnelDataState: DataState;
  timeRange: MetricsTimeRange;
  trafficTotals: TrafficTotals;
}) {
  if (session.actor.role === 'reseller') {
    if (activeView === 'users') {
      return <ResellerUsersPage format={format} sessionToken={sessionToken} t={t} />;
    }

    if (activeView === 'billing') {
      return <BillingPage format={format} session={session} sessionToken={sessionToken} t={t} />;
    }

    return <ResellerDashboardPage format={format} sessionToken={sessionToken} t={t} />;
  }

  switch (activeView) {
    case 'servers':
      return (
        <ServersPage
          dataState={serverDataState}
          format={format}
          onServerUpdated={onServerUpdated}
          servers={managementServers}
          session={session}
          sessionToken={sessionToken}
          t={t}
        />
      );
    case 'users':
      return <UsersPage format={format} session={session} sessionToken={sessionToken} t={t} />;
    case 'audit':
      return <AuditLogsPage format={format} sessionToken={sessionToken} t={t} />;
    case 'backups':
      return <BackupsPage format={format} initialBackupStatus={backupStatus} sessionToken={sessionToken} t={t} />;
    case 'billing':
      return <BillingPage format={format} session={session} sessionToken={sessionToken} t={t} />;
    case 'reports':
      return <ReportsPage format={format} sessionToken={sessionToken} t={t} />;
    case 'routes':
      return (
        <RoutesPage
          dataState={routeDataState}
          failoverRows={routeFailoverRows}
          format={format}
          outbounds={routeOutbounds}
          session={session}
          sessionToken={sessionToken}
          tunnelDataState={tunnelDataState}
          tunnelSummaries={routeTunnelSummaries}
          tunnels={routeTunnels}
          t={t}
        />
      );
    case 'alerts':
      return <AlertsPage alerts={alerts} dataState={alertDataState} format={format} sessionToken={sessionToken} t={t} />;
    case 'settings':
      return <SettingsPage format={format} managementServers={managementServers} session={session} sessionToken={sessionToken} t={t} />;
    default:
      return (
        <DashboardPage
          alertDataState={alertDataState}
          alerts={alerts}
          backupDataState={backupDataState}
          backupStatus={backupStatus}
          chartSeries={chartSeries}
          dataState={dataState}
          format={format}
          onRangeChange={onRangeChange}
          outbounds={routeOutbounds.length > 0 ? routeOutbounds : outbounds}
          routeDataState={routeDataState}
          serverDataState={serverDataState}
          servers={servers}
          summary={summary}
          t={t}
          tunnelDataState={tunnelDataState}
          tunnels={routeTunnels}
          timeRange={timeRange}
          trafficTotals={trafficTotals}
        />
      );
  }
}

function DashboardPage({
  alertDataState,
  alerts,
  backupDataState,
  backupStatus,
  chartSeries,
  dataState,
  format,
  onRangeChange,
  outbounds,
  routeDataState,
  serverDataState,
  servers,
  summary,
  t,
  tunnelDataState,
  tunnels,
  timeRange,
  trafficTotals,
}: {
  alertDataState: DataState;
  alerts: AlertRowData[];
  backupDataState: DataState;
  backupStatus: AdminBackupStatusSummary | null;
  chartSeries: ServerMetricTimeseries[];
  dataState: DataState;
  format: DashboardFormatters;
  onRangeChange: (range: MetricsTimeRange) => void;
  outbounds: OutboundRowData[];
  routeDataState: DataState;
  serverDataState: DataState;
  servers: ServerRowData[];
  summary: MetricCardData[];
  t: DashboardStrings;
  tunnelDataState: DataState;
  tunnels: TunnelRowData[];
  timeRange: MetricsTimeRange;
  trafficTotals: TrafficTotals;
}) {
  return (
    <>
      <section className="mt-2 grid items-start gap-2 xl:grid-cols-[minmax(300px,0.42fr)_minmax(0,1fr)]">
        <section className="grid gap-2 sm:grid-cols-2" aria-label={t.aria.summary}>
          {summary.map((item) => (
            <MetricCard item={item} key={item.label} />
          ))}
        </section>

        <HealthChartPanel
          dataState={dataState}
          format={format}
          range={timeRange}
          series={chartSeries}
          t={t}
          onRangeChange={onRangeChange}
        />
      </section>

      <section className="mt-2 grid items-start gap-2 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_minmax(0,0.85fr)]">
        <ServerPanel dataState={serverDataState} format={format} servers={servers} t={t} />
        <TunnelPanel dataState={tunnelDataState} format={format} t={t} tunnels={tunnels} />
        <AlertsPanel alerts={alerts} dataState={alertDataState} format={format} t={t} />
      </section>

      <section className="mt-2 grid items-start gap-2 xl:grid-cols-3">
        <OutboundsPanel dataState={routeDataState} format={format} outbounds={outbounds} t={t} />
        <CapacityPanel format={format} t={t} trafficTotals={trafficTotals} />
        <ControlPlanePanel backupDataState={backupDataState} backupStatus={backupStatus} format={format} t={t} />
      </section>
    </>
  );
}

function HealthChartPanel({
  dataState,
  format,
  range,
  series,
  t,
  onRangeChange,
}: {
  dataState: DataState;
  format: DashboardFormatters;
  range: MetricsTimeRange;
  series: ServerMetricTimeseries[];
  t: DashboardStrings;
  onRangeChange: (range: MetricsTimeRange) => void;
}) {
  const option = useMemo(() => createHealthChartOption(series, t, format), [format, series, t]);
  const hasChartPoints = series.some((item) => item.points.length > 0);

  return (
    <section className={panelClass}>
      <div className="flex flex-col gap-2 border-b border-afro-line pb-2 sm:flex-row sm:items-center sm:justify-between">
        <PanelHeadingContent title={t.panels.healthTimeline} meta={t.panels.monitoredNodes(format.integer(series.length))} />
        <div className="inline-grid w-fit grid-flow-col rounded-md border border-afro-line bg-[#eef3f5] p-1">
          {timeRanges.map((item) => {
            const isActive = item.value === range;
            const activeClass = isActive ? 'bg-white text-afro-ink shadow-sm' : 'text-afro-muted hover:text-afro-ink';
            const rangeLabel = format.timeRange(item.value);

            return (
              <button
                aria-label={rangeLabel}
                className={`min-h-7 min-w-10 rounded px-2 text-[13px] font-bold ${activeClass}`}
                key={item.value}
                onClick={() => onRangeChange(item.value)}
                title={rangeLabel}
                type="button"
              >
                {rangeLabel}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-2 grid gap-2">
        {hasChartPoints && dataState !== 'live' ? <DataStateNotice state={dataState} t={t} /> : null}
        {hasChartPoints ? (
          <EChart
            ariaLabel={t.aria.healthChart}
            className="h-[138px] w-full xl:h-[142px] 2xl:h-[136px]"
            option={option}
          />
        ) : (
          <DataStateEmpty emptyMessage={t.operationalData.noHealthSamples} state={dataState} t={t} />
        )}
      </div>
    </section>
  );
}

function OutboundsPanel({
  dataState,
  emptyMessage,
  format,
  outbounds,
  t,
}: {
  dataState: DataState;
  emptyMessage?: string;
  format: DashboardFormatters;
  outbounds: OutboundRowData[];
  t: DashboardStrings;
}) {
  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.outbounds} icon={ArrowDownUp} meta={t.panels.priorityFailover} />
      <div className="mt-2 grid gap-2">
        {outbounds.length > 0 && dataState !== 'live' ? <DataStateNotice state={dataState} t={t} /> : null}
        {outbounds.length === 0 ? (
          <DataStateEmpty emptyMessage={emptyMessage ?? t.operationalData.noOutbounds} state={dataState} t={t} />
        ) : null}
        {outbounds.map((outbound) => (
          <div className="grid min-h-[46px] grid-cols-[24px_1fr_auto] items-center gap-2 rounded-md border border-afro-line p-2" key={outbound.id}>
            <span className="grid size-6 place-items-center rounded bg-[#eef3f5] text-[12px] font-bold text-afro-ink">{format.integer(outbound.priority)}</span>
            <div className="min-w-0">
              <strong className="block truncate">{format.label(outbound.name)}</strong>
              <span className={`${mutedTextClass} block truncate`}>
                {format.label(outbound.type)} / {format.label(outbound.mode)}
                {outbound.usageMultiplier > 1 ? ` / x${format.integer(outbound.usageMultiplier)}` : ''}
                {outbound.serverLabel ? ` / ${format.label(outbound.serverLabel)}` : ''}
              </span>
            </div>
            <div className="text-right">
              <StatusBadge tone={outbound.statusTone}>{format.label(outbound.statusText)}</StatusBadge>
              <div className={mutedTextClass}>{format.latency(outbound.latencyMs)}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AlertsPanel({
  alerts,
  dataState,
  format,
  t,
}: {
  alerts: AlertRowData[];
  dataState: DataState;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  const activeAlertCount = countActiveAlertRows(alerts);

  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.alerts} icon={AlertTriangle} meta={t.panels.visible(format.integer(activeAlertCount))} />
      <div className="mt-2 grid gap-2">
        {alerts.length > 0 && dataState !== 'live' ? <DataStateNotice state={dataState} t={t} /> : null}
        {alerts.length === 0 ? <DataStateEmpty emptyMessage={t.alerts.noOpenAlerts} state={dataState} t={t} /> : null}
        {alerts.map((alert) => (
          <div className="grid min-h-[42px] grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-afro-line p-2" key={alert.id}>
            <div className="min-w-0">
              <strong className="block truncate">{alert.title}</strong>
              <span className={`${mutedTextClass} block truncate`}>{format.label(alert.source)}</span>
            </div>
            <StatusBadge tone={alert.severity}>{t.status[alert.severity]}</StatusBadge>
          </div>
        ))}
      </div>
    </section>
  );
}

function CapacityPanel({ format, t, trafficTotals }: { format: DashboardFormatters; t: DashboardStrings; trafficTotals: TrafficTotals }) {
  const items = [
    { label: t.capacity.usersOnline, value: format.integer(150) },
    { label: t.summary.downloadNow, value: format.bytesPerSecond(trafficTotals.downloadBps) },
    { label: t.summary.uploadNow, value: format.bytesPerSecond(trafficTotals.uploadBps) },
    { label: t.capacity.minTargetUser, value: format.bytesPerSecond(1024 * 1024) },
    { label: t.capacity.routeMode, value: t.capacity.autoLock },
  ];

  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.capacity} icon={Network} meta={t.panels.managerView} />
      <div className="mt-2 grid gap-1.5">
        {items.map((item) => (
          <div className="flex min-h-8 items-center justify-between gap-2 rounded-md border border-afro-line px-2 py-1" key={item.label}>
            <span className={`${mutedTextClass} min-w-0 truncate`}>{item.label}</span>
            <strong className="shrink-0 text-right text-[14px] leading-tight">{item.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function ControlPlanePanel({
  backupDataState,
  backupStatus,
  format,
  t,
}: {
  backupDataState: DataState;
  backupStatus: AdminBackupStatusSummary | null;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  const backupRow = createBackupControlPlaneRow(backupStatus, backupDataState, t);
  const rows = [
    { label: t.controlPlaneRows.metricsIngest, value: format.durationSeconds(10), tone: 'good' as Tone },
    { label: t.controlPlaneRows.telegramApiEgress, value: t.controlPlaneRows.proxyReady, tone: 'neutral' as Tone },
    { label: t.controlPlaneRows.storageAlert, value: format.percentThreshold('<', 10), tone: 'warning' as Tone },
    { label: t.controlPlaneRows.backups, value: backupRow.value, tone: backupRow.tone },
  ];

  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.controlPlane} icon={ShieldCheck} meta={t.panels.operations} />
      <div className="mt-2 grid gap-2">
        {rows.map((row) => (
          <div className="flex min-h-8 items-center justify-between gap-2 rounded-md border border-afro-line px-2" key={row.label}>
            <span className={`${mutedTextClass} min-w-0 truncate`}>{row.label}</span>
            <StatusBadge tone={row.tone}>{row.value}</StatusBadge>
          </div>
        ))}
      </div>
    </section>
  );
}

function createBackupControlPlaneRow(
  backupStatus: AdminBackupStatusSummary | null,
  dataState: DataState,
  t: DashboardStrings,
): { value: string; tone: Tone } {
  if (!backupStatus) {
    return {
      value: dataState === 'loading' ? t.dataStatus.loading : t.controlPlaneRows.pending,
      tone: 'warning',
    };
  }

  return {
    value: backupStatusLabel(backupStatus.status, t),
    tone: backupStatusTone(backupStatus.status),
  };
}

function ServersPage({
  dataState,
  format,
  onServerUpdated,
  servers,
  session,
  sessionToken,
  t,
}: {
  dataState: DataState;
  format: DashboardFormatters;
  onServerUpdated: (server: AdminServerDetail) => void;
  servers: ServerRowData[];
  session: AdminSessionResponse;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const [selectedServerId, setSelectedServerId] = useState<string | null>(() => servers[0]?.id ?? null);

  useEffect(() => {
    if (servers.length === 0) {
      setSelectedServerId(null);
      return;
    }

    if (!selectedServerId || !servers.some((server) => server.id === selectedServerId)) {
      setSelectedServerId(servers[0].id);
    }
  }, [selectedServerId, servers]);

  const selectedServerIndex = Math.max(0, servers.findIndex((server) => server.id === selectedServerId));
  const selectedServer = servers[selectedServerIndex] ?? null;

  return (
    <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
      <section className={panelClass}>
        <PanelHeading title={t.panels.serverInventory} icon={Server} meta={t.panels.managedNodes(format.integer(servers.length))} />
        <div className="mt-2 grid gap-2.5">
          {servers.length > 0 && dataState !== 'live' ? <DataStateNotice state={dataState} t={t} /> : null}
          {servers.length === 0 ? <DataStateEmpty emptyMessage={t.operationalData.noServers} state={dataState} t={t} /> : null}
          {servers.map((server, index) => (
            <ServerManagementCard
              format={format}
              index={index}
              isSelected={server.id === selectedServerId}
              key={server.id}
              onEdit={() => setSelectedServerId(server.id)}
              server={server}
              t={t}
            />
          ))}
        </div>
      </section>

      <ServerEditPanel
        format={format}
        onServerUpdated={onServerUpdated}
        server={selectedServer}
        serverIndex={selectedServerIndex}
        session={session}
        sessionToken={sessionToken}
        t={t}
      />
    </section>
  );
}

function getServerInterfaces(index: number): string[] {
  return index === 0
    ? ['ether1 / Mobinnet / wg1', 'ether2 / Irancell / wireguard2']
    : index === 1
      ? ['ether5 / Irancell / wireguard3']
      : ['core uplink / Germany / gateway'];
}

function ServerManagementCard({
  format,
  index,
  isSelected,
  onEdit,
  server,
  t,
}: {
  format: DashboardFormatters;
  index: number;
  isSelected: boolean;
  onEdit: () => void;
  server: ServerRowData;
  t: DashboardStrings;
}) {
  const interfaces = getServerInterfaces(index);
  const selectedClass = isSelected ? 'border-afro-blue ring-2 ring-afro-blue/15' : 'border-afro-line';

  return (
    <article className={`rounded-md border p-2.5 ${selectedClass}`}>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <strong className="min-w-0 truncate text-base">{format.label(server.name)}</strong>
          <span className={`${mutedTextClass} shrink-0`}>{format.label(server.meta)}</span>
        </div>
        <button
          className="min-h-8 rounded-md border border-afro-line bg-white px-2.5 text-[13px] font-bold text-afro-ink hover:border-afro-blue hover:text-afro-blue"
          onClick={onEdit}
          type="button"
        >
          {t.actions.edit}
        </button>
      </div>

      <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
        <UsageBar format={format} icon={Cpu} label={t.resources.cpu} value={server.cpu} />
        <UsageBar format={format} icon={MemoryStick} label={t.resources.ram} value={server.ram} />
        <UsageBar format={format} icon={HardDrive} label={t.resources.diskFree} value={server.diskFree} invert />
      </div>

      <div className="mt-2.5 grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="grid gap-1.5">
          {interfaces.map((item) => (
            <span className="rounded-md bg-[#eef3f5] px-2 py-1 text-[12px] text-afro-muted" key={item}>
              {format.label(item)}
            </span>
          ))}
        </div>
        <div className="text-left sm:text-right">
          <span className={mutedTextClass}>{t.resources.health}</span>
          <b className={`block text-[20px] ${getScoreClass(server.score)}`}>{format.integer(server.score)}</b>
        </div>
      </div>
    </article>
  );
}

function ServerEditPanel({
  format,
  onServerUpdated,
  server,
  serverIndex,
  session,
  sessionToken,
  t,
}: {
  format: DashboardFormatters;
  onServerUpdated: (server: AdminServerDetail) => void;
  server: ServerRowData | null;
  serverIndex: number;
  session: AdminSessionResponse;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const [activeTab, setActiveTab] = useState<ServerEditTab>('overview');
  const [serverDetail, setServerDetail] = useState<AdminServerDetail | null>(null);
  const [inventoryInterfaces, setInventoryInterfaces] = useState<AdminServerInterfaceSummary[]>([]);
  const [inventoryTunnels, setInventoryTunnels] = useState<AdminTunnelSummary[]>([]);
  const [detailDataState, setDetailDataState] = useState<DataState>('loading');

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    setServerDetail(null);
    setInventoryInterfaces([]);
    setInventoryTunnels([]);

    if (!server) {
      setDetailDataState('fallback');
      return () => {
        isActive = false;
        controller.abort();
      };
    }

    if (server.source !== 'admin') {
      setDetailDataState('fallback');
      return () => {
        isActive = false;
        controller.abort();
      };
    }

    setDetailDataState('loading');

    Promise.all([
      fetchAdminServer(sessionToken, server.id, controller.signal),
      fetchAdminServerInterfaces(sessionToken, server.id, controller.signal).catch(() => ({ interfaces: [] })),
      fetchAdminTunnels(sessionToken, server.id, undefined, 100, controller.signal).catch(() => ({ tunnels: [] })),
    ])
      .then(([detail, interfaceResponse, tunnelResponse]) => {
        if (!isActive) return;

        setServerDetail(detail);
        setInventoryInterfaces(interfaceResponse.interfaces);
        setInventoryTunnels(tunnelResponse.tunnels);
        setDetailDataState('live');
        onServerUpdated(detail);
      })
      .catch((error) => {
        if (!isActive || (error instanceof DOMException && error.name === 'AbortError')) return;

        setDetailDataState('fallback');
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [server?.id, server?.source, sessionToken]);

  if (!server) {
    return (
      <section className={panelClass}>
        <PanelHeading title={t.panels.serverDetail} icon={ShieldCheck} meta={t.serverEdit.noServer} />
        <div className="mt-2">
          <EmptyState message={t.serverEdit.noServer} />
        </div>
      </section>
    );
  }

  const detailedServer = serverDetail ? mapAdminServerToServerRow(serverDetail) : null;
  const activeServer = detailedServer ?? server;
  const interfaces = getServerInterfaces(serverIndex);
  const tabs: Array<{ id: ServerEditTab; label: string }> = [
    { id: 'overview', label: t.serverEdit.tabs.overview },
    { id: 'access', label: t.serverEdit.tabs.access },
    { id: 'monitoring', label: t.serverEdit.tabs.monitoring },
    { id: 'interfaces', label: t.serverEdit.tabs.interfaces },
    { id: 'audit', label: t.serverEdit.tabs.audit },
  ];

  return (
    <section className={panelClass}>
      <PanelHeading
        title={t.panels.serverDetail}
        icon={ShieldCheck}
        meta={detailDataState === 'loading' ? t.dataStatus.loading : format.label(activeServer.name)}
      />
      {detailDataState !== 'live' ? (
        <div className="mt-2">
          <DataStateNotice state={detailDataState} t={t} />
        </div>
      ) : null}
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
        {tabs.map((tab) => {
          const activeClass = activeTab === tab.id
            ? 'border-afro-blue bg-[#edf4ff] text-afro-blue'
            : 'border-afro-line bg-white text-afro-muted hover:border-afro-blue hover:text-afro-blue';

          return (
            <button
              className={`min-h-9 rounded-md border px-2 text-[12px] font-bold ${activeClass}`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-2">
        {activeTab === 'overview' ? (
          <ServerOverviewTab
            detailDataState={detailDataState}
            format={format}
            inventoryInterfaces={inventoryInterfaces}
            inventoryTunnels={inventoryTunnels}
            server={activeServer}
            serverDetail={serverDetail}
            t={t}
          />
        ) : null}
        {activeTab === 'access' ? (
          <ServerAccessTab
            onServerUpdated={onServerUpdated}
            server={activeServer}
            session={session}
            sessionToken={sessionToken}
            t={t}
          />
        ) : null}
        {activeTab === 'monitoring' ? <ServerMonitoringTab format={format} server={activeServer} t={t} /> : null}
        {activeTab === 'interfaces' ? (
          <ServerInterfacesTab
            detailDataState={detailDataState}
            format={format}
            interfaces={interfaces}
            inventoryInterfaces={inventoryInterfaces}
            inventoryTunnels={inventoryTunnels}
            server={activeServer}
            t={t}
          />
        ) : null}
        {activeTab === 'audit' ? <ServerAuditTab detailDataState={detailDataState} format={format} server={activeServer} t={t} /> : null}
      </div>
    </section>
  );
}

function ServerOverviewTab({
  detailDataState,
  format,
  inventoryInterfaces,
  inventoryTunnels,
  server,
  serverDetail,
  t,
}: {
  detailDataState: DataState;
  format: DashboardFormatters;
  inventoryInterfaces: AdminServerInterfaceSummary[];
  inventoryTunnels: AdminTunnelSummary[];
  server: ServerRowData;
  serverDetail: AdminServerDetail | null;
  t: DashboardStrings;
}) {
  const outboundsCount = serverDetail?.outbounds.length ?? server.outboundCount ?? 0;
  const openAlertCount = server.openAlertCount ?? 0;
  const inventorySummary = t.serverEdit.values.interfaceTunnelSummary(
    format.integer(inventoryInterfaces.length),
    format.integer(inventoryTunnels.length),
  );
  const accessReady = serverAccessReady(server);

  return (
    <div className="grid gap-2">
      <DetailRow label={t.serverEdit.labels.country}>{format.label(server.meta)}</DetailRow>
      <DetailRow label={t.serverEdit.labels.externalId}>{server.externalId ?? server.id}</DetailRow>
      <DetailRow label={t.serverEdit.labels.status}>
        <StatusBadge tone={server.score >= 70 ? 'good' : server.score >= 50 ? 'warning' : 'critical'}>
          {server.score >= 70 ? t.status.healthy : server.score >= 50 ? t.status.warning : t.status.critical}
        </StatusBadge>
      </DetailRow>
      <DetailRow label={t.serverEdit.labels.role}>
        {server.role ? format.label(server.role) : server.name.toLowerCase().includes('core') ? t.serverEdit.values.gatewayNode : t.serverEdit.values.edgeNode}
      </DetailRow>
      <DetailRow label={t.serverEdit.labels.routeGroup}>{t.serverEdit.values.routeGroupMain}</DetailRow>
      <DetailRow label={t.serverEdit.labels.lastSeen}>
        {server.observedAt ? format.time(new Date(server.observedAt), false) : t.serverEdit.values.localSample}
      </DetailRow>
      <DetailRow label={t.serverEdit.labels.healthScore}>{format.integer(server.score)}</DetailRow>
      <DetailRow label={t.serverEdit.labels.outbounds}>{format.integer(outboundsCount)}</DetailRow>
      <DetailRow label={t.serverEdit.labels.openAlerts}>{format.integer(openAlertCount)}</DetailRow>
      <DetailRow label={t.serverEdit.labels.inventory}>{inventorySummary}</DetailRow>
      <DetailRow label={t.serverEdit.labels.accessReadiness}>
        <StatusBadge tone={accessReady ? 'good' : 'warning'}>
          {accessReady ? t.settings.accessReady : t.settings.accessPending}
        </StatusBadge>
      </DetailRow>
      <DetailRow label={t.serverEdit.labels.tags}>{server.tags?.length ? server.tags.map(format.label).join(', ') : t.serverEdit.values.none}</DetailRow>
      <DetailRow label={t.serverEdit.labels.detailSource}>
        {detailDataState === 'live' ? t.serverEdit.values.apiDetail : detailDataState === 'loading' ? t.dataStatus.loading : t.serverEdit.values.fallbackDetail}
      </DetailRow>
    </div>
  );
}

function ServerAccessTab({
  onServerUpdated,
  server,
  session,
  sessionToken,
  t,
}: {
  onServerUpdated: (server: AdminServerDetail) => void;
  server: ServerRowData;
  session: AdminSessionResponse;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const profile = server.accessProfile;
  const canManageAccess = server.source === 'admin' && ['superadmin', 'owner', 'admin'].includes(session.actor.role);
  const [address, setAddress] = useState(profile?.address ?? server.externalId ?? server.name);
  const [sshPort, setSshPort] = useState(String(profile?.sshPort ?? 22));
  const [username, setUsername] = useState(profile?.username ?? 'afrogate');
  const [accessMethod, setAccessMethod] = useState<ServerAccessMethod>(
    isServerAccessMethod(profile?.accessMethod) ? profile.accessMethod : 'ssh_key',
  );
  const [bootstrapState, setBootstrapState] = useState<ServerBootstrapState>(
    isServerBootstrapState(profile?.bootstrapState) ? profile.bootstrapState : 'not_started',
  );
  const [notes, setNotes] = useState(profile?.notes ?? '');
  const [credentialName, setCredentialName] = useState(profile?.credentialName ?? `${server.name} SSH`);
  const [credentialKind, setCredentialKind] = useState<ServerCredentialKind>(
    isServerCredentialKind(profile?.credentialKind) ? profile.credentialKind : 'ssh_private_key',
  );
  const [credentialSecret, setCredentialSecret] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isStoringCredential, setIsStoringCredential] = useState(false);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setAddress(profile?.address ?? server.externalId ?? server.name);
    setSshPort(String(profile?.sshPort ?? 22));
    setUsername(profile?.username ?? 'afrogate');
    setAccessMethod(isServerAccessMethod(profile?.accessMethod) ? profile.accessMethod : 'ssh_key');
    setBootstrapState(isServerBootstrapState(profile?.bootstrapState) ? profile.bootstrapState : 'not_started');
    setNotes(profile?.notes ?? '');
    setCredentialName(profile?.credentialName ?? `${server.name} SSH`);
    setCredentialKind(isServerCredentialKind(profile?.credentialKind) ? profile.credentialKind : 'ssh_private_key');
    setCredentialSecret('');
    setAccessMessage(null);
  }, [
    profile?.accessMethod,
    profile?.address,
    profile?.bootstrapState,
    profile?.credentialKind,
    profile?.credentialName,
    profile?.notes,
    profile?.sshPort,
    profile?.username,
    server.externalId,
    server.id,
    server.name,
  ]);

  const accessMethodOptions: Array<[ServerAccessMethod, string]> = [
    ['ssh_key', t.accessRows.sshKey],
    ['temporary_root_password', t.accessRows.temporaryRootPassword],
    ['temporary_root_key', t.accessRows.temporaryRootKey],
    ['existing_admin_key', t.accessRows.existingAdminKey],
  ];
  const bootstrapStateOptions: Array<[ServerBootstrapState, string]> = [
    ['not_started', t.serverEdit.values.pending],
    ['pending', t.accessRows.bootstrapPending],
    ['installed', t.accessRows.bootstrapInstalled],
    ['failed', t.accessRows.bootstrapFailed],
    ['revoked', t.accessRows.bootstrapRevoked],
  ];
  const credentialKindOptions: Array<[ServerCredentialKind, string]> = [
    ['ssh_private_key', t.accessRows.sshPrivateKey],
    ['ssh_password', t.accessRows.sshPassword],
    ['api_token', t.accessRows.apiToken],
  ];

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const port = Number(sshPort);

    if (!address.trim() || !username.trim() || !Number.isInteger(port) || port < 1 || port > 65535) {
      setAccessMessage(t.accessRows.profileSaveFailed);
      return;
    }

    setIsSavingProfile(true);
    setAccessMessage(null);

    try {
      const updated = await updateAdminServer(sessionToken, server.id, {
        accessProfile: {
          address: address.trim(),
          accessMethod,
          bootstrapState,
          notes: notes.trim() || null,
          sshPort: port,
          username: username.trim(),
        },
      });
      onServerUpdated(updated);
      setAccessMessage(t.accessRows.profileSaved);
    } catch {
      setAccessMessage(t.accessRows.profileSaveFailed);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleStoreCredential = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!profile?.id) {
      setAccessMessage(t.accessRows.profileRequired);
      return;
    }
    if (!credentialName.trim() || !credentialSecret.trim()) {
      setAccessMessage(t.accessRows.credentialStoreFailed);
      return;
    }

    setIsStoringCredential(true);
    setAccessMessage(null);

    try {
      const response = await storeAdminServerCredential(sessionToken, server.id, {
        kind: credentialKind,
        name: credentialName.trim(),
        secret: credentialSecret,
      });
      onServerUpdated(response.server);
      setCredentialSecret('');
      setAccessMessage(t.accessRows.credentialStored);
    } catch {
      setAccessMessage(t.accessRows.credentialStoreFailed);
    } finally {
      setIsStoringCredential(false);
    }
  };

  return (
    <div className="grid gap-3">
      <DetailRow label={t.accessRows.defaultUser}>{profile?.username ?? 'afrogate'}</DetailRow>
      <DetailRow label={t.accessRows.accessMethod}>{profile?.accessMethod ?? t.accessRows.sshKey}</DetailRow>
      <DetailRow label={t.serverEdit.labels.sshPort}>{profile?.sshPort ?? 22}</DetailRow>
      <DetailRow label={t.accessRows.rootPassword}>{t.accessRows.bootstrapOnly}</DetailRow>
      <DetailRow label={t.accessRows.credentialView}>{profile?.hasCredentialRef ? t.accessRows.hidden : t.serverEdit.values.notRun}</DetailRow>
      <DetailRow label={t.accessRows.credentialStatus}>
        <StatusBadge tone={profile?.hasActiveCredential ? 'good' : profile?.hasCredentialRef ? 'warning' : 'neutral'}>
          {profile?.hasActiveCredential
            ? t.accessRows.activeCredential
            : profile?.hasCredentialRef
              ? t.accessRows.inactiveCredential
              : t.serverEdit.values.notRun}
        </StatusBadge>
      </DetailRow>
      <DetailRow label={t.serverEdit.labels.bootstrapState}>
        <StatusBadge tone={profile?.bootstrapState === 'installed' ? 'good' : 'warning'}>
          {profile?.bootstrapState ?? t.serverEdit.values.pending}
        </StatusBadge>
      </DetailRow>
      <DetailRow label={t.serverEdit.labels.connectionTest}>{profile?.lastTestStatus ?? t.serverEdit.values.notRun}</DetailRow>
      <DetailRow label={t.serverEdit.labels.secretPolicy}>{t.serverEdit.values.secretsHidden}</DetailRow>

      <form className="grid gap-2 rounded-md border border-afro-line bg-[#f8fafb] p-2.5" onSubmit={handleSaveProfile}>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={fieldLabelClass}>
            {t.accessRows.address}
            <input
              className={fieldInputClass}
              disabled={!canManageAccess || isSavingProfile}
              onChange={(event) => setAddress(event.target.value)}
              required
              value={address}
            />
          </label>
          <label className={fieldLabelClass}>
            {t.serverEdit.labels.sshPort}
            <input
              className={fieldInputClass}
              disabled={!canManageAccess || isSavingProfile}
              inputMode="numeric"
              max={65535}
              min={1}
              onChange={(event) => setSshPort(event.target.value)}
              required
              type="number"
              value={sshPort}
            />
          </label>
          <label className={fieldLabelClass}>
            {t.accessRows.defaultUser}
            <input
              className={fieldInputClass}
              disabled={!canManageAccess || isSavingProfile}
              onChange={(event) => setUsername(event.target.value)}
              required
              value={username}
            />
          </label>
          <label className={fieldLabelClass}>
            {t.accessRows.accessMethod}
            <select
              className={fieldInputClass}
              disabled={!canManageAccess || isSavingProfile}
              onChange={(event) => setAccessMethod(event.target.value as ServerAccessMethod)}
              value={accessMethod}
            >
              {accessMethodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className={fieldLabelClass}>
            {t.serverEdit.labels.bootstrapState}
            <select
              className={fieldInputClass}
              disabled={!canManageAccess || isSavingProfile}
              onChange={(event) => setBootstrapState(event.target.value as ServerBootstrapState)}
              value={bootstrapState}
            >
              {bootstrapStateOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className={fieldLabelClass}>
            {t.accessRows.notes}
            <input
              className={fieldInputClass}
              disabled={!canManageAccess || isSavingProfile}
              onChange={(event) => setNotes(event.target.value)}
              value={notes}
            />
          </label>
        </div>
        <button className={primaryButtonClass} disabled={!canManageAccess || isSavingProfile} type="submit">
          {isSavingProfile ? t.accessRows.saving : t.accessRows.saveAccessProfile}
        </button>
      </form>

      <form className="grid gap-2 rounded-md border border-afro-line bg-white p-2.5" onSubmit={handleStoreCredential}>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={fieldLabelClass}>
            {t.accessRows.credentialName}
            <input
              className={fieldInputClass}
              disabled={!canManageAccess || isStoringCredential}
              onChange={(event) => setCredentialName(event.target.value)}
              required
              value={credentialName}
            />
          </label>
          <label className={fieldLabelClass}>
            {t.accessRows.credentialKind}
            <select
              className={fieldInputClass}
              disabled={!canManageAccess || isStoringCredential}
              onChange={(event) => setCredentialKind(event.target.value as ServerCredentialKind)}
              value={credentialKind}
            >
              {credentialKindOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <label className={fieldLabelClass}>
          {t.accessRows.credentialSecret}
          <textarea
            className={`${fieldInputClass} min-h-24 resize-y py-2`}
            disabled={!canManageAccess || isStoringCredential || !profile?.id}
            onChange={(event) => setCredentialSecret(event.target.value)}
            required
            value={credentialSecret}
          />
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className={`${mutedTextClass} text-[12px]`}>{profile?.id ? t.accessRows.writeOnlyCredential : t.accessRows.profileRequired}</span>
          <button
            className={primaryButtonClass}
            disabled={!canManageAccess || isStoringCredential || !profile?.id || !credentialSecret.trim()}
            type="submit"
          >
            {isStoringCredential ? t.accessRows.storingCredential : t.accessRows.storeCredential}
          </button>
        </div>
      </form>

      {accessMessage ? <p className={`${mutedTextClass} text-[12px]`}>{accessMessage}</p> : null}
    </div>
  );
}

function ServerMonitoringTab({ format, server, t }: { format: DashboardFormatters; server: ServerRowData; t: DashboardStrings }) {
  const wireGuardSummary = summarizeWireGuardInterfaces(server.wireGuardInterfaces, format, t);
  const wireGuardRows = server.wireGuardInterfaces.slice(0, 3);
  const routeProbeSummary = summarizeRouteProbes(server.routeProbes, format, t);

  return (
    <div className="grid gap-2">
      <div className="grid gap-2 sm:grid-cols-3">
        <UsageBar format={format} icon={Cpu} label={t.resources.cpu} value={server.cpu} />
        <UsageBar format={format} icon={MemoryStick} label={t.resources.ram} value={server.ram} />
        <UsageBar format={format} icon={HardDrive} label={t.resources.diskFree} value={server.diskFree} invert />
      </div>
      <DetailRow label={t.serverEdit.labels.metricsInterval}>{format.durationSeconds(10)}</DetailRow>
      <DetailRow label={t.serverEdit.labels.networkRate}>
        {format.bytesPerSecond(server.inboundBps)} / {format.bytesPerSecond(server.outboundBps)}
      </DetailRow>
      <DetailRow label={t.serverEdit.labels.routeQuality}>
        {format.latency(server.pingMs)} / {format.latency(server.jitterMs)} / {format.packetLoss(server.packetLossPercent)}
      </DetailRow>
      <DetailRow label={t.serverEdit.labels.tunnelHealth}>
        <StatusBadge tone={wireGuardSummary.tone}>{wireGuardSummary.label}</StatusBadge>
      </DetailRow>
      {wireGuardRows.map((item) => (
        <DetailRow key={item.name} label={`${t.serverEdit.labels.wireGuardInterface} ${item.name}`}>
          <span className="inline-flex items-center gap-1.5">
            <StatusBadge tone={wireGuardTone(item)}>{wireGuardStatusLabel(item.status, t)}</StatusBadge>
            <span>{formatWireGuardPeerSummary(item, format, t)}</span>
          </span>
        </DetailRow>
      ))}
      <DetailRow label={t.serverEdit.labels.protocolProbes}>
        <StatusBadge tone={routeProbeSummary.tone}>{routeProbeSummary.label}</StatusBadge>
      </DetailRow>
    </div>
  );
}

function ServerInterfacesTab({
  detailDataState,
  format,
  interfaces,
  inventoryInterfaces,
  inventoryTunnels,
  server,
  t,
}: {
  detailDataState: DataState;
  format: DashboardFormatters;
  interfaces: string[];
  inventoryInterfaces: AdminServerInterfaceSummary[];
  inventoryTunnels: AdminTunnelSummary[];
  server: ServerRowData;
  t: DashboardStrings;
}) {
  const metricRows = server.networkInterfaces.length > 0
    ? server.networkInterfaces.map((item) => ({
        name: item.name,
        value: `${format.bytesPerSecond(item.rxBps ?? null)} / ${format.bytesPerSecond(item.txBps ?? null)}`,
      }))
    : interfaces.map((item) => ({ name: format.label(item), value: t.serverEdit.values.localSample }));
  const wireGuardRows = server.wireGuardInterfaces.map((item) => ({
    name: item.name,
    status: wireGuardStatusLabel(item.status, t),
    tone: wireGuardTone(item),
    peerSummary: formatWireGuardPeerSummary(item, format, t),
    rate: `${format.bytesPerSecond(item.rxBps ?? null)} / ${format.bytesPerSecond(item.txBps ?? null)}`,
    handshake: formatWireGuardHandshake(item, format, t),
  }));

  return (
    <div className="grid gap-2">
      {inventoryInterfaces.length > 0 ? (
        <>
          <DetailRow label={t.serverEdit.labels.inventoryInterfaces}>
            {t.panels.visible(format.integer(inventoryInterfaces.length))}
          </DetailRow>
          {inventoryInterfaces.map((item) => (
            <DetailRow key={`inventory-interface-${item.id}`} label={format.label(item.name)}>
              <span className="inline-flex min-w-0 items-center justify-end gap-1.5">
                <StatusBadge tone={inventoryStatusTone(item.status)}>{inventoryStatusLabel(item.status, t)}</StatusBadge>
                <span className="truncate">
                  {[item.operator, item.kind, item.linkedTunnelName].filter(Boolean).map(String).map(format.label).join(' / ') || t.serverEdit.values.none}
                </span>
              </span>
            </DetailRow>
          ))}
        </>
      ) : null}
      {inventoryTunnels.length > 0 ? (
        <>
          <DetailRow label={t.serverEdit.labels.inventoryTunnels}>
            {t.panels.links(format.integer(inventoryTunnels.length))}
          </DetailRow>
          {inventoryTunnels.map((item) => (
            <DetailRow key={`inventory-tunnel-${item.id}`} label={format.label(item.name)}>
              <span className="inline-flex min-w-0 items-center justify-end gap-1.5">
                <StatusBadge tone={inventoryStatusTone(item.status)}>{inventoryStatusLabel(item.status, t)}</StatusBadge>
                <span className="truncate">
                  {[item.type, item.localInterfaceName ?? item.interfaceName, item.routeGroup].filter(Boolean).map(String).map(format.label).join(' / ')}
                </span>
              </span>
            </DetailRow>
          ))}
        </>
      ) : null}
      {detailDataState === 'live' && inventoryInterfaces.length === 0 ? (
        <DetailRow label={t.serverEdit.labels.inventoryInterfaces}>{t.serverEdit.values.noInventoryInterfaces}</DetailRow>
      ) : null}
      {detailDataState === 'live' && inventoryTunnels.length === 0 ? (
        <DetailRow label={t.serverEdit.labels.inventoryTunnels}>{t.serverEdit.values.noInventoryTunnels}</DetailRow>
      ) : null}
      {metricRows.map((item) => (
        <DetailRow key={item.name} label={item.name}>{item.value}</DetailRow>
      ))}
      {wireGuardRows.map((item) => (
        <DetailRow key={`wg-${item.name}`} label={`${t.serverEdit.labels.wireGuardInterface} ${item.name}`}>
          <span className="inline-flex items-center gap-1.5">
            <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
            <span>{item.peerSummary}</span>
          </span>
        </DetailRow>
      ))}
      {wireGuardRows.map((item) => (
        <DetailRow key={`wg-rate-${item.name}`} label={`${item.name} ${t.serverEdit.labels.networkRate}`}>
          {item.rate}
        </DetailRow>
      ))}
      {wireGuardRows.map((item) => (
        <DetailRow key={`wg-handshake-${item.name}`} label={`${item.name} ${t.serverEdit.labels.latestHandshake}`}>
          {item.handshake}
        </DetailRow>
      ))}
      {wireGuardRows.length === 0 ? (
        <DetailRow label={t.serverEdit.labels.wireGuardInterfaces}>{t.serverEdit.values.noWireGuardTelemetry}</DetailRow>
      ) : null}
      <DetailRow label={t.serverEdit.labels.interfaceMap}>{interfaces.map((item) => format.label(item)).join(' / ')}</DetailRow>
    </div>
  );
}

function summarizeWireGuardInterfaces(
  interfaces: WireGuardInterfaceMetric[],
  format: DashboardFormatters,
  t: DashboardStrings,
): { label: string; tone: Tone } {
  if (interfaces.length === 0) {
    return { label: t.serverEdit.values.noWireGuardTelemetry, tone: 'neutral' };
  }

  const totalPeers = interfaces.reduce((sum, item) => sum + item.peerCount, 0);
  const activePeers = interfaces.reduce((sum, item) => sum + item.activePeerCount, 0);
  const worstStatus = interfaces.reduce((current, item) => {
    const currentRank = wireGuardStatusRank(current);
    const nextRank = wireGuardStatusRank(item.status);

    return nextRank > currentRank ? item.status : current;
  }, 'up');
  const statusLabel = wireGuardStatusLabel(worstStatus, t);
  const peerSummary = totalPeers > 0
    ? t.serverEdit.values.wireGuardPeerSummary(format.integer(activePeers), format.integer(totalPeers))
    : t.serverEdit.values.wireGuardNoPeers;

  return {
    label: `${statusLabel} / ${peerSummary}`,
    tone: wireGuardTone({ status: worstStatus, peerCount: totalPeers, activePeerCount: activePeers } as WireGuardInterfaceMetric),
  };
}

function wireGuardTone(item: WireGuardInterfaceMetric): Tone {
  if (item.status === 'up' && item.peerCount > 0 && item.activePeerCount === item.peerCount) return 'good';
  if (item.status === 'degraded' || item.activePeerCount > 0) return 'warning';
  if (item.status === 'down' || item.peerCount > 0) return 'critical';

  return 'neutral';
}

function wireGuardStatusRank(status: string): number {
  if (status === 'down') return 3;
  if (status === 'degraded') return 2;
  if (status === 'unknown') return 1;

  return 0;
}

function summarizeRouteProbes(
  probes: RouteProbeMetric[],
  format: DashboardFormatters,
  t: DashboardStrings,
): { label: string; tone: Tone } {
  if (probes.length === 0) {
    return { label: t.serverEdit.values.noProtocolProbes, tone: 'neutral' };
  }

  const criticalCount = probes.filter((probe) => probe.status === 'critical').length;
  const degradedCount = probes.filter((probe) => probe.status === 'degraded').length;
  const healthyCount = probes.filter((probe) => probe.status === 'healthy').length;
  const tone: Tone = criticalCount > 0 ? 'critical' : degradedCount > 0 ? 'warning' : 'good';

  return {
    label: t.serverEdit.values.protocolProbeSummary(
      format.integer(healthyCount),
      format.integer(probes.length),
    ),
    tone,
  };
}

function wireGuardStatusLabel(status: string, t: DashboardStrings): string {
  if (status === 'up') return t.serverEdit.values.wireGuardStatusUp;
  if (status === 'degraded') return t.serverEdit.values.wireGuardStatusDegraded;
  if (status === 'down') return t.serverEdit.values.wireGuardStatusDown;

  return t.serverEdit.values.wireGuardStatusUnknown;
}

function inventoryStatusTone(status: string): Tone {
  if (status === 'up' || status === 'healthy') return 'good';
  if (status === 'degraded') return 'warning';
  if (status === 'down' || status === 'critical') return 'critical';

  return 'neutral';
}

function inventoryStatusLabel(status: string, t: DashboardStrings): string {
  if (status === 'up' || status === 'healthy') return t.serverEdit.values.statusUp;
  if (status === 'degraded') return t.serverEdit.values.statusDegraded;
  if (status === 'down' || status === 'critical') return t.serverEdit.values.statusDown;

  return t.serverEdit.values.statusUnknown;
}

function formatWireGuardPeerSummary(
  item: WireGuardInterfaceMetric,
  format: DashboardFormatters,
  t: DashboardStrings,
): string {
  return item.peerCount > 0
    ? t.serverEdit.values.wireGuardPeerSummary(format.integer(item.activePeerCount), format.integer(item.peerCount))
    : t.serverEdit.values.wireGuardNoPeers;
}

function formatWireGuardHandshake(
  item: WireGuardInterfaceMetric,
  format: DashboardFormatters,
  t: DashboardStrings,
): string {
  return typeof item.latestHandshakeAgeSeconds === 'number'
    ? t.serverEdit.values.latestHandshakeAge(format.durationSeconds(item.latestHandshakeAgeSeconds))
    : t.serverEdit.values.noHandshake;
}

function ServerAuditTab({
  detailDataState,
  format,
  server,
  t,
}: {
  detailDataState: DataState;
  format: DashboardFormatters;
  server: ServerRowData;
  t: DashboardStrings;
}) {
  return (
    <div className="grid gap-2">
      <DetailRow label={t.serverEdit.labels.detailSource}>
        {detailDataState === 'live' ? t.serverEdit.values.apiDetail : detailDataState === 'loading' ? t.dataStatus.loading : t.serverEdit.values.fallbackDetail}
      </DetailRow>
      <DetailRow label={t.accessRows.auditMode}>
        <StatusBadge tone="warning">{t.accessRows.required}</StatusBadge>
      </DetailRow>
      <DetailRow label={t.serverEdit.labels.lastChange}>
        {server.observedAt ? format.time(new Date(server.observedAt), false) : t.serverEdit.values.localSample}
      </DetailRow>
      <DetailRow label={t.serverEdit.labels.auditTrail}>{t.serverEdit.values.readOnlyMvp}</DetailRow>
      <DetailRow label={t.serverEdit.labels.agentFirst}>{t.serverEdit.values.agentFirst}</DetailRow>
      <DetailRow label={t.serverEdit.labels.secretPolicy}>{t.serverEdit.values.secretsHidden}</DetailRow>
    </div>
  );
}

function DetailRow({ children, label }: { children: ReactNode; label: string }) {
  const valueTooltip = primitiveTooltip(children);
  const rowTooltip = valueTooltip ? `${label} ${valueTooltip}` : label;

  return (
    <div className="flex min-h-9 items-center justify-between gap-2 rounded-md border border-afro-line px-2.5" title={rowTooltip}>
      <span className={`${mutedTextClass} min-w-0 truncate`} title={label}>{label}</span>
      <strong className="min-w-0 shrink text-right text-sm" title={valueTooltip}>{children}</strong>
    </div>
  );
}

function EmptyState({ detail, kind = 'empty', message }: { detail?: string; kind?: PanelStateKind; message: string }) {
  return <PanelState detail={detail} kind={kind} title={message} />;
}

function PanelState({
  detail,
  kind,
  title,
}: {
  detail?: string;
  kind: PanelStateKind;
  title: string;
}) {
  const Icon = panelStateIcon(kind);
  const toneClass = panelStateClass(kind);
  const iconClass = kind === 'loading' ? 'animate-spin' : '';

  return (
    <div
      className={`flex min-h-[58px] items-center gap-2 rounded-md border border-dashed px-3 py-2.5 ${toneClass}`}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-white/70">
        <Icon className={iconClass} size={16} />
      </span>
      <span className="min-w-0">
        <strong className="block truncate text-[13px] leading-tight">{title}</strong>
        {detail ? <span className="mt-0.5 block text-[12px] leading-snug opacity-80">{detail}</span> : null}
      </span>
    </div>
  );
}

function DataStateNotice({ state, t }: { state: DataState; t: DashboardStrings }) {
  const kind = dataStatePanelKind(state);
  if (!kind) return null;

  return (
    <PanelState
      detail={dataStatePanelDetail(state, t)}
      kind={kind}
      title={dataStatePanelTitle(state, t)}
    />
  );
}

function DataStateEmpty({
  emptyMessage,
  state,
  t,
}: {
  emptyMessage: string;
  state: DataState;
  t: DashboardStrings;
}) {
  const kind = dataStatePanelKind(state) ?? 'empty';
  const detail = kind === 'empty' ? t.panelStates.emptyDetail : dataStatePanelDetail(state, t);
  const title = kind === 'empty' ? emptyMessage : dataStatePanelTitle(state, t);

  return <PanelState detail={detail} kind={kind} title={title} />;
}

function dataStatePanelKind(state: DataState): PanelStateKind | null {
  if (state === 'loading') return 'loading';
  if (state === 'stale') return 'stale';
  if (state === 'fallback') return 'fallback';

  return null;
}

function dataStatePanelTitle(state: DataState, t: DashboardStrings): string {
  if (state === 'loading') return t.panelStates.loadingTitle;
  if (state === 'stale') return t.panelStates.staleTitle;
  if (state === 'fallback') return t.panelStates.fallbackTitle;

  return t.panelStates.emptyTitle;
}

function dataStatePanelDetail(state: DataState, t: DashboardStrings): string {
  if (state === 'loading') return t.panelStates.loadingDetail;
  if (state === 'stale') return t.panelStates.staleDetail;
  if (state === 'fallback') return t.panelStates.fallbackDetail;

  return t.panelStates.emptyDetail;
}

function panelStateIcon(kind: PanelStateKind): AfroIcon {
  if (kind === 'loading') return Loader2;
  if (kind === 'stale') return WifiOff;
  if (kind === 'empty') return Inbox;

  return AlertTriangle;
}

function panelStateClass(kind: PanelStateKind): string {
  if (kind === 'loading') return 'border-[#bfd1ea] bg-[#edf4ff] text-afro-blue';
  if (kind === 'stale') return 'border-[#e6cf9c] bg-[#fff7e6] text-[#9a5b00]';
  if (kind === 'fallback') return 'border-afro-line bg-[#f8fafb] text-afro-muted';
  if (kind === 'error') return 'border-[#f0b7b7] bg-[#fff1f1] text-[#b91c1c]';

  return 'border-afro-line bg-[#f8fafb] text-afro-muted';
}

function UsersPage({
  format,
  session,
  sessionToken,
  t,
}: {
  format: DashboardFormatters;
  session: AdminSessionResponse;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<Role>('admin');
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [permissionPolicy, setPermissionPolicy] = useState<AdminPermissionsResponse | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const canManageUsers = canManageAdminUsers(session);

  const loadUsers = useMemo(() => async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchAdminUsers(sessionToken, signal);
      setUsers(response.users);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
      setError(t.userManagement.errors.load);
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken, t]);

  useEffect(() => {
    const controller = new AbortController();
    void loadUsers(controller.signal);

    return () => controller.abort();
  }, [loadUsers]);

  const loadPermissions = useMemo(() => async (signal?: AbortSignal) => {
    setPermissionError(null);

    try {
      const response = await fetchAdminPermissions(sessionToken, signal);
      setPermissionPolicy(response);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
      setPermissionError(t.rbac.errors.load);
    }
  }, [sessionToken, t]);

  useEffect(() => {
    const controller = new AbortController();
    void loadPermissions(controller.signal);

    return () => controller.abort();
  }, [loadPermissions]);

  const resetCreateForm = () => {
    setNewUsername('');
    setNewPassword('');
    setNewRole('admin');
  };

  const closeCreateForm = () => {
    setIsCreateFormOpen(false);
    resetCreateForm();
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      const createdUser = await createAdminUser(sessionToken, {
        username: newUsername,
        password: newPassword,
        role: newRole,
        status: 'active',
      });
      setUsers((current) => [createdUser, ...current.filter((item) => item.id !== createdUser.id)]);
      closeCreateForm();
    } catch {
      setError(t.userManagement.errors.save);
    }
  };

  const handleToggleStatus = async (user: AdminUserSummary) => {
    setError(null);

    try {
      const updatedUser = await updateAdminUser(sessionToken, user.id, {
        status: user.status === 'active' ? 'disabled' : 'active',
      });
      setUsers((current) => current.map((item) => item.id === updatedUser.id ? updatedUser : item));
    } catch {
      setError(t.userManagement.errors.save);
    }
  };

  const handleDeleteUser = async (user: AdminUserSummary) => {
    setError(null);

    try {
      await deleteAdminUser(sessionToken, user.id);
      setUsers((current) => current.filter((item) => item.id !== user.id));
    } catch {
      setError(t.userManagement.errors.save);
    }
  };

  const handleChangePassword = async (user: AdminUserSummary) => {
    const password = passwordDrafts[user.id]?.trim();
    if (!password) return;
    setError(null);

    try {
      const updatedUser = await updateAdminUserPassword(sessionToken, user.id, { password });
      setUsers((current) => current.map((item) => item.id === updatedUser.id ? updatedUser : item));
      setPasswordDrafts((current) => ({ ...current, [user.id]: '' }));
    } catch {
      setError(t.userManagement.errors.save);
    }
  };

  return (
    <section className="mt-0 grid gap-3">
      {isCreateFormOpen ? (
        <section className={panelClass}>
          <div className="flex min-h-9 items-center justify-between gap-3 border-b border-afro-line pb-2">
            <PanelHeadingContent title={t.panels.createUser} meta={t.panels.protectedAccess} />
            <button
              className="inline-flex min-h-9 items-center justify-center rounded-md border border-afro-line bg-white px-3 text-[13px] font-bold text-afro-ink hover:border-afro-blue hover:text-afro-blue"
              onClick={closeCreateForm}
              type="button"
            >
              {t.actions.cancel}
            </button>
          </div>
          <form className="mt-2 grid gap-2 xl:grid-cols-[minmax(170px,1fr)_minmax(170px,1fr)_minmax(150px,0.7fr)_auto] xl:items-end" onSubmit={handleCreateUser}>
            <label className="grid gap-1.5">
              <span className={mutedTextClass}>{t.userManagement.username}</span>
              <input
                autoFocus
                className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm font-bold outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45"
                disabled={!canManageUsers}
                onChange={(event) => setNewUsername(event.target.value)}
                required
                type="text"
                value={newUsername}
              />
            </label>
            <label className="grid gap-1.5">
              <span className={mutedTextClass}>{t.userManagement.password}</span>
              <input
                className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm font-bold outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45"
                disabled={!canManageUsers}
                minLength={8}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                type="password"
                value={newPassword}
              />
            </label>
            <label className="grid gap-1.5">
              <span className={mutedTextClass}>{t.userManagement.role}</span>
              <select
                className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm font-bold outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45"
                disabled={!canManageUsers}
                onChange={(event) => setNewRole(event.target.value as Role)}
                value={newRole}
              >
                {managedAdminRoles.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </label>
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-afro-sidebar px-4 text-sm font-bold text-white hover:bg-[#1f3138] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!canManageUsers}
              type="submit"
            >
              <UserRound size={16} />
              {t.actions.create}
            </button>
          </form>
        </section>
      ) : null}

      <section className={panelClass}>
        <div className="flex min-h-9 flex-col gap-2 border-b border-afro-line pb-2 sm:flex-row sm:items-center sm:justify-between">
          <PanelHeadingContent
            title={t.panels.adminUsers}
            meta={isLoading ? t.dataStatus.loading : t.userManagement.usersLoaded(format.integer(users.length))}
          />
          <button
            className="inline-flex min-h-9 w-fit items-center justify-center gap-2 rounded-md bg-afro-sidebar px-3 text-[13px] font-bold text-white hover:bg-[#1f3138] disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!canManageUsers}
            onClick={() => setIsCreateFormOpen((current) => !current)}
            type="button"
          >
            <Plus size={15} />
            {t.actions.addUser}
          </button>
        </div>
        <div className="mt-2 grid gap-2">
          {error ? <PanelState detail={error} kind="error" title={t.panelStates.errorTitle} /> : null}
          {isLoading && users.length === 0 ? <PanelState detail={t.panelStates.loadingDetail} kind="loading" title={t.panelStates.loadingTitle} /> : null}
          {!isLoading && users.length === 0 && !error ? (
            <PanelState detail={t.panelStates.emptyDetail} kind="empty" title={t.operationalData.noUsers} />
          ) : null}
          {users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse">
                <thead>
                  <tr>
                    {[
                      t.userManagement.username,
                      t.userManagement.role,
                      t.userManagement.status,
                      t.userManagement.source,
                      t.userManagement.protection,
                      t.tables.actions,
                    ].map((heading) => (
                      <th className="border-b border-afro-line px-2 py-1.5 text-left text-[13px] font-bold text-afro-muted first:pl-0 last:pr-0" key={heading}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <TableCell>
                        <strong className="block text-afro-ink">{user.username}</strong>
                        <span className="text-[12px] text-afro-muted">{format.time(new Date(user.updatedAt), false)}</span>
                      </TableCell>
                      <TableCell>{user.role}</TableCell>
                      <TableCell>
                        <StatusBadge tone={user.status === 'active' ? 'good' : 'warning'}>
                          {t.userManagement[user.status]}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>{t.userManagement[user.source]}</TableCell>
                      <TableCell>
                        <StatusBadge tone={user.isSuperAdmin ? 'critical' : user.canDelete ? 'neutral' : 'warning'}>
                          {user.isSuperAdmin ? t.userManagement.protected : user.canDelete ? t.userManagement.managed : t.userManagement.protected}
                        </StatusBadge>
                      </TableCell>
                      <td className="border-b border-afro-line px-2 py-1.5 text-[13px] text-afro-muted first:pl-0 last:pr-0">
                        <div className="flex min-w-[260px] flex-wrap gap-1.5">
                          <button
                            className="min-h-8 rounded-md border border-afro-line bg-white px-2 text-[12px] font-bold text-afro-ink disabled:cursor-not-allowed disabled:opacity-45"
                            disabled={!canManageUsers || !user.canDisable}
                            onClick={() => void handleToggleStatus(user)}
                            type="button"
                          >
                            {user.status === 'active' ? t.actions.disable : t.actions.enable}
                          </button>
                          <button
                            className="min-h-8 rounded-md border border-[#f0b7b7] bg-white px-2 text-[12px] font-bold text-[#b91c1c] disabled:cursor-not-allowed disabled:opacity-45"
                            disabled={!canManageUsers || !user.canDelete}
                            onClick={() => void handleDeleteUser(user)}
                            type="button"
                          >
                            {t.actions.delete}
                          </button>
                          <input
                            className="min-h-8 w-28 rounded-md border border-afro-line bg-white px-2 text-[12px] font-bold outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-2 disabled:opacity-45"
                            disabled={!canManageUsers || !user.canChangePassword}
                            onChange={(event) => setPasswordDrafts((current) => ({ ...current, [user.id]: event.target.value }))}
                            placeholder={t.userManagement.newPassword}
                            type="password"
                            value={passwordDrafts[user.id] ?? ''}
                          />
                          <button
                            className="min-h-8 rounded-md border border-afro-line bg-white px-2 text-[12px] font-bold text-afro-blue disabled:cursor-not-allowed disabled:opacity-45"
                            disabled={!canManageUsers || !user.canChangePassword || !passwordDrafts[user.id]}
                            onClick={() => void handleChangePassword(user)}
                            type="button"
                          >
                            {t.actions.savePassword}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>
      <RolePermissionsPanel format={format} policy={permissionPolicy} error={permissionError} t={t} />
    </section>
  );
}

function RolePermissionsPanel({
  error,
  format,
  policy,
  t,
}: {
  error: string | null;
  format: DashboardFormatters;
  policy: AdminPermissionsResponse | null;
  t: DashboardStrings;
}) {
  const permissionCount = policy ? format.integer(policy.permissions.length) : t.dataStatus.loading;
  const currentRole = policy?.currentRole ?? t.dataStatus.loading;
  const currentAccess = policy?.currentHasFullAccess ? t.rbac.fullAccess : format.integer(policy?.currentPermissions.length ?? 0);

  return (
    <section className={panelClass}>
      <div className="flex min-h-9 flex-col gap-2 border-b border-afro-line pb-2 sm:flex-row sm:items-center sm:justify-between">
        <PanelHeadingContent title={t.panels.rolePermissions} meta={t.rbac.permissionsLoaded(permissionCount)} />
        <StatusBadge tone={policy?.deniedByDefault ? 'good' : 'warning'}>{t.rbac.deniedByDefault}</StatusBadge>
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-3">
        <div className="rounded-md border border-afro-line bg-white px-3 py-2">
          <span className={mutedTextClass}>{t.rbac.currentRole}</span>
          <strong className="mt-1 block text-sm text-afro-ink">{currentRole}</strong>
        </div>
        <div className="rounded-md border border-afro-line bg-white px-3 py-2">
          <span className={mutedTextClass}>{t.rbac.currentPermissions}</span>
          <strong className="mt-1 block text-sm text-afro-ink">{currentAccess}</strong>
        </div>
        <div className="rounded-md border border-afro-line bg-white px-3 py-2">
          <span className={mutedTextClass}>{t.rbac.policy}</span>
          <strong className="mt-1 block text-sm text-afro-ink">{t.rbac.roleGuarded}</strong>
        </div>
      </div>
      <div className="mt-2 grid gap-2">
        {error ? <PanelState detail={error} kind="error" title={t.panelStates.errorTitle} /> : null}
        {!policy && !error ? <PanelState detail={t.panelStates.loadingDetail} kind="loading" title={t.panelStates.loadingTitle} /> : null}
        {policy ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse">
              <thead>
                <tr>
                  <th className="border-b border-afro-line px-2 py-1.5 text-left text-[13px] font-bold text-afro-muted first:pl-0">
                    {t.rbac.permission}
                  </th>
                  <th className="border-b border-afro-line px-2 py-1.5 text-left text-[13px] font-bold text-afro-muted">
                    {t.rbac.category}
                  </th>
                  <th className="border-b border-afro-line px-2 py-1.5 text-left text-[13px] font-bold text-afro-muted">
                    {t.rbac.risk}
                  </th>
                  {policy.roles.map((role) => (
                    <th className="border-b border-afro-line px-2 py-1.5 text-center text-[13px] font-bold text-afro-muted last:pr-0" key={role.role}>
                      {role.role}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {policy.permissions.map((permission) => (
                  <tr key={permission.id}>
                    <TableCell>
                      <strong className="block text-afro-ink">{permissionLabel(permission.id, t)}</strong>
                      <span className="text-[12px] text-afro-muted">{permission.id}</span>
                    </TableCell>
                    <TableCell>{t.rbac.categories[permission.category]}</TableCell>
                    <TableCell>
                      <StatusBadge tone={permissionRiskTone(permission.risk)}>{t.rbac.risks[permission.risk]}</StatusBadge>
                    </TableCell>
                    {policy.roles.map((role) => {
                      const allowed = role.inheritsAll || role.permissions.includes(permission.id);

                      return (
                        <td className="border-b border-afro-line px-2 py-1.5 text-center text-[13px] text-afro-muted last:pr-0" key={`${permission.id}:${role.role}`}>
                          <span
                            className={`inline-grid size-7 place-items-center rounded-md border ${allowed ? 'border-[#bbdec8] bg-[#eefbf2] text-[#166534]' : 'border-afro-line bg-[#f8fafb] text-afro-muted'}`}
                            title={allowed ? t.rbac.allowed : t.rbac.blocked}
                          >
                            {allowed ? <CheckCircle2 size={15} /> : <LockKeyhole size={15} />}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function permissionLabel(permissionId: AdminPermissionId, t: DashboardStrings): string {
  return t.rbac.permissions[permissionId] ?? permissionId;
}

function permissionRiskTone(risk: AdminPermissionsResponse['permissions'][number]['risk']): Tone {
  if (risk === 'critical') return 'critical';
  if (risk === 'high') return 'warning';
  if (risk === 'medium') return 'neutral';

  return 'good';
}

type AuditLogFilterState = {
  action: string;
  targetType: string;
};

function AuditLogsPage({
  format,
  sessionToken,
  t,
}: {
  format: DashboardFormatters;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogSummary[]>([]);
  const [filters, setFilters] = useState<AuditLogFilterState>({ action: '', targetType: '' });
  const [draftFilters, setDraftFilters] = useState<AuditLogFilterState>({ action: '', targetType: '' });
  const [dataState, setDataState] = useState<DataState>('loading');
  const [error, setError] = useState<string | null>(null);

  const loadAuditLogs = useMemo(() => async (signal?: AbortSignal) => {
    setDataState('loading');
    setError(null);

    try {
      const response = await fetchAdminAuditLogs(sessionToken, {
        action: filters.action || undefined,
        limit: 100,
        targetType: filters.targetType || undefined,
      }, signal);

      setAuditLogs(response.auditLogs);
      setDataState('live');
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;

      setError(t.auditLogs.errors.load);
      setDataState((current) => (current === 'live' || current === 'stale' ? 'stale' : 'fallback'));
    }
  }, [filters, sessionToken, t]);

  useEffect(() => {
    const controller = new AbortController();
    void loadAuditLogs(controller.signal);

    return () => controller.abort();
  }, [loadAuditLogs]);

  const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters({
      action: draftFilters.action.trim(),
      targetType: draftFilters.targetType.trim(),
    });
  };

  const actorTypeCount = new Set(auditLogs.map((log) => log.actorType)).size;
  const targetTypeCount = new Set(auditLogs.map((log) => log.targetType).filter(Boolean)).size;
  const latestEvent = auditLogs[0]?.createdAt ? format.dateTime(new Date(auditLogs[0].createdAt)) : t.auditLogs.none;

  return (
    <section className="mt-0 grid gap-3">
      <section className="grid gap-2 md:grid-cols-4">
        <div className={panelClass}>
          <span className={mutedTextClass}>{t.auditLogs.eventsShown}</span>
          <strong className="mt-1 block text-[22px] leading-tight text-afro-ink">{format.integer(auditLogs.length)}</strong>
        </div>
        <div className={panelClass}>
          <span className={mutedTextClass}>{t.auditLogs.actorTypes}</span>
          <strong className="mt-1 block text-[22px] leading-tight text-afro-ink">{format.integer(actorTypeCount)}</strong>
        </div>
        <div className={panelClass}>
          <span className={mutedTextClass}>{t.auditLogs.targetTypes}</span>
          <strong className="mt-1 block text-[22px] leading-tight text-afro-ink">{format.integer(targetTypeCount)}</strong>
        </div>
        <div className={panelClass}>
          <span className={mutedTextClass}>{t.auditLogs.latestEvent}</span>
          <strong className="mt-1 block truncate text-[15px] leading-tight text-afro-ink" title={latestEvent}>{latestEvent}</strong>
        </div>
      </section>

      <section className={panelClass}>
        <form className="grid gap-2 md:grid-cols-[minmax(160px,1fr)_minmax(160px,1fr)_auto] md:items-end" onSubmit={handleFilterSubmit}>
          <label className={fieldLabelClass}>
            <span>{t.auditLogs.actionFilter}</span>
            <input
              className={fieldInputClass}
              onChange={(event) => setDraftFilters((current) => ({ ...current, action: event.target.value }))}
              placeholder={t.auditLogs.allActions}
              type="text"
              value={draftFilters.action}
            />
          </label>
          <label className={fieldLabelClass}>
            <span>{t.auditLogs.targetTypeFilter}</span>
            <input
              className={fieldInputClass}
              onChange={(event) => setDraftFilters((current) => ({ ...current, targetType: event.target.value }))}
              placeholder={t.auditLogs.allTargets}
              type="text"
              value={draftFilters.targetType}
            />
          </label>
          <button className={primaryButtonClass} type="submit">
            {t.auditLogs.refresh}
          </button>
        </form>
      </section>

      <section className={panelClass}>
        <div className="flex min-h-9 flex-col gap-2 border-b border-afro-line pb-2 sm:flex-row sm:items-center sm:justify-between">
          <PanelHeadingContent
            title={t.auditLogs.title}
            meta={dataState === 'loading' ? t.dataStatus.loading : t.auditLogs.eventsLoaded(format.integer(auditLogs.length))}
          />
          <StatusBadge tone={dataState === 'live' ? 'good' : dataState === 'stale' ? 'warning' : 'neutral'}>
            {dataState === 'live' ? t.dataStatus.live : dataState === 'stale' ? t.dataStatus.stale : dataState === 'loading' ? t.dataStatus.loading : t.dataStatus.fallback}
          </StatusBadge>
        </div>

        <div className="mt-2 grid gap-2">
          {error ? <PanelState detail={error} kind="error" title={t.panelStates.errorTitle} /> : null}
          {dataState === 'loading' && auditLogs.length === 0 ? (
            <PanelState detail={t.panelStates.loadingDetail} kind="loading" title={t.panelStates.loadingTitle} />
          ) : null}
          {dataState !== 'loading' && auditLogs.length === 0 && !error ? (
            <PanelState detail={t.panelStates.emptyDetail} kind="empty" title={t.auditLogs.noEvents} />
          ) : null}
          {auditLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse">
                <thead>
                  <tr>
                    {[
                      t.auditLogs.time,
                      t.auditLogs.actor,
                      t.auditLogs.action,
                      t.auditLogs.target,
                      t.auditLogs.metadata,
                    ].map((heading) => (
                      <th className="border-b border-afro-line px-2 py-1.5 text-left text-[13px] font-bold text-afro-muted first:pl-0 last:pr-0" key={heading}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <TableCell>{format.dateTime(new Date(log.createdAt))}</TableCell>
                      <TableCell>
                        <strong className="block text-afro-ink">{log.actorType}</strong>
                        <span className="font-mono text-[12px] text-afro-muted">{shortenAuditId(log.actorId) ?? t.auditLogs.none}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-[12px] text-afro-ink">{log.action}</span>
                      </TableCell>
                      <TableCell>
                        <strong className="block text-afro-ink">{log.targetType ?? t.auditLogs.none}</strong>
                        <span className="font-mono text-[12px] text-afro-muted">{shortenAuditId(log.targetId) ?? t.auditLogs.none}</span>
                      </TableCell>
                      <TableCell>
                        <code className="block max-w-[360px] truncate rounded-md border border-afro-line bg-[#f8fafb] px-2 py-1 text-[12px] text-afro-muted" title={formatAuditMetadata(log.metadata, t.auditLogs.none)}>
                          {formatAuditMetadata(log.metadata, t.auditLogs.none)}
                        </code>
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>
    </section>
  );
}

function shortenAuditId(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 28) return value;

  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function formatAuditMetadata(metadata: Record<string, unknown>, emptyLabel: string): string {
  const serialized = JSON.stringify(metadata);
  if (!serialized || serialized === '{}') return emptyLabel;
  if (serialized.length <= 240) return serialized;

  return `${serialized.slice(0, 240)}...`;
}

function ReportsPage({
  format,
  sessionToken,
  t,
}: {
  format: DashboardFormatters;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const [summary, setSummary] = useState<AdminReportsSummaryResponse | null>(null);
  const [dataState, setDataState] = useState<DataState>('loading');
  const [error, setError] = useState<string | null>(null);

  const loadReports = useMemo(() => async (signal?: AbortSignal) => {
    setDataState('loading');
    setError(null);

    try {
      const response = await fetchAdminReportsSummary(sessionToken, 168, signal);
      setSummary(response);
      setDataState('live');
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;

      setError(t.reports.errors.load);
      setDataState((current) => (current === 'live' || current === 'stale' ? 'stale' : 'fallback'));
    }
  }, [sessionToken, t]);

  useEffect(() => {
    const controller = new AbortController();
    void loadReports(controller.signal);

    return () => controller.abort();
  }, [loadReports]);

  const reportCards = summary ? [
    { label: t.reports.riskScore, value: format.percent(summary.riskScore), tone: reportRiskTone(summary.riskLevel) },
    { label: t.reports.openAlerts, value: format.integer(summary.alerts.open), tone: summary.alerts.critical > 0 ? 'critical' : summary.alerts.warning > 0 ? 'warning' : 'good' },
    { label: t.reports.serversAtRisk, value: format.integer(summary.servers.critical + summary.servers.degraded), tone: summary.servers.critical > 0 ? 'critical' : summary.servers.degraded > 0 ? 'warning' : 'good' },
    { label: t.reports.routeWindows, value: format.integer(summary.routeQuality.recommendationCount), tone: summary.routeQuality.upcomingDegradedWindowCount > 0 ? 'warning' : 'good' },
  ] : [];

  return (
    <section className="mt-0 grid gap-3">
      <section className="grid gap-2 md:grid-cols-4">
        {summary ? reportCards.map((card) => (
          <BackupMetricCard key={card.label} label={card.label} tone={card.tone as Tone} value={card.value} />
        )) : (
          <BackupMetricCard label={t.reports.riskScore} tone="warning" value={t.dataStatus.loading} />
        )}
      </section>

      <section className={panelClass}>
        <div className="flex min-h-9 flex-col gap-2 border-b border-afro-line pb-2 sm:flex-row sm:items-center sm:justify-between">
          <PanelHeadingContent
            title={t.reports.title}
            meta={summary ? t.reports.generated(format.dateTime(new Date(summary.generatedAt))) : t.dataStatus.loading}
          />
          <button
            className="inline-flex min-h-9 w-fit items-center justify-center rounded-md bg-afro-sidebar px-3 text-[13px] font-bold text-white hover:bg-[#1f3138]"
            onClick={() => void loadReports()}
            type="button"
          >
            {t.reports.refresh}
          </button>
        </div>
        <div className="mt-2 grid gap-2">
          {error ? <PanelState detail={error} kind="error" title={t.panelStates.errorTitle} /> : null}
          {dataState === 'loading' && !summary ? (
            <PanelState detail={t.panelStates.loadingDetail} kind="loading" title={t.panelStates.loadingTitle} />
          ) : null}
          {summary ? (
            <div className="grid gap-2 lg:grid-cols-2">
              <DetailRow label={t.reports.riskLevel}>
                <StatusBadge tone={reportRiskTone(summary.riskLevel)}>{reportRiskLabel(summary.riskLevel, t)}</StatusBadge>
              </DetailRow>
              <DetailRow label={t.reports.range}>{t.reports.hours(format.integer(summary.rangeHours))}</DetailRow>
              <DetailRow label={t.reports.backupReadiness}>
                <StatusBadge tone={backupStatusTone(summary.backups.status as AdminBackupStatusSummary['status'])}>
                  {backupStatusLabel(summary.backups.status as AdminBackupStatusSummary['status'], t)}
                </StatusBadge>
              </DetailRow>
              <DetailRow label={t.reports.routeData}>
                {summary.routeQuality.insufficientData ? t.reports.insufficientData : t.reports.routeWindowsLoaded(format.integer(summary.routeQuality.windowCount))}
              </DetailRow>
            </div>
          ) : null}
        </div>
      </section>

      {summary ? (
        <section className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className={panelClass}>
            <PanelHeading title={t.reports.operationalSummary} icon={Gauge} meta={reportRiskLabel(summary.riskLevel, t)} />
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <MetricPill icon={Server} label={t.reports.servers} value={t.reports.healthMix(format.integer(summary.servers.healthy), format.integer(summary.servers.degraded), format.integer(summary.servers.critical))} />
              <MetricPill icon={Route} label={t.reports.outbounds} value={t.reports.healthMix(format.integer(summary.outbounds.healthy), format.integer(summary.outbounds.degraded), format.integer(summary.outbounds.critical))} />
              <MetricPill icon={AlertTriangle} label={t.reports.alerts} value={t.reports.alertMix(format.integer(summary.alerts.critical), format.integer(summary.alerts.warning))} />
              <MetricPill icon={Archive} label={t.reports.backups} value={t.reports.issueMix(format.integer(summary.backups.criticalIssueCount), format.integer(summary.backups.warningIssueCount))} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {summary.reasonCodes.map((reason) => (
                <span className="rounded-full border border-afro-line bg-afro-soft px-2 py-1 text-[11px] font-bold text-afro-muted" key={reason}>
                  {reportReasonLabel(reason, t)}
                </span>
              ))}
            </div>
          </section>

          <section className={panelClass}>
            <PanelHeading title={t.reports.routeQuality} icon={Activity} meta={t.reports.recommendations(format.integer(summary.routeQuality.recommendationCount))} />
            <div className="mt-2 grid gap-2">
              {summary.routeQuality.topRecommendations.length === 0 ? (
                <PanelState detail={t.reports.insufficientDataDetail} kind="empty" title={t.reports.insufficientData} />
              ) : (
                summary.routeQuality.topRecommendations.map((recommendation) => (
                  <div className="grid gap-1.5 rounded-md border border-afro-line px-2.5 py-2" key={routeRecommendationKey(recommendation)}>
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <strong className="block truncate text-[13px]">{routeRecommendationTitle(recommendation, t)}</strong>
                        <span className="block truncate text-[12px] text-afro-muted">
                          {routeRecommendationDetail(recommendation, format, t)}
                        </span>
                      </div>
                      <StatusBadge tone={recommendation.kind === 'bestWindow' ? 'good' : 'warning'}>
                        {routeRecommendationConfidence(recommendation, t)}
                      </StatusBadge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </section>
      ) : null}
    </section>
  );
}

function BackupsPage({
  format,
  initialBackupStatus,
  sessionToken,
  t,
}: {
  format: DashboardFormatters;
  initialBackupStatus: AdminBackupStatusSummary | null;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const [backupStatus, setBackupStatus] = useState<AdminBackupStatusSummary | null>(initialBackupStatus);
  const [restorePlan, setRestorePlan] = useState<AdminBackupRestorePlanSummary | null>(null);
  const [dataState, setDataState] = useState<DataState>(initialBackupStatus ? 'live' : 'loading');
  const [error, setError] = useState<string | null>(null);

  const loadBackupStatus = useMemo(() => async (signal?: AbortSignal) => {
    setDataState('loading');
    setError(null);

    try {
      const [statusResponse, restorePlanResponse] = await Promise.all([
        fetchAdminBackupStatus(sessionToken, signal),
        fetchAdminBackupRestorePlan(sessionToken, signal),
      ]);
      setBackupStatus(statusResponse.backup);
      setRestorePlan(restorePlanResponse.restorePlan);
      setDataState('live');
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;

      setError(t.backupStatus.errors.load);
      setDataState((current) => (current === 'live' || current === 'stale' ? 'stale' : 'fallback'));
    }
  }, [sessionToken, t]);

  useEffect(() => {
    const controller = new AbortController();
    void loadBackupStatus(controller.signal);

    return () => controller.abort();
  }, [loadBackupStatus]);

  const statusTone = backupStatus ? backupStatusTone(backupStatus.status) : 'warning';
  const latestSuccess = formatBackupDate(backupStatus?.latestSuccessfulBackupAt, format, t);
  const latestAge = formatBackupAgeHours(backupStatus?.latestBackupAgeHours, format, t);
  const encryptionLabel = backupStatus?.encrypted === true
    ? t.backupStatus.encrypted
    : backupStatus?.encrypted === false
      ? t.backupStatus.notEncrypted
      : t.backupStatus.unknown;
  const restoreTest = formatBackupDate(backupStatus?.restoreTestedAt, format, t);
  const issues = backupStatus?.issues ?? [];
  const restorePlanTone = restorePlan ? backupRestoreReadinessTone(restorePlan.readinessStatus) : 'warning';

  return (
    <section className="mt-0 grid gap-3">
      <section className="grid gap-2 md:grid-cols-4">
        <BackupMetricCard
          label={t.backupStatus.status}
          tone={statusTone}
          value={backupStatus ? backupStatusLabel(backupStatus.status, t) : t.dataStatus.loading}
        />
        <BackupMetricCard label={t.backupStatus.latestSuccess} tone={backupStatusAgeTone(backupStatus)} value={latestSuccess} />
        <BackupMetricCard label={t.backupStatus.backupAge} tone={backupStatusAgeTone(backupStatus)} value={latestAge} />
        <BackupMetricCard label={t.backupStatus.encryption} tone={backupStatusEncryptionTone(backupStatus)} value={encryptionLabel} />
      </section>

      <section className={panelClass}>
        <div className="flex min-h-9 flex-col gap-2 border-b border-afro-line pb-2 sm:flex-row sm:items-center sm:justify-between">
          <PanelHeadingContent
            title={t.backupStatus.title}
            meta={backupStatus ? t.backupStatus.issuesLoaded(format.integer(issues.length)) : t.dataStatus.loading}
          />
          <button
            className="inline-flex min-h-9 w-fit items-center justify-center rounded-md bg-afro-sidebar px-3 text-[13px] font-bold text-white hover:bg-[#1f3138]"
            onClick={() => void loadBackupStatus()}
            type="button"
          >
            {t.backupStatus.refresh}
          </button>
        </div>

        <div className="mt-2 grid gap-2">
          {error ? <PanelState detail={error} kind="error" title={t.panelStates.errorTitle} /> : null}
          {dataState === 'loading' && !backupStatus ? (
            <PanelState detail={t.panelStates.loadingDetail} kind="loading" title={t.panelStates.loadingTitle} />
          ) : null}
          {backupStatus ? (
            <div className="grid gap-2 lg:grid-cols-2">
              <DetailRow label={t.backupStatus.latestJob}>
                <StatusBadge tone={backupJobStatusTone(backupStatus.latestJobStatus)}>
                  {backupJobStatusLabel(backupStatus.latestJobStatus, t)}
                </StatusBadge>
              </DetailRow>
              <DetailRow label={t.backupStatus.latestFailure}>
                {formatBackupDate(backupStatus.latestFailedBackupAt, format, t)}
              </DetailRow>
              <DetailRow label={t.backupStatus.maxAge}>
                {t.backupStatus.hours(format.integer(backupStatus.maxBackupAgeHours))}
              </DetailRow>
              <DetailRow label={t.backupStatus.restoreTest}>{restoreTest}</DetailRow>
              <DetailRow label={t.backupStatus.restoreAge}>
                {formatBackupAgeDays(backupStatus.restoreTestAgeDays, format, t)}
              </DetailRow>
              <DetailRow label={t.backupStatus.restoreMaxAge}>
                {t.backupStatus.days(format.integer(backupStatus.restoreTestMaxAgeDays))}
              </DetailRow>
              <DetailRow label={t.backupStatus.backupSize}>
                {format.bytes(backupStatus.sizeBytes ?? null)}
              </DetailRow>
              <DetailRow label={t.backupStatus.duration}>
                {formatBackupDuration(backupStatus.durationSeconds, format, t)}
              </DetailRow>
              <DetailRow label={t.backupStatus.destination}>
                {backupStatus.destinationLabel ?? backupStatus.destinationType ?? t.backupStatus.notAvailable}
              </DetailRow>
              <DetailRow label={t.backupStatus.statusFile}>
                <StatusBadge tone={backupStatus.statusFileReadable ? 'good' : backupStatus.statusFileConfigured ? 'critical' : 'warning'}>
                  {backupStatus.statusFileReadable ? t.backupStatus.readable : backupStatus.statusFileConfigured ? t.backupStatus.unreadable : t.backupStatus.notConfigured}
                </StatusBadge>
              </DetailRow>
              <DetailRow label={t.backupStatus.statusFileUpdated}>
                {formatBackupDate(backupStatus.statusFileUpdatedAt, format, t)}
              </DetailRow>
              <DetailRow label={t.backupStatus.restoreExecution}>
                <StatusBadge tone="neutral">{t.backupStatus.readOnly}</StatusBadge>
              </DetailRow>
            </div>
          ) : null}
        </div>
      </section>

      {backupStatus ? (
        <section className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className={panelClass}>
            <PanelHeading title={t.backupStatus.readiness} icon={ShieldCheck} meta={backupStatusLabel(backupStatus.status, t)} />
            <div className="mt-2 grid gap-2">
              <DetailRow label={t.backupStatus.monitoring}>
                <StatusBadge tone={backupStatus.monitoringEnabled ? 'good' : 'warning'}>
                  {backupStatus.monitoringEnabled ? t.backupStatus.enabled : t.backupStatus.notConfigured}
                </StatusBadge>
              </DetailRow>
              <DetailRow label={t.backupStatus.encryptionRequired}>
                {backupStatus.encryptionRequired ? t.backupStatus.required : t.backupStatus.notRequired}
              </DetailRow>
              <DetailRow label={t.backupStatus.retention}>
                {t.backupStatus.retentionSummary(
                  format.integer(backupStatus.retention.dailyDays),
                  format.integer(backupStatus.retention.weeklyWeeks),
                  format.integer(backupStatus.retention.monthlyMonths),
                )}
              </DetailRow>
              <DetailRow label={t.backupStatus.artifacts}>
                {backupStatus.artifacts.length > 0
                  ? backupStatus.artifacts.map((artifact) => backupArtifactLabel(artifact, t)).join(', ')
                  : t.backupStatus.notAvailable}
              </DetailRow>
            </div>
          </section>

          <section className={panelClass}>
            <PanelHeading title={t.backupStatus.issues} icon={AlertTriangle} meta={t.backupStatus.issuesLoaded(format.integer(issues.length))} />
            <div className="mt-2 grid gap-2">
              {issues.length === 0 ? (
                <PanelState detail={t.backupStatus.noIssuesDetail} kind="empty" title={t.backupStatus.noIssues} />
              ) : (
                issues.map((issue) => (
                  <div className="grid min-h-[42px] grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-afro-line p-2" key={`${issue.code}-${issue.severity}`}>
                    <span className="min-w-0 truncate text-sm font-bold text-afro-ink" title={backupIssueLabel(issue.code, t)}>
                      {backupIssueLabel(issue.code, t)}
                    </span>
                    <StatusBadge tone={issue.severity === 'critical' ? 'critical' : 'warning'}>
                      {issue.severity === 'critical' ? t.status.critical : t.status.warning}
                    </StatusBadge>
                  </div>
                ))
              )}
            </div>
          </section>
        </section>
      ) : null}

      {restorePlan ? (
        <section className="grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <section className={panelClass}>
            <PanelHeading
              title={t.backupStatus.restoreReadiness}
              icon={ShieldCheck}
              meta={backupRestoreReadinessLabel(restorePlan.readinessStatus, t)}
            />
            <div className="mt-2 grid gap-2 lg:grid-cols-2">
              <DetailRow label={t.backupStatus.status}>
                <StatusBadge tone={restorePlanTone}>
                  {backupRestoreReadinessLabel(restorePlan.readinessStatus, t)}
                </StatusBadge>
              </DetailRow>
              <DetailRow label={t.backupStatus.restoreExecution}>
                <StatusBadge tone={restorePlan.canExecuteRestore ? 'good' : 'neutral'}>
                  {restorePlan.canExecuteRestore ? t.backupStatus.restoreCanExecute : t.backupStatus.restoreExecutionDisabled}
                </StatusBadge>
              </DetailRow>
              <DetailRow label={t.backupStatus.restoreTargets}>
                {restorePlan.targetArtifacts.map((artifact) => backupArtifactLabel(artifact, t)).join(', ')}
              </DetailRow>
              <DetailRow label={t.backupStatus.restorePlanGenerated}>
                {formatBackupDate(restorePlan.generatedAt, format, t)}
              </DetailRow>
              <DetailRow label={t.backupStatus.restoreBlockers}>
                {t.backupStatus.restoreReasonCount(format.integer(restorePlan.blockerReasonCodes.length))}
              </DetailRow>
              <DetailRow label={t.backupStatus.restoreWarnings}>
                {t.backupStatus.restoreReasonCount(format.integer(restorePlan.warningReasonCodes.length))}
              </DetailRow>
            </div>
            <div className="mt-2 grid gap-2">
              {restorePlan.checks.map((check) => (
                <BackupRestoreCheckRow check={check} key={check.id} t={t} />
              ))}
            </div>
          </section>

          <section className={panelClass}>
            <PanelHeading title={t.backupStatus.restoreRunbook} icon={Archive} meta={t.backupStatus.restoreStepsLoaded(format.integer(restorePlan.steps.length))} />
            <div className="mt-2 grid gap-2">
              {restorePlan.steps.map((step) => (
                <BackupRestorePlanStepRow key={step.id} step={step} t={t} />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {restorePlan.safetyNotes.map((note) => (
                <span className="rounded-full border border-afro-line bg-afro-soft px-2 py-1 text-[11px] font-bold text-afro-muted" key={note}>
                  {backupRestoreSafetyNoteLabel(note, t)}
                </span>
              ))}
            </div>
          </section>
        </section>
      ) : null}
    </section>
  );
}

function BackupMetricCard({ label, tone, value }: { label: string; tone: Tone; value: string }) {
  return (
    <div className={panelClass}>
      <span className={mutedTextClass}>{label}</span>
      <strong className={`mt-1 block truncate text-[18px] leading-tight ${tone === 'critical' ? 'text-[#b91c1c]' : tone === 'warning' ? 'text-[#9a5b00]' : 'text-afro-ink'}`} title={value}>
        {value}
      </strong>
    </div>
  );
}

function BackupRestoreCheckRow({ check, t }: { check: AdminBackupRestoreCheckSummary; t: DashboardStrings }) {
  return (
    <div className="grid min-h-[46px] grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-afro-line p-2">
      <div className="min-w-0">
        <span className="block truncate text-[13px] font-bold text-afro-ink" title={backupRestoreCheckLabel(check.code, t)}>
          {backupRestoreCheckLabel(check.code, t)}
        </span>
        <span className={`${mutedTextClass} block truncate`}>
          {check.reasonCodes.length > 0
            ? check.reasonCodes.slice(0, 3).map((reason) => backupRestoreReasonLabel(reason, t)).join(' / ')
            : t.backupStatus.restoreCheckClear}
        </span>
      </div>
      <StatusBadge tone={backupRestoreCheckStatusTone(check.status)}>
        {backupRestoreCheckStatusLabel(check.status, t)}
      </StatusBadge>
    </div>
  );
}

function BackupRestorePlanStepRow({ step, t }: { step: AdminBackupRestorePlanStepSummary; t: DashboardStrings }) {
  return (
    <div className="grid min-h-[48px] grid-cols-[auto_1fr_auto] items-center gap-2 rounded-md border border-afro-line p-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-afro-soft text-[12px] font-black text-afro-sidebar">
        {step.order}
      </span>
      <div className="min-w-0">
        <span className="block truncate text-[13px] font-bold text-afro-ink" title={backupRestoreStepLabel(step.code, t)}>
          {backupRestoreStepLabel(step.code, t)}
        </span>
        <span className={`${mutedTextClass} block truncate`}>
          {step.destructive ? t.backupStatus.restoreDestructive : t.backupStatus.restoreNonDestructive}
          {' / '}
          {step.requiresOfflineWindow ? t.backupStatus.restoreOfflineWindow : t.backupStatus.restoreOnlineSafe}
        </span>
      </div>
      <StatusBadge tone={step.executionEnabled ? 'good' : 'neutral'}>
        {step.executionEnabled ? t.backupStatus.restoreCanExecute : t.backupStatus.restoreManualOnly}
      </StatusBadge>
    </div>
  );
}

function backupStatusTone(status: AdminBackupStatusSummary['status']): Tone {
  if (status === 'healthy') return 'good';
  if (status === 'critical') return 'critical';

  return 'warning';
}

function backupRestoreReadinessTone(status: string): Tone {
  if (status === 'ready') return 'good';
  if (status === 'blocked') return 'critical';

  return 'warning';
}

function backupRestoreReadinessLabel(status: string, t: DashboardStrings): string {
  const labels = t.backupStatus.restoreReadinessStatusLabels as Record<string, string>;

  return labels[status] ?? status;
}

function backupRestoreCheckStatusTone(status: string): Tone {
  if (status === 'passed') return 'good';
  if (status === 'blocked') return 'critical';
  if (status === 'future') return 'neutral';

  return 'warning';
}

function backupRestoreCheckStatusLabel(status: string, t: DashboardStrings): string {
  const labels = t.backupStatus.restoreCheckStatusLabels as Record<string, string>;

  return labels[status] ?? status;
}

function backupRestoreCheckLabel(code: string, t: DashboardStrings): string {
  const labels = t.backupStatus.restoreCheckLabels as Record<string, string>;

  return labels[code] ?? code;
}

function backupRestoreStepLabel(code: string, t: DashboardStrings): string {
  const labels = t.backupStatus.restoreStepLabels as Record<string, string>;

  return labels[code] ?? code;
}

function backupRestoreReasonLabel(code: string, t: DashboardStrings): string {
  const restoreLabels = t.backupStatus.restoreReasonLabels as Record<string, string>;
  const issueLabels = t.backupStatus.issueLabels as Record<string, string>;

  return restoreLabels[code] ?? issueLabels[code] ?? code;
}

function backupRestoreSafetyNoteLabel(code: string, t: DashboardStrings): string {
  const labels = t.backupStatus.restoreSafetyLabels as Record<string, string>;

  return labels[code] ?? code;
}

function reportRiskTone(level: string): Tone {
  if (level === 'good') return 'good';
  if (level === 'critical') return 'critical';
  if (level === 'risk') return 'warning';

  return 'neutral';
}

function reportRiskLabel(level: string, t: DashboardStrings): string {
  const labels = t.reports.riskLabels as Record<string, string>;

  return labels[level] ?? level;
}

function reportReasonLabel(code: string, t: DashboardStrings): string {
  const labels = t.reports.reasonLabels as Record<string, string>;

  return labels[code] ?? code;
}

function backupStatusAgeTone(backupStatus: AdminBackupStatusSummary | null): Tone {
  if (!backupStatus) return 'warning';
  if (backupStatus.status === 'critical') return 'critical';
  if (!backupStatus.latestSuccessfulBackupAt) return 'critical';
  if (backupStatus.latestBackupAgeHours !== null && backupStatus.latestBackupAgeHours !== undefined && backupStatus.latestBackupAgeHours > backupStatus.maxBackupAgeHours) return 'critical';

  return backupStatus.status === 'warning' ? 'warning' : 'good';
}

function backupStatusEncryptionTone(backupStatus: AdminBackupStatusSummary | null): Tone {
  if (!backupStatus) return 'warning';
  if (backupStatus.encryptionRequired && backupStatus.encrypted !== true) return 'critical';
  if (backupStatus.encrypted === true) return 'good';

  return 'warning';
}

function backupJobStatusTone(status: AdminBackupStatusSummary['latestJobStatus']): Tone {
  if (status === 'succeeded') return 'good';
  if (status === 'failed') return 'critical';
  if (status === 'running') return 'warning';

  return 'neutral';
}

function backupStatusLabel(status: AdminBackupStatusSummary['status'], t: DashboardStrings): string {
  return t.backupStatus.statusLabels[status];
}

function backupJobStatusLabel(status: AdminBackupStatusSummary['latestJobStatus'], t: DashboardStrings): string {
  return t.backupStatus.jobStatusLabels[status];
}

function backupIssueLabel(code: string, t: DashboardStrings): string {
  const labels = t.backupStatus.issueLabels as Record<string, string>;

  return labels[code] ?? code;
}

function backupArtifactLabel(artifact: string, t: DashboardStrings): string {
  const labels = t.backupStatus.artifactLabels as Record<string, string>;

  return labels[artifact] ?? artifact;
}

function formatBackupDate(value: string | null | undefined, format: DashboardFormatters, t: DashboardStrings): string {
  return value ? format.dateTime(new Date(value)) : t.backupStatus.notAvailable;
}

function formatBackupAgeHours(value: number | null | undefined, format: DashboardFormatters, t: DashboardStrings): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return t.backupStatus.notAvailable;

  return t.backupStatus.hoursAgo(format.integer(Math.round(value)));
}

function formatBackupAgeDays(value: number | null | undefined, format: DashboardFormatters, t: DashboardStrings): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return t.backupStatus.notAvailable;

  return t.backupStatus.daysAgo(format.integer(Math.round(value)));
}

function formatBackupDuration(value: number | null | undefined, format: DashboardFormatters, t: DashboardStrings): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return t.backupStatus.notAvailable;
  if (value < 60) return format.durationSeconds(Math.round(value));

  return format.durationMinutes(Math.round(value / 60));
}

type CustomerAccountFormState = {
  displayName: string;
  telegramUsername: string;
  quotaScope: CustomerQuotaScope;
  quotaLimitGb: string;
  perClientLimitGb: string;
  status: CustomerAccountStatus;
  notes: string;
};

const customerQuotaScopeOptions: CustomerQuotaScope[] = ['account_shared', 'per_client'];
const customerAccountStatusOptions: CustomerAccountStatus[] = ['active', 'suspended', 'disabled'];
const currentPanelKindOptions: CurrentPanelKind[] = ['marzban', 'xui', 'sanayi', 'generic'];

function createEmptyCustomerAccountForm(): CustomerAccountFormState {
  return {
    displayName: '',
    notes: '',
    perClientLimitGb: '',
    quotaLimitGb: '50',
    quotaScope: 'account_shared',
    status: 'active',
    telegramUsername: '',
  };
}

type ResellerPackageSaleFormState = {
  customerAccountId: string;
  displayName: string;
  notes: string;
  telegramUsername: string;
  volumePackageId: string;
};

function createEmptyResellerPackageSaleForm(): ResellerPackageSaleFormState {
  return {
    customerAccountId: '',
    displayName: '',
    notes: '',
    telegramUsername: '',
    volumePackageId: '',
  };
}

type CurrentPanelImportFormState = {
  chargeGb: string;
  customerAccountId: string;
  defaultProtocol: string;
  panelKind: CurrentPanelKind;
  payloadJson: string;
  sourceName: string;
};

function createEmptyCurrentPanelImportForm(): CurrentPanelImportFormState {
  return {
    chargeGb: '10',
    customerAccountId: '',
    defaultProtocol: 'vless',
    panelKind: 'marzban',
    payloadJson: '',
    sourceName: '',
  };
}

type ResellerWorkspaceViewState = {
  accounts: AdminCustomerAccountSummary[];
  dataState: DataState;
  error: boolean;
  ledgerEntries: AdminResellerWalletLedgerEntry[];
  packages: AdminVolumePackageSummary[];
  paymentOrders: AdminPaymentOrderSummary[];
  reseller: AdminResellerAccountSummary | null;
};

type ResellerWorkspaceController = ResellerWorkspaceViewState & {
  applyPackageSaleResult: (result: AdminResellerPackageSaleResponse) => void;
};

type ResellerSalesStats = {
  activeCustomerCount: number;
  afroGateShareAmount: number;
  averageSoldGb: number;
  currency: string;
  lowQuotaCount: number;
  orderCount: number;
  remainingBytes: number | null;
  sellerMarginAmount: number;
  soldBytes: number;
  totalSalesAmount: number;
  usedBytes: number;
};

function useResellerWorkspace(sessionToken: string): ResellerWorkspaceController {
  const [state, setState] = useState<ResellerWorkspaceViewState>({
    accounts: [],
    dataState: 'loading',
    error: false,
    ledgerEntries: [],
    packages: [],
    paymentOrders: [],
    reseller: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    setState((current) => ({ ...current, dataState: 'loading', error: false }));
    void fetchAdminResellerWorkspace(sessionToken, controller.signal)
      .then((response) => {
        setState({
          accounts: response.workspace.accounts,
          dataState: 'live',
          error: false,
          ledgerEntries: response.workspace.ledgerEntries,
          packages: response.workspace.packages,
          paymentOrders: response.workspace.paymentOrders,
          reseller: response.workspace.reseller,
        });
      })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;

        setState((current) => ({ ...current, dataState: 'fallback', error: true }));
      });

    return () => controller.abort();
  }, [sessionToken]);

  const applyPackageSaleResult = (result: AdminResellerPackageSaleResponse) => {
    setState((current) => ({
      ...current,
      accounts: [
        result.customerAccount,
        ...current.accounts.filter((account) => account.id !== result.customerAccount.id),
      ],
      dataState: 'live',
      error: false,
      ledgerEntries: [
        result.ledgerEntry,
        ...current.ledgerEntries.filter((entry) => entry.id !== result.ledgerEntry.id),
      ].slice(0, 50),
      paymentOrders: [
        result.paymentOrder,
        ...current.paymentOrders.filter((order) => order.id !== result.paymentOrder.id),
      ],
      reseller: result.reseller,
    }));
  };

  return { ...state, applyPackageSaleResult };
}

function ResellerDashboardPage({
  format,
  sessionToken,
  t,
}: {
  format: DashboardFormatters;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const workspace = useResellerWorkspace(sessionToken);
  const stats = useMemo(
    () => createResellerSalesStats(workspace.accounts, workspace.paymentOrders, workspace.reseller),
    [workspace.accounts, workspace.paymentOrders, workspace.reseller],
  );

  const summaryCards: MetricCardData[] = [
    {
      label: t.reseller.salesAmount,
      value: formatMoneyAmount(stats.totalSalesAmount, stats.currency, format),
      tone: stats.totalSalesAmount > 0 ? 'good' : 'neutral',
    },
    {
      label: t.reseller.soldVolume,
      value: format.bytes(stats.soldBytes),
      tone: stats.soldBytes > 0 ? 'good' : 'neutral',
    },
    {
      label: t.reseller.activeCustomers,
      value: format.integer(stats.activeCustomerCount),
      tone: stats.activeCustomerCount > 0 ? 'good' : 'neutral',
    },
    {
      label: t.reseller.availableWallet,
      value: workspace.reseller ? formatMoneyAmount(workspace.reseller.availableBalanceAmount, workspace.reseller.currency, format) : '--',
      tone: workspace.reseller && workspace.reseller.availableBalanceAmount > 0 ? 'good' : 'warning',
    },
  ];

  return (
    <section className="mt-2 grid gap-3">
      {workspace.error ? <PanelState detail={t.billing.errors.load} kind="error" title={t.panelStates.errorTitle} /> : null}
      {workspace.dataState === 'loading' ? <PanelState detail={t.panelStates.loadingDetail} kind="loading" title={t.panelStates.loadingTitle} /> : null}
      {workspace.dataState !== 'live' && workspace.dataState !== 'loading' ? <DataStateNotice state={workspace.dataState} t={t} /> : null}

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label={t.reseller.dashboardSummary}>
        {summaryCards.map((item) => <MetricCard item={item} key={item.label} />)}
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <ResellerSalesTrendPanel format={format} paymentOrders={workspace.paymentOrders} t={t} />
        <ResellerExperiencePanel accounts={workspace.accounts} format={format} stats={stats} t={t} />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(340px,0.9fr)_minmax(0,1.1fr)]">
        <ResellerSalesSummaryPanel format={format} reseller={workspace.reseller} stats={stats} t={t} />
        <ResellerRecentUsersPanel accounts={workspace.accounts} format={format} paymentOrders={workspace.paymentOrders} t={t} />
      </section>
    </section>
  );
}

function ResellerUsersPage({
  format,
  sessionToken,
  t,
}: {
  format: DashboardFormatters;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const workspace = useResellerWorkspace(sessionToken);
  const [resellerSaleForm, setResellerSaleForm] = useState<ResellerPackageSaleFormState>(() => createEmptyResellerPackageSaleForm());
  const [resellerSaleMessage, setResellerSaleMessage] = useState<string | null>(null);
  const [isSellingResellerPackage, setIsSellingResellerPackage] = useState(false);
  const stats = useMemo(
    () => createResellerSalesStats(workspace.accounts, workspace.paymentOrders, workspace.reseller),
    [workspace.accounts, workspace.paymentOrders, workspace.reseller],
  );

  useEffect(() => {
    if (resellerSaleForm.volumePackageId || workspace.packages.length === 0) return;
    setResellerSaleForm((current) => ({
      ...current,
      volumePackageId: workspace.packages.find((item) => item.status === 'active')?.id ?? workspace.packages[0].id,
    }));
  }, [resellerSaleForm.volumePackageId, workspace.packages]);

  const handleCreateResellerUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resellerSaleForm.volumePackageId) return;

    const existingCustomerId = normalizeNullableText(resellerSaleForm.customerAccountId);
    const displayName = normalizeNullableText(resellerSaleForm.displayName);
    const telegramUsername = normalizeNullableText(resellerSaleForm.telegramUsername);
    if (!existingCustomerId && !displayName && !telegramUsername) {
      setResellerSaleMessage(t.billing.resellerPackageSaleFailed);
      return;
    }

    setIsSellingResellerPackage(true);
    setResellerSaleMessage(null);

    try {
      const result = await createAdminResellerPackageSale(sessionToken, {
        customerAccount: existingCustomerId
          ? null
          : {
              displayName,
              notes: normalizeNullableText(resellerSaleForm.notes),
              quotaScope: 'account_shared',
              status: 'active',
              telegramUsername,
            },
        customerAccountId: existingCustomerId,
        idempotencyKey: `dashboard-reseller-users-add:${Date.now()}`,
        metadata: {
          dashboardFlow: 'reseller_users_add_user',
        },
        notes: normalizeNullableText(resellerSaleForm.notes),
        volumePackageId: resellerSaleForm.volumePackageId,
      });

      workspace.applyPackageSaleResult(result);
      setResellerSaleForm((current) => ({
        ...createEmptyResellerPackageSaleForm(),
        volumePackageId: current.volumePackageId,
      }));
      setResellerSaleMessage(t.billing.resellerPackageSaleSaved(
        format.bytes(result.allocation.volumeBytesDelta),
        formatMoneyAmount(result.quote.walletDebitAmount, result.quote.currency, format),
      ));
    } catch {
      setResellerSaleMessage(t.billing.resellerPackageSaleFailed);
    } finally {
      setIsSellingResellerPackage(false);
    }
  };

  return (
    <section className="mt-2 grid gap-3">
      {workspace.error ? <PanelState detail={t.billing.errors.load} kind="error" title={t.panelStates.errorTitle} /> : null}
      {workspace.dataState === 'loading' ? <PanelState detail={t.panelStates.loadingDetail} kind="loading" title={t.panelStates.loadingTitle} /> : null}
      {workspace.dataState !== 'live' && workspace.dataState !== 'loading' ? <DataStateNotice state={workspace.dataState} t={t} /> : null}

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label={t.reseller.usersSummary}>
        <MetricCard item={{ label: t.reseller.totalCustomers, value: format.integer(workspace.accounts.length), tone: workspace.accounts.length > 0 ? 'good' : 'neutral' }} />
        <MetricCard item={{ label: t.reseller.activeCustomers, value: format.integer(stats.activeCustomerCount), tone: stats.activeCustomerCount > 0 ? 'good' : 'neutral' }} />
        <MetricCard item={{ label: t.reseller.lowQuotaUsers, value: format.integer(stats.lowQuotaCount), tone: stats.lowQuotaCount > 0 ? 'warning' : 'good' }} />
        <MetricCard item={{ label: t.reseller.soldVolume, value: format.bytes(stats.soldBytes), tone: stats.soldBytes > 0 ? 'good' : 'neutral' }} />
      </section>

      <ResellerPackageSalePanel
        accounts={workspace.accounts}
        format={format}
        form={resellerSaleForm}
        isSelling={isSellingResellerPackage}
        message={resellerSaleMessage}
        onFormChange={setResellerSaleForm}
        onSubmit={handleCreateResellerUser}
        packages={workspace.packages}
        submitLabel={t.reseller.addUser}
        t={t}
        title={t.reseller.addUser}
      />

      <ResellerUsersTable accounts={workspace.accounts} format={format} paymentOrders={workspace.paymentOrders} t={t} />
    </section>
  );
}

function ResellerSalesTrendPanel({
  format,
  paymentOrders,
  t,
}: {
  format: DashboardFormatters;
  paymentOrders: AdminPaymentOrderSummary[];
  t: DashboardStrings;
}) {
  const option = useMemo(() => createResellerSalesTrendOption(paymentOrders, format, t), [format, paymentOrders, t]);
  const hasOrders = paymentOrders.some(isCompletedResellerSaleOrder);

  return (
    <section className={panelClass}>
      <PanelHeading title={t.reseller.salesTrend} icon={Activity} meta={t.reseller.lastSevenDays} />
      <div className="mt-2">
        {hasOrders ? (
          <EChart
            ariaLabel={t.reseller.salesTrend}
            className="h-[260px] w-full"
            option={option}
          />
        ) : (
          <EmptyState message={t.reseller.noSalesYet} />
        )}
      </div>
    </section>
  );
}

function ResellerExperiencePanel({
  accounts,
  format,
  stats,
  t,
}: {
  accounts: AdminCustomerAccountSummary[];
  format: DashboardFormatters;
  stats: ResellerSalesStats;
  t: DashboardStrings;
}) {
  const option = useMemo(() => createResellerUsageMixOption(accounts, format, t), [accounts, format, t]);
  const hasAccounts = accounts.length > 0;

  return (
    <section className={panelClass}>
      <PanelHeading title={t.reseller.serviceExperience} icon={Gauge} meta={t.reseller.customerQuotaMix} />
      <div className="mt-2 grid gap-2">
        <div className="grid gap-2 sm:grid-cols-3">
          <MetricPill icon={ShieldCheck} label={t.reseller.remainingVolume} value={stats.remainingBytes === null ? t.billing.unlimited : format.bytes(stats.remainingBytes)} />
          <MetricPill icon={UserRound} label={t.reseller.lowQuotaUsers} value={format.integer(stats.lowQuotaCount)} />
          <MetricPill icon={Activity} label={t.reseller.averageSoldGb} value={format.bytes(Math.round(stats.averageSoldGb * 1024 ** 3))} />
        </div>
        {hasAccounts ? (
          <EChart
            ariaLabel={t.reseller.serviceExperience}
            className="h-[210px] w-full"
            option={option}
          />
        ) : (
          <EmptyState message={t.billing.noCustomerAccounts} />
        )}
      </div>
    </section>
  );
}

function ResellerSalesSummaryPanel({
  format,
  reseller,
  stats,
  t,
}: {
  format: DashboardFormatters;
  reseller: AdminResellerAccountSummary | null;
  stats: ResellerSalesStats;
  t: DashboardStrings;
}) {
  return (
    <section className={panelClass}>
      <PanelHeading title={t.reseller.salesSummary} icon={CreditCard} meta={reseller ? reseller.displayName : t.dataStatus.loading} />
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <MetricPill icon={CreditCard} label={t.reseller.salesAmount} value={formatMoneyAmount(stats.totalSalesAmount, stats.currency, format)} />
        <MetricPill icon={Inbox} label={t.reseller.soldVolume} value={format.bytes(stats.soldBytes)} />
        <MetricPill icon={ShieldCheck} label={t.reseller.afroGateDebited} value={formatMoneyAmount(stats.afroGateShareAmount, stats.currency, format)} />
        <MetricPill icon={UserRound} label={t.reseller.estimatedSellerMargin} value={formatMoneyAmount(stats.sellerMarginAmount, stats.currency, format)} />
        <MetricPill icon={Activity} label={t.reseller.orders} value={format.integer(stats.orderCount)} />
        <MetricPill icon={Gauge} label={t.reseller.activeCustomers} value={format.integer(stats.activeCustomerCount)} />
      </div>
    </section>
  );
}

function ResellerRecentUsersPanel({
  accounts,
  format,
  paymentOrders,
  t,
}: {
  accounts: AdminCustomerAccountSummary[];
  format: DashboardFormatters;
  paymentOrders: AdminPaymentOrderSummary[];
  t: DashboardStrings;
}) {
  const recentAccounts = [...accounts]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, 6);

  return (
    <section className={panelClass}>
      <PanelHeading title={t.reseller.recentCustomers} icon={UserRound} meta={t.billing.accountsLoaded(format.integer(accounts.length))} />
      <div className="mt-2 grid gap-2">
        {recentAccounts.length === 0 ? <EmptyState message={t.billing.noCustomerAccounts} /> : null}
        {recentAccounts.map((account) => {
          const customerOrders = paymentOrders.filter((order) => order.customerAccountId === account.id && isCompletedResellerSaleOrder(order));
          const soldBytes = customerOrders.reduce((sum, order) => sum + order.volumeBytes, 0);

          return (
            <div className="grid min-h-[58px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-afro-line bg-white px-3 py-2" key={account.id}>
              <div className="min-w-0">
                <strong className="block truncate text-sm text-afro-ink">{resellerCustomerName(account)}</strong>
                <span className="block truncate text-[12px] text-afro-muted">{account.telegramUsername ?? account.id.slice(0, 8)}</span>
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                <StatusBadge tone={billingStatusTone(account.status)}>{customerAccountStatusLabel(account.status, t)}</StatusBadge>
                <StatusBadge tone="neutral">{format.bytes(soldBytes)}</StatusBadge>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ResellerUsersTable({
  accounts,
  format,
  paymentOrders,
  t,
}: {
  accounts: AdminCustomerAccountSummary[];
  format: DashboardFormatters;
  paymentOrders: AdminPaymentOrderSummary[];
  t: DashboardStrings;
}) {
  return (
    <section className={panelClass}>
      <PanelHeading title={t.reseller.soldUsers} icon={UserRound} meta={t.billing.accountsLoaded(format.integer(accounts.length))} />
      {accounts.length === 0 ? <div className="mt-2"><EmptyState message={t.billing.noCustomerAccounts} /></div> : null}
      {accounts.length > 0 ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse">
            <thead>
              <tr>
                {[t.billing.customer, t.billing.clients, t.billing.usedQuota, t.billing.remaining, t.reseller.soldVolume, t.reseller.orders, t.reseller.lastSale, t.billing.status].map((heading) => (
                  <th className="border-b border-afro-line px-2 py-1.5 text-left text-[13px] font-bold text-afro-muted first:pl-0 last:pr-0" key={heading}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const customerOrders = paymentOrders.filter((order) => order.customerAccountId === account.id && isCompletedResellerSaleOrder(order));
                const soldBytes = customerOrders.reduce((sum, order) => sum + order.volumeBytes, 0);
                const latestSale = customerOrders
                  .map((order) => order.paidAt ?? order.createdAt)
                  .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;

                return (
                  <tr key={account.id}>
                    <TableCell>
                      <strong className="block text-afro-ink">{resellerCustomerName(account)}</strong>
                      <span className="text-[12px] text-afro-muted">{account.telegramUsername ?? account.id.slice(0, 8)}</span>
                    </TableCell>
                    <TableCell>{`${format.integer(account.activeClientCount)} / ${format.integer(account.clientCount)}`}</TableCell>
                    <TableCell>{format.bytes(account.usedBytes)}</TableCell>
                    <TableCell>{account.remainingBytes === null || account.remainingBytes === undefined ? t.billing.unlimited : format.bytes(account.remainingBytes)}</TableCell>
                    <TableCell>{format.bytes(soldBytes)}</TableCell>
                    <TableCell>{format.integer(customerOrders.length)}</TableCell>
                    <TableCell>{latestSale ? format.dateTime(new Date(latestSale)) : '--'}</TableCell>
                    <TableCell>
                      <StatusBadge tone={billingStatusTone(account.status)}>{customerAccountStatusLabel(account.status, t)}</StatusBadge>
                    </TableCell>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function mapCustomerAccountToForm(account: AdminCustomerAccountSummary): CustomerAccountFormState {
  return {
    displayName: account.displayName ?? '',
    notes: account.notes ?? '',
    perClientLimitGb: formatGbInput(account.perClientLimitBytes ?? null),
    quotaLimitGb: formatGbInput(account.quotaLimitBytes ?? null),
    quotaScope: customerQuotaScopeOptions.includes(account.quotaScope as CustomerQuotaScope)
      ? account.quotaScope as CustomerQuotaScope
      : 'account_shared',
    status: customerAccountStatusOptions.includes(account.status as CustomerAccountStatus)
      ? account.status as CustomerAccountStatus
      : 'active',
    telegramUsername: account.telegramUsername ?? '',
  };
}

function BillingPage({
  format,
  session,
  sessionToken,
  t,
}: {
  format: DashboardFormatters;
  session: AdminSessionResponse;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const [settings, setSettings] = useState<AdminBillingSettingsSummary | null>(null);
  const [packages, setPackages] = useState<AdminVolumePackageSummary[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<AdminPaymentMethodSummary[]>([]);
  const [paymentOrders, setPaymentOrders] = useState<AdminPaymentOrderSummary[]>([]);
  const [paymentProviderAdapters, setPaymentProviderAdapters] = useState<AdminPaymentProviderAdapterSummary[]>([]);
  const [accounts, setAccounts] = useState<AdminCustomerAccountSummary[]>([]);
  const [reseller, setReseller] = useState<AdminResellerAccountSummary | null>(null);
  const [resellerLedgerEntries, setResellerLedgerEntries] = useState<AdminResellerWalletLedgerEntry[]>([]);
  const [rewardSettings, setRewardSettings] = useState<AdminRewardedAdSettingsSummary | null>(null);
  const [telegramBotSettings, setTelegramBotSettings] = useState<AdminTelegramBotSettingsSummary | null>(null);
  const [dataState, setDataState] = useState<DataState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [rewardEnabled, setRewardEnabled] = useState(true);
  const [rewardMb, setRewardMb] = useState('100');
  const [dailyLimit, setDailyLimit] = useState('20');
  const [provider, setProvider] = useState('mvp_rewarded_ad');
  const [verificationMode, setVerificationMode] = useState('client_callback_mvp');
  const [rewardMessage, setRewardMessage] = useState<string | null>(null);
  const [isSavingReward, setIsSavingReward] = useState(false);
  const [selectedCustomerAccountId, setSelectedCustomerAccountId] = useState<string | null>(null);
  const [customerForm, setCustomerForm] = useState<CustomerAccountFormState>(() => createEmptyCustomerAccountForm());
  const [customerMessage, setCustomerMessage] = useState<string | null>(null);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [resellerSaleForm, setResellerSaleForm] = useState<ResellerPackageSaleFormState>(() => createEmptyResellerPackageSaleForm());
  const [resellerSaleMessage, setResellerSaleMessage] = useState<string | null>(null);
  const [isSellingResellerPackage, setIsSellingResellerPackage] = useState(false);
  const [currentPanelForm, setCurrentPanelForm] = useState<CurrentPanelImportFormState>(() => createEmptyCurrentPanelImportForm());
  const [currentPanelPreview, setCurrentPanelPreview] = useState<AdminCurrentPanelImportPreviewResponse | null>(null);
  const [currentPanelMessage, setCurrentPanelMessage] = useState<string | null>(null);
  const [clientConfigExportJson, setClientConfigExportJson] = useState<string | null>(null);
  const [isPreviewingCurrentPanel, setIsPreviewingCurrentPanel] = useState(false);
  const [isImportingCurrentPanel, setIsImportingCurrentPanel] = useState(false);
  const [isSyncingCurrentPanelUsage, setIsSyncingCurrentPanelUsage] = useState(false);
  const [isExportingClientConfigs, setIsExportingClientConfigs] = useState(false);
  const [isChargingCurrentPanelVolume, setIsChargingCurrentPanelVolume] = useState(false);
  const isResellerSession = session.actor.role === 'reseller';
  const canManageBilling = session.actor.role === 'superadmin' || session.actor.role === 'owner' || session.actor.role === 'admin';
  const canManageCustomerAccounts = canManageBilling || isResellerSession;
  const canViewTelegramOperations = session.actor.role === 'superadmin' || session.actor.isSuperAdmin === true;

  const loadBilling = useMemo(() => async (signal?: AbortSignal) => {
    setDataState('loading');
    setError(null);

    try {
      if (isResellerSession) {
        const response = await fetchAdminResellerWorkspace(sessionToken, signal);
        setSettings(response.workspace.settings);
        setPackages(response.workspace.packages);
        setPaymentMethods([]);
        setPaymentProviderAdapters([]);
        setPaymentOrders(response.workspace.paymentOrders);
        setAccounts(response.workspace.accounts);
        setRewardSettings(null);
        setTelegramBotSettings(null);
        setReseller(response.workspace.reseller);
        setResellerLedgerEntries(response.workspace.ledgerEntries);
        setDataState('live');
        return;
      }

      const telegramBotRequest = canViewTelegramOperations
        ? fetchAdminTelegramBotSettings(sessionToken, signal).catch(() => null)
        : Promise.resolve(null);
      const [catalogResponse, orderResponse, accountResponse, rewardResponse, telegramBotResponse] = await Promise.all([
        fetchAdminBillingCatalog(sessionToken, signal),
        fetchAdminPaymentOrders(sessionToken, signal),
        fetchAdminCustomerAccounts(sessionToken, signal),
        fetchAdminRewardedAdSettings(sessionToken, signal),
        telegramBotRequest,
      ]);

      setSettings(catalogResponse.settings);
      setPackages(catalogResponse.packages);
      setPaymentMethods(catalogResponse.paymentMethods);
      setPaymentProviderAdapters(catalogResponse.paymentProviderAdapters ?? []);
      setPaymentOrders(orderResponse.paymentOrders);
      setAccounts(accountResponse.accounts);
      setRewardSettings(rewardResponse.rewardedAds);
      setTelegramBotSettings(telegramBotResponse?.telegramBot ?? null);
      setReseller(null);
      setResellerLedgerEntries([]);
      setDataState('live');
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;

      setError(t.billing.errors.load);
      setDataState((current) => (current === 'live' || current === 'stale' ? 'stale' : 'fallback'));
    }
  }, [canViewTelegramOperations, isResellerSession, sessionToken, t]);

  useEffect(() => {
    const controller = new AbortController();
    void loadBilling(controller.signal);

    return () => controller.abort();
  }, [loadBilling]);

  useEffect(() => {
    if (!rewardSettings) return;

    setRewardEnabled(rewardSettings.enabled);
    setRewardMb(String(Math.round(rewardSettings.rewardMb * 10) / 10));
    setDailyLimit(String(rewardSettings.dailyLimit));
    setProvider(rewardSettings.provider);
    setVerificationMode(rewardSettings.verificationMode);
  }, [rewardSettings]);

  useEffect(() => {
    if (!isResellerSession || resellerSaleForm.volumePackageId || packages.length === 0) return;
    setResellerSaleForm((current) => ({
      ...current,
      volumePackageId: packages.find((item) => item.status === 'active')?.id ?? packages[0].id,
    }));
  }, [isResellerSession, packages, resellerSaleForm.volumePackageId]);

  useEffect(() => {
    if (!selectedCustomerAccountId) return;

    const selectedAccount = accounts.find((account) => account.id === selectedCustomerAccountId);
    if (selectedAccount) setCustomerForm(mapCustomerAccountToForm(selectedAccount));
  }, [accounts, selectedCustomerAccountId]);

  const totalUsedBytes = accounts.reduce((sum, account) => sum + account.usedBytes, 0);
  const totalQuotaBytes = sumNullable(accounts.map((account) => account.quotaLimitBytes ?? null));
  const pendingAllocationCount = paymentOrders.filter((order) => order.status === 'paid' && order.allocationStatus === 'pending').length;
  const activePackageCount = packages.filter((item) => item.status === 'active').length;
  const activeMethodCount = paymentMethods.filter((item) => item.status === 'active').length;
  const resellerStats = useMemo(
    () => createResellerSalesStats(accounts, paymentOrders, reseller),
    [accounts, paymentOrders, reseller],
  );
  const summaryCards: MetricCardData[] = isResellerSession && reseller ? [
    {
      label: t.billing.resellerWalletBalance,
      value: formatMoneyAmount(reseller.balanceAmount, reseller.currency, format),
      tone: reseller.balanceAmount >= 0 ? 'good' : 'warning',
    },
    {
      label: t.billing.resellerAvailableBalance,
      value: formatMoneyAmount(reseller.availableBalanceAmount, reseller.currency, format),
      tone: reseller.availableBalanceAmount > 0 ? 'good' : 'warning',
    },
    {
      label: t.billing.customerAccounts,
      value: format.integer(accounts.length),
      tone: accounts.length > 0 ? 'good' : 'neutral',
    },
    {
      label: t.billing.usedQuota,
      value: format.bytes(totalUsedBytes),
      tone: 'neutral',
    },
  ] : [
    {
      label: t.billing.customerAccounts,
      value: format.integer(accounts.length),
      tone: accounts.length > 0 ? 'good' : 'neutral',
    },
    {
      label: t.billing.usedQuota,
      value: format.bytes(totalUsedBytes),
      tone: 'neutral',
    },
    {
      label: t.billing.totalQuota,
      value: totalQuotaBytes === null ? t.billing.unlimited : format.bytes(totalQuotaBytes),
      tone: totalQuotaBytes === null ? 'warning' : 'good',
    },
    {
      label: t.billing.pendingAllocations,
      value: format.integer(pendingAllocationCount),
      tone: pendingAllocationCount > 0 ? 'warning' : 'good',
    },
  ];

  const handleSaveRewardSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageBilling) return;

    const rewardMbValue = Number(rewardMb);
    const dailyLimitValue = Number(dailyLimit);
    if (!Number.isFinite(rewardMbValue) || rewardMbValue <= 0 || !Number.isInteger(dailyLimitValue) || dailyLimitValue < 0) {
      setRewardMessage(t.billing.rewardSettingsSaveFailed);
      return;
    }

    setIsSavingReward(true);
    setRewardMessage(null);

    try {
      const response = await updateAdminRewardedAdSettings(sessionToken, {
        dailyLimit: dailyLimitValue,
        enabled: rewardEnabled,
        provider,
        rewardBytes: Math.round(rewardMbValue * 1024 ** 2),
        verificationMode,
      });
      setRewardSettings(response.rewardedAds);
      setRewardMessage(t.billing.rewardSettingsSaved);
    } catch {
      setRewardMessage(t.billing.rewardSettingsSaveFailed);
    } finally {
      setIsSavingReward(false);
    }
  };

  const handleStartNewCustomerAccount = () => {
    setSelectedCustomerAccountId(null);
    setCustomerForm(createEmptyCustomerAccountForm());
    setCustomerMessage(null);
  };

  const handleSelectCustomerAccount = (accountId: string) => {
    setSelectedCustomerAccountId(accountId || null);
    setCustomerMessage(null);

    const selectedAccount = accounts.find((account) => account.id === accountId);
    setCustomerForm(selectedAccount ? mapCustomerAccountToForm(selectedAccount) : createEmptyCustomerAccountForm());
  };

  const handleSaveCustomerAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageCustomerAccounts) return;

    const quotaLimitBytes = parseGbLimitInput(customerForm.quotaLimitGb);
    const perClientLimitBytes = parseGbLimitInput(customerForm.perClientLimitGb);
    if (quotaLimitBytes === undefined || perClientLimitBytes === undefined || !customerForm.displayName.trim()) {
      setCustomerMessage(t.billing.customerAccountSaveFailed);
      return;
    }

    setIsSavingCustomer(true);
    setCustomerMessage(null);

    try {
      const payload = {
        displayName: normalizeNullableText(customerForm.displayName),
        notes: normalizeNullableText(customerForm.notes),
        perClientLimitBytes,
        quotaLimitBytes,
        quotaScope: customerForm.quotaScope,
        status: customerForm.status,
        telegramUsername: normalizeNullableText(customerForm.telegramUsername),
      };
      const savedAccount = selectedCustomerAccountId
        ? isResellerSession
          ? await updateAdminResellerCustomerAccount(sessionToken, selectedCustomerAccountId, payload)
          : await updateAdminCustomerAccount(sessionToken, selectedCustomerAccountId, payload)
        : isResellerSession
          ? await createAdminResellerCustomerAccount(sessionToken, payload)
          : await createAdminCustomerAccount(sessionToken, payload);

      setAccounts((current) => [
        savedAccount,
        ...current.filter((account) => account.id !== savedAccount.id),
      ]);
      setSelectedCustomerAccountId(savedAccount.id);
      setCustomerForm(mapCustomerAccountToForm(savedAccount));
      setCustomerMessage(t.billing.customerAccountSaved);
    } catch {
      setCustomerMessage(t.billing.customerAccountSaveFailed);
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handleCreateResellerPackageSale = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isResellerSession || !resellerSaleForm.volumePackageId) return;
    const existingCustomerId = normalizeNullableText(resellerSaleForm.customerAccountId);
    const displayName = normalizeNullableText(resellerSaleForm.displayName);
    const telegramUsername = normalizeNullableText(resellerSaleForm.telegramUsername);
    if (!existingCustomerId && !displayName && !telegramUsername) {
      setResellerSaleMessage(t.billing.resellerPackageSaleFailed);
      return;
    }

    setIsSellingResellerPackage(true);
    setResellerSaleMessage(null);

    try {
      const result = await createAdminResellerPackageSale(sessionToken, {
        customerAccount: existingCustomerId
          ? null
          : {
              displayName,
              notes: normalizeNullableText(resellerSaleForm.notes),
              quotaScope: 'account_shared',
              status: 'active',
              telegramUsername,
            },
        customerAccountId: existingCustomerId,
        idempotencyKey: `dashboard-reseller-sale:${Date.now()}`,
        metadata: {
          dashboardFlow: 'reseller_package_sale',
        },
        notes: normalizeNullableText(resellerSaleForm.notes),
        volumePackageId: resellerSaleForm.volumePackageId,
      });

      setAccounts((current) => [
        result.customerAccount,
        ...current.filter((account) => account.id !== result.customerAccount.id),
      ]);
      setPaymentOrders((current) => [
        result.paymentOrder,
        ...current.filter((order) => order.id !== result.paymentOrder.id),
      ]);
      setReseller(result.reseller);
      setResellerLedgerEntries((current) => [
        result.ledgerEntry,
        ...current.filter((entry) => entry.id !== result.ledgerEntry.id),
      ].slice(0, 50));
      setResellerSaleForm((current) => ({
        ...createEmptyResellerPackageSaleForm(),
        volumePackageId: current.volumePackageId,
      }));
      setResellerSaleMessage(t.billing.resellerPackageSaleSaved(
        format.bytes(result.allocation.volumeBytesDelta),
        formatMoneyAmount(result.quote.walletDebitAmount, result.quote.currency, format),
      ));
    } catch {
      setResellerSaleMessage(t.billing.resellerPackageSaleFailed);
    } finally {
      setIsSellingResellerPackage(false);
    }
  };

  const handlePreviewCurrentPanelImport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageBilling) return;

    let payload: unknown;
    try {
      payload = JSON.parse(currentPanelForm.payloadJson);
    } catch {
      setCurrentPanelPreview(null);
      setCurrentPanelMessage(t.billing.currentPanelPayloadInvalid);
      return;
    }

    setIsPreviewingCurrentPanel(true);
    setCurrentPanelMessage(null);

    try {
      const preview = await previewAdminCurrentPanelImport(sessionToken, {
        defaultProtocol: currentPanelForm.defaultProtocol,
        panelKind: currentPanelForm.panelKind,
        payload,
        sourceName: normalizeNullableText(currentPanelForm.sourceName),
      });

      setCurrentPanelPreview(preview);
      setCurrentPanelMessage(t.billing.currentPanelPreviewReady(format.integer(preview.candidateCount)));
    } catch {
      setCurrentPanelPreview(null);
      setCurrentPanelMessage(t.billing.currentPanelPreviewFailed);
    } finally {
      setIsPreviewingCurrentPanel(false);
    }
  };

  const handleImportCurrentPanelConfigs = async () => {
    if (!canManageBilling) return;

    let payload: unknown;
    try {
      payload = JSON.parse(currentPanelForm.payloadJson);
    } catch {
      setCurrentPanelMessage(t.billing.currentPanelPayloadInvalid);
      return;
    }

    if (!currentPanelForm.customerAccountId) {
      setCurrentPanelMessage(t.billing.currentPanelSelectCustomer);
      return;
    }

    setIsImportingCurrentPanel(true);
    setCurrentPanelMessage(null);

    try {
      const result = await importAdminCurrentPanelConfigs(sessionToken, {
        customerAccountId: currentPanelForm.customerAccountId,
        defaultProtocol: currentPanelForm.defaultProtocol,
        panelKind: currentPanelForm.panelKind,
        payload,
        sourceName: normalizeNullableText(currentPanelForm.sourceName),
      });

      setAccounts((current) => updateImportedCurrentPanelAccount(current, result));
      setCurrentPanelMessage(t.billing.currentPanelImportSucceeded(format.integer(result.importedCount), format.integer(result.skippedCount)));
    } catch {
      setCurrentPanelMessage(t.billing.currentPanelImportFailed);
    } finally {
      setIsImportingCurrentPanel(false);
    }
  };

  const handleSyncCurrentPanelUsage = async () => {
    if (!canManageBilling) return;

    let payload: unknown;
    try {
      payload = JSON.parse(currentPanelForm.payloadJson);
    } catch {
      setCurrentPanelMessage(t.billing.currentPanelPayloadInvalid);
      return;
    }

    if (!currentPanelForm.customerAccountId) {
      setCurrentPanelMessage(t.billing.currentPanelSelectCustomer);
      return;
    }

    setIsSyncingCurrentPanelUsage(true);
    setCurrentPanelMessage(null);

    try {
      const result = await syncAdminCurrentPanelUsage(sessionToken, {
        customerAccountId: currentPanelForm.customerAccountId,
        defaultProtocol: currentPanelForm.defaultProtocol,
        panelKind: currentPanelForm.panelKind,
        payload,
        sourceName: normalizeNullableText(currentPanelForm.sourceName),
      });

      setAccounts((current) => updateSyncedCurrentPanelUsageAccount(current, result));
      setCurrentPanelMessage(t.billing.currentPanelUsageSyncSucceeded(format.integer(result.syncedCount), format.integer(result.skippedCount)));
    } catch {
      setCurrentPanelMessage(t.billing.currentPanelUsageSyncFailed);
    } finally {
      setIsSyncingCurrentPanelUsage(false);
    }
  };

  const handleExportClientConfigs = async () => {
    if (!canManageBilling) return;

    if (!currentPanelForm.customerAccountId) {
      setCurrentPanelMessage(t.billing.currentPanelSelectCustomer);
      return;
    }

    setIsExportingClientConfigs(true);
    setCurrentPanelMessage(null);

    try {
      const result = await exportAdminCustomerClientConfigs(sessionToken, currentPanelForm.customerAccountId);
      setClientConfigExportJson(formatClientConfigExportJson(result));
      setCurrentPanelMessage(t.billing.currentPanelExportSucceeded(format.integer(result.configCount)));
    } catch {
      setCurrentPanelMessage(t.billing.currentPanelExportFailed);
    } finally {
      setIsExportingClientConfigs(false);
    }
  };

  const handleChargeCurrentPanelVolume = async () => {
    if (!canManageBilling) return;

    if (!currentPanelForm.customerAccountId) {
      setCurrentPanelMessage(t.billing.currentPanelSelectCustomer);
      return;
    }

    const volumeBytesDelta = parseGbLimitInput(currentPanelForm.chargeGb);
    if (volumeBytesDelta === undefined || volumeBytesDelta === null || volumeBytesDelta <= 0) {
      setCurrentPanelMessage(t.billing.currentPanelChargeFailed);
      return;
    }

    setIsChargingCurrentPanelVolume(true);
    setCurrentPanelMessage(null);

    try {
      const result = await chargeAdminCurrentPanelVolume(sessionToken, {
        customerAccountId: currentPanelForm.customerAccountId,
        idempotencyKey: `dashboard:${currentPanelForm.customerAccountId}:${Date.now()}`,
        metadata: {
          dashboardFlow: 'current_panel_charge_volume',
        },
        scope: 'account_quota',
        volumeBytesDelta,
      });
      setAccounts((current) => updateCurrentPanelVolumeChargeAccount(current, result));
      setCurrentPanelMessage(t.billing.currentPanelChargeSucceeded(format.bytes(result.chargeEvent.volumeBytesDelta)));
    } catch {
      setCurrentPanelMessage(t.billing.currentPanelChargeFailed);
    } finally {
      setIsChargingCurrentPanelVolume(false);
    }
  };

  return (
    <section className="mt-0 grid gap-3">
      {error ? <PanelState detail={error} kind="error" title={t.panelStates.errorTitle} /> : null}
      {dataState === 'loading' ? <PanelState detail={t.panelStates.loadingDetail} kind="loading" title={t.panelStates.loadingTitle} /> : null}
      {dataState !== 'live' && dataState !== 'loading' ? <DataStateNotice state={dataState} t={t} /> : null}

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label={t.billing.summary}>
        {summaryCards.map((item) => <MetricCard item={item} key={item.label} />)}
      </section>

      {isResellerSession ? (
        <ResellerWorkspacePanel
          format={format}
          ledgerEntries={resellerLedgerEntries}
          reseller={reseller}
          t={t}
        />
      ) : null}

      {isResellerSession ? (
        <ResellerSalesSummaryPanel
          format={format}
          reseller={reseller}
          stats={resellerStats}
          t={t}
        />
      ) : null}

      {isResellerSession ? (
        <ResellerPackageSalePanel
          accounts={accounts}
          format={format}
          form={resellerSaleForm}
          isSelling={isSellingResellerPackage}
          message={resellerSaleMessage}
          onFormChange={setResellerSaleForm}
          onSubmit={handleCreateResellerPackageSale}
          packages={packages}
          t={t}
        />
      ) : null}

      <section className="grid gap-3 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)]">
        {!isResellerSession ? (
        <section className={panelClass}>
          <PanelHeading
            title={t.billing.rewardSettings}
            icon={Gift}
            meta={rewardSettings ? `${format.bytes(rewardSettings.rewardBytes)} / ${format.integer(rewardSettings.dailyLimit)}` : t.dataStatus.loading}
          />
          <form className="mt-2 grid gap-2" onSubmit={handleSaveRewardSettings}>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={rewardEnabled ? 'good' : 'neutral'}>
                {rewardEnabled ? t.billing.enabled : t.billing.disabled}
              </StatusBadge>
              <label className="inline-flex min-h-9 items-center gap-2 rounded-md border border-afro-line bg-white px-3 text-[13px] font-bold text-afro-ink">
                <input
                  checked={rewardEnabled}
                  disabled={!canManageBilling}
                  onChange={(event) => setRewardEnabled(event.target.checked)}
                  type="checkbox"
                />
                {t.billing.rewardsEnabled}
              </label>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <SettingsInput inputMode="numeric" label={t.billing.rewardMb} onChange={setRewardMb} value={rewardMb} />
              <SettingsInput inputMode="numeric" label={t.billing.dailyLimit} onChange={setDailyLimit} value={dailyLimit} />
              <SettingsInput label={t.billing.provider} onChange={setProvider} value={provider} />
              <SettingsInput label={t.billing.verificationMode} onChange={setVerificationMode} value={verificationMode} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className={primaryButtonClass}
                disabled={!canManageBilling || isSavingReward}
                type="submit"
              >
                {isSavingReward ? t.billing.saving : t.billing.saveRewardSettings}
              </button>
              {rewardMessage ? <span className={mutedTextClass}>{rewardMessage}</span> : null}
              {!canManageBilling ? <StatusBadge tone="warning">{t.billing.adminOnly}</StatusBadge> : null}
            </div>
          </form>
        </section>
        ) : null}

        <BillingCatalogPanel
          activeMethodCount={activeMethodCount}
          activePackageCount={activePackageCount}
          format={format}
          paymentMethods={paymentMethods}
          paymentProviderAdapters={paymentProviderAdapters}
          packages={packages}
          settings={settings}
          t={t}
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(340px,0.8fr)_minmax(0,1.2fr)]">
        <CustomerAccountEditorPanel
          accounts={accounts}
          canManageBilling={canManageCustomerAccounts}
          customerForm={customerForm}
          customerMessage={customerMessage}
          format={format}
          isSavingCustomer={isSavingCustomer}
          onFormChange={setCustomerForm}
          onSaveCustomerAccount={handleSaveCustomerAccount}
          onSelectCustomerAccount={handleSelectCustomerAccount}
          onStartNewCustomerAccount={handleStartNewCustomerAccount}
          selectedCustomerAccountId={selectedCustomerAccountId}
          t={t}
        />
        <CustomerAccountsPanel accounts={accounts} format={format} t={t} />
      </section>
      {!isResellerSession ? (
        <>
          <CurrentPanelImportPreviewPanel
            accounts={accounts}
            canManageBilling={canManageBilling}
            clientConfigExportJson={clientConfigExportJson}
            currentPanelForm={currentPanelForm}
            currentPanelMessage={currentPanelMessage}
            currentPanelPreview={currentPanelPreview}
            format={format}
            isExportingClientConfigs={isExportingClientConfigs}
            isChargingCurrentPanelVolume={isChargingCurrentPanelVolume}
            isImportingCurrentPanel={isImportingCurrentPanel}
            isPreviewingCurrentPanel={isPreviewingCurrentPanel}
            isSyncingCurrentPanelUsage={isSyncingCurrentPanelUsage}
            onFormChange={setCurrentPanelForm}
            onExportClientConfigs={handleExportClientConfigs}
            onChargeCurrentPanelVolume={handleChargeCurrentPanelVolume}
            onImportCurrentPanelConfigs={handleImportCurrentPanelConfigs}
            onPreviewCurrentPanelImport={handlePreviewCurrentPanelImport}
            onSyncCurrentPanelUsage={handleSyncCurrentPanelUsage}
            t={t}
          />
          <TelegramBotOperationsPanel
            accounts={accounts}
            canViewTelegramOperations={canViewTelegramOperations}
            format={format}
            paymentOrders={paymentOrders}
            telegramBotSettings={telegramBotSettings}
            t={t}
          />
        </>
      ) : null}
      <PaymentOrdersPanel format={format} paymentOrders={paymentOrders} t={t} />
    </section>
  );
}

function ResellerWorkspacePanel({
  format,
  ledgerEntries,
  reseller,
  t,
}: {
  format: DashboardFormatters;
  ledgerEntries: AdminResellerWalletLedgerEntry[];
  reseller: AdminResellerAccountSummary | null;
  t: DashboardStrings;
}) {
  const walletMetrics = reseller ? [
    {
      icon: CreditCard,
      label: t.billing.resellerWalletBalance,
      value: formatMoneyAmount(reseller.balanceAmount, reseller.currency, format),
    },
    {
      icon: ShieldCheck,
      label: t.billing.resellerAvailableBalance,
      value: formatMoneyAmount(reseller.availableBalanceAmount, reseller.currency, format),
    },
    {
      icon: UserRound,
      label: t.billing.sellerMargin,
      value: `${format.integer(reseller.sellerMarginPercent)}%`,
    },
    {
      icon: Inbox,
      label: t.billing.afroGateShare,
      value: `${format.integer(reseller.afroGateSharePercent)}%`,
    },
  ] : [];

  return (
    <section className={panelClass}>
      <PanelHeading
        title={t.billing.resellerWorkspace}
        icon={CreditCard}
        meta={reseller ? reseller.displayName : t.dataStatus.loading}
      />
      {reseller ? (
        <>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {walletMetrics.map((item) => <MetricPill icon={item.icon} key={item.label} label={item.label} value={item.value} />)}
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr>
                  {[t.billing.walletEntry, t.billing.amount, t.billing.balanceAfter, t.billing.source, t.billing.packageName, t.billing.createdAt].map((heading) => (
                    <th className="border-b border-afro-line px-2 py-1.5 text-left text-[13px] font-bold text-afro-muted first:pl-0 last:pr-0" key={heading}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.map((entry) => (
                  <tr key={entry.id}>
                    <TableCell>
                      <StatusBadge tone={entry.amount >= 0 ? 'good' : 'warning'}>{resellerWalletEntryTypeLabel(entry.entryType, t)}</StatusBadge>
                    </TableCell>
                    <TableCell>{formatMoneyAmount(entry.amount, entry.currency, format)}</TableCell>
                    <TableCell>{formatMoneyAmount(entry.balanceAfterAmount, entry.currency, format)}</TableCell>
                    <TableCell>{resellerWalletSourceLabel(entry.source, t)}</TableCell>
                    <TableCell>{entry.volumePackageName ?? '--'}</TableCell>
                    <TableCell>{format.dateTime(new Date(entry.createdAt))}</TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ledgerEntries.length === 0 ? <EmptyState message={t.billing.noWalletLedgerEntries} /> : null}
        </>
      ) : (
        <PanelState detail={t.panelStates.loadingDetail} kind="loading" title={t.panelStates.loadingTitle} />
      )}
    </section>
  );
}

function ResellerPackageSalePanel({
  accounts,
  format,
  form,
  isSelling,
  message,
  onFormChange,
  onSubmit,
  packages,
  submitLabel,
  t,
  title,
}: {
  accounts: AdminCustomerAccountSummary[];
  format: DashboardFormatters;
  form: ResellerPackageSaleFormState;
  isSelling: boolean;
  message: string | null;
  onFormChange: (form: ResellerPackageSaleFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  packages: AdminVolumePackageSummary[];
  submitLabel?: string;
  t: DashboardStrings;
  title?: string;
}) {
  const activePackages = packages.filter((item) => item.status === 'active');
  const selectedPackage = activePackages.find((item) => item.id === form.volumePackageId) ?? null;
  const updateForm = (patch: Partial<ResellerPackageSaleFormState>) => onFormChange({ ...form, ...patch });

  return (
    <section className={panelClass}>
      <PanelHeading
        title={title ?? t.billing.resellerPackageSale}
        icon={CreditCard}
        meta={selectedPackage ? `${format.bytes(selectedPackage.volumeBytes)} / ${formatMoneyAmount(selectedPackage.totalPrice, selectedPackage.currency, format)}` : t.billing.selectPackage}
      />
      <form className="mt-2 grid gap-2" onSubmit={onSubmit}>
        <div className="grid gap-2 md:grid-cols-3">
          <label className="grid gap-1.5">
            <span className={formLabelClass}>{t.billing.packageName}</span>
            <select
              className={inputClass}
              onChange={(event) => updateForm({ volumePackageId: event.target.value })}
              required
              value={form.volumePackageId}
            >
              <option value="">{t.billing.selectPackage}</option>
              {activePackages.map((item) => (
                <option key={item.id} value={item.id}>
                  {`${item.name} / ${formatMoneyAmount(item.totalPrice, item.currency, format)}`}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className={formLabelClass}>{t.billing.saleCustomer}</span>
            <select
              className={inputClass}
              onChange={(event) => updateForm({ customerAccountId: event.target.value })}
              value={form.customerAccountId}
            >
              <option value="">{t.billing.newCustomer}</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.displayName ?? account.telegramUsername ?? account.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className={formLabelClass}>{t.billing.notes}</span>
            <input
              className={inputClass}
              onChange={(event) => updateForm({ notes: event.target.value })}
              value={form.notes}
            />
          </label>
        </div>
        {!form.customerAccountId ? (
          <div className="grid gap-2 md:grid-cols-2">
            <label className="grid gap-1.5">
              <span className={formLabelClass}>{t.billing.displayName}</span>
              <input
                className={inputClass}
                onChange={(event) => updateForm({ displayName: event.target.value })}
                required={!form.telegramUsername.trim()}
                value={form.displayName}
              />
            </label>
            <label className="grid gap-1.5">
              <span className={formLabelClass}>{t.billing.telegramUsername}</span>
              <input
                className={inputClass}
                onChange={(event) => updateForm({ telegramUsername: event.target.value })}
                value={form.telegramUsername}
              />
            </label>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 border-t border-afro-line pt-2">
          <button
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-afro-sidebar px-4 text-sm font-bold text-white hover:bg-[#1f3138] disabled:cursor-not-allowed disabled:opacity-55"
            disabled={isSelling || !form.volumePackageId}
            type="submit"
          >
            <CreditCard size={16} />
            {isSelling ? t.billing.saving : submitLabel ?? t.billing.sellPackage}
          </button>
          {message ? <span className={mutedTextClass}>{message}</span> : null}
        </div>
      </form>
    </section>
  );
}

function updateImportedCurrentPanelAccount(
  accounts: AdminCustomerAccountSummary[],
  result: AdminCurrentPanelImportConfigsResponse,
): AdminCustomerAccountSummary[] {
  const activeImportedCount = result.importedConfigs.filter((config) => config.status === 'active').length;

  return accounts.map((account) => {
    if (account.id !== result.customerAccountId) return account;

    const usedBytes = account.usedBytes + result.baselineUsedBytes;
    return {
      ...account,
      activeClientCount: account.activeClientCount + activeImportedCount,
      clientCount: account.clientCount + result.importedCount,
      remainingBytes: account.quotaLimitBytes === null || account.quotaLimitBytes === undefined
        ? null
        : Math.max(account.quotaLimitBytes - usedBytes, 0),
      updatedAt: result.generatedAt,
      usedBytes,
    };
  });
}

function updateSyncedCurrentPanelUsageAccount(
  accounts: AdminCustomerAccountSummary[],
  result: AdminCurrentPanelUsageSyncResponse,
): AdminCustomerAccountSummary[] {
  return accounts.map((account) => {
    if (account.id !== result.customerAccountId) return account;

    const usedBytes = account.usedBytes + result.syncedUsedBytesDelta;
    return {
      ...account,
      remainingBytes: account.quotaLimitBytes === null || account.quotaLimitBytes === undefined
        ? null
        : Math.max(account.quotaLimitBytes - usedBytes, 0),
      updatedAt: result.generatedAt,
      usedBytes,
    };
  });
}

function updateCurrentPanelVolumeChargeAccount(
  accounts: AdminCustomerAccountSummary[],
  result: AdminCurrentPanelVolumeChargeResponse,
): AdminCustomerAccountSummary[] {
  return [
    result.account,
    ...accounts.filter((account) => account.id !== result.account.id),
  ];
}

function formatClientConfigExportJson(result: AdminClientConfigsExportResponse): string {
  return JSON.stringify({
    configCount: result.configCount,
    configs: result.configs,
    customerAccountId: result.customerAccountId,
    exportFormat: result.exportFormat,
    generatedAt: result.generatedAt,
    warnings: result.warnings,
  }, null, 2);
}

function createResellerSalesStats(
  accounts: AdminCustomerAccountSummary[],
  paymentOrders: AdminPaymentOrderSummary[],
  reseller: AdminResellerAccountSummary | null,
): ResellerSalesStats {
  const completedOrders = paymentOrders.filter(isCompletedResellerSaleOrder);
  const totalSalesAmount = completedOrders.reduce((sum, order) => sum + order.amount, 0);
  const soldBytes = completedOrders.reduce((sum, order) => sum + order.volumeBytes, 0);
  const afroGateShareAmount = reseller
    ? Math.round(totalSalesAmount * reseller.afroGateShareBps / 10_000)
    : 0;
  const remainingValues = accounts
    .map((account) => account.remainingBytes ?? null)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const allRemainingKnown = remainingValues.length === accounts.length;
  const lowQuotaCount = accounts.filter((account) => {
    if (account.quotaLimitBytes === null || account.quotaLimitBytes === undefined || account.quotaLimitBytes <= 0) return false;
    const remainingBytes = account.remainingBytes ?? Math.max(account.quotaLimitBytes - account.usedBytes, 0);

    return remainingBytes / account.quotaLimitBytes <= 0.2;
  }).length;

  return {
    activeCustomerCount: accounts.filter((account) => account.status === 'active').length,
    afroGateShareAmount,
    averageSoldGb: completedOrders.length > 0 ? soldBytes / completedOrders.length / 1024 ** 3 : 0,
    currency: reseller?.currency ?? completedOrders[0]?.currency ?? 'IRR',
    lowQuotaCount,
    orderCount: completedOrders.length,
    remainingBytes: allRemainingKnown ? remainingValues.reduce((sum, value) => sum + value, 0) : null,
    sellerMarginAmount: Math.max(totalSalesAmount - afroGateShareAmount, 0),
    soldBytes,
    totalSalesAmount,
    usedBytes: accounts.reduce((sum, account) => sum + account.usedBytes, 0),
  };
}

function isCompletedResellerSaleOrder(order: AdminPaymentOrderSummary): boolean {
  return order.provider === 'reseller_wallet' && order.status === 'paid';
}

function resellerCustomerName(account: AdminCustomerAccountSummary): string {
  return account.displayName || account.telegramUsername || account.telegramId || account.id.slice(0, 8);
}

function createResellerSalesTrendOption(
  paymentOrders: AdminPaymentOrderSummary[],
  format: DashboardFormatters,
  t: DashboardStrings,
): AfroChartOption {
  const buckets = createRecentDayBuckets(7).map((date) => ({
    amount: 0,
    date,
    key: localDateKey(date),
    orderCount: 0,
    volumeGb: 0,
  }));
  const bucketByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  paymentOrders.filter(isCompletedResellerSaleOrder).forEach((order) => {
    const orderDate = new Date(order.paidAt ?? order.createdAt);
    const bucket = bucketByKey.get(localDateKey(orderDate));
    if (!bucket) return;

    bucket.amount += order.amount;
    bucket.orderCount += 1;
    bucket.volumeGb += order.volumeBytes / 1024 ** 3;
  });

  return {
    color: ['#2764a8', '#0f8f83', '#c27a1a'],
    textStyle: {
      fontFamily: format.fontFamily,
    },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value) => format.integer(Number(value)),
    },
    legend: {
      top: 0,
      icon: 'roundRect',
      itemHeight: 8,
      itemWidth: 18,
      textStyle: {
        color: '#60717a',
        fontFamily: format.fontFamily,
      },
    },
    grid: {
      bottom: 26,
      containLabel: true,
      left: 6,
      right: 8,
      top: 34,
    },
    xAxis: {
      type: 'category',
      data: buckets.map((bucket) => format.dateTime(bucket.date)),
      axisLine: {
        lineStyle: { color: '#dce4e8' },
      },
      axisLabel: {
        color: '#60717a',
        hideOverlap: true,
        margin: 8,
      },
    },
    yAxis: [
      {
        type: 'value',
        min: 0,
        splitNumber: 4,
        axisLabel: {
          color: '#60717a',
          formatter: (value: string | number) => format.integer(Number(value)),
          margin: 6,
        },
        splitLine: {
          lineStyle: { color: '#edf2f4' },
        },
      },
      {
        type: 'value',
        min: 0,
        splitNumber: 4,
        axisLabel: {
          color: '#60717a',
          formatter: (value: string | number) => format.integer(Number(value)),
          margin: 6,
        },
        splitLine: {
          show: false,
        },
      },
    ],
    dataZoom: [
      {
        type: 'inside',
        throttle: 50,
      },
    ],
    series: [
      {
        name: t.reseller.soldGbSeries,
        type: 'bar',
        barMaxWidth: 24,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
        },
        data: buckets.map((bucket) => Math.round(bucket.volumeGb * 10) / 10),
      },
      {
        name: t.reseller.ordersSeries,
        type: 'line',
        yAxisIndex: 1,
        showSymbol: false,
        smooth: true,
        lineStyle: {
          width: 3,
        },
        areaStyle: {
          opacity: 0.08,
        },
        data: buckets.map((bucket) => bucket.orderCount),
      },
    ],
  };
}

function createResellerUsageMixOption(
  accounts: AdminCustomerAccountSummary[],
  format: DashboardFormatters,
  t: DashboardStrings,
): AfroChartOption {
  const rows = [...accounts]
    .sort((left, right) => (right.usedBytes + (right.remainingBytes ?? 0)) - (left.usedBytes + (left.remainingBytes ?? 0)))
    .slice(0, 8);

  return {
    color: ['#2764a8', '#8bbf9f'],
    textStyle: {
      fontFamily: format.fontFamily,
    },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value) => format.bytes(Math.round(Number(value) * 1024 ** 3)),
    },
    legend: {
      top: 0,
      icon: 'roundRect',
      itemHeight: 8,
      itemWidth: 18,
      textStyle: {
        color: '#60717a',
        fontFamily: format.fontFamily,
      },
    },
    grid: {
      bottom: 30,
      containLabel: true,
      left: 6,
      right: 8,
      top: 34,
    },
    xAxis: {
      type: 'category',
      data: rows.map((account) => resellerCustomerName(account)),
      axisLine: {
        lineStyle: { color: '#dce4e8' },
      },
      axisLabel: {
        color: '#60717a',
        hideOverlap: true,
        margin: 8,
        overflow: 'truncate',
        width: 86,
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      splitNumber: 4,
      axisLabel: {
        color: '#60717a',
        formatter: (value: string | number) => format.integer(Number(value)),
        margin: 6,
      },
      splitLine: {
        lineStyle: { color: '#edf2f4' },
      },
    },
    dataZoom: [
      {
        type: 'inside',
        throttle: 50,
      },
    ],
    series: [
      {
        name: t.reseller.usedGbSeries,
        type: 'bar',
        stack: 'quota',
        barMaxWidth: 26,
        data: rows.map((account) => Math.round(account.usedBytes / 1024 ** 3 * 10) / 10),
      },
      {
        name: t.reseller.remainingGbSeries,
        type: 'bar',
        stack: 'quota',
        barMaxWidth: 26,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
        },
        data: rows.map((account) => (
          account.remainingBytes === null || account.remainingBytes === undefined
            ? 0
            : Math.round(account.remainingBytes / 1024 ** 3 * 10) / 10
        )),
      },
    ],
  };
}

function createRecentDayBuckets(dayCount: number): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (dayCount - 1 - index));

    return date;
  });
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function CustomerAccountEditorPanel({
  accounts,
  canManageBilling,
  customerForm,
  customerMessage,
  format,
  isSavingCustomer,
  onFormChange,
  onSaveCustomerAccount,
  onSelectCustomerAccount,
  onStartNewCustomerAccount,
  selectedCustomerAccountId,
  t,
}: {
  accounts: AdminCustomerAccountSummary[];
  canManageBilling: boolean;
  customerForm: CustomerAccountFormState;
  customerMessage: string | null;
  format: DashboardFormatters;
  isSavingCustomer: boolean;
  onFormChange: (form: CustomerAccountFormState) => void;
  onSaveCustomerAccount: (event: FormEvent<HTMLFormElement>) => void;
  onSelectCustomerAccount: (accountId: string) => void;
  onStartNewCustomerAccount: () => void;
  selectedCustomerAccountId: string | null;
  t: DashboardStrings;
}) {
  const selectedAccount = accounts.find((account) => account.id === selectedCustomerAccountId) ?? null;
  const updateForm = (patch: Partial<CustomerAccountFormState>) => onFormChange({ ...customerForm, ...patch });

  return (
    <section className={panelClass}>
      <PanelHeading
        title={t.billing.customerLimitManager}
        icon={UserRound}
        meta={selectedAccount ? (selectedAccount.displayName ?? selectedAccount.telegramUsername ?? selectedAccount.id.slice(0, 8)) : t.billing.newCustomer}
      />
      <form className="mt-2 grid gap-2" onSubmit={onSaveCustomerAccount}>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="grid gap-1.5">
            <span className={mutedTextClass}>{t.billing.selectCustomer}</span>
            <select
              className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45"
              disabled={!canManageBilling}
              onChange={(event) => onSelectCustomerAccount(event.target.value)}
              value={selectedCustomerAccountId ?? ''}
            >
              <option value="">{t.billing.newCustomer}</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.displayName ?? account.telegramUsername ?? account.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          <button
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink hover:border-afro-blue hover:text-afro-blue disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!canManageBilling}
            onClick={onStartNewCustomerAccount}
            type="button"
          >
            <Plus size={15} />
            {t.billing.newCustomer}
          </button>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <SettingsInput
            disabled={!canManageBilling}
            label={t.billing.displayName}
            onChange={(displayName) => updateForm({ displayName })}
            required
            value={customerForm.displayName}
          />
          <SettingsInput
            disabled={!canManageBilling}
            label={t.billing.telegramUsername}
            onChange={(telegramUsername) => updateForm({ telegramUsername })}
            value={customerForm.telegramUsername}
          />
          <SettingsInput
            disabled={!canManageBilling}
            inputMode="numeric"
            label={t.billing.accountQuotaGb}
            onChange={(quotaLimitGb) => updateForm({ quotaLimitGb })}
            value={customerForm.quotaLimitGb}
          />
          <SettingsInput
            disabled={!canManageBilling}
            inputMode="numeric"
            label={t.billing.perClientLimitGb}
            onChange={(perClientLimitGb) => updateForm({ perClientLimitGb })}
            value={customerForm.perClientLimitGb}
          />
          <label className="grid gap-1.5">
            <span className={mutedTextClass}>{t.billing.quotaScope}</span>
            <select
              aria-label={t.billing.quotaScope}
              className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45"
              disabled={!canManageBilling}
              onChange={(event) => updateForm({ quotaScope: event.target.value as CustomerQuotaScope })}
              value={customerForm.quotaScope}
            >
              {customerQuotaScopeOptions.map((scope) => (
                <option key={scope} value={scope}>
                  {customerQuotaScopeLabel(scope, t)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className={mutedTextClass}>{t.billing.status}</span>
            <select
              className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45"
              disabled={!canManageBilling}
              onChange={(event) => updateForm({ status: event.target.value as CustomerAccountStatus })}
              value={customerForm.status}
            >
              {customerAccountStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {customerAccountStatusLabel(status, t)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <SettingsInput
          disabled={!canManageBilling}
          label={t.billing.notes}
          onChange={(notes) => updateForm({ notes })}
          value={customerForm.notes}
        />

        <div className="grid gap-2 sm:grid-cols-3">
          <MetricPill
            icon={ShieldCheck}
            label={t.billing.accountLimit}
            value={customerForm.quotaLimitGb.trim() ? format.bytes(parseGbLimitInput(customerForm.quotaLimitGb) ?? null) : t.billing.unlimited}
          />
          <MetricPill
            icon={UserRound}
            label={t.billing.clientLimit}
            value={customerForm.perClientLimitGb.trim() ? format.bytes(parseGbLimitInput(customerForm.perClientLimitGb) ?? null) : t.billing.unlimited}
          />
          <MetricPill
            icon={Inbox}
            label={t.billing.quotaScope}
            value={customerQuotaScopeLabel(customerForm.quotaScope, t)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className={primaryButtonClass}
            disabled={!canManageBilling || isSavingCustomer}
            type="submit"
          >
            {isSavingCustomer
              ? t.billing.saving
              : selectedCustomerAccountId
                ? t.billing.updateCustomerAccount
                : t.billing.createCustomerAccount}
          </button>
          {customerMessage ? <span className={mutedTextClass}>{customerMessage}</span> : null}
          {!canManageBilling ? <StatusBadge tone="warning">{t.billing.adminOnly}</StatusBadge> : null}
        </div>
      </form>
    </section>
  );
}

function CurrentPanelImportPreviewPanel({
  accounts,
  canManageBilling,
  clientConfigExportJson,
  currentPanelForm,
  currentPanelMessage,
  currentPanelPreview,
  format,
  isChargingCurrentPanelVolume,
  isExportingClientConfigs,
  isImportingCurrentPanel,
  isPreviewingCurrentPanel,
  isSyncingCurrentPanelUsage,
  onFormChange,
  onChargeCurrentPanelVolume,
  onExportClientConfigs,
  onImportCurrentPanelConfigs,
  onPreviewCurrentPanelImport,
  onSyncCurrentPanelUsage,
  t,
}: {
  accounts: AdminCustomerAccountSummary[];
  canManageBilling: boolean;
  clientConfigExportJson: string | null;
  currentPanelForm: CurrentPanelImportFormState;
  currentPanelMessage: string | null;
  currentPanelPreview: AdminCurrentPanelImportPreviewResponse | null;
  format: DashboardFormatters;
  isChargingCurrentPanelVolume: boolean;
  isExportingClientConfigs: boolean;
  isImportingCurrentPanel: boolean;
  isPreviewingCurrentPanel: boolean;
  isSyncingCurrentPanelUsage: boolean;
  onFormChange: (form: CurrentPanelImportFormState) => void;
  onChargeCurrentPanelVolume: () => void;
  onExportClientConfigs: () => void;
  onImportCurrentPanelConfigs: () => void;
  onPreviewCurrentPanelImport: (event: FormEvent<HTMLFormElement>) => void;
  onSyncCurrentPanelUsage: () => void;
  t: DashboardStrings;
}) {
  const updateForm = (patch: Partial<CurrentPanelImportFormState>) => onFormChange({ ...currentPanelForm, ...patch });
  const candidates = currentPanelPreview?.candidates ?? [];
  const isBusy = isPreviewingCurrentPanel || isImportingCurrentPanel || isSyncingCurrentPanelUsage || isExportingClientConfigs || isChargingCurrentPanelVolume;
  const payloadPlaceholder = `{"users":[{"username":"vip_gamer","status":"active","data_limit":"25GB","used_traffic":"6GB","expire":1893456000}]}`;

  return (
    <section className={panelClass}>
      <PanelHeading
        title={t.billing.currentPanelImport}
        icon={Upload}
        meta={currentPanelPreview ? t.billing.currentPanelAdapter(currentPanelPreview.adapterVersion) : t.billing.currentPanelReadOnly}
      />
      <form className="mt-2 grid gap-2" onSubmit={onPreviewCurrentPanelImport}>
        <div className="grid gap-2 md:grid-cols-4">
          <label className="grid gap-1.5">
            <span className={mutedTextClass}>{t.billing.currentPanelKind}</span>
            <select
              aria-label={t.billing.currentPanelKind}
              className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45"
              disabled={!canManageBilling || isBusy}
              onChange={(event) => updateForm({ panelKind: event.target.value as CurrentPanelKind })}
              value={currentPanelForm.panelKind}
            >
              {currentPanelKindOptions.map((kind) => (
                <option key={kind} value={kind}>
                  {currentPanelKindLabel(kind, t)}
                </option>
              ))}
            </select>
          </label>
          <SettingsInput
            disabled={!canManageBilling || isBusy}
            label={t.billing.currentPanelSourceName}
            onChange={(sourceName) => updateForm({ sourceName })}
            value={currentPanelForm.sourceName}
          />
          <SettingsInput
            disabled={!canManageBilling || isBusy}
            label={t.billing.currentPanelDefaultProtocol}
            onChange={(defaultProtocol) => updateForm({ defaultProtocol })}
            value={currentPanelForm.defaultProtocol}
          />
          <div className="grid content-end">
            <button
              className={primaryButtonClass}
              disabled={!canManageBilling || isBusy || !currentPanelForm.payloadJson.trim()}
              type="submit"
            >
              {isPreviewingCurrentPanel ? t.billing.saving : t.billing.currentPanelPreviewImport}
            </button>
          </div>
        </div>
        <label className="grid gap-1.5">
          <span className={mutedTextClass}>{t.billing.currentPanelPayloadJson}</span>
          <textarea
            aria-label={t.billing.currentPanelPayloadJson}
            className="min-h-[150px] w-full rounded-md border border-afro-line bg-white px-3 py-2 font-mono text-[13px] text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45"
            dir="ltr"
            disabled={!canManageBilling || isBusy}
            onChange={(event) => updateForm({ payloadJson: event.target.value })}
            placeholder={payloadPlaceholder}
            value={currentPanelForm.payloadJson}
          />
        </label>
        <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_minmax(140px,180px)_minmax(260px,1fr)]">
          <label className="grid gap-1.5">
            <span className={mutedTextClass}>{t.billing.currentPanelImportToCustomer}</span>
            <select
              aria-label={t.billing.currentPanelImportToCustomer}
              className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45"
              disabled={!canManageBilling || isBusy}
              onChange={(event) => updateForm({ customerAccountId: event.target.value })}
              value={currentPanelForm.customerAccountId}
            >
              <option value="">{t.billing.currentPanelSelectCustomer}</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.displayName ?? account.telegramUsername ?? account.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          <SettingsInput
            disabled={!canManageBilling || isBusy}
            inputMode="numeric"
            label={t.billing.currentPanelChargeGb}
            onChange={(chargeGb) => updateForm({ chargeGb })}
            value={currentPanelForm.chargeGb}
          />
          <div className="grid content-end gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <button
              className={primaryButtonClass}
              disabled={!canManageBilling || isBusy || !currentPanelForm.payloadJson.trim() || !currentPanelForm.customerAccountId}
              onClick={onImportCurrentPanelConfigs}
              type="button"
            >
              {isImportingCurrentPanel ? t.billing.saving : t.billing.currentPanelImportConfigs}
            </button>
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink hover:border-afro-blue hover:text-afro-blue disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!canManageBilling || isBusy || !currentPanelForm.payloadJson.trim() || !currentPanelForm.customerAccountId}
              onClick={onSyncCurrentPanelUsage}
              type="button"
            >
              {isSyncingCurrentPanelUsage ? t.billing.saving : t.billing.currentPanelSyncUsage}
            </button>
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink hover:border-afro-blue hover:text-afro-blue disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!canManageBilling || isBusy || !currentPanelForm.customerAccountId}
              onClick={onExportClientConfigs}
              type="button"
            >
              {isExportingClientConfigs ? t.billing.saving : t.billing.currentPanelExportConfigs}
            </button>
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink hover:border-afro-blue hover:text-afro-blue disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!canManageBilling || isBusy || !currentPanelForm.customerAccountId || !currentPanelForm.chargeGb.trim()}
              onClick={onChargeCurrentPanelVolume}
              type="button"
            >
              {isChargingCurrentPanelVolume ? t.billing.saving : t.billing.currentPanelChargeVolume}
            </button>
          </div>
        </div>
        {clientConfigExportJson ? (
          <label className="grid gap-1.5">
            <span className={mutedTextClass}>{t.billing.currentPanelExportJson}</span>
            <textarea
              aria-label={t.billing.currentPanelExportJson}
              className="min-h-[130px] w-full rounded-md border border-afro-line bg-white px-3 py-2 font-mono text-[13px] text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4"
              dir="ltr"
              readOnly
              value={clientConfigExportJson}
            />
          </label>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {currentPanelMessage ? <span className={mutedTextClass}>{currentPanelMessage}</span> : null}
          {!canManageBilling ? <StatusBadge tone="warning">{t.billing.adminOnly}</StatusBadge> : null}
        </div>
      </form>

      {currentPanelPreview ? (
        <div className="mt-2 grid gap-2">
          <div className="grid gap-2 sm:grid-cols-4">
            <MetricPill icon={UserRound} label={t.billing.currentPanelCandidates} value={format.integer(currentPanelPreview.candidateCount)} />
            <MetricPill icon={ShieldCheck} label={t.billing.active} value={format.integer(currentPanelPreview.activeCount)} />
            <MetricPill icon={WifiOff} label={t.billing.limited} value={format.integer(currentPanelPreview.limitedCount)} />
            <MetricPill
              icon={Inbox}
              label={t.billing.totalQuota}
              value={currentPanelPreview.totalQuotaBytes === null || currentPanelPreview.totalQuotaBytes === undefined ? t.billing.unlimited : format.bytes(currentPanelPreview.totalQuotaBytes)}
            />
          </div>
          {candidates.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse">
                <thead>
                  <tr>
                    {[t.billing.currentPanelCandidate, t.billing.currentPanelKind, t.billing.usedQuota, t.billing.totalQuota, t.billing.remaining, t.billing.status].map((heading) => (
                      <th className="border-b border-afro-line px-2 py-1.5 text-left text-[13px] font-bold text-afro-muted first:pl-0 last:pr-0" key={heading}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {candidates.slice(0, 8).map((candidate) => (
                    <tr key={`${candidate.externalPanel}:${candidate.externalPanelUserId ?? candidate.label}`} className="border-b border-afro-line/70 last:border-0">
                      <TableCell>
                        <strong className="block text-afro-ink">{candidate.label}</strong>
                        <span className="text-[12px] text-afro-muted">{candidate.username ?? candidate.externalPanelUserId ?? candidate.protocol}</span>
                      </TableCell>
                      <TableCell>{currentPanelKindLabel(currentPanelPreview.panelKind as CurrentPanelKind, t)}</TableCell>
                      <TableCell>{candidate.usedBytes === null || candidate.usedBytes === undefined ? '--' : format.bytes(candidate.usedBytes)}</TableCell>
                      <TableCell>{candidate.quotaBytes === null || candidate.quotaBytes === undefined ? t.billing.unlimited : format.bytes(candidate.quotaBytes)}</TableCell>
                      <TableCell>{candidate.remainingBytes === null || candidate.remainingBytes === undefined ? t.billing.unlimited : format.bytes(candidate.remainingBytes)}</TableCell>
                      <TableCell>
                        <StatusBadge tone={currentPanelStatusTone(candidate.status)}>
                          {currentPanelStatusLabel(candidate.status, t)}
                        </StatusBadge>
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState message={t.billing.currentPanelNoPreview} />}
          <div className="flex flex-wrap gap-1.5">
            {currentPanelPreview.rejectedRows.length > 0 ? (
              <StatusBadge tone="warning">{t.billing.currentPanelRejectedRows(format.integer(currentPanelPreview.rejectedRows.length))}</StatusBadge>
            ) : null}
            {currentPanelPreview.warnings.map((warning) => (
              <StatusBadge key={warning} tone="neutral">{format.label(warning)}</StatusBadge>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <EmptyState message={t.billing.currentPanelNoPreview} />
        </div>
      )}
    </section>
  );
}

function BillingCatalogPanel({
  activeMethodCount,
  activePackageCount,
  format,
  paymentMethods,
  paymentProviderAdapters,
  packages,
  settings,
  t,
}: {
  activeMethodCount: number;
  activePackageCount: number;
  format: DashboardFormatters;
  paymentMethods: AdminPaymentMethodSummary[];
  paymentProviderAdapters: AdminPaymentProviderAdapterSummary[];
  packages: AdminVolumePackageSummary[];
  settings: AdminBillingSettingsSummary | null;
  t: DashboardStrings;
}) {
  return (
    <section className={panelClass}>
      <PanelHeading title={t.billing.catalog} icon={CreditCard} meta={t.billing.packagesLoaded(format.integer(packages.length))} />
      <div className="mt-2 grid gap-2">
        <div className="grid gap-2 sm:grid-cols-3">
          <MetricPill
            icon={CreditCard}
            label={t.billing.pricePerGb}
            value={settings ? `${format.integer(settings.pricePerGb)} ${format.label(settings.currency)}` : '--'}
          />
          <MetricPill icon={Inbox} label={t.billing.activePackages} value={format.integer(activePackageCount)} />
          <MetricPill icon={ShieldCheck} label={t.billing.activeMethods} value={format.integer(activeMethodCount)} />
        </div>
        {packages.length === 0 ? <EmptyState message={t.billing.noPackages} /> : null}
        {packages.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse">
              <thead>
                <tr>
                  {[t.billing.packageName, t.billing.volume, t.billing.price, t.billing.duration, t.billing.status].map((heading) => (
                    <th className="border-b border-afro-line px-2 py-1.5 text-left text-[13px] font-bold text-afro-muted first:pl-0 last:pr-0" key={heading}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {packages.slice(0, 8).map((item) => (
                  <tr key={item.id}>
                    <TableCell>
                      <strong className="block text-afro-ink">{item.name}</strong>
                      <span className="text-[12px] text-afro-muted">{item.slug}</span>
                    </TableCell>
                    <TableCell>{format.bytes(item.volumeBytes)}</TableCell>
                    <TableCell>{`${format.integer(item.totalPrice)} ${format.label(item.currency)}`}</TableCell>
                    <TableCell>{item.durationDays ? t.billing.days(format.integer(item.durationDays)) : t.billing.noExpiry}</TableCell>
                    <TableCell>
                      <StatusBadge tone={billingStatusTone(item.status)}>{format.label(item.status)}</StatusBadge>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          {paymentMethods.map((method) => (
            <StatusBadge key={method.id} tone={billingStatusTone(method.status)}>
              {`${format.label(method.provider)} / ${format.label(method.checkoutMode)}`}
            </StatusBadge>
          ))}
        </div>
        {paymentProviderAdapters.length > 0 ? (
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-afro-ink">{t.billing.paymentProviderAdapters}</h3>
              <span className={mutedTextClass}>{t.billing.adaptersLoaded(format.integer(paymentProviderAdapters.length))}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse">
                <thead>
                  <tr>
                    {[t.billing.provider, t.billing.checkoutMode, t.billing.settlement, t.billing.verification, t.billing.status].map((heading) => (
                      <th className="border-b border-afro-line px-2 py-1.5 text-left text-[13px] font-bold text-afro-muted first:pl-0 last:pr-0" key={heading}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paymentProviderAdapters.map((adapter) => (
                    <tr key={adapter.provider}>
                      <TableCell>{paymentProviderLabel(adapter.provider, t)}</TableCell>
                      <TableCell>{paymentCheckoutModeLabel(adapter.checkoutMode, t)}</TableCell>
                      <TableCell>{paymentSettlementLabel(adapter.settlementMode, t)}</TableCell>
                      <TableCell>{paymentVerificationLabel(adapter.supportsWebhookVerification, t)}</TableCell>
                      <TableCell>
                        <StatusBadge tone={paymentAdapterStatusTone(adapter.status)}>
                          {paymentAdapterStatusLabel(adapter.status, t)}
                        </StatusBadge>
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PaymentOrdersPanel({
  format,
  paymentOrders,
  t,
}: {
  format: DashboardFormatters;
  paymentOrders: AdminPaymentOrderSummary[];
  t: DashboardStrings;
}) {
  return (
    <section className={panelClass}>
      <PanelHeading title={t.billing.paymentOrders} icon={CreditCard} meta={t.billing.ordersLoaded(format.integer(paymentOrders.length))} />
      <div className="mt-2 grid gap-2">
        {paymentOrders.length === 0 ? <EmptyState message={t.billing.noPaymentOrders} /> : null}
        {paymentOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr>
                  {[t.billing.customer, t.billing.packageName, t.billing.amount, t.billing.provider, t.billing.status, t.billing.allocation].map((heading) => (
                    <th className="border-b border-afro-line px-2 py-1.5 text-left text-[13px] font-bold text-afro-muted first:pl-0 last:pr-0" key={heading}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paymentOrders.slice(0, 10).map((order) => (
                  <tr key={order.id}>
                    <TableCell>
                      <strong className="block text-afro-ink">{order.customerDisplayName || order.customerTelegramUsername || order.customerAccountId.slice(0, 8)}</strong>
                      <span className="text-[12px] text-afro-muted">{format.time(new Date(order.createdAt), false)}</span>
                    </TableCell>
                    <TableCell>{order.packageName}</TableCell>
                    <TableCell>{`${format.integer(order.amount)} ${format.label(order.currency)}`}</TableCell>
                    <TableCell>{format.label(order.provider)}</TableCell>
                    <TableCell>
                      <StatusBadge tone={billingStatusTone(order.status)}>{format.label(order.status)}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={billingStatusTone(order.allocationStatus ?? 'not_applicable')}>
                        {format.label(order.allocationStatus ?? 'not_applicable')}
                      </StatusBadge>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function TelegramBotOperationsPanel({
  accounts,
  canViewTelegramOperations,
  format,
  paymentOrders,
  telegramBotSettings,
  t,
}: {
  accounts: AdminCustomerAccountSummary[];
  canViewTelegramOperations: boolean;
  format: DashboardFormatters;
  paymentOrders: AdminPaymentOrderSummary[];
  telegramBotSettings: AdminTelegramBotSettingsSummary | null;
  t: DashboardStrings;
}) {
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const linkedAccountCount = accounts.filter((account) => Boolean(account.telegramId)).length;
  const paidOrders = paymentOrders.filter((order) => order.status === 'paid');
  const pendingAllocationCount = paidOrders.filter((order) => order.allocationStatus === 'pending').length;
  const allocatedLinkedOrderCount = paidOrders.filter((order) => {
    const account = accountsById.get(order.customerAccountId);
    return Boolean(account?.telegramId) && order.allocationStatus === 'allocated';
  }).length;
  const deliveryCandidateCount = paidOrders.filter((order) => {
    const account = accountsById.get(order.customerAccountId);
    return Boolean(account?.telegramId) && account?.activeClientCount === 1;
  }).length;
  const botIdentity = telegramBotSettings?.botUsername
    ? `@${telegramBotSettings.botUsername}`
    : telegramBotSettings?.botFirstName ?? (canViewTelegramOperations ? t.billing.pending : t.billing.adminOnly);
  const deliveryReady = Boolean(telegramBotSettings?.hasBotToken);
  const commandsReady = Boolean(telegramBotSettings?.hasBotToken && telegramBotSettings.commandsEnabled && telegramBotSettings.botUsername);
  const alertsReady = Boolean(telegramBotSettings?.hasBotToken && telegramBotSettings.alertsEnabled && telegramBotSettings.alertChatId);
  const apiTestTone: Tone = telegramBotSettings?.lastTestStatus === 'ok'
    ? 'good'
    : telegramBotSettings?.lastTestStatus === 'failed' || telegramBotSettings?.lastTestStatus === 'missingToken'
      ? 'warning'
      : 'neutral';
  const readinessRows: Array<{ label: string; value: string; tone: Tone }> = [
    {
      label: t.settings.telegramBotToken,
      value: telegramBotSettings?.hasBotToken ? t.billing.stored : t.billing.missing,
      tone: telegramBotSettings?.hasBotToken ? 'good' : 'warning',
    },
    {
      label: t.settings.telegramWebhookSecret,
      value: telegramBotSettings?.hasWebhookSecret ? t.billing.ready : t.billing.pending,
      tone: telegramBotSettings?.hasWebhookSecret ? 'good' : 'neutral',
    },
    {
      label: t.billing.telegramCommands,
      value: commandsReady ? t.billing.ready : t.billing.blocked,
      tone: commandsReady ? 'good' : 'warning',
    },
    {
      label: t.billing.telegramAlerts,
      value: alertsReady ? t.billing.ready : t.billing.pending,
      tone: alertsReady ? 'good' : 'neutral',
    },
    {
      label: t.settings.telegramBotApiTest,
      value: telegramTestStatusLabel(telegramBotSettings?.lastTestStatus ?? 'notTested', t),
      tone: apiTestTone,
    },
    {
      label: t.settings.outboundProxy,
      value: telegramBotSettings?.outboundProxyConfigured ? t.billing.configured : t.billing.direct,
      tone: telegramBotSettings?.outboundProxyConfigured ? 'good' : 'neutral',
    },
  ];
  const operationRows: Array<{ label: string; value: string; tone: Tone }> = [
    {
      label: t.billing.telegramDeliveryGate,
      value: deliveryReady ? t.billing.ready : t.billing.blocked,
      tone: deliveryReady ? 'good' : 'warning',
    },
    {
      label: t.billing.telegramUsageLinkGate,
      value: commandsReady ? t.billing.ready : t.billing.blocked,
      tone: commandsReady ? 'good' : 'warning',
    },
    {
      label: t.billing.telegramLinkedAccounts,
      value: format.integer(linkedAccountCount),
      tone: linkedAccountCount > 0 ? 'good' : 'neutral',
    },
    {
      label: t.billing.telegramDeliveryCandidates,
      value: format.integer(deliveryCandidateCount),
      tone: deliveryCandidateCount > 0 ? 'good' : 'neutral',
    },
    {
      label: t.billing.telegramAllocatedLinkedOrders,
      value: format.integer(allocatedLinkedOrderCount),
      tone: allocatedLinkedOrderCount > 0 ? 'good' : 'neutral',
    },
    {
      label: t.billing.telegramPendingAllocationOrders,
      value: format.integer(pendingAllocationCount),
      tone: pendingAllocationCount > 0 ? 'warning' : 'good',
    },
  ];

  return (
    <section className={panelClass}>
      <PanelHeading title={t.billing.telegramOperations} icon={Bot} meta={t.billing.telegramOrdersTracked(format.integer(paymentOrders.length))} />
      <div className="mt-2 grid gap-3 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
        <div className="grid content-start gap-2">
          <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 rounded-md border border-afro-line bg-white px-3 py-2">
            <span className="text-[13px] font-bold text-afro-muted">{t.settings.telegramBotIdentity}</span>
            <strong className="min-w-0 truncate text-sm" dir="ltr" title={botIdentity}>
              {botIdentity}
            </strong>
          </div>
          {readinessRows.map((row) => (
            <div className="flex min-h-9 items-center justify-between gap-2 rounded-md border border-afro-line px-2.5" key={row.label}>
              <span className={`${mutedTextClass} min-w-0 truncate`}>{row.label}</span>
              <StatusBadge tone={row.tone}>{row.value}</StatusBadge>
            </div>
          ))}
        </div>
        <div className="grid content-start gap-2 sm:grid-cols-2">
          {operationRows.map((row) => (
            <div className="flex min-h-12 items-center justify-between gap-2 rounded-md border border-afro-line bg-[#fbfcfc] px-3 py-2" key={row.label}>
              <span className={`${mutedTextClass} min-w-0 truncate`}>{row.label}</span>
              <StatusBadge tone={row.tone}>{row.value}</StatusBadge>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CustomerAccountsPanel({
  accounts,
  format,
  t,
}: {
  accounts: AdminCustomerAccountSummary[];
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  return (
    <section className={panelClass}>
      <PanelHeading title={t.billing.customerAccounts} icon={UserRound} meta={t.billing.accountsLoaded(format.integer(accounts.length))} />
      <div className="mt-2 grid gap-2">
        {accounts.length === 0 ? <EmptyState message={t.billing.noCustomerAccounts} /> : null}
        {accounts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr>
                  {[t.billing.customer, t.billing.clients, t.billing.usedQuota, t.billing.remaining, t.billing.quotaScope, t.billing.status].map((heading) => (
                    <th className="border-b border-afro-line px-2 py-1.5 text-left text-[13px] font-bold text-afro-muted first:pl-0 last:pr-0" key={heading}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accounts.slice(0, 10).map((account) => (
                  <tr key={account.id}>
                    <TableCell>
                      <strong className="block text-afro-ink">
                        {account.displayName || account.telegramUsername || account.telegramId || account.id.slice(0, 8)}
                      </strong>
                      <span className="text-[12px] text-afro-muted">{format.time(new Date(account.updatedAt), false)}</span>
                    </TableCell>
                    <TableCell>{`${format.integer(account.activeClientCount)} / ${format.integer(account.clientCount)}`}</TableCell>
                    <TableCell>{format.bytes(account.usedBytes)}</TableCell>
                    <TableCell>{account.remainingBytes === null || account.remainingBytes === undefined ? t.billing.unlimited : format.bytes(account.remainingBytes)}</TableCell>
                    <TableCell>{format.label(account.quotaScope)}</TableCell>
                    <TableCell>
                      <StatusBadge tone={billingStatusTone(account.status)}>{format.label(account.status)}</StatusBadge>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function billingStatusTone(status: string): Tone {
  if (status === 'active' || status === 'paid' || status === 'allocated') return 'good';
  if (status === 'pending' || status === 'not_applicable' || status === 'archived' || status === 'disabled') return 'neutral';
  if (status === 'refunded' || status === 'suspended') return 'warning';

  return 'critical';
}

function formatMoneyAmount(amount: number, currency: string, format: DashboardFormatters): string {
  return `${format.integer(amount)} ${currency}`;
}

function resellerWalletEntryTypeLabel(value: string, t: DashboardStrings): string {
  switch (value) {
    case 'topup':
      return t.billing.resellerLedgerEntryTypes.topup;
    case 'sale_debit':
      return t.billing.resellerLedgerEntryTypes.saleDebit;
    case 'adjustment':
      return t.billing.resellerLedgerEntryTypes.adjustment;
    case 'refund':
      return t.billing.resellerLedgerEntryTypes.refund;
    default:
      return value;
  }
}

function resellerWalletSourceLabel(value: string, t: DashboardStrings): string {
  switch (value) {
    case 'manual_topup':
      return t.billing.resellerLedgerSources.manualTopup;
    case 'client_sale':
      return t.billing.resellerLedgerSources.clientSale;
    case 'manual_adjustment':
      return t.billing.resellerLedgerSources.manualAdjustment;
    case 'refund':
      return t.billing.resellerLedgerSources.refund;
    default:
      return value;
  }
}

function paymentAdapterStatusTone(status: string): Tone {
  if (status === 'implemented') return 'good';
  if (status === 'manual_settlement' || status === 'verification_adapter_required') return 'warning';

  return 'neutral';
}

function paymentProviderLabel(provider: string, t: DashboardStrings): string {
  if (provider === 'paypal') return t.billing.providerPaypal;
  if (provider === 'card') return t.billing.providerCard;
  if (provider === 'crypto') return t.billing.providerCrypto;
  if (provider === 'bank_transfer') return t.billing.providerBankTransfer;
  if (provider === 'local_gateway') return t.billing.providerLocalGateway;
  if (provider === 'manual') return t.billing.providerManual;

  return provider;
}

function paymentCheckoutModeLabel(mode: string, t: DashboardStrings): string {
  if (mode === 'manual') return t.billing.checkoutManual;
  if (mode === 'hosted_redirect') return t.billing.checkoutHostedRedirect;
  if (mode === 'external_link') return t.billing.checkoutExternalLink;
  if (mode === 'provider_sdk') return t.billing.checkoutProviderSdk;

  return mode;
}

function paymentSettlementLabel(mode: string, t: DashboardStrings): string {
  if (mode === 'auto_capture') return t.billing.settlementAutoCapture;
  if (mode === 'manual_verification') return t.billing.settlementManualVerification;
  if (mode === 'hosted_gateway') return t.billing.settlementHostedGateway;

  return mode;
}

function paymentVerificationLabel(verified: boolean, t: DashboardStrings): string {
  return verified ? t.billing.webhookVerified : t.billing.manualOrProviderVerification;
}

function paymentAdapterStatusLabel(status: string, t: DashboardStrings): string {
  if (status === 'implemented') return t.billing.adapterImplemented;
  if (status === 'manual_settlement') return t.billing.adapterManualSettlement;
  if (status === 'verification_adapter_required') return t.billing.adapterVerificationRequired;

  return status;
}

function customerQuotaScopeLabel(scope: CustomerQuotaScope | string, t: DashboardStrings): string {
  if (scope === 'per_client') return t.billing.perClientQuota;

  return t.billing.accountSharedQuota;
}

function customerAccountStatusLabel(status: CustomerAccountStatus | string, t: DashboardStrings): string {
  if (status === 'suspended') return t.billing.suspended;
  if (status === 'disabled') return t.billing.disabled;

  return t.billing.enabled;
}

function currentPanelKindLabel(kind: CurrentPanelKind | string, t: DashboardStrings): string {
  if (kind === 'marzban') return t.billing.currentPanelMarzban;
  if (kind === 'xui') return t.billing.currentPanelXui;
  if (kind === 'sanayi') return t.billing.currentPanelSanayi;

  return t.billing.currentPanelGeneric;
}

function currentPanelStatusTone(status: string): Tone {
  if (status === 'active') return 'good';
  if (status === 'limited' || status === 'expired') return 'warning';
  if (status === 'disabled') return 'neutral';

  return 'neutral';
}

function currentPanelStatusLabel(status: string, t: DashboardStrings): string {
  if (status === 'active') return t.billing.active;
  if (status === 'limited') return t.billing.limited;
  if (status === 'expired') return t.billing.expired;
  if (status === 'disabled') return t.billing.disabled;

  return t.billing.unknown;
}

function parseGbLimitInput(value: string): number | null | undefined {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const numericValue = Number(trimmedValue);
  if (!Number.isFinite(numericValue) || numericValue < 0) return undefined;

  return Math.round(numericValue * 1024 ** 3);
}

function formatGbInput(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '';

  const gigabytes = value / 1024 ** 3;
  const rounded = Math.round(gigabytes * 100) / 100;

  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function normalizeNullableText(value: string): string | null {
  const trimmedValue = value.trim();

  return trimmedValue ? trimmedValue : null;
}

function createEmptyTenantBrandForm(): TenantBrandSettingsForm {
  return {
    accentColor: '#0E9F8F',
    clientAppTitle: 'AfroGate Client',
    clientSupportMessage: '',
    dashboardTitle: 'AfroGate',
    displayName: 'AfroGate',
    legalName: '',
    logoUrl: '',
    primaryColor: '#176B87',
    publicBrandingEnabled: true,
    supportEmail: '',
    supportTelegram: '',
    supportUrl: '',
    tenantSlug: 'default',
  };
}

function mapTenantBrandingToForm(settings: AdminTenantBrandSettingsSummary): TenantBrandSettingsForm {
  return {
    accentColor: settings.accentColor,
    clientAppTitle: settings.clientAppTitle,
    clientSupportMessage: settings.clientSupportMessage ?? '',
    dashboardTitle: settings.dashboardTitle,
    displayName: settings.displayName,
    legalName: settings.legalName ?? '',
    logoUrl: settings.logoUrl ?? '',
    primaryColor: settings.primaryColor,
    publicBrandingEnabled: settings.publicBrandingEnabled,
    supportEmail: settings.supportEmail ?? '',
    supportTelegram: settings.supportTelegram ?? '',
    supportUrl: settings.supportUrl ?? '',
    tenantSlug: settings.tenantSlug,
  };
}

function RoutesPage({
  dataState,
  failoverRows,
  format,
  outbounds,
  session,
  sessionToken,
  tunnelDataState,
  tunnelSummaries,
  tunnels,
  t,
}: {
  dataState: DataState;
  failoverRows: RouteFailoverRowData[];
  format: DashboardFormatters;
  outbounds: OutboundRowData[];
  session: AdminSessionResponse;
  sessionToken: string;
  tunnelDataState: DataState;
  tunnelSummaries: AdminTunnelSummary[];
  tunnels: TunnelRowData[];
  t: DashboardStrings;
}) {
  const [selectedTunnelKey, setSelectedTunnelKey] = useState<string | null>(() => tunnels[0] ? tunnelRowKey(tunnels[0]) : null);
  const [routeCanaryStatus, setRouteCanaryStatus] = useState<AdminRouteCanaryStatusResponse | null>(null);
  const [routeCanaryState, setRouteCanaryState] = useState<DataState>('loading');
  const [routeHealthHistory, setRouteHealthHistory] = useState<AdminRouteHealthHistoryResponse | null>(null);
  const [routeHealthHistoryState, setRouteHealthHistoryState] = useState<DataState>('loading');

  useEffect(() => {
    if (tunnels.length === 0) {
      setSelectedTunnelKey(null);
      return;
    }

    if (!selectedTunnelKey || !tunnels.some((tunnel) => tunnelRowKey(tunnel) === selectedTunnelKey)) {
      setSelectedTunnelKey(tunnelRowKey(tunnels[0]));
    }
  }, [selectedTunnelKey, tunnels]);

  useEffect(() => {
    const controller = new AbortController();
    setRouteHealthHistoryState('loading');

    fetchRouteHealthHistory(sessionToken, 'main', 168, 24, controller.signal)
      .then((response) => {
        setRouteHealthHistory(response);
        setRouteHealthHistoryState('live');
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setRouteHealthHistory(null);
        setRouteHealthHistoryState('stale');
      });

    return () => controller.abort();
  }, [sessionToken]);

  useEffect(() => {
    const controller = new AbortController();
    setRouteCanaryState('loading');

    fetchRouteCanaryStatus(sessionToken, 'main', 'default', controller.signal)
      .then((response) => {
        setRouteCanaryStatus(response);
        setRouteCanaryState('live');
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setRouteCanaryStatus(null);
        setRouteCanaryState('stale');
      });

    return () => controller.abort();
  }, [sessionToken]);

  const selectedTunnelRow = tunnels.find((tunnel) => tunnelRowKey(tunnel) === selectedTunnelKey) ?? tunnels[0] ?? null;
  const selectedTunnelSummary = selectedTunnelRow?.id
    ? tunnelSummaries.find((tunnel) => tunnel.id === selectedTunnelRow.id) ?? null
    : null;

  return (
    <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <TunnelPanel
        dataState={tunnelDataState}
        emptyMessage={tunnelDataState === 'loading' ? t.dataStatus.loading : t.operationalData.noTunnels}
        format={format}
        onSelectTunnel={setSelectedTunnelKey}
        selectedTunnelKey={selectedTunnelKey}
        t={t}
        tunnels={tunnels}
      />
      <TunnelDetailPanel
        format={format}
        sessionToken={sessionToken}
        tunnel={selectedTunnelSummary}
        tunnelDataState={tunnelDataState}
        tunnelRow={selectedTunnelRow}
        t={t}
      />
      <OutboundsPanel
        dataState={dataState}
        emptyMessage={dataState === 'loading' ? t.dataStatus.loading : t.operationalData.noOutbounds}
        format={format}
        outbounds={outbounds}
        t={t}
      />
      <RoutePolicyPanel format={format} outbounds={outbounds} session={session} sessionToken={sessionToken} t={t} />
      <RouteCanaryPanel
        dataState={routeCanaryState}
        format={format}
        status={routeCanaryStatus}
        t={t}
      />
      <RouteHealthHistoryPanel
        dataState={routeHealthHistoryState}
        format={format}
        history={routeHealthHistory}
        t={t}
      />
      <FailoverPanel
        dataState={dataState}
        emptyMessage={dataState === 'loading' ? t.dataStatus.loading : t.operationalData.noFailoverEvents}
        events={failoverRows}
        format={format}
        t={t}
      />
    </section>
  );
}

function tunnelRowKey(tunnel: TunnelRowData): string {
  return tunnel.id ?? tunnel.name;
}

function TunnelDetailPanel({
  format,
  sessionToken,
  t,
  tunnel,
  tunnelDataState,
  tunnelRow,
}: {
  format: DashboardFormatters;
  sessionToken: string;
  t: DashboardStrings;
  tunnel: AdminTunnelSummary | null;
  tunnelDataState: DataState;
  tunnelRow: TunnelRowData | null;
}) {
  const [tunnelDetail, setTunnelDetail] = useState<AdminTunnelSummary | null>(tunnel);
  const [detailDataState, setDetailDataState] = useState<DataState>(tunnel?.id ? 'loading' : tunnelDataState);

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    setTunnelDetail(tunnel);

    if (!tunnel?.id) {
      setDetailDataState(tunnelRow ? tunnelDataState : 'fallback');
      return () => {
        isActive = false;
        controller.abort();
      };
    }

    setDetailDataState('loading');

    fetchAdminTunnel(sessionToken, tunnel.id, controller.signal)
      .then((detail) => {
        if (!isActive) return;

        setTunnelDetail(detail);
        setDetailDataState('live');
      })
      .catch((error) => {
        if (!isActive || (error instanceof DOMException && error.name === 'AbortError')) return;

        setDetailDataState('stale');
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [sessionToken, tunnel?.id, tunnelDataState, tunnelRow]);

  const activeTunnel = tunnelDetail ?? tunnel;
  const status = activeTunnel?.status ?? tunnelRow?.status ?? 'unknown';
  const type = activeTunnel?.type ?? tunnelRow?.type ?? 'wireguard';
  const routeGroup = activeTunnel?.routeGroup ?? tunnelRow?.routeGroup ?? 'main';
  const serverLabel = activeTunnel?.serverHostname || activeTunnel?.serverExternalId || tunnelRow?.serverLabel || '-';
  const localInterface = activeTunnel?.localInterfaceName || activeTunnel?.interfaceName || tunnelRow?.localInterfaceName || tunnelRow?.interfaceName || '-';
  const operator = activeTunnel?.interfaceOperator || tunnelRow?.operator || '-';
  const remoteEndpoint = activeTunnel?.remoteEndpoint || tunnelRow?.remoteEndpoint || '-';
  const lockable = activeTunnel?.lockable ?? tunnelRow?.lockable ?? false;
  const updatedAt = activeTunnel?.updatedAt ?? tunnelRow?.updatedAt;

  return (
    <section className={panelClass}>
      <PanelHeading
        title={t.panels.tunnelDetail}
        icon={Route}
        meta={detailDataState === 'loading' ? t.dataStatus.loading : tunnelRow ? format.label(tunnelRow.name) : t.tunnelDetail.noTunnel}
      />
      <div className="mt-2 grid gap-2">
        {!tunnelRow ? <DataStateEmpty emptyMessage={t.tunnelDetail.noTunnel} state={tunnelDataState} t={t} /> : null}
        {tunnelRow && detailDataState !== 'live' ? <DataStateNotice state={detailDataState} t={t} /> : null}
        {tunnelRow ? (
          <>
            <DetailRow label={t.tunnelDetail.labels.status}>
              <StatusBadge tone={inventoryStatusTone(status)}>{inventoryStatusLabel(status, t)}</StatusBadge>
            </DetailRow>
            <DetailRow label={t.tunnelDetail.labels.type}>{format.label(String(type))}</DetailRow>
            <DetailRow label={t.tunnelDetail.labels.server}>{format.label(serverLabel)}</DetailRow>
            <DetailRow label={t.tunnelDetail.labels.routeGroup}>{format.label(routeGroup)}</DetailRow>
            <DetailRow label={t.tunnelDetail.labels.localInterface}>{format.label(localInterface)}</DetailRow>
            <DetailRow label={t.tunnelDetail.labels.operator}>{format.label(operator)}</DetailRow>
            <DetailRow label={t.tunnelDetail.labels.remoteEndpoint}>{remoteEndpoint}</DetailRow>
            <DetailRow label={t.tunnelDetail.labels.lockable}>{lockable ? t.tunnelDetail.values.lockable : t.tunnelDetail.values.notLockable}</DetailRow>
            <DetailRow label={t.tunnelDetail.labels.routeQuality}>
              {format.latency(tunnelRow.ping)} / {format.latency(tunnelRow.jitter)} / {format.packetLoss(tunnelRow.loss)}
            </DetailRow>
            <DetailRow label={t.tunnelDetail.labels.healthScore}>
              <span className={getScoreClass(tunnelRow.score)}>{format.integer(tunnelRow.score)}</span>
            </DetailRow>
            <DetailRow label={t.tunnelDetail.labels.updatedAt}>
              {updatedAt ? format.time(new Date(updatedAt), false) : t.serverEdit.values.localSample}
            </DetailRow>
            <DetailRow label={t.tunnelDetail.labels.detailSource}>
              {detailDataState === 'live'
                ? t.tunnelDetail.values.apiDetail
                : detailDataState === 'loading'
                  ? t.dataStatus.loading
                  : activeTunnel
                    ? t.tunnelDetail.values.listDetail
                    : t.tunnelDetail.values.fallbackDetail}
            </DetailRow>
          </>
        ) : null}
      </div>
    </section>
  );
}

function RoutePolicyPanel({
  format,
  outbounds,
  session,
  sessionToken,
  t,
}: {
  format: DashboardFormatters;
  outbounds: OutboundRowData[];
  session: AdminSessionResponse;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const [assignment, setAssignment] = useState<AdminRouteAssignmentSummary | null>(null);
  const [autoRouteEnabled, setAutoRouteEnabled] = useState(true);
  const [routeLocked, setRouteLocked] = useState(false);
  const [currentOutboundId, setCurrentOutboundId] = useState('');
  const [lockedOutboundId, setLockedOutboundId] = useState('');
  const [hysteresisScoreDelta, setHysteresisScoreDelta] = useState('15');
  const [cooldownSeconds, setCooldownSeconds] = useState('180');
  const [policyDataState, setPolicyDataState] = useState<DataState>('loading');
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [policyMessage, setPolicyMessage] = useState<string | null>(null);
  const canManageRoutePolicy = ['superadmin', 'owner', 'admin'].includes(session.actor.role);
  const outboundOptions = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();

    outbounds.forEach((outbound) => {
      byId.set(outbound.id, { id: outbound.id, name: outbound.name });
    });

    if (assignment?.currentOutboundId && !byId.has(assignment.currentOutboundId)) {
      byId.set(assignment.currentOutboundId, {
        id: assignment.currentOutboundId,
        name: assignment.currentOutboundName ?? assignment.currentOutboundId,
      });
    }
    if (assignment?.lockedOutboundId && !byId.has(assignment.lockedOutboundId)) {
      byId.set(assignment.lockedOutboundId, {
        id: assignment.lockedOutboundId,
        name: assignment.lockedOutboundName ?? assignment.lockedOutboundId,
      });
    }

    return [...byId.values()];
  }, [assignment, outbounds]);
  const normalizedHysteresisScoreDelta = clamp(Math.round(Number(hysteresisScoreDelta) || 15), 1, 100);
  const normalizedCooldownSeconds = clamp(Math.round(Number(cooldownSeconds) || 180), 30, 3600);
  const statusTone: Tone = policyDataState === 'fallback' ? 'warning' : routeLocked ? 'warning' : autoRouteEnabled ? 'good' : 'neutral';
  const policies: Array<[string, string, Tone]> = [
    [t.routePolicy.autoRoute, autoRouteEnabled ? t.routePolicy.enabled : t.settings.manual, autoRouteEnabled ? 'good' : 'neutral'],
    [t.routePolicy.routeLock, routeLocked ? t.routePolicy.enabled : t.routePolicy.available, routeLocked ? 'warning' : 'neutral'],
    [t.routePolicy.cooldown, format.durationSeconds(normalizedCooldownSeconds), 'neutral'],
    [t.routePolicy.hysteresis, format.scoreDelta(normalizedHysteresisScoreDelta), 'neutral'],
  ];
  const applyRoutePolicy = (nextAssignment: AdminRouteAssignmentSummary) => {
    setAssignment(nextAssignment);
    setAutoRouteEnabled(nextAssignment.autoRouteEnabled);
    setRouteLocked(nextAssignment.routeLocked);
    setCurrentOutboundId(nextAssignment.currentOutboundId ?? '');
    setLockedOutboundId(nextAssignment.lockedOutboundId ?? nextAssignment.currentOutboundId ?? '');
    setHysteresisScoreDelta(String(nextAssignment.hysteresisScoreDelta));
    setCooldownSeconds(String(nextAssignment.cooldownSeconds));
  };
  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    setPolicyDataState('loading');
    setPolicyMessage(null);

    fetchRouteAssignment(sessionToken, 'main', 'default', controller.signal)
      .then((nextAssignment) => {
        if (!isActive) return;

        applyRoutePolicy(nextAssignment);
        setPolicyDataState('live');
      })
      .catch((error) => {
        if (!isActive || error instanceof DOMException && error.name === 'AbortError') return;

        setPolicyDataState('fallback');
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [sessionToken]);

  const saveRoutePolicy = async () => {
    if (!canManageRoutePolicy) return;

    setIsSavingPolicy(true);
    setPolicyMessage(null);

    try {
      const savedAssignment = await updateAdminRouteAssignment(sessionToken, {
        routeGroup: 'main',
        assignmentKey: 'default',
        assignmentLabel: assignment?.assignmentLabel ?? t.settings.defaultAssignment,
        currentOutboundId: currentOutboundId || null,
        lockedOutboundId: routeLocked ? lockedOutboundId || currentOutboundId || null : null,
        autoRouteEnabled,
        routeLocked,
        hysteresisScoreDelta: normalizedHysteresisScoreDelta,
        cooldownSeconds: normalizedCooldownSeconds,
      });

      applyRoutePolicy(savedAssignment);
      setPolicyDataState('live');
      setPolicyMessage(t.settings.routeSettingsSaved);
    } catch (error) {
      setPolicyMessage(t.settings.saveFailed);
    } finally {
      setIsSavingPolicy(false);
    }
  };

  return (
    <section className={panelClass}>
      <PanelHeading
        title={t.panels.routePolicy}
        icon={Route}
        meta={policyDataState === 'loading' ? t.dataStatus.loading : assignment?.assignmentLabel ?? t.settings.defaultAssignment}
      />
      <div className="mt-2 grid gap-2">
        {policyDataState !== 'live' ? <DataStateNotice state={policyDataState} t={t} /> : null}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-afro-line bg-white px-2.5 py-2">
          <span className={`${mutedTextClass} font-bold`}>{t.settings.routeAssignment}</span>
          <StatusBadge tone={statusTone}>
            {policyDataState === 'loading' ? t.dataStatus.loading : routeLocked ? t.routePolicy.routeLock : autoRouteEnabled ? t.routePolicy.autoRoute : t.settings.manual}
          </StatusBadge>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-afro-line bg-white px-3 py-2">
            <span className="min-w-0 text-[13px] font-bold text-afro-muted">{t.settings.autoRouteToggle}</span>
            <input
              checked={autoRouteEnabled}
              className="size-4 shrink-0 accent-afro-teal disabled:opacity-50"
              disabled={!canManageRoutePolicy || isSavingPolicy}
              onChange={(event) => setAutoRouteEnabled(event.target.checked)}
              type="checkbox"
            />
          </label>
          <label className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-afro-line bg-white px-3 py-2">
            <span className="min-w-0 text-[13px] font-bold text-afro-muted">{t.settings.routeLockToggle}</span>
            <input
              checked={routeLocked}
              className="size-4 shrink-0 accent-afro-teal disabled:opacity-50"
              disabled={!canManageRoutePolicy || isSavingPolicy}
              onChange={(event) => {
                const isLocked = event.target.checked;

                setRouteLocked(isLocked);
                if (isLocked && !lockedOutboundId) {
                  setLockedOutboundId(currentOutboundId || outboundOptions[0]?.id || '');
                }
              }}
              type="checkbox"
            />
          </label>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={fieldLabelClass}>
            {t.settings.currentManagedRoute}
            <select
              className={fieldInputClass}
              disabled={!canManageRoutePolicy || isSavingPolicy}
              onChange={(event) => {
                setCurrentOutboundId(event.target.value);
                if (!lockedOutboundId) setLockedOutboundId(event.target.value);
              }}
              value={currentOutboundId}
            >
              <option value="">{t.settings.noManagedRouteSelected}</option>
              {outboundOptions.map((outbound) => (
                <option key={outbound.id} value={outbound.id}>
                  {format.label(outbound.name)}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldLabelClass}>
            {t.settings.lockedManagedRoute}
            <select
              className={fieldInputClass}
              disabled={!canManageRoutePolicy || isSavingPolicy || !routeLocked}
              onChange={(event) => setLockedOutboundId(event.target.value)}
              value={lockedOutboundId}
            >
              <option value="">{t.settings.noManagedRouteSelected}</option>
              {outboundOptions.map((outbound) => (
                <option key={outbound.id} value={outbound.id}>
                  {format.label(outbound.name)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={fieldLabelClass}>
            {t.settings.hysteresisScoreDelta}
            <input
              className={fieldInputClass}
              disabled={!canManageRoutePolicy || isSavingPolicy}
              inputMode="numeric"
              onChange={(event) => setHysteresisScoreDelta(event.target.value)}
              type="number"
              value={hysteresisScoreDelta}
            />
          </label>
          <label className={fieldLabelClass}>
            {t.settings.cooldownSeconds}
            <input
              className={fieldInputClass}
              disabled={!canManageRoutePolicy || isSavingPolicy}
              inputMode="numeric"
              onChange={(event) => setCooldownSeconds(event.target.value)}
              type="number"
              value={cooldownSeconds}
            />
          </label>
        </div>
        {policies.map(([label, value, tone]) => (
          <div className="flex min-h-9 items-center justify-between gap-2 rounded-md border border-afro-line px-2.5" key={label}>
            <span className={`${mutedTextClass} min-w-0 truncate`}>{label}</span>
            <StatusBadge tone={tone}>{value}</StatusBadge>
          </div>
        ))}
        {outboundOptions.length === 0 ? <EmptyState message={t.routePolicy.noManagedOutbounds} /> : null}
        {policyMessage ? <p className="text-[12px] font-bold text-afro-muted">{policyMessage}</p> : null}
        <button
          className={primaryButtonClass}
          disabled={!canManageRoutePolicy || isSavingPolicy || policyDataState === 'loading'}
          onClick={() => void saveRoutePolicy()}
          type="button"
        >
          {isSavingPolicy ? t.settings.saving : t.settings.saveRouteSettings}
        </button>
      </div>
    </section>
  );
}

function RouteCanaryPanel({
  dataState,
  format,
  status,
  t,
}: {
  dataState: DataState;
  format: DashboardFormatters;
  status: AdminRouteCanaryStatusResponse | null;
  t: DashboardStrings;
}) {
  const meta = status
    ? t.routeCanary.meta(routeSwitchOrchestrationActionLabel(status.recommendedAction, t))
    : t.routeCanary.learning;

  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.routeCanary} icon={ShieldCheck} meta={meta} />
      <div className="mt-2 grid gap-2">
        {status && dataState !== 'live' ? <DataStateNotice state={dataState} t={t} /> : null}
        {!status ? (
          <DataStateEmpty emptyMessage={t.routeCanary.noStatus} state={dataState} t={t} />
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <RouteDecisionMetric label={t.routeCanary.recommendedAction}>
                <StatusBadge tone={routeSwitchOrchestrationStatusTone(status.switchOrchestration.status)}>
                  {routeSwitchOrchestrationActionLabel(status.recommendedAction, t)}
                </StatusBadge>
              </RouteDecisionMetric>
              <RouteDecisionMetric label={t.routeCanary.guard}>
                <StatusBadge tone={status.guardReady ? 'good' : 'neutral'}>
                  {status.guardReady ? t.routeCanary.guardReady : t.routeCanary.guardHold}
                </StatusBadge>
              </RouteDecisionMetric>
              <RouteDecisionMetric label={t.routeCanary.dataPlane}>
                <StatusBadge tone={status.canExecuteDataPlane ? 'good' : 'neutral'}>
                  {status.canExecuteDataPlane ? t.routeCanary.dataPlaneReady : t.routeCanary.dataPlaneOff}
                </StatusBadge>
              </RouteDecisionMetric>
              <RouteDecisionMetric label={t.routeCanary.sessionSafety}>
                <StatusBadge tone={status.switchOrchestration.activeSessionsProtected ? 'good' : status.switchOrchestration.activeSessionsMayMove ? 'critical' : 'neutral'}>
                  {status.switchOrchestration.activeSessionsProtected
                    ? t.routeCanary.sessionsProtected
                    : status.switchOrchestration.activeSessionsMayMove
                      ? t.routeCanary.sessionsMayMove
                      : t.settings.switchOrchestrationNoSessionMove}
                </StatusBadge>
              </RouteDecisionMetric>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <MetricPill icon={Route} label={t.routeCanary.routeGroup} value={status.routeGroup} />
              <MetricPill icon={Gauge} label={t.routeCanary.profile} value={status.selectedScoreProfile ? routeScoreProfileLabel(status.selectedScoreProfile, t) : t.settings.unknownProfile} />
              <MetricPill
                icon={Activity}
                label={t.routeCanary.canary}
                value={status.canaryReady ? t.routeCanary.canaryReady : t.routeCanary.canaryPlanning}
              />
            </div>

            <div className="grid gap-2 xl:grid-cols-2">
              <RouteDecisionCandidateCard candidate={status.currentCandidate ?? null} format={format} label={t.settings.routeDecisionCurrent} t={t} />
              <RouteDecisionCandidateCard candidate={status.recommendedCandidate ?? null} format={format} label={t.settings.routeDecisionRecommended} t={t} />
            </div>

            <RouteDecisionSwitchRolloutCard
              evaluation={status.switchRolloutEvaluation}
              rollout={status.switchRollout}
              format={format}
              t={t}
            />
            <RouteDecisionSwitchOrchestrationCard orchestration={status.switchOrchestration} format={format} t={t} />

            <div className="flex flex-wrap gap-1">
              {status.reasonCodes.slice(0, 10).map((reason) => (
                <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`route-canary-${reason}`}>
                  {routeDecisionReasonLabel(reason, t)}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function RouteHealthHistoryPanel({
  dataState,
  format,
  history,
  t,
}: {
  dataState: DataState;
  format: DashboardFormatters;
  history: AdminRouteHealthHistoryResponse | null;
  t: DashboardStrings;
}) {
  const points = history?.points ?? [];
  const meta = history ? t.routeHealthHistory.points(format.integer(points.length)) : t.routeHealthHistory.learning;

  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.routeHealthHistory} icon={Activity} meta={meta} />
      <div className="mt-2 grid gap-2">
        {points.length > 0 && dataState !== 'live' ? <DataStateNotice state={dataState} t={t} /> : null}
        {points.length === 0 ? (
          <DataStateEmpty emptyMessage={t.routeHealthHistory.noPoints} state={dataState} t={t} />
        ) : null}
        {points.slice(0, 8).map((point) => (
          <div className="grid min-h-[62px] gap-2 rounded-md border border-afro-line p-2 sm:grid-cols-[minmax(0,1fr)_auto]" key={routeHealthHistoryKey(point)}>
            <div className="min-w-0">
              <strong className="block truncate text-[13px]" title={routeHealthPointRoute(point, format, t)}>
                {routeHealthPointRoute(point, format, t)}
              </strong>
              <span className={`${mutedTextClass} block truncate`} title={routeHealthPointMeta(point, format, t)}>
                {routeHealthPointMeta(point, format, t)}
              </span>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:justify-end">
              <MetricPill icon={Gauge} label={t.routeHealthHistory.score} value={format.integer(point.averageScore)} />
              <MetricPill icon={Clock} label={t.routeHealthHistory.samples} value={format.integer(point.sampleCount)} />
              <MetricPill icon={Network} label={t.tables.loss} value={format.packetLoss(point.averagePacketLossPercent ?? null)} />
              <MetricPill icon={Activity} label={t.routeHealthHistory.latency} value={format.latency(point.averageLatencyMs ?? null)} />
              <StatusBadge tone={inventoryStatusTone(point.healthStatus)}>
                {inventoryStatusLabel(point.healthStatus, t)}
              </StatusBadge>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FailoverPanel({
  dataState,
  emptyMessage,
  events,
  format,
  t,
}: {
  dataState: DataState;
  emptyMessage?: string;
  events: RouteFailoverRowData[];
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.failover} icon={ArrowDownUp} meta={t.panels.latestDecisions} />
      <div className="mt-2 grid gap-2">
        {events.length > 0 && dataState !== 'live' ? <DataStateNotice state={dataState} t={t} /> : null}
        {events.length === 0 ? (
          <DataStateEmpty emptyMessage={emptyMessage ?? t.operationalData.noFailoverEvents} state={dataState} t={t} />
        ) : null}
        {events.map((event) => (
          <div className="grid min-h-[42px] grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-afro-line p-2" key={event.id}>
            <div className="min-w-0">
              <strong className="block truncate">{format.label(event.title)}</strong>
              <span className={`${mutedTextClass} block truncate`}>
                {event.detail}
                {event.createdAt ? ` / ${format.time(new Date(event.createdAt), false)}` : ''}
              </span>
            </div>
            <StatusBadge tone={event.tone}>{t.status[event.tone]}</StatusBadge>
          </div>
        ))}
      </div>
    </section>
  );
}

function IncidentTimelinePanel({
  dataState,
  format,
  timeline,
  t,
}: {
  dataState: DataState;
  format: DashboardFormatters;
  timeline: AdminIncidentTimelineResponse | null;
  t: DashboardStrings;
}) {
  const events = timeline?.events ?? [];
  const meta = timeline ? t.incidentTimeline.events(format.integer(events.length)) : t.incidentTimeline.learning;

  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.incidentTimeline} icon={ScrollText} meta={meta} />
      <div className="mt-2 grid gap-2">
        {events.length > 0 && dataState !== 'live' ? <DataStateNotice state={dataState} t={t} /> : null}
        {events.length === 0 ? (
          <DataStateEmpty emptyMessage={t.incidentTimeline.noEvents} state={dataState} t={t} />
        ) : null}
        {events.slice(0, 8).map((event) => (
          <div className="grid min-h-[58px] gap-2 rounded-md border border-afro-line p-2" key={event.id}>
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <strong className="block truncate text-[13px]" title={incidentTimelineEventTitle(event, t)}>
                  {incidentTimelineEventTitle(event, t)}
                </strong>
                <span className={`${mutedTextClass} block truncate`} title={incidentTimelineEventDetail(event, format, t)}>
                  {incidentTimelineEventDetail(event, format, t)}
                </span>
              </div>
              <StatusBadge tone={incidentTimelineSeverityTone(event.severity)}>
                {incidentTimelineKindLabel(event.kind, t)}
              </StatusBadge>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <MetricPill icon={Clock} label={t.incidentTimeline.occurredAt} value={format.time(new Date(event.occurredAt), false)} />
              {event.routeGroup ? (
                <MetricPill icon={Route} label={t.incidentTimeline.routeGroup} value={format.label(event.routeGroup)} />
              ) : null}
              {event.sourceLabel ? (
                <MetricPill icon={Server} label={t.tables.source} value={format.label(event.sourceLabel)} />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AlertsPage({
  alerts,
  dataState,
  format,
  sessionToken,
  t,
}: {
  alerts: AlertRowData[];
  dataState: DataState;
  format: DashboardFormatters;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const [statusFilter, setStatusFilter] = useState<AlertStatusFilter>('open');
  const [severityFilter, setSeverityFilter] = useState<AlertSeverityFilter>('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [resolvedAlerts, setResolvedAlerts] = useState<AlertRowData[]>([]);
  const [resolvedDataState, setResolvedDataState] = useState<DataState>('loading');
  const [incidentTimeline, setIncidentTimeline] = useState<AdminIncidentTimelineResponse | null>(null);
  const [incidentTimelineState, setIncidentTimelineState] = useState<DataState>('loading');

  useEffect(() => {
    const controller = new AbortController();
    setResolvedDataState('loading');

    void fetchAdminAlerts(sessionToken, { limit: 100, status: 'resolved' }, controller.signal)
      .then((response) => {
        setResolvedAlerts(mapAdminAlertsToRows(response.alerts, t));
        setResolvedDataState('live');
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setResolvedDataState('fallback');
      });

    return () => controller.abort();
  }, [sessionToken, t]);

  useEffect(() => {
    const controller = new AbortController();
    setIncidentTimelineState('loading');

    void fetchIncidentTimeline(sessionToken, 24, 100, controller.signal)
      .then((response) => {
        setIncidentTimeline(response);
        setIncidentTimelineState('live');
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setIncidentTimelineState((current) => (current === 'live' ? 'stale' : 'fallback'));
      });

    return () => controller.abort();
  }, [sessionToken]);

  const currentAlerts = statusFilter === 'open' ? alerts : resolvedAlerts;
  const currentDataState = statusFilter === 'open' ? dataState : resolvedDataState;
  const sourceOptions = useMemo(
    () => Array.from(new Set(currentAlerts.map((alert) => alert.source).filter(Boolean))).sort((left, right) => left.localeCompare(right)),
    [currentAlerts],
  );
  const filteredAlerts = useMemo(
    () => currentAlerts.filter((alert) => (
      (severityFilter === 'all' || alert.severity === severityFilter)
        && (sourceFilter === 'all' || alert.source === sourceFilter)
    )),
    [currentAlerts, severityFilter, sourceFilter],
  );
  const activeAlertCount = countActiveAlertRows(filteredAlerts);

  useEffect(() => {
    if (sourceFilter !== 'all' && !sourceOptions.includes(sourceFilter)) {
      setSourceFilter('all');
    }
  }, [sourceFilter, sourceOptions]);

  return (
    <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <section className={panelClass}>
        <PanelHeading
          title={statusFilter === 'open' ? t.panels.openAlerts : t.panels.alertHistory}
          icon={AlertTriangle}
          meta={t.panels.visible(format.integer(activeAlertCount))}
        />
        <div className="mt-2 grid gap-2 rounded-md border border-afro-line bg-[#f9fbfc] p-2 sm:grid-cols-[minmax(180px,0.8fr)_minmax(150px,0.6fr)_minmax(170px,0.8fr)]">
          <div className="grid gap-1">
            <span className={mutedTextClass}>{t.alertFilters.status}</span>
            <div className="inline-grid grid-cols-2 rounded-md border border-afro-line bg-white p-1">
              {(['open', 'resolved'] as AlertStatusFilter[]).map((status) => {
                const isActive = statusFilter === status;
                const activeClass = isActive ? 'bg-afro-sidebar text-white shadow-sm' : 'text-afro-muted hover:text-afro-ink';

                return (
                  <button
                    className={`min-h-8 rounded px-2 text-[12px] font-bold ${activeClass}`}
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    title={status === 'open' ? t.alertFilters.open : t.alertFilters.resolved}
                    type="button"
                  >
                    {status === 'open' ? t.alertFilters.open : t.alertFilters.resolved}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="grid gap-1">
            <span className={mutedTextClass}>{t.alertFilters.severity}</span>
            <select
              aria-label={t.alertFilters.severity}
              className="min-h-10 rounded-md border border-afro-line bg-white px-2 text-[13px] font-bold text-afro-ink outline-none focus:border-afro-teal"
              onChange={(event) => setSeverityFilter(event.target.value as AlertSeverityFilter)}
              value={severityFilter}
            >
              <option value="all">{t.alertFilters.allSeverities}</option>
              {(['critical', 'warning', 'neutral', 'good'] as Tone[]).map((severity) => (
                <option key={severity} value={severity}>{t.status[severity]}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className={mutedTextClass}>{t.alertFilters.source}</span>
            <select
              aria-label={t.alertFilters.source}
              className="min-h-10 rounded-md border border-afro-line bg-white px-2 text-[13px] font-bold text-afro-ink outline-none focus:border-afro-teal"
              onChange={(event) => setSourceFilter(event.target.value)}
              value={sourceFilter}
            >
              <option value="all">{t.alertFilters.allSources}</option>
              {sourceOptions.map((source) => (
                <option key={source} value={source}>{format.label(source)}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-2 grid gap-2">
          {filteredAlerts.length > 0 && currentDataState !== 'live' ? <DataStateNotice state={currentDataState} t={t} /> : null}
          {filteredAlerts.length === 0 ? (
            <DataStateEmpty
              emptyMessage={statusFilter === 'open' ? t.alerts.noOpenAlerts : t.alerts.noResolvedAlerts}
              state={currentDataState}
              t={t}
            />
          ) : null}
          {filteredAlerts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {[t.tables.severity, t.tables.source, t.tables.alert, t.tables.status, t.tables.lastSeen].map((heading) => (
                      <th className="border-b border-afro-line px-2 py-1.5 text-left text-[13px] font-bold text-afro-muted first:pl-0 last:pr-0" key={heading}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredAlerts.map((alert) => {
                    const timestamp = alert.status === 'resolved' && alert.resolvedAt ? alert.resolvedAt : alert.lastSeenAt;

                    return (
                      <tr key={alert.id}>
                        <TableCell>
                          <StatusBadge tone={alert.severity}>{t.status[alert.severity]}</StatusBadge>
                        </TableCell>
                        <TableCell>{format.label(alert.source)}</TableCell>
                        <TableCell>
                          <strong className="block truncate text-afro-ink" title={alert.title}>{alert.title}</strong>
                          {alert.message ? <span className="block max-w-[420px] truncate text-[12px]" title={alert.message}>{alert.message}</span> : null}
                        </TableCell>
                        <TableCell>{format.label(alert.status ?? statusFilter)}</TableCell>
                        <TableCell>{timestamp ? format.time(new Date(timestamp), false) : '-'}</TableCell>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid gap-3">
        <IncidentTimelinePanel dataState={incidentTimelineState} format={format} timeline={incidentTimeline} t={t} />

        <section className={panelClass}>
          <PanelHeading title={t.panels.alertRules} icon={Bell} meta={t.panels.mvpThresholds} />
          <div className="mt-2 grid gap-2">
            {([
              [t.alertRules.storage, format.percentThreshold('<', 10), 'critical'],
              [t.alertRules.healthScore, format.numberThreshold('<', 60), 'warning'],
              [t.alertRules.ping, format.latencyThreshold('>', 150), 'warning'],
              [t.alertRules.packetLoss, format.percentThreshold('>', 1), 'critical'],
            ] as Array<[string, string, Tone]>).map(([label, value, tone]) => (
              <div className="flex min-h-9 items-center justify-between gap-2 rounded-md border border-afro-line px-2.5" key={label}>
                <span className={`${mutedTextClass} min-w-0 truncate`}>{label}</span>
                <StatusBadge tone={tone}>{value}</StatusBadge>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function SettingsPage({
  format,
  managementServers,
  session,
  sessionToken,
  t,
}: {
  format: DashboardFormatters;
  managementServers: ServerRowData[];
  session: AdminSessionResponse;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const [draft, setDraft] = useState<WireGuardSetupDraft>({
    serverName: '',
    interfaceName: 'wg0',
    routeGroup: 'main',
    addressCidr: '',
    listenPort: '51820',
    privateKey: '',
    peerPublicKey: '',
    endpoint: '',
    allowedIps: '0.0.0.0/0, ::/0',
    persistentKeepalive: '25',
    healthTarget: '',
  });
  const [routeMode, setRouteMode] = useState<RouteSelectionMode>('automatic');
  const [loadBalanceStrategy, setLoadBalanceStrategy] = useState<LoadBalanceStrategy>('balanced');
  const [selectedWireGuardId, setSelectedWireGuardId] = useState('wg-primary');
  const [assignmentAutoRouteEnabled, setAssignmentAutoRouteEnabled] = useState(true);
  const [assignmentRouteLocked, setAssignmentRouteLocked] = useState(false);
  const [assignmentCurrentOutboundId, setAssignmentCurrentOutboundId] = useState('');
  const [assignmentLockedOutboundId, setAssignmentLockedOutboundId] = useState('');
  const [assignmentHysteresisScoreDelta, setAssignmentHysteresisScoreDelta] = useState('15');
  const [assignmentCooldownSeconds, setAssignmentCooldownSeconds] = useState('180');
  const [protocolDraft, setProtocolDraft] = useState<ProtocolSetupDraft>({
    name: 'wg-main',
    protocol: 'wireguard',
    profile: 'balanced',
    port: protocolDefaultPorts.wireguard,
    routeGroup: 'main',
    targetServerId: '',
  });
  const [tenantBranding, setTenantBranding] = useState<AdminTenantBrandSettingsSummary | null>(null);
  const [tenantBrandForm, setTenantBrandForm] = useState<TenantBrandSettingsForm>(createEmptyTenantBrandForm);
  const [tenantBrandMessage, setTenantBrandMessage] = useState<string | null>(null);
  const [isTenantBrandSaving, setIsTenantBrandSaving] = useState(false);
  const [telegramBotSettings, setTelegramBotSettings] = useState<AdminTelegramBotSettingsSummary | null>(null);
  const [telegramBotForm, setTelegramBotForm] = useState<TelegramBotSettingsForm>({
    botToken: '',
    webhookSecret: '',
    alertChatId: '',
    allowedAdminChatIds: '',
    alertsEnabled: false,
    commandsEnabled: false,
  });
  const [privateKeyAccepted, setPrivateKeyAccepted] = useState(false);
  const [privateKeySecretRef, setPrivateKeySecretRef] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [protocolMessage, setProtocolMessage] = useState<string | null>(null);
  const [provisionMessage, setProvisionMessage] = useState<string | null>(null);
  const [serverApplyMessage, setServerApplyMessage] = useState<string | null>(null);
  const [routeMessage, setRouteMessage] = useState<string | null>(null);
  const [telegramBotMessage, setTelegramBotMessage] = useState<string | null>(null);
  const [settingsDataState, setSettingsDataState] = useState<DataState>('loading');
  const [persistedProtocolSetups, setPersistedProtocolSetups] = useState<AdminProtocolSetupSummary[]>([]);
  const [protocolApplyEvents, setProtocolApplyEvents] = useState<AdminProtocolServerApplyEventSummary[]>([]);
  const [protocolApplyEventsBySetupId, setProtocolApplyEventsBySetupId] = useState<Record<string, AdminProtocolServerApplyEventSummary>>({});
  const [protocolApplyEventDetail, setProtocolApplyEventDetail] = useState<AdminProtocolServerApplyEventDetail | null>(null);
  const [apiWireGuardCandidates, setApiWireGuardCandidates] = useState<AdminWireGuardCandidate[]>([]);
  const [routeQualityAnalytics, setRouteQualityAnalytics] = useState<AdminRouteQualityAnalyticsResponse | null>(null);
  const [routeDecisionPreview, setRouteDecisionPreview] = useState<AdminRouteDecisionPreviewResponse | null>(null);
  const [routeDecisionEvents, setRouteDecisionEvents] = useState<AdminRouteDecisionEventSummary[]>([]);
  const [routeDecisionEventDetail, setRouteDecisionEventDetail] = useState<AdminRouteDecisionEventDetail | null>(null);
  const [routeDecisionSwitchExecution, setRouteDecisionSwitchExecution] = useState<AdminRouteDecisionSwitchExecutionSummary | null>(null);
  const [isSecretSaving, setIsSecretSaving] = useState(false);
  const [isProtocolSaving, setIsProtocolSaving] = useState(false);
  const [provisioningSetupId, setProvisioningSetupId] = useState<string | null>(null);
  const [serverApplyingSetupId, setServerApplyingSetupId] = useState<string | null>(null);
  const [serverLiveApplyingSetupId, setServerLiveApplyingSetupId] = useState<string | null>(null);
  const [isRouteSaving, setIsRouteSaving] = useState(false);
  const [isTelegramBotSaving, setIsTelegramBotSaving] = useState(false);
  const [isTelegramBotTesting, setIsTelegramBotTesting] = useState(false);
  const [isDecisionRecording, setIsDecisionRecording] = useState(false);
  const [isDecisionApplying, setIsDecisionApplying] = useState(false);
  const [isDecisionEventDetailLoading, setIsDecisionEventDetailLoading] = useState(false);
  const [isProtocolApplyEventDetailLoading, setIsProtocolApplyEventDetailLoading] = useState(false);
  const canCreateProtocols = session.actor.role === 'superadmin' || Boolean(session.actor.isSuperAdmin);
  const canManageTelegramBot = canCreateProtocols;
  const canManageTenantBranding = ['superadmin', 'owner', 'admin'].includes(session.actor.role);
  const sampleWireGuardCandidates = useMemo<WireGuardHealthCandidate[]>(
    () => [
      {
        id: 'wg-primary',
        name: t.settings.primaryGateway,
        endpoint: draft.endpoint.trim() || 'gateway.example.com:51820',
        routeGroup: 'main',
        healthStatus: 'healthy',
        score: 92,
        latencyMs: 48,
        jitterMs: 5,
        packetLossPercent: 0.1,
        loadPercent: 42,
        checkedAt: null,
        source: 'sample',
      },
      {
        id: 'wg-backup',
        name: t.settings.backupGateway,
        endpoint: 'backup.example.com:51820',
        routeGroup: 'main',
        healthStatus: 'healthy',
        score: 84,
        latencyMs: 63,
        jitterMs: 9,
        packetLossPercent: 0.3,
        loadPercent: 31,
        checkedAt: null,
        source: 'sample',
      },
      {
        id: 'wg-control',
        name: t.settings.controlGateway,
        endpoint: 'control.example.com:51820',
        routeGroup: 'main',
        healthStatus: 'degraded',
        score: 71,
        latencyMs: 88,
        jitterMs: 15,
        packetLossPercent: 0.7,
        loadPercent: 58,
        checkedAt: null,
        source: 'sample',
      },
    ],
    [draft.endpoint, t],
  );
  const wireGuardCandidates = useMemo<WireGuardHealthCandidate[]>(
    () => (apiWireGuardCandidates.length > 0 ? apiWireGuardCandidates : sampleWireGuardCandidates),
    [apiWireGuardCandidates, sampleWireGuardCandidates],
  );
  const managedWireGuardCandidates = useMemo(
    () => wireGuardCandidates.filter((candidate) => candidate.source === 'outbound'),
    [wireGuardCandidates],
  );
  const applyRouteAssignment = (assignment: AdminRouteAssignmentSummary) => {
    setAssignmentAutoRouteEnabled(assignment.autoRouteEnabled);
    setAssignmentRouteLocked(assignment.routeLocked);
    setAssignmentCurrentOutboundId(assignment.currentOutboundId ?? '');
    setAssignmentLockedOutboundId(assignment.lockedOutboundId ?? assignment.currentOutboundId ?? '');
    setAssignmentHysteresisScoreDelta(String(assignment.hysteresisScoreDelta));
    setAssignmentCooldownSeconds(String(assignment.cooldownSeconds));
    setRouteMode(assignment.autoRouteEnabled ? 'automatic' : 'manual');
    if (assignment.currentOutboundId) setSelectedWireGuardId(assignment.currentOutboundId);
    setProtocolDraft((current) => ({
      ...current,
      profile:
        assignment.speedProfile === 'balanced' ||
        assignment.speedProfile === 'highSpeed' ||
        assignment.speedProfile === 'highSecurity' ||
        assignment.speedProfile === 'gaming'
          ? assignment.speedProfile
          : current.profile,
    }));
  };
  const applyTenantBranding = (settings: AdminTenantBrandSettingsSummary) => {
    setTenantBranding(settings);
    setTenantBrandForm(mapTenantBrandingToForm(settings));
  };
  const applyTelegramBotSettings = (settings: AdminTelegramBotSettingsSummary) => {
    setTelegramBotSettings(settings);
    setTelegramBotForm((current) => ({
      ...current,
      botToken: '',
      webhookSecret: '',
      alertChatId: settings.alertChatId ?? '',
      allowedAdminChatIds: settings.allowedAdminChatIds.join(', '),
      alertsEnabled: settings.alertsEnabled,
      commandsEnabled: settings.commandsEnabled,
    }));
  };

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    setSettingsDataState('loading');
    setRouteQualityAnalytics(null);
    setRouteDecisionPreview(null);
    setRouteDecisionEvents([]);
    setRouteDecisionEventDetail(null);
    setProtocolApplyEvents([]);
    setProtocolApplyEventDetail(null);
    setProtocolApplyEventsBySetupId({});
    setIsDecisionEventDetailLoading(false);
    setIsProtocolApplyEventDetailLoading(false);
    setServerLiveApplyingSetupId(null);
    setTenantBrandMessage(null);
    setTelegramBotMessage(null);

    fetchAdminSettings(sessionToken, 'main', controller.signal)
      .then((data: AdminSettingsResponse) => {
        if (!isActive) return;

        setPersistedProtocolSetups(data.protocolSetups);
        setApiWireGuardCandidates(data.wireGuardCandidates);
        setSettingsDataState('live');

        if (
          data.routeSettings.loadBalanceStrategy === 'balanced' ||
          data.routeSettings.loadBalanceStrategy === 'stability' ||
          data.routeSettings.loadBalanceStrategy === 'throughput'
        ) {
          setLoadBalanceStrategy(data.routeSettings.loadBalanceStrategy);
        }
        if (data.routeSettings.selectedOutboundId) {
          setSelectedWireGuardId(data.routeSettings.selectedOutboundId);
        }
        setProtocolDraft((current) => ({
          ...current,
          routeGroup: data.routeSettings.routeGroup,
          profile:
            data.routeSettings.protocolProfile === 'balanced' ||
            data.routeSettings.protocolProfile === 'highSpeed' ||
            data.routeSettings.protocolProfile === 'highSecurity' ||
            data.routeSettings.protocolProfile === 'gaming'
              ? data.routeSettings.protocolProfile
              : current.profile,
        }));
      })
      .catch((error) => {
        if (!isActive || error instanceof DOMException && error.name === 'AbortError') return;

        setSettingsDataState('fallback');
      });

    fetchRouteAssignment(sessionToken, 'main', 'default', controller.signal)
      .then((data) => {
        if (!isActive) return;

        applyRouteAssignment(data);
      })
      .catch((error) => {
        if (!isActive || error instanceof DOMException && error.name === 'AbortError') return;
      });

    fetchAdminTenantBranding(sessionToken, controller.signal)
      .then((data) => {
        if (!isActive) return;

        applyTenantBranding(data.branding);
      })
      .catch((error) => {
        if (!isActive || error instanceof DOMException && error.name === 'AbortError') return;

        setTenantBranding(null);
      });

    if (canManageTelegramBot) {
      fetchAdminTelegramBotSettings(sessionToken, controller.signal)
        .then((data) => {
          if (!isActive) return;

          applyTelegramBotSettings(data.telegramBot);
        })
        .catch((error) => {
          if (!isActive || error instanceof DOMException && error.name === 'AbortError') return;

          setTelegramBotSettings(null);
        });
    }

    fetchRouteQualityAnalytics(sessionToken, 'main', 168, controller.signal)
      .then((data) => {
        if (!isActive) return;

        setRouteQualityAnalytics(data);
      })
      .catch((error) => {
        if (!isActive || error instanceof DOMException && error.name === 'AbortError') return;

        setRouteQualityAnalytics(null);
      });

    fetchRouteDecisionPreview(sessionToken, 'main', 'default', controller.signal)
      .then((data) => {
        if (!isActive) return;

        setRouteDecisionPreview(data);
      })
      .catch((error) => {
        if (!isActive || error instanceof DOMException && error.name === 'AbortError') return;

        setRouteDecisionPreview(null);
      });

    fetchRouteDecisionEvents(sessionToken, 'main', 'default', 10, controller.signal)
      .then((data) => {
        if (!isActive) return;

        setRouteDecisionEvents(data.events);
      })
      .catch((error) => {
        if (!isActive || error instanceof DOMException && error.name === 'AbortError') return;

        setRouteDecisionEvents([]);
      });

    fetchProtocolServerApplyEvents(sessionToken, undefined, 'main', 10, controller.signal)
      .then((data) => {
        if (!isActive) return;

        setProtocolApplyEvents(data.events);
        setProtocolApplyEventsBySetupId(latestProtocolApplyEventsBySetupId(data.events));
      })
      .catch((error) => {
        if (!isActive || error instanceof DOMException && error.name === 'AbortError') return;

        setProtocolApplyEvents([]);
        setProtocolApplyEventsBySetupId({});
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [sessionToken]);

  const hasSavedPrivateKey = Boolean(privateKeySecretRef);
  const hasPrivateKey = draft.privateKey.trim().length > 0 || privateKeyAccepted || hasSavedPrivateKey;
  const hasTunnelShape = Boolean(
    draft.interfaceName.trim() &&
      draft.routeGroup.trim() &&
      draft.addressCidr.trim() &&
      draft.listenPort.trim() &&
      draft.peerPublicKey.trim() &&
      draft.endpoint.trim() &&
      draft.allowedIps.trim(),
  );
  const hasHealthTarget = draft.healthTarget.trim().length > 0;
  const bestWireGuard = wireGuardCandidates.reduce((best, candidate) => candidate.score > best.score ? candidate : best, wireGuardCandidates[0]);
  const selectedWireGuard = wireGuardCandidates.find((candidate) => candidate.id === selectedWireGuardId) ?? bestWireGuard;
  const activeWireGuard = routeMode === 'manual' ? selectedWireGuard : bestWireGuard;
  const routeModeDescription = routeMode === 'automatic' ? t.settings.autoModeDescription : t.settings.manualModeDescription;
  const loadBalanceOptions: Array<[LoadBalanceStrategy, string]> = [
    ['balanced', t.settings.balancedStrategy],
    ['stability', t.settings.stabilityStrategy],
    ['throughput', t.settings.throughputStrategy],
  ];
  const protocolOptions: Array<[ProtocolKind, string]> = [
    ['wireguard', t.settings.protocolWireGuard],
    ['vless', t.settings.protocolVless],
    ['l2tp', t.settings.protocolL2tp],
    ['ikev2', t.settings.protocolIkev2],
  ];
  const profileOptions: Array<[ProtocolProfile, string]> = [
    ['balanced', t.settings.profileBalanced],
    ['highSpeed', t.settings.profileHighSpeed],
    ['highSecurity', t.settings.profileHighSecurity],
    ['gaming', t.settings.profileGaming],
  ];
  const protocolTargetServers = managementServers.filter((server) => server.source === 'admin');
  const targetServerOptions = protocolTargetServers.map((server) => ({
    value: server.id,
    label: `${format.label(server.name)} / ${serverAccessReady(server) ? t.settings.accessReady : t.settings.accessPending}`,
  }));
  const selectedTargetServer = protocolTargetServers.find((server) => server.id === protocolDraft.targetServerId) ?? null;
  const selectedTargetServerAccessReady = selectedTargetServer ? serverAccessReady(selectedTargetServer) : false;
  const readinessRows: Array<[string, string, Tone]> = [
    [t.settings.systemUser, 'afrogate', 'good'],
    [t.settings.protocolCreation, canCreateProtocols ? t.settings.superadminReady : t.settings.superadminOnly, canCreateProtocols ? 'good' : 'warning'],
    [t.settings.protocolProfile, profileOptions.find(([value]) => value === protocolDraft.profile)?.[1] ?? t.settings.profileBalanced, 'neutral'],
    [t.settings.targetServer, selectedTargetServer ? selectedTargetServer.name : t.settings.noTargetServer, selectedTargetServer ? 'neutral' : 'warning'],
    [t.settings.serverAccess, selectedTargetServer ? selectedTargetServerAccessReady ? t.settings.accessReady : t.settings.accessPending : t.settings.pending, selectedTargetServerAccessReady ? 'good' : 'warning'],
    [t.settings.routeMode, routeMode === 'automatic' ? t.settings.automatic : t.settings.manual, routeMode === 'automatic' ? 'good' : 'neutral'],
    [t.settings.activeWireGuard, activeWireGuard.name, getWireGuardScoreTone(activeWireGuard.score)],
    [t.settings.privateKeyStatus, hasSavedPrivateKey ? t.settings.encryptedSecretSaved : hasPrivateKey ? t.settings.acceptedWriteOnly : t.settings.pending, hasPrivateKey ? 'good' : 'warning'],
    [t.settings.tunnelConfig, hasTunnelShape ? t.settings.ready : t.settings.incomplete, hasTunnelShape ? 'good' : 'warning'],
    [t.settings.healthTarget, hasHealthTarget ? t.settings.configured : t.settings.pending, hasHealthTarget ? 'good' : 'neutral'],
    [t.settings.settingsStorage, settingsDataState === 'live' ? t.settings.configured : t.settings.pending, settingsDataState === 'live' ? 'good' : 'warning'],
    [t.settings.secretStorage, hasSavedPrivateKey ? t.settings.encryptedStorageReady : t.settings.encryptedStoragePending, hasSavedPrivateKey ? 'good' : 'neutral'],
  ];
  const telegramBotReadinessRows: Array<[string, string, Tone]> = [
    [
      t.settings.telegramBotToken,
      telegramBotSettings?.hasBotToken ? telegramSecretSourceLabel(telegramBotSettings.botTokenSource, t) : t.settings.pending,
      telegramBotSettings?.hasBotToken ? 'good' : 'warning',
    ],
    [
      t.settings.telegramWebhookSecret,
      telegramBotSettings?.hasWebhookSecret ? telegramSecretSourceLabel(telegramBotSettings.webhookSecretSource, t) : t.settings.pending,
      telegramBotSettings?.hasWebhookSecret ? 'good' : 'warning',
    ],
    [
      t.settings.telegramAlertChatId,
      telegramBotSettings?.alertChatId ? t.settings.configured : t.settings.pending,
      telegramBotSettings?.alertChatId ? 'good' : 'neutral',
    ],
    [
      t.settings.telegramAllowedAdminChatIds,
      t.settings.telegramAllowedChatCount(format.integer(telegramBotSettings?.allowedAdminChatIds.length ?? 0)),
      telegramBotSettings?.allowedAdminChatIds.length ? 'good' : 'neutral',
    ],
    [
      t.settings.telegramBotApiTest,
      telegramTestStatusLabel(telegramBotSettings?.lastTestStatus ?? 'notTested', t),
      telegramBotSettings?.lastTestStatus === 'ok' ? 'good' : telegramBotSettings?.lastTestStatus === 'failed' ? 'warning' : 'neutral',
    ],
    [
      t.settings.outboundProxy,
      telegramBotSettings?.outboundProxyConfigured ? t.settings.configured : t.settings.pending,
      telegramBotSettings?.outboundProxyConfigured ? 'good' : 'neutral',
    ],
  ];
  const tenantBrandingRows: Array<[string, string, Tone]> = [
    [
      t.settings.tenantSlug,
      tenantBranding?.tenantSlug ?? tenantBrandForm.tenantSlug,
      tenantBranding ? 'good' : 'neutral',
    ],
    [
      t.settings.publicBranding,
      tenantBrandForm.publicBrandingEnabled ? t.settings.enabled : t.settings.disabled,
      tenantBrandForm.publicBrandingEnabled ? 'good' : 'neutral',
    ],
    [
      t.settings.supportContact,
      tenantBrandForm.supportEmail || tenantBrandForm.supportTelegram || tenantBrandForm.supportUrl
        ? t.settings.configured
        : t.settings.pending,
      tenantBrandForm.supportEmail || tenantBrandForm.supportTelegram || tenantBrandForm.supportUrl ? 'good' : 'neutral',
    ],
    [
      t.settings.updatedAt,
      tenantBranding?.updatedAt ? format.time(new Date(tenantBranding.updatedAt), false) : t.settings.pending,
      tenantBranding ? 'good' : 'neutral',
    ],
  ];
  const previewRows: Array<[string, string]> = [
    [t.settings.protocolName, protocolDraft.name || '-'],
    [t.settings.protocol, protocolOptions.find(([value]) => value === protocolDraft.protocol)?.[1] ?? '-'],
    [t.settings.protocolProfile, profileOptions.find(([value]) => value === protocolDraft.profile)?.[1] ?? '-'],
    [t.settings.protocolPort, protocolDraft.port || '-'],
    [t.settings.targetServer, selectedTargetServer ? selectedTargetServer.name : t.settings.noTargetServer],
    [t.settings.serverName, draft.serverName || '-'],
    [t.settings.interfaceName, draft.interfaceName || '-'],
    [t.settings.routeGroup, draft.routeGroup || '-'],
    [t.settings.routeMode, routeMode === 'automatic' ? t.settings.automatic : t.settings.manual],
    [t.settings.loadBalanceStrategy, loadBalanceOptions.find(([value]) => value === loadBalanceStrategy)?.[1] ?? t.settings.balancedStrategy],
    [t.settings.activeWireGuard, activeWireGuard.name],
    [t.settings.addressCidr, draft.addressCidr || '-'],
    [t.settings.listenPort, draft.listenPort || '-'],
    [t.settings.peerPublicKey, draft.peerPublicKey ? t.settings.publicKeyPresent : '-'],
    [t.settings.endpoint, draft.endpoint || '-'],
    [t.settings.allowedIps, draft.allowedIps || '-'],
    [t.settings.privateKey, hasPrivateKey ? t.settings.writeOnly : '-'],
  ];

  const updateDraft = (field: keyof WireGuardSetupDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    if (field === 'privateKey') {
      setPrivateKeyAccepted(false);
      setPrivateKeySecretRef(null);
    }
  };

  const updateProtocolDraft = <K extends keyof ProtocolSetupDraft>(field: K, value: ProtocolSetupDraft[K]) => {
    setProtocolDraft((current) => ({ ...current, [field]: value }));
    setProtocolMessage(null);
  };
  const updateTenantBrandForm = <K extends keyof TenantBrandSettingsForm>(field: K, value: TenantBrandSettingsForm[K]) => {
    setTenantBrandForm((current) => ({ ...current, [field]: value }));
    setTenantBrandMessage(null);
  };
  const updateTelegramBotForm = <K extends keyof TelegramBotSettingsForm>(field: K, value: TelegramBotSettingsForm[K]) => {
    setTelegramBotForm((current) => ({ ...current, [field]: value }));
    setTelegramBotMessage(null);
  };

  const selectProtocol = (protocol: ProtocolKind) => {
    setProtocolDraft((current) => ({
      ...current,
      protocol,
      port: protocolDefaultPorts[protocol],
      name: current.name || `${protocol}-main`,
    }));
    setProtocolMessage(null);
  };

  const savePrivateKeySecret = async (): Promise<string | null> => {
    const privateKey = draft.privateKey.trim();
    if (!privateKey) return privateKeySecretRef;

    setIsSecretSaving(true);

    try {
      const saved = await createAdminSettingsSecret(sessionToken, {
        name: `${protocolDraft.name.trim() || draft.interfaceName.trim() || 'wireguard'} private key`,
        kind: 'wireguardPrivateKey',
        secret: privateKey,
        routeGroup: protocolDraft.routeGroup.trim() || draft.routeGroup.trim() || 'main',
        protocol: 'wireguard',
      });

      setPrivateKeySecretRef(saved.secretRef);
      setPrivateKeyAccepted(true);
      setDraft((current) => ({ ...current, privateKey: '' }));
      return saved.secretRef;
    } catch (error) {
      setValidationMessage(t.settings.secretSaveFailed);
      return null;
    } finally {
      setIsSecretSaving(false);
    }
  };

  const createProtocolDraft = async () => {
    if (!canCreateProtocols) {
      setProtocolMessage(t.settings.superadminRequired);
      return;
    }

    const port = Number(protocolDraft.port);
    if (!protocolDraft.name.trim() || !Number.isInteger(port) || port < 1 || port > 65535 || !protocolDraft.routeGroup.trim()) {
      setProtocolMessage(t.settings.requiredFields);
      return;
    }

    setIsProtocolSaving(true);
    setProtocolMessage(null);

    try {
      const secretRef = protocolDraft.protocol === 'wireguard' ? await savePrivateKeySecret() : privateKeySecretRef;

      if (protocolDraft.protocol === 'wireguard' && !secretRef) {
        setProtocolMessage(t.settings.privateKeyRequired);
        return;
      }

      const created = await createAdminProtocolSetup(sessionToken, {
        name: protocolDraft.name.trim(),
        protocol: protocolDraft.protocol,
        profile: protocolDraft.profile,
        routeGroup: protocolDraft.routeGroup.trim(),
        port,
        config: createProtocolSetupConfig(draft, routeMode, loadBalanceStrategy, activeWireGuard, selectedTargetServer),
        secretRef,
        targetServerId: protocolDraft.targetServerId || null,
      });

      setPersistedProtocolSetups((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setProtocolMessage(t.settings.protocolDraftSaved);
    } catch (error) {
      setProtocolMessage(t.settings.saveFailed);
    } finally {
      setIsProtocolSaving(false);
    }
  };

  const provisionProtocolDraft = async (setup: AdminProtocolSetupSummary) => {
    if (!canCreateProtocols) {
      setProvisionMessage(t.settings.superadminRequired);
      return;
    }

    setProvisioningSetupId(setup.id);
    setProvisionMessage(null);

    try {
      const provisioned = await provisionAdminProtocolSetup(sessionToken, setup.id);
      setPersistedProtocolSetups((current) =>
        current.map((item) => (item.id === provisioned.protocolSetup.id ? provisioned.protocolSetup : item)),
      );

      const wireGuardCandidate = outboundToWireGuardCandidate(provisioned.outbound);
      if (wireGuardCandidate) {
        setApiWireGuardCandidates((current) => [
          wireGuardCandidate,
          ...current.filter((candidate) => candidate.id !== wireGuardCandidate.id),
        ]);
      }

      setProvisionMessage(t.settings.protocolProvisioned);
    } catch (error) {
      setProvisionMessage(t.settings.provisionFailed);
    } finally {
      setProvisioningSetupId(null);
    }
  };

  const recordProtocolServerApplyDryRun = async (setup: AdminProtocolSetupSummary) => {
    if (!canCreateProtocols) {
      setServerApplyMessage(t.settings.superadminRequired);
      return;
    }

    setServerApplyingSetupId(setup.id);
    setServerApplyMessage(null);

    try {
      const response = await recordAdminProtocolServerApplyDryRun(sessionToken, setup.id, { applyMode: 'dryRun' });

      setPersistedProtocolSetups((current) =>
        current.map((item) => (item.id === response.protocolSetup.id ? response.protocolSetup : item)),
      );
      setProtocolApplyEventsBySetupId((current) => ({
        ...current,
        [setup.id]: response.event,
      }));
      setProtocolApplyEvents((current) => [
        response.event,
        ...current.filter((event) => event.id !== response.event.id),
      ].slice(0, 10));
      setProtocolApplyEventDetail(response.event);
      setServerApplyMessage(t.settings.serverApplyDryRunRecorded);
    } catch (error) {
      setServerApplyMessage(t.settings.serverApplyDryRunFailed);
    } finally {
      setServerApplyingSetupId(null);
    }
  };

  const requestProtocolServerApplyLive = async (setup: AdminProtocolSetupSummary) => {
    if (!canCreateProtocols) {
      setServerApplyMessage(t.settings.superadminRequired);
      return;
    }

    setServerLiveApplyingSetupId(setup.id);
    setServerApplyMessage(null);

    try {
      const response = await requestAdminProtocolServerApply(sessionToken, setup.id, { applyMode: 'live' });

      setPersistedProtocolSetups((current) =>
        current.map((item) => (item.id === response.protocolSetup.id ? response.protocolSetup : item)),
      );
      setProtocolApplyEventsBySetupId((current) => ({
        ...current,
        [setup.id]: response.event,
      }));
      setProtocolApplyEvents((current) => [
        response.event,
        ...current.filter((event) => event.id !== response.event.id),
      ].slice(0, 10));
      setProtocolApplyEventDetail(response.event);
      setServerApplyMessage(
        response.dataPlaneMutationExecuted
          ? t.settings.serverApplyLiveExecuted
          : response.liveApplyAccepted
            ? t.settings.serverApplyLiveAccepted
            : t.settings.serverApplyLiveRequestRecorded,
      );
    } catch (error) {
      setServerApplyMessage(t.settings.serverApplyLiveRequestFailed);
    } finally {
      setServerLiveApplyingSetupId(null);
    }
  };

  const inspectProtocolApplyEvent = async (eventId: string) => {
    setIsProtocolApplyEventDetailLoading(true);
    setServerApplyMessage(null);

    try {
      const response = await fetchProtocolServerApplyEvent(sessionToken, eventId);

      setProtocolApplyEventDetail(response.event);
    } catch (error) {
      setServerApplyMessage(t.settings.protocolApplyEventDetailFailed);
    } finally {
      setIsProtocolApplyEventDetailLoading(false);
    }
  };

  const saveRouteSettings = async () => {
    setIsRouteSaving(true);
    setRouteMessage(null);

    try {
      const routeGroup = protocolDraft.routeGroup.trim() || draft.routeGroup.trim() || 'main';
      const selectedManagedOutboundId = activeWireGuard.source === 'outbound' ? activeWireGuard.id : null;
      const currentOutboundId = assignmentCurrentOutboundId || selectedManagedOutboundId;
      const lockedOutboundId = assignmentRouteLocked ? assignmentLockedOutboundId || currentOutboundId : null;
      const mode: RouteSelectionMode = assignmentAutoRouteEnabled ? 'automatic' : 'manual';
      const hysteresisScoreDelta = clamp(Math.round(Number(assignmentHysteresisScoreDelta) || 15), 1, 100);
      const cooldownSeconds = clamp(Math.round(Number(assignmentCooldownSeconds) || 180), 30, 3600);

      await updateAdminRouteSettings(sessionToken, {
        routeGroup,
        mode,
        selectedOutboundId: mode === 'manual' ? currentOutboundId || null : null,
        loadBalanceStrategy,
        protocolProfile: protocolDraft.profile,
        speedProfile: protocolDraft.profile,
      });
      const savedAssignment = await updateAdminRouteAssignment(sessionToken, {
        routeGroup,
        assignmentKey: 'default',
        assignmentLabel: t.settings.defaultAssignment,
        currentOutboundId: currentOutboundId || null,
        lockedOutboundId: lockedOutboundId || null,
        autoRouteEnabled: assignmentAutoRouteEnabled,
        routeLocked: assignmentRouteLocked,
        protocolProfile: protocolDraft.profile,
        speedProfile: protocolDraft.profile,
        hysteresisScoreDelta,
        cooldownSeconds,
      });
      const preview = await fetchRouteDecisionPreview(sessionToken, routeGroup, 'default');

      applyRouteAssignment(savedAssignment);
      setRouteDecisionPreview(preview);
      setRouteDecisionEventDetail(null);
      setRouteDecisionSwitchExecution(null);
      setRouteMode(mode);
      setRouteMessage(t.settings.routeSettingsSaved);
      setSettingsDataState('live');
    } catch (error) {
      setRouteMessage(t.settings.saveFailed);
    } finally {
      setIsRouteSaving(false);
    }
  };

  const saveTenantBranding = async () => {
    if (!canManageTenantBranding) {
      setTenantBrandMessage(t.settings.adminOnly);
      return;
    }

    setIsTenantBrandSaving(true);
    setTenantBrandMessage(null);

    try {
      const response = await updateAdminTenantBranding(sessionToken, {
        accentColor: tenantBrandForm.accentColor,
        clientAppTitle: tenantBrandForm.clientAppTitle,
        clientSupportMessage: normalizeNullableText(tenantBrandForm.clientSupportMessage),
        dashboardTitle: tenantBrandForm.dashboardTitle,
        displayName: tenantBrandForm.displayName,
        legalName: normalizeNullableText(tenantBrandForm.legalName),
        logoUrl: normalizeNullableText(tenantBrandForm.logoUrl),
        primaryColor: tenantBrandForm.primaryColor,
        publicBrandingEnabled: tenantBrandForm.publicBrandingEnabled,
        supportEmail: normalizeNullableText(tenantBrandForm.supportEmail),
        supportTelegram: normalizeNullableText(tenantBrandForm.supportTelegram),
        supportUrl: normalizeNullableText(tenantBrandForm.supportUrl),
        tenantSlug: tenantBrandForm.tenantSlug,
      });

      applyTenantBranding(response.branding);
      setTenantBrandMessage(t.settings.tenantBrandingSaved);
    } catch (error) {
      setTenantBrandMessage(t.settings.tenantBrandingSaveFailed);
    } finally {
      setIsTenantBrandSaving(false);
    }
  };

  const saveTelegramBotSettings = async (showSuccessMessage = true): Promise<AdminTelegramBotSettingsSummary | null> => {
    if (!canManageTelegramBot) {
      setTelegramBotMessage(t.settings.superadminRequired);
      return null;
    }

    setIsTelegramBotSaving(true);
    if (showSuccessMessage) setTelegramBotMessage(null);

    try {
      const response = await updateAdminTelegramBotSettings(sessionToken, {
        botToken: telegramBotForm.botToken.trim() || undefined,
        webhookSecret: telegramBotForm.webhookSecret.trim() || undefined,
        alertChatId: telegramBotForm.alertChatId.trim() || null,
        allowedAdminChatIds: parseTelegramChatIds(telegramBotForm.allowedAdminChatIds),
        alertsEnabled: telegramBotForm.alertsEnabled,
        commandsEnabled: telegramBotForm.commandsEnabled,
      });

      applyTelegramBotSettings(response.telegramBot);
      if (showSuccessMessage) setTelegramBotMessage(t.settings.telegramBotSaved);
      return response.telegramBot;
    } catch (error) {
      setTelegramBotMessage(t.settings.telegramBotSaveFailed);
      return null;
    } finally {
      setIsTelegramBotSaving(false);
    }
  };

  const testTelegramBotConnection = async () => {
    if (!canManageTelegramBot) {
      setTelegramBotMessage(t.settings.superadminRequired);
      return;
    }

    setIsTelegramBotTesting(true);
    setTelegramBotMessage(null);

    try {
      const saved = await saveTelegramBotSettings(false);
      if (!saved) return;

      const response = await testAdminTelegramBotConnection(sessionToken);
      applyTelegramBotSettings(response.telegramBot);
      setTelegramBotMessage(response.ok ? t.settings.telegramBotTestOk : t.settings.telegramBotTestFailed);
    } catch (error) {
      setTelegramBotMessage(t.settings.telegramBotTestFailed);
    } finally {
      setIsTelegramBotTesting(false);
    }
  };

  const recordDecisionEvent = async () => {
    setIsDecisionRecording(true);
    setRouteMessage(null);

    try {
      const routeGroup = protocolDraft.routeGroup.trim() || draft.routeGroup.trim() || 'main';
      const response = await recordRouteDecisionPreview(sessionToken, {
        routeGroup,
        assignmentKey: 'default',
      });

      setRouteDecisionPreview(response.preview);
      setRouteDecisionEvents((current) => [
        response.event,
        ...current.filter((event) => event.id !== response.event.id),
      ].slice(0, 10));
      setRouteDecisionEventDetail(null);
      setRouteDecisionSwitchExecution(null);
      setRouteMessage(t.settings.routeDecisionRecorded);
    } catch (error) {
      setRouteMessage(t.settings.routeDecisionRecordFailed);
    } finally {
      setIsDecisionRecording(false);
    }
  };

  const inspectDecisionEvent = async (eventId: string) => {
    setIsDecisionEventDetailLoading(true);
    setRouteMessage(null);

    try {
      const response = await fetchRouteDecisionEvent(sessionToken, eventId);

      setRouteDecisionEventDetail(response.event);
      setRouteDecisionSwitchExecution(response.event.switchExecution ?? null);
    } catch (error) {
      setRouteMessage(t.settings.decisionEventDetailFailed);
    } finally {
      setIsDecisionEventDetailLoading(false);
    }
  };

  const applyDecisionAssignment = async () => {
    setIsDecisionApplying(true);
    setRouteMessage(null);

    try {
      const routeGroup = protocolDraft.routeGroup.trim() || draft.routeGroup.trim() || 'main';
      const response = await applyRouteDecisionPreview(sessionToken, {
        routeGroup,
        assignmentKey: 'default',
        applyMode: 'assignmentOnly',
      });

      applyRouteAssignment(response.assignment);
      setRouteDecisionPreview(response.preview);
      setRouteDecisionSwitchExecution(response.switchExecution);
      setRouteDecisionEvents((current) => [
        response.event,
        ...current.filter((event) => event.id !== response.event.id),
      ].slice(0, 10));
      setRouteDecisionEventDetail(null);
      setRouteMessage(response.dataPlaneApplied ? t.settings.routeDecisionApplied : t.settings.routeDecisionAssignmentApplied);
    } catch (error) {
      setRouteMessage(t.settings.routeDecisionApplyFailed);
    } finally {
      setIsDecisionApplying(false);
    }
  };

  const validateWireGuardDraft = async () => {
    setValidationMessage(null);

    if (!draft.privateKey.trim() && !privateKeySecretRef) {
      setValidationMessage(t.settings.privateKeyRequired);
      return;
    }

    if (!hasTunnelShape) {
      setValidationMessage(t.settings.requiredFields);
      return;
    }

    const secretRef = await savePrivateKeySecret();
    if (!secretRef) return;

    setPrivateKeyAccepted(true);
    setValidationMessage(t.settings.draftReady);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void validateWireGuardDraft();
  };

  const clearDraft = () => {
    setDraft({
      serverName: '',
      interfaceName: 'wg0',
      routeGroup: 'main',
      addressCidr: '',
      listenPort: '51820',
      privateKey: '',
      peerPublicKey: '',
      endpoint: '',
      allowedIps: '0.0.0.0/0, ::/0',
      persistentKeepalive: '25',
      healthTarget: '',
    });
    setPrivateKeyAccepted(false);
    setPrivateKeySecretRef(null);
    setValidationMessage(null);
  };

  return (
    <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
      <section className="grid gap-3">
        <section className={panelClass}>
          <PanelHeading title={t.panels.routeControl} icon={ArrowDownUp} meta={t.settings.smartRoute} />
          <div className="mt-3 grid gap-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {(['automatic', 'manual'] as RouteSelectionMode[]).map((mode) => {
                const isSelected = routeMode === mode;

                return (
                  <button
                    aria-pressed={isSelected}
                    className={`min-h-10 rounded-md border px-3 text-sm font-bold transition ${isSelected ? 'border-afro-teal bg-[#e7f6ef] text-afro-green' : 'border-afro-line bg-white text-afro-ink hover:border-afro-teal hover:text-afro-teal'}`}
                    key={mode}
                    onClick={() => {
                      setRouteMode(mode);
                      setAssignmentAutoRouteEnabled(mode === 'automatic');
                      if (mode === 'manual' && !assignmentCurrentOutboundId && activeWireGuard.source === 'outbound') {
                        setAssignmentCurrentOutboundId(activeWireGuard.id);
                      }
                    }}
                    type="button"
                  >
                    {mode === 'automatic' ? t.settings.automatic : t.settings.manual}
                  </button>
                );
              })}
            </div>

            <p className="rounded-md border border-afro-line bg-white px-3 py-2 text-[13px] font-bold text-afro-muted">
              {routeModeDescription}
            </p>

            <div className="grid gap-2 rounded-md border border-afro-line bg-white p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-[13px]">{t.settings.routeAssignment}</strong>
                <StatusBadge tone={assignmentRouteLocked ? 'warning' : assignmentAutoRouteEnabled ? 'good' : 'neutral'}>
                  {assignmentRouteLocked ? t.routePolicy.routeLock : assignmentAutoRouteEnabled ? t.routePolicy.autoRoute : t.settings.manual}
                </StatusBadge>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-afro-line px-3 py-2">
                  <span className="text-[13px] font-bold text-afro-muted">{t.settings.autoRouteToggle}</span>
                  <input
                    checked={assignmentAutoRouteEnabled}
                    className="size-4 accent-afro-teal"
                    onChange={(event) => {
                      setAssignmentAutoRouteEnabled(event.target.checked);
                      setRouteMode(event.target.checked ? 'automatic' : 'manual');
                    }}
                    type="checkbox"
                  />
                </label>
                <label className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-afro-line px-3 py-2">
                  <span className="text-[13px] font-bold text-afro-muted">{t.settings.routeLockToggle}</span>
                  <input
                    checked={assignmentRouteLocked}
                    className="size-4 accent-afro-teal"
                    onChange={(event) => {
                      setAssignmentRouteLocked(event.target.checked);
                      if (event.target.checked && !assignmentLockedOutboundId) {
                        setAssignmentLockedOutboundId(assignmentCurrentOutboundId || managedWireGuardCandidates[0]?.id || '');
                      }
                    }}
                    type="checkbox"
                  />
                </label>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-[13px] font-bold text-afro-muted">{t.settings.currentManagedRoute}</span>
                  <select
                    className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm font-bold outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4"
                    onChange={(event) => {
                      setAssignmentCurrentOutboundId(event.target.value);
                      if (!assignmentLockedOutboundId) setAssignmentLockedOutboundId(event.target.value);
                    }}
                    value={assignmentCurrentOutboundId}
                  >
                    <option value="">{t.settings.noManagedRouteSelected}</option>
                    {managedWireGuardCandidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {format.label(candidate.name)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[13px] font-bold text-afro-muted">{t.settings.lockedManagedRoute}</span>
                  <select
                    className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm font-bold outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-50"
                    disabled={!assignmentRouteLocked}
                    onChange={(event) => setAssignmentLockedOutboundId(event.target.value)}
                    value={assignmentLockedOutboundId}
                  >
                    <option value="">{t.settings.noManagedRouteSelected}</option>
                    {managedWireGuardCandidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {format.label(candidate.name)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <SettingsInput inputMode="numeric" label={t.settings.hysteresisScoreDelta} onChange={setAssignmentHysteresisScoreDelta} value={assignmentHysteresisScoreDelta} />
                <SettingsInput inputMode="numeric" label={t.settings.cooldownSeconds} onChange={setAssignmentCooldownSeconds} value={assignmentCooldownSeconds} />
              </div>
              {managedWireGuardCandidates.length === 0 ? <p className="text-[12px] font-bold text-afro-muted">{t.settings.noManagedWireGuard}</p> : null}
            </div>

            <div>
              <div className="mb-1.5 text-[13px] font-bold text-afro-muted">{t.settings.loadBalanceStrategy}</div>
              <div className="grid gap-2 md:grid-cols-3">
                {loadBalanceOptions.map(([value, label]) => {
                  const isSelected = loadBalanceStrategy === value;

                  return (
                    <button
                      aria-pressed={isSelected}
                      className={`min-h-10 rounded-md border px-3 text-sm font-bold transition ${isSelected ? 'border-afro-blue bg-[#edf4ff] text-afro-blue' : 'border-afro-line bg-white text-afro-ink hover:border-afro-blue hover:text-afro-blue'}`}
                      key={value}
                      onClick={() => setLoadBalanceStrategy(value)}
                      type="button"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {routeMode === 'manual' ? (
              <div>
                <div className="mb-1.5 text-[13px] font-bold text-afro-muted">{t.settings.manualWireGuard}</div>
                <div className="grid gap-2 md:grid-cols-3">
                  {wireGuardCandidates.map((candidate) => {
                    const isSelected = selectedWireGuard.id === candidate.id;

                    return (
                      <button
                        aria-pressed={isSelected}
                        className={`grid min-h-[74px] gap-1 rounded-md border px-3 py-2 text-start transition ${isSelected ? 'border-afro-teal bg-[#e7f6ef]' : 'border-afro-line bg-white hover:border-afro-teal'}`}
                        key={candidate.id}
                        onClick={() => setSelectedWireGuardId(candidate.id)}
                        type="button"
                      >
                        <span className="truncate text-sm font-bold text-afro-ink">{candidate.name}</span>
                        <span className="truncate text-[12px] text-afro-muted" dir="ltr">{candidate.endpoint ?? '-'}</span>
                        <span className="inline-flex flex-wrap items-center gap-1">
                          <StatusBadge tone={getWireGuardScoreTone(candidate.score)}>{format.percent(candidate.score)}</StatusBadge>
                          <StatusBadge tone={candidate.source === 'agent' ? 'good' : 'neutral'}>
                            {wireGuardCandidateSourceLabel(candidate, t)}
                          </StatusBadge>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 rounded-md border border-afro-line bg-white px-3 py-2">
                <span className="text-[13px] font-bold text-afro-muted">{t.settings.autoRecommendation}</span>
                <div className="flex min-w-0 items-center gap-2">
                  <strong className="min-w-0 truncate text-sm">{bestWireGuard.name}</strong>
                  <StatusBadge tone={getWireGuardScoreTone(bestWireGuard.score)}>{t.settings.bestHealth}</StatusBadge>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-afro-line pt-3">
              <span className="text-[13px] font-bold text-afro-muted">
                {settingsDataState === 'live' ? t.settings.settingsStorageReady : t.settings.localDraftOnly}
              </span>
              <button
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-afro-sidebar px-4 text-sm font-bold text-white hover:bg-[#1f3138] disabled:cursor-wait disabled:opacity-60"
                disabled={isRouteSaving}
                onClick={() => void saveRouteSettings()}
                type="button"
              >
                <CheckCircle2 size={16} />
                {isRouteSaving ? t.settings.saving : t.settings.saveRouteSettings}
              </button>
            </div>
            {routeMessage ? <p className="text-[13px] font-bold text-afro-teal">{routeMessage}</p> : null}
          </div>
        </section>

        <section className={panelClass}>
          <PanelHeading title={t.panels.tenantBranding} icon={Palette} meta={canManageTenantBranding ? t.settings.adminReady : t.settings.adminOnly} />
          <form className="mt-3 grid gap-3" onSubmit={(event) => { event.preventDefault(); void saveTenantBranding(); }}>
            <div className="grid gap-2 md:grid-cols-3">
              <SettingsInput
                disabled={!canManageTenantBranding}
                label={t.settings.tenantSlug}
                onChange={(value) => updateTenantBrandForm('tenantSlug', value)}
                required
                value={tenantBrandForm.tenantSlug}
              />
              <SettingsInput
                disabled={!canManageTenantBranding}
                label={t.settings.brandDisplayName}
                onChange={(value) => updateTenantBrandForm('displayName', value)}
                required
                value={tenantBrandForm.displayName}
              />
              <SettingsInput
                disabled={!canManageTenantBranding}
                label={t.settings.brandLegalName}
                onChange={(value) => updateTenantBrandForm('legalName', value)}
                value={tenantBrandForm.legalName}
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <SettingsInput
                disabled={!canManageTenantBranding}
                label={t.settings.dashboardTitle}
                onChange={(value) => updateTenantBrandForm('dashboardTitle', value)}
                required
                value={tenantBrandForm.dashboardTitle}
              />
              <SettingsInput
                disabled={!canManageTenantBranding}
                label={t.settings.clientAppTitle}
                onChange={(value) => updateTenantBrandForm('clientAppTitle', value)}
                required
                value={tenantBrandForm.clientAppTitle}
              />
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <SettingsInput
                disabled={!canManageTenantBranding}
                label={t.settings.supportEmail}
                onChange={(value) => updateTenantBrandForm('supportEmail', value)}
                value={tenantBrandForm.supportEmail}
              />
              <SettingsInput
                disabled={!canManageTenantBranding}
                label={t.settings.supportTelegram}
                onChange={(value) => updateTenantBrandForm('supportTelegram', value)}
                value={tenantBrandForm.supportTelegram}
              />
              <SettingsInput
                disabled={!canManageTenantBranding}
                label={t.settings.supportUrl}
                onChange={(value) => updateTenantBrandForm('supportUrl', value)}
                value={tenantBrandForm.supportUrl}
              />
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <SettingsInput
                disabled={!canManageTenantBranding}
                label={t.settings.logoUrl}
                onChange={(value) => updateTenantBrandForm('logoUrl', value)}
                value={tenantBrandForm.logoUrl}
              />
              <label className="grid gap-1.5">
                <span className="text-[13px] font-bold text-afro-muted">{t.settings.primaryColor}</span>
                <span className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-2">
                  <span
                    aria-hidden="true"
                    className="min-h-10 rounded-md border border-afro-line"
                    style={{ backgroundColor: tenantBrandForm.primaryColor }}
                  />
                  <input
                    className="min-h-10 w-full rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45"
                    disabled={!canManageTenantBranding}
                    dir="ltr"
                    onChange={(event) => updateTenantBrandForm('primaryColor', event.target.value)}
                    value={tenantBrandForm.primaryColor}
                  />
                </span>
              </label>
              <label className="grid gap-1.5">
                <span className="text-[13px] font-bold text-afro-muted">{t.settings.accentColor}</span>
                <span className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-2">
                  <span
                    aria-hidden="true"
                    className="min-h-10 rounded-md border border-afro-line"
                    style={{ backgroundColor: tenantBrandForm.accentColor }}
                  />
                  <input
                    className="min-h-10 w-full rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45"
                    disabled={!canManageTenantBranding}
                    dir="ltr"
                    onChange={(event) => updateTenantBrandForm('accentColor', event.target.value)}
                    value={tenantBrandForm.accentColor}
                  />
                </span>
              </label>
            </div>
            <label className="grid gap-1.5">
              <span className="text-[13px] font-bold text-afro-muted">{t.settings.clientSupportMessage}</span>
              <textarea
                className="min-h-20 w-full resize-y rounded-md border border-afro-line bg-white px-3 py-2 text-sm font-bold text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45"
                disabled={!canManageTenantBranding}
                onChange={(event) => updateTenantBrandForm('clientSupportMessage', event.target.value)}
                value={tenantBrandForm.clientSupportMessage}
              />
            </label>
            <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)]">
              <div className="grid gap-2">
                {tenantBrandingRows.map(([label, value, tone]) => (
                  <div className="flex min-h-9 items-center justify-between gap-2 rounded-md border border-afro-line px-2.5" key={label}>
                    <span className={`${mutedTextClass} min-w-0 truncate`}>{label}</span>
                    <StatusBadge tone={tone}>{value}</StatusBadge>
                  </div>
                ))}
                <label className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-afro-line px-3 py-2">
                  <span className="text-[13px] font-bold text-afro-muted">{t.settings.publicBranding}</span>
                  <input
                    checked={tenantBrandForm.publicBrandingEnabled}
                    className="size-4 accent-afro-teal"
                    disabled={!canManageTenantBranding}
                    onChange={(event) => updateTenantBrandForm('publicBrandingEnabled', event.target.checked)}
                    type="checkbox"
                  />
                </label>
              </div>
              <div className="grid gap-2 rounded-md border border-afro-line bg-white p-2.5">
                <div
                  className="flex min-h-16 items-center gap-3 rounded-md px-3 py-2 text-white"
                  style={{ backgroundColor: tenantBrandForm.primaryColor }}
                >
                  {tenantBrandForm.logoUrl ? (
                    <img
                      alt=""
                      className="size-10 rounded-md border border-white/40 bg-white object-contain"
                      src={tenantBrandForm.logoUrl}
                    />
                  ) : (
                    <span
                      className="inline-flex size-10 items-center justify-center rounded-md border border-white/40 text-sm font-black"
                      style={{ backgroundColor: tenantBrandForm.accentColor }}
                    >
                      {tenantBrandForm.displayName.slice(0, 2).toUpperCase() || 'AG'}
                    </span>
                  )}
                  <span className="min-w-0">
                    <strong className="block truncate text-base">{tenantBrandForm.displayName || t.settings.brandDisplayName}</strong>
                    <span className="block truncate text-[12px] font-bold text-white/85">{tenantBrandForm.clientAppTitle || t.settings.clientAppTitle}</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge tone="neutral">{tenantBrandForm.dashboardTitle || t.settings.dashboardTitle}</StatusBadge>
                  <StatusBadge tone={tenantBrandForm.publicBrandingEnabled ? 'good' : 'neutral'}>
                    {tenantBrandForm.publicBrandingEnabled ? t.settings.enabled : t.settings.disabled}
                  </StatusBadge>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-afro-line pt-3">
              <p className="min-w-0 text-[13px] font-bold text-afro-muted">{t.settings.tenantBrandingNote}</p>
              <button
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-afro-sidebar px-4 text-sm font-bold text-white hover:bg-[#1f3138] disabled:cursor-wait disabled:opacity-60"
                disabled={!canManageTenantBranding || isTenantBrandSaving}
                type="submit"
              >
                <CheckCircle2 size={16} />
                {isTenantBrandSaving ? t.settings.saving : t.settings.saveTenantBranding}
              </button>
            </div>
            {tenantBrandMessage ? <p className="text-[13px] font-bold text-afro-teal">{tenantBrandMessage}</p> : null}
          </form>
        </section>

        <section className={panelClass}>
          <PanelHeading title={t.panels.telegramBotSetup} icon={Bot} meta={canManageTelegramBot ? t.settings.superadminReady : t.settings.superadminOnly} />
          <div className="mt-3 grid gap-3">
            <div className="grid gap-2 md:grid-cols-2">
              <SettingsInput
                autoComplete="off"
                disabled={!canManageTelegramBot}
                label={t.settings.telegramBotToken}
                onChange={(value) => updateTelegramBotForm('botToken', value)}
                placeholder={telegramBotSettings?.hasBotToken ? telegramSecretSourceLabel(telegramBotSettings.botTokenSource, t) : ''}
                type="password"
                value={telegramBotForm.botToken}
              />
              <SettingsInput
                autoComplete="off"
                disabled={!canManageTelegramBot}
                label={t.settings.telegramWebhookSecret}
                onChange={(value) => updateTelegramBotForm('webhookSecret', value)}
                placeholder={telegramBotSettings?.hasWebhookSecret ? telegramSecretSourceLabel(telegramBotSettings.webhookSecretSource, t) : ''}
                type="password"
                value={telegramBotForm.webhookSecret}
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <SettingsInput
                disabled={!canManageTelegramBot}
                inputMode="numeric"
                label={t.settings.telegramAlertChatId}
                onChange={(value) => updateTelegramBotForm('alertChatId', value)}
                value={telegramBotForm.alertChatId}
              />
              <SettingsInput
                disabled={!canManageTelegramBot}
                label={t.settings.telegramAllowedAdminChatIds}
                onChange={(value) => updateTelegramBotForm('allowedAdminChatIds', value)}
                value={telegramBotForm.allowedAdminChatIds}
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-afro-line px-3 py-2">
                <span className="text-[13px] font-bold text-afro-muted">{t.settings.telegramAlertsEnabled}</span>
                <input
                  checked={telegramBotForm.alertsEnabled}
                  className="size-4 accent-afro-teal"
                  disabled={!canManageTelegramBot}
                  onChange={(event) => updateTelegramBotForm('alertsEnabled', event.target.checked)}
                  type="checkbox"
                />
              </label>
              <label className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-afro-line px-3 py-2">
                <span className="text-[13px] font-bold text-afro-muted">{t.settings.telegramCommandsEnabled}</span>
                <input
                  checked={telegramBotForm.commandsEnabled}
                  className="size-4 accent-afro-teal"
                  disabled={!canManageTelegramBot}
                  onChange={(event) => updateTelegramBotForm('commandsEnabled', event.target.checked)}
                  type="checkbox"
                />
              </label>
            </div>
            <div className="grid gap-2">
              {telegramBotReadinessRows.map(([label, value, tone]) => (
                <div className="flex min-h-9 items-center justify-between gap-2 rounded-md border border-afro-line px-2.5" key={label}>
                  <span className={`${mutedTextClass} min-w-0 truncate`}>{label}</span>
                  <StatusBadge tone={tone}>{value}</StatusBadge>
                </div>
              ))}
            </div>
            {telegramBotSettings?.botUsername || telegramBotSettings?.botFirstName ? (
              <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 rounded-md border border-afro-line bg-white px-3 py-2">
                <span className="text-[13px] font-bold text-afro-muted">{t.settings.telegramBotIdentity}</span>
                <strong className="min-w-0 truncate text-sm" dir="ltr">
                  {telegramBotSettings.botUsername ? `@${telegramBotSettings.botUsername}` : telegramBotSettings.botFirstName}
                </strong>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-afro-line pt-3">
              <div className="flex min-w-0 items-center gap-2 text-[13px] text-afro-muted">
                <LockKeyhole className="shrink-0" size={16} />
                <span className="min-w-0 truncate">{t.settings.telegramBotWriteOnly}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-afro-line px-4 text-sm font-bold text-afro-ink hover:border-afro-blue hover:text-afro-blue disabled:cursor-wait disabled:opacity-60"
                  disabled={!canManageTelegramBot || isTelegramBotTesting || isTelegramBotSaving}
                  onClick={() => void testTelegramBotConnection()}
                  type="button"
                >
                  <ShieldCheck size={16} />
                  {isTelegramBotTesting ? t.settings.testing : t.settings.testTelegramBotApi}
                </button>
                <button
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-afro-sidebar px-4 text-sm font-bold text-white hover:bg-[#1f3138] disabled:cursor-wait disabled:opacity-60"
                  disabled={!canManageTelegramBot || isTelegramBotSaving || isTelegramBotTesting}
                  onClick={() => void saveTelegramBotSettings()}
                  type="button"
                >
                  <CheckCircle2 size={16} />
                  {isTelegramBotSaving ? t.settings.saving : t.settings.saveTelegramBotSettings}
                </button>
              </div>
            </div>
            {telegramBotMessage ? <p className="text-[13px] font-bold text-afro-teal">{telegramBotMessage}</p> : null}
          </div>
        </section>

        <section className={panelClass}>
          <PanelHeading title={t.panels.protocolFactory} icon={Plus} meta={canCreateProtocols ? t.settings.superadminReady : t.settings.superadminOnly} />
          <div className="mt-3 grid gap-3">
            <div>
              <div className="mb-1.5 text-[13px] font-bold text-afro-muted">{t.settings.protocol}</div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {protocolOptions.map(([value, label]) => {
                  const isSelected = protocolDraft.protocol === value;

                  return (
                    <button
                      aria-pressed={isSelected}
                      className={`min-h-10 rounded-md border px-3 text-sm font-bold transition ${isSelected ? 'border-afro-teal bg-[#e7f6ef] text-afro-green' : 'border-afro-line bg-white text-afro-ink hover:border-afro-teal hover:text-afro-teal'}`}
                      key={value}
                      onClick={() => selectProtocol(value)}
                      type="button"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[13px] font-bold text-afro-muted">{t.settings.protocolProfile}</div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {profileOptions.map(([value, label]) => {
                  const isSelected = protocolDraft.profile === value;

                  return (
                    <button
                      aria-pressed={isSelected}
                      className={`min-h-10 rounded-md border px-3 text-sm font-bold transition ${isSelected ? 'border-afro-blue bg-[#edf4ff] text-afro-blue' : 'border-afro-line bg-white text-afro-ink hover:border-afro-blue hover:text-afro-blue'}`}
                      key={value}
                      onClick={() => updateProtocolDraft('profile', value)}
                      type="button"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-4">
              <SettingsInput label={t.settings.protocolName} onChange={(value) => updateProtocolDraft('name', value)} required value={protocolDraft.name} />
              <SettingsInput inputMode="numeric" label={t.settings.protocolPort} onChange={(value) => updateProtocolDraft('port', value)} required value={protocolDraft.port} />
              <SettingsInput label={t.settings.routeGroup} onChange={(value) => updateProtocolDraft('routeGroup', value)} required value={protocolDraft.routeGroup} />
              <SettingsSelect
                label={t.settings.targetServer}
                onChange={(value) => updateProtocolDraft('targetServerId', value)}
                options={[{ label: t.settings.noTargetServer, value: '' }, ...targetServerOptions]}
                value={protocolDraft.targetServerId}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-afro-line pt-3">
              <p className="min-w-0 text-[13px] font-bold text-afro-muted">{t.settings.protocolFactoryNote}</p>
              <button
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-afro-sidebar px-4 text-sm font-bold text-white hover:bg-[#1f3138] disabled:cursor-not-allowed disabled:opacity-55"
                disabled={!canCreateProtocols || isProtocolSaving}
                onClick={() => void createProtocolDraft()}
                type="button"
              >
                <Plus size={16} />
                {isProtocolSaving ? t.settings.saving : t.settings.createProtocolDraft}
              </button>
            </div>
            {protocolMessage ? <p className="text-[13px] font-bold text-afro-teal">{protocolMessage}</p> : null}
            {persistedProtocolSetups.length > 0 ? (
              <div className="grid gap-2 border-t border-afro-line pt-3">
                <div className="text-[13px] font-bold text-afro-muted">{t.settings.persistedDrafts}</div>
                <div className="grid gap-2 md:grid-cols-2">
                  {persistedProtocolSetups.slice(0, 4).map((setup) => {
                    const isProvisioned = Boolean(setup.provisionedOutboundId);
                    const isProvisioning = provisioningSetupId === setup.id;
                    const isServerApplying = serverApplyingSetupId === setup.id;
                    const isServerLiveApplying = serverLiveApplyingSetupId === setup.id;
                    const lastServerApplyEvent = protocolApplyEventsBySetupId[setup.id];
                    const serverApplyPlan = setup.serverApplyPlan;

                    return (
                      <div className="grid gap-2 rounded-md border border-afro-line bg-white px-2.5 py-2" key={setup.id}>
                        <div className="flex min-h-10 items-center justify-between gap-2">
                          <div className="min-w-0">
                            <strong className="block truncate text-[13px]">{setup.name}</strong>
                            <span className="block truncate text-[12px] text-afro-muted">
                              {setup.protocol} / {setup.routeGroup}
                              {setup.targetServerLabel ? ` / ${setup.targetServerLabel}` : ''}
                              {isProvisioned ? ` / ${t.settings.managedOutbound}` : ''}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <StatusBadge tone={isProvisioned || setup.hasSecretRef ? 'good' : 'neutral'}>
                              {isProvisioned ? t.settings.provisioned : setup.status}
                            </StatusBadge>
                            {!isProvisioned ? (
                              <button
                                className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border border-afro-line px-2.5 text-[12px] font-bold text-afro-ink hover:border-afro-teal hover:text-afro-teal disabled:cursor-wait disabled:opacity-55"
                                disabled={!canCreateProtocols || Boolean(provisioningSetupId)}
                                onClick={() => void provisionProtocolDraft(setup)}
                                type="button"
                              >
                                <CheckCircle2 size={14} />
                                {isProvisioning ? t.settings.provisioning : t.settings.provisionDraft}
                              </button>
                            ) : null}
                            {isProvisioned ? (
                              <>
                                <button
                                  className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border border-afro-line px-2.5 text-[12px] font-bold text-afro-ink hover:border-afro-blue hover:text-afro-blue disabled:cursor-wait disabled:opacity-55"
                                  disabled={!canCreateProtocols || Boolean(serverApplyingSetupId) || Boolean(serverLiveApplyingSetupId)}
                                  onClick={() => void recordProtocolServerApplyDryRun(setup)}
                                  type="button"
                                >
                                  <ShieldCheck size={14} />
                                  {isServerApplying ? t.settings.recordingServerApply : t.settings.recordServerApplyDryRun}
                                </button>
                                <button
                                  className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border border-afro-line px-2.5 text-[12px] font-bold text-afro-ink hover:border-[#f0b7b7] hover:text-[#b91c1c] disabled:cursor-wait disabled:opacity-55"
                                  disabled={!canCreateProtocols || Boolean(serverApplyingSetupId) || Boolean(serverLiveApplyingSetupId)}
                                  onClick={() => void requestProtocolServerApplyLive(setup)}
                                  type="button"
                                >
                                  <AlertTriangle size={14} />
                                  {isServerLiveApplying ? t.settings.requestingServerApplyLive : t.settings.requestServerApplyLive}
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                        {serverApplyPlan ? <ProtocolServerApplyPlanCard format={format} plan={serverApplyPlan} t={t} /> : null}
                        {lastServerApplyEvent ? (
                          <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 rounded-md border border-afro-line bg-[#f9fbfc] px-2 text-[12px]">
                            <span className="font-bold text-afro-muted">{t.settings.serverApplyEventRecorded}</span>
                            <span className="flex min-w-0 items-center gap-1.5">
                              <StatusBadge tone={lastServerApplyEvent.secretSafe ? 'good' : 'warning'}>
                                {lastServerApplyEvent.secretSafe ? t.settings.secretSafe : t.settings.serverApplyBlocked}
                              </StatusBadge>
                              <strong className="truncate">{format.time(new Date(lastServerApplyEvent.createdAt), false)}</strong>
                            </span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <ProtocolApplyEventsPanel
              eventDetail={protocolApplyEventDetail}
              events={protocolApplyEvents}
              format={format}
              isDetailLoading={isProtocolApplyEventDetailLoading}
              onInspectEvent={(eventId) => void inspectProtocolApplyEvent(eventId)}
              t={t}
            />
            {provisionMessage ? <p className="text-[13px] font-bold text-afro-teal">{provisionMessage}</p> : null}
            {serverApplyMessage ? <p className="text-[13px] font-bold text-afro-teal">{serverApplyMessage}</p> : null}
          </div>
        </section>

        <section className={panelClass}>
          <PanelHeading title={t.panels.wireguardSetup} icon={SettingsIcon} meta={t.settings.guidedSetup} />
          <form className="mt-3 grid gap-3" onSubmit={handleSubmit}>
            <div className="grid gap-2 md:grid-cols-3">
              <SettingsInput label={t.settings.serverName} onChange={(value) => updateDraft('serverName', value)} value={draft.serverName} />
              <SettingsInput label={t.settings.interfaceName} onChange={(value) => updateDraft('interfaceName', value)} required value={draft.interfaceName} />
              <SettingsInput label={t.settings.routeGroup} onChange={(value) => updateDraft('routeGroup', value)} required value={draft.routeGroup} />
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <SettingsInput label={t.settings.addressCidr} onChange={(value) => updateDraft('addressCidr', value)} placeholder="10.10.0.2/32" required value={draft.addressCidr} />
              <SettingsInput inputMode="numeric" label={t.settings.listenPort} onChange={(value) => updateDraft('listenPort', value)} required value={draft.listenPort} />
              <SettingsInput inputMode="numeric" label={t.settings.keepalive} onChange={(value) => updateDraft('persistentKeepalive', value)} value={draft.persistentKeepalive} />
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <SettingsInput autoComplete="off" label={t.settings.privateKey} onChange={(value) => updateDraft('privateKey', value)} required type="password" value={draft.privateKey} />
              <SettingsInput autoComplete="off" label={t.settings.peerPublicKey} onChange={(value) => updateDraft('peerPublicKey', value)} required value={draft.peerPublicKey} />
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <SettingsInput label={t.settings.endpoint} onChange={(value) => updateDraft('endpoint', value)} placeholder="gateway.example.com:51820" required value={draft.endpoint} />
              <SettingsInput label={t.settings.allowedIps} onChange={(value) => updateDraft('allowedIps', value)} required value={draft.allowedIps} />
            </div>

            <SettingsInput label={t.settings.healthTarget} onChange={(value) => updateDraft('healthTarget', value)} placeholder="https://example.com/health" value={draft.healthTarget} />

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-afro-line pt-3">
              <div className="flex min-w-0 items-center gap-2 text-[13px] text-afro-muted">
                <LockKeyhole className="shrink-0" size={16} />
                <span className="min-w-0 truncate">{t.settings.writeOnlySecret}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="inline-flex min-h-10 items-center justify-center rounded-md border border-afro-line px-4 text-sm font-bold text-afro-ink hover:border-afro-teal hover:text-afro-teal" onClick={clearDraft} type="button">
                  {t.settings.clearDraft}
                </button>
                <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-afro-sidebar px-4 text-sm font-bold text-white hover:bg-[#1f3138] disabled:cursor-wait disabled:opacity-60" disabled={isSecretSaving} type="submit">
                  <CheckCircle2 size={16} />
                  {isSecretSaving ? t.settings.saving : t.settings.validateDraft}
                </button>
              </div>
            </div>
            {validationMessage ? <p className="text-[13px] font-bold text-afro-teal">{validationMessage}</p> : null}
          </form>
        </section>
      </section>

      <section className="grid gap-3">
        <section className={panelClass}>
          <PanelHeading title={t.panels.setupReadiness} icon={ShieldCheck} meta={t.settings.secretSafe} />
          <div className="mt-2 grid gap-2">
            {readinessRows.map(([label, value, tone]) => (
              <div className="flex min-h-9 items-center justify-between gap-2 rounded-md border border-afro-line px-2.5" key={label}>
                <span className={`${mutedTextClass} min-w-0 truncate`}>{label}</span>
                <StatusBadge tone={tone}>{value}</StatusBadge>
              </div>
            ))}
          </div>
        </section>

        <section className={panelClass}>
          <PanelHeading title={t.panels.wireguardHealth} icon={Gauge} meta={t.settings.healthChecked} />
          <div className="mt-2 grid gap-2">
            {wireGuardCandidates.map((candidate) => (
              <div className="grid gap-2 rounded-md border border-afro-line px-2.5 py-2" key={candidate.id}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <strong className="block truncate text-[13px]">{candidate.name}</strong>
                    <span className="block truncate text-[12px] text-afro-muted" dir="ltr">{candidate.endpoint ?? '-'}</span>
                  </div>
                  <span className="inline-flex shrink-0 flex-wrap justify-end gap-1">
                    <StatusBadge tone={candidate.source === 'agent' ? 'good' : 'neutral'}>
                      {wireGuardCandidateSourceLabel(candidate, t)}
                    </StatusBadge>
                    <StatusBadge tone={getWireGuardScoreTone(candidate.score)}>{format.percent(candidate.score)}</StatusBadge>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[12px] md:grid-cols-4">
                  <MetricPill icon={Clock} label={t.settings.latency} value={format.latency(candidate.latencyMs ?? null)} />
                  <MetricPill icon={ArrowDownUp} label={t.settings.jitter} value={format.latency(candidate.jitterMs ?? null)} />
                  <MetricPill icon={AlertTriangle} label={t.settings.packetLoss} value={format.packetLoss(candidate.packetLossPercent ?? null)} />
                  <MetricPill icon={Gauge} label={t.settings.load} value={format.percent(candidate.loadPercent ?? null)} />
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[12px] md:grid-cols-3">
                  <MetricPill icon={Network} label={t.settings.peers} value={formatWireGuardCandidatePeers(candidate, format, t)} />
                  <MetricPill icon={Clock} label={t.settings.latestHandshake} value={formatWireGuardCandidateHandshake(candidate, format, t)} />
                  <MetricPill icon={ArrowDownUp} label={t.settings.throughput} value={formatWireGuardCandidateRate(candidate, format)} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <RouteIntelligencePanel analytics={routeQualityAnalytics} format={format} t={t} />

        <RouteDecisionPreviewPanel
          eventDetail={routeDecisionEventDetail}
          events={routeDecisionEvents}
          format={format}
          isApplying={isDecisionApplying}
          isEventDetailLoading={isDecisionEventDetailLoading}
          isRecording={isDecisionRecording}
          onApply={() => void applyDecisionAssignment()}
          onInspectEvent={(eventId) => void inspectDecisionEvent(eventId)}
          onRecord={() => void recordDecisionEvent()}
          preview={routeDecisionPreview}
          switchExecution={routeDecisionSwitchExecution}
          t={t}
        />

        <section className={panelClass}>
          <PanelHeading title={t.panels.setupPreview} icon={Route} meta={t.settings.noSecretEcho} />
          <div className="mt-2 grid gap-2">
            {previewRows.map(([label, value]) => (
              <div className="grid min-h-9 grid-cols-[minmax(96px,0.42fr)_minmax(0,1fr)] items-center gap-2 rounded-md border border-afro-line px-2.5" key={label}>
                <span className={`${mutedTextClass} min-w-0 truncate`}>{label}</span>
                <strong className="min-w-0 truncate text-[13px]" dir="ltr">{value}</strong>
              </div>
            ))}
          </div>
        </section>
      </section>
    </section>
  );
}

function RouteIntelligencePanel({
  analytics,
  format,
  t,
}: {
  analytics: AdminRouteQualityAnalyticsResponse | null;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  const recommendations = analytics?.recommendations ?? [];
  const actionableRecommendations = recommendations.filter((item) => item.kind !== 'insufficientData');
  const meta = analytics
    ? t.settings.routeAnalyticsWindows(format.integer(analytics.windows.length))
    : t.settings.routeAnalyticsLearning;

  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.routeIntelligence} icon={Activity} meta={meta} />
      <div className="mt-2 grid gap-2">
        {actionableRecommendations.length === 0 ? (
          <EmptyState message={analytics ? t.settings.noRouteRecommendations : t.settings.routeAnalyticsLearning} />
        ) : null}
        {actionableRecommendations.map((recommendation) => (
          <div className="grid gap-1.5 rounded-md border border-afro-line px-2.5 py-2" key={routeRecommendationKey(recommendation)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <strong className="block truncate text-[13px]">
                  {routeRecommendationTitle(recommendation, t)}
                </strong>
                <span className="block truncate text-[12px] text-afro-muted">
                  {routeRecommendationDetail(recommendation, format, t)}
                </span>
              </div>
              <StatusBadge tone={recommendation.kind === 'degradedWindow' || recommendation.kind === 'upcomingDegradedWindow' ? 'warning' : 'good'}>
                {routeRecommendationConfidence(recommendation, t)}
              </StatusBadge>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[12px] md:grid-cols-4">
              <MetricPill
                icon={Clock}
                label={t.settings.routeWindow}
                value={formatRouteHourWindow(recommendation.hourOfDay ?? null, format)}
              />
              <MetricPill
                icon={Gauge}
                label={t.settings.averageScore}
                value={recommendation.averageScore === null || recommendation.averageScore === undefined ? '--' : format.integer(recommendation.averageScore)}
              />
              <MetricPill
                icon={Network}
                label={t.settings.routeOperator}
                value={routeRecommendationOperator(recommendation, format, t)}
              />
              <MetricPill
                icon={Route}
                label={t.settings.routeProfile}
                value={routeRecommendationProfile(recommendation, format, t)}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RouteDecisionPreviewPanel({
  eventDetail,
  events,
  preview,
  format,
  isApplying,
  isEventDetailLoading,
  isRecording,
  onApply,
  onInspectEvent,
  onRecord,
  t,
  switchExecution,
}: {
  eventDetail: AdminRouteDecisionEventDetail | null;
  events: AdminRouteDecisionEventSummary[];
  preview: AdminRouteDecisionPreviewResponse | null;
  format: DashboardFormatters;
  isApplying: boolean;
  isEventDetailLoading: boolean;
  isRecording: boolean;
  onApply: () => void;
  onInspectEvent: (eventId: string) => void;
  onRecord: () => void;
  switchExecution: AdminRouteDecisionSwitchExecutionSummary | null;
  t: DashboardStrings;
}) {
  const meta = preview
    ? t.settings.routeDecisionCandidates(format.integer(preview.healthyCandidateCount), format.integer(preview.candidateCount))
    : t.settings.routeDecisionAdvisory;
  const canApplyAssignment = Boolean(
    preview?.action === 'switchRecommended' &&
      preview.recommendedCandidate?.source === 'outbound' &&
      preview.autoRouteEnabled &&
      !preview.routeLocked,
  );

  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.routeDecision} icon={ShieldCheck} meta={meta} />
      {preview ? (
        <div className="mt-2 grid gap-2">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <RouteDecisionMetric label={t.settings.routeDecisionAction}>
              <StatusBadge tone={routeDecisionActionTone(preview.action)}>{routeDecisionActionLabel(preview.action, t)}</StatusBadge>
            </RouteDecisionMetric>
            <RouteDecisionMetric label={t.settings.routeDecisionScoreDelta}>
              {preview.scoreDelta === null || preview.scoreDelta === undefined ? '--' : format.integer(preview.scoreDelta)}
            </RouteDecisionMetric>
            <RouteDecisionMetric label={t.settings.routeDecisionHysteresis}>
              {format.integer(preview.hysteresisScoreDelta)}
            </RouteDecisionMetric>
            <RouteDecisionMetric label={t.settings.routeDecisionCooldown}>
              {preview.cooldownUntil ? format.time(new Date(preview.cooldownUntil)) : format.durationSeconds(preview.cooldownSeconds)}
            </RouteDecisionMetric>
          </div>

          <div className="grid gap-2 xl:grid-cols-2">
            <RouteDecisionCandidateCard candidate={preview.currentCandidate ?? null} format={format} label={t.settings.routeDecisionCurrent} t={t} />
            <RouteDecisionCandidateCard candidate={preview.recommendedCandidate ?? null} format={format} label={t.settings.routeDecisionRecommended} t={t} />
          </div>

          <RouteDecisionClientPreferenceCard preference={preview.clientRoutePreference ?? null} format={format} t={t} />
          <RouteDecisionProfileRecommendationList
            format={format}
            recommendations={preview.profileRecommendations ?? []}
            selectedProfile={preview.selectedScoreProfile ?? null}
            t={t}
          />
          <RouteDecisionLoadBalancingCard loadBalancing={preview.loadBalancing} format={format} t={t} />
          <RouteDecisionSessionSafetyCard sessionSafety={preview.sessionSafety} format={format} t={t} />
          <RouteDecisionSwitchEngineCard switchEngine={preview.switchEngine} format={format} t={t} />
          <RouteDecisionSwitchPreflightCard preflight={preview.switchPreflight} format={format} t={t} />
          <RouteDecisionSwitchRolloutCard
            evaluation={preview.switchRolloutEvaluation}
            rollout={preview.switchRollout}
            format={format}
            t={t}
          />
          <RouteDecisionSwitchOrchestrationCard orchestration={preview.switchOrchestration} format={format} t={t} />
          <RouteDecisionSwitchExecutionCard execution={switchExecution} format={format} t={t} />
          <RouteDecisionCandidateReviewList reviews={preview.candidateReviews ?? []} format={format} t={t} />
          <RouteDecisionApplyPlanCard plan={preview.applyPlan} t={t} />

          <div className="flex flex-wrap gap-1.5">
            {preview.reasonCodes.map((reason) => (
              <span className="rounded-md border border-afro-line bg-white px-2 py-1 text-[12px] font-bold text-afro-muted" key={reason}>
                {routeDecisionReasonLabel(reason, t)}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-afro-line bg-white px-3 text-[13px] font-bold text-afro-ink hover:border-afro-teal disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canApplyAssignment || isApplying}
              onClick={onApply}
              type="button"
            >
              <Route size={15} />
              {isApplying ? t.settings.applyingDecision : t.settings.applyDecisionAssignment}
            </button>
            <button
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-afro-line bg-white px-3 text-[13px] font-bold text-afro-ink hover:border-afro-teal disabled:cursor-wait disabled:opacity-60"
              disabled={isRecording}
              onClick={onRecord}
              type="button"
            >
              <Clock size={15} />
              {isRecording ? t.settings.recordingDecision : t.settings.recordDecisionEvent}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <EmptyState message={t.settings.routeDecisionNoPreview} />
        </div>
      )}
      <RouteDecisionEventList
        eventDetail={eventDetail}
        events={events}
        format={format}
        isDetailLoading={isEventDetailLoading}
        onInspectEvent={onInspectEvent}
        t={t}
      />
    </section>
  );
}

function RouteDecisionClientPreferenceCard({
  preference,
  format,
  t,
}: {
  preference: AdminRouteDecisionClientPreferenceSummary | null;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  if (!preference) return null;

  const preferredOutbound = preference.preferredOutboundName ?? preference.preferredOutboundId ?? '-';
  const preferredCountry = preference.preferredExitCountryCode ?? '-';
  const detectedCountry = preference.detectedCountryCode ?? '-';
  const targetAvailable =
    preference.mode === 'outbound'
      ? preference.preferredOutboundAvailable
      : preference.mode === 'country'
        ? preference.preferredCountryAvailable
        : true;

  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line bg-white p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <strong className="block text-[13px]">{t.settings.routeClientPreference}</strong>
          <span className={`${mutedTextClass} block truncate`}>
            {preference.assignmentKey}
          </span>
        </div>
        <span className="inline-flex flex-wrap justify-end gap-1">
          <StatusBadge tone={targetAvailable ? 'good' : 'warning'}>
            {targetAvailable ? t.settings.routeClientPreferenceAvailable : t.settings.routeClientPreferenceUnavailable}
          </StatusBadge>
          <StatusBadge tone={preference.stickySessionProtection ? 'good' : 'neutral'}>
            {preference.stickySessionProtection ? t.settings.routeClientPreferenceSticky : t.settings.routeClientPreferenceNoSticky}
          </StatusBadge>
        </span>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-5">
        <MetricPill icon={Route} label={t.settings.routeClientPreferenceMode} value={routeClientPreferenceModeLabel(preference.mode, t)} />
        <MetricPill icon={Network} label={t.settings.routeClientDetectedCountry} value={detectedCountry} />
        <MetricPill icon={Network} label={t.settings.routeClientPreferredCountry} value={preferredCountry} />
        <MetricPill icon={Route} label={t.settings.routeClientPreferredOutbound} value={preferredOutbound} />
        <MetricPill icon={Gauge} label={t.settings.routeClientPreferredMatches} value={format.integer(preference.preferredCountryCandidateCount)} />
      </div>

      <div className="flex flex-wrap gap-1">
        {preference.reasonCodes.slice(0, 6).map((reason) => (
          <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`client-route-pref-${reason}`}>
            {routeDecisionReasonLabel(reason, t)}
          </span>
        ))}
      </div>
    </div>
  );
}

function RouteDecisionProfileRecommendationList({
  recommendations,
  selectedProfile,
  format,
  t,
}: {
  recommendations: AdminRouteDecisionProfileRecommendation[];
  selectedProfile: string | null;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line bg-white p-2.5">
      <div className="flex items-center justify-between gap-2">
        <strong className="text-[13px]">{t.settings.profileRecommendations}</strong>
        <span className="text-[12px] font-bold text-afro-muted">
          {selectedProfile ? routeScoreProfileLabel(selectedProfile, t) : t.settings.unknownProfile}
        </span>
      </div>
      <div className="grid gap-1.5 md:grid-cols-2">
        {recommendations.length === 0 ? <EmptyState message={t.settings.noProfileRecommendations} /> : null}
        {recommendations.map((recommendation) => {
          const isSelected = recommendation.profile === selectedProfile;
          const delta = recommendation.scoreDeltaFromSelected > 0
            ? `+${format.integer(recommendation.scoreDeltaFromSelected)}`
            : format.integer(recommendation.scoreDeltaFromSelected);

          return (
            <div className="grid gap-1 rounded-md border border-afro-line px-2.5 py-2" key={recommendation.profile}>
              <div className="flex min-h-7 items-center justify-between gap-2">
                <div className="min-w-0">
                  <strong className="block truncate text-[13px]">{routeScoreProfileLabel(recommendation.profile, t)}</strong>
                  <span className={`${mutedTextClass} block truncate`}>
                    {recommendation.recommendedCandidateName ?? t.settings.noManagedRouteSelected}
                  </span>
                </div>
                <span className="inline-flex shrink-0 flex-wrap justify-end gap-1">
                  {isSelected ? <StatusBadge tone="neutral">{t.settings.selectedProfile}</StatusBadge> : null}
                  <StatusBadge tone={recommendation.scoreDeltaFromSelected >= 8 ? 'good' : 'neutral'}>
                    {format.integer(recommendation.score)}
                  </StatusBadge>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <MetricPill icon={ArrowDownUp} label={t.settings.routeDecisionCandidateDelta} value={delta} />
                <MetricPill icon={Route} label={t.settings.usableCandidates} value={format.integer(recommendation.candidateCount)} />
              </div>
              <div className="flex flex-wrap gap-1">
                {recommendation.reasonCodes.slice(0, 3).map((reason) => (
                  <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`${recommendation.profile}-${reason}`}>
                    {routeProfileRecommendationReasonLabel(reason, t)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RouteDecisionLoadBalancingCard({
  loadBalancing,
  format,
  t,
}: {
  loadBalancing?: AdminRouteDecisionLoadBalancingSummary;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  if (!loadBalancing) return null;

  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line bg-white p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <strong className="block text-[13px]">{t.settings.smartLoadBalancing}</strong>
          <span className={`${mutedTextClass} block truncate`}>
            {t.settings.loadBalancingEligible(format.integer(loadBalancing.eligibleCandidateCount), format.integer(loadBalancing.candidateCount))}
          </span>
        </div>
        <span className="inline-flex flex-wrap justify-end gap-1">
          <StatusBadge tone={routeLoadBalancingModeTone(loadBalancing.mode)}>
            {routeLoadBalancingModeLabel(loadBalancing.mode, t)}
          </StatusBadge>
          <StatusBadge tone="neutral">{routeLoadBalanceStrategyLabel(loadBalancing.strategy, t)}</StatusBadge>
        </span>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-3">
        <MetricPill
          icon={Route}
          label={t.settings.loadBalancingPrimary}
          value={loadBalancing.primaryCandidateName ?? t.settings.routeDecisionNoCandidate}
        />
        <MetricPill
          icon={ArrowDownUp}
          label={t.settings.loadBalancingSecondary}
          value={loadBalancing.secondaryCandidateName ?? t.settings.routeDecisionNoCandidate}
        />
        <MetricPill
          icon={Gauge}
          label={t.settings.loadBalancingTotalWeight}
          value={format.percent(loadBalancing.totalAssignedWeightPercent)}
        />
      </div>

      <div className="grid gap-1.5 md:grid-cols-2">
        {loadBalancing.candidates.length === 0 ? <EmptyState message={t.settings.loadBalancingNoCandidates} /> : null}
        {loadBalancing.candidates.map((candidate) => (
          <div className="grid gap-1 rounded-md border border-afro-line px-2.5 py-2" key={candidate.id}>
            <div className="flex min-h-7 items-center justify-between gap-2">
              <div className="min-w-0">
                <strong className="block truncate text-[13px]">{candidate.name}</strong>
                <span className={`${mutedTextClass} block truncate`}>
                  {routeLoadBalancingRoleLabel(candidate.role, t)}
                </span>
              </div>
              <StatusBadge tone={routeLoadBalancingRiskTone(candidate.riskLevel)}>
                {routeLoadBalancingRiskLabel(candidate.riskLevel, t)}
              </StatusBadge>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <MetricPill icon={ArrowDownUp} label={t.settings.loadBalancingWeight} value={format.percent(candidate.weightPercent)} />
              <MetricPill icon={Gauge} label={t.settings.loadBalancingAdjustedScore} value={format.integer(candidate.adjustedScore)} />
              <MetricPill icon={ShieldCheck} label={t.settings.loadBalancingProfileScore} value={format.integer(candidate.profileScore)} />
            </div>
            <div className="flex flex-wrap gap-1">
              {candidate.reasonCodes.slice(0, 4).map((reason) => (
                <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`${candidate.id}-${reason}`}>
                  {routeLoadBalancingReasonLabel(reason, t)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {loadBalancing.reasonCodes.slice(0, 8).map((reason) => (
          <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`load-balancing-${reason}`}>
            {routeLoadBalancingReasonLabel(reason, t)}
          </span>
        ))}
      </div>
    </div>
  );
}

function RouteDecisionSessionSafetyCard({
  sessionSafety,
  format,
  t,
}: {
  sessionSafety?: AdminRouteDecisionSessionSafetySummary;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  if (!sessionSafety) return null;

  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line bg-white p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <strong className="block text-[13px]">{t.settings.sessionSafety}</strong>
          <span className={`${mutedTextClass} block truncate`}>{routeSessionSafetyPolicyLabel(sessionSafety.policy, t)}</span>
        </div>
        <span className="inline-flex flex-wrap justify-end gap-1">
          <StatusBadge tone={routeSessionSafetyModeTone(sessionSafety.mode)}>
            {routeSessionSafetyModeLabel(sessionSafety.mode, t)}
          </StatusBadge>
          <StatusBadge tone={routeSessionSafetyRiskTone(sessionSafety.riskLevel)}>
            {routeSessionSafetyRiskLabel(sessionSafety.riskLevel, t)}
          </StatusBadge>
        </span>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-4">
        <MetricPill
          icon={LockKeyhole}
          label={t.settings.sessionSafetyStickyTtl}
          value={format.durationSeconds(sessionSafety.stickySessionTtlSeconds)}
        />
        <MetricPill
          icon={Clock}
          label={t.settings.sessionSafetyDrain}
          value={format.durationSeconds(sessionSafety.estimatedDrainSeconds)}
        />
        <MetricPill
          icon={Route}
          label={t.settings.sessionSafetyNewSessions}
          value={sessionSafety.switchNewSessionsOnly ? t.settings.sessionSafetyYes : t.settings.sessionSafetyNo}
        />
        <MetricPill
          icon={AlertTriangle}
          label={t.settings.sessionSafetyEmergency}
          value={sessionSafety.emergencySwitchAllowed ? t.settings.sessionSafetyYes : t.settings.sessionSafetyNo}
        />
      </div>

      <div className="flex flex-wrap gap-1">
        {sessionSafety.reasonCodes.slice(0, 8).map((reason) => (
          <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`session-safety-${reason}`}>
            {routeSessionSafetyReasonLabel(reason, t)}
          </span>
        ))}
      </div>
    </div>
  );
}

function RouteDecisionSwitchEngineCard({
  switchEngine,
  format,
  t,
}: {
  switchEngine?: AdminRouteDecisionSwitchEngineSummary;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  if (!switchEngine) return null;

  const visibleSteps = switchEngine.steps.slice(0, 8);

  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line bg-white p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <strong className="block text-[13px]">{t.settings.switchEngine}</strong>
          <span className={`${mutedTextClass} block truncate`}>{routeSwitchEngineModeLabel(switchEngine.mode, t)}</span>
        </div>
        <span className="inline-flex flex-wrap justify-end gap-1">
          <StatusBadge tone={routeSwitchEngineStatusTone(switchEngine.status)}>
            {routeSwitchEngineStatusLabel(switchEngine.status, t)}
          </StatusBadge>
          <StatusBadge tone={switchEngine.dataPlaneReady ? 'good' : 'neutral'}>
            {switchEngine.dataPlaneReady ? t.settings.routeApplyDataPlaneReady : t.settings.routeApplyDataPlaneOff}
          </StatusBadge>
        </span>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-4">
        <MetricPill
          icon={LockKeyhole}
          label={t.settings.switchEnginePreserveExisting}
          value={switchEngine.preserveExistingSessions ? t.settings.sessionSafetyYes : t.settings.sessionSafetyNo}
        />
        <MetricPill
          icon={Route}
          label={t.settings.switchEngineNewSessions}
          value={switchEngine.switchNewSessionsOnly ? t.settings.sessionSafetyYes : t.settings.sessionSafetyNo}
        />
        <MetricPill
          icon={Clock}
          label={t.settings.switchEngineEstimated}
          value={format.durationSeconds(switchEngine.estimatedTotalSeconds)}
        />
        <MetricPill
          icon={ShieldCheck}
          label={t.settings.switchEngineRollback}
          value={switchEngine.rollbackReady ? t.settings.sessionSafetyYes : t.settings.sessionSafetyNo}
        />
      </div>

      <div className="grid gap-1.5 md:grid-cols-2">
        {visibleSteps.map((step) => (
          <div className="grid gap-1 rounded-md border border-afro-line px-2.5 py-2" key={step.id}>
            <div className="flex min-h-7 items-center justify-between gap-2">
              <div className="min-w-0">
                <strong className="block truncate text-[13px]">{routeSwitchEngineStepLabel(step.code, t)}</strong>
                <span className={`${mutedTextClass} block truncate`}>
                  {routeSwitchEngineSessionImpactLabel(step.sessionImpact, t)}
                </span>
              </div>
              <StatusBadge tone={routeSwitchEngineStepStatusTone(step.status)}>
                {routeSwitchEngineStepStatusLabel(step.status, t)}
              </StatusBadge>
            </div>
            <div className="flex flex-wrap gap-1">
              <StatusBadge tone={step.dataPlaneMutation ? 'warning' : 'neutral'}>
                {step.dataPlaneMutation ? t.settings.routeApplyDataPlaneStep : t.settings.routeApplyControlPlaneStep}
              </StatusBadge>
              <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted">
                {format.durationSeconds(step.estimatedSeconds ?? 0)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {switchEngine.reasonCodes.slice(0, 8).map((reason) => (
          <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`switch-engine-${reason}`}>
            {routeSwitchEngineReasonLabel(reason, t)}
          </span>
        ))}
      </div>
    </div>
  );
}

function RouteDecisionSwitchPreflightCard({
  preflight,
  format,
  t,
}: {
  preflight?: AdminRouteDecisionSwitchPreflightSummary | null;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  if (!preflight) return null;

  const visibleChecks = preflight.checks.slice(0, 8);

  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line bg-white p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <strong className="block text-[13px]">{t.settings.switchPreflight}</strong>
          <span className={`${mutedTextClass} block truncate`}>{t.settings.switchPreflightChecks(format.integer(preflight.checkCount))}</span>
        </div>
        <span className="inline-flex flex-wrap justify-end gap-1">
          <StatusBadge tone={routeSwitchPreflightStatusTone(preflight.status)}>
            {routeSwitchPreflightStatusLabel(preflight.status, t)}
          </StatusBadge>
          <StatusBadge tone={preflight.canExecuteDataPlane ? 'good' : 'neutral'}>
            {preflight.canExecuteDataPlane ? t.settings.routeApplyDataPlaneReady : t.settings.routeApplyDataPlaneOff}
          </StatusBadge>
        </span>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-4">
        <MetricPill
          icon={Network}
          label={t.settings.routeApplyDataPlaneReady}
          value={preflight.dataPlaneReady ? t.settings.sessionSafetyYes : t.settings.sessionSafetyNo}
        />
        <MetricPill
          icon={ShieldCheck}
          label={t.settings.switchPreflightSafeToArm}
          value={preflight.safeToArm ? t.settings.sessionSafetyYes : t.settings.sessionSafetyNo}
        />
        <MetricPill icon={AlertTriangle} label={t.settings.switchPreflightFailed} value={format.integer(preflight.failedCheckCount)} />
        <MetricPill icon={Clock} label={t.settings.switchPreflightFuture} value={format.integer(preflight.futureCheckCount)} />
      </div>

      <div className="grid gap-1.5 md:grid-cols-2">
        {visibleChecks.map((check) => (
          <div className="grid gap-1 rounded-md border border-afro-line px-2.5 py-2" key={check.id}>
            <div className="flex min-h-7 items-center justify-between gap-2">
              <div className="min-w-0">
                <strong className="block truncate text-[13px]">{routeSwitchPreflightCheckLabel(check.code, t)}</strong>
                <span className={`${mutedTextClass} block truncate`}>
                  {check.dataPlaneMutation ? t.settings.routeApplyDataPlaneStep : t.settings.routeApplyControlPlaneStep}
                </span>
              </div>
              <StatusBadge tone={routeSwitchPreflightCheckStatusTone(check.status)}>
                {routeSwitchPreflightCheckStatusLabel(check.status, t)}
              </StatusBadge>
            </div>
            <div className="flex flex-wrap gap-1">
              {check.estimatedSeconds !== null && check.estimatedSeconds !== undefined ? (
                <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted">
                  {format.durationSeconds(check.estimatedSeconds)}
                </span>
              ) : null}
              {check.reasonCodes.slice(0, 3).map((reason) => (
                <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`${check.id}-${reason}`}>
                  {routeSwitchPreflightReasonLabel(reason, t)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {preflight.reasonCodes.slice(0, 8).map((reason) => (
          <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`switch-preflight-${reason}`}>
            {routeSwitchPreflightReasonLabel(reason, t)}
          </span>
        ))}
      </div>
    </div>
  );
}

function RouteDecisionSwitchRolloutCard({
  evaluation,
  rollout,
  format,
  t,
}: {
  evaluation?: AdminRouteDecisionSwitchRolloutEvaluationSummary | null;
  rollout?: AdminRouteDecisionSwitchRolloutSummary | null;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  if (!rollout) return null;

  const visibleSteps = rollout.steps.slice(0, 7);

  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line bg-white p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <strong className="block text-[13px]">{t.settings.switchRollout}</strong>
          <span className={`${mutedTextClass} block truncate`}>{routeSwitchRolloutStrategyLabel(rollout.strategy, t)}</span>
        </div>
        <span className="inline-flex flex-wrap justify-end gap-1">
          <StatusBadge tone={routeSwitchRolloutStatusTone(rollout.status)}>
            {routeSwitchRolloutStatusLabel(rollout.status, t)}
          </StatusBadge>
          <StatusBadge tone={rollout.dataPlaneReady ? 'good' : 'neutral'}>
            {rollout.dataPlaneReady ? t.settings.routeApplyDataPlaneReady : t.settings.routeApplyDataPlaneOff}
          </StatusBadge>
        </span>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-4">
        <MetricPill icon={Gauge} label={t.settings.switchRolloutInitial} value={format.percent(rollout.initialPercent)} />
        <MetricPill icon={Route} label={t.settings.switchRolloutMax} value={format.percent(rollout.maxPercent)} />
        <MetricPill icon={Clock} label={t.settings.switchRolloutCanaryDuration} value={format.durationSeconds(rollout.canaryDurationSeconds)} />
        <MetricPill icon={LockKeyhole} label={t.settings.switchRolloutHold} value={format.durationSeconds(rollout.routeConsistencyHoldSeconds)} />
      </div>

      <div className="grid gap-1.5 sm:grid-cols-3">
        <MetricPill icon={AlertTriangle} label={t.settings.switchRolloutLossGuard} value={format.packetLoss(rollout.rollbackOnLossPercent)} />
        <MetricPill icon={Activity} label={t.settings.switchRolloutJitterGuard} value={format.latency(rollout.rollbackOnJitterMs)} />
        <MetricPill icon={Clock} label={t.settings.switchRolloutLatencyGuard} value={format.latency(rollout.rollbackOnLatencyMs)} />
      </div>

      {evaluation ? (
        <div className="grid gap-1.5 rounded-md border border-afro-line bg-afro-soft/60 p-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <strong className="block text-[13px]">{t.settings.switchRolloutEvaluation}</strong>
              <span className={`${mutedTextClass} block truncate`}>
                {routeSwitchRolloutEvaluationActionLabel(evaluation.recommendedAction, t)}
              </span>
            </div>
            <span className="inline-flex flex-wrap justify-end gap-1">
              <StatusBadge tone={routeSwitchRolloutEvaluationStatusTone(evaluation.status)}>
                {routeSwitchRolloutEvaluationStatusLabel(evaluation.status, t)}
              </StatusBadge>
              <StatusBadge tone={evaluation.guardPassed ? 'good' : 'neutral'}>
                {evaluation.guardPassed ? t.settings.switchRolloutGuardPassed : t.settings.switchRolloutGuardPending}
              </StatusBadge>
            </span>
          </div>

          <div className="grid gap-1.5 sm:grid-cols-4">
            <MetricPill icon={Gauge} label={t.settings.switchRolloutCanary} value={format.percent(evaluation.canaryPercent)} />
            <MetricPill icon={ArrowDownUp} label={t.settings.switchRolloutNext} value={format.percent(evaluation.nextPercent)} />
            <MetricPill icon={LockKeyhole} label={t.settings.switchRolloutHoldRemaining} value={format.durationSeconds(evaluation.holdSecondsRemaining)} />
            <MetricPill icon={ShieldCheck} label={t.settings.switchRolloutObservedScore} value={format.percent(evaluation.observedScore ?? null)} />
          </div>

          <div className="grid gap-1.5 sm:grid-cols-3">
            <MetricPill icon={AlertTriangle} label={t.settings.switchRolloutObservedLoss} value={format.packetLoss(evaluation.observedLossPercent ?? null)} />
            <MetricPill icon={Activity} label={t.settings.switchRolloutObservedJitter} value={format.latency(evaluation.observedJitterMs ?? null)} />
            <MetricPill icon={Clock} label={t.settings.switchRolloutObservedLatency} value={format.latency(evaluation.observedLatencyMs ?? null)} />
          </div>

          <div className="flex flex-wrap gap-1">
            {evaluation.reasonCodes.slice(0, 8).map((reason) => (
              <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`switch-rollout-eval-${reason}`}>
                {routeSwitchRolloutEvaluationReasonLabel(reason, t)}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-1.5 md:grid-cols-2">
        {visibleSteps.map((step) => (
          <div className="grid gap-1 rounded-md border border-afro-line px-2.5 py-2" key={step.id}>
            <div className="flex min-h-7 items-center justify-between gap-2">
              <div className="min-w-0">
                <strong className="block truncate text-[13px]">{routeSwitchRolloutStepLabel(step.code, t)}</strong>
                <span className={`${mutedTextClass} block truncate`}>
                  {routeSwitchRolloutTrafficScopeLabel(step.trafficScope, t)} / {format.percent(step.targetPercent)}
                </span>
              </div>
              <StatusBadge tone={routeSwitchRolloutStepStatusTone(step.status)}>
                {routeSwitchRolloutStepStatusLabel(step.status, t)}
              </StatusBadge>
            </div>
            <div className="flex flex-wrap gap-1">
              <StatusBadge tone={step.dataPlaneMutation ? 'warning' : 'neutral'}>
                {step.dataPlaneMutation ? t.settings.routeApplyDataPlaneStep : t.settings.routeApplyControlPlaneStep}
              </StatusBadge>
              {step.durationSeconds !== null && step.durationSeconds !== undefined ? (
                <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted">
                  {format.durationSeconds(step.durationSeconds)}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {rollout.reasonCodes.slice(0, 8).map((reason) => (
          <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`switch-rollout-${reason}`}>
            {routeSwitchRolloutReasonLabel(reason, t)}
          </span>
        ))}
      </div>
    </div>
  );
}

function RouteDecisionSwitchOrchestrationCard({
  orchestration,
  format,
  t,
}: {
  orchestration?: AdminRouteDecisionSwitchOrchestrationSummary | null;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  if (!orchestration) return null;

  const visibleStages = orchestration.stages.slice(0, 8);

  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line bg-white p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <strong className="block text-[13px]">{t.settings.switchOrchestration}</strong>
          <span className={`${mutedTextClass} block truncate`}>
            {routeSwitchOrchestrationActionLabel(orchestration.recommendedAction, t)}
          </span>
        </div>
        <span className="inline-flex flex-wrap justify-end gap-1">
          <StatusBadge tone={routeSwitchOrchestrationStatusTone(orchestration.status)}>
            {routeSwitchOrchestrationStatusLabel(orchestration.status, t)}
          </StatusBadge>
          <StatusBadge tone={orchestration.activeSessionsProtected ? 'good' : orchestration.activeSessionsMayMove ? 'critical' : 'neutral'}>
            {orchestration.activeSessionsProtected
              ? t.settings.switchOrchestrationSessionsProtected
              : orchestration.activeSessionsMayMove
                ? t.settings.switchOrchestrationSessionsMayMove
                : t.settings.switchOrchestrationNoSessionMove}
          </StatusBadge>
        </span>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-4">
        <MetricPill icon={ShieldCheck} label={t.settings.switchOrchestrationPhase} value={routeSwitchOrchestrationPhaseLabel(orchestration.phase, t)} />
        <MetricPill icon={Network} label={t.settings.switchOrchestrationExecutable} value={orchestration.canExecuteDataPlane ? t.settings.sessionSafetyYes : t.settings.sessionSafetyNo} />
        <MetricPill icon={Gauge} label={t.settings.switchOrchestrationCanary} value={format.percent(orchestration.canaryPercent)} />
        <MetricPill icon={ArrowDownUp} label={t.settings.switchOrchestrationNext} value={format.percent(orchestration.nextPercent)} />
      </div>

      <div className="grid gap-1.5 sm:grid-cols-4">
        <MetricPill icon={Clock} label={t.settings.switchOrchestrationHold} value={format.durationSeconds(orchestration.holdSecondsRemaining)} />
        <MetricPill icon={LockKeyhole} label={t.settings.switchOrchestrationSticky} value={orchestration.preserveExistingSessions ? t.settings.sessionSafetyYes : t.settings.sessionSafetyNo} />
        <MetricPill icon={Route} label={t.settings.switchOrchestrationNewOnly} value={orchestration.switchNewSessionsOnly ? t.settings.sessionSafetyYes : t.settings.sessionSafetyNo} />
        <MetricPill icon={AlertTriangle} label={t.settings.switchOrchestrationRollback} value={orchestration.rollbackRequired ? t.settings.sessionSafetyYes : t.settings.sessionSafetyNo} />
      </div>

      <div className="grid gap-1.5 md:grid-cols-2">
        {visibleStages.map((stage) => (
          <div className="grid gap-1 rounded-md border border-afro-line px-2.5 py-2" key={stage.id}>
            <div className="flex min-h-7 items-center justify-between gap-2">
              <div className="min-w-0">
                <strong className="block truncate text-[13px]">{routeSwitchOrchestrationStageLabel(stage.code, t)}</strong>
                <span className={`${mutedTextClass} block truncate`}>
                  {routeSwitchRolloutTrafficScopeLabel(stage.trafficScope, t)} / {routeSwitchEngineSessionImpactLabel(stage.sessionImpact, t)}
                </span>
              </div>
              <StatusBadge tone={routeSwitchOrchestrationStageStatusTone(stage.status)}>
                {routeSwitchOrchestrationStageStatusLabel(stage.status, t)}
              </StatusBadge>
            </div>
            <div className="flex flex-wrap gap-1">
              <StatusBadge tone={stage.dataPlaneMutation ? 'warning' : 'neutral'}>
                {stage.dataPlaneMutation ? t.settings.routeApplyDataPlaneStep : t.settings.routeApplyControlPlaneStep}
              </StatusBadge>
              <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted">
                {format.percent(stage.targetPercent)}
              </span>
              {stage.estimatedSeconds !== null && stage.estimatedSeconds !== undefined ? (
                <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted">
                  {format.durationSeconds(stage.estimatedSeconds)}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {orchestration.reasonCodes.slice(0, 8).map((reason) => (
          <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`switch-orchestration-${reason}`}>
            {routeSwitchOrchestrationReasonLabel(reason, t)}
          </span>
        ))}
      </div>
    </div>
  );
}

function RouteDecisionSwitchExecutionCard({
  execution,
  format,
  t,
}: {
  execution?: AdminRouteDecisionSwitchExecutionSummary | null;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  if (!execution) return null;

  const timeOrDash = (value?: string | null) => (value ? format.time(new Date(value)) : '-');

  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line bg-white p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <strong className="block text-[13px]">{t.settings.switchExecution}</strong>
          <span className={`${mutedTextClass} block truncate`}>{routeSwitchExecutionPhaseLabel(execution.phase, t)}</span>
        </div>
        <span className="inline-flex flex-wrap justify-end gap-1">
          <StatusBadge tone={routeSwitchExecutionStatusTone(execution.status)}>
            {routeSwitchExecutionStatusLabel(execution.status, t)}
          </StatusBadge>
          <StatusBadge tone={execution.dataPlaneApplied ? 'good' : 'neutral'}>
            {execution.dataPlaneApplied ? t.settings.routeApplyDataPlaneReady : t.settings.routeApplyDataPlaneOff}
          </StatusBadge>
        </span>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-3 xl:grid-cols-6">
        <MetricPill
          icon={ShieldCheck}
          label={t.settings.switchExecutionAssignment}
          value={execution.assignmentApplied ? t.settings.sessionSafetyYes : t.settings.sessionSafetyNo}
        />
        <MetricPill
          icon={Network}
          label={t.settings.switchExecutionDataPlane}
          value={execution.dataPlaneApplied ? t.settings.sessionSafetyYes : t.settings.sessionSafetyNo}
        />
        <MetricPill icon={LockKeyhole} label={t.settings.switchExecutionStickyUntil} value={timeOrDash(execution.stickyUntil)} />
        <MetricPill icon={Clock} label={t.settings.switchExecutionDrainUntil} value={timeOrDash(execution.drainUntil)} />
        <MetricPill icon={Gauge} label={t.settings.switchExecutionCooldownUntil} value={timeOrDash(execution.cooldownUntil)} />
        <MetricPill icon={Route} label={t.settings.switchExecutionFutureSteps} value={format.integer(execution.futureStepIds.length)} />
      </div>

      <div className="flex flex-wrap gap-1">
        {execution.reasonCodes.slice(0, 8).map((reason) => (
          <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`switch-execution-${reason}`}>
            {routeSwitchExecutionReasonLabel(reason, t)}
          </span>
        ))}
      </div>
    </div>
  );
}

function RouteDecisionCandidateReviewList({
  reviews,
  format,
  t,
}: {
  reviews: AdminRouteDecisionCandidateReviewSummary[];
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line bg-white p-2.5">
      <div className="flex items-center justify-between gap-2">
        <strong className="text-[13px]">{t.settings.candidateReview}</strong>
        <span className="text-[12px] font-bold text-afro-muted">{t.settings.candidateReviewCount(format.integer(reviews.length))}</span>
      </div>
      <div className="grid gap-1.5">
        {reviews.length === 0 ? <EmptyState message={t.settings.noCandidateReview} /> : null}
        {reviews.map((review) => (
          <RouteDecisionCandidateReviewRow format={format} key={review.id} review={review} t={t} />
        ))}
      </div>
    </div>
  );
}

function RouteDecisionApplyPlanCard({
  plan,
  t,
}: {
  plan?: AdminRouteDecisionApplyPlanSummary;
  t: DashboardStrings;
}) {
  if (!plan) return null;

  const visibleSteps = plan.steps.slice(0, 8);

  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line bg-white p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-[13px]">{t.settings.routeApplyPlan}</strong>
        <span className="inline-flex flex-wrap justify-end gap-1">
          <StatusBadge tone={routeApplyPlanStatusTone(plan.status)}>{routeApplyPlanStatusLabel(plan.status, t)}</StatusBadge>
          <StatusBadge tone={plan.dataPlaneReady ? 'good' : 'neutral'}>
            {plan.dataPlaneReady ? t.settings.routeApplyDataPlaneReady : t.settings.routeApplyDataPlaneOff}
          </StatusBadge>
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {plan.guardReasonCodes.slice(0, 6).map((reason) => (
          <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`apply-plan-${reason}`}>
            {routeDecisionReasonLabel(reason, t)}
          </span>
        ))}
      </div>

      <RouteDecisionApplyAdapterCard adapter={plan.adapter} t={t} />

      <div className="grid gap-1.5 md:grid-cols-2">
        {visibleSteps.map((step) => (
          <RouteDecisionApplyPlanStepRow key={step.id} step={step} t={t} />
        ))}
      </div>
    </div>
  );
}

function RouteDecisionApplyAdapterCard({
  adapter,
  t,
}: {
  adapter: AdminRouteDecisionApplyAdapterSummary;
  t: DashboardStrings;
}) {
  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line px-2.5 py-1.5">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <strong className="block truncate text-[12px]">{t.settings.routeApplyAdapter}</strong>
          <span className={`${mutedTextClass} block truncate`}>
            {adapter.label} / {adapter.outboundType ?? '-'}
          </span>
        </div>
        <span className="inline-flex flex-wrap justify-end gap-1">
          <StatusBadge tone={routeApplyAdapterStatusTone(adapter.status)}>
            {routeApplyAdapterStatusLabel(adapter.status, t)}
          </StatusBadge>
          <StatusBadge tone={adapter.enabled ? 'good' : 'neutral'}>
            {adapter.enabled ? t.settings.routeApplyAdapterEnabled : t.settings.routeApplyAdapterDisabled}
          </StatusBadge>
        </span>
      </div>

      {adapter.dryRunCommands.length > 0 ? (
        <div className="grid gap-1">
          <strong className="text-[12px] text-afro-muted">{t.settings.routeApplyDryRunCommands}</strong>
          {adapter.dryRunCommands.slice(0, 5).map((item) => (
            <div className="grid gap-1 rounded border border-afro-line px-2 py-1" key={item.id}>
              <code className="min-w-0 truncate text-[11px] font-bold text-afro-ink" dir="ltr">{item.command}</code>
              <span className="flex flex-wrap gap-1">
                <StatusBadge tone={item.dataPlaneMutation ? 'warning' : 'neutral'}>
                  {item.dataPlaneMutation ? t.settings.routeApplyDataPlaneStep : t.settings.routeApplyControlPlaneStep}
                </StatusBadge>
                <StatusBadge tone={item.requiresRoot ? 'warning' : 'neutral'}>
                  {item.requiresRoot ? t.settings.routeApplyRootCommand : t.settings.routeApplyUserCommand}
                </StatusBadge>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {adapter.dryRunConfigChanges.length > 0 ? (
        <div className="grid gap-1">
          <strong className="text-[12px] text-afro-muted">{t.settings.routeApplyConfigChanges}</strong>
          {adapter.dryRunConfigChanges.slice(0, 3).map((item) => (
            <div className="grid gap-0.5 rounded border border-afro-line px-2 py-1" key={item.id}>
              <code className="min-w-0 truncate text-[11px] font-bold text-afro-ink" dir="ltr">{item.filePath}</code>
              <span className={`${mutedTextClass} min-w-0 truncate`}>{item.description}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RouteDecisionApplyPlanStepRow({
  step,
  t,
}: {
  step: AdminRouteDecisionApplyPlanStep;
  t: DashboardStrings;
}) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-2 rounded-md border border-afro-line px-2 py-1">
      <span className="min-w-0 truncate text-[12px] font-bold text-afro-ink">{routeApplyPlanStepLabel(step.code, t)}</span>
      <StatusBadge tone={step.dataPlaneMutation ? 'warning' : 'neutral'}>
        {step.dataPlaneMutation ? t.settings.routeApplyDataPlaneStep : t.settings.routeApplyControlPlaneStep}
      </StatusBadge>
    </div>
  );
}

function RouteDecisionCandidateReviewRow({
  review,
  format,
  t,
}: {
  review: AdminRouteDecisionCandidateReviewSummary;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  const scoreDelta =
    review.scoreDeltaFromCurrent === null || review.scoreDeltaFromCurrent === undefined ? '--' : format.integer(review.scoreDeltaFromCurrent);
  const reasonCodes = review.reviewReasonCodes.slice(0, 5);
  const scoreReasons = review.scoreReasons?.slice(0, 3) ?? [];

  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <strong className="block truncate text-[13px]">{format.label(review.name)}</strong>
          <span className={`${mutedTextClass} block truncate`}>
            {routeDecisionCandidateSourceLabel(review, t)} / {String(review.selectedScoreProfile ?? '-').toUpperCase()}
            {review.serverCountry ? ` / ${review.serverCountry}` : ''}
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          <StatusBadge tone={routeDecisionDispositionTone(review.disposition)}>
            {routeDecisionDispositionLabel(review.disposition, t)}
          </StatusBadge>
          <StatusBadge tone={getWireGuardScoreTone(review.score)}>{format.integer(review.score)}</StatusBadge>
        </div>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-3 xl:grid-cols-6">
        <MetricPill icon={Clock} label={t.settings.latency} value={format.latency(review.latencyMs ?? null)} />
        <MetricPill icon={Activity} label={t.settings.jitter} value={format.latency(review.jitterMs ?? null)} />
        <MetricPill icon={AlertTriangle} label={t.settings.packetLoss} value={format.packetLoss(review.packetLossPercent ?? null)} />
        <MetricPill icon={Gauge} label={t.settings.loadedLatency} value={formatLoadedLatency(review, format, t)} />
        <MetricPill icon={Network} label={t.settings.mtu} value={formatMtuRecommendation(review, format, t)} />
        <MetricPill icon={ArrowDownUp} label={t.settings.routeDecisionCandidateDelta} value={scoreDelta} />
      </div>

      <div className="flex flex-wrap gap-1">
        {reasonCodes.map((reason) => (
          <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`${review.id}-${reason}`}>
            {routeDecisionReasonLabel(reason, t)}
          </span>
        ))}
        {scoreReasons.map((reason, index) => (
          <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`${review.id}-score-${reason.code}-${index}`}>
            {routeScoreReasonLabel(reason.code, t)} {format.integer(reason.impact)}
          </span>
        ))}
      </div>
    </div>
  );
}

function RouteDecisionEventList({
  eventDetail,
  events,
  format,
  isDetailLoading,
  onInspectEvent,
  t,
}: {
  eventDetail: AdminRouteDecisionEventDetail | null;
  events: AdminRouteDecisionEventSummary[];
  format: DashboardFormatters;
  isDetailLoading: boolean;
  onInspectEvent: (eventId: string) => void;
  t: DashboardStrings;
}) {
  return (
    <div className="mt-3 border-t border-afro-line pt-2">
      <div className="mb-1.5 text-[13px] font-bold text-afro-muted">{t.settings.recentDecisionEvents}</div>
      <div className="grid gap-1.5">
        {events.length === 0 ? <EmptyState message={t.settings.noDecisionEvents} /> : null}
        {events.map((event) => {
          const fromName = event.fromOutboundName ?? event.fromOutboundId ?? '-';
          const toName = event.toOutboundName ?? event.toOutboundId ?? '-';
          const isSelected = eventDetail?.id === event.id;

          return (
            <div
              className={`grid gap-1 rounded-md border px-2.5 py-2 ${isSelected ? 'border-afro-teal bg-afro-surface' : 'border-afro-line bg-white'}`}
              key={event.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="min-w-0 truncate text-[13px]">
                  {t.settings.decisionEventRoute(format.label(fromName), format.label(toName))}
                </strong>
                <span className="inline-flex shrink-0 flex-wrap items-center justify-end gap-1">
                  <StatusBadge tone={routeDecisionActionToneForState(event.decisionState)}>
                    {routeDecisionStateLabel(event.decisionState, t)}
                  </StatusBadge>
                  <button
                    className="inline-flex min-h-7 items-center justify-center gap-1 rounded-md border border-afro-line bg-white px-2 text-[11px] font-bold text-afro-ink hover:border-afro-teal disabled:cursor-wait disabled:opacity-60"
                    disabled={isDetailLoading}
                    onClick={() => onInspectEvent(event.id)}
                    type="button"
                  >
                    <Eye size={13} />
                    {isDetailLoading ? t.settings.loadingDecisionEvent : t.settings.inspectDecisionEvent}
                  </button>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-bold text-afro-muted">
                <span>{format.time(new Date(event.createdAt))}</span>
                <span>{event.scoreDelta === null || event.scoreDelta === undefined ? '--' : format.integer(event.scoreDelta)}</span>
                <span>{String(event.scoreProfile ?? '-').toUpperCase()}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {event.reasonCodes.slice(0, 4).map((reason) => (
                  <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`${event.id}-${reason}`}>
                    {routeDecisionReasonLabel(reason, t)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {eventDetail ? <RouteDecisionEventDetailCard detail={eventDetail} format={format} t={t} /> : null}
    </div>
  );
}

function RouteDecisionEventDetailCard({
  detail,
  format,
  t,
}: {
  detail: AdminRouteDecisionEventDetail;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  const snapshot = detail.dryRunSnapshot ?? null;

  return (
    <div className="mt-2 grid gap-2 rounded-md border border-afro-line bg-white p-2.5">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <strong className="block truncate text-[13px]">{t.settings.decisionEventContext}</strong>
          <span className={`${mutedTextClass} block truncate`}>{format.time(new Date(detail.createdAt))}</span>
        </div>
        <StatusBadge tone={routeDecisionActionToneForState(detail.decisionState)}>
          {routeDecisionStateLabel(detail.decisionState, t)}
        </StatusBadge>
      </div>

      <RouteDecisionSwitchPreflightCard preflight={detail.switchPreflight} format={format} t={t} />
      <RouteDecisionSwitchRolloutCard
        evaluation={detail.switchRolloutEvaluation}
        rollout={detail.switchRollout}
        format={format}
        t={t}
      />
      <RouteDecisionSwitchOrchestrationCard orchestration={detail.switchOrchestration} format={format} t={t} />
      <RouteDecisionSwitchExecutionCard execution={detail.switchExecution} format={format} t={t} />

      {snapshot ? (
        <>
          <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
            <MetricPill
              icon={ShieldCheck}
              label={t.settings.dryRunSnapshot}
              value={snapshot.secretSafe ? t.settings.decisionEventSecretSafe : t.settings.decisionEventSecretUnsafe}
            />
            <MetricPill
              icon={Route}
              label={t.settings.routeApplyAdapter}
              value={`${snapshot.adapterId || '-'} / ${routeApplyAdapterStatusLabel(snapshot.adapterStatus, t)}`}
            />
            <MetricPill
              icon={SettingsIcon}
              label={t.settings.routeApplyDryRunCommands}
              value={t.settings.dryRunCommandsCount(format.integer(snapshot.commandCount))}
            />
            <MetricPill
              icon={Network}
              label={t.settings.routeApplyConfigChanges}
              value={t.settings.dryRunConfigChangesCount(format.integer(snapshot.configChangeCount))}
            />
          </div>

          {snapshot.commands.length > 0 ? (
            <div className="grid gap-1">
              <strong className="text-[12px] text-afro-muted">{t.settings.routeApplyDryRunCommands}</strong>
              {snapshot.commands.slice(0, 5).map((item) => (
                <div className="grid gap-1 rounded border border-afro-line px-2 py-1" key={item.id}>
                  <code className="min-w-0 truncate text-[11px] font-bold text-afro-ink" dir="ltr">{item.command}</code>
                  <span className="flex flex-wrap gap-1">
                    <StatusBadge tone={item.dataPlaneMutation ? 'warning' : 'neutral'}>
                      {item.dataPlaneMutation ? t.settings.routeApplyDataPlaneStep : t.settings.routeApplyControlPlaneStep}
                    </StatusBadge>
                    <StatusBadge tone={item.requiresRoot ? 'warning' : 'neutral'}>
                      {item.requiresRoot ? t.settings.routeApplyRootCommand : t.settings.routeApplyUserCommand}
                    </StatusBadge>
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {snapshot.configChanges.length > 0 ? (
            <div className="grid gap-1">
              <strong className="text-[12px] text-afro-muted">{t.settings.routeApplyConfigChanges}</strong>
              {snapshot.configChanges.slice(0, 3).map((item) => (
                <div className="grid gap-0.5 rounded border border-afro-line px-2 py-1" key={item.id}>
                  <code className="min-w-0 truncate text-[11px] font-bold text-afro-ink" dir="ltr">{item.filePath}</code>
                  <span className={`${mutedTextClass} min-w-0 truncate`}>{item.description}</span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState message={t.settings.noDryRunSnapshot} />
      )}
    </div>
  );
}

function RouteDecisionMetric({ children, label }: { children: ReactNode; label: string }) {
  const valueTooltip = primitiveTooltip(children);
  const metricTooltip = valueTooltip ? `${label} ${valueTooltip}` : label;

  return (
    <div className="flex min-h-10 items-center justify-between gap-2 rounded-md border border-afro-line bg-white px-2.5" title={metricTooltip}>
      <span className={`${mutedTextClass} min-w-0 truncate`} title={label}>{label}</span>
      <strong className="min-w-0 truncate text-[13px]" title={valueTooltip}>{children}</strong>
    </div>
  );
}

function RouteDecisionCandidateCard({
  candidate,
  format,
  label,
  t,
}: {
  candidate: AdminRouteDecisionCandidateSummary | null;
  format: DashboardFormatters;
  label: string;
  t: DashboardStrings;
}) {
  if (!candidate) {
    return (
      <div className="rounded-md border border-dashed border-afro-line px-2.5 py-2">
        <div className="text-[12px] font-bold uppercase text-afro-muted">{label}</div>
        <div className="mt-1 text-[13px] font-bold text-afro-muted">{t.settings.routeDecisionNoCandidate}</div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-afro-line px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[12px] font-bold uppercase text-afro-muted">{label}</div>
          <strong className="block truncate text-[13px]">{format.label(candidate.name)}</strong>
          <span className={`${mutedTextClass} block truncate`}>
            {routeDecisionCandidateSourceLabel(candidate, t)} / {String(candidate.selectedScoreProfile ?? '-').toUpperCase()}
            {candidate.serverCountry ? ` / ${candidate.serverCountry}` : ''}
          </span>
        </div>
        <StatusBadge tone={getWireGuardScoreTone(candidate.score)}>{format.integer(candidate.score)}</StatusBadge>
      </div>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-5">
        <MetricPill icon={Clock} label={t.settings.latency} value={format.latency(candidate.latencyMs ?? null)} />
        <MetricPill icon={Activity} label={t.settings.jitter} value={format.latency(candidate.jitterMs ?? null)} />
        <MetricPill icon={AlertTriangle} label={t.settings.packetLoss} value={format.packetLoss(candidate.packetLossPercent ?? null)} />
        <MetricPill icon={Gauge} label={t.settings.loadedLatency} value={formatLoadedLatency(candidate, format, t)} />
        <MetricPill icon={Network} label={t.settings.mtu} value={formatMtuRecommendation(candidate, format, t)} />
      </div>
    </div>
  );
}

function routeDecisionActionTone(action: RouteDecisionAction): Tone {
  switch (action) {
    case 'switchRecommended':
      return 'warning';
    case 'keepCurrent':
      return 'good';
    case 'cooldownActive':
    case 'noHealthyCandidate':
    case 'noManagedCandidate':
    case 'insufficientCandidates':
      return 'warning';
    default:
      return 'neutral';
  }
}

function routeDecisionActionToneForState(state: string): Tone {
  switch (state) {
    case 'switchRecommended':
      return 'warning';
    case 'keepCurrent':
      return 'good';
    case 'routeLocked':
    case 'cooldownActive':
    case 'manualMode':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function routeDecisionDispositionTone(disposition: string): Tone {
  switch (disposition) {
    case 'recommended':
    case 'eligible':
      return 'good';
    case 'unhealthy':
      return 'critical';
    case 'cooldownBlocked':
    case 'preferenceMismatch':
    case 'belowHysteresis':
      return 'warning';
    default:
      return 'neutral';
  }
}

function routeDecisionDispositionLabel(disposition: string, t: DashboardStrings): string {
  switch (disposition) {
    case 'recommended':
      return t.settings.decisionDispositionRecommended;
    case 'current':
      return t.settings.decisionDispositionCurrent;
    case 'eligible':
      return t.settings.decisionDispositionEligible;
    case 'routeLocked':
      return t.settings.decisionDispositionRouteLocked;
    case 'cooldownBlocked':
      return t.settings.decisionDispositionCooldown;
    case 'manualMode':
      return t.settings.decisionDispositionManual;
    case 'diagnosticOnly':
      return t.settings.decisionDispositionDiagnostic;
    case 'unhealthy':
      return t.settings.decisionDispositionUnhealthy;
    case 'preferenceMismatch':
      return t.settings.decisionDispositionPreferenceMismatch;
    case 'belowHysteresis':
      return t.settings.decisionDispositionBelowHysteresis;
    default:
      return disposition;
  }
}

function routeApplyPlanStatusTone(status: string): Tone {
  switch (status) {
    case 'assignmentOnlyReady':
    case 'dataPlaneReady':
      return 'good';
    case 'blocked':
      return 'warning';
    default:
      return 'neutral';
  }
}

function routeApplyPlanStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'assignmentOnlyReady':
      return t.settings.routeApplyPlanAssignmentOnlyReady;
    case 'dataPlaneReady':
      return t.settings.routeApplyPlanDataPlaneReady;
    case 'blocked':
      return t.settings.routeApplyPlanBlocked;
    case 'notRequired':
      return t.settings.routeApplyPlanNotRequired;
    default:
      return status;
  }
}

function routeApplyAdapterStatusTone(status: string): Tone {
  switch (status) {
    case 'ready':
      return 'good';
    case 'missing':
    case 'unsupported':
      return 'warning';
    default:
      return 'neutral';
  }
}

function routeApplyAdapterStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'ready':
      return t.settings.routeApplyAdapterReady;
    case 'disabled':
      return t.settings.routeApplyAdapterDisabled;
    case 'missing':
      return t.settings.routeApplyAdapterMissing;
    case 'unsupported':
      return t.settings.routeApplyAdapterUnsupported;
    default:
      return status;
  }
}

function routeApplyPlanStepLabel(code: string, t: DashboardStrings): string {
  switch (code) {
    case 'verify_preview_fresh':
      return t.settings.routeApplyStepVerifyPreview;
    case 'verify_route_lock_clear':
      return t.settings.routeApplyStepVerifyLock;
    case 'verify_cooldown_clear':
      return t.settings.routeApplyStepVerifyCooldown;
    case 'persist_assignment':
      return t.settings.routeApplyStepPersistAssignment;
    case 'set_cooldown':
      return t.settings.routeApplyStepSetCooldown;
    case 'drain_current_route':
      return t.settings.routeApplyStepDrainCurrent;
    case 'switch_data_plane_route':
      return t.settings.routeApplyStepSwitchDataPlane;
    case 'verify_route_health':
      return t.settings.routeApplyStepVerifyHealth;
    case 'restore_previous_route':
      return t.settings.routeApplyStepRestorePrevious;
    default:
      return code;
  }
}

function routeDecisionActionLabel(action: RouteDecisionAction, t: DashboardStrings): string {
  switch (action) {
    case 'switchRecommended':
      return t.settings.decisionActionSwitch;
    case 'manualMode':
      return t.settings.decisionActionManual;
    case 'routeLocked':
      return t.settings.decisionActionLocked;
    case 'cooldownActive':
      return t.settings.decisionActionCooldown;
    case 'insufficientCandidates':
      return t.settings.decisionActionInsufficient;
    case 'noHealthyCandidate':
      return t.settings.decisionActionNoHealthy;
    case 'noManagedCandidate':
      return t.settings.decisionActionNoManaged;
    default:
      return t.settings.decisionActionKeep;
  }
}

function routeDecisionStateLabel(state: string, t: DashboardStrings): string {
  switch (state) {
    case 'switchRecommended':
    case 'manualMode':
    case 'routeLocked':
    case 'cooldownActive':
    case 'insufficientCandidates':
    case 'noHealthyCandidate':
    case 'noManagedCandidate':
    case 'keepCurrent':
      return routeDecisionActionLabel(state, t);
    default:
      return state;
  }
}

function routeClientPreferenceModeLabel(mode: string, t: DashboardStrings): string {
  switch (mode) {
    case 'country':
      return t.settings.routeClientPreferenceModeCountry;
    case 'outbound':
      return t.settings.routeClientPreferenceModeOutbound;
    default:
      return t.settings.routeClientPreferenceModeAuto;
  }
}

function routeDecisionReasonLabel(reason: string, t: DashboardStrings): string {
  switch (reason) {
    case 'no_candidates':
      return t.settings.decisionReasonNoCandidates;
    case 'no_healthy_candidate':
      return t.settings.decisionReasonNoHealthy;
    case 'agent_candidate_not_applicable':
      return t.settings.decisionReasonAgentOnly;
    case 'route_locked':
      return t.settings.decisionReasonLocked;
    case 'manual_mode':
      return t.settings.decisionReasonManual;
    case 'cooldown_active':
      return t.settings.decisionReasonCooldown;
    case 'no_current_candidate':
      return t.settings.decisionReasonNoCurrent;
    case 'best_candidate_current':
      return t.settings.decisionReasonBestCurrent;
    case 'score_delta_meets_hysteresis':
      return t.settings.decisionReasonDeltaMet;
    case 'score_delta_below_hysteresis':
      return t.settings.decisionReasonDeltaLow;
    case 'auto_route_enabled':
      return t.settings.decisionReasonAutoEnabled;
    case 'has_previous_decision_state':
      return t.settings.decisionReasonPreviousState;
    case 'recommended_candidate':
      return t.settings.decisionReasonRecommendedCandidate;
    case 'current_candidate':
      return t.settings.decisionReasonCurrentCandidate;
    case 'candidate_unhealthy':
      return t.settings.decisionReasonCandidateUnhealthy;
    case 'current_candidate_unhealthy':
      return t.settings.decisionReasonCurrentUnhealthy;
    case 'health_based_switch':
      return t.settings.decisionReasonHealthSwitch;
    case 'score_below_threshold':
      return t.settings.decisionReasonScoreLow;
    case 'assignment_apply_requested':
      return t.settings.decisionReasonApplyRequested;
    case 'assignment_only_apply':
      return t.settings.decisionReasonAssignmentOnly;
    case 'data_plane_not_applied':
      return t.settings.decisionReasonDataPlaneNotApplied;
    case 'apply_requires_switch_recommended':
      return t.settings.decisionReasonApplyRequiresSwitch;
    case 'server_apply_adapter_missing':
      return t.settings.decisionReasonApplyAdapterMissing;
    case 'data_plane_apply_disabled':
      return t.settings.decisionReasonDataPlaneDisabled;
    case 'route_apply_adapter_unsupported':
      return t.settings.decisionReasonApplyAdapterUnsupported;
    case 'dry_run_only':
      return t.settings.decisionReasonDryRunOnly;
    case 'loaded_latency_high':
      return t.settings.decisionReasonLoadedLatency;
    case 'mtu_reduce_recommended':
      return t.settings.decisionReasonMtuReduce;
    case 'mtu_manual_review':
      return t.settings.decisionReasonMtuReview;
    case 'mtu_probe_blocked':
      return t.settings.decisionReasonMtuBlocked;
    case 'client_route_preference':
      return t.settings.decisionReasonClientPreference;
    case 'detected_country_context':
      return t.settings.decisionReasonDetectedCountry;
    case 'client_score_profile_context':
    case 'client_score_profile_applied':
      return t.settings.decisionReasonClientScoreProfile;
    case 'preferred_country_applied':
      return t.settings.decisionReasonPreferredCountryApplied;
    case 'preferred_country_unavailable':
      return t.settings.decisionReasonPreferredCountryUnavailable;
    case 'preferred_country_match':
      return t.settings.decisionReasonPreferredCountryMatch;
    case 'preferred_country_mismatch':
      return t.settings.decisionReasonPreferredCountryMismatch;
    case 'preferred_outbound_applied':
      return t.settings.decisionReasonPreferredOutboundApplied;
    case 'preferred_outbound_unavailable':
      return t.settings.decisionReasonPreferredOutboundUnavailable;
    case 'preferred_outbound_match':
      return t.settings.decisionReasonPreferredOutboundMatch;
    case 'preferred_outbound_mismatch':
      return t.settings.decisionReasonPreferredOutboundMismatch;
    default:
      return reason;
  }
}

function routeScoreReasonLabel(reason: string, t: DashboardStrings): string {
  switch (reason) {
    case 'healthStatus':
      return t.settings.decisionScoreReasonHealthStatus;
    case 'latency':
      return t.settings.decisionScoreReasonLatency;
    case 'jitter':
      return t.settings.decisionScoreReasonJitter;
    case 'packetLoss':
      return t.settings.decisionScoreReasonPacketLoss;
    case 'loadedLatency':
      return t.settings.decisionScoreReasonLoadedLatency;
    case 'load':
      return t.settings.decisionScoreReasonLoad;
    case 'serverHealth':
      return t.settings.decisionScoreReasonServerHealth;
    case 'wireguardHandshake':
      return t.settings.decisionScoreReasonHandshake;
    case 'routeProbe':
      return t.settings.decisionScoreReasonRouteProbe;
    case 'mtu':
      return t.settings.decisionScoreReasonMtu;
    case 'maintenance':
      return t.settings.decisionScoreReasonMaintenance;
    default:
      return reason;
  }
}

function routeScoreProfileLabel(profile: string, t: DashboardStrings): string {
  switch (profile) {
    case 'balanced':
      return t.settings.profileBalanced;
    case 'stability':
      return t.settings.stabilityStrategy;
    case 'throughput':
      return t.settings.throughputStrategy;
    case 'gaming':
      return t.settings.profileGaming;
    case 'tcp':
      return 'TCP';
    case 'udp':
      return 'UDP';
    case 'quic':
      return 'QUIC';
    case 'dns':
      return 'DNS';
    case 'wireguard':
      return 'WireGuard';
    default:
      return profile;
  }
}

function routeProfileRecommendationReasonLabel(reason: string, t: DashboardStrings): string {
  switch (reason) {
    case 'selectedProfile':
      return t.settings.profileReasonSelected;
    case 'bestProfileScore':
      return t.settings.profileReasonBestScore;
    case 'profileScoreLead':
      return t.settings.profileReasonScoreLead;
    case 'gamingSensitive':
      return t.settings.profileReasonGaming;
    case 'protocolSensitive':
      return t.settings.profileReasonProtocol;
    case 'throughputSensitive':
      return t.settings.profileReasonThroughput;
    case 'stabilitySensitive':
      return t.settings.profileReasonStability;
    default:
      return reason;
  }
}

function routeLoadBalanceStrategyLabel(strategy: string, t: DashboardStrings): string {
  switch (strategy) {
    case 'balanced':
      return t.settings.balancedStrategy;
    case 'stability':
      return t.settings.stabilityStrategy;
    case 'throughput':
      return t.settings.throughputStrategy;
    default:
      return strategy;
  }
}

function routeLoadBalancingModeTone(mode: string): Tone {
  switch (mode) {
    case 'weighted':
      return 'good';
    case 'primaryStandby':
    case 'singlePrimary':
      return 'neutral';
    case 'insufficientCandidates':
      return 'warning';
    default:
      return 'neutral';
  }
}

function routeLoadBalancingModeLabel(mode: string, t: DashboardStrings): string {
  switch (mode) {
    case 'singlePrimary':
      return t.settings.loadBalancingSinglePrimary;
    case 'weighted':
      return t.settings.loadBalancingWeighted;
    case 'primaryStandby':
      return t.settings.loadBalancingPrimaryStandby;
    case 'insufficientCandidates':
      return t.settings.loadBalancingInsufficient;
    default:
      return mode;
  }
}

function routeLoadBalancingRoleLabel(role: string, t: DashboardStrings): string {
  switch (role) {
    case 'primary':
      return t.settings.loadBalancingPrimary;
    case 'secondary':
      return t.settings.loadBalancingSecondary;
    case 'standby':
      return t.settings.loadBalancingStandby;
    default:
      return role;
  }
}

function routeLoadBalancingRiskTone(risk: string): Tone {
  switch (risk) {
    case 'low':
      return 'good';
    case 'medium':
      return 'warning';
    case 'high':
      return 'critical';
    default:
      return 'neutral';
  }
}

function routeLoadBalancingRiskLabel(risk: string, t: DashboardStrings): string {
  switch (risk) {
    case 'low':
      return t.settings.loadBalancingRiskLow;
    case 'medium':
      return t.settings.loadBalancingRiskMedium;
    case 'high':
      return t.settings.loadBalancingRiskHigh;
    default:
      return risk;
  }
}

function routeLoadBalancingReasonLabel(reason: string, t: DashboardStrings): string {
  switch (reason) {
    case 'advisoryOnly':
      return t.settings.loadBalancingReasonAdvisory;
    case 'dataPlaneDisabled':
      return t.settings.loadBalancingReasonDataPlaneOff;
    case 'profileWeighted':
      return t.settings.loadBalancingReasonProfile;
    case 'healthWeighted':
      return t.settings.loadBalancingReasonHealth;
    case 'packetLossWeighted':
      return t.settings.loadBalancingReasonPacketLoss;
    case 'jitterWeighted':
      return t.settings.loadBalancingReasonJitter;
    case 'latencyWeighted':
      return t.settings.loadBalancingReasonLatency;
    case 'throughputWeighted':
      return t.settings.loadBalancingReasonThroughput;
    case 'loadWeighted':
      return t.settings.loadBalancingReasonLoad;
    case 'securityProfileWeighted':
      return t.settings.loadBalancingReasonSecurity;
    case 'routeConsistency':
      return t.settings.loadBalancingReasonConsistency;
    case 'scoreCloseToPrimary':
      return t.settings.loadBalancingReasonCloseScore;
    case 'bestCompositeScore':
      return t.settings.loadBalancingReasonBestComposite;
    case 'standbyRoute':
      return t.settings.loadBalancingReasonStandby;
    case 'insufficientEligibleCandidates':
      return t.settings.loadBalancingReasonInsufficient;
    default:
      return reason;
  }
}

function routeSessionSafetyModeTone(mode: string): Tone {
  switch (mode) {
    case 'safeToSwitch':
    case 'notRequired':
      return 'good';
    case 'stickyHold':
    case 'drainNewSessions':
      return 'warning';
    case 'emergencySwitch':
      return 'critical';
    default:
      return 'neutral';
  }
}

function routeSessionSafetyModeLabel(mode: string, t: DashboardStrings): string {
  switch (mode) {
    case 'notRequired':
      return t.settings.sessionSafetyModeNoChange;
    case 'safeToSwitch':
      return t.settings.sessionSafetyModeSafe;
    case 'stickyHold':
      return t.settings.sessionSafetyModeStickyHold;
    case 'drainNewSessions':
      return t.settings.sessionSafetyModeDrain;
    case 'emergencySwitch':
      return t.settings.sessionSafetyModeEmergency;
    default:
      return mode;
  }
}

function routeSessionSafetyPolicyLabel(policy: string, t: DashboardStrings): string {
  switch (policy) {
    case 'none':
      return t.settings.sessionSafetyPolicyNone;
    case 'keepExisting':
      return t.settings.sessionSafetyPolicyKeepExisting;
    case 'newSessionsOnly':
      return t.settings.sessionSafetyPolicyNewOnly;
    case 'emergencyReroute':
      return t.settings.sessionSafetyPolicyEmergency;
    default:
      return policy;
  }
}

function routeSessionSafetyRiskTone(risk: string): Tone {
  switch (risk) {
    case 'low':
      return 'good';
    case 'medium':
      return 'warning';
    case 'high':
      return 'critical';
    default:
      return 'neutral';
  }
}

function routeSessionSafetyRiskLabel(risk: string, t: DashboardStrings): string {
  switch (risk) {
    case 'low':
      return t.settings.sessionSafetyRiskLow;
    case 'medium':
      return t.settings.sessionSafetyRiskMedium;
    case 'high':
      return t.settings.sessionSafetyRiskHigh;
    default:
      return risk;
  }
}

function routeSessionSafetyReasonLabel(reason: string, t: DashboardStrings): string {
  switch (reason) {
    case 'gamingSensitive':
      return t.settings.sessionSafetyReasonGaming;
    case 'udpSessionSensitive':
      return t.settings.sessionSafetyReasonUdp;
    case 'routeConsistency':
      return t.settings.sessionSafetyReasonConsistency;
    case 'publicIpMayChange':
      return t.settings.sessionSafetyReasonPublicIp;
    case 'natStateMayReset':
      return t.settings.sessionSafetyReasonNat;
    case 'stickySessionsRequired':
      return t.settings.sessionSafetyReasonSticky;
    case 'drainExistingSessions':
      return t.settings.sessionSafetyReasonDrain;
    case 'newSessionsOnly':
      return t.settings.sessionSafetyReasonNewOnly;
    case 'emergencyHealthFailure':
      return t.settings.sessionSafetyReasonEmergency;
    case 'manualOrLocked':
      return t.settings.sessionSafetyReasonManualLocked;
    case 'cooldownActive':
      return t.settings.sessionSafetyReasonCooldown;
    case 'noSwitchNeeded':
      return t.settings.sessionSafetyReasonNoSwitch;
    case 'noCurrentRoute':
      return t.settings.sessionSafetyReasonNoCurrent;
    case 'assignmentOnly':
      return t.settings.sessionSafetyReasonAssignmentOnly;
    case 'dataPlaneDisabled':
      return t.settings.sessionSafetyReasonDataPlaneOff;
    case 'scoreDeltaSwitch':
      return t.settings.sessionSafetyReasonScoreDelta;
    default:
      return reason;
  }
}

function routeSwitchEngineStatusTone(status: string): Tone {
  switch (status) {
    case 'dataPlaneReady':
      return 'good';
    case 'planningOnly':
      return 'warning';
    case 'blocked':
      return 'critical';
    default:
      return 'neutral';
  }
}

function routeSwitchEngineStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'notRequired':
      return t.settings.switchEngineStatusNotRequired;
    case 'planningOnly':
      return t.settings.switchEngineStatusPlanning;
    case 'blocked':
      return t.settings.switchEngineStatusBlocked;
    case 'dataPlaneReady':
      return t.settings.switchEngineStatusReady;
    default:
      return status;
  }
}

function routeSwitchEngineModeLabel(mode: string, t: DashboardStrings): string {
  switch (mode) {
    case 'noChange':
      return t.settings.switchEngineModeNoChange;
    case 'assignmentOnly':
      return t.settings.switchEngineModeAssignment;
    case 'stickyDrain':
      return t.settings.switchEngineModeStickyDrain;
    case 'newSessionsOnly':
      return t.settings.switchEngineModeNewOnly;
    case 'emergencyReroute':
      return t.settings.switchEngineModeEmergency;
    default:
      return mode;
  }
}

function routeSwitchEngineStepStatusTone(status: string): Tone {
  switch (status) {
    case 'ready':
      return 'good';
    case 'future':
      return 'warning';
    case 'blocked':
      return 'critical';
    default:
      return 'neutral';
  }
}

function routeSwitchEngineStepStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'ready':
      return t.settings.switchEngineStepReady;
    case 'future':
      return t.settings.switchEngineStepFuture;
    case 'blocked':
      return t.settings.switchEngineStepBlocked;
    case 'notRequired':
      return t.settings.switchEngineStepNotRequired;
    default:
      return status;
  }
}

function routeSwitchEngineSessionImpactLabel(impact: string, t: DashboardStrings): string {
  switch (impact) {
    case 'none':
      return t.settings.switchEngineImpactNone;
    case 'newSessionsOnly':
      return t.settings.switchEngineImpactNewOnly;
    case 'existingSessions':
      return t.settings.switchEngineImpactExisting;
    case 'allSessions':
      return t.settings.switchEngineImpactAll;
    default:
      return impact;
  }
}

function routeSwitchEngineStepLabel(code: string, t: DashboardStrings): string {
  switch (code) {
    case 'verify_switch_guards':
      return t.settings.switchEngineStepVerifyGuards;
    case 'pin_existing_sessions':
      return t.settings.switchEngineStepPinExisting;
    case 'route_new_sessions':
      return t.settings.switchEngineStepRouteNew;
    case 'drain_existing_sessions':
      return t.settings.switchEngineStepDrainExisting;
    case 'switch_active_route':
      return t.settings.switchEngineStepSwitchActive;
    case 'emergency_switch_active_route':
      return t.settings.switchEngineStepEmergencySwitch;
    case 'verify_switched_route':
      return t.settings.switchEngineStepVerifyRoute;
    case 'rollback_previous_route':
      return t.settings.switchEngineStepRollback;
    default:
      return code;
  }
}

function routeSwitchEngineReasonLabel(reason: string, t: DashboardStrings): string {
  switch (reason) {
    case 'assignmentOnly':
      return t.settings.switchEngineReasonAssignmentOnly;
    case 'dataPlaneDisabled':
      return t.settings.switchEngineReasonDataPlaneOff;
    case 'serverApplyAdapterMissing':
      return t.settings.switchEngineReasonAdapterMissing;
    case 'routeLock':
      return t.settings.switchEngineReasonRouteLock;
    case 'manualMode':
      return t.settings.switchEngineReasonManual;
    case 'cooldownActive':
      return t.settings.switchEngineReasonCooldown;
    case 'stickySessions':
      return t.settings.switchEngineReasonSticky;
    case 'newSessionsOnly':
      return t.settings.switchEngineReasonNewOnly;
    case 'drainSafe':
      return t.settings.switchEngineReasonDrainSafe;
    case 'emergencySwitch':
      return t.settings.switchEngineReasonEmergency;
    case 'rollbackPlanned':
      return t.settings.switchEngineReasonRollback;
    case 'noSwitchNeeded':
      return t.settings.switchEngineReasonNoSwitch;
    case 'guardBlocked':
      return t.settings.switchEngineReasonGuardBlocked;
    default:
      return reason;
  }
}

function routeSwitchPreflightStatusTone(status: string): Tone {
  switch (status) {
    case 'ready':
      return 'good';
    case 'planningOnly':
      return 'warning';
    case 'blocked':
      return 'critical';
    default:
      return 'neutral';
  }
}

function routeSwitchPreflightStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'notRequired':
      return t.settings.switchPreflightStatusNotRequired;
    case 'planningOnly':
      return t.settings.switchPreflightStatusPlanning;
    case 'blocked':
      return t.settings.switchPreflightStatusBlocked;
    case 'ready':
      return t.settings.switchPreflightStatusReady;
    default:
      return status;
  }
}

function routeSwitchPreflightCheckStatusTone(status: string): Tone {
  switch (status) {
    case 'passed':
      return 'good';
    case 'warning':
    case 'future':
      return 'warning';
    case 'failed':
      return 'critical';
    default:
      return 'neutral';
  }
}

function routeSwitchPreflightCheckStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'passed':
      return t.settings.switchPreflightCheckPassed;
    case 'warning':
      return t.settings.switchPreflightCheckWarning;
    case 'failed':
      return t.settings.switchPreflightCheckFailed;
    case 'future':
      return t.settings.switchPreflightCheckFuture;
    case 'notRequired':
      return t.settings.switchPreflightCheckNotRequired;
    default:
      return status;
  }
}

function routeSwitchPreflightCheckLabel(code: string, t: DashboardStrings): string {
  switch (code) {
    case 'route_data_plane_feature_flag':
      return t.settings.switchPreflightFeatureFlag;
    case 'server_apply_adapter':
      return t.settings.switchPreflightAdapter;
    case 'secret_safe_dry_run':
      return t.settings.switchPreflightDryRun;
    case 'route_switch_guards':
      return t.settings.switchPreflightGuards;
    case 'session_safety_policy':
      return t.settings.switchPreflightSessionSafety;
    case 'rollback_plan':
      return t.settings.switchPreflightRollback;
    case 'cooldown_policy':
      return t.settings.switchPreflightCooldown;
    case 'decision_audit':
      return t.settings.switchPreflightAudit;
    case 'post_switch_health_verify':
      return t.settings.switchPreflightHealthVerify;
    default:
      return code;
  }
}

function routeSwitchPreflightReasonLabel(reason: string, t: DashboardStrings): string {
  switch (reason) {
    case 'noSwitchNeeded':
      return t.settings.switchPreflightReasonNoSwitch;
    case 'featureFlagDisabled':
      return t.settings.switchPreflightReasonFeatureFlag;
    case 'adapterMissing':
      return t.settings.switchPreflightReasonAdapterMissing;
    case 'adapterUnsupported':
      return t.settings.switchPreflightReasonAdapterUnsupported;
    case 'dryRunOnly':
      return t.settings.switchPreflightReasonDryRunOnly;
    case 'guardBlocked':
      return t.settings.switchPreflightReasonGuardBlocked;
    case 'sessionSafetyRequired':
      return t.settings.switchPreflightReasonSessionSafety;
    case 'rollbackPlanned':
      return t.settings.switchPreflightReasonRollback;
    case 'cooldownRequired':
      return t.settings.switchPreflightReasonCooldown;
    case 'auditReady':
      return t.settings.switchPreflightReasonAudit;
    case 'healthVerifyRequired':
      return t.settings.switchPreflightReasonHealthVerify;
    case 'dataPlaneReady':
      return t.settings.switchPreflightReasonDataPlaneReady;
    default:
      return reason;
  }
}

function routeSwitchRolloutStatusTone(status: string): Tone {
  switch (status) {
    case 'canaryReady':
      return 'good';
    case 'planningOnly':
    case 'emergencyOnly':
      return 'warning';
    case 'blocked':
      return 'critical';
    default:
      return 'neutral';
  }
}

function routeSwitchRolloutStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'notRequired':
      return t.settings.switchRolloutStatusNotRequired;
    case 'blocked':
      return t.settings.switchRolloutStatusBlocked;
    case 'planningOnly':
      return t.settings.switchRolloutStatusPlanning;
    case 'canaryReady':
      return t.settings.switchRolloutStatusReady;
    case 'emergencyOnly':
      return t.settings.switchRolloutStatusEmergency;
    default:
      return status;
  }
}

function routeSwitchRolloutStrategyLabel(strategy: string, t: DashboardStrings): string {
  switch (strategy) {
    case 'none':
      return t.settings.switchRolloutStrategyNone;
    case 'assignmentOnly':
      return t.settings.switchRolloutStrategyAssignment;
    case 'newSessionCanary':
      return t.settings.switchRolloutStrategyNewCanary;
    case 'stickyDrainCanary':
      return t.settings.switchRolloutStrategyStickyCanary;
    case 'emergencyReroute':
      return t.settings.switchRolloutStrategyEmergency;
    default:
      return strategy;
  }
}

function routeSwitchRolloutStepStatusTone(status: string): Tone {
  switch (status) {
    case 'ready':
      return 'good';
    case 'future':
      return 'warning';
    case 'blocked':
      return 'critical';
    default:
      return 'neutral';
  }
}

function routeSwitchRolloutStepStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'ready':
      return t.settings.switchEngineStepReady;
    case 'future':
      return t.settings.switchEngineStepFuture;
    case 'blocked':
      return t.settings.switchEngineStepBlocked;
    case 'notRequired':
      return t.settings.switchEngineStepNotRequired;
    default:
      return status;
  }
}

function routeSwitchRolloutStepLabel(code: string, t: DashboardStrings): string {
  switch (code) {
    case 'persist_control_plane_assignment':
      return t.settings.switchRolloutStepPersistAssignment;
    case 'pin_existing_sessions_for_rollout':
      return t.settings.switchRolloutStepPinExisting;
    case 'canary_new_sessions':
      return t.settings.switchRolloutStepCanary;
    case 'verify_canary_health':
      return t.settings.switchRolloutStepVerify;
    case 'expand_new_session_rollout':
      return t.settings.switchRolloutStepExpand;
    case 'complete_new_session_rollout':
      return t.settings.switchRolloutStepComplete;
    case 'rollback_on_regression':
      return t.settings.switchRolloutStepRollback;
    default:
      return code;
  }
}

function routeSwitchRolloutTrafficScopeLabel(scope: string, t: DashboardStrings): string {
  switch (scope) {
    case 'none':
      return t.settings.switchRolloutScopeNone;
    case 'controlPlane':
      return t.settings.switchRolloutScopeControl;
    case 'newSessions':
      return t.settings.switchRolloutScopeNew;
    case 'canary':
      return t.settings.switchRolloutScopeCanary;
    case 'allNewSessions':
      return t.settings.switchRolloutScopeAllNew;
    case 'allSessions':
      return t.settings.switchRolloutScopeAll;
    case 'emergency':
      return t.settings.switchRolloutScopeEmergency;
    default:
      return scope;
  }
}

function routeSwitchRolloutReasonLabel(reason: string, t: DashboardStrings): string {
  switch (reason) {
    case 'noSwitchNeeded':
      return t.settings.switchPreflightReasonNoSwitch;
    case 'assignmentOnly':
      return t.settings.switchEngineReasonAssignmentOnly;
    case 'dataPlaneDisabled':
      return t.settings.switchEngineReasonDataPlaneOff;
    case 'preflightBlocked':
      return t.settings.switchRolloutReasonPreflightBlocked;
    case 'stickySessions':
      return t.settings.switchEngineReasonSticky;
    case 'newSessionsOnly':
      return t.settings.switchEngineReasonNewOnly;
    case 'emergencySwitch':
      return t.settings.switchEngineReasonEmergency;
    case 'canaryRequired':
      return t.settings.switchRolloutReasonCanary;
    case 'rollbackGuard':
      return t.settings.switchRolloutReasonRollback;
    case 'healthVerifyRequired':
      return t.settings.switchPreflightReasonHealthVerify;
    case 'gamingSensitive':
      return t.settings.switchRolloutReasonGaming;
    case 'routeConsistencyHold':
      return t.settings.switchRolloutReasonConsistency;
    case 'dataPlaneReady':
      return t.settings.switchPreflightReasonDataPlaneReady;
    default:
      return reason;
  }
}

function routeSwitchRolloutEvaluationStatusTone(status: string): Tone {
  switch (status) {
    case 'canaryReady':
    case 'expandReady':
      return 'good';
    case 'planningOnly':
    case 'hold':
      return 'warning';
    case 'blocked':
    case 'rollbackRecommended':
      return 'critical';
    default:
      return 'neutral';
  }
}

function routeSwitchRolloutEvaluationStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'notRequired':
      return t.settings.switchRolloutEvalStatusNotRequired;
    case 'blocked':
      return t.settings.switchRolloutEvalStatusBlocked;
    case 'planningOnly':
      return t.settings.switchRolloutEvalStatusPlanning;
    case 'hold':
      return t.settings.switchRolloutEvalStatusHold;
    case 'canaryReady':
      return t.settings.switchRolloutEvalStatusCanaryReady;
    case 'expandReady':
      return t.settings.switchRolloutEvalStatusExpandReady;
    case 'rollbackRecommended':
      return t.settings.switchRolloutEvalStatusRollback;
    default:
      return status;
  }
}

function routeSwitchRolloutEvaluationActionLabel(action: string, t: DashboardStrings): string {
  switch (action) {
    case 'none':
      return t.settings.switchRolloutEvalActionNone;
    case 'manualReview':
      return t.settings.switchRolloutEvalActionManual;
    case 'hold':
      return t.settings.switchRolloutEvalActionHold;
    case 'startCanary':
      return t.settings.switchRolloutEvalActionStart;
    case 'expandCanary':
      return t.settings.switchRolloutEvalActionExpand;
    case 'rollback':
      return t.settings.switchRolloutEvalActionRollback;
    default:
      return action;
  }
}

function routeSwitchRolloutEvaluationReasonLabel(reason: string, t: DashboardStrings): string {
  switch (reason) {
    case 'noSwitchNeeded':
      return t.settings.switchPreflightReasonNoSwitch;
    case 'rolloutBlocked':
      return t.settings.switchRolloutEvalReasonBlocked;
    case 'dataPlaneDisabled':
      return t.settings.switchEngineReasonDataPlaneOff;
    case 'preflightBlocked':
      return t.settings.switchRolloutReasonPreflightBlocked;
    case 'guardPassed':
      return t.settings.switchRolloutEvalReasonGuardPassed;
    case 'healthUnknown':
      return t.settings.switchRolloutEvalReasonHealthUnknown;
    case 'lossGuardTriggered':
      return t.settings.switchRolloutEvalReasonLoss;
    case 'jitterGuardTriggered':
      return t.settings.switchRolloutEvalReasonJitter;
    case 'latencyGuardTriggered':
      return t.settings.switchRolloutEvalReasonLatency;
    case 'scoreTooLow':
      return t.settings.switchRolloutEvalReasonScore;
    case 'routeConsistencyHold':
      return t.settings.switchRolloutReasonConsistency;
    case 'canaryReady':
      return t.settings.switchRolloutEvalReasonCanary;
    case 'expansionReady':
      return t.settings.switchRolloutEvalReasonExpand;
    case 'gamingSensitive':
      return t.settings.switchRolloutReasonGaming;
    case 'manualReviewRequired':
      return t.settings.switchRolloutEvalReasonManual;
    default:
      return reason;
  }
}

function routeSwitchOrchestrationStatusTone(status: string): Tone {
  switch (status) {
    case 'canaryReady':
    case 'expandReady':
    case 'dataPlaneReady':
      return 'good';
    case 'assignmentOnly':
    case 'planningOnly':
    case 'holding':
      return 'warning';
    case 'blocked':
    case 'rollbackRecommended':
      return 'critical';
    default:
      return 'neutral';
  }
}

function routeSwitchOrchestrationStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'notRequired':
      return t.settings.switchOrchestrationStatusNotRequired;
    case 'blocked':
      return t.settings.switchOrchestrationStatusBlocked;
    case 'assignmentOnly':
      return t.settings.switchOrchestrationStatusAssignment;
    case 'planningOnly':
      return t.settings.switchOrchestrationStatusPlanning;
    case 'holding':
      return t.settings.switchOrchestrationStatusHolding;
    case 'canaryReady':
      return t.settings.switchOrchestrationStatusCanary;
    case 'expandReady':
      return t.settings.switchOrchestrationStatusExpand;
    case 'rollbackRecommended':
      return t.settings.switchOrchestrationStatusRollback;
    case 'dataPlaneReady':
      return t.settings.switchOrchestrationStatusDataPlane;
    default:
      return status;
  }
}

function routeSwitchOrchestrationPhaseLabel(phase: string, t: DashboardStrings): string {
  switch (phase) {
    case 'noChange':
      return t.settings.switchOrchestrationPhaseNoChange;
    case 'guard':
      return t.settings.switchOrchestrationPhaseGuard;
    case 'assignment':
      return t.settings.switchOrchestrationPhaseAssignment;
    case 'pinExisting':
      return t.settings.switchOrchestrationPhasePin;
    case 'canary':
      return t.settings.switchOrchestrationPhaseCanary;
    case 'drain':
      return t.settings.switchOrchestrationPhaseDrain;
    case 'verify':
      return t.settings.switchOrchestrationPhaseVerify;
    case 'expand':
      return t.settings.switchOrchestrationPhaseExpand;
    case 'rollback':
      return t.settings.switchOrchestrationPhaseRollback;
    default:
      return phase;
  }
}

function routeSwitchOrchestrationActionLabel(action: string, t: DashboardStrings): string {
  switch (action) {
    case 'none':
      return t.settings.switchOrchestrationActionNone;
    case 'recordDecision':
      return t.settings.switchOrchestrationActionRecord;
    case 'hold':
      return t.settings.switchOrchestrationActionHold;
    case 'startCanary':
      return t.settings.switchOrchestrationActionStart;
    case 'expandCanary':
      return t.settings.switchOrchestrationActionExpand;
    case 'rollback':
      return t.settings.switchOrchestrationActionRollback;
    case 'manualReview':
      return t.settings.switchOrchestrationActionManual;
    default:
      return action;
  }
}

function routeSwitchOrchestrationStageStatusTone(status: string): Tone {
  switch (status) {
    case 'ready':
      return 'good';
    case 'future':
    case 'hold':
      return 'warning';
    case 'blocked':
      return 'critical';
    default:
      return 'neutral';
  }
}

function routeSwitchOrchestrationStageStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'ready':
      return t.settings.switchEngineStepReady;
    case 'future':
      return t.settings.switchEngineStepFuture;
    case 'blocked':
      return t.settings.switchEngineStepBlocked;
    case 'hold':
      return t.settings.switchOrchestrationStageHold;
    case 'notRequired':
      return t.settings.switchEngineStepNotRequired;
    default:
      return status;
  }
}

function routeSwitchOrchestrationStageLabel(code: string, t: DashboardStrings): string {
  switch (code) {
    case 'guard_route_locks_cooldown_and_health':
      return t.settings.switchOrchestrationStageGuard;
    case 'record_control_plane_assignment':
      return t.settings.switchOrchestrationStageRecord;
    case 'pin_existing_active_sessions':
      return t.settings.switchOrchestrationStagePin;
    case 'canary_new_sessions_only':
      return t.settings.switchOrchestrationStageCanary;
    case 'hold_route_consistency_window':
      return t.settings.switchOrchestrationStageHoldWindow;
    case 'verify_loss_jitter_latency_guards':
      return t.settings.switchOrchestrationStageVerify;
    case 'expand_new_session_rollout':
      return t.settings.switchOrchestrationStageExpand;
    case 'rollback_on_guard_regression':
      return t.settings.switchOrchestrationStageRollback;
    default:
      return code;
  }
}

function routeSwitchOrchestrationReasonLabel(reason: string, t: DashboardStrings): string {
  switch (reason) {
    case 'noSwitchNeeded':
      return t.settings.switchPreflightReasonNoSwitch;
    case 'routeLock':
      return t.settings.switchEngineReasonRouteLock;
    case 'manualMode':
      return t.settings.switchEngineReasonManual;
    case 'cooldownActive':
      return t.settings.switchEngineReasonCooldown;
    case 'assignmentOnly':
      return t.settings.switchEngineReasonAssignmentOnly;
    case 'dataPlaneDisabled':
      return t.settings.switchEngineReasonDataPlaneOff;
    case 'preflightBlocked':
      return t.settings.switchRolloutReasonPreflightBlocked;
    case 'rolloutBlocked':
      return t.settings.switchRolloutEvalReasonBlocked;
    case 'guardPassed':
      return t.settings.switchRolloutEvalReasonGuardPassed;
    case 'healthUnknown':
      return t.settings.switchRolloutEvalReasonHealthUnknown;
    case 'rollbackGuard':
      return t.settings.switchRolloutReasonRollback;
    case 'stickySessions':
      return t.settings.switchEngineReasonSticky;
    case 'newSessionsOnly':
      return t.settings.switchEngineReasonNewOnly;
    case 'drainSafe':
      return t.settings.switchEngineReasonDrainSafe;
    case 'canaryRequired':
      return t.settings.switchRolloutReasonCanary;
    case 'routeConsistencyHold':
      return t.settings.switchRolloutReasonConsistency;
    case 'gamingSensitive':
      return t.settings.switchRolloutReasonGaming;
    case 'auditRequired':
      return t.settings.switchOrchestrationReasonAudit;
    case 'dataPlaneReady':
      return t.settings.switchPreflightReasonDataPlaneReady;
    default:
      return reason;
  }
}

function routeSwitchExecutionStatusTone(status: string): Tone {
  switch (status) {
    case 'dataPlaneApplied':
      return 'good';
    case 'controlPlaneApplied':
    case 'dataPlaneBlocked':
    case 'blocked':
      return 'warning';
    default:
      return 'neutral';
  }
}

function routeSwitchExecutionStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'notRequired':
      return t.settings.switchExecutionStatusNotRequired;
    case 'blocked':
      return t.settings.switchExecutionStatusBlocked;
    case 'controlPlaneApplied':
      return t.settings.switchExecutionStatusControlPlane;
    case 'dataPlaneBlocked':
      return t.settings.switchExecutionStatusDataPlaneBlocked;
    case 'dataPlaneApplied':
      return t.settings.switchExecutionStatusDataPlaneApplied;
    default:
      return status;
  }
}

function routeSwitchExecutionPhaseLabel(phase: string, t: DashboardStrings): string {
  switch (phase) {
    case 'noChange':
      return t.settings.switchExecutionPhaseNoChange;
    case 'guarded':
      return t.settings.switchExecutionPhaseGuarded;
    case 'stickyDrainArmed':
      return t.settings.switchExecutionPhaseStickyDrain;
    case 'newSessionsArmed':
      return t.settings.switchExecutionPhaseNewSessions;
    case 'emergencyApplied':
      return t.settings.switchExecutionPhaseEmergency;
    case 'dataPlaneApplied':
      return t.settings.switchExecutionPhaseDataPlane;
    default:
      return phase;
  }
}

function routeSwitchExecutionReasonLabel(reason: string, t: DashboardStrings): string {
  switch (reason) {
    case 'assignmentOnly':
      return t.settings.switchEngineReasonAssignmentOnly;
    case 'assignmentApplied':
      return t.settings.switchExecutionReasonAssignmentApplied;
    case 'dataPlaneNotApplied':
      return t.settings.switchExecutionReasonDataPlaneNotApplied;
    case 'dataPlaneDisabled':
      return t.settings.switchEngineReasonDataPlaneOff;
    case 'serverApplyAdapterMissing':
      return t.settings.switchEngineReasonAdapterMissing;
    case 'stickySessionsPreserved':
      return t.settings.switchExecutionReasonStickyPreserved;
    case 'newSessionsOnly':
      return t.settings.switchEngineReasonNewOnly;
    case 'drainWindowArmed':
      return t.settings.switchExecutionReasonDrainArmed;
    case 'cooldownArmed':
      return t.settings.switchExecutionReasonCooldownArmed;
    case 'emergencySwitch':
      return t.settings.switchEngineReasonEmergency;
    case 'rollbackReady':
      return t.settings.switchEngineReasonRollback;
    default:
      return reason;
  }
}

function formatLoadedLatency(
  candidate: Pick<AdminRouteDecisionCandidateSummary, 'loadedLatencyDeltaMs' | 'loadedLatencyMs' | 'bufferbloatRecommendation' | 'bufferbloatSeverity'>,
  format: DashboardFormatters,
  t: DashboardStrings,
): string {
  if (candidate.loadedLatencyDeltaMs !== null && candidate.loadedLatencyDeltaMs !== undefined) {
    return `+${format.latency(candidate.loadedLatencyDeltaMs)}`;
  }
  if (candidate.loadedLatencyMs !== null && candidate.loadedLatencyMs !== undefined) {
    return format.latency(candidate.loadedLatencyMs);
  }
  if (candidate.bufferbloatRecommendation && candidate.bufferbloatRecommendation !== 'none') {
    return routeBufferbloatRecommendationLabel(candidate.bufferbloatRecommendation, t);
  }

  return routeBufferbloatSeverityLabel(candidate.bufferbloatSeverity ?? 'unknown', t);
}

function formatMtuRecommendation(
  candidate: Pick<
    AdminRouteDecisionCandidateSummary,
    'configuredMtuBytes' | 'mtuRecommendation' | 'mtuStatus' | 'recommendedTunnelMtuBytes'
  >,
  format: DashboardFormatters,
  t: DashboardStrings,
): string {
  const recommended = candidate.recommendedTunnelMtuBytes;
  const configured = candidate.configuredMtuBytes;

  if (candidate.mtuRecommendation === 'reduce' && typeof recommended === 'number') {
    return t.settings.mtuReduceTo(format.integer(recommended));
  }
  if (candidate.mtuRecommendation === 'manualReview') return t.settings.mtuManualReview;
  if (candidate.mtuRecommendation === 'keep') {
    if (typeof configured === 'number') return format.integer(configured);
    if (typeof recommended === 'number') return t.settings.mtuSafe(format.integer(recommended));
    return t.settings.mtuKeep;
  }
  if (candidate.mtuStatus === 'blocked') return t.settings.mtuBlocked;
  if (candidate.mtuStatus === 'fragmentationRisk' && typeof recommended === 'number') {
    return t.settings.mtuSafe(format.integer(recommended));
  }

  return t.settings.mtuUnknown;
}

function routeBufferbloatSeverityLabel(severity: string, t: DashboardStrings): string {
  switch (severity) {
    case 'none':
      return t.settings.bufferbloatNone;
    case 'low':
      return t.settings.bufferbloatLow;
    case 'medium':
      return t.settings.bufferbloatMedium;
    case 'high':
      return t.settings.bufferbloatHigh;
    default:
      return t.settings.bufferbloatUnknown;
  }
}

function routeBufferbloatRecommendationLabel(recommendation: string, t: DashboardStrings): string {
  switch (recommendation) {
    case 'watch':
      return t.settings.bufferbloatRecommendationWatch;
    case 'sqmRecommended':
      return t.settings.bufferbloatRecommendationSqm;
    case 'avoidUnderLoad':
      return t.settings.bufferbloatRecommendationAvoid;
    default:
      return t.settings.bufferbloatRecommendationNone;
  }
}

function routeDecisionCandidateSourceLabel(candidate: AdminRouteDecisionCandidateSummary, t: DashboardStrings): string {
  if (candidate.source === 'agent') return t.settings.agentTelemetry;
  if (candidate.source === 'outbound') return t.settings.outboundHealth;

  return t.settings.localSample;
}

function telegramSecretSourceLabel(source: string, t: DashboardStrings): string {
  switch (source) {
    case 'database':
      return t.settings.sourceDatabase;
    case 'environment':
      return t.settings.sourceEnvironment;
    default:
      return t.settings.sourceNone;
  }
}

function telegramTestStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'ok':
      return t.settings.telegramTestOk;
    case 'failed':
      return t.settings.telegramTestFailed;
    case 'missingToken':
      return t.settings.telegramTestMissingToken;
    default:
      return t.settings.telegramTestNotTested;
  }
}

function parseTelegramChatIds(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\s,]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function SettingsInput({
  autoComplete,
  disabled = false,
  inputMode,
  label,
  onChange,
  placeholder,
  required = false,
  type = 'text',
  value,
}: {
  autoComplete?: string;
  disabled?: boolean;
  inputMode?: 'numeric';
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: 'text' | 'password' | 'number';
  value: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[13px] font-bold text-afro-muted">{label}</span>
      <input
        autoComplete={autoComplete}
        className="min-h-10 w-full rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45"
        disabled={disabled}
        dir="ltr"
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

function SettingsSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[13px] font-bold text-afro-muted">{label}</span>
      <select
        className="min-h-10 w-full rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value || 'empty'} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function createProtocolSetupConfig(
  draft: WireGuardSetupDraft,
  routeMode: RouteSelectionMode,
  loadBalanceStrategy: LoadBalanceStrategy,
  activeWireGuard: WireGuardHealthCandidate,
  targetServer: ServerRowData | null,
): Record<string, unknown> {
  return {
    serverName: draft.serverName.trim() || undefined,
    interfaceName: draft.interfaceName.trim() || undefined,
    routeGroup: draft.routeGroup.trim() || undefined,
    addressCidr: draft.addressCidr.trim() || undefined,
    listenPort: Number(draft.listenPort) || undefined,
    peerPublicKeyPresent: Boolean(draft.peerPublicKey.trim()),
    peerPublicKey: draft.peerPublicKey.trim() || undefined,
    endpoint: draft.endpoint.trim() || undefined,
    allowedIps: draft.allowedIps.trim() || undefined,
    persistentKeepalive: Number(draft.persistentKeepalive) || undefined,
    healthTarget: draft.healthTarget.trim() || undefined,
    routeMode,
    loadBalanceStrategy,
    activeWireGuardId: activeWireGuard.source === 'outbound' ? activeWireGuard.id : undefined,
    activeWireGuardSource: activeWireGuard.source,
    activeWireGuardInterfaceName: activeWireGuard.interfaceName ?? undefined,
    activeWireGuardServerExternalId: activeWireGuard.serverExternalId ?? undefined,
    targetServerId: targetServer?.id,
    targetServerLabel: targetServer?.name,
    targetServerExternalId: targetServer?.externalId,
  };
}

function outboundToWireGuardCandidate(outbound: AdminOutboundSummary): AdminWireGuardCandidate | null {
  if (outbound.type !== 'wireguard') return null;

  return {
    id: outbound.id,
    name: outbound.name,
    endpoint: extractEndpointFromConfig(outbound.config),
    routeGroup: outbound.routeGroup,
    healthStatus: outbound.healthStatus,
    score: outbound.enabled && !outbound.maintenanceMode ? 55 : 0,
    latencyMs: null,
    jitterMs: null,
    packetLossPercent: null,
    loadPercent: outbound.weight > 0 ? Math.max(0, 100 - Math.min(outbound.weight, 100)) : null,
    serverExternalId: outbound.serverExternalId ?? null,
    serverHostname: outbound.serverHostname ?? null,
    interfaceName: typeof outbound.config.interfaceName === 'string' ? outbound.config.interfaceName : null,
    peerCount: null,
    activePeerCount: null,
    latestHandshakeAgeSeconds: null,
    rxBps: null,
    txBps: null,
    checkedAt: outbound.lastCheckedAt,
    source: 'outbound',
  };
}

function extractEndpointFromConfig(config: Record<string, unknown>): string | null {
  for (const key of ['endpoint', 'healthEndpoint', 'targetEndpoint']) {
    const value = config[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  const host = ['healthHost', 'host', 'targetHost']
    .map((key) => config[key])
    .find((value): value is string => typeof value === 'string' && Boolean(value.trim()));
  const port = ['healthPort', 'port', 'targetPort']
    .map((key) => config[key])
    .find((value): value is string | number => typeof value === 'number' || typeof value === 'string');

  return host ? `${host}${port ? `:${port}` : ''}` : null;
}

function Sidebar({
  activeView,
  isCollapsed,
  isRtl,
  nextLanguage,
  onLanguageChange,
  onSignOut,
  onToggleCollapse,
  onViewChange,
  sidebarAlertState,
  session,
  t,
}: {
  activeView: ActiveView;
  isCollapsed: boolean;
  isRtl: boolean;
  nextLanguage: DashboardLanguage;
  onLanguageChange: (language: DashboardLanguage) => void;
  onSignOut: () => void;
  onToggleCollapse: () => void;
  onViewChange: (view: ActiveView) => void;
  sidebarAlertState: SidebarAlertState | null;
  session: AdminSessionResponse;
  t: DashboardStrings;
}) {
  const visibleNavItems = navItems.filter((item) => {
    if (session.actor.role === 'reseller') return resellerNavViews.has(item.id);
    if (item.id === 'users') return canViewAdminUsers(session);
    if (item.id === 'audit') return canViewAuditLogs(session);
    if (item.id === 'backups') return canViewBackupStatus(session);
    if (item.id === 'reports') return canViewReports(session);

    return true;
  });

  return (
    <aside
      className={`relative bg-afro-sidebar px-4 py-4 text-[#eef6f4] md:px-[18px] lg:flex lg:h-screen lg:flex-col lg:overflow-visible lg:py-6 ${isCollapsed ? 'lg:px-3' : ''}`}
      data-sidebar-collapsed={isCollapsed ? 'true' : 'false'}
    >
      <div className={`flex items-center justify-between gap-3 ${isCollapsed ? 'lg:justify-center' : 'lg:block'}`}>
        <div className={`flex h-10 items-center gap-2.5 text-xl font-bold ${isCollapsed ? 'lg:justify-center' : ''}`}>
          <ShieldCheck size={22} />
          <span className={isCollapsed ? 'lg:sr-only' : ''}>AfroGate</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#91a5a2] lg:hidden">
          <span>v{appVersion}</span>
          <LanguageButton nextLanguage={nextLanguage} onLanguageChange={onLanguageChange} t={t} />
          <SignOutButton onSignOut={onSignOut} t={t} />
        </div>
      </div>
      <SidebarToggle isCollapsed={isCollapsed} isRtl={isRtl} onToggle={onToggleCollapse} t={t} />
      <nav className={`mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-6 lg:flex-1 lg:grid-cols-1 lg:content-start ${isCollapsed ? 'lg:mt-6' : 'lg:mt-8'}`}>
        {visibleNavItems.map((item) => (
          <NavItem
            item={item}
            alertState={item.id === 'alerts' ? sidebarAlertState : null}
            isActive={activeView === item.id}
            isSidebarCollapsed={isCollapsed}
            key={item.id}
            onClick={() => onViewChange(item.id)}
            t={t}
          />
        ))}
      </nav>
      <div className="hidden text-xs text-[#91a5a2] lg:mt-6 lg:block lg:border-t lg:border-[#334852] lg:pt-3">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <LanguageButton nextLanguage={nextLanguage} onLanguageChange={onLanguageChange} t={t} />
            <SignOutButton onSignOut={onSignOut} t={t} />
            <div className="text-[11px] font-bold text-[#c8d7d5]">v{appVersion}</div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-[#c8d7d5]">AfroGate</div>
                <div>v{appVersion}</div>
              </div>
              <div className="flex items-center gap-2">
                <LanguageButton nextLanguage={nextLanguage} onLanguageChange={onLanguageChange} t={t} />
                <SignOutButton onSignOut={onSignOut} t={t} />
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span>{t.languageName}</span>
              <span className="truncate font-bold text-[#c8d7d5]">{t.auth.sessionRole(session.actor.role)}</span>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

function KioskToggleButton({ isActive, onToggle, t }: { isActive: boolean; onToggle: () => void; t: DashboardStrings }) {
  const Icon = isActive ? Minimize2 : Maximize2;
  const label = isActive ? t.exitKioskMode : t.enterKioskMode;

  return (
    <button
      aria-label={label}
      aria-pressed={isActive}
      className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-full border border-afro-line bg-white px-2 text-afro-ink shadow-sm hover:border-afro-blue hover:text-afro-blue"
      data-kiosk-toggle="true"
      onClick={onToggle}
      title={label}
      type="button"
    >
      <Icon className="shrink-0" size={15} />
      <span className="sr-only">{label}</span>
    </button>
  );
}

function SignOutButton({ onSignOut, t }: { onSignOut: () => void; t: DashboardStrings }) {
  return (
    <button
      aria-label={t.auth.signOut}
      className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-[#334852] text-[#c8d7d5] hover:border-[#5c7782] hover:text-white"
      onClick={onSignOut}
      title={t.auth.signOut}
      type="button"
    >
      <LogOut className="shrink-0" size={16} />
    </button>
  );
}

function canViewAdminUsers(session: AdminSessionResponse): boolean {
  return ['superadmin', 'owner', 'admin'].includes(session.actor.role);
}

function canManageAdminUsers(session: AdminSessionResponse): boolean {
  return (session.actor.role === 'superadmin' && session.actor.isSuperAdmin === true) || session.actor.role === 'owner';
}

function canViewAuditLogs(session: AdminSessionResponse): boolean {
  return ['superadmin', 'owner', 'admin', 'supervisor', 'auditor'].includes(session.actor.role);
}

function canViewBackupStatus(session: AdminSessionResponse): boolean {
  return ['superadmin', 'owner', 'admin', 'supervisor', 'auditor'].includes(session.actor.role);
}

function canViewReports(session: AdminSessionResponse): boolean {
  return ['superadmin', 'owner', 'admin', 'supervisor', 'auditor'].includes(session.actor.role);
}

function SidebarToggle({
  isCollapsed,
  isRtl,
  onToggle,
  t,
}: {
  isCollapsed: boolean;
  isRtl: boolean;
  onToggle: () => void;
  t: DashboardStrings;
}) {
  const Icon = isRtl
    ? isCollapsed ? PanelRightOpen : PanelRightClose
    : isCollapsed ? PanelLeftOpen : PanelLeftClose;
  const label = isCollapsed ? t.expandSidebar : t.collapseSidebar;
  const edgeClass = isRtl ? 'lg:-left-4' : 'lg:-right-4';

  return (
    <button
      aria-pressed={isCollapsed}
      aria-label={label}
      className={`absolute top-6 z-20 hidden size-8 items-center justify-center rounded-full border border-[#334852] bg-[#16262d] text-[#c8d7d5] shadow-lg hover:border-[#5c7782] hover:bg-[#1f3138] hover:text-white lg:inline-flex ${edgeClass}`}
      data-sidebar-toggle="true"
      onClick={onToggle}
      title={label}
      type="button"
    >
      <Icon className="shrink-0" size={16} />
    </button>
  );
}

function NavItem({
  alertState,
  item,
  isActive,
  isSidebarCollapsed,
  onClick,
  t,
}: {
  alertState: SidebarAlertState | null;
  item: NavItemData;
  isActive: boolean;
  isSidebarCollapsed: boolean;
  onClick: () => void;
  t: DashboardStrings;
}) {
  const Icon = item.icon;
  const alertClass = alertState
    ? {
        critical: isActive
          ? 'bg-[#4a1118] text-white ring-1 ring-[#ef4444]/50'
          : 'text-[#fecaca] hover:bg-[#3b1014] hover:text-white',
        warning: isActive
          ? 'bg-[#3c2a12] text-white ring-1 ring-[#d9972b]/50'
          : 'text-[#f4d7a1] hover:bg-[#3c2a12] hover:text-white',
      }[alertState.tone]
    : null;
  const defaultClass = isActive ? 'bg-[#1f3138] text-white' : 'text-[#c8d7d5] hover:bg-[#1f3138] hover:text-white';
  const activeClass = alertClass ?? defaultClass;
  const badgeClass = alertState
    ? {
        critical: 'border-[#ef4444] bg-[#dc2626] text-white',
        warning: 'border-[#d9972b] bg-[#f5b84b] text-[#20160a]',
      }[alertState.tone]
    : '';
  const ariaLabel = alertState
    ? `${t.nav[item.labelKey]} ${alertState.countLabel} ${t.status[alertState.tone]}`
    : t.nav[item.labelKey];

  return (
    <button
      aria-current={isActive ? 'page' : undefined}
      aria-label={ariaLabel}
      className={`flex min-h-10 min-w-0 items-center justify-between gap-2 rounded-md px-3 text-left text-sm font-bold ${activeClass} ${isSidebarCollapsed ? 'lg:justify-center lg:px-2' : ''}`}
      data-view={item.id}
      onClick={onClick}
      title={ariaLabel}
      type="button"
    >
      <span className={`flex min-w-0 items-center gap-2 ${isSidebarCollapsed ? 'lg:justify-center' : ''}`}>
        <Icon className="shrink-0" size={18} />
        <span className={`min-w-0 truncate ${isSidebarCollapsed ? 'lg:sr-only' : ''}`}>{t.nav[item.labelKey]}</span>
      </span>
      {alertState ? (
        <span className={`inline-flex min-h-5 min-w-5 shrink-0 items-center justify-center rounded-full border px-1 text-[11px] leading-none ${badgeClass}`}>
          {alertState.countLabel}
        </span>
      ) : null}
    </button>
  );
}

function LanguageButton({
  nextLanguage,
  onLanguageChange,
  variant = 'dark',
  t,
}: {
  nextLanguage: DashboardLanguage;
  onLanguageChange: (language: DashboardLanguage) => void;
  variant?: 'dark' | 'light';
  t: DashboardStrings;
}) {
  const className = variant === 'light'
    ? 'inline-flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-md border border-afro-line px-2 text-afro-ink hover:border-afro-teal hover:text-afro-teal'
    : 'inline-flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-md border border-[#334852] px-2 text-[#c8d7d5] hover:border-[#5c7782] hover:text-white';

  return (
    <button
      aria-label={`${t.switchLanguage}: ${dashboardLanguageLabel(nextLanguage)}`}
      className={className}
      onClick={() => onLanguageChange(nextLanguage)}
      title={`${t.switchLanguage}: ${dashboardLanguageLabel(nextLanguage)}`}
      type="button"
    >
      <Languages className="shrink-0" size={16} />
      <span className="text-[11px] font-bold">{t.nextLanguageLabel}</span>
    </button>
  );
}

function StatusBadge({
  ariaLabel,
  children,
  title,
  tone,
}: {
  ariaLabel?: string;
  children: ReactNode;
  title?: string;
  tone: Tone;
}) {
  const toneClass = {
    good: 'border-[#b8e1cf] bg-[#e7f6ef] text-afro-green',
    neutral: 'border-[#bfd1ea] bg-[#edf4ff] text-afro-blue',
    warning: 'border-[#e6cf9c] bg-[#fff7e6] text-[#9a5b00]',
    critical: 'border-[#f0b7b7] bg-[#fff1f1] text-[#b91c1c]',
  }[tone];
  const tooltip = title ?? primitiveTooltip(children);

  return (
    <span
      aria-label={ariaLabel ?? tooltip}
      className={`inline-flex min-h-[22px] items-center rounded-full border px-1.5 text-[11px] font-bold ${toneClass}`}
      title={tooltip}
    >
      {children}
    </span>
  );
}

function MetricCard({ item }: { item: MetricCardData }) {
  const toneClass = {
    good: 'border-t-afro-green',
    neutral: 'border-t-afro-blue',
    warning: 'border-t-[#c27a1a]',
    critical: 'border-t-[#b91c1c]',
  }[item.tone];
  const tooltip = `${item.label} ${item.value}`;

  return (
    <div
      aria-label={tooltip}
      className={`grid min-h-[62px] gap-1 rounded-md border border-t-4 border-afro-line bg-afro-panel p-2.5 ${toneClass}`}
      title={tooltip}
    >
      <span className="truncate text-[12px] text-afro-muted" title={item.label}>{item.label}</span>
      <strong className="truncate text-[19px] leading-tight" title={item.value}>{item.value}</strong>
    </div>
  );
}

function ServerPanel({
  dataState,
  format,
  servers,
  t,
}: {
  dataState: DataState;
  format: DashboardFormatters;
  servers: ServerRowData[];
  t: DashboardStrings;
}) {
  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.servers} icon={Gauge} meta={t.panels.nodes(format.integer(servers.length))} />
      <div className="mt-2 grid gap-2">
        {servers.length > 0 && dataState !== 'live' ? <DataStateNotice state={dataState} t={t} /> : null}
        {servers.length === 0 ? <DataStateEmpty emptyMessage={t.operationalData.noServers} state={dataState} t={t} /> : null}
        {servers.map((server) => (
          <ServerRow format={format} server={server} key={server.id} t={t} />
        ))}
      </div>
    </section>
  );
}

function ServerRow({ format, server, t }: { format: DashboardFormatters; server: ServerRowData; t: DashboardStrings }) {
  return (
    <div className="grid min-h-[54px] grid-cols-[minmax(116px,1fr)_auto] items-center gap-2 rounded-md border border-afro-line p-2 sm:grid-cols-[minmax(116px,1fr)_auto_auto]">
      <div className="min-w-0">
        <strong className="block truncate text-[13px]">{format.label(server.name)}</strong>
        <span className="block truncate text-[12px] text-afro-muted">{format.label(server.meta)}</span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-afro-muted md:min-w-[170px] md:flex-nowrap">
        <UsageBar format={format} icon={Cpu} label={t.resources.cpu} value={server.cpu} />
        <UsageBar format={format} icon={MemoryStick} label={t.resources.ram} value={server.ram} />
        <UsageBar format={format} icon={HardDrive} label={t.resources.diskFree} value={server.diskFree} invert />
      </div>
      <div className="col-span-2 flex min-w-0 items-center justify-between gap-1.5 sm:col-span-1 sm:justify-end">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:justify-end">
          <MetricPill icon={Download} label={t.resources.down} value={format.bytesPerSecond(server.inboundBps)} />
          <MetricPill icon={Upload} label={t.resources.up} value={format.bytesPerSecond(server.outboundBps)} />
        </div>
        <b className={`shrink-0 text-[17px] ${getScoreClass(server.score)}`}>{format.integer(server.score)}</b>
      </div>
    </div>
  );
}

function UsageBar({
  format,
  icon: Icon,
  label,
  value,
  invert = false,
}: {
  format: DashboardFormatters;
  icon: AfroIcon;
  label: string;
  value: number | null;
  invert?: boolean;
}) {
  const hasValue = typeof value === 'number' && Number.isFinite(value);
  const boundedValue = hasValue ? clamp(value, 0, 100) : 0;
  const fillValue = invert ? 100 - boundedValue : boundedValue;
  const displayValue = format.percent(hasValue ? value : null);

  return (
    <span
      aria-label={`${label} ${displayValue}`}
      className="inline-flex min-h-[19px] min-w-[46px] items-center justify-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] leading-tight text-[#243238]"
      style={{
        background: `linear-gradient(90deg, #a9d8d1 ${fillValue}%, #edf2f4 0)`,
      } as CSSProperties}
      title={`${label} ${displayValue}`}
    >
      <Icon className="shrink-0" size={12} />
      <span className="whitespace-nowrap font-bold">{displayValue}</span>
    </span>
  );
}

function MetricPill({ icon: Icon, label, value }: { icon: AfroIcon; label: string; value: string }) {
  return (
    <span
      aria-label={`${label} ${value}`}
      className="inline-flex min-h-[19px] min-w-[80px] shrink-0 items-center justify-center gap-1 rounded-full bg-[#f4f7f8] px-1.5 py-0.5 text-[11px] font-bold leading-tight text-afro-ink"
      title={`${label} ${value}`}
    >
      <Icon className="shrink-0 text-afro-muted" size={12} />
      <span className="whitespace-nowrap">{value}</span>
    </span>
  );
}

function TunnelPanel({
  dataState,
  emptyMessage,
  format,
  onSelectTunnel,
  selectedTunnelKey,
  t,
  tunnels,
}: {
  dataState: DataState;
  emptyMessage?: string;
  format: DashboardFormatters;
  onSelectTunnel?: (key: string) => void;
  selectedTunnelKey?: string | null;
  t: DashboardStrings;
  tunnels: TunnelRowData[];
}) {
  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.tunnels} icon={Route} meta={t.panels.links(format.integer(tunnels.length))} />
      <div className="mt-2 grid gap-2">
        {tunnels.length > 0 && dataState !== 'live' ? <DataStateNotice state={dataState} t={t} /> : null}
        {tunnels.length === 0 ? (
          <DataStateEmpty emptyMessage={emptyMessage ?? t.operationalData.noTunnels} state={dataState} t={t} />
        ) : null}
        {tunnels.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {[t.tables.tunnel, t.tables.operator, t.tables.ping, t.tables.jitter, t.tables.loss, t.tables.score].map((heading) => (
                    <th className="border-b border-afro-line px-2 py-1.5 text-left text-[13px] font-bold text-afro-muted last:pr-0 last:text-right first:pl-0" key={heading}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tunnels.map((tunnel) => {
                  const key = tunnelRowKey(tunnel);
                  const isSelected = key === selectedTunnelKey;

                  return (
                    <tr className={isSelected ? 'bg-[#edf4ff]' : undefined} key={key}>
                      <TableCell>
                        <button
                          aria-pressed={isSelected}
                          className={`max-w-[180px] truncate text-left font-bold ${isSelected ? 'text-afro-blue' : 'text-afro-ink hover:text-afro-blue'}`}
                          onClick={() => onSelectTunnel?.(key)}
                          title={tunnel.name}
                          type="button"
                        >
                          {tunnel.name}
                        </button>
                      </TableCell>
                      <TableCell>{format.label(tunnel.operator)}</TableCell>
                      <TableCell>{format.latency(tunnel.ping)}</TableCell>
                      <TableCell>{format.latency(tunnel.jitter)}</TableCell>
                      <TableCell>{format.packetLoss(tunnel.loss)}</TableCell>
                      <TableCell alignRight>
                        <strong className={getScoreClass(tunnel.score)}>{format.integer(tunnel.score)}</strong>
                      </TableCell>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PanelHeading({
  title,
  icon: Icon,
  meta,
}: {
  title: string;
  icon: AfroIcon;
  meta?: string;
}) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-2 border-b border-afro-line pb-1.5">
      <PanelHeadingContent title={title} meta={meta} />
      <Icon size={16} />
    </div>
  );
}

function PanelHeadingContent({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <h2 className="truncate text-[14px] font-bold" title={title}>{title}</h2>
      {meta ? <span className={`${mutedTextClass} min-w-0 truncate before:mx-1.5 before:text-afro-line before:content-['/']`} title={meta}>{meta}</span> : null}
    </div>
  );
}

function TableCell({ children, alignRight = false }: { children: ReactNode; alignRight?: boolean }) {
  const alignmentClass = alignRight ? 'text-right' : 'text-left';
  const tooltip = primitiveTooltip(children);

  return (
    <td className={`border-b border-afro-line px-2 py-1.5 text-[13px] text-afro-muted first:pl-0 last:pr-0 ${alignmentClass}`} title={tooltip}>
      {children}
    </td>
  );
}

function mapSnapshotToServerRow(snapshot: ServerMetricSnapshot): ServerRowData {
  return {
    id: snapshot.serverId,
    externalId: snapshot.serverId,
    name: snapshot.hostname || snapshot.serverId,
    meta: snapshot.platform || snapshot.serverId,
    cpu: normalizePercent(snapshot.cpuPercent),
    ram: normalizePercent(snapshot.ramPercent),
    diskFree: normalizePercent(snapshot.diskFreePercent),
    storages: snapshot.storages ?? createStorageFallback(snapshot.diskFreePercent),
    networkInterfaces: snapshot.networkInterfaces ?? [],
    wireGuardInterfaces: snapshot.wireGuardInterfaces ?? [],
    routeProbes: snapshot.routeProbes ?? [],
    inboundBps: normalizePositive(snapshot.inboundBps),
    outboundBps: normalizePositive(snapshot.outboundBps),
    pingMs: normalizePositive(snapshot.pingMs),
    jitterMs: normalizePositive(snapshot.jitterMs),
    packetLossPercent: normalizePercent(snapshot.packetLossPercent),
    score: snapshot.healthScore,
    observedAt: snapshot.observedAt,
    source: 'metrics',
  };
}

function mapAdminServerToServerRow(server: AdminServerSummary): ServerRowData {
  if (server.latestMetric) {
    const row = mapSnapshotToServerRow(server.latestMetric);

    return {
      ...row,
      id: server.id,
      externalId: server.externalId,
      name: server.hostname || server.externalId,
      meta: createServerMeta(server),
      status: server.status,
      role: server.role,
      region: server.region,
      tags: server.tags,
      accessProfile: server.accessProfile,
      outboundCount: server.outboundCount,
      openAlertCount: server.openAlertCount,
      observedAt: server.latestMetric.observedAt || server.lastSeenAt,
      updatedAt: server.updatedAt,
      source: 'admin',
    };
  }

  return {
    id: server.id,
    externalId: server.externalId,
    name: server.hostname || server.externalId,
    meta: createServerMeta(server),
    status: server.status,
    role: server.role,
    region: server.region,
    tags: server.tags,
    cpu: null,
    ram: null,
    diskFree: null,
    storages: [],
    networkInterfaces: [],
    wireGuardInterfaces: [],
    routeProbes: [],
    inboundBps: null,
    outboundBps: null,
    pingMs: null,
    jitterMs: null,
    packetLossPercent: null,
    score: scoreFromHealthState(server.status),
    observedAt: server.lastSeenAt,
    accessProfile: server.accessProfile,
    outboundCount: server.outboundCount,
    openAlertCount: server.openAlertCount,
    updatedAt: server.updatedAt,
    source: 'admin',
  };
}

function createServerMeta(server: AdminServerSummary): string {
  return [server.country, server.region].filter(Boolean).join(' / ') || server.platform || server.externalId;
}

function scoreFromHealthState(status: string): number {
  if (status === 'healthy') return 90;
  if (status === 'degraded') return 60;
  if (status === 'critical') return 25;
  return 50;
}

function mapAdminOutboundToRow(outbound: AdminOutboundSummary): OutboundRowData {
  const statusText = outbound.maintenanceMode
    ? 'maintenance'
    : outbound.enabled
      ? outbound.healthStatus
      : 'disabled';

  return {
    id: outbound.id,
    name: outbound.name,
    type: outbound.type,
    priority: outbound.priority,
    statusText,
    statusTone: mapOutboundStatusToTone(statusText),
    latencyMs: null,
    mode: outbound.routeGroup,
    usageMultiplier: outbound.usageMultiplier ?? 1,
    serverLabel: outbound.serverHostname || outbound.serverExternalId,
  };
}

function mapAdminTunnelToRow(tunnel: AdminTunnelSummary): TunnelRowData {
  return {
    id: tunnel.id,
    name: tunnel.name,
    operator: tunnel.interfaceOperator || tunnel.localInterfaceName || tunnel.interfaceName || tunnel.serverHostname || tunnel.serverExternalId || tunnel.type,
    ping: null,
    jitter: null,
    loss: null,
    score: scoreFromTunnelStatus(tunnel.status),
    type: tunnel.type,
    serverLabel: tunnel.serverHostname || tunnel.serverExternalId,
    routeGroup: tunnel.routeGroup,
    status: tunnel.status,
    lockable: tunnel.lockable,
    localInterfaceName: tunnel.localInterfaceName,
    interfaceName: tunnel.interfaceName,
    remoteEndpoint: tunnel.remoteEndpoint,
    updatedAt: tunnel.updatedAt,
  };
}

function scoreFromTunnelStatus(status: string): number {
  if (status === 'up') return 90;
  if (status === 'down') return 25;
  if (status === 'degraded') return 60;
  return scoreFromHealthState(status);
}

function mapOutboundStatusToTone(status: string): Tone {
  if (status === 'healthy') return 'good';
  if (status === 'critical') return 'critical';
  if (status === 'degraded' || status === 'maintenance') return 'warning';
  return 'neutral';
}

function mapRouteFailoverEventToRow(event: RouteFailoverEventSummary): RouteFailoverRowData {
  return {
    id: event.id,
    title: event.routeGroup,
    detail: event.reason,
    tone: 'neutral',
    createdAt: event.createdAt,
  };
}

function createFallbackFailoverRows(t: DashboardStrings): RouteFailoverRowData[] {
  return [
    { id: 'sample-primary-route-healthy', title: 'Germany gateway', detail: t.failover.primaryRouteHealthy, tone: 'good' },
    { id: 'sample-standby-telegram-api', title: 'Control egress', detail: t.failover.standbyTelegramApi, tone: 'neutral' },
    { id: 'sample-restricted-internet-path', title: 'Iran direct', detail: t.failover.restrictedInternetPath, tone: 'warning' },
  ];
}

function createSummary(
  servers: ServerRowData[],
  trafficTotals: TrafficTotals,
  alerts: AlertRowData[],
  t: DashboardStrings,
  format: DashboardFormatters,
): MetricCardData[] {
  const criticalAlerts = alerts.filter((alert) => !alert.isPlaceholder && alert.severity === 'critical').length;

  return [
    { label: t.summary.activeUsers, value: format.integer(150), tone: 'neutral' },
    { label: t.summary.downloadNow, value: format.bytesPerSecond(trafficTotals.downloadBps), tone: 'good' },
    { label: t.summary.uploadNow, value: format.bytesPerSecond(trafficTotals.uploadBps), tone: 'neutral' },
    { label: t.summary.criticalAlerts, value: format.integer(criticalAlerts), tone: criticalAlerts > 0 ? 'critical' : 'good' },
  ];
}

function createTrafficTotals(servers: ServerRowData[]): TrafficTotals {
  return {
    downloadBps: sumNullable(servers.map((server) => server.inboundBps)),
    uploadBps: sumNullable(servers.map((server) => server.outboundBps)),
  };
}

function createComputedAlertRows(servers: ServerRowData[], t: DashboardStrings): AlertRowData[] {
  const rows: AlertRowData[] = [];

  for (const server of servers) {
    if (server.diskFree !== null && server.diskFree < 10) {
      rows.push({
        id: `${server.id}-storage`,
        title: t.alerts.storageBelow,
        source: server.name,
        severity: 'critical',
      });
    }

    if (server.score < 60) {
      rows.push({
        id: `${server.id}-health`,
        title: t.alerts.healthScoreDegraded,
        source: server.name,
        severity: server.score < 40 ? 'critical' : 'warning',
      });
    }
  }

  if (rows.length > 0) return rows.slice(0, 4);

  return [
    { id: 'sample-no-critical-alerts', title: t.alerts.noCriticalServerAlerts, source: t.alerts.monitoring, severity: 'good', isPlaceholder: true },
    { id: 'sample-outbound-failover-ready', title: t.alerts.outboundFailoverReady, source: t.alerts.routes, severity: 'neutral', isPlaceholder: true },
    { id: 'sample-backup-monitor-pending', title: t.alerts.backupMonitorPending, source: t.alerts.controlPlane, severity: 'warning', isPlaceholder: true },
  ];
}

function mapAdminAlertsToRows(alerts: AdminAlertSummary[], t: DashboardStrings): AlertRowData[] {
  return alerts.map((alert) => ({
    id: alert.id,
    title: localizeAlertTitle(alert.title, t),
    source: alert.sourceLabel || alert.sourceId,
    severity: mapAlertSeverityToTone(alert.severity),
    message: alert.message,
    status: alert.status,
    lastSeenAt: alert.lastSeenAt,
    resolvedAt: alert.resolvedAt,
  }));
}

function createNoOpenAlertsRow(t: DashboardStrings): AlertRowData {
  return {
    id: 'no-open-alerts',
    title: t.alerts.noOpenAlerts,
    source: t.alerts.monitoring,
    severity: 'good',
    isPlaceholder: true,
  };
}

function localizeAlertTitle(title: string, t: DashboardStrings): string {
  const normalizedTitle = title.trim().toLowerCase();

  if (normalizedTitle === 'storage below 10%') return t.alerts.storageBelow;
  if (normalizedTitle === 'health score degraded') return t.alerts.healthScoreDegraded;

  return title;
}

function incidentTimelineEventTitle(event: AdminIncidentTimelineEvent, t: DashboardStrings): string {
  const kind = incidentTimelineKindLabel(event.kind, t);

  if (event.kind === 'alert_opened' || event.kind === 'alert_resolved') {
    return `${kind}: ${localizeAlertTitle(event.title, t)}`;
  }

  return kind;
}

function incidentTimelineEventDetail(
  event: AdminIncidentTimelineEvent,
  format: DashboardFormatters,
  t: DashboardStrings,
): string {
  const details = [
    event.detail,
    event.outboundName ? `${t.incidentTimeline.outbound}: ${format.label(event.outboundName)}` : null,
    event.status ? `${t.tables.status}: ${format.label(event.status)}` : null,
  ].filter((item): item is string => Boolean(item));

  return details.join(' / ') || format.label(event.kind);
}

function incidentTimelineKindLabel(kind: string, t: DashboardStrings): string {
  switch (kind) {
    case 'alert_opened':
      return t.incidentTimeline.kinds.alertOpened;
    case 'alert_resolved':
      return t.incidentTimeline.kinds.alertResolved;
    case 'route_assignment':
      return t.incidentTimeline.kinds.routeAssignment;
    case 'route_decision':
      return t.incidentTimeline.kinds.routeDecision;
    default:
      return t.incidentTimeline.kinds.event;
  }
}

function incidentTimelineSeverityTone(severity: string): Tone {
  if (severity === 'critical') return 'critical';
  if (severity === 'warning') return 'warning';

  return 'neutral';
}

function mapAlertSeverityToTone(severity: string): Tone {
  if (severity === 'critical') return 'critical';
  if (severity === 'warning') return 'warning';
  if (severity === 'healthy' || severity === 'good') return 'good';

  return 'neutral';
}

function countActiveAlertRows(alerts: AlertRowData[]): number {
  return alerts.filter((alert) => !alert.isPlaceholder).length;
}

function createSidebarAlertState(alerts: AlertRowData[], format: DashboardFormatters): SidebarAlertState | null {
  const criticalCount = alerts.filter((alert) => !alert.isPlaceholder && alert.severity === 'critical').length;
  if (criticalCount > 0) {
    return {
      tone: 'critical',
      countLabel: format.integer(criticalCount),
    };
  }

  const warningCount = alerts.filter((alert) => !alert.isPlaceholder && alert.severity === 'warning').length;
  if (warningCount > 0) {
    return {
      tone: 'warning',
      countLabel: format.integer(warningCount),
    };
  }

  return null;
}

function createHealthChartOption(
  series: ServerMetricTimeseries[],
  t: DashboardStrings,
  format: DashboardFormatters,
): AfroChartOption {
  const chartSeries = series.map((item, index) => ({
    name: format.label(item.hostname || item.serverId),
    type: 'line' as const,
    showSymbol: false,
    smooth: true,
    sampling: 'lttb' as const,
    lineStyle: {
      width: 2,
    },
    markLine: index === 0
      ? {
          silent: true,
          symbol: 'none',
          label: {
            color: '#9a5b00',
            formatter: t.chart.watch,
          },
          lineStyle: {
            color: '#c27a1a',
            type: 'dashed' as const,
            width: 1,
          },
          data: [{ yAxis: 60 }],
        }
      : undefined,
    data: item.points.map((point) => [point.observedAt, point.healthScore]),
  }));

  return {
    color: ['#238a4b', '#2764a8', '#c27a1a', '#0f8f83', '#b91c1c'],
    textStyle: {
      fontFamily: format.fontFamily,
    },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value) => format.integer(Math.round(Number(value))),
    },
    legend: {
      top: 0,
      type: 'scroll',
      icon: 'roundRect',
      itemHeight: 8,
      itemWidth: 18,
      textStyle: {
        color: '#60717a',
        fontFamily: format.fontFamily,
      },
    },
    grid: {
      bottom: 24,
      containLabel: true,
      left: 6,
      right: 8,
      top: 36,
    },
    xAxis: {
      type: 'time',
      axisLine: {
        lineStyle: { color: '#dce4e8' },
      },
      axisLabel: {
        color: '#60717a',
        formatter: (value: string | number) => format.chartTime(value),
        hideOverlap: true,
        margin: 8,
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      splitNumber: 4,
      axisLabel: {
        color: '#60717a',
        formatter: (value: string | number) => format.integer(Number(value)),
        margin: 6,
      },
      splitLine: {
        lineStyle: { color: '#edf2f4' },
      },
    },
    dataZoom: [
      {
        type: 'inside',
        throttle: 50,
      },
    ],
    series: chartSeries,
  };
}

function createFallbackTimeseries(
  servers: ServerRowData[],
  range: MetricsTimeRange,
): ServerMetricTimeseries[] {
  const rangeMinutes = {
    '15m': 15,
    '1h': 60,
    '6h': 360,
    '24h': 1440,
  }[range];
  const pointCount = Math.min(48, Math.max(8, Math.round(rangeMinutes / 5)));
  const now = Date.now();
  const stepMs = (rangeMinutes * 60 * 1000) / Math.max(1, pointCount - 1);

  return servers.map((server, serverIndex) => ({
    serverId: server.id,
    hostname: server.name,
    platform: server.meta,
    points: Array.from({ length: pointCount }, (_, pointIndex) => {
      const wave = Math.sin((pointIndex + serverIndex) / 2.4) * 4;
      const drift = pointIndex % 7 === 0 ? -2 : 1;

      return {
        observedAt: new Date(now - (pointCount - pointIndex - 1) * stepMs).toISOString(),
        cpuPercent: server.cpu,
        ramPercent: server.ram,
        diskFreePercent: server.diskFree,
        healthScore: Math.round(clamp(server.score + wave + drift, 0, 100)),
      };
    }),
  }));
}

function getDataStatus(
  dataState: DataState,
  lastUpdated: string | null,
  t: DashboardStrings,
  format: DashboardFormatters,
) {
  const updatedAt = lastUpdated ? ` ${format.time(new Date(lastUpdated), false)}` : '';

  switch (dataState) {
    case 'live':
      return {
        label: `${t.dataStatus.live}${updatedAt}`,
        className: 'border-[#b8e1cf] bg-[#e7f6ef] text-afro-green',
        dotClassName: 'bg-afro-green',
      };
    case 'stale':
      return {
        label: `${t.dataStatus.stale}${updatedAt}`,
        className: 'border-[#e6cf9c] bg-[#fff7e6] text-[#9a5b00]',
        dotClassName: 'bg-[#c27a1a]',
      };
    case 'loading':
      return {
        label: t.dataStatus.loading,
        className: 'border-[#bfd1ea] bg-[#edf4ff] text-afro-blue',
        dotClassName: 'bg-afro-blue',
      };
    default:
      return {
        label: t.dataStatus.fallback,
        className: 'border-afro-line bg-white text-afro-muted',
        dotClassName: 'bg-afro-muted',
      };
  }
}

function getPageHeader(activeView: ActiveView, t: DashboardStrings, session: AdminSessionResponse) {
  if (session.actor.role === 'reseller') {
    if (activeView === 'users') return t.reseller.pageHeaders.users;
    if (activeView === 'billing') return t.reseller.pageHeaders.billing;

    return t.reseller.pageHeaders.dashboard;
  }

  return t.pageHeaders[activeView];
}

function getStorageTone(value: number | null): Tone {
  if (value === null) return 'neutral';
  if (value < 10) return 'critical';
  if (value < 20) return 'warning';
  return 'neutral';
}

function getUsageTone(value: number | null): Tone {
  if (value === null) return 'neutral';
  if (value >= 90) return 'critical';
  if (value >= 75) return 'warning';
  return 'good';
}

function getScoreClass(score: number): string {
  if (score >= 80) return 'text-afro-green';
  if (score >= 60) return 'text-afro-blue';
  if (score >= 40) return 'text-[#c27a1a]';
  return 'text-[#b91c1c]';
}

function getWireGuardScoreTone(score: number): Tone {
  if (score >= 85) return 'good';
  if (score >= 70) return 'neutral';
  if (score >= 50) return 'warning';
  return 'critical';
}

function serverAccessReady(server: ServerRowData): boolean {
  if (!server.accessProfile || server.accessProfile.bootstrapState !== 'installed') return false;

  const credentialReady =
    typeof server.accessProfile.hasActiveCredential === 'boolean'
      ? server.accessProfile.hasActiveCredential
      : server.accessProfile.hasCredentialRef;

  return Boolean(credentialReady);
}

function isServerAccessMethod(value: unknown): value is ServerAccessMethod {
  return value === 'ssh_key' ||
    value === 'temporary_root_password' ||
    value === 'temporary_root_key' ||
    value === 'existing_admin_key';
}

function isServerBootstrapState(value: unknown): value is ServerBootstrapState {
  return value === 'not_started' ||
    value === 'pending' ||
    value === 'installed' ||
    value === 'failed' ||
    value === 'revoked';
}

function isServerCredentialKind(value: unknown): value is ServerCredentialKind {
  return value === 'ssh_private_key' ||
    value === 'ssh_password' ||
    value === 'api_token';
}

function wireGuardCandidateSourceLabel(candidate: WireGuardHealthCandidate, t: DashboardStrings): string {
  if (candidate.source === 'agent') return t.settings.agentTelemetry;
  if (candidate.source === 'outbound') return t.settings.outboundHealth;

  return t.settings.localSample;
}

function latestProtocolApplyEventsBySetupId(
  events: AdminProtocolServerApplyEventSummary[],
): Record<string, AdminProtocolServerApplyEventSummary> {
  return events.reduce<Record<string, AdminProtocolServerApplyEventSummary>>((items, event) => {
    if (!items[event.protocolSetupId]) items[event.protocolSetupId] = event;

    return items;
  }, {});
}

function ProtocolApplyEventsPanel({
  eventDetail,
  events,
  format,
  isDetailLoading,
  onInspectEvent,
  t,
}: {
  eventDetail: AdminProtocolServerApplyEventDetail | null;
  events: AdminProtocolServerApplyEventSummary[];
  format: DashboardFormatters;
  isDetailLoading: boolean;
  onInspectEvent: (eventId: string) => void;
  t: DashboardStrings;
}) {
  return (
    <div className="grid gap-2 border-t border-afro-line pt-3">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <strong className="text-[13px] text-afro-muted">{t.settings.protocolApplyAudit}</strong>
        <StatusBadge tone="neutral">{t.settings.serverApplyNoMutation}</StatusBadge>
      </div>

      {events.length === 0 ? (
        <EmptyState message={t.settings.noProtocolApplyEvents} />
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {events.slice(0, 6).map((event) => {
            const title = event.protocolSetupName ?? event.protocol ?? event.protocolSetupId;
            const meta = [event.protocol, event.routeGroup, event.targetServerLabel].filter(Boolean).join(' / ');

            return (
              <div className="grid gap-1.5 rounded-md border border-afro-line bg-white px-2.5 py-2" key={event.id}>
                <div className="flex min-h-8 items-center justify-between gap-2">
                  <div className="min-w-0">
                    <strong className="block truncate text-[13px]">{title}</strong>
                    <span className={`${mutedTextClass} block truncate`}>{meta || t.settings.pending}</span>
                  </div>
                  <button
                    className="inline-flex min-h-7 shrink-0 items-center justify-center gap-1 rounded-md border border-afro-line bg-white px-2 text-[11px] font-bold text-afro-ink hover:border-afro-teal disabled:cursor-wait disabled:opacity-60"
                    disabled={isDetailLoading}
                    onClick={() => onInspectEvent(event.id)}
                    type="button"
                  >
                    <Eye size={13} />
                    {isDetailLoading ? t.settings.loadingProtocolApplyEvent : t.settings.inspectProtocolApplyEvent}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge tone={event.secretSafe ? 'good' : 'warning'}>
                    {event.secretSafe ? t.settings.secretSafe : t.settings.decisionEventSecretUnsafe}
                  </StatusBadge>
                  <StatusBadge tone={event.canExecute ? 'good' : 'neutral'}>
                    {event.canExecute ? t.settings.serverApplyExecutable : t.settings.serverApplyNoMutation}
                  </StatusBadge>
                  <StatusBadge tone={protocolServerApplyTone(event.applyStatus)}>
                    {protocolServerApplyEventStatusLabel(event.applyStatus, t)}
                  </StatusBadge>
                  <StatusBadge tone={event.applyMode === 'live' ? 'warning' : 'neutral'}>
                    {protocolServerApplyModeLabel(event.applyMode, t)}
                  </StatusBadge>
                  <span className={`${mutedTextClass} min-w-0 truncate`}>{format.time(new Date(event.createdAt), false)}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {event.reasonCodes.slice(0, 4).map((reason) => (
                    <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`${event.id}-${reason}`}>
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {eventDetail ? <ProtocolApplyEventDetailCard detail={eventDetail} format={format} t={t} /> : null}
    </div>
  );
}

function ProtocolApplyEventDetailCard({
  detail,
  format,
  t,
}: {
  detail: AdminProtocolServerApplyEventDetail;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  const snapshot = detail.dryRunSnapshot;

  return (
    <div className="grid gap-2 rounded-md border border-afro-line bg-[#f9fbfc] p-2.5">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <strong className="block truncate text-[13px]">{t.settings.protocolApplyEventContext}</strong>
          <span className={`${mutedTextClass} block truncate`}>
            {detail.protocolSetupName ?? detail.protocolSetupId} / {format.time(new Date(detail.createdAt))}
          </span>
        </div>
        <StatusBadge tone={detail.secretSafe ? 'good' : 'warning'}>
          {detail.secretSafe ? t.settings.secretSafe : t.settings.decisionEventSecretUnsafe}
        </StatusBadge>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricPill
          icon={ShieldCheck}
          label={t.settings.protocolApplySnapshot}
          value={snapshot ? (detail.applyMode === 'live' ? t.settings.protocolApplyRequestSnapshot : t.settings.dryRunSnapshot) : t.settings.noDryRunSnapshot}
        />
        <MetricPill
          icon={Route}
          label={t.settings.protocolApplyMode}
          value={protocolServerApplyModeLabel(detail.applyMode, t)}
        />
        <MetricPill
          icon={SettingsIcon}
          label={t.settings.routeApplyDryRunCommands}
          value={t.settings.dryRunCommandsCount(format.integer(detail.commandCount))}
        />
        <MetricPill
          icon={Network}
          label={t.settings.routeApplyConfigChanges}
          value={t.settings.dryRunConfigChangesCount(format.integer(detail.configChangeCount))}
        />
      </div>

      {snapshot ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge tone={snapshot.dataPlaneMutationExecuted ? 'warning' : snapshot.liveApply ? 'good' : 'neutral'}>
              {snapshot.dataPlaneMutationExecuted
                ? t.settings.serverApplyMutationExecuted
                : snapshot.liveApply
                  ? t.settings.protocolApplyLiveAccepted
                  : t.settings.protocolApplyLiveBlocked}
            </StatusBadge>
            <StatusBadge tone={snapshot.canExecute ? 'good' : 'neutral'}>
              {snapshot.canExecute ? t.settings.serverApplyExecutable : t.settings.serverApplyNoMutation}
            </StatusBadge>
            {snapshot.steps.slice(0, 6).map((step) => (
              <StatusBadge key={step.id} tone={protocolServerApplyStepTone(step.status)}>
                {protocolServerApplyStepLabel(step.kind, t)}
              </StatusBadge>
            ))}
          </div>

          <ProtocolServerApplySecretBadges
            hasSecretRef={snapshot.hasSecretRef}
            requiresSecret={snapshot.requiresSecret}
            secretDecryptAllowed={snapshot.secretDecryptAllowed}
            t={t}
          />
          <ProtocolServerApplyConfigMaterialBadges
            format={format}
            missingFields={snapshot.configMaterialMissingFields}
            ready={snapshot.configMaterialReady}
            t={t}
          />
          <ProtocolServerApplyCommandPolicyBadges
            format={format}
            ready={snapshot.commandPolicyReady}
            t={t}
            violations={snapshot.commandPolicyViolations}
          />
          <ProtocolServerApplyPreflightCard format={format} preflight={snapshot.preflight} t={t} />
          <ProtocolServerApplyAdapterCard adapter={snapshot.adapter} t={t} />
          {snapshot.execution ? (
            <div className="grid gap-1 rounded border border-afro-line bg-white px-2 py-1">
              <strong className="text-[12px] text-afro-muted">{t.settings.protocolApplyExecution}</strong>
              <span className="flex flex-wrap gap-1">
                <StatusBadge tone={snapshot.execution.status === 'succeeded' ? 'good' : snapshot.execution.status === 'rolledBack' ? 'warning' : 'critical'}>
                  {snapshot.execution.status === 'succeeded'
                    ? t.settings.protocolApplyExecutionSucceeded
                    : snapshot.execution.status === 'rolledBack'
                      ? t.settings.protocolApplyExecutionRolledBack
                      : t.settings.protocolApplyExecutionFailed}
                </StatusBadge>
                <StatusBadge tone="neutral">
                  {t.settings.protocolApplyExecutionCommands(
                    format.integer(snapshot.execution.successfulCommandCount),
                    format.integer(snapshot.execution.commandCount),
                  )}
                </StatusBadge>
                {snapshot.execution.rollbackAttempted ? (
                  <StatusBadge tone={snapshot.execution.rollbackSucceeded ? 'good' : 'warning'}>
                    {t.settings.serverApplyRollback}
                  </StatusBadge>
                ) : null}
              </span>
            </div>
          ) : null}

          {snapshot.commands.length > 0 ? (
            <div className="grid gap-1">
              <strong className="text-[12px] text-afro-muted">{t.settings.protocolApplyCommandsPreview}</strong>
              {snapshot.commands.slice(0, 5).map((item) => (
                <div className="grid gap-1 rounded border border-afro-line bg-white px-2 py-1" key={item.id}>
                  <code className="min-w-0 truncate text-[11px] font-bold text-afro-ink" dir="ltr">{item.command}</code>
                  <span className="flex flex-wrap gap-1">
                    <StatusBadge tone={item.dataPlaneMutation ? 'warning' : 'neutral'}>
                      {item.dataPlaneMutation ? t.settings.routeApplyDataPlaneStep : t.settings.routeApplyControlPlaneStep}
                    </StatusBadge>
                    <StatusBadge tone={item.requiresRoot ? 'warning' : 'neutral'}>
                      {item.requiresRoot ? t.settings.routeApplyRootCommand : t.settings.routeApplyUserCommand}
                    </StatusBadge>
                    <StatusBadge tone={item.allowlisted ? 'good' : 'warning'}>
                      {item.allowlisted ? t.settings.protocolApplyCommandPolicyReady : t.settings.protocolApplyCommandPolicyBlocked}
                    </StatusBadge>
                    <StatusBadge tone="neutral">
                      {t.settings.protocolApplyCommandTimeout(format.integer(item.timeoutSeconds))}
                    </StatusBadge>
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {snapshot.configChanges.length > 0 ? (
            <div className="grid gap-1">
              <strong className="text-[12px] text-afro-muted">{t.settings.protocolApplyConfigPreview}</strong>
              {snapshot.configChanges.slice(0, 4).map((item) => (
                <div className="grid gap-0.5 rounded border border-afro-line bg-white px-2 py-1" key={item.id}>
                  <code className="min-w-0 truncate text-[11px] font-bold text-afro-ink" dir="ltr">{item.filePath}</code>
                  <span className={`${mutedTextClass} min-w-0 truncate`}>{item.action}</span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState message={t.settings.noDryRunSnapshot} />
      )}
    </div>
  );
}

function ProtocolServerApplyPreflightCard({
  compact = false,
  format,
  preflight,
  t,
}: {
  compact?: boolean;
  format: DashboardFormatters;
  preflight: AdminProtocolServerApplyPreflightSummary;
  t: DashboardStrings;
}) {
  const visibleGates = preflight.gates.slice(0, compact ? 5 : 9);

  return (
    <div className="grid gap-1.5">
      <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
        <strong className="text-[12px] text-afro-muted">{t.settings.protocolApplyPreflight}</strong>
        <span className="flex flex-wrap items-center gap-1.5">
          <StatusBadge tone={preflight.canRecordDryRun ? 'good' : 'warning'}>
            {preflight.canRecordDryRun ? t.settings.protocolApplyDryRunAllowed : t.settings.protocolApplyDryRunBlocked}
          </StatusBadge>
          <StatusBadge tone={preflight.canExecuteDataPlane ? 'good' : 'neutral'}>
            {preflight.canExecuteDataPlane ? t.settings.protocolApplyLiveReady : t.settings.protocolApplyLiveBlocked}
          </StatusBadge>
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded border border-afro-line bg-white px-1.5 py-0.5 text-[11px] font-bold text-afro-muted">
          {t.settings.protocolApplyGateSummary(
            format.integer(preflight.passedGateCount),
            format.integer(preflight.blockedGateCount),
            format.integer(preflight.futureGateCount),
          )}
        </span>
        {visibleGates.map((gate) => (
          <span className="inline-flex min-h-6 items-center gap-1 rounded border border-afro-line bg-white px-1.5 text-[11px] font-bold" key={gate.id}>
            <span className="text-afro-muted">{protocolApplyGateKindLabel(gate.kind, t)}</span>
            <StatusBadge tone={protocolApplyGateTone(gate.status)}>
              {protocolApplyGateStatusLabel(gate.status, t)}
            </StatusBadge>
          </span>
        ))}
      </div>
      {!compact && preflight.liveApplyBlockedReasonCodes.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {preflight.liveApplyBlockedReasonCodes.slice(0, 6).map((reason) => (
            <span className="rounded border border-afro-line bg-white px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={reason}>
              {reason}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProtocolServerApplyAdapterCard({
  adapter,
  compact = false,
  t,
}: {
  adapter: AdminProtocolServerApplyAdapterSummary;
  compact?: boolean;
  t: DashboardStrings;
}) {
  const boundary = adapter.serverAccessBoundary;

  return (
    <div className="grid gap-1.5 rounded-md border border-afro-line bg-white px-2 py-1.5">
      <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <strong className="block truncate text-[12px] text-afro-muted">{t.settings.protocolApplyAdapter}</strong>
          <span className={`${mutedTextClass} block truncate`}>
            {adapter.protocol ?? '-'} / {adapter.id}
          </span>
        </div>
        <span className="flex flex-wrap items-center justify-end gap-1.5">
          <StatusBadge tone={protocolApplyAdapterStatusTone(adapter.status)}>
            {protocolApplyAdapterStatusLabel(adapter.status, t)}
          </StatusBadge>
          <StatusBadge tone={adapter.commandRunner.mode === 'live' ? 'warning' : 'neutral'}>
            {protocolApplyRunnerModeLabel(adapter.commandRunner.mode, t)}
          </StatusBadge>
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <StatusBadge tone={adapter.enabled ? 'good' : 'neutral'}>
          {adapter.enabled ? t.settings.routeApplyAdapterEnabled : t.settings.routeApplyAdapterDisabled}
        </StatusBadge>
        <StatusBadge tone={adapter.implemented ? 'good' : 'neutral'}>
          {adapter.implemented ? t.settings.protocolApplyAdapterImplemented : t.settings.protocolApplyAdapterNotImplemented}
        </StatusBadge>
        <StatusBadge tone={boundary.accessProfileReady ? 'good' : 'warning'}>
          {boundary.accessProfileReady ? t.settings.accessReady : t.settings.accessPending}
        </StatusBadge>
        <StatusBadge tone={boundary.credentialRecordActive ? 'good' : 'warning'}>
          {boundary.credentialRecordActive ? t.settings.protocolApplyCredentialReady : t.settings.protocolApplyCredentialBlocked}
        </StatusBadge>
        <StatusBadge tone={boundary.credentialDecryptAllowed ? 'good' : 'neutral'}>
          {boundary.credentialDecryptAllowed ? t.settings.protocolApplyCredentialDecryptReady : t.settings.protocolApplyCredentialDecryptBlocked}
        </StatusBadge>
      </div>
      {!compact && adapter.reasonCodes.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {adapter.reasonCodes.slice(0, 7).map((reason) => (
            <span className="rounded border border-afro-line px-1.5 py-0.5 text-[11px] font-bold text-afro-muted" key={`${adapter.id}-${reason}`}>
              {reason}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProtocolServerApplyPlanCard({
  format,
  plan,
  t,
}: {
  format: DashboardFormatters;
  plan: AdminProtocolServerApplyPlanSummary;
  t: DashboardStrings;
}) {
  const visibleSteps = plan.steps.slice(0, 4);

  return (
    <div className="grid gap-2 rounded-md border border-afro-line bg-[#f9fbfc] p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[12px] font-bold text-afro-muted">{t.settings.serverApplyPlan}</span>
        <StatusBadge tone={protocolServerApplyTone(plan.status)}>{protocolServerApplyStatusLabel(plan.status, t)}</StatusBadge>
      </div>
      <div className="grid gap-1.5 text-[12px] sm:grid-cols-3">
        <div className="flex min-h-8 items-center justify-between gap-2 rounded-md border border-afro-line bg-white px-2">
          <span className="truncate text-afro-muted">{t.settings.serverApplyCommands}</span>
          <strong>{format.integer(plan.commandCount)}</strong>
        </div>
        <div className="flex min-h-8 items-center justify-between gap-2 rounded-md border border-afro-line bg-white px-2">
          <span className="truncate text-afro-muted">{t.settings.serverApplyChanges}</span>
          <strong>{format.integer(plan.configChangeCount)}</strong>
        </div>
        <div className="flex min-h-8 items-center justify-between gap-2 rounded-md border border-afro-line bg-white px-2">
          <span className="truncate text-afro-muted">{t.settings.serverApplyTarget}</span>
          <strong className="truncate">{plan.targetServerLabel ?? (plan.targetServerId ? t.settings.configured : t.settings.pending)}</strong>
        </div>
      </div>
      <ProtocolServerApplySecretBadges
        hasSecretRef={plan.hasSecretRef}
        requiresSecret={plan.requiresSecret}
        secretDecryptAllowed={plan.secretDecryptAllowed}
        t={t}
      />
      <ProtocolServerApplyConfigMaterialBadges
        format={format}
        missingFields={plan.configMaterialMissingFields}
        ready={plan.configMaterialReady}
        t={t}
      />
      <ProtocolServerApplyCommandPolicyBadges
        format={format}
        ready={plan.commandPolicyReady}
        t={t}
        violations={plan.commandPolicyViolations}
      />
      <ProtocolServerApplyPreflightCard compact format={format} preflight={plan.preflight} t={t} />
      <ProtocolServerApplyAdapterCard adapter={plan.adapter} compact t={t} />
      <div className="flex flex-wrap gap-1.5">
        {visibleSteps.map((step) => (
          <StatusBadge key={step.id} tone={protocolServerApplyStepTone(step.status)}>
            {protocolServerApplyStepLabel(step.kind, t)}
          </StatusBadge>
        ))}
        <StatusBadge tone={plan.canExecute ? 'good' : 'neutral'}>
          {plan.canExecute ? t.settings.serverApplyExecutable : t.settings.serverApplyNoMutation}
        </StatusBadge>
      </div>
    </div>
  );
}

function ProtocolServerApplyCommandPolicyBadges({
  format,
  ready,
  t,
  violations,
}: {
  format: DashboardFormatters;
  ready: boolean;
  t: DashboardStrings;
  violations: string[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <StatusBadge tone={ready ? 'good' : 'warning'}>
        {ready ? t.settings.protocolApplyCommandPolicyReady : t.settings.protocolApplyCommandPolicyBlocked}
      </StatusBadge>
      {!ready ? (
        <StatusBadge tone="neutral">{t.settings.protocolApplyCommandPolicyViolations(format.integer(violations.length))}</StatusBadge>
      ) : null}
    </div>
  );
}

function ProtocolServerApplyConfigMaterialBadges({
  format,
  missingFields,
  ready,
  t,
}: {
  format: DashboardFormatters;
  missingFields: string[];
  ready: boolean;
  t: DashboardStrings;
}) {
  const missingCount = missingFields.length;

  return (
    <div className="flex flex-wrap gap-1.5">
      <StatusBadge tone={ready ? 'good' : 'warning'}>
        {ready ? t.settings.protocolApplyConfigMaterialReady : t.settings.protocolApplyConfigMaterialBlocked}
      </StatusBadge>
      {!ready ? (
        <StatusBadge tone="neutral">{t.settings.protocolApplyConfigMissingFields(format.integer(missingCount))}</StatusBadge>
      ) : null}
    </div>
  );
}

function ProtocolServerApplySecretBadges({
  hasSecretRef,
  requiresSecret,
  secretDecryptAllowed,
  t,
}: {
  hasSecretRef: boolean;
  requiresSecret: boolean;
  secretDecryptAllowed: boolean;
  t: DashboardStrings;
}) {
  if (!requiresSecret) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      <StatusBadge tone={hasSecretRef ? 'good' : 'warning'}>
        {hasSecretRef ? t.settings.protocolApplySecretReady : t.settings.protocolApplySecretBlocked}
      </StatusBadge>
      <StatusBadge tone={secretDecryptAllowed ? 'good' : 'neutral'}>
        {secretDecryptAllowed ? t.settings.protocolApplySecretDecryptReady : t.settings.protocolApplySecretDecryptBlocked}
      </StatusBadge>
    </div>
  );
}

function protocolServerApplyTone(status: string): Tone {
  switch (status) {
    case 'applyReady':
      return 'good';
    case 'dryRunReady':
      return 'neutral';
    case 'blocked':
      return 'warning';
    case 'planningOnly':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function protocolServerApplyStepTone(status: string): Tone {
  switch (status) {
    case 'ready':
      return 'good';
    case 'blocked':
      return 'warning';
    case 'future':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function protocolApplyGateTone(status: string): Tone {
  switch (status) {
    case 'passed':
      return 'good';
    case 'blocked':
      return 'critical';
    case 'warning':
      return 'warning';
    case 'future':
    case 'notRequired':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function protocolApplyAdapterStatusTone(status: string): Tone {
  switch (status) {
    case 'ready':
      return 'good';
    case 'unsupported':
    case 'missing':
      return 'critical';
    case 'dryRunOnly':
    case 'disabled':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function protocolServerApplyStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'applyReady':
      return t.settings.serverApplyReady;
    case 'dryRunReady':
      return t.settings.serverApplyDryRun;
    case 'blocked':
      return t.settings.serverApplyBlocked;
    case 'planningOnly':
      return t.settings.serverApplyPlanning;
    default:
      return t.settings.pending;
  }
}

function protocolServerApplyEventStatusLabel(status: string, t: DashboardStrings): string {
  if (status === 'recorded') return t.settings.protocolApplyRecorded;

  return protocolServerApplyStatusLabel(status, t);
}

function protocolServerApplyModeLabel(mode: string, t: DashboardStrings): string {
  switch (mode) {
    case 'dryRun':
      return t.settings.protocolApplyModeDryRun;
    case 'live':
      return t.settings.protocolApplyModeLive;
    default:
      return mode;
  }
}

function protocolApplyAdapterStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'ready':
      return t.settings.routeApplyAdapterReady;
    case 'disabled':
      return t.settings.routeApplyAdapterDisabled;
    case 'missing':
      return t.settings.routeApplyAdapterMissing;
    case 'unsupported':
      return t.settings.routeApplyAdapterUnsupported;
    case 'dryRunOnly':
      return t.settings.protocolApplyAdapterDryRunOnly;
    default:
      return status;
  }
}

function protocolApplyRunnerModeLabel(mode: string, t: DashboardStrings): string {
  switch (mode) {
    case 'live':
      return t.settings.protocolApplyRunnerLive;
    case 'dryRunOnly':
      return t.settings.protocolApplyRunnerDryRunOnly;
    case 'disabled':
      return t.settings.protocolApplyRunnerDisabled;
    default:
      return mode;
  }
}

function protocolApplyGateStatusLabel(status: string, t: DashboardStrings): string {
  switch (status) {
    case 'passed':
      return t.settings.protocolApplyGatePassed;
    case 'blocked':
      return t.settings.protocolApplyGateBlocked;
    case 'future':
      return t.settings.protocolApplyGateFuture;
    case 'warning':
      return t.settings.protocolApplyGateWarning;
    case 'notRequired':
      return t.settings.protocolApplyGateNotRequired;
    default:
      return status;
  }
}

function protocolApplyGateKindLabel(kind: string, t: DashboardStrings): string {
  switch (kind) {
    case 'featureFlag':
      return t.settings.protocolApplyGateFeatureFlag;
    case 'adapter':
      return t.settings.protocolApplyGateAdapter;
    case 'dryRunSafety':
      return t.settings.protocolApplyGateDryRunSafety;
    case 'configMaterial':
      return t.settings.protocolApplyGateConfigMaterial;
    case 'commandPolicy':
      return t.settings.protocolApplyGateCommandPolicy;
    case 'outbound':
      return t.settings.protocolApplyGateOutbound;
    case 'outboundHealth':
      return t.settings.protocolApplyGateOutboundHealth;
    case 'defaultInactive':
      return t.settings.protocolApplyGateDefaultInactive;
    case 'secret':
      return t.settings.protocolApplyGateSecret;
    case 'serverAccess':
      return t.settings.protocolApplyGateServerAccess;
    case 'serverCredential':
      return t.settings.protocolApplyGateServerCredential;
    case 'commandRunner':
      return t.settings.protocolApplyGateCommandRunner;
    case 'rollback':
      return t.settings.protocolApplyGateRollback;
    case 'audit':
      return t.settings.protocolApplyGateAudit;
    case 'healthVerification':
      return t.settings.protocolApplyGateHealthVerification;
    default:
      return kind;
  }
}

function protocolServerApplyStepLabel(kind: string, t: DashboardStrings): string {
  switch (kind) {
    case 'preflight':
      return t.settings.serverApplyPreflight;
    case 'secret':
      return t.settings.serverApplySecret;
    case 'serverAccess':
      return t.settings.serverApplyAccess;
    case 'package':
      return t.settings.serverApplyPackage;
    case 'config':
      return t.settings.serverApplyConfig;
    case 'service':
      return t.settings.serverApplyService;
    case 'health':
      return t.settings.serverApplyHealth;
    case 'rollback':
      return t.settings.serverApplyRollback;
    default:
      return kind;
  }
}

function formatWireGuardCandidatePeers(
  candidate: WireGuardHealthCandidate,
  format: DashboardFormatters,
  t: DashboardStrings,
): string {
  if (typeof candidate.peerCount !== 'number' || typeof candidate.activePeerCount !== 'number') return '--';

  return t.settings.activePeers(format.integer(candidate.activePeerCount), format.integer(candidate.peerCount));
}

function formatWireGuardCandidateHandshake(
  candidate: WireGuardHealthCandidate,
  format: DashboardFormatters,
  t: DashboardStrings,
): string {
  if (typeof candidate.latestHandshakeAgeSeconds !== 'number') return t.settings.noHandshake;

  return t.settings.latestHandshakeAge(format.durationSeconds(candidate.latestHandshakeAgeSeconds));
}

function formatWireGuardCandidateRate(candidate: WireGuardHealthCandidate, format: DashboardFormatters): string {
  return `${format.bytesPerSecond(candidate.rxBps ?? null)} / ${format.bytesPerSecond(candidate.txBps ?? null)}`;
}

function routeRecommendationKey(recommendation: RouteQualityRecommendation): string {
  return [
    recommendation.kind,
    recommendation.serverExternalId ?? 'none',
    recommendation.outboundKey ?? recommendation.outboundId ?? 'unassigned',
    recommendation.operator ?? 'unknown',
    recommendation.protocol ?? 'any',
    recommendation.scoreProfile ?? 'any',
    recommendation.dayOfWeek ?? 'anyday',
    recommendation.hourOfDay ?? 'all',
  ].join(':');
}

function routeRecommendationTitle(recommendation: RouteQualityRecommendation, t: DashboardStrings): string {
  if (recommendation.kind === 'upcomingDegradedWindow') return t.settings.upcomingRouteWindow;
  if (recommendation.kind === 'bestWindow') return t.settings.bestRouteWindow;
  if (recommendation.kind === 'degradedWindow') return t.settings.watchRouteWindow;

  return t.settings.noRouteRecommendations;
}

function routeRecommendationDetail(
  recommendation: RouteQualityRecommendation,
  format: DashboardFormatters,
  t: DashboardStrings,
): string {
  const server = recommendation.outboundName || recommendation.serverHostname || recommendation.serverExternalId || t.settings.anyRoute;
  const protocol = recommendation.protocol ? String(recommendation.protocol).toUpperCase() : t.settings.anyProtocol;
  const window = formatRouteHourWindow(recommendation.hourOfDay ?? null, format);
  const samples = t.settings.routeAnalyticsSamples(format.integer(recommendation.sampleCount));
  const startsIn = t.settings.routeAnalyticsStartsIn(formatRouteStartsIn(recommendation.startsInMinutes ?? null, format));

  if (recommendation.kind === 'bestWindow') {
    return t.settings.bestRouteRecommendation(server, protocol, window, samples);
  }
  if (recommendation.kind === 'upcomingDegradedWindow') {
    return t.settings.upcomingRouteRecommendation(server, protocol, window, startsIn, samples);
  }
  if (recommendation.kind === 'degradedWindow') {
    return t.settings.watchRouteRecommendation(server, protocol, window, samples);
  }

  return t.settings.routeAnalyticsNeedsData;
}

function routeRecommendationConfidence(recommendation: RouteQualityRecommendation, t: DashboardStrings): string {
  if (recommendation.confidence === 'high') return t.settings.confidenceHigh;
  if (recommendation.confidence === 'medium') return t.settings.confidenceMedium;

  return t.settings.confidenceLow;
}

function routeRecommendationOperator(
  recommendation: RouteQualityRecommendation,
  format: DashboardFormatters,
  t: DashboardStrings,
): string {
  const operator = recommendation.operator;
  if (!operator || operator === 'unknown') return t.settings.unknownOperator;

  return format.label(operator);
}

function routeRecommendationProfile(
  recommendation: RouteQualityRecommendation,
  format: DashboardFormatters,
  t: DashboardStrings,
): string {
  const profile = recommendation.scoreProfile;
  if (!profile) return t.settings.unknownProfile;

  return format.label(String(profile));
}

function routeHealthHistoryKey(point: RouteHealthHistoryPoint): string {
  return [
    point.bucketStart,
    point.serverExternalId,
    point.outboundKey ?? point.outboundId ?? 'unassigned',
    point.operator ?? 'unknown',
    point.protocol,
    point.scoreProfile ?? 'any',
  ].join(':');
}

function routeHealthPointRoute(
  point: RouteHealthHistoryPoint,
  format: DashboardFormatters,
  t: DashboardStrings,
): string {
  return format.label(point.outboundName || point.serverHostname || point.serverExternalId || t.settings.anyRoute);
}

function routeHealthPointMeta(
  point: RouteHealthHistoryPoint,
  format: DashboardFormatters,
  t: DashboardStrings,
): string {
  const bucket = point.bucketStart ? format.time(new Date(point.bucketStart), false) : '--';
  const operator = point.operator && point.operator !== 'unknown' ? format.label(point.operator) : t.settings.unknownOperator;
  const protocol = point.protocol ? String(point.protocol).toUpperCase() : t.settings.anyProtocol;
  const profile = point.scoreProfile ? format.label(String(point.scoreProfile)) : t.settings.unknownProfile;

  return `${bucket} / ${operator} / ${protocol} / ${profile}`;
}

function formatRouteHourWindow(hourOfDay: number | null, format: DashboardFormatters): string {
  if (hourOfDay === null || !Number.isFinite(hourOfDay)) return '--';

  const startHour = ((Math.trunc(hourOfDay) % 24) + 24) % 24;
  const endHour = (startHour + 1) % 24;

  return `${format.integer(startHour)}:00-${format.integer(endHour)}:00`;
}

function formatRouteStartsIn(minutes: number | null, format: DashboardFormatters): string {
  if (minutes === null || !Number.isFinite(minutes)) return '--';
  if (minutes <= 0) return format.durationMinutes(0);

  return format.durationMinutes(minutes);
}

function normalizePercent(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return clamp(value, 0, 100);
}

function normalizePositive(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, value);
}

function createStorageFallback(diskFreePercent: number | null | undefined): StorageVolumeMetric[] {
  const freePercent = normalizePercent(diskFreePercent);

  return freePercent === null ? [] : [{ path: '/', freePercent, usedPercent: 100 - freePercent }];
}

function averagePercent(values: Array<number | null>): number | null {
  const validValues = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (validValues.length === 0) return null;

  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

function sumNullable(values: Array<number | null>): number | null {
  const validValues = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (validValues.length === 0) return null;

  return validValues.reduce((sum, value) => sum + value, 0);
}

function createDashboardFormatters(language: DashboardLanguage) {
  const isPersian = language === 'fa';
  const locale = isPersian ? 'fa-IR-u-nu-arabext' : 'en-US';
  const percentSign = isPersian ? '٪' : '%';
  const fontFamily = isPersian
    ? '"AfroGate YekanBakh", Tahoma, Arial, sans-serif'
    : 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const integerFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const decimalFormatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });
  const clockFormatter = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    hour12: !isPersian,
    minute: '2-digit',
    second: '2-digit',
  });
  const shortTimeFormatter = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    hour12: !isPersian,
    minute: '2-digit',
  });
  const dateTimeFormatter = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    hour: '2-digit',
    hour12: !isPersian,
    minute: '2-digit',
    month: 'short',
  });

  const integer = (value: number): string => integerFormatter.format(Number.isFinite(value) ? value : 0);
  const decimal = (value: number): string => decimalFormatter.format(Number.isFinite(value) ? value : 0);
  const percent = (value: number | null): string => value === null ? '--' : `${integer(Math.round(value))}${percentSign}`;
  const persianLabels: Record<string, string> = {
    'Iran Edge 01': 'لبه ایران ۰۱',
    'Iran Edge 02': 'لبه ایران ۰۲',
    'Germany Core 01': 'هسته آلمان ۰۱',
    'Germany gateway': 'درگاه آلمان',
    'Control egress': 'خروجی کنترل',
    'Iran direct': 'مسیر مستقیم ایران',
    'Mobinnet': 'مبین‌نت',
    'Irancell': 'ایرانسل',
    'IR': 'ایران',
    'DE': 'آلمان',
    'WireGuard': 'وایرگارد',
    'VLESS proxy': 'پراکسی VLESS',
    'Direct': 'مستقیم',
    'primary': 'اصلی',
    'telegram/api': 'تلگرام/API',
    'last resort': 'آخرین مسیر',
    'balanced': 'متعادل',
    'stability': 'پایداری',
    'throughput': 'سرعت بالا',
    'gaming': 'گیمینگ',
    'tcp': 'TCP',
    'udp': 'UDP',
    'quic': 'QUIC',
    'dns': 'DNS',
    'wireguard': 'WireGuard',
    'ether1 / Mobinnet / wg1': 'ether1 / مبین‌نت / wg1',
    'ether2 / Irancell / wireguard2': 'ether2 / ایرانسل / wireguard2',
    'ether5 / Irancell / wireguard3': 'ether5 / ایرانسل / wireguard3',
    'core uplink / Germany / gateway': 'آپ‌لینک هسته / آلمان / درگاه',
  };

  const formatCompactNumber = (value: number): string => {
    const roundedValue = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;

    return Number.isInteger(roundedValue) ? integer(roundedValue) : decimal(roundedValue);
  };

  return {
    fontFamily,
    integer,
    percent,
    label(value: string): string {
      return isPersian ? persianLabels[value] ?? value : value;
    },
    bytesPerSecond(value: number | null): string {
      if (value === null) return '--';

      const units = isPersian
        ? ['بایت/ث', 'کیلوبایت/ث', 'مگابایت/ث', 'گیگابایت/ث']
        : ['B/s', 'KB/s', 'MB/s', 'GB/s'];
      let currentValue = value;
      let unitIndex = 0;

      while (currentValue >= 1024 && unitIndex < units.length - 1) {
        currentValue /= 1024;
        unitIndex += 1;
      }

      return `${formatCompactNumber(currentValue)} ${units[unitIndex]}`;
    },
    bytes(value: number | null): string {
      if (value === null) return '--';

      const units = isPersian
        ? ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت', 'ترابایت']
        : ['B', 'KB', 'MB', 'GB', 'TB'];
      let currentValue = value;
      let unitIndex = 0;

      while (currentValue >= 1024 && unitIndex < units.length - 1) {
        currentValue /= 1024;
        unitIndex += 1;
      }

      return `${formatCompactNumber(currentValue)} ${units[unitIndex]}`;
    },
    packetLoss(value: number | null): string {
      return value === null ? '--' : `${decimal(value)}${percentSign}`;
    },
    latency(value: number | null): string {
      if (value === null) return '--';

      return isPersian ? `${integer(value)} میلی‌ثانیه` : `${integer(value)} ms`;
    },
    durationSeconds(value: number): string {
      return isPersian ? `${integer(value)} ثانیه` : `${integer(value)}s`;
    },
    durationMinutes(value: number): string {
      if (value <= 0) return isPersian ? 'اکنون' : 'now';

      return isPersian ? `${integer(value)} دقیقه` : `${integer(value)}m`;
    },
    percentThreshold(operator: '<' | '>', value: number): string {
      return `${operator} ${percent(value)}`;
    },
    numberThreshold(operator: '<' | '>', value: number): string {
      return `${operator} ${integer(value)}`;
    },
    latencyThreshold(operator: '<' | '>', value: number): string {
      return `${operator} ${isPersian ? `${integer(value)} میلی‌ثانیه` : `${integer(value)} ms`}`;
    },
    scoreDelta(value: number): string {
      return isPersian ? `+${integer(value)} امتیاز` : `+${integer(value)} score`;
    },
    time(date: Date, includeSeconds = true): string {
      return includeSeconds ? clockFormatter.format(date) : shortTimeFormatter.format(date);
    },
    dateTime(date: Date): string {
      return Number.isNaN(date.getTime()) ? '--' : dateTimeFormatter.format(date);
    },
    timeRange(range: MetricsTimeRange): string {
      if (!isPersian) return timeRanges.find((item) => item.value === range)?.label ?? range;

      const ranges: Record<MetricsTimeRange, string> = {
        '15m': `${integer(15)}د`,
        '1h': `${integer(1)}س`,
        '6h': `${integer(6)}س`,
        '24h': `${integer(24)}س`,
      };

      return ranges[range];
    },
    chartTime(value: string | number): string {
      const timestamp = typeof value === 'number' ? value : Date.parse(value);

      return Number.isFinite(timestamp) ? shortTimeFormatter.format(new Date(timestamp)) : String(value);
    },
  };
}

function dashboardLanguageLabel(language: DashboardLanguage): string {
  return language === 'fa' ? 'فارسی' : 'English';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function useWallClock(format: DashboardFormatters): string {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);

    return () => window.clearInterval(timer);
  }, []);

  return format.time(now);
}
