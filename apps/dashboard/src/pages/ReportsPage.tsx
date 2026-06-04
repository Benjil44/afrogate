import { useEffect, useMemo, useState } from 'react';
import { Activity, Gauge } from 'lucide-react';
import type { AdminBackupStatusSummary, AdminReportsSummaryResponse } from '@afrows/shared';
import { fetchAdminReportsSummary } from '../api/admin';
import { createDonutChartOption } from '../chart-options';
import { EChart } from '../components/EChart';
import { BackupMetricCard, DetailRow, PanelHeading, PanelHeadingContent, PanelState, StatusBadge } from '../components/primitives';
import type { DataState, Tone } from '../dashboard-types';
import type { DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { backupStatusLabel, backupStatusTone, reportReasonLabel, reportRiskLabel, reportRiskTone } from '../labels';
import { routeRecommendationConfidence, routeRecommendationDetail, routeRecommendationKey, routeRecommendationTitle } from '../route-helpers';
import { panelClass } from '../ui-classes';

export function ReportsPage({
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
  const reportChartCards = summary ? [
    {
      ariaLabel: t.reports.servers,
      label: t.reports.servers,
      option: createDonutChartOption([
        { name: t.dashboardCharts.healthy, value: summary.servers.healthy, color: '#238a4b' },
        { name: t.dashboardCharts.watch, value: summary.servers.degraded, color: '#c27a1a' },
        { name: t.dashboardCharts.critical, value: summary.servers.critical, color: '#b91c1c' },
      ], format),
      value: t.reports.healthMix(format.integer(summary.servers.healthy), format.integer(summary.servers.degraded), format.integer(summary.servers.critical)),
    },
    {
      ariaLabel: t.reports.outbounds,
      label: t.reports.outbounds,
      option: createDonutChartOption([
        { name: t.dashboardCharts.healthy, value: summary.outbounds.healthy, color: '#238a4b' },
        { name: t.dashboardCharts.watch, value: summary.outbounds.degraded, color: '#c27a1a' },
        { name: t.dashboardCharts.critical, value: summary.outbounds.critical, color: '#b91c1c' },
      ], format),
      value: t.reports.healthMix(format.integer(summary.outbounds.healthy), format.integer(summary.outbounds.degraded), format.integer(summary.outbounds.critical)),
    },
    {
      ariaLabel: t.reports.alerts,
      label: t.reports.alerts,
      option: createDonutChartOption([
        { name: t.dashboardCharts.critical, value: summary.alerts.critical, color: '#b91c1c' },
        { name: t.dashboardCharts.warning, value: summary.alerts.warning, color: '#c27a1a' },
        { name: t.dashboardCharts.other, value: Math.max(0, summary.alerts.open - summary.alerts.critical - summary.alerts.warning), color: '#2764a8' },
      ], format),
      value: t.reports.alertMix(format.integer(summary.alerts.critical), format.integer(summary.alerts.warning)),
    },
    {
      ariaLabel: t.reports.backups,
      label: t.reports.backups,
      option: createDonutChartOption([
        { name: t.dashboardCharts.critical, value: summary.backups.criticalIssueCount, color: '#b91c1c' },
        { name: t.dashboardCharts.warning, value: summary.backups.warningIssueCount, color: '#c27a1a' },
        { name: t.dashboardCharts.healthy, value: summary.backups.criticalIssueCount + summary.backups.warningIssueCount === 0 ? 1 : 0, color: '#238a4b' },
      ], format),
      value: t.reports.issueMix(format.integer(summary.backups.criticalIssueCount), format.integer(summary.backups.warningIssueCount)),
    },
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
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {reportChartCards.map((card) => (
                <div className="grid min-h-[84px] grid-cols-[72px_minmax(0,1fr)] items-center gap-2 rounded-md border border-afro-line bg-white px-2 py-1.5" key={card.label}>
                  <EChart ariaLabel={card.ariaLabel} className="h-[68px] w-[72px]" option={card.option} />
                  <div className="min-w-0">
                    <strong className="block truncate text-[13px] text-afro-ink">{card.label}</strong>
                    <span className="block truncate text-[12px] font-bold text-afro-muted" title={card.value}>{card.value}</span>
                  </div>
                </div>
              ))}
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
