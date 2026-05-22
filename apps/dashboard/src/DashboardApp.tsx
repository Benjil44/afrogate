import { useEffect, useMemo, useState, type ComponentType, type CSSProperties, type ReactNode } from 'react';
import type { MetricsTimeRange, ServerMetricSnapshot, ServerMetricTimeseries } from '@afrogate/shared';
import { Activity, Bell, Gauge, Route, Server, ShieldCheck } from 'lucide-react';
import { fetchLatestMetrics, fetchMetricsTimeseries } from './api/metrics';
import { EChart, type AfroChartOption } from './components/EChart';

type Tone = 'good' | 'neutral' | 'warning' | 'critical';
type DataState = 'loading' | 'live' | 'stale' | 'fallback';

interface MetricCardData {
  label: string;
  value: string;
  tone: Tone;
}

interface ServerRowData {
  id: string;
  name: string;
  meta: string;
  cpu: number | null;
  ram: number | null;
  diskFree: number | null;
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

interface NavItemData {
  href: string;
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
  { id: 'iran-edge-01', name: 'Iran Edge 01', meta: 'IR', cpu: 38, ram: 51, diskFree: 64, score: 94 },
  { id: 'iran-edge-02', name: 'Iran Edge 02', meta: 'IR', cpu: 44, ram: 58, diskFree: 71, score: 91 },
  { id: 'germany-core-01', name: 'Germany Core 01', meta: 'DE', cpu: 29, ram: 47, diskFree: 82, score: 96 },
];

const tunnels: TunnelRowData[] = [
  { name: 'wg1', operator: 'Mobinnet', ping: 46, jitter: 8, loss: 0.1, score: 95 },
  { name: 'wireguard2', operator: 'Irancell', ping: 62, jitter: 14, loss: 0.3, score: 86 },
  { name: 'wireguard3', operator: 'Irancell', ping: 58, jitter: 11, loss: 0.2, score: 89 },
];

const navItems: NavItemData[] = [
  { href: '#dashboard', label: 'Dashboard', icon: Activity },
  { href: '#servers', label: 'Servers', icon: Server },
  { href: '#routes', label: 'Routes', icon: Route },
  { href: '#alerts', label: 'Alerts', icon: Bell },
];

const panelClass = 'min-w-0 rounded-lg border border-afro-line bg-afro-panel p-[18px]';
const mutedTextClass = 'text-[13px] text-afro-muted';

export function DashboardApp() {
  const [metrics, setMetrics] = useState<ServerMetricSnapshot[]>([]);
  const [timeseries, setTimeseries] = useState<ServerMetricTimeseries[]>([]);
  const [timeRange, setTimeRange] = useState<MetricsTimeRange>('1h');
  const [dataState, setDataState] = useState<DataState>('loading');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

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
  const summary = useMemo(() => createSummary(serverRows), [serverRows]);
  const chartSeries = useMemo(
    () => (timeseries.length > 0 ? timeseries : createFallbackTimeseries(serverRows, timeRange)),
    [serverRows, timeRange, timeseries],
  );
  const status = getDataStatus(dataState, lastUpdated);

  return (
    <main className="grid min-h-screen grid-cols-1 bg-afro-page text-afro-ink lg:grid-cols-[248px_minmax(0,1fr)]">
      <Sidebar />

      <section className="min-w-0 p-[18px] md:p-7">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-1.5 text-[13px] font-bold uppercase text-afro-teal">Operations</p>
            <h1 className="text-[28px] leading-tight font-bold">Network health dashboard</h1>
          </div>
          <div className={`inline-flex min-h-[34px] w-fit items-center gap-2 rounded-full border px-3 text-sm font-bold ${status.className}`}>
            <span className={`size-2 rounded-full ${status.dotClassName}`} />
            {status.label}
          </div>
        </header>

        <section className="mt-6 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4" aria-label="Summary">
          {summary.map((item) => (
            <MetricCard item={item} key={item.label} />
          ))}
        </section>

        <HealthChartPanel
          range={timeRange}
          series={chartSeries}
          onRangeChange={setTimeRange}
        />

        <section className="mt-[18px] grid gap-[18px] xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <ServerPanel servers={serverRows} />
          <TunnelPanel />
        </section>
      </section>
    </main>
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
        className="mt-4 h-[306px] w-full"
        option={option}
      />
    </section>
  );
}

function Sidebar() {
  return (
    <aside className="bg-afro-sidebar px-[18px] py-4 text-[#eef6f4] md:py-6">
      <div className="flex h-10 items-center gap-2.5 text-xl font-bold">
        <ShieldCheck size={22} />
        <span>AfroGate</span>
      </div>
      <nav className="mt-4 grid auto-cols-max grid-flow-col gap-1.5 overflow-x-auto lg:mt-8 lg:grid-flow-row">
        {navItems.map((item, index) => (
          <NavItem item={item} isActive={index === 0} key={item.href} />
        ))}
      </nav>
    </aside>
  );
}

function NavItem({ item, isActive }: { item: NavItemData; isActive: boolean }) {
  const Icon = item.icon;
  const activeClass = isActive ? 'bg-[#1f3138] text-white' : 'text-[#c8d7d5] hover:bg-[#1f3138] hover:text-white';

  return (
    <a className={`flex min-h-10 items-center gap-2.5 rounded-md px-3 ${activeClass}`} href={item.href}>
      <Icon size={18} />
      {item.label}
    </a>
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
    score: snapshot.healthScore,
    observedAt: snapshot.observedAt,
  };
}

function createSummary(servers: ServerRowData[]): MetricCardData[] {
  const storageValues = servers
    .map((server) => server.diskFree)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const lowestStorage = storageValues.length > 0 ? Math.min(...storageValues) : null;
  const criticalAlerts = servers.filter((server) => server.score < 50 || (server.diskFree !== null && server.diskFree < 10)).length;

  return [
    { label: 'Active users', value: '150', tone: 'neutral' },
    { label: 'Outbound', value: '20 MB/s', tone: 'good' },
    { label: 'Critical alerts', value: String(criticalAlerts), tone: criticalAlerts > 0 ? 'critical' : 'good' },
    {
      label: 'Lowest storage',
      value: lowestStorage === null ? '--' : `${Math.round(lowestStorage)}%`,
      tone: getStorageTone(lowestStorage),
    },
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

function getStorageTone(value: number | null): Tone {
  if (value === null) return 'neutral';
  if (value < 10) return 'critical';
  if (value < 20) return 'warning';
  return 'neutral';
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
