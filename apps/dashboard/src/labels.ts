import type { AdminBackupStatusSummary, CurrentPanelKind, CustomerAccountStatus, CustomerQuotaScope } from '@afrows/shared';
import type { Tone } from './dashboard-types';
import type { DashboardFormatters } from './formatters';
import type { DashboardStrings } from './i18n';

export function backupStatusTone(status: AdminBackupStatusSummary['status']): Tone {
  if (status === 'healthy') return 'good';
  if (status === 'critical') return 'critical';

  return 'warning';
}

export function backupRestoreReadinessTone(status: string): Tone {
  if (status === 'ready') return 'good';
  if (status === 'blocked') return 'critical';

  return 'warning';
}

export function backupRestoreReadinessLabel(status: string, t: DashboardStrings): string {
  const labels = t.backupStatus.restoreReadinessStatusLabels as Record<string, string>;

  return labels[status] ?? status;
}

export function backupRestoreCheckStatusTone(status: string): Tone {
  if (status === 'passed') return 'good';
  if (status === 'blocked') return 'critical';
  if (status === 'future') return 'neutral';

  return 'warning';
}

export function backupRestoreCheckStatusLabel(status: string, t: DashboardStrings): string {
  const labels = t.backupStatus.restoreCheckStatusLabels as Record<string, string>;

  return labels[status] ?? status;
}

export function backupRestoreCheckLabel(code: string, t: DashboardStrings): string {
  const labels = t.backupStatus.restoreCheckLabels as Record<string, string>;

  return labels[code] ?? code;
}

export function backupRestoreStepLabel(code: string, t: DashboardStrings): string {
  const labels = t.backupStatus.restoreStepLabels as Record<string, string>;

  return labels[code] ?? code;
}

export function backupRestoreReasonLabel(code: string, t: DashboardStrings): string {
  const restoreLabels = t.backupStatus.restoreReasonLabels as Record<string, string>;
  const issueLabels = t.backupStatus.issueLabels as Record<string, string>;

  return restoreLabels[code] ?? issueLabels[code] ?? code;
}

export function backupRestoreSafetyNoteLabel(code: string, t: DashboardStrings): string {
  const labels = t.backupStatus.restoreSafetyLabels as Record<string, string>;

  return labels[code] ?? code;
}

export function reportRiskTone(level: string): Tone {
  if (level === 'good') return 'good';
  if (level === 'critical') return 'critical';
  if (level === 'risk') return 'warning';

  return 'neutral';
}

export function reportRiskLabel(level: string, t: DashboardStrings): string {
  const labels = t.reports.riskLabels as Record<string, string>;

  return labels[level] ?? level;
}

export function reportReasonLabel(code: string, t: DashboardStrings): string {
  const labels = t.reports.reasonLabels as Record<string, string>;

  return labels[code] ?? code;
}

export function backupStatusAgeTone(backupStatus: AdminBackupStatusSummary | null): Tone {
  if (!backupStatus) return 'warning';
  if (backupStatus.status === 'critical') return 'critical';
  if (!backupStatus.latestSuccessfulBackupAt) return 'critical';
  if (backupStatus.latestBackupAgeHours !== null && backupStatus.latestBackupAgeHours !== undefined && backupStatus.latestBackupAgeHours > backupStatus.maxBackupAgeHours) return 'critical';

  return backupStatus.status === 'warning' ? 'warning' : 'good';
}

export function backupStatusEncryptionTone(backupStatus: AdminBackupStatusSummary | null): Tone {
  if (!backupStatus) return 'warning';
  if (backupStatus.encryptionRequired && backupStatus.encrypted !== true) return 'critical';
  if (backupStatus.encrypted === true) return 'good';

  return 'warning';
}

export function backupJobStatusTone(status: AdminBackupStatusSummary['latestJobStatus']): Tone {
  if (status === 'succeeded') return 'good';
  if (status === 'failed') return 'critical';
  if (status === 'running') return 'warning';

  return 'neutral';
}

export function backupStatusLabel(status: AdminBackupStatusSummary['status'], t: DashboardStrings): string {
  return t.backupStatus.statusLabels[status];
}

export function backupJobStatusLabel(status: AdminBackupStatusSummary['latestJobStatus'], t: DashboardStrings): string {
  return t.backupStatus.jobStatusLabels[status];
}

export function backupIssueLabel(code: string, t: DashboardStrings): string {
  const labels = t.backupStatus.issueLabels as Record<string, string>;

  return labels[code] ?? code;
}

export function backupArtifactLabel(artifact: string, t: DashboardStrings): string {
  const labels = t.backupStatus.artifactLabels as Record<string, string>;

  return labels[artifact] ?? artifact;
}

export function formatBackupDate(value: string | null | undefined, format: DashboardFormatters, t: DashboardStrings): string {
  return value ? format.dateTime(new Date(value)) : t.backupStatus.notAvailable;
}

export function formatBackupAgeHours(value: number | null | undefined, format: DashboardFormatters, t: DashboardStrings): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return t.backupStatus.notAvailable;

  return t.backupStatus.hoursAgo(format.integer(Math.round(value)));
}

export function formatBackupAgeDays(value: number | null | undefined, format: DashboardFormatters, t: DashboardStrings): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return t.backupStatus.notAvailable;

  return t.backupStatus.daysAgo(format.integer(Math.round(value)));
}

export function formatBackupDuration(value: number | null | undefined, format: DashboardFormatters, t: DashboardStrings): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return t.backupStatus.notAvailable;
  if (value < 60) return format.durationSeconds(Math.round(value));

  return format.durationMinutes(Math.round(value / 60));
}

export function billingStatusTone(status: string): Tone {
  if (status === 'active' || status === 'paid' || status === 'allocated') return 'good';
  if (status === 'pending' || status === 'not_applicable' || status === 'archived' || status === 'disabled') return 'neutral';
  if (status === 'refunded' || status === 'suspended') return 'warning';

  return 'critical';
}

export function formatMoneyAmount(amount: number, currency: string, format: DashboardFormatters): string {
  return `${format.integer(amount)} ${currency}`;
}

export function resellerWalletEntryTypeLabel(value: string, t: DashboardStrings): string {
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

export function resellerWalletSourceLabel(value: string, t: DashboardStrings): string {
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

export function paymentAdapterStatusTone(status: string): Tone {
  if (status === 'implemented') return 'good';
  if (status === 'manual_settlement' || status === 'verification_adapter_required') return 'warning';

  return 'neutral';
}

export function paymentProviderLabel(provider: string, t: DashboardStrings): string {
  if (provider === 'paypal') return t.billing.providerPaypal;
  if (provider === 'card') return t.billing.providerCard;
  if (provider === 'crypto') return t.billing.providerCrypto;
  if (provider === 'bank_transfer') return t.billing.providerBankTransfer;
  if (provider === 'local_gateway') return t.billing.providerLocalGateway;
  if (provider === 'manual') return t.billing.providerManual;

  return provider;
}

export function paymentCheckoutModeLabel(mode: string, t: DashboardStrings): string {
  if (mode === 'manual') return t.billing.checkoutManual;
  if (mode === 'hosted_redirect') return t.billing.checkoutHostedRedirect;
  if (mode === 'external_link') return t.billing.checkoutExternalLink;
  if (mode === 'provider_sdk') return t.billing.checkoutProviderSdk;

  return mode;
}

export function paymentSettlementLabel(mode: string, t: DashboardStrings): string {
  if (mode === 'auto_capture') return t.billing.settlementAutoCapture;
  if (mode === 'manual_verification') return t.billing.settlementManualVerification;
  if (mode === 'hosted_gateway') return t.billing.settlementHostedGateway;

  return mode;
}

export function paymentVerificationLabel(verified: boolean, t: DashboardStrings): string {
  return verified ? t.billing.webhookVerified : t.billing.manualOrProviderVerification;
}

export function paymentAdapterStatusLabel(status: string, t: DashboardStrings): string {
  if (status === 'implemented') return t.billing.adapterImplemented;
  if (status === 'manual_settlement') return t.billing.adapterManualSettlement;
  if (status === 'verification_adapter_required') return t.billing.adapterVerificationRequired;

  return status;
}

export function customerQuotaScopeLabel(scope: CustomerQuotaScope | string, t: DashboardStrings): string {
  if (scope === 'per_client') return t.billing.perClientQuota;

  return t.billing.accountSharedQuota;
}

export function customerAccountStatusLabel(status: CustomerAccountStatus | string, t: DashboardStrings): string {
  if (status === 'suspended') return t.billing.suspended;
  if (status === 'disabled') return t.billing.disabled;

  return t.billing.enabled;
}

export function currentPanelKindLabel(kind: CurrentPanelKind | string, t: DashboardStrings): string {
  if (kind === 'marzban') return t.billing.currentPanelMarzban;
  if (kind === 'xui') return t.billing.currentPanelXui;
  if (kind === 'sanayi') return t.billing.currentPanelSanayi;

  return t.billing.currentPanelGeneric;
}

export function currentPanelStatusTone(status: string): Tone {
  if (status === 'active') return 'good';
  if (status === 'limited' || status === 'expired') return 'warning';
  if (status === 'disabled') return 'neutral';

  return 'neutral';
}

export function currentPanelStatusLabel(status: string, t: DashboardStrings): string {
  if (status === 'active') return t.billing.active;
  if (status === 'limited') return t.billing.limited;
  if (status === 'expired') return t.billing.expired;
  if (status === 'disabled') return t.billing.disabled;

  return t.billing.unknown;
}

export function protocolServerApplyStatusLabel(status: string, t: DashboardStrings): string {
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

export function protocolServerApplyEventStatusLabel(status: string, t: DashboardStrings): string {
  if (status === 'recorded') return t.settings.protocolApplyRecorded;

  return protocolServerApplyStatusLabel(status, t);
}

export function protocolServerApplyModeLabel(mode: string, t: DashboardStrings): string {
  switch (mode) {
    case 'dryRun':
      return t.settings.protocolApplyModeDryRun;
    case 'live':
      return t.settings.protocolApplyModeLive;
    default:
      return mode;
  }
}

export function protocolApplyAdapterStatusLabel(status: string, t: DashboardStrings): string {
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

export function protocolApplyRunnerModeLabel(mode: string, t: DashboardStrings): string {
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

export function protocolApplyGateStatusLabel(status: string, t: DashboardStrings): string {
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

export function protocolApplyGateKindLabel(kind: string, t: DashboardStrings): string {
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

export function protocolServerApplyStepLabel(kind: string, t: DashboardStrings): string {
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
