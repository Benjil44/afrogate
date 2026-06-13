import { useEffect, useMemo, useState } from 'react';
import { Network, Search } from 'lucide-react';
import type { AdminConnectionSummary } from '@afrows/shared';
import { fetchAdminConnections } from '../api/admin';
import { DataTable, EmptyState, PanelHeading } from '../components/primitives';
import type { DataTableColumn } from '../dashboard-types';
import type { DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';

const POLL_MS = 15000;

/** Every live client connecting through the server (VLESS customer devices +
 * WireGuard peers), tagged with protocol, owner, online status and usage. */
export function ConnectionsPage({
  format,
  sessionToken,
  t,
}: {
  format: DashboardFormatters;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const s = t.connectionsPage;
  const [connections, setConnections] = useState<AdminConnectionSummary[]>([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    const load = async () => {
      try {
        const res = await fetchAdminConnections(sessionToken);
        if (active) {
          setConnections(res.connections);
          setAvailable(res.available);
        }
      } catch {
        /* keep last */
      } finally {
        if (active) setLoading(false);
        if (active) timer = window.setTimeout(() => void load(), POLL_MS);
      }
    };
    void load();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [sessionToken]);

  const gb = (n: number) => (n <= 0 ? '—' : `${(n / 1e9).toFixed(2)} GB`);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return connections;
    return connections.filter((c) =>
      [c.label, c.protocol, c.inboundTag, c.customerName].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [connections, query]);

  const protoColor = (p: string) => (p === 'wireguard' ? '#7c3aed' : '#2764a8');

  const columns: Array<DataTableColumn<AdminConnectionSummary>> = [
    {
      key: 'name',
      header: s.colName,
      render: (c) => <strong className="text-afro-ink">{c.label}</strong>,
    },
    {
      key: 'protocol',
      header: s.colProtocol,
      render: (c) => (
        <span
          className="inline-flex items-center rounded-md px-2 py-0.5 text-[12px] font-bold text-white"
          style={{ background: protoColor(c.protocol) }}
        >
          {c.protocol}
          {c.transport && c.transport !== 'wireguard' ? `/${c.transport}` : ''}
        </span>
      ),
    },
    { key: 'inbound', header: s.colInbound, render: (c) => <span className="text-afro-muted">{c.inboundTag}</span> },
    { key: 'customer', header: s.colCustomer, render: (c) => c.customerName || s.infra },
    {
      key: 'online',
      header: s.colOnline,
      render: (c) => (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.online ? '#1f9d57' : '#c2cdd2' }} />
          {c.online ? s.online : s.offline}
        </span>
      ),
    },
    { key: 'used', header: s.colUsed, render: (c) => gb(c.usedBytes) },
  ];

  return (
    <section className="grid gap-4">
      <p className="text-[13px] text-afro-muted">{s.intro}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex min-h-9 items-center gap-2 rounded-md border border-afro-line bg-white px-3">
          <Search size={15} className="text-afro-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={s.searchPlaceholder}
            className="min-w-[180px] bg-transparent text-sm outline-none"
          />
        </label>
        <span className="text-[13px] font-bold text-afro-muted">{s.total.replace('{n}', format.integer(filtered.length))}</span>
      </div>

      <div className="rounded-md border border-afro-line bg-afro-panel p-4">
        <PanelHeading
          title={s.title}
          icon={Network}
          meta={loading ? t.dataStatus.loading : undefined}
        />
        {filtered.length === 0 ? (
          <div className="mt-2">
            <EmptyState message={loading ? t.dataStatus.loading : !available ? s.unavailable : s.empty} />
          </div>
        ) : (
          <div className="mt-2">
            <DataTable rows={filtered} columns={columns} rowKey={(c) => `${c.inboundTag}:${c.id}`} minWidth="860px" />
          </div>
        )}
      </div>
    </section>
  );
}
