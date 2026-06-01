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
import { BillingPage, ResellerDashboardPage, ResellerUsersPage } from './pages/BillingReseller';
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
import { KioskToggleButton, LanguageButton, Sidebar } from './components/Sidebar';
import { appVersion, resellerNavViews } from './app-config';
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







