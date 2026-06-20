import { useEffect, useMemo, useState } from 'react';
import { Copy, Link2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import type { AdminClientConfigSummary, AdminCustomerAccountSummary, EgressTierPrice } from '@afrows/shared';
import {
  createAdminClientConfig,
  createAdminCustomerAccount,
  exportAdminCustomerClientConfigs,
  fetchAdminClientConfigEntryLink,
  deleteAdminClientConfig,
  fetchAdminCustomerAccounts,
  fetchAdminWireguardConfig,
  fetchEgressTierPrices,
  setEgressTierPrice,
  resetCustomerAccountPassword,
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

  // tier pricing (super-admin editable)
  const [tierPrices, setTierPrices] = useState<EgressTierPrice[]>([]);
  const [pricesBusy, setPricesBusy] = useState(false);
  const priceFor = (tier: string) => tierPrices.find((p) => p.tier === tier)?.price ?? 0;
  const setPriceFor = (tier: string, price: number) =>
    setTierPrices((prev) => {
      const next = prev.filter((p) => p.tier !== tier);
      const cur = prev.find((p) => p.tier === tier);
      return [...next, { tier, price, currency: cur?.currency ?? 'IRT' }].sort((a, b) => a.tier.localeCompare(b.tier));
    });
  const savePrices = async () => {
    setPricesBusy(true);
    setError(null);
    try {
      let latest = tierPrices;
      for (const tier of ['normal', 'gaming']) latest = await setEgressTierPrice(sessionToken, tier, priceFor(tier), 'IRT');
      setTierPrices(latest);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPricesBusy(false);
    }
  };
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [telegram, setTelegram] = useState('');
  const [quotaGb, setQuotaGb] = useState('50');
  const [perClientGb, setPerClientGb] = useState('');
  const [scope, setScope] = useState<Scope>('account_shared');
  const [status, setStatus] = useState<Status>('active');
  const [egressTier, setEgressTier] = useState<'normal' | 'gaming'>('normal');
  const [gamingEntitled, setGamingEntitled] = useState(false);
  const [expiresAt, setExpiresAt] = useState(''); // YYYY-MM-DD for the date input ('' = never)
  const [tagsInput, setTagsInput] = useState(''); // comma-separated
  const [notes, setNotes] = useState('');
  // protocols to auto-create when adding a customer (L2TP deferred until its server lands)
  const [protoVless, setProtoVless] = useState(true);
  const [protoWg, setProtoWg] = useState(false);
  const [newConfigProto, setNewConfigProto] = useState('vless');
  const [addProtoBusy, setAddProtoBusy] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [shownPassword, setShownPassword] = useState<string | null>(null);
  const [pwCopied, setPwCopied] = useState(false);
  const [customPw, setCustomPw] = useState(''); // operator-typed password (blank = auto-generate)

  // configs panel
  const [configsFor, setConfigsFor] = useState<AdminCustomerAccountSummary | null>(null);
  const [configList, setConfigList] = useState<AdminClientConfigSummary[]>([]);
  const [linkMap, setLinkMap] = useState<Record<string, string>>({});
  const [wgConfigMap, setWgConfigMap] = useState<Record<string, string>>({});
  const [wgQrMap, setWgQrMap] = useState<Record<string, string>>({});
  const [wgBusy, setWgBusy] = useState<string | null>(null);
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
    void fetchEgressTierPrices(sessionToken).then((p) => active && setTierPrices(p)).catch(() => undefined);
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
    setEgressTier('normal');
    setGamingEntitled(false);
    setExpiresAt('');
    setTagsInput('');
    setNotes('');
    setProtoVless(true);
    setProtoWg(false);
    setShownPassword(null);
    setPwCopied(false);
    setCustomPw('');
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
    setEgressTier((a.egressTier as 'normal' | 'gaming') === 'gaming' ? 'gaming' : 'normal');
    setGamingEntitled(a.gamingEntitled === true);
    setExpiresAt(a.expiresAt ? a.expiresAt.slice(0, 10) : '');
    setTagsInput((a.tags ?? []).join(', '));
    setNotes(a.notes ?? '');
    setEditorOpen(true);
  };

  // Protocols of the customer currently being edited (for the Edit dialog).
  const editProtocols = useMemo(
    () => accounts.find((a) => a.id === editId)?.protocols ?? [],
    [accounts, editId],
  );

  // Add a protocol (a new client config) to the customer being edited.
  const onAddProtocol = async (protocol: 'vless' | 'wireguard') => {
    if (!editId) return;
    setAddProtoBusy(true);
    setError(null);
    try {
      // Label is assigned server-side (collision-free); just send the protocol.
      await createAdminClientConfig(sessionToken, editId, { protocol });
      await load();
    } catch {
      setError(s.saveError);
    } finally {
      setAddProtoBusy(false);
    }
  };

  // Reset the customer's login password and show the new one once (to hand off).
  const onResetPassword = async () => {
    if (!editId) return;
    setPwBusy(true);
    setError(null);
    setShownPassword(null);
    try {
      const { generatedPassword } = await resetCustomerAccountPassword(
        sessionToken,
        editId,
        customPw.trim() || undefined,
      );
      setShownPassword(generatedPassword);
      setCustomPw('');
      setPwCopied(false);
      await load();
    } catch {
      setError(s.saveError);
    } finally {
      setPwBusy(false);
    }
  };

  const copyPassword = async () => {
    if (!shownPassword) return;
    try {
      await navigator.clipboard.writeText(shownPassword);
      setPwCopied(true);
      window.setTimeout(() => setPwCopied(false), 1500);
    } catch {
      /* ignore */
    }
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
      egressTier,
      gamingEntitled,
      expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
      tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      notes: notes.trim() || null,
    };
    try {
      if (editId) {
        await updateAdminCustomerAccount(sessionToken, editId, payload);
        // If the operator typed a password, Save applies it too (intuitive),
        // not only the separate "Set password" button.
        if (customPw.trim()) {
          const { generatedPassword } = await resetCustomerAccountPassword(sessionToken, editId, customPw.trim());
          setShownPassword(generatedPassword);
          setCustomPw('');
          setPwCopied(false);
          await load();
          setSaving(false);
          return; // keep the editor open so the password is shown once
        }
      } else {
        const created = await createAdminCustomerAccount(sessionToken, {
          ...payload,
          password: customPw.trim() || null,
        });
        const protos = [protoVless ? 'vless' : '', protoWg ? 'wireguard' : ''].filter(Boolean);
        for (const p of protos) {
          try {
            await createAdminClientConfig(sessionToken, created.id, { protocol: p });
          } catch {
            /* config create best-effort */
          }
        }
        await load();
        // If the new account has a login, reopen it in edit mode and reveal the
        // password once so the operator can copy it for the user.
        if (created.generatedPassword) {
          openEdit(created);
          setShownPassword(created.generatedPassword);
          setSaving(false);
          return;
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
          // Entry link is a VLESS URI — only meaningful for vless configs.
          // WireGuard configs render their own .conf via "Show WireGuard config".
          if ((c.protocol ?? '').toLowerCase() !== 'vless') return;
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
    setWgConfigMap({});
    setWgQrMap({});
    void loadConfigs(a.id);
  };

  // Fetch + reveal a WireGuard config's .conf text (provisions the peer if needed).
  const showWgConfig = async (configId: string) => {
    setWgBusy(configId);
    setConfigError(null);
    try {
      const { configText, qrSvg } = await fetchAdminWireguardConfig(sessionToken, configId);
      setWgConfigMap((m) => ({ ...m, [configId]: configText }));
      setWgQrMap((m) => ({ ...m, [configId]: qrSvg }));
    } catch {
      setConfigError(t.customersPage.configError);
    } finally {
      setWgBusy(null);
    }
  };

  // Download a .conf file (so the operator can send it / the user imports it).
  const downloadConf = (label: string, text: string) => {
    const blob = new Blob([text], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const name = (label || 'afrows').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 15);
    a.href = url;
    a.download = `${name}.conf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Delete a single config (WireGuard peers are removed from wg0 by the reconciler).
  const onDeleteConfig = async (configId: string, label: string) => {
    if (!configsFor) return;
    if (!window.confirm(s.deleteConfigConfirm(label))) return;
    setConfigBusy(true);
    setConfigError(null);
    try {
      await deleteAdminClientConfig(sessionToken, configId);
      await loadConfigs(configsFor.id);
      await load();
    } catch {
      setConfigError(t.customersPage.configError);
    } finally {
      setConfigBusy(false);
    }
  };

  const onCreateConfig = async () => {
    if (!configsFor) return;
    setConfigBusy(true);
    setConfigError(null);
    try {
      // Label is assigned server-side (collision-free); just send the protocol.
      await createAdminClientConfig(sessionToken, configsFor.id, {
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
      [a.displayName, a.telegramUsername, a.loginEmail, a.telegramId, a.resellerDisplayName, ...(a.tags ?? [])]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [accounts, query]);

  // Per-egress-path usage + billing (path is decided by tier: gaming->Starlink, normal->Germany).
  const pathSummary = useMemo(() => {
    const rows = [
      { tier: 'gaming', label: 'Starlink (gaming/VIP)', count: 0, bytes: 0 },
      { tier: 'normal', label: 'Germany (normal)', count: 0, bytes: 0 },
    ];
    for (const a of accounts) {
      const r = a.egressTier === 'gaming' ? rows[0] : rows[1];
      r.count += 1;
      r.bytes += a.usedBytes || 0;
    }
    return rows.map((r) => ({
      ...r,
      cost: Math.round((r.bytes / GIB) * priceFor(r.tier)),
      currency: tierPrices.find((p) => p.tier === r.tier)?.currency ?? 'IRT',
    }));
  }, [accounts, tierPrices]);

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
                key={p.protocol}
                title={`${p.protocol}: ${format.bytes(p.usedBytes)}`}
                className="inline-flex items-center gap-1 rounded-full border border-afro-line bg-afro-page px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-afro-ink"
              >
                {p.protocol}
                <span className="font-normal normal-case text-afro-muted">{format.bytes(p.usedBytes)}</span>
              </span>
            ))}
          </span>
        ) : (
          <span className="text-afro-muted">—</span>
        ),
    },
    {
      key: 'expiry',
      header: 'Expires',
      render: (a) => {
        if (!a.expiresAt) return <span className="text-afro-muted">—</span>;
        const expired = new Date(a.expiresAt).getTime() <= Date.now();
        return (
          <span className={expired ? 'font-bold text-red-500' : 'text-afro-ink'}>
            {format.time(new Date(a.expiresAt), false)}
            {expired ? ' (expired)' : ''}
          </span>
        );
      },
    },
    {
      key: 'lastSeen',
      header: 'Last connected',
      render: (a) => (a.lastConnectedAt ? format.time(new Date(a.lastConnectedAt), false) : <span className="text-afro-muted">—</span>),
    },
    {
      key: 'cost',
      header: 'Cost',
      render: (a) => {
        const tier = a.egressTier === 'gaming' ? 'gaming' : 'normal';
        const price = priceFor(tier);
        if (!price) return <span className="text-afro-muted">—</span>;
        const cost = Math.round((a.usedBytes / GIB) * price);
        const currency = tierPrices.find((p) => p.tier === tier)?.currency ?? 'IRT';
        return <span className="text-afro-ink">{`${cost.toLocaleString()} ${currency}`}</span>;
      },
    },
    {
      key: 'tags',
      header: 'Tags',
      render: (a) =>
        a.tags && a.tags.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {a.tags.map((t) => (
              <span key={t} className="inline-flex rounded-full border border-afro-line bg-afro-page px-2 py-0.5 text-[11px] font-bold text-afro-ink">
                {t}
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
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-afro-line bg-white px-4 py-3">
        <span className="text-[13px] font-bold text-afro-muted">{s.tierPricing}:</span>
        <label className="inline-flex items-center gap-1.5 text-sm">
          {s.tierNormal}
          <input
            type="number"
            min={0}
            value={priceFor('normal')}
            onChange={(e) => setPriceFor('normal', Number(e.target.value) || 0)}
            className="w-28 rounded-md border border-afro-line px-2 py-1 text-sm"
          />
        </label>
        <label className="inline-flex items-center gap-1.5 text-sm">
          {s.tierGaming}
          <input
            type="number"
            min={0}
            value={priceFor('gaming')}
            onChange={(e) => setPriceFor('gaming', Number(e.target.value) || 0)}
            className="w-28 rounded-md border border-afro-line px-2 py-1 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={pricesBusy}
          onClick={savePrices}
          className="inline-flex min-h-9 items-center gap-2 rounded-md bg-afro-sidebar px-3 text-sm font-bold text-white hover:bg-[#1f3138] disabled:opacity-50"
        >
          {s.save}
        </button>
      </div>
      <div className="flex flex-wrap gap-3">
        {pathSummary.map((p) => (
          <div key={p.tier} className="min-w-[220px] flex-1 rounded-md border border-afro-line bg-white px-4 py-3">
            <div className="text-[13px] font-bold text-afro-ink">{p.label}</div>
            <div className="mt-1 text-[12px] text-afro-muted">
              {format.integer(p.count)} customers · {format.bytes(p.bytes)}
            </div>
            <div className="mt-1 text-[14px] font-bold text-afro-ink">{p.cost.toLocaleString()} {p.currency}</div>
          </div>
        ))}
      </div>
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
            <label className="grid gap-1.5">
              <span className="text-[13px] font-bold text-afro-muted">{s.fldEgressTier}</span>
              <select value={egressTier} onChange={(e) => setEgressTier(e.target.value as 'normal' | 'gaming')} className={inputClass}>
                <option value="normal">{s.tierNormal}</option>
                <option value="gaming">{s.tierGaming}</option>
              </select>
            </label>
            <label className="flex items-center gap-2 self-end pb-2">
              <input
                type="checkbox"
                checked={gamingEntitled}
                onChange={(e) => setGamingEntitled(e.target.checked)}
                className="h-4 w-4 accent-afro-accent"
              />
              <span className="text-[13px] font-bold text-afro-muted">Allow Game mode toggle (in app)</span>
            </label>
            <label className="grid gap-1.5">
              <span className="text-[13px] font-bold text-afro-muted">Expiry date (blank = never)</span>
              <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={inputClass} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[13px] font-bold text-afro-muted">Tags (comma separated)</span>
              <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="vip, trial" className={inputClass} />
            </label>
            <label className="grid gap-1.5 md:col-span-2">
              <span className="text-[13px] font-bold text-afro-muted">{s.fldNotes}</span>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
            </label>
            {!editId && email.trim() ? (
              <label className="grid gap-1.5 md:col-span-2">
                <span className="text-[13px] font-bold text-afro-muted">{s.fldLoginPassword}</span>
                <input
                  value={customPw}
                  onChange={(e) => setCustomPw(e.target.value)}
                  dir="ltr"
                  placeholder={s.passwordCustomPlaceholder}
                  className={inputClass}
                />
              </label>
            ) : null}
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
                </div>
              </div>
            ) : (
              <div className="grid gap-1.5 md:col-span-2">
                <span className="text-[13px] font-bold text-afro-muted">{s.fldProtocols}</span>
                <div className="flex flex-wrap items-center gap-2">
                  {editProtocols.length > 0 ? (
                    editProtocols.map((p) => (
                      <span
                        key={p.protocol}
                        className="inline-flex items-center gap-1 rounded-full border border-afro-line bg-afro-page px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide text-afro-ink"
                      >
                        {p.protocol}
                        <span className="font-normal normal-case text-afro-muted">{format.bytes(p.usedBytes)}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-[13px] text-afro-muted">{s.noConfigs}</span>
                  )}
                  {(['vless', 'wireguard'] as const)
                    .filter((proto) => !editProtocols.some((p) => p.protocol === proto))
                    .map((proto) => (
                      <button
                        key={proto}
                        type="button"
                        disabled={addProtoBusy}
                        onClick={() => void onAddProtocol(proto)}
                        className="inline-flex min-h-8 items-center gap-1 rounded-md border border-afro-line px-2.5 text-[12px] font-bold text-afro-ink hover:border-afro-teal hover:text-afro-teal disabled:opacity-60"
                      >
                        <Plus size={13} />
                        {proto}
                      </button>
                    ))}
                </div>
              </div>
            )}
            {editId && email.trim() ? (
              <div className="grid gap-1.5 md:col-span-2">
                <span className="text-[13px] font-bold text-afro-muted">{s.fldLoginPassword}</span>
                {shownPassword ? (
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={shownPassword}
                      dir="ltr"
                      className="min-w-0 flex-1 truncate rounded-md border border-afro-line bg-afro-page px-2 py-1 font-mono text-[13px] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void copyPassword()}
                      className="inline-flex h-9 items-center gap-1 rounded-md border border-afro-line px-2 text-xs font-bold text-afro-ink hover:border-afro-teal hover:text-afro-teal"
                    >
                      <Copy size={13} />
                      {pwCopied ? s.copied : s.copyLink}
                    </button>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={customPw}
                    onChange={(e) => setCustomPw(e.target.value)}
                    dir="ltr"
                    placeholder={s.passwordCustomPlaceholder}
                    className={`${inputClass} min-w-[200px] flex-1`}
                  />
                  <button
                    type="button"
                    disabled={pwBusy}
                    onClick={() => void onResetPassword()}
                    className="inline-flex min-h-10 items-center gap-1 rounded-md border border-afro-line px-3 text-[12px] font-bold text-afro-ink hover:border-afro-teal hover:text-afro-teal disabled:opacity-60"
                  >
                    {customPw.trim() ? s.setPassword : s.generatePassword}
                  </button>
                </div>
                <span className="text-[12px] text-afro-muted">
                  {shownPassword ? s.passwordShownOnce : s.passwordHashedNote}
                </span>
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
                    <span className="flex items-center gap-2 text-[12px] text-afro-muted">
                      {c.protocol} · {String(c.status)} · {format.bytes(c.usedBytes)}
                      <button
                        type="button"
                        title={s.deleteConfig}
                        disabled={configBusy}
                        onClick={() => void onDeleteConfig(c.id, c.label)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-afro-line text-afro-muted hover:border-[#d23f3f] hover:text-[#d23f3f] disabled:opacity-60"
                      >
                        <Trash2 size={13} />
                      </button>
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
                  ) : c.protocol === 'wireguard' ? (
                    wgConfigMap[c.id] ? (
                      <div className="grid gap-1.5">
                        {wgQrMap[c.id] ? (
                          <div
                            className="mx-auto h-40 w-40 rounded-md bg-white p-1 [&>svg]:h-full [&>svg]:w-full"
                            title={s.scanWg}
                            // eslint-disable-next-line react/no-danger
                            dangerouslySetInnerHTML={{ __html: wgQrMap[c.id] }}
                          />
                        ) : null}
                        <textarea
                          readOnly
                          value={wgConfigMap[c.id]}
                          dir="ltr"
                          rows={8}
                          className="w-full rounded-md border border-afro-line bg-afro-page px-2 py-1 font-mono text-[11px] outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void copyLink(c.id, wgConfigMap[c.id])}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-afro-line px-2 text-xs font-bold text-afro-ink hover:border-afro-teal hover:text-afro-teal"
                          >
                            <Copy size={13} />
                            {copiedId === c.id ? s.copied : s.copyLink}
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadConf(c.label, wgConfigMap[c.id])}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-afro-line px-2 text-xs font-bold text-afro-ink hover:border-afro-teal hover:text-afro-teal"
                          >
                            {s.downloadConf}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={wgBusy === c.id}
                        onClick={() => void showWgConfig(c.id)}
                        className="inline-flex h-8 w-fit items-center gap-1 rounded-md border border-afro-line px-2.5 text-xs font-bold text-afro-ink hover:border-afro-teal hover:text-afro-teal disabled:opacity-60"
                      >
                        {wgBusy === c.id ? t.dataStatus.loading : s.showWgConfig}
                      </button>
                    )
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
