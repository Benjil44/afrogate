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
  X,
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
import { ReportsPage } from './pages/ReportsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { BackupsPage } from './pages/BackupsPage';
import { AlertsPage } from './pages/AlertsPage';
import { UsersPage } from './pages/UsersPage';
import { DashboardPage } from './pages/DashboardPage';
import { ServersPage } from './pages/ServersPage';
import { RoutesPage } from './pages/RoutesPage';
import { canViewAdminUsers, canViewAuditLogs, canViewBackupStatus, canViewReports } from './session-access';
import { EChart, type AfroChartOption } from './components/EChart';
import { useDashboardLanguage, type DashboardLanguage, type DashboardStrings } from './i18n';
import type {
  ActiveView,
  AfroIcon,
  AlertRowData,
  AlertSeverityFilter,
  AlertStatusFilter,
  BackupsTab,
  BillingTab,
  DataState,
  DataTableColumn,
  DashboardTabItem,
  MetricCardData,
  NavItemData,
  OutboundRowData,
  PanelStateKind,
  ProtocolSetupDraft,
  RouteFailoverRowData,
  RoutesTab,
  ServerEditTab,
  ServerRowData,
  SettingsTab,
  SidebarAlertState,
  TableCellAlign,
  TelegramBotSettingsForm,
  TenantBrandSettingsForm,
  Tone,
  TrafficTotals,
  TunnelRowData,
  UsersTab,
  WireGuardHealthCandidate,
  WireGuardSetupDraft,
} from './dashboard-types';
import {
  averagePercent,
  clamp,
  createDashboardFormatters,
  createStorageFallback,
  dashboardLanguageLabel,
  normalizePercent,
  normalizePositive,
  sumNullable,
  timeRanges,
  useWallClock,
  type DashboardFormatters,
} from './formatters';
import { createDonutChartOption, createFallbackTimeseries, createHealthChartOption } from './chart-options';
import {
  countActiveAlertRows,
  createComputedAlertRows,
  createFallbackFailoverRows,
  createNoOpenAlertsRow,
  createSidebarAlertState,
  createSummary,
  createTrafficTotals,
  incidentTimelineEventDetail,
  incidentTimelineEventTitle,
  incidentTimelineKindLabel,
  incidentTimelineSeverityTone,
  localizeAlertTitle,
  mapAdminAlertsToRows,
  mapAdminOutboundToRow,
  mapAdminServerToServerRow,
  mapAdminTunnelToRow,
  mapRouteFailoverEventToRow,
  mapSnapshotToServerRow,
} from './mappers';
import {
  countTones,
  getHealthTone,
  getScoreClass,
  getStorageTone,
  getUsageTone,
  getWireGuardScoreTone,
  protocolApplyAdapterStatusTone,
  protocolApplyGateTone,
  protocolServerApplyStepTone,
  protocolServerApplyTone,
  serverAccessReady,
} from './tone';
import {
  formatLoadedLatency,
  formatMtuRecommendation,
  parseTelegramChatIds,
  routeApplyAdapterStatusLabel,
  routeApplyAdapterStatusTone,
  routeApplyPlanStatusLabel,
  routeApplyPlanStatusTone,
  routeApplyPlanStepLabel,
  routeClientPreferenceModeLabel,
  routeDecisionActionLabel,
  routeDecisionCandidateSourceLabel,
  routeDecisionDispositionLabel,
  routeDecisionReasonLabel,
  routeDecisionStateLabel,
  routeLoadBalanceStrategyLabel,
  routeLoadBalancingModeLabel,
  routeLoadBalancingModeTone,
  routeLoadBalancingReasonLabel,
  routeLoadBalancingRiskLabel,
  routeLoadBalancingRiskTone,
  routeLoadBalancingRoleLabel,
  routeProfileRecommendationReasonLabel,
  routeScoreProfileLabel,
  routeScoreReasonLabel,
  routeSessionSafetyModeLabel,
  routeSessionSafetyModeTone,
  routeSessionSafetyPolicyLabel,
  routeSessionSafetyReasonLabel,
  routeSessionSafetyRiskLabel,
  routeSessionSafetyRiskTone,
  routeSwitchEngineModeLabel,
  routeSwitchEngineReasonLabel,
  routeSwitchEngineSessionImpactLabel,
  routeSwitchEngineStatusLabel,
  routeSwitchEngineStatusTone,
  routeSwitchEngineStepLabel,
  routeSwitchEngineStepStatusLabel,
  routeSwitchEngineStepStatusTone,
  routeSwitchExecutionPhaseLabel,
  routeSwitchExecutionReasonLabel,
  routeSwitchExecutionStatusLabel,
  routeSwitchExecutionStatusTone,
  routeSwitchOrchestrationActionLabel,
  routeSwitchOrchestrationPhaseLabel,
  routeSwitchOrchestrationReasonLabel,
  routeSwitchOrchestrationStageLabel,
  routeSwitchOrchestrationStageStatusLabel,
  routeSwitchOrchestrationStageStatusTone,
  routeSwitchOrchestrationStatusLabel,
  routeSwitchOrchestrationStatusTone,
  routeSwitchPreflightCheckLabel,
  routeSwitchPreflightCheckStatusLabel,
  routeSwitchPreflightCheckStatusTone,
  routeSwitchPreflightReasonLabel,
  routeSwitchPreflightStatusLabel,
  routeSwitchPreflightStatusTone,
  routeSwitchRolloutEvaluationActionLabel,
  routeSwitchRolloutEvaluationReasonLabel,
  routeSwitchRolloutEvaluationStatusLabel,
  routeSwitchRolloutEvaluationStatusTone,
  routeSwitchRolloutReasonLabel,
  routeSwitchRolloutStatusLabel,
  routeSwitchRolloutStatusTone,
  routeSwitchRolloutStepLabel,
  routeSwitchRolloutStepStatusLabel,
  routeSwitchRolloutStepStatusTone,
  routeSwitchRolloutStrategyLabel,
  routeSwitchRolloutTrafficScopeLabel,
  telegramSecretSourceLabel,
  telegramTestStatusLabel,
} from './route-labels';
import {
  backupArtifactLabel,
  backupIssueLabel,
  backupJobStatusLabel,
  backupJobStatusTone,
  backupRestoreCheckLabel,
  backupRestoreCheckStatusLabel,
  backupRestoreCheckStatusTone,
  backupRestoreReadinessLabel,
  backupRestoreReadinessTone,
  backupRestoreReasonLabel,
  backupRestoreSafetyNoteLabel,
  backupRestoreStepLabel,
  backupStatusAgeTone,
  backupStatusEncryptionTone,
  backupStatusLabel,
  backupStatusTone,
  billingStatusTone,
  currentPanelKindLabel,
  currentPanelStatusLabel,
  currentPanelStatusTone,
  customerAccountStatusLabel,
  customerQuotaScopeLabel,
  formatBackupAgeDays,
  formatBackupAgeHours,
  formatBackupDate,
  formatBackupDuration,
  formatMoneyAmount,
  paymentAdapterStatusLabel,
  paymentAdapterStatusTone,
  paymentCheckoutModeLabel,
  paymentProviderLabel,
  paymentSettlementLabel,
  paymentVerificationLabel,
  protocolApplyAdapterStatusLabel,
  protocolApplyGateKindLabel,
  protocolApplyGateStatusLabel,
  protocolApplyRunnerModeLabel,
  protocolServerApplyEventStatusLabel,
  protocolServerApplyModeLabel,
  protocolServerApplyStatusLabel,
  protocolServerApplyStepLabel,
  reportReasonLabel,
  reportRiskLabel,
  reportRiskTone,
  resellerWalletEntryTypeLabel,
  resellerWalletSourceLabel,
} from './labels';
import {
  fieldInputClass,
  fieldLabelClass,
  formLabelClass,
  inputClass,
  mutedTextClass,
  panelClass,
  primaryButtonClass,
} from './ui-classes';
import {
  DataStateEmpty,
  DataStateNotice,
  DetailRow,
  EmptyState,
  PanelState,
  dataStatePanelDetail,
  dataStatePanelKind,
  dataStatePanelTitle,
  panelStateClass,
  panelStateIcon,
  primitiveTooltip,
  DashboardTabs,
  DataTable,
  MetricCard,
  MetricPill,
  PanelHeading,
  PanelHeadingContent,
  StatusBadge,
  UsageBar,
  BackupMetricCard,
} from './components/primitives';
import { ServerPanel, TunnelPanel, tunnelRowKey } from './components/panels';
import { AlertsPanel, CapacityPanel, ControlPlanePanel, DashboardOverviewChartsPanel, HealthChartPanel, OutboundsPanel } from './components/dashboard-panels';
import {
  RouteDecisionCandidateCard,
  RouteDecisionMetric,
  RouteDecisionPreviewPanel,
  RouteDecisionSwitchOrchestrationCard,
  RouteDecisionSwitchRolloutCard,
  RouteIntelligencePanel,
} from './components/route-decision';
import {
  formatRouteHourWindow,
  formatWireGuardCandidateHandshake,
  formatWireGuardCandidatePeers,
  formatWireGuardCandidateRate,
  routeHealthHistoryKey,
  routeHealthPointMeta,
  routeHealthPointRoute,
  routeRecommendationConfidence,
  routeRecommendationDetail,
  routeRecommendationKey,
  routeRecommendationOperator,
  routeRecommendationProfile,
  routeRecommendationTitle,
} from './route-helpers';
import {
  formatWireGuardHandshake,
  formatWireGuardPeerSummary,
  inventoryStatusLabel,
  inventoryStatusTone,
  summarizeRouteProbes,
  summarizeWireGuardInterfaces,
  wireGuardStatusLabel,
  wireGuardTone,
} from './server-helpers';

type AdminSessionHook = ReturnType<typeof useAdminSession>;

const refreshIntervalMs = 10_000;

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
const protocolDefaultPorts: Record<ProtocolKind, string> = {
  wireguard: '51820',
  vless: '443',
  l2tp: '1701',
  ikev2: '500',
};

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

      <section className="min-w-0 max-w-full overflow-x-hidden p-3 md:p-4 lg:h-screen lg:overflow-y-auto">
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
  const [isResellerAddUserDialogOpen, setIsResellerAddUserDialogOpen] = useState(false);
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
      setIsResellerAddUserDialogOpen(false);
    } catch {
      setResellerSaleMessage(t.billing.resellerPackageSaleFailed);
    } finally {
      setIsSellingResellerPackage(false);
    }
  };

  const resetResellerSaleForm = () => {
    setResellerSaleForm((current) => ({
      ...createEmptyResellerPackageSaleForm(),
      volumePackageId: current.volumePackageId,
    }));
  };

  const openResellerAddUserDialog = () => {
    resetResellerSaleForm();
    setResellerSaleMessage(null);
    setIsResellerAddUserDialogOpen(true);
  };

  const closeResellerAddUserDialog = () => {
    if (isSellingResellerPackage) return;
    resetResellerSaleForm();
    setResellerSaleMessage(null);
    setIsResellerAddUserDialogOpen(false);
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

      <ResellerAddUserDialog
        accounts={workspace.accounts}
        format={format}
        form={resellerSaleForm}
        isOpen={isResellerAddUserDialogOpen}
        isSelling={isSellingResellerPackage}
        message={resellerSaleMessage}
        onClose={closeResellerAddUserDialog}
        onFormChange={setResellerSaleForm}
        onSubmit={handleCreateResellerUser}
        packages={workspace.packages}
        t={t}
      />

      <ResellerUsersTable
        accounts={workspace.accounts}
        actionMessage={isResellerAddUserDialogOpen ? null : resellerSaleMessage}
        format={format}
        onAddUser={openResellerAddUserDialog}
        paymentOrders={workspace.paymentOrders}
        t={t}
      />
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
  actionMessage,
  format,
  onAddUser,
  paymentOrders,
  t,
}: {
  accounts: AdminCustomerAccountSummary[];
  actionMessage?: string | null;
  format: DashboardFormatters;
  onAddUser?: () => void;
  paymentOrders: AdminPaymentOrderSummary[];
  t: DashboardStrings;
}) {
  const soldUserRows = accounts.map((account) => {
    const customerOrders = paymentOrders.filter((order) => order.customerAccountId === account.id && isCompletedResellerSaleOrder(order));
    const soldBytes = customerOrders.reduce((sum, order) => sum + order.volumeBytes, 0);
    const latestSale = customerOrders
      .map((order) => order.paidAt ?? order.createdAt)
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;

    return {
      account,
      latestSale,
      orderCount: customerOrders.length,
      soldBytes,
    };
  });
  const soldUserColumns: Array<DataTableColumn<(typeof soldUserRows)[number]>> = [
    {
      key: 'customer',
      header: t.billing.customer,
      render: (row) => (
        <>
          <strong className="block text-afro-ink">{resellerCustomerName(row.account)}</strong>
          <span className="text-[12px] text-afro-muted">{row.account.telegramUsername ?? row.account.id.slice(0, 8)}</span>
        </>
      ),
    },
    {
      key: 'clients',
      header: t.billing.clients,
      render: (row) => `${format.integer(row.account.activeClientCount)} / ${format.integer(row.account.clientCount)}`,
    },
    { key: 'usedQuota', header: t.billing.usedQuota, render: (row) => format.bytes(row.account.usedBytes) },
    {
      key: 'remaining',
      header: t.billing.remaining,
      render: (row) => row.account.remainingBytes === null || row.account.remainingBytes === undefined ? t.billing.unlimited : format.bytes(row.account.remainingBytes),
    },
    { key: 'soldVolume', header: t.reseller.soldVolume, render: (row) => format.bytes(row.soldBytes) },
    { key: 'orders', header: t.reseller.orders, render: (row) => format.integer(row.orderCount) },
    { key: 'lastSale', header: t.reseller.lastSale, render: (row) => row.latestSale ? format.dateTime(new Date(row.latestSale)) : '--' },
    {
      key: 'status',
      header: t.billing.status,
      render: (row) => <StatusBadge tone={billingStatusTone(row.account.status)}>{customerAccountStatusLabel(row.account.status, t)}</StatusBadge>,
    },
  ];

  return (
    <section className={panelClass}>
      <div className="flex min-h-7 flex-wrap items-center justify-between gap-2 border-b border-afro-line pb-1.5">
        <PanelHeadingContent title={t.reseller.soldUsers} meta={t.billing.accountsLoaded(format.integer(accounts.length))} />
        <button
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-afro-sidebar px-3 text-sm font-bold text-white hover:bg-[#1f3138]"
          onClick={onAddUser}
          type="button"
        >
          <Plus size={16} />
          {t.reseller.addUser}
        </button>
      </div>
      {actionMessage ? <p className={`${mutedTextClass} mt-2`}>{actionMessage}</p> : null}
      {accounts.length === 0 ? <div className="mt-2"><EmptyState message={t.billing.noCustomerAccounts} /></div> : null}
      {accounts.length > 0 ? (
        <div className="mt-2">
          <DataTable columns={soldUserColumns} minWidth="880px" rowKey={(row) => row.account.id} rows={soldUserRows} />
        </div>
      ) : null}
    </section>
  );
}

function ResellerAddUserDialog({
  accounts,
  format,
  form,
  isOpen,
  isSelling,
  message,
  onClose,
  onFormChange,
  onSubmit,
  packages,
  t,
}: {
  accounts: AdminCustomerAccountSummary[];
  format: DashboardFormatters;
  form: ResellerPackageSaleFormState;
  isOpen: boolean;
  isSelling: boolean;
  message: string | null;
  onClose: () => void;
  onFormChange: (form: ResellerPackageSaleFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  packages: AdminVolumePackageSummary[];
  t: DashboardStrings;
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-afro-sidebar/55 px-3 py-6 backdrop-blur-sm sm:px-6"
      onClick={onClose}
    >
      <div
        aria-labelledby="reseller-add-user-title"
        aria-modal="true"
        className="mx-auto mt-[min(12vh,96px)] w-full max-w-4xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <ResellerPackageSalePanel
          accounts={accounts}
          format={format}
          form={form}
          isSelling={isSelling}
          message={message}
          onClose={onClose}
          onFormChange={onFormChange}
          onSubmit={onSubmit}
          packages={packages}
          submitLabel={t.reseller.addUser}
          t={t}
          title={t.reseller.addUser}
          titleId="reseller-add-user-title"
        />
      </div>
    </div>
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
  const [activeBillingTab, setActiveBillingTab] = useState<BillingTab>('catalog');
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

  const billingTabs: Array<DashboardTabItem<BillingTab>> = [
    { id: 'catalog', label: t.tabs.billingCatalog, meta: t.billing.packagesLoaded(format.integer(packages.length)) },
    { id: 'customers', label: t.tabs.billingCustomers, meta: t.billing.accountsLoaded(format.integer(accounts.length)) },
    { id: 'panelImport', label: t.tabs.billingPanelImport, meta: t.billing.currentPanelReadOnly },
    { id: 'telegram', label: t.tabs.billingTelegram, meta: t.billing.ordersLoaded(format.integer(paymentOrders.length)) },
    { id: 'orders', label: t.tabs.billingOrders, meta: t.billing.ordersLoaded(format.integer(paymentOrders.length)) },
  ];

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

      {!isResellerSession ? (
        <DashboardTabs
          activeTab={activeBillingTab}
          ariaLabel={t.tabs.billingSections}
          onChange={setActiveBillingTab}
          tabs={billingTabs}
        />
      ) : null}

      <section className={`grid gap-3 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)] ${!isResellerSession && activeBillingTab !== 'catalog' ? 'hidden' : ''}`}>
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

      <section className={`grid gap-3 xl:grid-cols-[minmax(340px,0.8fr)_minmax(0,1.2fr)] ${!isResellerSession && activeBillingTab !== 'customers' ? 'hidden' : ''}`}>
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
          <div className={activeBillingTab === 'panelImport' ? '' : 'hidden'}>
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
          </div>
          <div className={activeBillingTab === 'telegram' ? '' : 'hidden'}>
            <TelegramBotOperationsPanel
              accounts={accounts}
              canViewTelegramOperations={canViewTelegramOperations}
              format={format}
              paymentOrders={paymentOrders}
              telegramBotSettings={telegramBotSettings}
              t={t}
            />
          </div>
        </>
      ) : null}
      <div className={isResellerSession || activeBillingTab === 'orders' ? '' : 'hidden'}>
        <PaymentOrdersPanel format={format} paymentOrders={paymentOrders} t={t} />
      </div>
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
  const walletLedgerColumns: Array<DataTableColumn<AdminResellerWalletLedgerEntry>> = [
    {
      key: 'entry',
      header: t.billing.walletEntry,
      render: (entry) => <StatusBadge tone={entry.amount >= 0 ? 'good' : 'warning'}>{resellerWalletEntryTypeLabel(entry.entryType, t)}</StatusBadge>,
    },
    {
      key: 'amount',
      header: t.billing.amount,
      render: (entry) => formatMoneyAmount(entry.amount, entry.currency, format),
    },
    {
      key: 'balanceAfter',
      header: t.billing.balanceAfter,
      render: (entry) => formatMoneyAmount(entry.balanceAfterAmount, entry.currency, format),
    },
    { key: 'source', header: t.billing.source, render: (entry) => resellerWalletSourceLabel(entry.source, t) },
    { key: 'package', header: t.billing.packageName, render: (entry) => entry.volumePackageName ?? '--' },
    { key: 'createdAt', header: t.billing.createdAt, render: (entry) => format.dateTime(new Date(entry.createdAt)) },
  ];

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
          {ledgerEntries.length > 0 ? (
            <div className="mt-2">
              <DataTable columns={walletLedgerColumns} minWidth="760px" rowKey={(entry) => entry.id} rows={ledgerEntries} />
            </div>
          ) : (
            <div className="mt-2">
              <EmptyState message={t.billing.noWalletLedgerEntries} />
            </div>
          )}
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
  onClose,
  onFormChange,
  onSubmit,
  packages,
  submitLabel,
  t,
  title,
  titleId,
}: {
  accounts: AdminCustomerAccountSummary[];
  format: DashboardFormatters;
  form: ResellerPackageSaleFormState;
  isSelling: boolean;
  message: string | null;
  onClose?: () => void;
  onFormChange: (form: ResellerPackageSaleFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  packages: AdminVolumePackageSummary[];
  submitLabel?: string;
  t: DashboardStrings;
  title?: string;
  titleId?: string;
}) {
  const activePackages = packages.filter((item) => item.status === 'active');
  const selectedPackage = activePackages.find((item) => item.id === form.volumePackageId) ?? null;
  const panelTitle = title ?? t.billing.resellerPackageSale;
  const updateForm = (patch: Partial<ResellerPackageSaleFormState>) => onFormChange({ ...form, ...patch });

  return (
    <section className={panelClass}>
      <div className="flex min-h-7 items-center justify-between gap-2 border-b border-afro-line pb-1.5">
        <PanelHeadingContent
          title={panelTitle}
          meta={selectedPackage ? `${format.bytes(selectedPackage.volumeBytes)} / ${formatMoneyAmount(selectedPackage.totalPrice, selectedPackage.currency, format)}` : t.billing.selectPackage}
          titleId={titleId}
        />
        <div className="flex shrink-0 items-center gap-2 text-afro-muted">
          <CreditCard size={16} />
          {onClose ? (
            <button
              aria-label={t.actions.cancel}
              className="inline-flex size-8 items-center justify-center rounded-md border border-afro-line bg-white text-afro-muted hover:border-afro-blue hover:text-afro-blue disabled:cursor-not-allowed disabled:opacity-55"
              disabled={isSelling}
              onClick={onClose}
              title={t.actions.cancel}
              type="button"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>
      </div>
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
  const candidateRows = candidates.slice(0, 8);
  const candidateColumns: Array<DataTableColumn<(typeof candidateRows)[number]>> = [
    {
      key: 'candidate',
      header: t.billing.currentPanelCandidate,
      render: (candidate) => (
        <>
          <strong className="block text-afro-ink">{candidate.label}</strong>
          <span className="text-[12px] text-afro-muted">{candidate.username ?? candidate.externalPanelUserId ?? candidate.protocol}</span>
        </>
      ),
    },
    {
      key: 'kind',
      header: t.billing.currentPanelKind,
      render: () => currentPanelPreview ? currentPanelKindLabel(currentPanelPreview.panelKind as CurrentPanelKind, t) : '--',
    },
    {
      key: 'usedQuota',
      header: t.billing.usedQuota,
      render: (candidate) => candidate.usedBytes === null || candidate.usedBytes === undefined ? '--' : format.bytes(candidate.usedBytes),
    },
    {
      key: 'totalQuota',
      header: t.billing.totalQuota,
      render: (candidate) => candidate.quotaBytes === null || candidate.quotaBytes === undefined ? t.billing.unlimited : format.bytes(candidate.quotaBytes),
    },
    {
      key: 'remaining',
      header: t.billing.remaining,
      render: (candidate) => candidate.remainingBytes === null || candidate.remainingBytes === undefined ? t.billing.unlimited : format.bytes(candidate.remainingBytes),
    },
    {
      key: 'status',
      header: t.billing.status,
      render: (candidate) => (
        <StatusBadge tone={currentPanelStatusTone(candidate.status)}>
          {currentPanelStatusLabel(candidate.status, t)}
        </StatusBadge>
      ),
    },
  ];

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
            <DataTable
              columns={candidateColumns}
              minWidth="760px"
              rowKey={(candidate) => `${candidate.externalPanel}:${candidate.externalPanelUserId ?? candidate.label}`}
              rows={candidateRows}
            />
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
  const visiblePackages = packages.slice(0, 8);
  const packageColumns: Array<DataTableColumn<AdminVolumePackageSummary>> = [
    {
      key: 'package',
      header: t.billing.packageName,
      render: (item) => (
        <>
          <strong className="block text-afro-ink">{item.name}</strong>
          <span className="text-[12px] text-afro-muted">{item.slug}</span>
        </>
      ),
    },
    { key: 'volume', header: t.billing.volume, render: (item) => format.bytes(item.volumeBytes) },
    { key: 'price', header: t.billing.price, render: (item) => `${format.integer(item.totalPrice)} ${format.label(item.currency)}` },
    { key: 'duration', header: t.billing.duration, render: (item) => item.durationDays ? t.billing.days(format.integer(item.durationDays)) : t.billing.noExpiry },
    {
      key: 'status',
      header: t.billing.status,
      render: (item) => <StatusBadge tone={billingStatusTone(item.status)}>{format.label(item.status)}</StatusBadge>,
    },
  ];
  const paymentProviderAdapterColumns: Array<DataTableColumn<AdminPaymentProviderAdapterSummary>> = [
    { key: 'provider', header: t.billing.provider, render: (adapter) => paymentProviderLabel(adapter.provider, t) },
    { key: 'checkout', header: t.billing.checkoutMode, render: (adapter) => paymentCheckoutModeLabel(adapter.checkoutMode, t) },
    { key: 'settlement', header: t.billing.settlement, render: (adapter) => paymentSettlementLabel(adapter.settlementMode, t) },
    { key: 'verification', header: t.billing.verification, render: (adapter) => paymentVerificationLabel(adapter.supportsWebhookVerification, t) },
    {
      key: 'status',
      header: t.billing.status,
      render: (adapter) => (
        <StatusBadge tone={paymentAdapterStatusTone(adapter.status)}>
          {paymentAdapterStatusLabel(adapter.status, t)}
        </StatusBadge>
      ),
    },
  ];

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
          <DataTable columns={packageColumns} minWidth="620px" rowKey={(item) => item.id} rows={visiblePackages} />
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
            <DataTable
              columns={paymentProviderAdapterColumns}
              minWidth="760px"
              rowKey={(adapter) => adapter.provider}
              rows={paymentProviderAdapters}
            />
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
  const visiblePaymentOrders = paymentOrders.slice(0, 10);
  const paymentOrderColumns: Array<DataTableColumn<AdminPaymentOrderSummary>> = [
    {
      key: 'customer',
      header: t.billing.customer,
      render: (order) => (
        <>
          <strong className="block text-afro-ink">{order.customerDisplayName || order.customerTelegramUsername || order.customerAccountId.slice(0, 8)}</strong>
          <span className="text-[12px] text-afro-muted">{format.time(new Date(order.createdAt), false)}</span>
        </>
      ),
    },
    { key: 'package', header: t.billing.packageName, render: (order) => order.packageName },
    { key: 'amount', header: t.billing.amount, render: (order) => `${format.integer(order.amount)} ${format.label(order.currency)}` },
    { key: 'provider', header: t.billing.provider, render: (order) => format.label(order.provider) },
    {
      key: 'status',
      header: t.billing.status,
      render: (order) => <StatusBadge tone={billingStatusTone(order.status)}>{format.label(order.status)}</StatusBadge>,
    },
    {
      key: 'allocation',
      header: t.billing.allocation,
      render: (order) => {
        const allocationStatus = order.allocationStatus ?? 'not_applicable';

        return (
          <StatusBadge tone={billingStatusTone(allocationStatus)}>
            {format.label(allocationStatus)}
          </StatusBadge>
        );
      },
    },
  ];

  return (
    <section className={panelClass}>
      <PanelHeading title={t.billing.paymentOrders} icon={CreditCard} meta={t.billing.ordersLoaded(format.integer(paymentOrders.length))} />
      <div className="mt-2 grid gap-2">
        {paymentOrders.length === 0 ? <EmptyState message={t.billing.noPaymentOrders} /> : null}
        {paymentOrders.length > 0 ? (
          <DataTable
            columns={paymentOrderColumns}
            minWidth="760px"
            rowKey={(order) => order.id}
            rows={visiblePaymentOrders}
          />
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
  const visibleAccounts = accounts.slice(0, 10);
  const customerAccountColumns: Array<DataTableColumn<AdminCustomerAccountSummary>> = [
    {
      key: 'customer',
      header: t.billing.customer,
      render: (account) => (
        <>
          <strong className="block text-afro-ink">
            {account.displayName || account.telegramUsername || account.telegramId || account.id.slice(0, 8)}
          </strong>
          <span className="text-[12px] text-afro-muted">{format.time(new Date(account.updatedAt), false)}</span>
        </>
      ),
    },
    {
      key: 'clients',
      header: t.billing.clients,
      render: (account) => `${format.integer(account.activeClientCount)} / ${format.integer(account.clientCount)}`,
    },
    { key: 'usedQuota', header: t.billing.usedQuota, render: (account) => format.bytes(account.usedBytes) },
    {
      key: 'remaining',
      header: t.billing.remaining,
      render: (account) => account.remainingBytes === null || account.remainingBytes === undefined ? t.billing.unlimited : format.bytes(account.remainingBytes),
    },
    { key: 'quotaScope', header: t.billing.quotaScope, render: (account) => format.label(account.quotaScope) },
    {
      key: 'status',
      header: t.billing.status,
      render: (account) => <StatusBadge tone={billingStatusTone(account.status)}>{format.label(account.status)}</StatusBadge>,
    },
  ];

  return (
    <section className={panelClass}>
      <PanelHeading title={t.billing.customerAccounts} icon={UserRound} meta={t.billing.accountsLoaded(format.integer(accounts.length))} />
      <div className="mt-2 grid gap-2">
        {accounts.length === 0 ? <EmptyState message={t.billing.noCustomerAccounts} /> : null}
        {accounts.length > 0 ? (
          <DataTable
            columns={customerAccountColumns}
            minWidth="720px"
            rowKey={(account) => account.id}
            rows={visibleAccounts}
          />
        ) : null}
      </div>
    </section>
  );
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
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('route');
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

  const settingsTabs: Array<DashboardTabItem<SettingsTab>> = [
    {
      id: 'route',
      label: t.tabs.settingsRoute,
      meta: routeMode === 'automatic' ? t.settings.automatic : t.settings.manual,
    },
    {
      id: 'wireguard',
      label: t.tabs.settingsWireGuard,
      meta: format.integer(wireGuardCandidates.length),
    },
    {
      id: 'protocols',
      label: t.tabs.settingsProtocols,
      meta: format.integer(persistedProtocolSetups.length),
    },
    {
      id: 'branding',
      label: t.tabs.settingsBranding,
      meta: tenantBrandForm.publicBrandingEnabled ? t.settings.enabled : t.settings.disabled,
    },
    {
      id: 'telegram',
      label: t.tabs.settingsTelegram,
      meta: telegramBotSettings?.hasBotToken ? t.settings.configured : t.settings.pending,
    },
  ];
  const settingsHasSideRail = activeSettingsTab === 'route' || activeSettingsTab === 'wireguard' || activeSettingsTab === 'protocols';

  return (
    <section className="mt-3 grid gap-3">
      <DashboardTabs
        activeTab={activeSettingsTab}
        ariaLabel={t.tabs.settingsSections}
        onChange={setActiveSettingsTab}
        tabs={settingsTabs}
      />

      <section className={settingsHasSideRail ? 'grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]' : 'grid gap-3'}>
      <section className="grid gap-3">
        <section className={`${panelClass} ${activeSettingsTab === 'route' ? '' : 'hidden'}`}>
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

        <section className={`${panelClass} ${activeSettingsTab === 'branding' ? '' : 'hidden'}`}>
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

        <section className={`${panelClass} ${activeSettingsTab === 'telegram' ? '' : 'hidden'}`}>
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

        <section className={`${panelClass} ${activeSettingsTab === 'protocols' ? '' : 'hidden'}`}>
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

        <section className={`${panelClass} ${activeSettingsTab === 'wireguard' ? '' : 'hidden'}`}>
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

      <section className={`grid gap-3 ${settingsHasSideRail ? '' : 'hidden'}`}>
        <section className={`${panelClass} ${activeSettingsTab === 'wireguard' || activeSettingsTab === 'protocols' ? '' : 'hidden'}`}>
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

        <section className={`${panelClass} ${activeSettingsTab === 'wireguard' ? '' : 'hidden'}`}>
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

        <div className={activeSettingsTab === 'route' ? '' : 'hidden'}>
          <RouteIntelligencePanel analytics={routeQualityAnalytics} format={format} t={t} />
        </div>

        <div className={activeSettingsTab === 'route' ? '' : 'hidden'}>
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
        </div>

        <section className={`${panelClass} ${activeSettingsTab === 'wireguard' || activeSettingsTab === 'protocols' ? '' : 'hidden'}`}>
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
    </section>
  );
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



