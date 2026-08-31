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
  Menu,
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
  fetchTelegramTopupRequests,
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
import { fetchResellerTopups, type ImpersonateResellerResult } from './api/reseller-pricing';
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
import { TopupRequestsPage } from './pages/TopupRequestsPage';
import { ResellerTopupRequestsPage } from './pages/ResellerTopupRequestsPage';
import { InboundsPage } from './pages/InboundsPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { SettingsPage } from './pages/SettingsPage';
import { BillingPage, ResellerDashboardPage, ResellerUsersPage } from './pages/BillingReseller';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { canViewAdminUsers, canViewAuditLogs, canViewBackupStatus, canViewReports } from './session-access';
import { EChart, type AfroChartOption } from './components/EChart';
import { VpsBillBanner } from './components/VpsBillBanner';
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
import {
  collapsedGroupsStorageKey,
  ORPHAN_VIEW_REDIRECTS,
  parseCollapsedGroups,
  serializeCollapsedGroups,
  type NavGroupId,
} from './nav-views';
import type { SidebarNavItem } from './nav-config';
import { GbPricePanel } from './pages/GbPricePanel';
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
    id: 'Ireland-edge-01',
    name: 'Ireland Edge 01',
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
    id: 'Ireland-edge-02',
    name: 'Ireland Edge 02',
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
  { name: 'wireguard2', operator: 'Irelandcell', ping: 62, jitter: 14, loss: 0.3, score: 86 },
  { name: 'wireguard3', operator: 'Irelandcell', ping: 58, jitter: 11, loss: 0.2, score: 89 },
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
    id: 'sample-Ireland-direct',
    name: 'Ireland direct',
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

function loadInitialCollapsedGroups(): NavGroupId[] {
  if (typeof window === 'undefined') return [];
  return parseCollapsedGroups(window.localStorage.getItem(collapsedGroupsStorageKey));
}

const ROUTE_VIEWS: ActiveView[] = [
  'dashboard', 'servers', 'users', 'customers', 'connections', 'inbounds', 'audit',
  'backups', 'billing', 'topups', 'reseller-topups', 'reports', 'routes', 'outbounds', 'microtiks', 'alerts', 'settings', 'exits', 'network', 'resellers', 'pricing',
];

interface DashboardRoute {
  view: ActiveView;
  /** Canonical `?tab=` search param (deep-linkable wrapper-page tab). */
  tab: string | null;
}

/**
 * Derive the active view + tab from the URL (so refresh and deep links work).
 * Orphan views that now live as tabs inside a wrapper page resolve to their
 * canonical `/view?tab=` route instead of a duplicate standalone page.
 */
function routeFromUrl(): DashboardRoute {
  const seg = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  const view = (ROUTE_VIEWS as string[]).includes(seg) ? (seg as ActiveView) : 'dashboard';
  const redirect = ORPHAN_VIEW_REDIRECTS[view];
  if (redirect) return { view: redirect.view, tab: redirect.tab };
  return { view, tab: new URLSearchParams(window.location.search).get('tab') };
}

/**
 * If the address bar shows an orphan URL (e.g. /routes), rewrite it in place
 * to the canonical wrapper-tab URL (e.g. /exits?tab=routing) without adding a
 * history entry — old bookmarks keep working and Back never loops.
 */
function normalizeOrphanUrl() {
  const seg = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  const redirect = (ROUTE_VIEWS as string[]).includes(seg) ? ORPHAN_VIEW_REDIRECTS[seg as ActiveView] : undefined;
  if (!redirect) return;
  const params = new URLSearchParams(window.location.search);
  params.set('tab', redirect.tab);
  window.history.replaceState({ view: redirect.view, tab: redirect.tab }, '', `/${redirect.view}?${params.toString()}`);
}

export function DashboardApp() {
  const { isRtl, language, nextLanguage, setLanguage, strings: t } = useDashboardLanguage();
  const format = useMemo(() => createDashboardFormatters(language), [language]);
  const adminSession = useAdminSession();
  // "Sign in as seller": a reseller-scoped session layered over the (kept)
  // admin session. Server-side audited; cleared by the banner's Return button.
  const [impersonation, setImpersonation] = useState<ImpersonateResellerResult | null>(null);

  if (adminSession.status !== 'signedIn' || !adminSession.session || !adminSession.sessionToken) {
    if (impersonation) setImpersonation(null);
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

  const activeSession = impersonation?.session ?? adminSession.session;
  const activeSessionToken = impersonation?.sessionToken ?? adminSession.sessionToken;

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'}>
      {impersonation ? (
        <ImpersonationBanner
          resellerName={impersonation.reseller.displayName}
          onReturn={() => setImpersonation(null)}
          t={t}
        />
      ) : null}
      <AuthenticatedDashboard
        format={format}
        isRtl={isRtl}
        key={activeSessionToken}
        language={language}
        nextLanguage={nextLanguage}
        onImpersonate={setImpersonation}
        onLanguageChange={setLanguage}
        onSignOut={adminSession.signOut}
        session={activeSession}
        sessionToken={activeSessionToken}
        t={t}
      />
    </div>
  );
}

/** Sticky "Viewing as <seller> — Return to admin" strip shown while impersonating. */
function ImpersonationBanner({
  onReturn,
  resellerName,
  t,
}: {
  onReturn: () => void;
  resellerName: string;
  t: DashboardStrings;
}) {
  return (
    <div
      className="sticky top-0 z-40 flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-[#e6cf9c] bg-[#fff7e6] px-3 py-2 text-[13px] font-bold text-[#9a5b00] md:px-4"
      data-impersonation-banner="true"
      role="status"
    >
      <span className="inline-flex min-w-0 items-center gap-2">
        <Eye className="shrink-0" size={16} />
        <span className="min-w-0 truncate">{t.impersonation.viewingAs(resellerName)}</span>
      </span>
      <button
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border border-[#e6cf9c] bg-white px-3 text-[13px] font-bold text-[#9a5b00] hover:border-afro-teal hover:text-afro-teal"
        onClick={onReturn}
        type="button"
      >
        <LogOut className="shrink-0" size={15} />
        {t.impersonation.returnToAdmin}
      </button>
    </div>
  );
}

function AuthenticatedDashboard({
  format,
  isRtl,
  language,
  nextLanguage,
  onImpersonate,
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
  /** "Sign in as seller" from the Sellers page: swaps in a reseller-scoped session. */
  onImpersonate?: (result: ImpersonateResellerResult) => void;
  onLanguageChange: (language: DashboardLanguage) => void;
  onSignOut: () => void;
  session: AdminSessionResponse;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const isResellerSession = session.actor.role === 'reseller';
  const [route, setRoute] = useState<DashboardRoute>(routeFromUrl);
  const activeView = route.view;
  const activeTab = route.tab;
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  /** Navigate to a view (optionally deep-linking a wrapper-page tab). */
  const navigateTo = (view: ActiveView, tab: string | null = null) => {
    setRoute({ view, tab });
    setIsMobileNavOpen(false);
  };
  /** A wrapper page switched its own tab: keep the URL's ?tab= canonical. */
  const handlePageTabChange = (tab: string) => setRoute((current) => ({ ...current, tab }));
  // Rewrite orphan URLs (/routes, /outbounds, /inbounds, /connections) to
  // their canonical wrapper-tab URL before the sync effect below runs.
  useEffect(() => {
    normalizeOrphanUrl();
  }, []);
  // Keep the URL in sync with the active view + tab: the address bar shows
  // each page (and wrapper tab), and a refresh restores it.
  useEffect(() => {
    const path = route.view === 'dashboard' ? '/' : `/${route.view}`;
    const params = new URLSearchParams(window.location.search);
    if (route.tab) params.set('tab', route.tab);
    else params.delete('tab');
    const search = params.toString();
    const target = `${path}${search ? `?${search}` : ''}`;
    if (window.location.pathname + window.location.search === target) return;
    if (window.location.pathname === path) {
      // Same page, different tab: replace so Back steps between pages, not tabs.
      window.history.replaceState({ view: route.view, tab: route.tab }, '', target);
    } else {
      window.history.pushState({ view: route.view, tab: route.tab }, '', target);
    }
  }, [route]);
  useEffect(() => {
    const onPop = () => {
      normalizeOrphanUrl();
      setRoute(routeFromUrl());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  // Escape closes the mobile nav drawer.
  useEffect(() => {
    if (!isMobileNavOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobileNavOpen]);
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
  const [topupPendingCount, setTopupPendingCount] = useState(0);
  const [topupRefreshTick, setTopupRefreshTick] = useState(0);
  const [resellerTopupPendingCount, setResellerTopupPendingCount] = useState(0);
  const [resellerTopupRefreshTick, setResellerTopupRefreshTick] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(loadInitialSidebarCollapsed);
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isKioskMode, setIsKioskMode] = useState(loadInitialKioskMode);
  const [collapsedGroups, setCollapsedGroups] = useState<NavGroupId[]>(loadInitialCollapsedGroups);
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

  // Below Tailwind's lg breakpoint the sidebar is a drawer: it must always
  // render the full grouped nav (never the collapsed icon rail).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = () => setIsMobileViewport(mq.matches);
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
      setRoute({ view: 'dashboard', tab: null });
    }
  }, [activeView, isResellerSession]);

  // Pending Telegram top-up receipts: keep a light poll running so new
  // card-to-card receipts surface as a sidebar badge even off the Top-ups page.
  useEffect(() => {
    if (isResellerSession) {
      setTopupPendingCount(0);
      return;
    }

    let isActive = true;
    let timer: number | undefined;

    const loadPendingTopups = async () => {
      try {
        const pending = await fetchTelegramTopupRequests(sessionToken, 'pending');
        if (isActive) setTopupPendingCount(pending.length);
      } catch {
        /* keep last count */
      } finally {
        if (isActive) timer = window.setTimeout(() => void loadPendingTopups(), 30_000);
      }
    };

    void loadPendingTopups();

    return () => {
      isActive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [isResellerSession, sessionToken, topupRefreshTick]);

  // Pending seller wallet top-ups: same light poll so new card-to-card
  // receipts from sellers surface as a sidebar badge off the approval page.
  useEffect(() => {
    if (isResellerSession) {
      setResellerTopupPendingCount(0);
      return;
    }

    let isActive = true;
    let timer: number | undefined;

    const loadPendingResellerTopups = async () => {
      try {
        const pending = await fetchResellerTopups(sessionToken, 'pending');
        if (isActive) setResellerTopupPendingCount(pending.length);
      } catch {
        /* keep last count */
      } finally {
        if (isActive) timer = window.setTimeout(() => void loadPendingResellerTopups(), 30_000);
      }
    };

    void loadPendingResellerTopups();

    return () => {
      isActive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [isResellerSession, sessionToken, resellerTopupRefreshTick]);

  useEffect(() => {
    window.localStorage.setItem(sidebarStorageKey, isSidebarCollapsed ? 'collapsed' : 'expanded');
  }, [isSidebarCollapsed]);

  useEffect(() => {
    window.localStorage.setItem(kioskStorageKey, isKioskMode ? 'enabled' : 'disabled');
  }, [isKioskMode]);

  useEffect(() => {
    window.localStorage.setItem(collapsedGroupsStorageKey, serializeCollapsedGroups(collapsedGroups));
  }, [collapsedGroups]);

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
  const topupPendingState = useMemo<SidebarAlertState | null>(
    () => (topupPendingCount > 0 ? { tone: 'warning', countLabel: format.integer(topupPendingCount) } : null),
    [format, topupPendingCount],
  );
  const resellerTopupPendingState = useMemo<SidebarAlertState | null>(
    () => (resellerTopupPendingCount > 0 ? { tone: 'warning', countLabel: format.integer(resellerTopupPendingCount) } : null),
    [format, resellerTopupPendingCount],
  );
  const status = getDataStatus(dataState, lastUpdated, t, format);
  const header = getPageHeader(activeView, t, session);
  const effectiveSidebarCollapsed = (isSidebarCollapsed || isNarrowViewport) && !isMobileViewport;
  const shellGridClass = isKioskMode
    ? 'lg:grid-cols-[minmax(0,1fr)]'
    : effectiveSidebarCollapsed ? 'lg:grid-cols-[80px_minmax(0,1fr)]' : 'lg:grid-cols-[248px_minmax(0,1fr)]';

  return (
    <main
      className={`grid min-h-screen grid-cols-1 overflow-x-clip bg-afro-page text-afro-ink ${shellGridClass}`}
      data-dashboard-kiosk={isKioskMode ? 'true' : 'false'}
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={language}
    >
      <VersionWatcher language={language} />
      {isKioskMode ? null : (
        <>
          {/* Mobile top bar: hamburger opens the nav drawer. */}
          <div className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-afro-sidebar px-3 py-2 text-[#eef6f4] lg:hidden">
            <button
              aria-expanded={isMobileNavOpen}
              aria-label={t.openNavMenu}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-[#334852] text-[#c8d7d5] hover:border-[#5c7782] hover:text-white"
              data-mobile-nav-toggle="true"
              onClick={() => setIsMobileNavOpen(true)}
              title={t.openNavMenu}
              type="button"
            >
              <Menu className="shrink-0" size={20} />
            </button>
            <div className="flex items-center gap-2 text-lg font-bold">
              <ShieldCheck size={20} />
              Afrows
            </div>
            <span className="text-xs text-[#91a5a2]">v{appVersion}</span>
          </div>
          {isMobileNavOpen ? (
            <div aria-hidden="true" className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setIsMobileNavOpen(false)} />
          ) : null}
          {/* Nav drawer on mobile; sticky first grid column on lg+. */}
          <div
            className={`fixed inset-y-0 z-50 w-[280px] max-w-[85vw] overflow-y-auto lg:sticky lg:top-0 lg:z-auto lg:block lg:h-screen lg:w-auto lg:max-w-none lg:overflow-visible ${isRtl ? 'right-0' : 'left-0'} ${isMobileNavOpen ? '' : 'hidden'}`}
          >
            <Sidebar
              activeTab={activeTab}
              activeView={activeView}
              collapsedGroups={collapsedGroups}
              isCollapsed={effectiveSidebarCollapsed}
              isRtl={isRtl}
              nextLanguage={nextLanguage}
              onCloseMobile={() => setIsMobileNavOpen(false)}
              onLanguageChange={onLanguageChange}
              onNavigate={(item: SidebarNavItem) => navigateTo(item.view, item.tab ?? null)}
              onSignOut={onSignOut}
              onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
              onToggleGroup={(groupId) =>
                setCollapsedGroups((current) =>
                  current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId],
                )
              }
              resellerTopupPendingState={resellerTopupPendingState}
              sidebarAlertState={sidebarAlertState}
              session={session}
              t={t}
              topupPendingState={topupPendingState}
            />
          </div>
        </>
      )}

      {/* Single page scroll: the window is the only vertical scroller (no nested
          lg:overflow-y-auto pane, which produced a second scrollbar). overflow-x-clip
          (not hidden) keeps this from becoming a scroll container so descendant
          position:sticky elements still track the viewport. */}
      <section className="min-w-0 max-w-full overflow-x-clip p-3 md:p-4">
        {!isResellerSession ? <VpsBillBanner t={t} /> : null}
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
          activeTab={activeTab}
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
          onImpersonate={onImpersonate}
          onNavigate={navigateTo}
          onResellerTopupPendingChanged={() => setResellerTopupRefreshTick((tick) => tick + 1)}
          onTabChange={handlePageTabChange}
          onTopupPendingChanged={() => setTopupRefreshTick((tick) => tick + 1)}
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
  activeTab,
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
  onImpersonate,
  onNavigate,
  onResellerTopupPendingChanged,
  onTabChange,
  onTopupPendingChanged,
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
  activeTab: string | null;
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
  onImpersonate?: (result: ImpersonateResellerResult) => void;
  onNavigate: (view: ActiveView, tab?: string | null) => void;
  onResellerTopupPendingChanged: () => void;
  onTabChange: (tab: string) => void;
  onTopupPendingChanged: () => void;
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
      return <BillingPage activeTab={activeTab} format={format} onTabChange={onTabChange} session={session} sessionToken={sessionToken} t={t} />;
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
      return <BillingPage activeTab={activeTab} format={format} onTabChange={onTabChange} session={session} sessionToken={sessionToken} t={t} />;
    case 'topups':
      return <TopupRequestsPage format={format} onPendingChanged={onTopupPendingChanged} sessionToken={sessionToken} t={t} />;
    case 'reseller-topups':
      return <ResellerTopupRequestsPage format={format} onPendingChanged={onResellerTopupPendingChanged} sessionToken={sessionToken} t={t} />;
    case 'reports':
      return <ReportsPage format={format} sessionToken={sessionToken} t={t} />;
    case 'exits':
      return (
        <ExitsPage
          activeTab={activeTab}
          onTabChange={onTabChange}
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
      return <OutboundsPage format={format} sessionToken={sessionToken} t={t} />;
    case 'microtiks':
      return <MicrotiksPage roleFilter="gateway" sessionToken={sessionToken} t={t} />;
    case 'customers':
      return <CustomersPage format={format} sessionToken={sessionToken} t={t} />;
    case 'network':
      return (
        <NetworkPage
          activeTab={activeTab}
          format={format}
          onOpenExits={() => onNavigate('exits', 'egress')}
          onTabChange={onTabChange}
          sessionToken={sessionToken}
          t={t}
        />
      );
    case 'pricing':
      // Plans & Pricing (Customers group): the superadmin per-GB price control.
      return (
        <section className="mt-3 grid gap-3">
          <GbPricePanel
            canEdit={session.actor.role === 'superadmin' || session.actor.isSuperAdmin === true}
            format={format}
            sessionToken={sessionToken}
            t={t}
          />
        </section>
      );
    case 'resellers':
      return <ResellersPage format={format} onImpersonate={onImpersonate} sessionToken={sessionToken} t={t} />;
    case 'inbounds':
      return <InboundsPage format={format} sessionToken={sessionToken} t={t} />;
    case 'connections':
      return <ConnectionsPage format={format} sessionToken={sessionToken} t={t} />;
    case 'alerts':
      return <AlertsPage alerts={alerts} dataState={alertDataState} format={format} sessionToken={sessionToken} t={t} />;
    case 'settings':
      return <SettingsPage activeTab={activeTab} format={format} managementServers={managementServers} onTabChange={onTabChange} session={session} sessionToken={sessionToken} t={t} />;
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







