import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2, Zap, Power, X } from 'lucide-react';
import type { AdminOutboundSummary } from '@afrows/shared';
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
  type CreateOutboundPayload,
} from '../api/admin';

type Protocol = 'vless' | 'wireguard' | 'l2tp';

const POLL_MS = 20000;

export function OutboundsPage({ sessionToken, t }: { sessionToken: string; t: DashboardStrings }) {
  const s = t.outboundsPage;
  const [rows, setRows] = useState<AdminOutboundSummary[]>([]);
  const [auto, setAuto] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [protocol, setProtocol] = useState<Protocol>('vless');
  const [name, setName] = useState('');
  const [vlessLink, setVlessLink] = useState('');
  const [wgConfig, setWgConfig] = useState('');
  const [l2tpServer, setL2tpServer] = useState('');
  const [l2tpUser, setL2tpUser] = useState('');
  const [l2tpSecret, setL2tpSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetchAdminOutbounds(sessionToken);
      setRows(res.outbounds);
    } catch {
      /* keep last data on transient failure */
    }
  }, [sessionToken]);

  useEffect(() => {
    void load();
    fetchAdminOutboundTestSettings(sessionToken)
      .then((st) => setAuto(st.enabled))
      .catch(() => {});
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load, sessionToken]);

  const resetForm = () => {
    setVlessLink('');
    setWgConfig('');
    setL2tpServer('');
    setL2tpUser('');
    setL2tpSecret('');
    setName('');
    setError(null);
  };

  const onSave = async () => {
    setSaving(true);
    setError(null);
    let payload: CreateOutboundPayload;
    if (protocol === 'vless') {
      if (!vlessLink.trim()) {
        setError(s.parseError);
        setSaving(false);
        return;
      }
      payload = { type: 'vless', name: name.trim() || undefined, config: { importUrl: vlessLink.trim() } };
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
  const onSyncAll = () => {
    void testAllAdminOutbounds(sessionToken).then(() => load()).catch(() => {});
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
            onClick={onSyncAll}
            className="inline-flex min-h-9 items-center gap-2 rounded-md border border-afro-line px-3 text-sm font-bold text-afro-ink hover:border-afro-teal hover:text-afro-teal"
          >
            <RefreshCw size={15} />
            {s.syncNow}
          </button>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setAddOpen((o) => !o);
            }}
            className="inline-flex min-h-9 items-center gap-2 rounded-md bg-afro-sidebar px-3 text-sm font-bold text-white hover:bg-[#1f3138]"
          >
            <Plus size={15} />
            {s.addButton}
          </button>
        </div>
      </div>

      {/* Add panel */}
      {addOpen ? (
        <div className="rounded-md border border-afro-line bg-afro-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-afro-ink">{s.addTitle}</h2>
            <button type="button" onClick={() => setAddOpen(false)} className="text-afro-muted hover:text-afro-ink">
              <X size={16} />
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-[13px] font-bold text-afro-muted">{s.protocol}</span>
              <select
                value={protocol}
                onChange={(e) => setProtocol(e.target.value as Protocol)}
                className="min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm font-bold outline-none focus:border-afro-teal"
              >
                <option value="vless">VLESS</option>
                <option value="wireguard">WireGuard</option>
                <option value="l2tp">L2TP</option>
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
            <label className="mt-3 grid gap-1.5">
              <span className="text-[13px] font-bold text-afro-muted">{s.vlessLink}</span>
              <textarea
                value={vlessLink}
                onChange={(e) => setVlessLink(e.target.value)}
                rows={3}
                dir="ltr"
                placeholder="vless://..."
                className="rounded-md border border-afro-line bg-white px-3 py-2 font-mono text-xs outline-none focus:border-afro-teal"
              />
              <span className="text-[12px] text-afro-muted">{s.vlessHint}</span>
            </label>
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
              onClick={() => setAddOpen(false)}
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
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-afro-muted">
                  {s.empty}
                </td>
              </tr>
            ) : (
              rows.map((o) => (
                <tr key={o.id} className="border-b border-[#eef2f4] last:border-0">
                  <td className="px-4 py-3 font-bold text-afro-ink">{o.name}</td>
                  <td className="px-3 py-3 uppercase text-afro-muted">{o.type}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: statusTone(o.healthStatus) }} />
                      {statusLabel(o.healthStatus)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-afro-ink">{fmt(o.latestLatencyMs, ' ms')}</td>
                  <td className="px-3 py-3 text-afro-ink">{fmt(o.latestJitterMs, ' ms')}</td>
                  <td className="px-3 py-3 text-afro-ink">{fmt(o.latestDownMbps, ' Mbps')}</td>
                  <td className="px-3 py-3 text-afro-ink">{fmt(o.latestUpMbps, ' Mbps')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onTest(o.id)}
                        disabled={busy[o.id]}
                        title={s.test}
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-afro-line px-2 text-xs font-bold text-afro-ink hover:border-afro-teal hover:text-afro-teal disabled:opacity-50"
                      >
                        <Zap size={14} />
                        {busy[o.id] ? s.testing : s.test}
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
                      <button
                        type="button"
                        onClick={() => onDelete(o.id)}
                        disabled={busy[o.id]}
                        title={s.delete}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-afro-line text-afro-muted hover:border-[#e0b4b4] hover:text-[#b91c1c] disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
