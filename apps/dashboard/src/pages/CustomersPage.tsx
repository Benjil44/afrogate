import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import type { AdminCustomerAccountSummary } from '@afrows/shared';
import { fetchAdminCustomerAccounts } from '../api/admin';
import { DataTable, EmptyState, PanelHeading } from '../components/primitives';
import type { DataTableColumn } from '../dashboard-types';
import type { DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';

const POLL_MS = 30000;

/** Subscribers you sell to. The full management form still lives in Billing; this
 * is the prominent top-level list (search + usage + client counts). */
export function CustomersPage({
  format,
  sessionToken,
  t,
}: {
  format: DashboardFormatters;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const s = t.customersPage;
  const [accounts, setAccounts] = useState<AdminCustomerAccountSummary[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    const load = async () => {
      try {
        const res = await fetchAdminCustomerAccounts(sessionToken);
        if (active) setAccounts(res.accounts);
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

  const gb = (n?: number | null) => (n == null ? '—' : `${(n / 1e9).toFixed(1)} GB`);
  const nameOf = (a: AdminCustomerAccountSummary) =>
    a.displayName || a.telegramUsername || a.loginEmail || a.telegramId || a.id.slice(0, 8);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) =>
      [a.displayName, a.telegramUsername, a.loginEmail, a.telegramId, a.resellerDisplayName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [accounts, query]);

  const statusTone = (st: string) =>
    st === 'active' ? '#1f9d57' : st === 'limited' || st === 'suspended' ? '#d23f3f' : '#9aa7ad';

  const columns: Array<DataTableColumn<AdminCustomerAccountSummary>> = [
    {
      key: 'customer',
      header: s.colCustomer,
      render: (a) => (
        <>
          <strong className="block text-afro-ink">{nameOf(a)}</strong>
          <span className="text-[12px] text-afro-muted">{format.time(new Date(a.updatedAt), false)}</span>
        </>
      ),
    },
    {
      key: 'status',
      header: s.colStatus,
      render: (a) => (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: statusTone(String(a.status)) }} />
          {String(a.status)}
        </span>
      ),
    },
    { key: 'used', header: s.colUsed, render: (a) => gb(a.usedBytes) },
    { key: 'quota', header: s.colQuota, render: (a) => gb(a.quotaLimitBytes) },
    { key: 'remaining', header: s.colRemaining, render: (a) => gb(a.remainingBytes) },
    {
      key: 'clients',
      header: s.colClients,
      render: (a) => `${format.integer(a.activeClientCount)} / ${format.integer(a.clientCount)}`,
    },
    { key: 'seller', header: s.colSeller, render: (a) => a.resellerDisplayName || s.direct },
  ];

  return (
    <section className="grid gap-4">
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
        <span className="text-[13px] font-bold text-afro-muted">
          {s.total.replace('{n}', format.integer(filtered.length))}
        </span>
      </div>

      <div className="rounded-md border border-afro-line bg-afro-panel p-4">
        <PanelHeading title={s.title} icon={RefreshCw} meta={loading ? t.dataStatus.loading : undefined} />
        {filtered.length === 0 ? (
          <div className="mt-2">
            <EmptyState message={loading ? t.dataStatus.loading : s.empty} />
          </div>
        ) : (
          <div className="mt-2">
            <DataTable rows={filtered} columns={columns} rowKey={(a) => a.id} minWidth="820px" />
          </div>
        )}
      </div>
    </section>
  );
}
