import { useEffect, useMemo, useState, type ComponentType, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import type {
  AdminAlertSummary,
  AdminOperationsOverview,
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
} from '@afrows/shared';
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
import { useAdminSession, type AdminSessionHook } from './auth';
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
  fetchAdminOperationsOverview,
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
import { MicrotiksPage } from './pages/MicrotiksPage';
import { RoutesPage } from './pages/RoutesPage';
import { OutboundsPage } from './pages/OutboundsPage';
import { ExitsPage } from './pages/ExitsPage';
import { NetworkPage } from './pages/NetworkPage';
import { ResellersPage } from './pages/ResellersPage';
import { CustomersPage } from './pages/CustomersPage';
import { InboundsPage } from './pages/InboundsPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { SettingsPage } from './pages/SettingsPage';
import { BillingPage, ResellerDashboardPage, ResellerUsersPage } from './pages/BillingReseller';
import { AdminLoginPage } from './pages/AdminLoginPage';
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
import { SystemResourceHeader } from './components/SystemResourceHeader';
import { VersionWatcher } from './components/version-watcher';
import { appVersion, resellerNavViews } from './app-config';
import { advancedModeStorageKey, parseAdvancedMode, serializeAdvancedMode } from './nav-views';
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


const refreshIntervalMs = 10_000;

// Demo datasets render only in local development so the UI is never blank while
// building. Production builds show real API data. Set VITE_DEMO_FALLBACK=false
// (e.g. in .env.local) to also disable demos in dev — handy when pointing the
// local UI at a real backend, so it matches production exactly.
const SHOW_DEMO = import.meta.env.DEV && import.meta.env.VITE_DEMO_FALLBACK !== 'false';
const fallbackServers: ServerRowData[] = SHOW_DEMO ? [
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
] : [];

const tunnels: TunnelRowData[] = SHOW_DEMO ? [
  { name: 'wg1', operator: 'Mobinnet', ping: 46, jitter: 8, loss: 0.1, score: 95 },
  { name: 'wireguard2', operator: 'Irancell', ping: 62, jitter: 14, loss: 0.3, score: 86 },
  { name: 'wireguard3', operator: 'Irancell', ping: 58, jitter: 11, loss: 0.2, score: 89 },
] : [];

const outbounds: OutboundRowData[] = SHOW_DEMO ? [
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
] : [];


const sidebarStorageKey = 'afrows.dashboard.sidebar';
const kioskStorageKey = 'afrows.dashboard.kiosk';

function loadInitialSidebarCollapsed() {
  return window.localStorage.getItem(sidebarStorageKey) === 'collapsed';
}

function loadInitialKioskMode() {
  return window.localStorage.getItem(kioskStorageKey) === 'enabled';
}

function loadInitialAdvancedMode() {
  if (typeof window === 'undefined') return false;
  return parseAdvancedMode(window.localStorage.getItem(advancedModeStorageKey));
}

const ROUTE_VIEWS: ActiveView[] = [
  'dashboard', 'servers', 'users', 'customers', 'connections', 'inbounds', 'audit',
  'backups', 'billing', 'reports', 'routes', 'outbounds', 'microtiks', 'alerts', 'settings', 'exits', 'network', 'resellers',
];

/** Derive the active view from the URL path (so refresh + the address bar work). */
function viewFromUrl(): ActiveView {
  const seg = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  return (ROUTE_VIEWS as string[]).includes(seg) ? (seg as ActiveView) : 'dashboard';
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
  const [activeView, setActiveView] = useState<ActiveView>(viewFromUrl);
  // Keep the URL path in sync with the active view: the address bar shows each
  // page, and a refresh restores it (instead of dropping back to Dashboard).
  useEffect(() => {
    const path = activeView === 'dashboard' ? '/' : `/${activeView}`;
    if (window.location.pathname !== path) {
      window.history.pushState({ view: activeView }, '', path + window.location.search);
    }
  }, [activeView]);
  useEffect(() => {
    const onPop = () => setActiveView(viewFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
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
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  const [isKioskMode, setIsKioskMode] = useState(loadInitialKioskMode);
  const [advancedMode, setAdvancedMode] = useState(loadInitialAdvancedMode);
  const wallClock = useWallClock(format);

  // Auto-collapse the sidebar on narrow desktops (lg..xl) so content isn't
  // squeezed; does not overwrite the user's saved expand/collapse preference.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 1279px)');
    const apply = () => setIsNarrowViewport(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

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
    window.localStorage.setItem(advancedModeStorageKey, serializeAdvancedMode(advancedMode));
  }, [advancedMode]);

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
      : (SHOW_DEMO ? createFallbackFailoverRows(t) : [])),
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
  const [overview, setOverview] = useState<AdminOperationsOverview | null>(null);
  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    const load = async () => {
      try {
        const o = await fetchAdminOperationsOverview(sessionToken);
        if (active) setOverview(o);
      } catch {
        /* keep last */
      } finally {
        if (active) timer = window.setTimeout(() => void load(), 10000);
      }
    };
    void load();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [sessionToken]);

  const fleetTraffic = useMemo(() => createTrafficTotals(serverRows), [serverRows]);
  // Single-box: prefer the box/xray overview; fall back to the (empty) fleet.
  const trafficTotals = overview?.available
    ? { downloadBps: overview.downloadBps, uploadBps: overview.uploadBps }
    : fleetTraffic;
  const overviewActiveUsers = overview?.available ? overview.activeUsers : undefined;
  const computedAlerts = useMemo(() => createComputedAlertRows(serverRows, t), [serverRows, t]);
  const apiAlertRows = useMemo(() => mapAdminAlertsToRows(apiAlerts, t), [apiAlerts, t]);
  const alerts = useMemo(() => {
    if (alertDataState === 'live' || alertDataState === 'stale') {
      return apiAlertRows.length > 0 ? apiAlertRows : [createNoOpenAlertsRow(t)];
    }

    return computedAlerts;
  }, [alertDataState, apiAlertRows, computedAlerts, t]);
  const summary = useMemo(
    () => createSummary(serverRows, trafficTotals, alerts, t, format, overviewActiveUsers),
    [alerts, format, serverRows, trafficTotals, t, overviewActiveUsers],
  );
  const chartSeries = useMemo(
    () => (timeseries.length > 0 ? timeseries : (SHOW_DEMO ? createFallbackTimeseries(serverRows, timeRange) : [])),
    [serverRows, timeRange, timeseries],
  );
  const sidebarAlertState = useMemo(() => createSidebarAlertState(alerts, format), [alerts, format]);
  const status = getDataStatus(dataState, lastUpdated, t, format);
  const header = getPageHeader(activeView, t, session);
  const effectiveSidebarCollapsed = isSidebarCollapsed || isNarrowViewport;
  const shellGridClass = isKioskMode
    ? 'lg:grid-cols-[minmax(0,1fr)]'
    : effectiveSidebarCollapsed ? 'lg:grid-cols-[80px_minmax(0,1fr)]' : 'lg:grid-cols-[248px_minmax(0,1fr)]';

  return (
    <main
      className={`grid min-h-screen grid-cols-1 overflow-x-hidden bg-afro-page text-afro-ink lg:h-screen lg:min-h-0 lg:overflow-hidden ${shellGridClass}`}
      data-dashboard-kiosk={isKioskMode ? 'true' : 'false'}
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={language}
    >
      <VersionWatcher language={language} />
      {isKioskMode ? null : (
        <Sidebar
          activeView={activeView}
          advancedMode={advancedMode}
          isCollapsed={effectiveSidebarCollapsed}
          isRtl={isRtl}
          nextLanguage={nextLanguage}
          onLanguageChange={onLanguageChange}
          onSignOut={onSignOut}
          onToggleAdvancedMode={() => setAdvancedMode((current) => !current)}
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
            <SystemResourceHeader
              format={format}
              servers={serverRows}
              t={t}
              trafficTotals={trafficTotals}
              overrideCpuPercent={overview?.available ? overview.cpuPercent : undefined}
              overrideRamPercent={overview?.available ? overview.memPercent : undefined}
              overrideStorageFreePercent={overview?.available ? overview.diskFreePercent : undefined}
              downloadTotal={overview?.available ? overview.downloadTotalBytes : undefined}
              uploadTotal={overview?.available ? overview.uploadTotalBytes : undefined}
            />

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
          onNavigate={setActiveView}
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
          activeUsers={overviewActiveUsers}
          t={t}
          tunnelDataState={tunnelDataState}
          timeRange={timeRange}
          trafficTotals={trafficTotals}
        />
      </section>
    </main>
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
  onNavigate,
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
  activeUsers,
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
  onNavigate: (view: ActiveView) => void;
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
  activeUsers?: number;
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
    case 'exits':
      return (
        <ExitsPage
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
    case 'outbounds':
      return <OutboundsPage sessionToken={sessionToken} t={t} />;
    case 'microtiks':
      return <MicrotiksPage roleFilter="gateway" sessionToken={sessionToken} t={t} />;
    case 'customers':
      return <CustomersPage format={format} sessionToken={sessionToken} t={t} />;
    case 'network':
      return <NetworkPage format={format} sessionToken={sessionToken} onOpenExits={() => onNavigate('exits')} t={t} />;
    case 'resellers':
      return <ResellersPage format={format} sessionToken={sessionToken} t={t} />;
    case 'inbounds':
      return <InboundsPage format={format} sessionToken={sessionToken} t={t} />;
    case 'connections':
      return <ConnectionsPage format={format} sessionToken={sessionToken} t={t} />;
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
          activeUsers={activeUsers}
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







