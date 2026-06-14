import { useEffect, useMemo, useState } from 'react';
import { Copy, Link2, Pencil, Plus, Search, X } from 'lucide-react';
import type { AdminClientConfigSummary, AdminCustomerAccountSummary } from '@afrows/shared';
import {
  createAdminClientConfig,
  createAdminCustomerAccount,
  exportAdminCustomerClientConfigs,
  fetchAdminClientConfigEntryLink,
  fetchAdminCustomerAccounts,
  updateAdminCustomerAccount,
} from '../api/admin';
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
  // protocols to auto-create when adding a customer
  const [protoVless, setProtoVless] = useState(true);
  const [protoWg, setProtoWg] = useState(false);
  const [protoL2tp, setProtoL2tp] = useState(false);
  const [newConfigProto, setNewConfigProto] = useState('vless');

  // configs panel
  const [configsFor, setConfigsFor] = useState<AdminCustomerAccountSummary | null>(null);
  const [configList, setConfigList] = useState<AdminClientConfigSummary[]>([]);
  const [linkMap, setLinkMap] = useState<Record<string, string>>({});
  const [configBusy, setConfigBusy] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    setProtoVless(true);
    setProtoWg(false);
    setProtoL2tp(false);
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
      if (editId) {
        await updateAdminCustomerAccount(sessionToken, editId, payload);
      } else {
        const created = await createAdminCustomerAccount(sessionToken, payload);
        const protos = [protoVless ? 'vless' : '', protoWg ? 'wireguard' : '', protoL2tp ? 'l2tp' : ''].filter(Boolean);
        for (const p of protos) {
          try {
            await createAdminClientConfig(sessionToken, created.id, { label: `${p}-1`, protocol: p });
          } catch {
            /* config create best-effort */
          }
        }
      }
      setEditorOpen(false);
      setEditId(null);
      await load();
    } catch {
      setError(s.saveError);
    } finally {
      setSaving(false);
    }
  };

  const loadConfigs = async (accountId: string) => {
    setConfigBusy(true);
    setConfigError(null);
    try {
      const res = await exportAdminCustomerClientConfigs(sessionToken, accountId);
      setConfigList(res.configs);
      const links: Record<string, string> = {};
      await Promise.all(
        res.configs.map(async (c) => {
          try {
            const r = await fetchAdminClientConfigEntryLink(sessionToken, c.id);
            if (r.link) links[c.id] = r.link;
          } catch {
            /* skip */
          }
        }),
      );
      setLinkMap(links);
    } catch {
      setConfigError(t.customersPage.configError);
    } finally {
      setConfigBusy(false);
    }
  };

  const openConfigs = (a: AdminCustomerAccountSummary) => {
    setEditorOpen(false);
    setConfigsFor(a);
    setConfigList([]);
    setLinkMap({});
    void loadConfigs(a.id);
  };

  const onCreateConfig = async () => {
    if (!configsFor) return;
    setConfigBusy(true);
    setConfigError(null);
    try {
      await createAdminClientConfig(sessionToken, configsFor.id, {
        label: `${newConfigProto}-${configList.length + 1}`,
        protocol: newConfigProto,
      });
      await loadConfigs(configsFor.id);
      await load();
    } catch {
      setConfigError(t.customersPage.configError);
    } finally {
      setConfigBusy(false);
    }
  };

  const copyLink = async (id: string, link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {
      /* ignore */
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
    {
      key: 'protocols',
      header: s.colProtocols,
      render: (a) =>
        a.protocols && a.protocols.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {a.protocols.map((p) => (
              <span
                key={p}
                className="inline-flex items-center rounded-full border border-afro-line bg-afro-page px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-afro-ink"
              >
                {p}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-afro-muted">—</span>
        ),
    },
    { key: 'seller', header: s.colSeller, render: (a) => a.resellerDisplayName || s.direct },
    {
      key: 'actions',
      header: '',
      alignRight: true,
      render: (a) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => openConfigs(a)}
            title={s.configsAction}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-afro-line px-2 text-xs font-bold text-afro-ink hover:border-afro-teal hover:text-afro-teal"
          >
            <Link2 size={14} />
            {s.configsAction}
          </button>
          <button
            type="button"
            onClick={() => openEdit(a)}
            title={s.editAction}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-afro-line text-afro-muted hover:border-afro-teal hover:text-afro-teal"
          >
            <Pencil size={14} />
          </button>
        </div>
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
            {!editId ? (
              <div className="grid gap-1.5 md:col-span-2">
                <span className="text-[13px] font-bold text-afro-muted">{s.fldProtocols}</span>
                <div className="flex flex-wrap gap-4">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={protoVless} onChange={(e) => setProtoVless(e.target.checked)} /> {s.protoVless}
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={protoWg} onChange={(e) => setProtoWg(e.target.checked)} /> {s.protoWireguard}
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={protoL2tp} onChange={(e) => setProtoL2tp(e.target.checked)} /> {s.protoL2tp}
                  </label>
                </div>
              </div>
            ) : null}
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

      {configsFor ? (
        <div className="rounded-md border border-afro-line bg-afro-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-afro-ink">
              {s.configsTitle} — {nameOf(configsFor)}
            </h2>
            <button type="button" onClick={() => setConfigsFor(null)} className="text-afro-muted hover:text-afro-ink">
              <X size={16} />
            </button>
          </div>
          <div className="mb-3 flex items-center gap-2">
            <select value={newConfigProto} onChange={(e) => setNewConfigProto(e.target.value)} className={inputClass}>
              <option value="vless">{s.protoVless}</option>
              <option value="wireguard">{s.protoWireguard}</option>
              <option value="l2tp">{s.protoL2tp}</option>
            </select>
            <button
              type="button"
              onClick={() => void onCreateConfig()}
              disabled={configBusy}
              className="inline-flex min-h-9 items-center gap-2 rounded-md bg-afro-teal px-3 text-sm font-bold text-white disabled:opacity-60"
            >
              <Plus size={15} />
              {s.newConfig}
            </button>
          </div>
          {configError ? <p className="mb-2 text-[13px] font-bold text-[#b91c1c]">{configError}</p> : null}
          {configList.length === 0 ? (
            <EmptyState message={configBusy ? t.dataStatus.loading : s.noConfigs} />
          ) : (
            <div className="grid gap-2">
              {configList.map((c) => (
                <div key={c.id} className="grid gap-1.5 rounded-md border border-afro-line bg-white p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-[13px] text-afro-ink">{c.label}</strong>
                    <span className="text-[12px] text-afro-muted">
                      {c.protocol} · {String(c.status)} · {format.bytes(c.usedBytes)}
                    </span>
                  </div>
                  {linkMap[c.id] ? (
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={linkMap[c.id]}
                        dir="ltr"
                        className="min-w-0 flex-1 truncate rounded-md border border-afro-line bg-afro-page px-2 py-1 font-mono text-[11px] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void copyLink(c.id, linkMap[c.id])}
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-afro-line px-2 text-xs font-bold text-afro-ink hover:border-afro-teal hover:text-afro-teal"
                      >
                        <Copy size={13} />
                        {copiedId === c.id ? s.copied : s.copyLink}
                      </button>
                    </div>
                  ) : c.protocol === 'vless' ? (
                    <span className="text-[12px] text-afro-muted">{t.dataStatus.loading}</span>
                  ) : (
                    <span className="text-[12px] font-bold text-[#c27a1a]">{s.configPending}</span>
                  )}
                </div>
              ))}
            </div>
          )}
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
