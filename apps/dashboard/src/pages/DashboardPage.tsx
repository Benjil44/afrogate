import type { AdminBackupStatusSummary, MetricsTimeRange, ServerMetricTimeseries } from '@afrows/shared';
import { AlertsPanel, CapacityPanel, ControlPlanePanel, DashboardOverviewChartsPanel, HealthChartPanel, OutboundsPanel } from '../components/dashboard-panels';
import { ServerPanel, TunnelPanel } from '../components/panels';
import { MetricCard } from '../components/primitives';
import { countActiveUsers } from '../mappers';
import type { AlertRowData, DataState, MetricCardData, OutboundRowData, ServerRowData, TrafficTotals, TunnelRowData } from '../dashboard-types';
import type { DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';

export function DashboardPage({
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
  activeUsers,
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
  activeUsers?: number;
  t: DashboardStrings;
  tunnelDataState: DataState;
  tunnels: TunnelRowData[];
  timeRange: MetricsTimeRange;
  trafficTotals: TrafficTotals;
}) {
  // No monitored-node history (single box) → drop the empty Health timeline and
  // give the remaining panels a 2-column layout instead of a hole.
  const showHealthTimeline = chartSeries.length > 0;
  return (
    <>
      <section
        className={`mt-2 grid items-start gap-2 ${
          showHealthTimeline
            ? 'xl:grid-cols-[minmax(280px,0.34fr)_minmax(0,0.92fr)_minmax(280px,0.38fr)]'
            : 'xl:grid-cols-[minmax(280px,1fr)_minmax(280px,0.55fr)]'
        }`}
      >
        <section className="grid gap-2 sm:grid-cols-2" aria-label={t.aria.summary}>
          {summary.map((item) => (
            <MetricCard item={item} key={item.label} />
          ))}
        </section>

        {showHealthTimeline ? (
          <HealthChartPanel
            dataState={dataState}
            format={format}
            range={timeRange}
            series={chartSeries}
            t={t}
            onRangeChange={onRangeChange}
          />
        ) : null}
        <DashboardOverviewChartsPanel alerts={alerts} format={format} outbounds={outbounds} servers={servers} t={t} />
      </section>

      <section className="mt-2 grid items-start gap-2 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_minmax(0,0.85fr)]">
        {servers.length > 0 ? <ServerPanel dataState={serverDataState} format={format} servers={servers} t={t} /> : null}
        {servers.length > 0 ? <TunnelPanel dataState={tunnelDataState} format={format} t={t} tunnels={tunnels} /> : null}
        <div className={servers.length > 0 ? '' : 'xl:col-span-3'}>
          <AlertsPanel alerts={alerts} dataState={alertDataState} format={format} t={t} />
        </div>
      </section>

      <section className="mt-2 grid items-start gap-2 xl:grid-cols-3">
        <OutboundsPanel dataState={routeDataState} format={format} outbounds={outbounds} t={t} />
        <CapacityPanel activeUsers={activeUsers ?? countActiveUsers(servers)} format={format} t={t} trafficTotals={trafficTotals} />
        <ControlPlanePanel backupDataState={backupDataState} backupStatus={backupStatus} format={format} t={t} />
      </section>
    </>
  );
}
