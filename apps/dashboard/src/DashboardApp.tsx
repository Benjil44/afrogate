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
import { SettingsPage } from './pages/SettingsPage';
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
  normalizeNullableText,
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
import { SettingsInput, SettingsSelect } from './components/settings-form';
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







