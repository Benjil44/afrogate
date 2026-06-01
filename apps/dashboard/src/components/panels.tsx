import { Cpu, Download, Gauge, HardDrive, MemoryStick, Route, Upload } from 'lucide-react';
import type { DataState, DataTableColumn, ServerRowData, TunnelRowData } from '../dashboard-types';
import type { DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { getScoreClass } from '../tone';
import { panelClass } from '../ui-classes';
import { DataStateEmpty, DataStateNotice, DataTable, MetricPill, PanelHeading, UsageBar } from './primitives';

export function tunnelRowKey(tunnel: TunnelRowData): string {
  return tunnel.id ?? tunnel.name;
}

export function ServerPanel({
  dataState,
  format,
  servers,
  t,
}: {
  dataState: DataState;
  format: DashboardFormatters;
  servers: ServerRowData[];
  t: DashboardStrings;
}) {
  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.servers} icon={Gauge} meta={t.panels.nodes(format.integer(servers.length))} />
      <div className="mt-2 grid gap-2">
        {servers.length > 0 && dataState !== 'live' ? <DataStateNotice state={dataState} t={t} /> : null}
        {servers.length === 0 ? <DataStateEmpty emptyMessage={t.operationalData.noServers} state={dataState} t={t} /> : null}
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
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-afro-muted md:min-w-[170px] md:flex-nowrap">
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



export function TunnelPanel({
  dataState,
  emptyMessage,
  format,
  onSelectTunnel,
  selectedTunnelKey,
  t,
  tunnels,
}: {
  dataState: DataState;
  emptyMessage?: string;
  format: DashboardFormatters;
  onSelectTunnel?: (key: string) => void;
  selectedTunnelKey?: string | null;
  t: DashboardStrings;
  tunnels: TunnelRowData[];
}) {
  const tunnelColumns: Array<DataTableColumn<TunnelRowData>> = [
    {
      key: 'tunnel',
      header: t.tables.tunnel,
      render: (tunnel) => {
        const key = tunnelRowKey(tunnel);
        const isSelected = key === selectedTunnelKey;

        return (
          <button
            aria-pressed={isSelected}
            className={`max-w-[180px] truncate text-left font-bold ${isSelected ? 'text-afro-blue' : 'text-afro-ink hover:text-afro-blue'}`}
            onClick={() => onSelectTunnel?.(key)}
            title={tunnel.name}
            type="button"
          >
            {tunnel.name}
          </button>
        );
      },
    },
    { key: 'operator', header: t.tables.operator, render: (tunnel) => format.label(tunnel.operator) },
    { key: 'ping', header: t.tables.ping, render: (tunnel) => format.latency(tunnel.ping) },
    { key: 'jitter', header: t.tables.jitter, render: (tunnel) => format.latency(tunnel.jitter) },
    { key: 'loss', header: t.tables.loss, render: (tunnel) => format.packetLoss(tunnel.loss) },
    {
      alignRight: true,
      key: 'score',
      header: t.tables.score,
      render: (tunnel) => <strong className={getScoreClass(tunnel.score)}>{format.integer(tunnel.score)}</strong>,
    },
  ];

  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.tunnels} icon={Route} meta={t.panels.links(format.integer(tunnels.length))} />
      <div className="mt-2 grid gap-2">
        {tunnels.length > 0 && dataState !== 'live' ? <DataStateNotice state={dataState} t={t} /> : null}
        {tunnels.length === 0 ? (
          <DataStateEmpty emptyMessage={emptyMessage ?? t.operationalData.noTunnels} state={dataState} t={t} />
        ) : null}
        {tunnels.length > 0 ? (
          <DataTable
            columns={tunnelColumns}
            minWidth="720px"
            rowClassName={(tunnel) => tunnelRowKey(tunnel) === selectedTunnelKey ? 'bg-[#edf4ff]' : undefined}
            rowKey={(tunnel) => tunnelRowKey(tunnel)}
            rows={tunnels}
          />
        ) : null}
      </div>
    </section>
  );
}
