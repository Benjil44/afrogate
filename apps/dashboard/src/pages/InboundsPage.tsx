import { useEffect, useState } from 'react';
import { LogIn } from 'lucide-react';
import type { AdminInboundSummary } from '@afrows/shared';
import { fetchAdminInbounds } from '../api/admin';
import { DataTable, EmptyState, PanelHeading } from '../components/primitives';
import type { DataTableColumn } from '../dashboard-types';
import type { DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';

const POLL_MS = 30000;

/** The entry "doors" users connect to (xray inbounds on the box): protocol,
 * transport, port, camouflage host/SNI, configured users, and total traffic. */
export function InboundsPage({
  format,
  sessionToken,
  t,
}: {
  format: DashboardFormatters;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const s = t.inboundsPage;
  const [inbounds, setInbounds] = useState<AdminInboundSummary[]>([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    const load = async () => {
      try {
        const res = await fetchAdminInbounds(sessionToken);
        if (active) {
          setInbounds(res.inbounds);
          setAvailable(res.available);
        }
      } catch {
        /* keep last data */
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

  const columns: Array<DataTableColumn<AdminInboundSummary>> = [
    {
      key: 'tag',
      header: s.colName,
      render: (i) => <strong className="text-afro-ink">{i.tag}</strong>,
    },
    {
      key: 'proto',
      header: s.colProto,
      render: (i) => (
        <span className="uppercase text-afro-muted">
          {i.protocol}/{i.network}
          {i.security && i.security !== 'none' ? ` · ${i.security}` : ''}
        </span>
      ),
    },
    { key: 'entry', header: s.colEntry, render: (i) => `${i.listen}:${i.port}` },
    {
      key: 'camouflage',
      header: s.colCamouflage,
      render: (i) => i.host || i.sni || '—',
    },
    { key: 'users', header: s.colUsers, render: (i) => format.integer(i.clientCount) },
    { key: 'down', header: s.colDown, render: (i) => gb(i.downlinkBytes) },
    { key: 'up', header: s.colUp, render: (i) => gb(i.uplinkBytes) },
  ];

  return (
    <section className="grid gap-4">
      <p className="text-[13px] text-afro-muted">{s.intro}</p>
      <div className="rounded-md border border-afro-line bg-afro-panel p-4">
        <PanelHeading
          title={s.title}
          icon={LogIn}
          meta={loading ? t.dataStatus.loading : s.total.replace('{n}', format.integer(inbounds.length))}
        />
        {inbounds.length === 0 ? (
          <div className="mt-2">
            <EmptyState message={loading ? t.dataStatus.loading : !available ? s.unavailable : s.empty} />
          </div>
        ) : (
          <div className="mt-2">
            <DataTable rows={inbounds} columns={columns} rowKey={(i) => i.tag} minWidth="820px" />
          </div>
        )}
      </div>
    </section>
  );
}
