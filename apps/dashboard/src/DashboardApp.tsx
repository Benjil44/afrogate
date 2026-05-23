import { useEffect, useMemo, useState, type ComponentType, type CSSProperties, type ReactNode } from 'react';
import type {
  MetricsTimeRange,
  NetworkInterfaceMetric,
  ServerMetricSnapshot,
  ServerMetricTimeseries,
  StorageVolumeMetric,
} from '@afrogate/shared';
import {
  Activity,
  AlertTriangle,
  ArrowDownUp,
  Bell,
  Clock,
  Cpu,
  Download,
  Gauge,
  HardDrive,
  Languages,
  MemoryStick,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Route,
  Server,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import rootPackage from '../../../package.json';
import { fetchLatestMetrics, fetchMetricsTimeseries } from './api/metrics';
import { EChart, type AfroChartOption } from './components/EChart';
import { useDashboardLanguage, type DashboardLanguage, type DashboardStrings } from './i18n';

type Tone = 'good' | 'neutral' | 'warning' | 'critical';
type DataState = 'loading' | 'live' | 'stale' | 'fallback';
type ActiveView = 'dashboard' | 'servers' | 'routes' | 'alerts';
type AfroIcon = ComponentType<{ size?: number; className?: string }>;

interface MetricCardData {
  label: string;
  value: string;
  tone: Tone;
}

interface TrafficTotals {
  downloadBps: number | null;
  uploadBps: number | null;
}

interface ServerRowData {
  id: string;
  name: string;
  meta: string;
  cpu: number | null;
  ram: number | null;
  diskFree: number | null;
  storages: StorageVolumeMetric[];
  networkInterfaces: NetworkInterfaceMetric[];
  inboundBps: number | null;
  outboundBps: number | null;
  score: number;
  observedAt?: string;
}

interface TunnelRowData {
  name: string;
  operator: string;
  ping: number;
  jitter: number;
  loss: number;
  score: number;
}

interface OutboundRowData {
  name: string;
  type: string;
  priority: number;
  status: 'healthy' | 'standby' | 'restricted';
  latencyMs: number | null;
  mode: string;
}

interface AlertRowData {
  title: string;
  source: string;
  severity: Tone;
}

interface NavItemData {
  id: ActiveView;
  labelKey: ActiveView;
  icon: AfroIcon;
}

interface SidebarAlertState {
  tone: 'warning' | 'critical';
  countLabel: string;
}

type DashboardFormatters = ReturnType<typeof createDashboardFormatters>;

const refreshIntervalMs = 10_000;
const timeRanges: Array<{ label: string; value: MetricsTimeRange }> = [
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '6h', value: '6h' },
  { label: '24h', value: '24h' },
];

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
    inboundBps: 7_800_000,
    outboundBps: 3_200_000,
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
    inboundBps: 6_400_000,
    outboundBps: 2_700_000,
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
    inboundBps: 12_500_000,
    outboundBps: 9_100_000,
    score: 96,
  },
];

const tunnels: TunnelRowData[] = [
  { name: 'wg1', operator: 'Mobinnet', ping: 46, jitter: 8, loss: 0.1, score: 95 },
  { name: 'wireguard2', operator: 'Irancell', ping: 62, jitter: 14, loss: 0.3, score: 86 },
  { name: 'wireguard3', operator: 'Irancell', ping: 58, jitter: 11, loss: 0.2, score: 89 },
];

const outbounds: OutboundRowData[] = [
  { name: 'Germany gateway', type: 'WireGuard', priority: 1, status: 'healthy', latencyMs: 50, mode: 'primary' },
  { name: 'Control egress', type: 'VLESS proxy', priority: 2, status: 'standby', latencyMs: 67, mode: 'telegram/api' },
  { name: 'Iran direct', type: 'Direct', priority: 3, status: 'restricted', latencyMs: null, mode: 'last resort' },
];

const navItems: NavItemData[] = [
  { id: 'dashboard', labelKey: 'dashboard', icon: Activity },
  { id: 'servers', labelKey: 'servers', icon: Server },
  { id: 'routes', labelKey: 'routes', icon: Route },
  { id: 'alerts', labelKey: 'alerts', icon: Bell },
];

const panelClass = 'min-w-0 rounded-md border border-afro-line bg-afro-panel p-3';
const mutedTextClass = 'text-[13px] text-afro-muted';
const appVersion = rootPackage.version;
const sidebarStorageKey = 'afrogate.dashboard.sidebar';

function loadInitialSidebarCollapsed() {
  return window.localStorage.getItem(sidebarStorageKey) === 'collapsed';
}

export function DashboardApp() {
  const { isRtl, language, nextLanguage, setLanguage, strings: t } = useDashboardLanguage();
  const format = useMemo(() => createDashboardFormatters(language), [language]);
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [metrics, setMetrics] = useState<ServerMetricSnapshot[]>([]);
  const [timeseries, setTimeseries] = useState<ServerMetricTimeseries[]>([]);
  const [timeRange, setTimeRange] = useState<MetricsTimeRange>('1h');
  const [dataState, setDataState] = useState<DataState>('loading');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(loadInitialSidebarCollapsed);
  const wallClock = useWallClock(format);

  useEffect(() => {
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
  }, [timeRange]);

  useEffect(() => {
    window.localStorage.setItem(sidebarStorageKey, isSidebarCollapsed ? 'collapsed' : 'expanded');
  }, [isSidebarCollapsed]);

  const serverRows = useMemo(
    () => (metrics.length > 0 ? metrics.map(mapSnapshotToServerRow) : fallbackServers),
    [metrics],
  );
  const trafficTotals = useMemo(() => createTrafficTotals(serverRows), [serverRows]);
  const summary = useMemo(() => createSummary(serverRows, trafficTotals, t, format), [format, serverRows, trafficTotals, t]);
  const chartSeries = useMemo(
    () => (timeseries.length > 0 ? timeseries : createFallbackTimeseries(serverRows, timeRange)),
    [serverRows, timeRange, timeseries],
  );
  const alerts = useMemo(() => createAlertRows(serverRows, t), [serverRows, t]);
  const sidebarAlertState = useMemo(() => createSidebarAlertState(alerts, format), [alerts, format]);
  const status = getDataStatus(dataState, lastUpdated, t, format);
  const header = getPageHeader(activeView, t);
  const shellGridClass = isSidebarCollapsed ? 'lg:grid-cols-[80px_minmax(0,1fr)]' : 'lg:grid-cols-[248px_minmax(0,1fr)]';

  return (
    <main
      className={`grid min-h-screen grid-cols-1 overflow-x-hidden bg-afro-page text-afro-ink lg:h-screen lg:min-h-0 lg:overflow-hidden ${shellGridClass}`}
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={language}
    >
      <Sidebar
        activeView={activeView}
        isCollapsed={isSidebarCollapsed}
        nextLanguage={nextLanguage}
        onLanguageChange={setLanguage}
        onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
        onViewChange={setActiveView}
        sidebarAlertState={sidebarAlertState}
        t={t}
      />

      <section className="min-w-0 max-w-full p-3 md:p-4 lg:h-screen lg:overflow-y-auto">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-0.5 text-[11px] font-bold uppercase text-afro-teal">{header.eyebrow}</p>
            <h1 className="text-[21px] leading-tight font-bold md:text-[22px]">{header.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex min-h-7 w-fit items-center gap-1.5 rounded-full border border-afro-line bg-white px-2.5 text-[12px] font-bold text-afro-ink">
              <Clock size={15} />
              {wallClock}
            </div>
            <div className={`inline-flex min-h-7 w-fit items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-bold ${status.className}`}>
              <span className={`size-2 rounded-full ${status.dotClassName}`} />
              {status.label}
            </div>
          </div>
        </header>

        <SystemResourceHeader format={format} servers={serverRows} t={t} trafficTotals={trafficTotals} />

        <div className="mt-2.5 border-t border-afro-line" />

        <ActivePage
          activeView={activeView}
          alerts={alerts}
          chartSeries={chartSeries}
          format={format}
          onRangeChange={setTimeRange}
          servers={serverRows}
          summary={summary}
          t={t}
          timeRange={timeRange}
          trafficTotals={trafficTotals}
        />
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
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <ResourceStat icon={Cpu} label={t.resources.cpuAverage} tone={getUsageTone(cpuAverage)} value={format.percent(cpuAverage)} />
        <ResourceStat icon={MemoryStick} label={t.resources.ramAverage} tone={getUsageTone(ramAverage)} value={format.percent(ramAverage)} />
        <ResourceStat icon={HardDrive} label={t.resources.lowestStorage} tone={getStorageTone(lowestStorage)} value={format.percent(lowestStorage)} />
        <ResourceStat icon={Download} label={t.resources.download} tone="neutral" value={format.bytesPerSecond(trafficTotals.downloadBps)} />
        <ResourceStat icon={Upload} label={t.resources.upload} tone="neutral" value={format.bytesPerSecond(trafficTotals.uploadBps)} />
      </div>

      <div className="mt-2 overflow-x-auto rounded-md border border-afro-line bg-afro-panel">
        <div className="grid min-w-[220px] gap-1.5 p-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {storages.map((storage) => (
            <div className="min-w-0 rounded-md border border-afro-line px-2 py-1" key={`${storage.serverName}-${storage.path}`}>
              <div className="flex items-center justify-between gap-2">
                <strong className="min-w-0 truncate text-[13px]">{format.label(storage.serverName)}</strong>
                <StatusBadge tone={getStorageTone(storage.freePercent ?? null)}>
                  {format.percent(storage.freePercent ?? null)}
                </StatusBadge>
              </div>
              <div className={`${mutedTextClass} truncate`}>{storage.path}</div>
            </div>
          ))}
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

  return (
    <div className={`grid min-h-[58px] gap-1 rounded-md border border-t-4 border-afro-line bg-afro-panel p-2 ${borderClass}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-afro-muted">{label}</span>
        <Icon size={16} />
      </div>
      <strong className="text-[17px] leading-tight">{value}</strong>
    </div>
  );
}

function ActivePage({
  activeView,
  alerts,
  chartSeries,
  format,
  onRangeChange,
  servers,
  summary,
  t,
  timeRange,
  trafficTotals,
}: {
  activeView: ActiveView;
  alerts: AlertRowData[];
  chartSeries: ServerMetricTimeseries[];
  format: DashboardFormatters;
  onRangeChange: (range: MetricsTimeRange) => void;
  servers: ServerRowData[];
  summary: MetricCardData[];
  t: DashboardStrings;
  timeRange: MetricsTimeRange;
  trafficTotals: TrafficTotals;
}) {
  switch (activeView) {
    case 'servers':
      return <ServersPage format={format} servers={servers} t={t} />;
    case 'routes':
      return <RoutesPage format={format} t={t} />;
    case 'alerts':
      return <AlertsPage alerts={alerts} format={format} t={t} />;
    default:
      return (
        <DashboardPage
          alerts={alerts}
          chartSeries={chartSeries}
          format={format}
          onRangeChange={onRangeChange}
          servers={servers}
          summary={summary}
          t={t}
          timeRange={timeRange}
          trafficTotals={trafficTotals}
        />
      );
  }
}

function DashboardPage({
  alerts,
  chartSeries,
  format,
  onRangeChange,
  servers,
  summary,
  t,
  timeRange,
  trafficTotals,
}: {
  alerts: AlertRowData[];
  chartSeries: ServerMetricTimeseries[];
  format: DashboardFormatters;
  onRangeChange: (range: MetricsTimeRange) => void;
  servers: ServerRowData[];
  summary: MetricCardData[];
  t: DashboardStrings;
  timeRange: MetricsTimeRange;
  trafficTotals: TrafficTotals;
}) {
  return (
    <>
      <section className="mt-2 grid items-start gap-2 xl:grid-cols-[minmax(300px,0.42fr)_minmax(0,1fr)]">
        <section className="grid gap-2 sm:grid-cols-2" aria-label={t.aria.summary}>
          {summary.map((item) => (
            <MetricCard item={item} key={item.label} />
          ))}
        </section>

        <HealthChartPanel
          format={format}
          range={timeRange}
          series={chartSeries}
          t={t}
          onRangeChange={onRangeChange}
        />
      </section>

      <section className="mt-2 grid items-start gap-2 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_minmax(0,0.85fr)]">
        <ServerPanel format={format} servers={servers} t={t} />
        <TunnelPanel format={format} t={t} />
        <AlertsPanel alerts={alerts} format={format} t={t} />
      </section>

      <section className="mt-2 grid items-start gap-2 xl:grid-cols-3">
        <OutboundsPanel format={format} t={t} />
        <CapacityPanel format={format} t={t} trafficTotals={trafficTotals} />
        <ControlPlanePanel format={format} t={t} />
      </section>
    </>
  );
}

function HealthChartPanel({
  format,
  range,
  series,
  t,
  onRangeChange,
}: {
  format: DashboardFormatters;
  range: MetricsTimeRange;
  series: ServerMetricTimeseries[];
  t: DashboardStrings;
  onRangeChange: (range: MetricsTimeRange) => void;
}) {
  const option = useMemo(() => createHealthChartOption(series, t, format), [format, series, t]);

  return (
    <section className={panelClass}>
      <div className="flex flex-col gap-2 border-b border-afro-line pb-2 sm:flex-row sm:items-center sm:justify-between">
        <PanelHeadingContent title={t.panels.healthTimeline} meta={t.panels.monitoredNodes(format.integer(series.length))} />
        <div className="inline-grid w-fit grid-flow-col rounded-md border border-afro-line bg-[#eef3f5] p-1">
          {timeRanges.map((item) => {
            const isActive = item.value === range;
            const activeClass = isActive ? 'bg-white text-afro-ink shadow-sm' : 'text-afro-muted hover:text-afro-ink';

            return (
              <button
                className={`min-h-7 min-w-10 rounded px-2 text-[13px] font-bold ${activeClass}`}
                key={item.value}
                onClick={() => onRangeChange(item.value)}
                type="button"
              >
                {format.timeRange(item.value)}
              </button>
            );
          })}
        </div>
      </div>
      <EChart
        ariaLabel={t.aria.healthChart}
        className="mt-2 h-[138px] w-full xl:h-[142px] 2xl:h-[136px]"
        option={option}
      />
    </section>
  );
}

function OutboundsPanel({ format, t }: { format: DashboardFormatters; t: DashboardStrings }) {
  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.outbounds} icon={ArrowDownUp} meta={t.panels.priorityFailover} />
      <div className="mt-2.5 grid gap-2">
        {outbounds.map((outbound) => (
          <div className="grid min-h-[46px] grid-cols-[24px_1fr_auto] items-center gap-2 rounded-md border border-afro-line p-2" key={outbound.name}>
            <span className="grid size-6 place-items-center rounded bg-[#eef3f5] text-[12px] font-bold text-afro-ink">{format.integer(outbound.priority)}</span>
            <div className="min-w-0">
              <strong className="block truncate">{format.label(outbound.name)}</strong>
              <span className={`${mutedTextClass} block truncate`}>{format.label(outbound.type)} / {format.label(outbound.mode)}</span>
            </div>
            <div className="text-right">
              <StatusBadge tone={outbound.status === 'healthy' ? 'good' : outbound.status === 'standby' ? 'neutral' : 'warning'}>
                {t.status[outbound.status]}
              </StatusBadge>
              <div className={mutedTextClass}>{format.latency(outbound.latencyMs)}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AlertsPanel({ alerts, format, t }: { alerts: AlertRowData[]; format: DashboardFormatters; t: DashboardStrings }) {
  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.alerts} icon={AlertTriangle} meta={t.panels.visible(format.integer(alerts.length))} />
      <div className="mt-2.5 grid gap-2">
        {alerts.map((alert) => (
          <div className="grid min-h-[42px] grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-afro-line p-2" key={`${alert.source}-${alert.title}`}>
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

function CapacityPanel({ format, t, trafficTotals }: { format: DashboardFormatters; t: DashboardStrings; trafficTotals: TrafficTotals }) {
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
      <div className="mt-2.5 grid gap-1.5">
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

function ControlPlanePanel({ format, t }: { format: DashboardFormatters; t: DashboardStrings }) {
  const rows = [
    { label: t.controlPlaneRows.metricsIngest, value: format.durationSeconds(10), tone: 'good' as Tone },
    { label: t.controlPlaneRows.telegramApiEgress, value: t.controlPlaneRows.proxyReady, tone: 'neutral' as Tone },
    { label: t.controlPlaneRows.storageAlert, value: format.percentThreshold('<', 10), tone: 'warning' as Tone },
    { label: t.controlPlaneRows.backups, value: t.controlPlaneRows.pending, tone: 'warning' as Tone },
  ];

  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.controlPlane} icon={ShieldCheck} meta={t.panels.operations} />
      <div className="mt-2.5 grid gap-2">
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

function ServersPage({ format, servers, t }: { format: DashboardFormatters; servers: ServerRowData[]; t: DashboardStrings }) {
  return (
    <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
      <section className={panelClass}>
        <PanelHeading title={t.panels.serverInventory} icon={Server} meta={t.panels.managedNodes(format.integer(servers.length))} />
        <div className="mt-2.5 grid gap-2.5">
          {servers.map((server, index) => (
            <ServerManagementCard format={format} index={index} server={server} key={server.id} t={t} />
          ))}
        </div>
      </section>

      <section className={panelClass}>
        <PanelHeading title={t.panels.accessBootstrap} icon={ShieldCheck} meta={t.panels.safeOperations} />
        <div className="mt-2.5 grid gap-2">
          {[
            [t.accessRows.defaultUser, 'afrogate'],
            [t.accessRows.accessMethod, t.accessRows.sshKey],
            [t.accessRows.rootPassword, t.accessRows.bootstrapOnly],
            [t.accessRows.credentialView, t.accessRows.hidden],
            [t.accessRows.auditMode, t.accessRows.required],
          ].map(([label, value]) => (
            <div className="flex min-h-9 items-center justify-between gap-2 rounded-md border border-afro-line px-2.5" key={label}>
              <span className={`${mutedTextClass} min-w-0 truncate`}>{label}</span>
              <strong className="text-sm">{value}</strong>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function ServerManagementCard({ format, index, server, t }: { format: DashboardFormatters; index: number; server: ServerRowData; t: DashboardStrings }) {
  const interfaces = index === 0
    ? ['ether1 / Mobinnet / wg1', 'ether2 / Irancell / wireguard2']
    : index === 1
      ? ['ether5 / Irancell / wireguard3']
      : ['core uplink / Germany / gateway'];

  return (
    <article className="rounded-md border border-afro-line p-2.5">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <strong className="block truncate text-base">{format.label(server.name)}</strong>
          <span className={mutedTextClass}>{format.label(server.meta)}</span>
        </div>
        <button
          className="min-h-8 rounded-md border border-afro-line bg-white px-2.5 text-[13px] font-bold text-afro-ink hover:border-afro-blue hover:text-afro-blue"
          type="button"
        >
          {t.actions.edit}
        </button>
      </div>

      <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
        <UsageBar format={format} icon={Cpu} label={t.resources.cpu} value={server.cpu} />
        <UsageBar format={format} icon={MemoryStick} label={t.resources.ram} value={server.ram} />
        <UsageBar format={format} icon={HardDrive} label={t.resources.diskFree} value={server.diskFree} invert />
      </div>

      <div className="mt-2.5 grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="grid gap-1.5">
          {interfaces.map((item) => (
            <span className="rounded-md bg-[#eef3f5] px-2 py-1 text-[12px] text-afro-muted" key={item}>
              {format.label(item)}
            </span>
          ))}
        </div>
        <div className="text-left sm:text-right">
          <span className={mutedTextClass}>{t.resources.health}</span>
          <b className={`block text-[20px] ${getScoreClass(server.score)}`}>{format.integer(server.score)}</b>
        </div>
      </div>
    </article>
  );
}

function RoutesPage({ format, t }: { format: DashboardFormatters; t: DashboardStrings }) {
  return (
    <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <TunnelPanel format={format} t={t} />
      <OutboundsPanel format={format} t={t} />
      <RoutePolicyPanel format={format} t={t} />
      <FailoverPanel format={format} t={t} />
    </section>
  );
}

function RoutePolicyPanel({ format, t }: { format: DashboardFormatters; t: DashboardStrings }) {
  const policies: Array<[string, string, Tone]> = [
    [t.routePolicy.autoRoute, t.routePolicy.enabled, 'good'],
    [t.routePolicy.routeLock, t.routePolicy.available, 'neutral'],
    [t.routePolicy.cooldown, format.durationSeconds(120), 'neutral'],
    [t.routePolicy.hysteresis, format.scoreDelta(15), 'neutral'],
  ];

  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.routePolicy} icon={Route} meta={t.panels.stabilityRules} />
      <div className="mt-2.5 grid gap-2">
        {policies.map(([label, value, tone]) => (
          <div className="flex min-h-9 items-center justify-between gap-2 rounded-md border border-afro-line px-2.5" key={label}>
            <span className={`${mutedTextClass} min-w-0 truncate`}>{label}</span>
            <StatusBadge tone={tone}>{value}</StatusBadge>
          </div>
        ))}
      </div>
    </section>
  );
}

function FailoverPanel({ format, t }: { format: DashboardFormatters; t: DashboardStrings }) {
  const events: Array<[string, string, Tone]> = [
    ['Germany gateway', t.failover.primaryRouteHealthy, 'good'],
    ['Control egress', t.failover.standbyTelegramApi, 'neutral'],
    ['Iran direct', t.failover.restrictedInternetPath, 'warning'],
  ];

  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.failover} icon={ArrowDownUp} meta={t.panels.latestDecisions} />
      <div className="mt-2.5 grid gap-2">
        {events.map(([title, detail, tone]) => (
          <div className="grid min-h-[42px] grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-afro-line p-2" key={title}>
            <div className="min-w-0">
              <strong className="block truncate">{format.label(title)}</strong>
              <span className={`${mutedTextClass} block truncate`}>{detail}</span>
            </div>
            <StatusBadge tone={tone}>{t.status[tone]}</StatusBadge>
          </div>
        ))}
      </div>
    </section>
  );
}

function AlertsPage({ alerts, format, t }: { alerts: AlertRowData[]; format: DashboardFormatters; t: DashboardStrings }) {
  return (
    <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <section className={panelClass}>
        <PanelHeading title={t.panels.openAlerts} icon={AlertTriangle} meta={t.panels.activeRows(format.integer(alerts.length))} />
        <div className="mt-2.5 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {[t.tables.severity, t.tables.source, t.tables.alert, t.tables.channel].map((heading) => (
                  <th className="border-b border-afro-line px-2 py-2 text-left text-[13px] font-bold text-afro-muted first:pl-0 last:pr-0" key={heading}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={`${alert.source}-${alert.title}`}>
                  <TableCell>
                    <StatusBadge tone={alert.severity}>{t.status[alert.severity]}</StatusBadge>
                  </TableCell>
                  <TableCell>{format.label(alert.source)}</TableCell>
                  <TableCell>{alert.title}</TableCell>
                  <TableCell>{t.alerts.dashboard}</TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={panelClass}>
        <PanelHeading title={t.panels.alertRules} icon={Bell} meta={t.panels.mvpThresholds} />
        <div className="mt-2.5 grid gap-2">
          {([
            [t.alertRules.storage, format.percentThreshold('<', 10), 'critical'],
            [t.alertRules.healthScore, format.numberThreshold('<', 60), 'warning'],
            [t.alertRules.ping, format.latencyThreshold('>', 150), 'warning'],
            [t.alertRules.packetLoss, format.percentThreshold('>', 1), 'critical'],
          ] as Array<[string, string, Tone]>).map(([label, value, tone]) => (
            <div className="flex min-h-9 items-center justify-between gap-2 rounded-md border border-afro-line px-2.5" key={label}>
              <span className={`${mutedTextClass} min-w-0 truncate`}>{label}</span>
              <StatusBadge tone={tone}>{value}</StatusBadge>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function Sidebar({
  activeView,
  isCollapsed,
  nextLanguage,
  onLanguageChange,
  onToggleCollapse,
  onViewChange,
  sidebarAlertState,
  t,
}: {
  activeView: ActiveView;
  isCollapsed: boolean;
  nextLanguage: DashboardLanguage;
  onLanguageChange: (language: DashboardLanguage) => void;
  onToggleCollapse: () => void;
  onViewChange: (view: ActiveView) => void;
  sidebarAlertState: SidebarAlertState | null;
  t: DashboardStrings;
}) {
  return (
    <aside
      className={`bg-afro-sidebar px-4 py-4 text-[#eef6f4] md:px-[18px] lg:flex lg:h-screen lg:flex-col lg:overflow-hidden lg:py-6 ${isCollapsed ? 'lg:px-3' : ''}`}
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
        </div>
      </div>
      <div className={`hidden lg:flex ${isCollapsed ? 'mt-3 justify-center' : 'mt-4 justify-end'}`}>
        <SidebarToggle isCollapsed={isCollapsed} onToggle={onToggleCollapse} t={t} />
      </div>
      <nav className={`mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:flex-1 lg:grid-cols-1 lg:content-start ${isCollapsed ? 'lg:mt-4' : 'lg:mt-8'}`}>
        {navItems.map((item) => (
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
            <div className="text-[11px] font-bold text-[#c8d7d5]">v{appVersion}</div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-[#c8d7d5]">AfroGate</div>
                <div>v{appVersion}</div>
              </div>
              <LanguageButton nextLanguage={nextLanguage} onLanguageChange={onLanguageChange} t={t} />
            </div>
            <div className="mt-2">{t.languageName}</div>
          </>
        )}
      </div>
    </aside>
  );
}

function SidebarToggle({
  isCollapsed,
  onToggle,
  t,
}: {
  isCollapsed: boolean;
  onToggle: () => void;
  t: DashboardStrings;
}) {
  const Icon = isCollapsed ? PanelLeftOpen : PanelLeftClose;
  const label = isCollapsed ? t.expandSidebar : t.collapseSidebar;

  return (
    <button
      aria-pressed={isCollapsed}
      aria-label={label}
      className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-[#334852] text-[#c8d7d5] hover:border-[#5c7782] hover:text-white ${isCollapsed ? 'min-w-9 px-2' : 'px-2.5'}`}
      data-sidebar-toggle="true"
      onClick={onToggle}
      title={label}
      type="button"
    >
      <Icon className="shrink-0" size={16} />
      <span className={`text-[11px] font-bold ${isCollapsed ? 'lg:sr-only' : ''}`}>{label}</span>
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
  t,
}: {
  nextLanguage: DashboardLanguage;
  onLanguageChange: (language: DashboardLanguage) => void;
  t: DashboardStrings;
}) {
  return (
    <button
      aria-label={`${t.switchLanguage}: ${dashboardLanguageLabel(nextLanguage)}`}
      className="inline-flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-md border border-[#334852] px-2 text-[#c8d7d5] hover:border-[#5c7782] hover:text-white"
      onClick={() => onLanguageChange(nextLanguage)}
      title={`${t.switchLanguage}: ${dashboardLanguageLabel(nextLanguage)}`}
      type="button"
    >
      <Languages className="shrink-0" size={16} />
      <span className="text-[11px] font-bold">{t.nextLanguageLabel}</span>
    </button>
  );
}

function StatusBadge({ children, tone }: { children: ReactNode; tone: Tone }) {
  const toneClass = {
    good: 'border-[#b8e1cf] bg-[#e7f6ef] text-afro-green',
    neutral: 'border-[#bfd1ea] bg-[#edf4ff] text-afro-blue',
    warning: 'border-[#e6cf9c] bg-[#fff7e6] text-[#9a5b00]',
    critical: 'border-[#f0b7b7] bg-[#fff1f1] text-[#b91c1c]',
  }[tone];

  return (
    <span className={`inline-flex min-h-[22px] items-center rounded-full border px-1.5 text-[11px] font-bold ${toneClass}`}>
      {children}
    </span>
  );
}

function MetricCard({ item }: { item: MetricCardData }) {
  const toneClass = {
    good: 'border-t-afro-green',
    neutral: 'border-t-afro-blue',
    warning: 'border-t-[#c27a1a]',
    critical: 'border-t-[#b91c1c]',
  }[item.tone];

  return (
    <div className={`grid min-h-[62px] gap-1 rounded-md border border-t-4 border-afro-line bg-afro-panel p-2.5 ${toneClass}`}>
      <span className="text-[12px] text-afro-muted">{item.label}</span>
      <strong className="text-[19px] leading-tight">{item.value}</strong>
    </div>
  );
}

function ServerPanel({ format, servers, t }: { format: DashboardFormatters; servers: ServerRowData[]; t: DashboardStrings }) {
  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.servers} icon={Gauge} meta={t.panels.nodes(format.integer(servers.length))} />
      <div className="mt-2 grid gap-2">
        {servers.map((server) => (
          <ServerRow format={format} server={server} key={server.id} t={t} />
        ))}
      </div>
    </section>
  );
}

function ServerRow({ format, server, t }: { format: DashboardFormatters; server: ServerRowData; t: DashboardStrings }) {
  return (
    <div className="grid min-h-[54px] grid-cols-[minmax(116px,1fr)_auto] items-center gap-2 rounded-md border border-afro-line p-2 sm:grid-cols-[minmax(116px,1fr)_auto_auto]">
      <div className="min-w-0">
        <strong className="block truncate text-[13px]">{format.label(server.name)}</strong>
        <span className="block truncate text-[12px] text-afro-muted">{format.label(server.meta)}</span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-afro-muted">
        <UsageBar format={format} icon={Cpu} label={t.resources.cpu} value={server.cpu} />
        <UsageBar format={format} icon={MemoryStick} label={t.resources.ram} value={server.ram} />
        <UsageBar format={format} icon={HardDrive} label={t.resources.diskFree} value={server.diskFree} invert />
      </div>
      <div className="col-span-2 flex min-w-0 items-center justify-between gap-1.5 sm:col-span-1 sm:justify-end">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:justify-end">
          <MetricPill icon={Download} label={t.resources.down} value={format.bytesPerSecond(server.inboundBps)} />
          <MetricPill icon={Upload} label={t.resources.up} value={format.bytesPerSecond(server.outboundBps)} />
        </div>
        <b className={`shrink-0 text-[17px] ${getScoreClass(server.score)}`}>{format.integer(server.score)}</b>
      </div>
    </div>
  );
}

function UsageBar({
  format,
  icon: Icon,
  label,
  value,
  invert = false,
}: {
  format: DashboardFormatters;
  icon: AfroIcon;
  label: string;
  value: number | null;
  invert?: boolean;
}) {
  const hasValue = typeof value === 'number' && Number.isFinite(value);
  const boundedValue = hasValue ? clamp(value, 0, 100) : 0;
  const fillValue = invert ? 100 - boundedValue : boundedValue;
  const displayValue = format.percent(hasValue ? value : null);

  return (
    <span
      aria-label={`${label} ${displayValue}`}
      className="inline-flex min-h-[19px] min-w-[46px] items-center justify-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] leading-tight text-[#243238]"
      style={{
        background: `linear-gradient(90deg, #a9d8d1 ${fillValue}%, #edf2f4 0)`,
      } as CSSProperties}
      title={`${label} ${displayValue}`}
    >
      <Icon className="shrink-0" size={12} />
      <span className="whitespace-nowrap font-bold">{displayValue}</span>
    </span>
  );
}

function MetricPill({ icon: Icon, label, value }: { icon: AfroIcon; label: string; value: string }) {
  return (
    <span
      aria-label={`${label} ${value}`}
      className="inline-flex min-h-[19px] min-w-[80px] shrink-0 items-center justify-center gap-1 rounded-full bg-[#f4f7f8] px-1.5 py-0.5 text-[11px] font-bold leading-tight text-afro-ink"
      title={`${label} ${value}`}
    >
      <Icon className="shrink-0 text-afro-muted" size={12} />
      <span className="whitespace-nowrap">{value}</span>
    </span>
  );
}

function TunnelPanel({ format, t }: { format: DashboardFormatters; t: DashboardStrings }) {
  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.tunnels} icon={Route} meta={t.panels.links(format.integer(3))} />
      <div className="mt-2.5 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {[t.tables.tunnel, t.tables.operator, t.tables.ping, t.tables.jitter, t.tables.loss, t.tables.score].map((heading) => (
                <th className="border-b border-afro-line px-2 py-2 text-left text-[13px] font-bold text-afro-muted last:pr-0 last:text-right first:pl-0" key={heading}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tunnels.map((tunnel) => (
              <tr key={tunnel.name}>
                <TableCell>{tunnel.name}</TableCell>
                <TableCell>{format.label(tunnel.operator)}</TableCell>
                <TableCell>{format.latency(tunnel.ping)}</TableCell>
                <TableCell>{format.latency(tunnel.jitter)}</TableCell>
                <TableCell>{format.packetLoss(tunnel.loss)}</TableCell>
                <TableCell alignRight>
                  <strong className={getScoreClass(tunnel.score)}>{format.integer(tunnel.score)}</strong>
                </TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PanelHeading({
  title,
  icon: Icon,
  meta,
}: {
  title: string;
  icon: AfroIcon;
  meta?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-afro-line pb-2">
      <PanelHeadingContent title={title} meta={meta} />
      <Icon size={16} />
    </div>
  );
}

function PanelHeadingContent({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="min-w-0">
      <h2 className="truncate text-[14px] font-bold">{title}</h2>
      {meta ? <span className={`${mutedTextClass} block truncate`}>{meta}</span> : null}
    </div>
  );
}

function TableCell({ children, alignRight = false }: { children: ReactNode; alignRight?: boolean }) {
  const alignmentClass = alignRight ? 'text-right' : 'text-left';

  return (
    <td className={`border-b border-afro-line px-2 py-2 text-[13px] text-afro-muted first:pl-0 last:pr-0 ${alignmentClass}`}>
      {children}
    </td>
  );
}

function mapSnapshotToServerRow(snapshot: ServerMetricSnapshot): ServerRowData {
  return {
    id: snapshot.serverId,
    name: snapshot.hostname || snapshot.serverId,
    meta: snapshot.platform || snapshot.serverId,
    cpu: normalizePercent(snapshot.cpuPercent),
    ram: normalizePercent(snapshot.ramPercent),
    diskFree: normalizePercent(snapshot.diskFreePercent),
    storages: snapshot.storages ?? createStorageFallback(snapshot.diskFreePercent),
    networkInterfaces: snapshot.networkInterfaces ?? [],
    inboundBps: normalizePositive(snapshot.inboundBps),
    outboundBps: normalizePositive(snapshot.outboundBps),
    score: snapshot.healthScore,
    observedAt: snapshot.observedAt,
  };
}

function createSummary(
  servers: ServerRowData[],
  trafficTotals: TrafficTotals,
  t: DashboardStrings,
  format: DashboardFormatters,
): MetricCardData[] {
  const criticalAlerts = servers.filter((server) => server.score < 50 || (server.diskFree !== null && server.diskFree < 10)).length;

  return [
    { label: t.summary.activeUsers, value: format.integer(150), tone: 'neutral' },
    { label: t.summary.downloadNow, value: format.bytesPerSecond(trafficTotals.downloadBps), tone: 'good' },
    { label: t.summary.uploadNow, value: format.bytesPerSecond(trafficTotals.uploadBps), tone: 'neutral' },
    { label: t.summary.criticalAlerts, value: format.integer(criticalAlerts), tone: criticalAlerts > 0 ? 'critical' : 'good' },
  ];
}

function createTrafficTotals(servers: ServerRowData[]): TrafficTotals {
  return {
    downloadBps: sumNullable(servers.map((server) => server.inboundBps)),
    uploadBps: sumNullable(servers.map((server) => server.outboundBps)),
  };
}

function createAlertRows(servers: ServerRowData[], t: DashboardStrings): AlertRowData[] {
  const rows: AlertRowData[] = [];

  for (const server of servers) {
    if (server.diskFree !== null && server.diskFree < 10) {
      rows.push({
        title: t.alerts.storageBelow,
        source: server.name,
        severity: 'critical',
      });
    }

    if (server.score < 60) {
      rows.push({
        title: t.alerts.healthScoreDegraded,
        source: server.name,
        severity: server.score < 40 ? 'critical' : 'warning',
      });
    }
  }

  if (rows.length > 0) return rows.slice(0, 4);

  return [
    { title: t.alerts.noCriticalServerAlerts, source: t.alerts.monitoring, severity: 'good' },
    { title: t.alerts.outboundFailoverReady, source: t.alerts.routes, severity: 'neutral' },
    { title: t.alerts.backupMonitorPending, source: t.alerts.controlPlane, severity: 'warning' },
  ];
}

function createSidebarAlertState(alerts: AlertRowData[], format: DashboardFormatters): SidebarAlertState | null {
  const criticalCount = alerts.filter((alert) => alert.severity === 'critical').length;
  if (criticalCount > 0) {
    return {
      tone: 'critical',
      countLabel: format.integer(criticalCount),
    };
  }

  const warningCount = alerts.filter((alert) => alert.severity === 'warning').length;
  if (warningCount > 0) {
    return {
      tone: 'warning',
      countLabel: format.integer(warningCount),
    };
  }

  return null;
}

function createHealthChartOption(
  series: ServerMetricTimeseries[],
  t: DashboardStrings,
  format: DashboardFormatters,
): AfroChartOption {
  const chartSeries = series.map((item, index) => ({
    name: format.label(item.hostname || item.serverId),
    type: 'line' as const,
    showSymbol: false,
    smooth: true,
    sampling: 'lttb' as const,
    lineStyle: {
      width: 2,
    },
    markLine: index === 0
      ? {
          silent: true,
          symbol: 'none',
          label: {
            color: '#9a5b00',
            formatter: t.chart.watch,
          },
          lineStyle: {
            color: '#c27a1a',
            type: 'dashed' as const,
            width: 1,
          },
          data: [{ yAxis: 60 }],
        }
      : undefined,
    data: item.points.map((point) => [point.observedAt, point.healthScore]),
  }));

  return {
    color: ['#238a4b', '#2764a8', '#c27a1a', '#0f8f83', '#b91c1c'],
    textStyle: {
      fontFamily: format.fontFamily,
    },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value) => format.integer(Math.round(Number(value))),
    },
    legend: {
      top: 0,
      type: 'scroll',
      icon: 'roundRect',
      itemHeight: 8,
      itemWidth: 18,
      textStyle: {
        color: '#60717a',
        fontFamily: format.fontFamily,
      },
    },
    grid: {
      bottom: 24,
      containLabel: true,
      left: 6,
      right: 8,
      top: 36,
    },
    xAxis: {
      type: 'time',
      axisLine: {
        lineStyle: { color: '#dce4e8' },
      },
      axisLabel: {
        color: '#60717a',
        formatter: (value: string | number) => format.chartTime(value),
        hideOverlap: true,
        margin: 8,
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
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
    series: chartSeries,
  };
}

function createFallbackTimeseries(
  servers: ServerRowData[],
  range: MetricsTimeRange,
): ServerMetricTimeseries[] {
  const rangeMinutes = {
    '15m': 15,
    '1h': 60,
    '6h': 360,
    '24h': 1440,
  }[range];
  const pointCount = Math.min(48, Math.max(8, Math.round(rangeMinutes / 5)));
  const now = Date.now();
  const stepMs = (rangeMinutes * 60 * 1000) / Math.max(1, pointCount - 1);

  return servers.map((server, serverIndex) => ({
    serverId: server.id,
    hostname: server.name,
    platform: server.meta,
    points: Array.from({ length: pointCount }, (_, pointIndex) => {
      const wave = Math.sin((pointIndex + serverIndex) / 2.4) * 4;
      const drift = pointIndex % 7 === 0 ? -2 : 1;

      return {
        observedAt: new Date(now - (pointCount - pointIndex - 1) * stepMs).toISOString(),
        cpuPercent: server.cpu,
        ramPercent: server.ram,
        diskFreePercent: server.diskFree,
        healthScore: Math.round(clamp(server.score + wave + drift, 0, 100)),
      };
    }),
  }));
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

function getPageHeader(activeView: ActiveView, t: DashboardStrings) {
  return t.pageHeaders[activeView];
}

function getStorageTone(value: number | null): Tone {
  if (value === null) return 'neutral';
  if (value < 10) return 'critical';
  if (value < 20) return 'warning';
  return 'neutral';
}

function getUsageTone(value: number | null): Tone {
  if (value === null) return 'neutral';
  if (value >= 90) return 'critical';
  if (value >= 75) return 'warning';
  return 'good';
}

function getScoreClass(score: number): string {
  if (score >= 80) return 'text-afro-green';
  if (score >= 60) return 'text-afro-blue';
  if (score >= 40) return 'text-[#c27a1a]';
  return 'text-[#b91c1c]';
}

function normalizePercent(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return clamp(value, 0, 100);
}

function normalizePositive(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, value);
}

function createStorageFallback(diskFreePercent: number | null | undefined): StorageVolumeMetric[] {
  const freePercent = normalizePercent(diskFreePercent);

  return freePercent === null ? [] : [{ path: '/', freePercent, usedPercent: 100 - freePercent }];
}

function averagePercent(values: Array<number | null>): number | null {
  const validValues = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (validValues.length === 0) return null;

  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

function sumNullable(values: Array<number | null>): number | null {
  const validValues = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (validValues.length === 0) return null;

  return validValues.reduce((sum, value) => sum + value, 0);
}

function createDashboardFormatters(language: DashboardLanguage) {
  const isPersian = language === 'fa';
  const locale = isPersian ? 'fa-IR-u-nu-arabext' : 'en-US';
  const percentSign = isPersian ? '٪' : '%';
  const fontFamily = isPersian
    ? '"AfroGate IRANSans", Tahoma, Arial, sans-serif'
    : 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const integerFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const decimalFormatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });
  const clockFormatter = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    hour12: !isPersian,
    minute: '2-digit',
    second: '2-digit',
  });
  const shortTimeFormatter = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    hour12: !isPersian,
    minute: '2-digit',
  });

  const integer = (value: number): string => integerFormatter.format(Number.isFinite(value) ? value : 0);
  const decimal = (value: number): string => decimalFormatter.format(Number.isFinite(value) ? value : 0);
  const percent = (value: number | null): string => value === null ? '--' : `${integer(Math.round(value))}${percentSign}`;
  const persianLabels: Record<string, string> = {
    'Iran Edge 01': 'لبه ایران ۰۱',
    'Iran Edge 02': 'لبه ایران ۰۲',
    'Germany Core 01': 'هسته آلمان ۰۱',
    'Germany gateway': 'درگاه آلمان',
    'Control egress': 'خروجی کنترل',
    'Iran direct': 'مسیر مستقیم ایران',
    'Mobinnet': 'مبین‌نت',
    'Irancell': 'ایرانسل',
    'IR': 'ایران',
    'DE': 'آلمان',
    'WireGuard': 'وایرگارد',
    'VLESS proxy': 'پراکسی VLESS',
    'Direct': 'مستقیم',
    'primary': 'اصلی',
    'telegram/api': 'تلگرام/API',
    'last resort': 'آخرین مسیر',
    'ether1 / Mobinnet / wg1': 'ether1 / مبین‌نت / wg1',
    'ether2 / Irancell / wireguard2': 'ether2 / ایرانسل / wireguard2',
    'ether5 / Irancell / wireguard3': 'ether5 / ایرانسل / wireguard3',
    'core uplink / Germany / gateway': 'آپ‌لینک هسته / آلمان / درگاه',
  };

  const formatCompactNumber = (value: number): string => {
    const roundedValue = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;

    return Number.isInteger(roundedValue) ? integer(roundedValue) : decimal(roundedValue);
  };

  return {
    fontFamily,
    integer,
    percent,
    label(value: string): string {
      return isPersian ? persianLabels[value] ?? value : value;
    },
    bytesPerSecond(value: number | null): string {
      if (value === null) return '--';

      const units = isPersian
        ? ['بایت/ث', 'کیلوبایت/ث', 'مگابایت/ث', 'گیگابایت/ث']
        : ['B/s', 'KB/s', 'MB/s', 'GB/s'];
      let currentValue = value;
      let unitIndex = 0;

      while (currentValue >= 1024 && unitIndex < units.length - 1) {
        currentValue /= 1024;
        unitIndex += 1;
      }

      return `${formatCompactNumber(currentValue)} ${units[unitIndex]}`;
    },
    packetLoss(value: number | null): string {
      return value === null ? '--' : `${decimal(value)}${percentSign}`;
    },
    latency(value: number | null): string {
      if (value === null) return '--';

      return isPersian ? `${integer(value)} میلی‌ثانیه` : `${integer(value)} ms`;
    },
    durationSeconds(value: number): string {
      return isPersian ? `${integer(value)} ثانیه` : `${integer(value)}s`;
    },
    percentThreshold(operator: '<' | '>', value: number): string {
      return `${operator} ${percent(value)}`;
    },
    numberThreshold(operator: '<' | '>', value: number): string {
      return `${operator} ${integer(value)}`;
    },
    latencyThreshold(operator: '<' | '>', value: number): string {
      return `${operator} ${isPersian ? `${integer(value)} میلی‌ثانیه` : `${integer(value)} ms`}`;
    },
    scoreDelta(value: number): string {
      return isPersian ? `+${integer(value)} امتیاز` : `+${integer(value)} score`;
    },
    time(date: Date, includeSeconds = true): string {
      return includeSeconds ? clockFormatter.format(date) : shortTimeFormatter.format(date);
    },
    timeRange(range: MetricsTimeRange): string {
      if (!isPersian) return timeRanges.find((item) => item.value === range)?.label ?? range;

      const ranges: Record<MetricsTimeRange, string> = {
        '15m': `${integer(15)}د`,
        '1h': `${integer(1)}س`,
        '6h': `${integer(6)}س`,
        '24h': `${integer(24)}س`,
      };

      return ranges[range];
    },
    chartTime(value: string | number): string {
      const timestamp = typeof value === 'number' ? value : Date.parse(value);

      return Number.isFinite(timestamp) ? shortTimeFormatter.format(new Date(timestamp)) : String(value);
    },
  };
}

function dashboardLanguageLabel(language: DashboardLanguage): string {
  return language === 'fa' ? 'فارسی' : 'English';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function useWallClock(format: DashboardFormatters): string {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);

    return () => window.clearInterval(timer);
  }, []);

  return format.time(now);
}
