import { useMemo } from 'react';
import { AlertTriangle, ArrowDownUp, Gauge, Network, ShieldCheck } from 'lucide-react';
import type { AdminBackupStatusSummary, MetricsTimeRange, ServerMetricTimeseries } from '@afrogate/shared';
import { createDonutChartOption, createHealthChartOption } from '../chart-options';
import type { AlertRowData, DataState, OutboundRowData, ServerRowData, Tone, TrafficTotals } from '../dashboard-types';
import { timeRanges, type DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { backupStatusLabel, backupStatusTone } from '../labels';
import { countActiveAlertRows } from '../mappers';
import { countTones, getHealthTone } from '../tone';
import { mutedTextClass, panelClass } from '../ui-classes';
import { EChart } from './EChart';
import { DataStateEmpty, DataStateNotice, PanelHeading, PanelHeadingContent, StatusBadge } from './primitives';

export function HealthChartPanel({
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

export function DashboardOverviewChartsPanel({
  alerts,
  format,
  outbounds,
  servers,
  t,
}: {
  alerts: AlertRowData[];
  format: DashboardFormatters;
  outbounds: OutboundRowData[];
  servers: ServerRowData[];
  t: DashboardStrings;
}) {
  const serverCounts = countTones(servers.map((server) => getHealthTone(server.score)));
  const alertCounts = countTones(alerts.map((alert) => alert.severity));
  const outboundCounts = countTones(outbounds.map((outbound) => outbound.statusTone));
  const serverOption = useMemo(
    () => createDonutChartOption([
      { name: t.dashboardCharts.healthy, value: serverCounts.good, color: '#238a4b' },
      { name: t.dashboardCharts.watch, value: serverCounts.warning, color: '#c27a1a' },
      { name: t.dashboardCharts.critical, value: serverCounts.critical, color: '#b91c1c' },
      { name: t.dashboardCharts.unknown, value: serverCounts.neutral, color: '#7c8b93' },
    ], format),
    [format, serverCounts.critical, serverCounts.good, serverCounts.neutral, serverCounts.warning, t],
  );
  const alertOption = useMemo(
    () => createDonutChartOption([
      { name: t.dashboardCharts.critical, value: alertCounts.critical, color: '#b91c1c' },
      { name: t.dashboardCharts.warning, value: alertCounts.warning, color: '#c27a1a' },
      { name: t.dashboardCharts.other, value: alertCounts.good + alertCounts.neutral, color: '#2764a8' },
    ], format),
    [alertCounts.critical, alertCounts.good, alertCounts.neutral, alertCounts.warning, format, t],
  );
  const outboundOption = useMemo(
    () => createDonutChartOption([
      { name: t.dashboardCharts.healthy, value: outboundCounts.good, color: '#238a4b' },
      { name: t.dashboardCharts.watch, value: outboundCounts.warning, color: '#c27a1a' },
      { name: t.dashboardCharts.critical, value: outboundCounts.critical, color: '#b91c1c' },
      { name: t.dashboardCharts.unknown, value: outboundCounts.neutral, color: '#7c8b93' },
    ], format),
    [format, outboundCounts.critical, outboundCounts.good, outboundCounts.neutral, outboundCounts.warning, t],
  );

  const chartCards = [
    {
      ariaLabel: t.dashboardCharts.serverHealth,
      label: t.dashboardCharts.serverHealth,
      option: serverOption,
      value: t.dashboardCharts.count(format.integer(servers.length)),
    },
    {
      ariaLabel: t.dashboardCharts.alertSeverity,
      label: t.dashboardCharts.alertSeverity,
      option: alertOption,
      value: t.dashboardCharts.count(format.integer(countActiveAlertRows(alerts))),
    },
    {
      ariaLabel: t.dashboardCharts.routeQuality,
      label: t.dashboardCharts.routeQuality,
      option: outboundOption,
      value: t.dashboardCharts.count(format.integer(outbounds.length)),
    },
  ];

  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.operationalMix} icon={Gauge} meta={t.dashboardCharts.scanFirst} />
      <div className="mt-2 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
        {chartCards.map((card) => (
          <div className="grid min-h-[82px] grid-cols-[72px_minmax(0,1fr)] items-center gap-2 rounded-md border border-afro-line bg-white px-2 py-1.5" key={card.label}>
            <EChart ariaLabel={card.ariaLabel} className="h-[68px] w-[72px]" option={card.option} />
            <div className="min-w-0">
              <strong className="block truncate text-[13px] text-afro-ink">{card.label}</strong>
              <span className="block truncate text-[12px] font-bold text-afro-muted">{card.value}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function OutboundsPanel({
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

export function AlertsPanel({
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
  const visibleAlerts = alerts.slice(0, 4);

  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.alerts} icon={AlertTriangle} meta={t.panels.visible(format.integer(activeAlertCount))} />
      <div className="mt-2 grid gap-2">
        {alerts.length > 0 && dataState !== 'live' ? <DataStateNotice state={dataState} t={t} /> : null}
        {alerts.length === 0 ? <DataStateEmpty emptyMessage={t.alerts.noOpenAlerts} state={dataState} t={t} /> : null}
        {visibleAlerts.map((alert) => (
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

export function CapacityPanel({ format, t, trafficTotals }: { format: DashboardFormatters; t: DashboardStrings; trafficTotals: TrafficTotals }) {
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

export function ControlPlanePanel({
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

export function createBackupControlPlaneRow(
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
