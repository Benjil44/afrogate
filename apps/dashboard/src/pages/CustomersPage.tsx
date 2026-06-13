import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, X } from 'lucide-react';
import type { AdminCustomerAccountSummary } from '@afrows/shared';
import { createAdminCustomerAccount, fetchAdminCustomerAccounts, updateAdminCustomerAccount } from '../api/admin';
import { DataTable, EmptyState, PanelHeading } from '../components/primitives';
import type { DataTableColumn } from '../dashboard-types';
import type { DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';

const POLL_MS = 30000;
const GIB = 1024 ** 3;

type Status = 'active' | 'suspended' | 'disabled';
type Scope = 'account_shared' | 'per_client';

/** Subscribers you sell to — the single place to create, edit and review them.
 * (Create/edit was consolidated here out of Billing.) */
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

  // editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [telegram, setTelegram] = useState('');
  const [quotaGb, setQuotaGb] = useState('50');
  const [perClientGb, setPerClientGb] = useState('');
  const [scope, setScope] = useState<Scope>('account_shared');
  const [status, setStatus] = useState<Status>('active');
  const [notes, setNotes] = useState('');

  const load = async () => {
    try {
      const res = await fetchAdminCustomerAccounts(sessionToken);
      setAccounts(res.accounts);
    } catch {
      /* keep last */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    const run = async () => {
      await load();
      if (active) timer = window.setTimeout(run, POLL_MS);
    };
    void run();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  const nameOf = (a: AdminCustomerAccountSummary) =>
    a.displayName || a.telegramUsername || a.loginEmail || a.telegramId || a.id.slice(0, 8);

  const resetForm = () => {
    setName('');
    setEmail('');
    setTelegram('');
    setQuotaGb('50');
    setPerClientGb('');
    setScope('account_shared');
    setStatus('active');
    setNotes('');
    setError(null);
  };

  const openCreate = () => {
    resetForm();
    setEditId(null);
    setEditorOpen(true);
  };

  const openEdit = (a: AdminCustomerAccountSummary) => {
    resetForm();
    setEditId(a.id);
    setName(a.displayName ?? '');
    setEmail(a.loginEmail ?? '');
    setTelegram(a.telegramUsername ?? '');
    setQuotaGb(a.quotaLimitBytes != null ? String(Math.round((a.quotaLimitBytes / GIB) * 100) / 100) : '');
    setPerClientGb(a.perClientLimitBytes != null ? String(Math.round((a.perClientLimitBytes / GIB) * 100) / 100) : '');
    setScope((a.quotaScope as Scope) || 'account_shared');
    setStatus((a.status as Status) || 'active');
    setNotes(a.notes ?? '');
    setEditorOpen(true);
  };

  const gbToBytes = (v: string): number | null => {
    const n = Number(v.trim());
    return v.trim() && Number.isFinite(n) ? Math.round(n * GIB) : null;
  };

  const onSave = async () => {
    if (!name.trim()) {
      setError(s.saveError);
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      displayName: name.trim(),
      loginEmail: email.trim() || null,
      telegramUsername: telegram.trim() || null,
      quotaLimitBytes: gbToBytes(quotaGb),
      perClientLimitBytes: gbToBytes(perClientGb),
      quotaScope: scope,
      status,
      notes: notes.trim() || null,
    };
    try {
      if (editId) await updateAdminCustomerAccount(sessionToken, editId, payload);
      else await createAdminCustomerAccount(sessionToken, payload);
      setEditorOpen(false);
      setEditId(null);
      await load();
    } catch {
      setError(s.saveError);
    } finally {
      setSaving(false);
    }
  };

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
    st === 'active' ? '#1f9d57' : st === 'suspended' || st === 'disabled' ? '#d23f3f' : '#9aa7ad';

  const inputClass = 'min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm outline-none focus:border-afro-teal';

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
    { key: 'email', header: s.colEmail, render: (a) => a.loginEmail || '—' },
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
    { key: 'used', header: s.colUsed, render: (a) => format.bytes(a.usedBytes) },
    { key: 'quota', header: s.colQuota, render: (a) => format.bytes(a.quotaLimitBytes ?? null) },
    { key: 'clients', header: s.colClients, render: (a) => `${format.integer(a.activeClientCount)} / ${format.integer(a.clientCount)}` },
    { key: 'seller', header: s.colSeller, render: (a) => a.resellerDisplayName || s.direct },
    {
      key: 'actions',
      header: '',
      alignRight: true,
      render: (a) => (
        <button
          type="button"
          onClick={() => openEdit(a)}
          title={s.editAction}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-afro-line text-afro-muted hover:border-afro-teal hover:text-afro-teal"
        >
          <Pencil size={14} />
        </button>
      ),
    },
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
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-afro-muted">{s.total.replace('{n}', format.integer(filtered.length))}</span>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex min-h-9 items-center gap-2 rounded-md bg-afro-sidebar px-3 text-sm font-bold text-white hover:bg-[#1f3138]"
          >
            <Plus size={15} />
            {s.addButton}
          </button>
        </div>
      </div>

      {editorOpen ? (
        <div className="rounded-md border border-afro-line bg-afro-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-afro-ink">{editId ? s.editTitle : s.addTitle}</h2>
            <button type="button" onClick={() => setEditorOpen(false)} className="text-afro-muted hover:text-afro-ink">
              <X size={16} />
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-[13px] font-bold text-afro-muted">{s.fldName}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[13px] font-bold text-afro-muted">{s.fldEmail}</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" className={inputClass} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[13px] font-bold text-afro-muted">{s.fldTelegram}</span>
              <input value={telegram} onChange={(e) => setTelegram(e.target.value)} dir="ltr" className={inputClass} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[13px] font-bold text-afro-muted">{s.fldQuotaGb}</span>
              <input value={quotaGb} onChange={(e) => setQuotaGb(e.target.value)} dir="ltr" inputMode="decimal" className={inputClass} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[13px] font-bold text-afro-muted">{s.fldPerClientGb}</span>
              <input value={perClientGb} onChange={(e) => setPerClientGb(e.target.value)} dir="ltr" inputMode="decimal" className={inputClass} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[13px] font-bold text-afro-muted">{s.fldScope}</span>
              <select value={scope} onChange={(e) => setScope(e.target.value as Scope)} className={inputClass}>
                <option value="account_shared">account_shared</option>
                <option value="per_client">per_client</option>
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-[13px] font-bold text-afro-muted">{s.fldStatus}</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className={inputClass}>
                <option value="active">active</option>
                <option value="suspended">suspended</option>
                <option value="disabled">disabled</option>
              </select>
            </label>
            <label className="grid gap-1.5 md:col-span-2">
              <span className="text-[13px] font-bold text-afro-muted">{s.fldNotes}</span>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
            </label>
          </div>
          {error ? <p className="mt-3 text-[13px] font-bold text-[#b91c1c]">{error}</p> : null}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={saving}
              className="inline-flex min-h-10 items-center rounded-md bg-afro-teal px-4 text-sm font-bold text-white disabled:opacity-60"
            >
              {s.save}
            </button>
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              className="inline-flex min-h-10 items-center rounded-md border border-afro-line px-4 text-sm font-bold text-afro-muted"
            >
              {s.cancel}
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-md border border-afro-line bg-afro-panel p-4">
        <PanelHeading title={s.title} icon={Plus} meta={loading ? t.dataStatus.loading : undefined} />
        {filtered.length === 0 ? (
          <div className="mt-2">
            <EmptyState message={loading ? t.dataStatus.loading : s.empty} />
          </div>
        ) : (
          <div className="mt-2">
            <DataTable rows={filtered} columns={columns} rowKey={(a) => a.id} minWidth="900px" />
          </div>
        )}
      </div>
    </section>
  );
}
