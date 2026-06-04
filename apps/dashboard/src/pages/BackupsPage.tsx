import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Archive, ShieldCheck } from 'lucide-react';
import type { AdminBackupRestoreCheckSummary, AdminBackupRestorePlanStepSummary, AdminBackupRestorePlanSummary, AdminBackupStatusSummary } from '@afrows/shared';
import { fetchAdminBackupRestorePlan, fetchAdminBackupStatus } from '../api/admin';
import { BackupMetricCard, DashboardTabs, DetailRow, PanelHeading, PanelHeadingContent, PanelState, StatusBadge } from '../components/primitives';
import type { BackupsTab, DashboardTabItem, DataState } from '../dashboard-types';
import type { DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { backupArtifactLabel, backupIssueLabel, backupJobStatusLabel, backupJobStatusTone, backupRestoreCheckLabel, backupRestoreCheckStatusLabel, backupRestoreCheckStatusTone, backupRestoreReadinessLabel, backupRestoreReadinessTone, backupRestoreReasonLabel, backupRestoreSafetyNoteLabel, backupRestoreStepLabel, backupStatusAgeTone, backupStatusEncryptionTone, backupStatusLabel, backupStatusTone, formatBackupAgeDays, formatBackupAgeHours, formatBackupDate, formatBackupDuration } from '../labels';
import { mutedTextClass, panelClass } from '../ui-classes';

export function BackupsPage({
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
  const [activeBackupTab, setActiveBackupTab] = useState<BackupsTab>('monitor');

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
  const backupTabs: Array<DashboardTabItem<BackupsTab>> = [
    {
      id: 'monitor',
      label: t.backupStatus.title,
      meta: backupStatus ? t.backupStatus.issuesLoaded(format.integer(issues.length)) : t.dataStatus.loading,
    },
    {
      id: 'readiness',
      label: t.backupStatus.readiness,
      meta: backupStatus ? backupStatusLabel(backupStatus.status, t) : t.dataStatus.loading,
    },
    {
      id: 'restore',
      label: t.backupStatus.restoreRunbook,
      meta: restorePlan ? t.backupStatus.restoreStepsLoaded(format.integer(restorePlan.steps.length)) : t.dataStatus.loading,
    },
  ];

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

      <DashboardTabs activeTab={activeBackupTab} ariaLabel={t.backupStatus.title} onChange={setActiveBackupTab} tabs={backupTabs} />

      {activeBackupTab === 'monitor' ? (
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
      ) : null}

      {activeBackupTab === 'readiness' && backupStatus ? (
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

      {activeBackupTab === 'restore' && restorePlan ? (
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
      {activeBackupTab === 'restore' && !restorePlan ? (
        <section className={panelClass}>
          <PanelState detail={t.panelStates.loadingDetail} kind="loading" title={t.panelStates.loadingTitle} />
        </section>
      ) : null}
    </section>
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
