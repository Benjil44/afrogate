import { Fragment, useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2, Zap, Power, X, Pencil, ChevronDown, ChevronRight } from 'lucide-react';
import type { AdminOutboundSummary, AdminOutboundSubscriptionSummary } from '@afrows/shared';
import type { DashboardStrings } from '../i18n';
import {
  fetchAdminOutbounds,
  createAdminOutbound,
  updateAdminOutbound,
  deleteAdminOutbound,
  testAdminOutbound,
  testAllAdminOutbounds,
  fetchAdminOutboundTestSettings,
  setAdminOutboundTestSettings,
  fetchAdminOutboundSubscriptions,
  createAdminOutboundSubscription,
  refreshAdminOutboundSubscription,
  deleteAdminOutboundSubscription,
  type CreateOutboundPayload,
} from '../api/admin';

type Protocol = 'vless' | 'wireguard' | 'l2tp' | 'subscription';

const POLL_MS = 20000;
const FAST_POLL_MS = 4000;

export function OutboundsPage({ sessionToken, t }: { sessionToken: string; t: DashboardStrings }) {
  const s = t.outboundsPage;
  const [rows, setRows] = useState<AdminOutboundSummary[]>([]);
  const [subs, setSubs] = useState<AdminOutboundSubscriptionSummary[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [subUrl, setSubUrl] = useState('');
  const [auto, setAuto] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null); // null = add mode
  const [protocol, setProtocol] = useState<Protocol>('vless');
  const [name, setName] = useState('');
  const [vlessLink, setVlessLink] = useState('');
  const [wgConfig, setWgConfig] = useState('');
  const [l2tpServer, setL2tpServer] = useState('');
  const [l2tpUser, setL2tpUser] = useState('');
  const [l2tpSecret, setL2tpSecret] = useState('');
  // Inline VLESS field editor (edit mode). baseConfig keeps fields we don't show
  // (flow, pbk/sid, fingerprint) so they survive a save.
  const [baseConfig, setBaseConfig] = useState<Record<string, unknown>>({});
  const [fAddress, setFAddress] = useState('');
  const [fPort, setFPort] = useState('');
  const [fUuid, setFUuid] = useState('');
  const [fNetwork, setFNetwork] = useState('tcp');
  const [fHeaderType, setFHeaderType] = useState('none');
  const [fHost, setFHost] = useState('');
  const [fSecurity, setFSecurity] = useState('none');
  const [fEncryption, setFEncryption] = useState('none');
  const [fSni, setFSni] = useState('');
  const [fPath, setFPath] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const load = useCallback(async (): Promise<AdminOutboundSummary[] | null> => {
    try {
      const [res, subRes] = await Promise.all([
        fetchAdminOutbounds(sessionToken),
        fetchAdminOutboundSubscriptions(sessionToken).catch(() => ({ subscriptions: [] })),
      ]);
      setRows(res.outbounds);
      setSubs(subRes.subscriptions);
      return res.outbounds;
    } catch {
      return null; // keep last data on transient failure
    }
  }, [sessionToken]);

  // Poll fast (4s) while any test is in flight, otherwise every 20s.
  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    const schedule = (data: AdminOutboundSummary[] | null) => {
      if (!active) return;
      const pending = (data ?? []).some((r) => r.pendingTest);
      timer = window.setTimeout(run, pending ? FAST_POLL_MS : POLL_MS);
    };
    const run = () => void load().then(schedule);
    run();
    fetchAdminOutboundTestSettings(sessionToken)
      .then((st) => setAuto(st.enabled))
      .catch(() => {});
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [load, sessionToken]);

  const resetForm = () => {
    setVlessLink('');
    setWgConfig('');
    setL2tpServer('');
    setL2tpUser('');
    setL2tpSecret('');
    setSubUrl('');
    setName('');
    setBaseConfig({});
    setFAddress('');
    setFPort('');
    setFUuid('');
    setFNetwork('tcp');
    setFHeaderType('none');
    setFHost('');
    setFSecurity('none');
    setFEncryption('none');
    setFSni('');
    setFPath('');
    setError(null);
  };

  const protocolOf = (type: string): Protocol =>
    type === 'wireguard' ? 'wireguard' : type === 'l2tp' ? 'l2tp' : 'vless';

  const str = (v: unknown): string => (v == null ? '' : String(v));

  const openEdit = (o: AdminOutboundSummary) => {
    resetForm();
    const cfg = o.config ?? {};
    setEditId(o.id);
    setProtocol(protocolOf(o.type));
    setName(o.name);
    setBaseConfig(cfg);
    // Pre-fill inline VLESS fields (config is not redacted for VLESS).
    setFAddress(str(cfg.address));
    setFPort(str(cfg.port));
    setFUuid(str(cfg.uuid));
    setFNetwork(str(cfg.network) || 'tcp');
    setFHeaderType(str(cfg.headerType) || 'none');
    setFHost(str(cfg.host));
    setFSecurity(str(cfg.security) || 'none');
    setFEncryption(str(cfg.encryption) || 'none');
    setFSni(str(cfg.serverName));
    setFPath(str(cfg.path));
    setAddOpen(true);
  };

  // Build the VLESS config from the inline fields, preserving untouched keys.
  const buildInlineVlessConfig = (): Record<string, unknown> => {
    const cfg: Record<string, unknown> = { ...baseConfig };
    delete cfg.importUrl;
    cfg.address = fAddress.trim();
    cfg.port = Number(fPort) || baseConfig.port || 443;
    cfg.uuid = fUuid.trim();
    cfg.network = fNetwork;
    cfg.security = fSecurity;
    cfg.encryption = fEncryption.trim() || 'none';
    const setOpt = (k: string, v: string) => {
      if (v && v.trim()) cfg[k] = v.trim();
      else delete cfg[k];
    };
    setOpt('headerType', fHeaderType === 'none' ? '' : fHeaderType);
    setOpt('host', fHost);
    setOpt('serverName', fSni);
    setOpt('path', fPath);
    return cfg;
  };

  const onSave = async () => {
    setSaving(true);
    setError(null);

    // EDIT mode: update name + config (inline fields, or replace via pasted link).
    if (editId) {
      let config: Record<string, unknown> | undefined;
      if (protocol === 'vless') {
        config = vlessLink.trim() ? { importUrl: vlessLink.trim() } : buildInlineVlessConfig();
      } else if (protocol === 'wireguard') {
        config = wgConfig.trim() ? { importConfig: wgConfig.trim() } : undefined;
      } else {
        config = l2tpServer.trim() || l2tpUser.trim() || l2tpSecret
          ? { server: l2tpServer.trim(), username: l2tpUser.trim(), ...(l2tpSecret ? { secret: l2tpSecret } : {}) }
          : undefined;
      }
      try {
        await updateAdminOutbound(sessionToken, editId, { name: name.trim() || undefined, config });
        resetForm();
        setAddOpen(false);
        setEditId(null);
        await load();
      } catch {
        setError(s.saveError);
      } finally {
        setSaving(false);
      }
      return;
    }

    // ADD mode — subscription (fetch + expand into child outbounds).
    if (protocol === 'subscription') {
      if (!subUrl.trim()) {
        setError(s.parseError);
        setSaving(false);
        return;
      }
      try {
        await createAdminOutboundSubscription(sessionToken, { url: subUrl.trim(), name: name.trim() || undefined });
        resetForm();
        setAddOpen(false);
        await load();
      } catch {
        setError(s.subSaveError);
      } finally {
        setSaving(false);
      }
      return;
    }

    // ADD mode (import from link/config).
    let payload: CreateOutboundPayload;
    if (protocol === 'vless') {
      if (!vlessLink.trim()) {
        setError(s.parseError);
        setSaving(false);
        return;
      }
      payload = { type: 'vless-local-proxy', name: name.trim() || undefined, config: { importUrl: vlessLink.trim() } };
    } else if (protocol === 'wireguard') {
      payload = { type: 'wireguard', name: name.trim() || undefined, config: { importConfig: wgConfig.trim() } };
    } else {
      payload = {
        type: 'l2tp',
        name: name.trim() || undefined,
        config: { server: l2tpServer.trim(), username: l2tpUser.trim(), secret: l2tpSecret },
      };
    }
    try {
      await createAdminOutbound(sessionToken, payload);
      resetForm();
      setAddOpen(false);
      await load();
    } catch {
      setError(s.saveError);
    } finally {
      setSaving(false);
    }
  };

  const withBusy = async (id: string, fn: () => Promise<unknown>) => {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await fn();
    } catch {
      /* ignore */
    } finally {
      await load();
      setBusy((b) => ({ ...b, [id]: false }));
    }
  };

  const onTest = (id: string) => void withBusy(id, () => testAdminOutbound(sessionToken, id));
  const onToggleEnabled = (o: AdminOutboundSummary) =>
    void withBusy(o.id, () => updateAdminOutbound(sessionToken, o.id, { enabled: !o.enabled }));
  const onDelete = (id: string) => {
    if (window.confirm(s.deleteConfirm)) void withBusy(id, () => deleteAdminOutbound(sessionToken, id));
  };
  const onRefreshSub = (id: string) => void withBusy(`sub:${id}`, () => refreshAdminOutboundSubscription(sessionToken, id));
  const onDeleteSub = (id: string) => {
    if (window.confirm(s.subDeleteConfirm)) void withBusy(`sub:${id}`, () => deleteAdminOutboundSubscription(sessionToken, id));
  };
  const toggleExpanded = (id: string) => setExpanded((e) => ({ ...e, [id]: !(e[id] ?? true) }));
  const isExpanded = (id: string) => expanded[id] ?? true; // expanded by default
  const onSyncAll = async () => {
    setSyncing(true);
    setNotice(null);
    try {
      const r = await testAllAdminOutbounds(sessionToken);
      setNotice(s.syncQueued.replace('{n}', String(r.requested)));
      await load();
    } catch {
      setNotice(s.syncError);
    } finally {
      setSyncing(false);
    }
  };
  const onToggleAuto = async () => {
    const next = !auto;
    setAuto(next);
    try {
      await setAdminOutboundTestSettings(sessionToken, next);
    } catch {
      setAuto(!next);
    }
  };

  const fmt = (v?: number | null, unit = '') => (v == null ? '—' : `${Math.round(v)}${unit}`);
  const statusTone = (st: string) =>
    st === 'healthy' || st === 'up' ? '#1f9d57' : st === 'unknown' || st === '' ? '#9aa7ad' : '#d23f3f';
  const statusLabel = (st: string) =>
    st === 'healthy' || st === 'up' ? s.statusUp : st === 'unknown' || st === '' ? s.statusUnknown : s.statusDown;

  const fmtBytes = (n?: number) => {
    if (!n || n <= 0) return '0';
    const gb = n / 1e9;
    return gb >= 1000 ? `${(gb / 1000).toFixed(2)} TB` : `${gb.toFixed(1)} GB`;
  };
  const fmtExpire = (sec?: number) => {
    if (!sec) return '—';
    const days = Math.round((sec * 1000 - Date.now()) / 86_400_000);
    return days >= 0 ? `${days}d` : s.subExpired;
  };

  // Group child configs under their subscription; everything else is standalone.
  const childrenBySub = new Map<string, AdminOutboundSummary[]>();
  const standalone: AdminOutboundSummary[] = [];
  for (const o of rows) {
    if (o.subscriptionId) {
      const arr = childrenBySub.get(o.subscriptionId) ?? [];
      arr.push(o);
      childrenBySub.set(o.subscriptionId, arr);
    } else {
      standalone.push(o);
    }
  }

  const renderRow = (o: AdminOutboundSummary, isChild = false) => {
    const testing = busy[o.id] || !!o.pendingTest;
    return (
      <tr key={o.id} className="border-b border-[#eef2f4] last:border-0">
        <td className={`px-4 py-3 font-bold text-afro-ink ${isChild ? 'pl-10' : ''}`}>{o.name}</td>
        <td className="px-3 py-3 uppercase text-afro-muted">{o.type}</td>
        <td className="px-3 py-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: statusTone(o.healthStatus) }} />
            {statusLabel(o.healthStatus)}
          </span>
        </td>
        <td className={`px-3 py-3 text-afro-ink ${o.pendingTest ? 'opacity-50' : ''}`}>{fmt(o.latestLatencyMs, ' ms')}</td>
        <td className={`px-3 py-3 text-afro-ink ${o.pendingTest ? 'opacity-50' : ''}`}>{fmt(o.latestJitterMs, ' ms')}</td>
        <td className={`px-3 py-3 text-afro-ink ${o.pendingTest ? 'opacity-50' : ''}`}>{fmt(o.latestDownMbps, ' Mbps')}</td>
        <td className={`px-3 py-3 text-afro-ink ${o.pendingTest ? 'opacity-50' : ''}`}>{fmt(o.latestUpMbps, ' Mbps')}</td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => onTest(o.id)}
              disabled={testing}
              title={s.test}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-afro-line px-2 text-xs font-bold text-afro-ink hover:border-afro-teal hover:text-afro-teal disabled:opacity-50"
            >
              {testing ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
              {testing ? s.testing : s.test}
            </button>
            <button
              type="button"
              onClick={() => openEdit(o)}
              disabled={busy[o.id]}
              title={s.edit}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-afro-line text-afro-muted hover:border-afro-teal hover:text-afro-teal disabled:opacity-50"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => onToggleEnabled(o)}
              disabled={busy[o.id]}
              title={o.enabled ? s.disable : s.enable}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-afro-line text-afro-muted hover:text-afro-ink disabled:opacity-50"
            >
              <Power size={14} className={o.enabled ? 'text-afro-teal' : ''} />
            </button>
            {isChild ? null : (
              <button
                type="button"
                onClick={() => onDelete(o.id)}
                disabled={busy[o.id]}
                title={s.delete}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-afro-line text-afro-muted hover:border-[#e0b4b4] hover:text-[#b91c1c] disabled:opacity-50"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <section className="grid gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onToggleAuto}
          className={`inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-sm font-bold ${
            auto ? 'border-afro-teal bg-[#e6f6f4] text-afro-teal' : 'border-afro-line text-afro-muted'
          }`}
          title={auto ? s.autoHint : s.manualHint}
        >
          <span className={`inline-block h-2 w-2 rounded-full ${auto ? 'bg-afro-teal' : 'bg-[#c2cdd2]'}`} />
          {s.auto}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void onSyncAll()}
            disabled={syncing}
            className="inline-flex min-h-9 items-center gap-2 rounded-md border border-afro-line px-3 text-sm font-bold text-afro-ink hover:border-afro-teal hover:text-afro-teal disabled:opacity-60"
          >
            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
            {s.syncNow}
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !(addOpen && !editId);
              resetForm();
              setEditId(null);
              setProtocol('vless');
              setAddOpen(next);
            }}
            className="inline-flex min-h-9 items-center gap-2 rounded-md bg-afro-sidebar px-3 text-sm font-bold text-white hover:bg-[#1f3138]"
          >
            <Plus size={15} />
            {s.addButton}
          </button>
        </div>
      </div>

      {notice ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-afro-line bg-[#eef7f6] px-3 py-2 text-[13px] font-bold text-afro-teal">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-afro-muted hover:text-afro-ink">
            <X size={14} />
          </button>
        </div>
      ) : null}

      {/* Add panel */}
      {addOpen ? (
        <div className="rounded-md border border-afro-line bg-afro-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-afro-ink">{editId ? s.editTitle : s.addTitle}</h2>
            <button
              type="button"
              onClick={() => {
                setAddOpen(false);
                setEditId(null);
              }}
              className="text-afro-muted hover:text-afro-ink"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-[13px] font-bold text-afro-muted">{s.protocol}</span>
              <select
                value={protocol}
                onChange={(e) => setProtocol(e.target.value as Protocol)}
                disabled={!!editId}
                className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm font-bold outline-none focus:border-afro-teal disabled:opacity-60"
              >
                <option value="vless">VLESS</option>
                <option value="wireguard">WireGuard</option>
                <option value="l2tp">L2TP</option>
                {!editId ? <option value="subscription">{s.subscriptionOption}</option> : null}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-[13px] font-bold text-afro-muted">{s.name}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm outline-none focus:border-afro-teal"
              />
            </label>
          </div>

          {protocol === 'vless' ? (
            <>
              {editId ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-[13px] font-bold text-afro-muted">{s.fldAddress}</span>
                    <input value={fAddress} onChange={(e) => setFAddress(e.target.value)} dir="ltr" className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm outline-none focus:border-afro-teal" />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[13px] font-bold text-afro-muted">{s.fldPort}</span>
                    <input value={fPort} onChange={(e) => setFPort(e.target.value)} dir="ltr" inputMode="numeric" className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm outline-none focus:border-afro-teal" />
                  </label>
                  <label className="grid gap-1.5 md:col-span-2">
                    <span className="text-[13px] font-bold text-afro-muted">{s.fldUuid}</span>
                    <input value={fUuid} onChange={(e) => setFUuid(e.target.value)} dir="ltr" className="min-h-10 rounded-md border border-afro-line bg-white px-3 font-mono text-xs outline-none focus:border-afro-teal" />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[13px] font-bold text-afro-muted">{s.fldNetwork}</span>
                    <select value={fNetwork} onChange={(e) => setFNetwork(e.target.value)} className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm outline-none focus:border-afro-teal">
                      {['tcp', 'ws', 'grpc', 'h2', 'quic'].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[13px] font-bold text-afro-muted">{s.fldHeaderType}</span>
                    <select value={fHeaderType} onChange={(e) => setFHeaderType(e.target.value)} className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm outline-none focus:border-afro-teal">
                      {['none', 'http'].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[13px] font-bold text-afro-muted">{s.fldHost}</span>
                    <input value={fHost} onChange={(e) => setFHost(e.target.value)} dir="ltr" placeholder="telewebion.ir" className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm outline-none focus:border-afro-teal" />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[13px] font-bold text-afro-muted">{s.fldSecurity}</span>
                    <select value={fSecurity} onChange={(e) => setFSecurity(e.target.value)} className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm outline-none focus:border-afro-teal">
                      {['none', 'tls', 'reality'].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[13px] font-bold text-afro-muted">{s.fldSni}</span>
                    <input value={fSni} onChange={(e) => setFSni(e.target.value)} dir="ltr" className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm outline-none focus:border-afro-teal" />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[13px] font-bold text-afro-muted">{s.fldPath}</span>
                    <input value={fPath} onChange={(e) => setFPath(e.target.value)} dir="ltr" placeholder="/afrowsws" className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm outline-none focus:border-afro-teal" />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[13px] font-bold text-afro-muted">{s.fldEncryption}</span>
                    <input value={fEncryption} onChange={(e) => setFEncryption(e.target.value)} dir="ltr" className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm outline-none focus:border-afro-teal" />
                  </label>
                </div>
              ) : null}
              <label className="mt-3 grid gap-1.5">
                <span className="text-[13px] font-bold text-afro-muted">{editId ? s.replaceLink : s.vlessLink}</span>
                <textarea
                  value={vlessLink}
                  onChange={(e) => setVlessLink(e.target.value)}
                  rows={3}
                  dir="ltr"
                  placeholder="vless://..."
                  className="rounded-md border border-afro-line bg-white px-3 py-2 font-mono text-xs outline-none focus:border-afro-teal"
                />
                <span className="text-[12px] text-afro-muted">{editId ? s.replaceHint : s.vlessHint}</span>
              </label>
            </>
          ) : protocol === 'wireguard' ? (
            <label className="mt-3 grid gap-1.5">
              <span className="text-[13px] font-bold text-afro-muted">{s.wireguardConfig}</span>
              <textarea
                value={wgConfig}
                onChange={(e) => setWgConfig(e.target.value)}
                rows={5}
                dir="ltr"
                placeholder="[Interface]..."
                className="rounded-md border border-afro-line bg-white px-3 py-2 font-mono text-xs outline-none focus:border-afro-teal"
              />
            </label>
          ) : protocol === 'subscription' ? (
            <label className="mt-3 grid gap-1.5">
              <span className="text-[13px] font-bold text-afro-muted">{s.subscriptionUrl}</span>
              <textarea
                value={subUrl}
                onChange={(e) => setSubUrl(e.target.value)}
                rows={2}
                dir="ltr"
                placeholder="https://.../sub/..."
                className="rounded-md border border-afro-line bg-white px-3 py-2 font-mono text-xs outline-none focus:border-afro-teal"
              />
              <span className="text-[12px] text-afro-muted">{s.subscriptionHint}</span>
            </label>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="grid gap-1.5">
                <span className="text-[13px] font-bold text-afro-muted">{s.l2tpServer}</span>
                <input value={l2tpServer} onChange={(e) => setL2tpServer(e.target.value)} dir="ltr" className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm outline-none focus:border-afro-teal" />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[13px] font-bold text-afro-muted">{s.l2tpUsername}</span>
                <input value={l2tpUser} onChange={(e) => setL2tpUser(e.target.value)} dir="ltr" className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm outline-none focus:border-afro-teal" />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[13px] font-bold text-afro-muted">{s.l2tpSecret}</span>
                <input value={l2tpSecret} onChange={(e) => setL2tpSecret(e.target.value)} type="password" dir="ltr" className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm outline-none focus:border-afro-teal" />
              </label>
            </div>
          )}

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
              onClick={() => {
                setAddOpen(false);
                setEditId(null);
              }}
              className="inline-flex min-h-10 items-center rounded-md border border-afro-line px-4 text-sm font-bold text-afro-muted"
            >
              {s.cancel}
            </button>
          </div>
        </div>
      ) : null}

      {/* Table */}
      <div className="overflow-x-auto rounded-md border border-afro-line bg-afro-panel">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-afro-line text-left text-[12px] uppercase tracking-wide text-afro-muted">
              <th className="px-4 py-3 font-bold">{s.colName}</th>
              <th className="px-3 py-3 font-bold">{s.colType}</th>
              <th className="px-3 py-3 font-bold">{s.colStatus}</th>
              <th className="px-3 py-3 font-bold">{s.colPing}</th>
              <th className="px-3 py-3 font-bold">{s.colJitter}</th>
              <th className="px-3 py-3 font-bold">{s.colDown}</th>
              <th className="px-3 py-3 font-bold">{s.colUp}</th>
              <th className="px-4 py-3 text-right font-bold">{s.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && subs.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-afro-muted">
                  {s.empty}
                </td>
              </tr>
            ) : (
              <>
                {subs.map((sub) => {
                  const kids = childrenBySub.get(sub.id) ?? [];
                  const used = (sub.userInfo.upload ?? 0) + (sub.userInfo.download ?? 0);
                  const open = isExpanded(sub.id);
                  const subBusy = busy[`sub:${sub.id}`];
                  return (
                    <Fragment key={sub.id}>
                      <tr className="border-b border-afro-line bg-[#f1f6f6]">
                        <td colSpan={7} className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(sub.id)}
                            className="inline-flex items-center gap-2 text-left font-bold text-afro-ink"
                          >
                            {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            {sub.name}
                            <span className="text-[12px] font-normal text-afro-muted">
                              {' · '}
                              {kids.length} {s.subConfigs}
                              {sub.userInfo.total ? ` · ${fmtBytes(used)} / ${fmtBytes(sub.userInfo.total)}` : ''}
                              {sub.userInfo.expire ? ` · ${s.subExpires} ${fmtExpire(sub.userInfo.expire)}` : ''}
                              {sub.lastStatus === 'error' ? ` · ⚠ ${sub.lastError ?? ''}` : ''}
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onRefreshSub(sub.id)}
                              disabled={subBusy}
                              title={s.subRefresh}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-afro-line text-afro-muted hover:border-afro-teal hover:text-afro-teal disabled:opacity-50"
                            >
                              <RefreshCw size={14} className={subBusy ? 'animate-spin' : ''} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteSub(sub.id)}
                              disabled={subBusy}
                              title={s.subDelete}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-afro-line text-afro-muted hover:border-[#e0b4b4] hover:text-[#b91c1c] disabled:opacity-50"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {open ? kids.map((o) => renderRow(o, true)) : null}
                      {open && kids.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-4 pl-10 text-[13px] text-afro-muted">
                            {s.subEmpty}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
                {standalone.map((o) => renderRow(o, false))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
