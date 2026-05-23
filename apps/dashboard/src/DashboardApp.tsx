import { useEffect, useMemo, useState, type ComponentType, type CSSProperties, type ReactNode } from 'react';
import type {
  MetricsTimeRange,
  NetworkInterfaceMetric,
  ServerMetricSnapshot,
  ServerMetricTimeseries,
  StorageVolumeMetric,
} from '@afrogate/shared';
import { Activity, AlertTriangle, ArrowDownUp, Bell, Clock, Cpu, Download, Gauge, HardDrive, MemoryStick, Network, Route, Server, ShieldCheck, Upload } from 'lucide-react';
import rootPackage from '../../../package.json';
import { fetchLatestMetrics, fetchMetricsTimeseries } from './api/metrics';
import { EChart, type AfroChartOption } from './components/EChart';

type Tone = 'good' | 'neutral' | 'warning' | 'critical';
type DataState = 'loading' | 'live' | 'stale' | 'fallback';
type ActiveView = 'dashboard' | 'servers' | 'routes' | 'alerts';

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
  label: string;
  icon: ComponentType<{ size?: number }>;
}

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
  { id: 'dashboard', label: 'Dashboard', icon: Activity },
  { id: 'servers', label: 'Servers', icon: Server },
  { id: 'routes', label: 'Routes', icon: Route },
  { id: 'alerts', label: 'Alerts', icon: Bell },
];

const panelClass = 'min-w-0 rounded-lg border border-afro-line bg-afro-panel p-[18px]';
const mutedTextClass = 'text-[13px] text-afro-muted';
const appVersion = rootPackage.version;

export function DashboardApp() {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [metrics, setMetrics] = useState<ServerMetricSnapshot[]>([]);
  const [timeseries, setTimeseries] = useState<ServerMetricTimeseries[]>([]);
  const [timeRange, setTimeRange] = useState<MetricsTimeRange>('1h');
  const [dataState, setDataState] = useState<DataState>('loading');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const wallClock = useWallClock();

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

  const serverRows = useMemo(
    () => (metrics.length > 0 ? metrics.map(mapSnapshotToServerRow) : fallbackServers),
    [metrics],
  );
  const trafficTotals = useMemo(() => createTrafficTotals(serverRows), [serverRows]);
  const summary = useMemo(() => createSummary(serverRows, trafficTotals), [serverRows, trafficTotals]);
  const chartSeries = useMemo(
    () => (timeseries.length > 0 ? timeseries : createFallbackTimeseries(serverRows, timeRange)),
    [serverRows, timeRange, timeseries],
  );
  const alerts = useMemo(() => createAlertRows(serverRows), [serverRows]);
  const status = getDataStatus(dataState, lastUpdated);
  const header = getPageHeader(activeView);

  return (
    <main className="grid min-h-screen grid-cols-1 bg-afro-page text-afro-ink lg:grid-cols-[248px_minmax(0,1fr)]">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />

      <section className="min-w-0 p-[18px] md:p-7">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-1.5 text-[13px] font-bold uppercase text-afro-teal">{header.eyebrow}</p>
            <h1 className="text-[28px] leading-tight font-bold">{header.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex min-h-[34px] w-fit items-center gap-2 rounded-full border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink">
              <Clock size={15} />
              {wallClock}
            </div>
            <div className={`inline-flex min-h-[34px] w-fit items-center gap-2 rounded-full border px-3 text-sm font-bold ${status.className}`}>
              <span className={`size-2 rounded-full ${status.dotClassName}`} />
              {status.label}
            </div>
          </div>
        </header>

        <SystemResourceHeader servers={serverRows} trafficTotals={trafficTotals} />

        <div className="mt-5 border-t border-afro-line" />

        <ActivePage
          activeView={activeView}
          alerts={alerts}
          chartSeries={chartSeries}
          onRangeChange={setTimeRange}
          servers={serverRows}
          summary={summary}
          timeRange={timeRange}
          trafficTotals={trafficTotals}
        />
      </section>
    </main>
  );
}

function SystemResourceHeader({
  servers,
  trafficTotals,
}: {
  servers: ServerRowData[];
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
    <section className="mt-5" aria-label="System resources">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <ResourceStat icon={Cpu} label="CPU average" tone={getUsageTone(cpuAverage)} value={formatPercent(cpuAverage)} />
        <ResourceStat icon={MemoryStick} label="RAM average" tone={getUsageTone(ramAverage)} value={formatPercent(ramAverage)} />
        <ResourceStat icon={HardDrive} label="Lowest storage" tone={getStorageTone(lowestStorage)} value={formatPercent(lowestStorage)} />
        <ResourceStat icon={Download} label="Download" tone="neutral" value={formatBytesPerSecond(trafficTotals.downloadBps)} />
        <ResourceStat icon={Upload} label="Upload" tone="neutral" value={formatBytesPerSecond(trafficTotals.uploadBps)} />
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-afro-line bg-afro-panel">
        <div className="flex min-w-max gap-2 p-3">
          {storages.map((storage) => (
            <div className="min-w-[190px] rounded-md border border-afro-line px-3 py-2" key={`${storage.serverName}-${storage.path}`}>
              <div className="flex items-center justify-between gap-3">
                <strong className="max-w-[118px] truncate text-sm">{storage.serverName}</strong>
                <StatusBadge tone={getStorageTone(storage.freePercent ?? null)}>
                  {formatPercent(storage.freePercent ?? null)}
                </StatusBadge>
              </div>
              <div className={mutedTextClass}>{storage.path}</div>
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
  icon: ComponentType<{ size?: number }>;
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
    <div className={`grid min-h-[92px] gap-2 rounded-lg border border-t-4 border-afro-line bg-afro-panel p-4 ${borderClass}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-afro-muted">{label}</span>
        <Icon size={18} />
      </div>
      <strong className="text-[24px] leading-tight">{value}</strong>
    </div>
  );
}

function ActivePage({
  activeView,
  alerts,
  chartSeries,
  onRangeChange,
  servers,
  summary,
  timeRange,
  trafficTotals,
}: {
  activeView: ActiveView;
  alerts: AlertRowData[];
  chartSeries: ServerMetricTimeseries[];
  onRangeChange: (range: MetricsTimeRange) => void;
  servers: ServerRowData[];
  summary: MetricCardData[];
  timeRange: MetricsTimeRange;
  trafficTotals: TrafficTotals;
}) {
  switch (activeView) {
    case 'servers':
      return <ServersPage servers={servers} />;
    case 'routes':
      return <RoutesPage />;
    case 'alerts':
      return <AlertsPage alerts={alerts} />;
    default:
      return (
        <DashboardPage
          alerts={alerts}
          chartSeries={chartSeries}
          onRangeChange={onRangeChange}
          servers={servers}
          summary={summary}
          timeRange={timeRange}
          trafficTotals={trafficTotals}
        />
      );
  }
}

function DashboardPage({
  alerts,
  chartSeries,
  onRangeChange,
  servers,
  summary,
  timeRange,
  trafficTotals,
}: {
  alerts: AlertRowData[];
  chartSeries: ServerMetricTimeseries[];
  onRangeChange: (range: MetricsTimeRange) => void;
  servers: ServerRowData[];
  summary: MetricCardData[];
  timeRange: MetricsTimeRange;
  trafficTotals: TrafficTotals;
}) {
  return (
    <>
      <section className="mt-6 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4" aria-label="Summary">
        {summary.map((item) => (
          <MetricCard item={item} key={item.label} />
        ))}
      </section>

      <HealthChartPanel
        range={timeRange}
        series={chartSeries}
        onRangeChange={onRangeChange}
      />

      <section className="mt-[18px] grid gap-[18px] 2xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_minmax(0,0.85fr)]">
        <ServerPanel servers={servers} />
        <TunnelPanel />
        <AlertsPanel alerts={alerts} />
      </section>

      <section className="mt-[18px] grid gap-[18px] xl:grid-cols-3">
        <OutboundsPanel />
        <CapacityPanel trafficTotals={trafficTotals} />
        <ControlPlanePanel />
      </section>
    </>
  );
}

function HealthChartPanel({
  range,
  series,
  onRangeChange,
}: {
  range: MetricsTimeRange;
  series: ServerMetricTimeseries[];
  onRangeChange: (range: MetricsTimeRange) => void;
}) {
  const option = useMemo(() => createHealthChartOption(series), [series]);

  return (
    <section className={`${panelClass} mt-[18px]`}>
      <div className="flex flex-col gap-3 border-b border-afro-line pb-3.5 sm:flex-row sm:items-center sm:justify-between">
        <PanelHeadingContent title="Health timeline" meta={`${series.length} monitored nodes`} />
        <div className="inline-grid w-fit grid-flow-col rounded-md border border-afro-line bg-[#eef3f5] p-1">
          {timeRanges.map((item) => {
            const isActive = item.value === range;
            const activeClass = isActive ? 'bg-white text-afro-ink shadow-sm' : 'text-afro-muted hover:text-afro-ink';

            return (
              <button
                className={`min-h-8 min-w-12 rounded px-2.5 text-sm font-bold ${activeClass}`}
                key={item.value}
                onClick={() => onRangeChange(item.value)}
                type="button"
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      <EChart
        ariaLabel="Server health score timeline"
        className="mt-4 h-[270px] w-full"
        option={option}
      />
    </section>
  );
}

function OutboundsPanel() {
  return (
    <section className={panelClass}>
      <PanelHeading title="Outbounds" icon={ArrowDownUp} meta="priority failover" />
      <div className="mt-3 grid gap-2.5">
        {outbounds.map((outbound) => (
          <div className="grid min-h-[66px] grid-cols-[32px_1fr_auto] items-center gap-3 rounded-md border border-afro-line p-3" key={outbound.name}>
            <span className="grid size-8 place-items-center rounded bg-[#eef3f5] text-sm font-bold text-afro-ink">{outbound.priority}</span>
            <div className="min-w-0">
              <strong className="block truncate">{outbound.name}</strong>
              <span className={mutedTextClass}>{outbound.type} / {outbound.mode}</span>
            </div>
            <div className="text-right">
              <StatusBadge tone={outbound.status === 'healthy' ? 'good' : outbound.status === 'standby' ? 'neutral' : 'warning'}>
                {outbound.status}
              </StatusBadge>
              <div className={mutedTextClass}>{outbound.latencyMs === null ? '--' : `${outbound.latencyMs} ms`}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AlertsPanel({ alerts }: { alerts: AlertRowData[] }) {
  return (
    <section className={panelClass}>
      <PanelHeading title="Alerts" icon={AlertTriangle} meta={`${alerts.length} visible`} />
      <div className="mt-3 grid gap-2.5">
        {alerts.map((alert) => (
          <div className="grid min-h-[58px] grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-afro-line p-3" key={`${alert.source}-${alert.title}`}>
            <div className="min-w-0">
              <strong className="block truncate">{alert.title}</strong>
              <span className={mutedTextClass}>{alert.source}</span>
            </div>
            <StatusBadge tone={alert.severity}>{alert.severity}</StatusBadge>
          </div>
        ))}
      </div>
    </section>
  );
}

function CapacityPanel({ trafficTotals }: { trafficTotals: TrafficTotals }) {
  const items = [
    { label: 'Users online', value: '150' },
    { label: 'Download now', value: formatBytesPerSecond(trafficTotals.downloadBps) },
    { label: 'Upload now', value: formatBytesPerSecond(trafficTotals.uploadBps) },
    { label: 'Min target/user', value: '1 MB/s' },
    { label: 'Route mode', value: 'Auto + lock' },
  ];

  return (
    <section className={panelClass}>
      <PanelHeading title="Capacity" icon={Network} meta="manager view" />
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {items.map((item) => (
          <div className="min-h-[70px] rounded-md border border-afro-line p-3" key={item.label}>
            <span className={mutedTextClass}>{item.label}</span>
            <strong className="mt-1 block text-[22px] leading-tight">{item.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function ControlPlanePanel() {
  const rows = [
    { label: 'Metrics ingest', value: '10s', tone: 'good' as Tone },
    { label: 'Telegram/API egress', value: 'Proxy ready', tone: 'neutral' as Tone },
    { label: 'Storage alert', value: '< 10%', tone: 'warning' as Tone },
    { label: 'Backups', value: 'Pending', tone: 'warning' as Tone },
  ];

  return (
    <section className={panelClass}>
      <PanelHeading title="Control Plane" icon={ShieldCheck} meta="operations" />
      <div className="mt-3 grid gap-2.5">
        {rows.map((row) => (
          <div className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-afro-line px-3" key={row.label}>
            <span className={mutedTextClass}>{row.label}</span>
            <StatusBadge tone={row.tone}>{row.value}</StatusBadge>
          </div>
        ))}
      </div>
    </section>
  );
}

function ServersPage({ servers }: { servers: ServerRowData[] }) {
  return (
    <section className="mt-6 grid gap-[18px] xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
      <section className={panelClass}>
        <PanelHeading title="Server Inventory" icon={Server} meta={`${servers.length} managed nodes`} />
        <div className="mt-3 grid gap-3">
          {servers.map((server, index) => (
            <ServerManagementCard index={index} server={server} key={server.id} />
          ))}
        </div>
      </section>

      <section className={panelClass}>
        <PanelHeading title="Access & Bootstrap" icon={ShieldCheck} meta="safe operations" />
        <div className="mt-3 grid gap-2.5">
          {[
            ['Default user', 'afrogate'],
            ['Access method', 'SSH key'],
            ['Root password', 'bootstrap only'],
            ['Credential view', 'hidden'],
            ['Audit mode', 'required'],
          ].map(([label, value]) => (
            <div className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-afro-line px-3" key={label}>
              <span className={mutedTextClass}>{label}</span>
              <strong className="text-sm">{value}</strong>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function ServerManagementCard({ index, server }: { index: number; server: ServerRowData }) {
  const interfaces = index === 0
    ? ['ether1 / Mobinnet / wg1', 'ether2 / Irancell / wireguard2']
    : index === 1
      ? ['ether5 / Irancell / wireguard3']
      : ['core uplink / Germany / gateway'];

  return (
    <article className="rounded-md border border-afro-line p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <strong className="block truncate text-lg">{server.name}</strong>
          <span className={mutedTextClass}>{server.meta}</span>
        </div>
        <button
          className="min-h-9 rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink hover:border-afro-blue hover:text-afro-blue"
          type="button"
        >
          Edit
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <UsageBar label="CPU" value={server.cpu} />
        <UsageBar label="RAM" value={server.ram} />
        <UsageBar label="Disk free" value={server.diskFree} invert />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="grid gap-1.5">
          {interfaces.map((item) => (
            <span className="rounded-md bg-[#eef3f5] px-2.5 py-1.5 text-[13px] text-afro-muted" key={item}>
              {item}
            </span>
          ))}
        </div>
        <div className="text-left sm:text-right">
          <span className={mutedTextClass}>Health</span>
          <b className={`block text-[24px] ${getScoreClass(server.score)}`}>{server.score}</b>
        </div>
      </div>
    </article>
  );
}

function RoutesPage() {
  return (
    <section className="mt-6 grid gap-[18px] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <TunnelPanel />
      <OutboundsPanel />
      <RoutePolicyPanel />
      <FailoverPanel />
    </section>
  );
}

function RoutePolicyPanel() {
  const policies: Array<[string, string, Tone]> = [
    ['Auto route', 'enabled', 'good'],
    ['Route lock', 'available', 'neutral'],
    ['Cooldown', '120s', 'neutral'],
    ['Hysteresis', '+15 score', 'neutral'],
  ];

  return (
    <section className={panelClass}>
      <PanelHeading title="Route Policy" icon={Route} meta="stability rules" />
      <div className="mt-3 grid gap-2.5">
        {policies.map(([label, value, tone]) => (
          <div className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-afro-line px-3" key={label}>
            <span className={mutedTextClass}>{label}</span>
            <StatusBadge tone={tone}>{value}</StatusBadge>
          </div>
        ))}
      </div>
    </section>
  );
}

function FailoverPanel() {
  const events: Array<[string, string, Tone]> = [
    ['Germany gateway', 'primary route healthy', 'good'],
    ['Control egress', 'standby for Telegram/API', 'neutral'],
    ['Iran direct', 'restricted internet path', 'warning'],
  ];

  return (
    <section className={panelClass}>
      <PanelHeading title="Failover" icon={ArrowDownUp} meta="latest decisions" />
      <div className="mt-3 grid gap-2.5">
        {events.map(([title, detail, tone]) => (
          <div className="grid min-h-[58px] grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-afro-line p-3" key={title}>
            <div className="min-w-0">
              <strong className="block truncate">{title}</strong>
              <span className={mutedTextClass}>{detail}</span>
            </div>
            <StatusBadge tone={tone}>{tone}</StatusBadge>
          </div>
        ))}
      </div>
    </section>
  );
}

function AlertsPage({ alerts }: { alerts: AlertRowData[] }) {
  return (
    <section className="mt-6 grid gap-[18px] xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <section className={panelClass}>
        <PanelHeading title="Open Alerts" icon={AlertTriangle} meta={`${alerts.length} active rows`} />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Severity', 'Source', 'Alert', 'Channel'].map((heading) => (
                  <th className="border-b border-afro-line px-2 py-[13px] text-left text-[13px] font-bold text-afro-muted first:pl-0 last:pr-0" key={heading}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={`${alert.source}-${alert.title}`}>
                  <TableCell>
                    <StatusBadge tone={alert.severity}>{alert.severity}</StatusBadge>
                  </TableCell>
                  <TableCell>{alert.source}</TableCell>
                  <TableCell>{alert.title}</TableCell>
                  <TableCell>Dashboard</TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={panelClass}>
        <PanelHeading title="Alert Rules" icon={Bell} meta="MVP thresholds" />
        <div className="mt-3 grid gap-2.5">
          {([
            ['Storage', '< 10%', 'critical'],
            ['Health score', '< 60', 'warning'],
            ['Ping', '> 150 ms', 'warning'],
            ['Packet loss', '> 1%', 'critical'],
          ] as Array<[string, string, Tone]>).map(([label, value, tone]) => (
            <div className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-afro-line px-3" key={label}>
              <span className={mutedTextClass}>{label}</span>
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
  onViewChange,
}: {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
}) {
  return (
    <aside className="flex flex-col bg-afro-sidebar px-[18px] py-4 text-[#eef6f4] md:py-6 lg:min-h-screen">
      <div className="flex h-10 items-center gap-2.5 text-xl font-bold">
        <ShieldCheck size={22} />
        <span>AfroGate</span>
      </div>
      <nav className="mt-4 grid auto-cols-max grid-flow-col gap-1.5 overflow-x-auto lg:mt-8 lg:flex-1 lg:grid-flow-row lg:content-start">
        {navItems.map((item) => (
          <NavItem
            item={item}
            isActive={activeView === item.id}
            key={item.id}
            onClick={() => onViewChange(item.id)}
          />
        ))}
      </nav>
      <div className="hidden text-xs text-[#91a5a2] lg:mt-6 lg:block lg:border-t lg:border-[#334852] lg:pt-3">
        <div className="font-bold text-[#c8d7d5]">AfroGate</div>
        <div>v{appVersion}</div>
      </div>
    </aside>
  );
}

function NavItem({ item, isActive, onClick }: { item: NavItemData; isActive: boolean; onClick: () => void }) {
  const Icon = item.icon;
  const activeClass = isActive ? 'bg-[#1f3138] text-white' : 'text-[#c8d7d5] hover:bg-[#1f3138] hover:text-white';

  return (
    <button
      aria-current={isActive ? 'page' : undefined}
      className={`flex min-h-10 items-center gap-2.5 rounded-md px-3 text-left ${activeClass}`}
      onClick={onClick}
      type="button"
    >
      <Icon size={18} />
      {item.label}
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
    <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-bold ${toneClass}`}>
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
    <div className={`grid min-h-24 gap-2 rounded-lg border border-t-4 border-afro-line bg-afro-panel p-[18px] ${toneClass}`}>
      <span className="text-sm text-afro-muted">{item.label}</span>
      <strong className="text-[26px] leading-tight">{item.value}</strong>
    </div>
  );
}

function ServerPanel({ servers }: { servers: ServerRowData[] }) {
  return (
    <section className={panelClass}>
      <PanelHeading title="Servers" icon={Gauge} meta={`${servers.length} nodes`} />
      <div className="mt-3.5 grid gap-3">
        {servers.map((server) => (
          <ServerRow server={server} key={server.id} />
        ))}
      </div>
    </section>
  );
}

function ServerRow({ server }: { server: ServerRowData }) {
  return (
    <div className="grid min-h-[86px] items-center gap-3.5 rounded-md border border-afro-line p-3 sm:grid-cols-[150px_1fr_48px]">
      <div className="grid gap-1">
        <strong className="break-words">{server.name}</strong>
        <span className={mutedTextClass}>{server.meta}</span>
      </div>
      <div className="grid gap-[7px]">
        <UsageBar label="CPU" value={server.cpu} />
        <UsageBar label="RAM" value={server.ram} />
        <UsageBar label="Disk free" value={server.diskFree} invert />
        <div className="grid grid-cols-2 gap-2 text-[12px] text-afro-muted">
          <span className="truncate">Down <strong className="text-afro-ink">{formatBytesPerSecond(server.inboundBps)}</strong></span>
          <span className="truncate">Up <strong className="text-afro-ink">{formatBytesPerSecond(server.outboundBps)}</strong></span>
        </div>
      </div>
      <b className={`text-left text-[22px] sm:text-right ${getScoreClass(server.score)}`}>{server.score}</b>
    </div>
  );
}

function UsageBar({ label, value, invert = false }: { label: string; value: number | null; invert?: boolean }) {
  const hasValue = typeof value === 'number' && Number.isFinite(value);
  const boundedValue = hasValue ? clamp(value, 0, 100) : 0;
  const fillValue = invert ? 100 - boundedValue : boundedValue;
  const displayValue = hasValue ? `${Math.round(value)}%` : '--';

  return (
    <span
      className="min-h-[22px] rounded-full px-2.5 py-1 text-[13px] text-[#243238]"
      style={{
        background: `linear-gradient(90deg, #a9d8d1 ${fillValue}%, #edf2f4 0)`,
      } as CSSProperties}
    >
      {label} {displayValue}
    </span>
  );
}

function TunnelPanel() {
  return (
    <section className={panelClass}>
      <PanelHeading title="Tunnels" icon={Route} meta="3 links" />
      <div className="mt-3.5 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Tunnel', 'Operator', 'Ping', 'Jitter', 'Loss', 'Score'].map((heading) => (
                <th className="border-b border-afro-line px-2 py-[13px] text-left text-[13px] font-bold text-afro-muted last:pr-0 last:text-right first:pl-0" key={heading}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tunnels.map((tunnel) => (
              <tr key={tunnel.name}>
                <TableCell>{tunnel.name}</TableCell>
                <TableCell>{tunnel.operator}</TableCell>
                <TableCell>{tunnel.ping} ms</TableCell>
                <TableCell>{tunnel.jitter} ms</TableCell>
                <TableCell>{tunnel.loss}%</TableCell>
                <TableCell alignRight>
                  <strong className={getScoreClass(tunnel.score)}>{tunnel.score}</strong>
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
  icon: ComponentType<{ size?: number }>;
  meta?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-afro-line pb-3.5">
      <PanelHeadingContent title={title} meta={meta} />
      <Icon size={18} />
    </div>
  );
}

function PanelHeadingContent({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="min-w-0">
      <h2 className="text-[17px] font-bold">{title}</h2>
      {meta ? <span className={mutedTextClass}>{meta}</span> : null}
    </div>
  );
}

function TableCell({ children, alignRight = false }: { children: ReactNode; alignRight?: boolean }) {
  const alignmentClass = alignRight ? 'text-right' : 'text-left';

  return (
    <td className={`border-b border-afro-line px-2 py-[13px] text-[13px] text-afro-muted first:pl-0 last:pr-0 ${alignmentClass}`}>
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

function createSummary(servers: ServerRowData[], trafficTotals: TrafficTotals): MetricCardData[] {
  const criticalAlerts = servers.filter((server) => server.score < 50 || (server.diskFree !== null && server.diskFree < 10)).length;

  return [
    { label: 'Active users', value: '150', tone: 'neutral' },
    { label: 'Download now', value: formatBytesPerSecond(trafficTotals.downloadBps), tone: 'good' },
    { label: 'Upload now', value: formatBytesPerSecond(trafficTotals.uploadBps), tone: 'neutral' },
    { label: 'Critical alerts', value: String(criticalAlerts), tone: criticalAlerts > 0 ? 'critical' : 'good' },
  ];
}

function createTrafficTotals(servers: ServerRowData[]): TrafficTotals {
  return {
    downloadBps: sumNullable(servers.map((server) => server.inboundBps)),
    uploadBps: sumNullable(servers.map((server) => server.outboundBps)),
  };
}

function createAlertRows(servers: ServerRowData[]): AlertRowData[] {
  const rows: AlertRowData[] = [];

  for (const server of servers) {
    if (server.diskFree !== null && server.diskFree < 10) {
      rows.push({
        title: 'Storage below 10%',
        source: server.name,
        severity: 'critical',
      });
    }

    if (server.score < 60) {
      rows.push({
        title: 'Health score degraded',
        source: server.name,
        severity: server.score < 40 ? 'critical' : 'warning',
      });
    }
  }

  if (rows.length > 0) return rows.slice(0, 4);

  return [
    { title: 'No critical server alerts', source: 'Monitoring', severity: 'good' },
    { title: 'Outbound failover ready', source: 'Routes', severity: 'neutral' },
    { title: 'Backup monitor pending', source: 'Control plane', severity: 'warning' },
  ];
}

function createHealthChartOption(series: ServerMetricTimeseries[]): AfroChartOption {
  const chartSeries = series.map((item, index) => ({
    name: item.hostname || item.serverId,
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
            formatter: 'watch',
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
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value) => `${Math.round(Number(value))}`,
    },
    legend: {
      top: 0,
      type: 'scroll',
      icon: 'roundRect',
      itemHeight: 8,
      itemWidth: 18,
      textStyle: {
        color: '#60717a',
      },
    },
    grid: {
      bottom: 48,
      containLabel: true,
      left: 6,
      right: 8,
      top: 42,
    },
    xAxis: {
      type: 'time',
      axisLine: {
        lineStyle: { color: '#dce4e8' },
      },
      axisLabel: {
        color: '#60717a',
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: {
        color: '#60717a',
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
      {
        type: 'slider',
        bottom: 8,
        height: 18,
        borderColor: '#dce4e8',
        fillerColor: 'rgba(39, 100, 168, 0.14)',
        handleSize: 12,
        showDetail: false,
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

function getDataStatus(dataState: DataState, lastUpdated: string | null) {
  const updatedAt = lastUpdated ? ` ${new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '';

  switch (dataState) {
    case 'live':
      return {
        label: `Live${updatedAt}`,
        className: 'border-[#b8e1cf] bg-[#e7f6ef] text-afro-green',
        dotClassName: 'bg-afro-green',
      };
    case 'stale':
      return {
        label: `Stale${updatedAt}`,
        className: 'border-[#e6cf9c] bg-[#fff7e6] text-[#9a5b00]',
        dotClassName: 'bg-[#c27a1a]',
      };
    case 'loading':
      return {
        label: 'Connecting',
        className: 'border-[#bfd1ea] bg-[#edf4ff] text-afro-blue',
        dotClassName: 'bg-afro-blue',
      };
    default:
      return {
        label: 'Local sample',
        className: 'border-afro-line bg-white text-afro-muted',
        dotClassName: 'bg-afro-muted',
      };
  }
}

function getPageHeader(activeView: ActiveView) {
  switch (activeView) {
    case 'servers':
      return {
        eyebrow: 'Infrastructure',
        title: 'Server management',
      };
    case 'routes':
      return {
        eyebrow: 'Routing',
        title: 'Routes and failover',
      };
    case 'alerts':
      return {
        eyebrow: 'Incidents',
        title: 'Alerts and delivery',
      };
    default:
      return {
        eyebrow: 'Operations',
        title: 'Network operations display',
      };
  }
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

function formatPercent(value: number | null): string {
  return value === null ? '--' : `${Math.round(value)}%`;
}

function formatBytesPerSecond(value: number | null): string {
  if (value === null) return '--';

  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  let currentValue = value;
  let unitIndex = 0;

  while (currentValue >= 1024 && unitIndex < units.length - 1) {
    currentValue /= 1024;
    unitIndex += 1;
  }

  return `${currentValue >= 10 ? currentValue.toFixed(0) : currentValue.toFixed(1)} ${units[unitIndex]}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function useWallClock(): string {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);

    return () => window.clearInterval(timer);
  }, []);

  return now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
