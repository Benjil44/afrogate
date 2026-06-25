import { useCallback, useEffect, useState } from 'react';
import { ClipboardCopy, ExternalLink, Eye, KeyRound, Pencil, Plus, RefreshCw, Router as RouterIcon, Trash2, X } from 'lucide-react';
import type {
  AdminCustomerAccountSummary,
  AdminRouterUsageChartsResponse,
  CreateMikroTikRouterRequest,
  MikroTikRouterKind,
  MikroTikRouterRole,
  MikroTikRouterStatus,
  MikroTikRouterSummary,
  MikroTikWgUsage,
} from '@afrows/shared';
import type { DashboardStrings } from '../i18n';
import { EChart, type AfroChartOption } from '../components/EChart';
import {
  createRouter,
  deleteRouter,
  fetchRouterConnectConfig,
  fetchRouterCredential,
  fetchRouterStatus,
  fetchRouterUsageCharts,
  fetchRouterWgUsage,
  fetchRouters,
  fetchAdminCustomerAccounts,
  reconnectRouterModem,
  rotateRouterPassword,
  setRouterEgress,
  setRouterMode,
  setRouterWgRate,
  updateRouter,
} from '../api/admin';

function clientStrongPassword(): string {
  const bytes = new Uint8Array(40);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/[^A-Za-z0-9]/g, '').slice(0, 28);
}

const POLL_MS = 20000;
const KINDS: MikroTikRouterKind[] = ['village', 'home', 'other'];

interface DraftForm {
  id: string;
  label: string;
  kind: MikroTikRouterKind;
  host: string;
  restPort: string;
  restUser: string;
  password: string;
  webfigUrl: string;
  gamingSourceIp: string;
  notes: string;
  role: MikroTikRouterRole;
  customerAccountId: string; // '' = unassigned
}

const emptyDraft: DraftForm = {
  id: '',
  label: '',
  kind: 'other',
  host: '',
  restPort: '80',
  restUser: 'claude',
  password: '',
  webfigUrl: '',
  gamingSourceIp: '',
  notes: '',
  role: 'gateway',
  customerAccountId: '',
};

function formatBytes(value: number | null | undefined): string {
  if (value == null) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let n = value;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatCost(cost: number | null | undefined, currency: string | null | undefined): string {
  if (cost == null) return '—';
  return `${Math.round(cost).toLocaleString()} ${currency ?? 'IRT'}`;
}

function barOption(points: { label: string; bytes: number }[], color: string): AfroChartOption {
  return {
    grid: { left: 46, right: 10, top: 14, bottom: 24 },
    tooltip: { trigger: 'axis', valueFormatter: (v) => `${Number(v).toFixed(2)} GB` },
    xAxis: { type: 'category', data: points.map((p) => p.label), axisLabel: { fontSize: 9 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 9, formatter: '{value} GB' } },
    series: [
      {
        type: 'bar',
        data: points.map((p) => Number((p.bytes / 1e9).toFixed(3))),
        itemStyle: { color, borderRadius: [3, 3, 0, 0] },
      },
    ],
  };
}

const cardClass = 'rounded-lg border border-afro-line bg-white p-4 shadow-sm';
const btnClass =
  'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-afro-line px-3 text-sm font-bold text-afro-ink hover:border-afro-blue hover:text-afro-blue disabled:opacity-50';
const primaryBtnClass =
  'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md bg-afro-blue px-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50';

export function MicrotiksPage({ roleFilter, sessionToken, t }: { roleFilter?: MikroTikRouterRole; sessionToken: string; t: DashboardStrings }) {
  void t;
  const [rows, setRows] = useState<MikroTikRouterSummary[]>([]);
  const visibleRows = roleFilter ? rows.filter((router) => router.role === roleFilter) : rows;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftForm>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [statusFor, setStatusFor] = useState<string | null>(null);
  const [status, setStatus] = useState<MikroTikRouterStatus | null>(null);
  const [usage, setUsage] = useState<MikroTikWgUsage[] | null>(null);
  const [modemBusy, setModemBusy] = useState<Record<string, boolean>>({});
  const [rollup, setRollup] = useState<{ router: string; rows: MikroTikWgUsage[] }[] | null>(null);
  const [rollupLoading, setRollupLoading] = useState(false);
  const [charts, setCharts] = useState<AdminRouterUsageChartsResponse | null>(null);
  const [customers, setCustomers] = useState<AdminCustomerAccountSummary[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetchRouters(sessionToken);
      setRows(res.routers);
      setError(null);
    } catch {
      setError('Could not load routers');
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    fetchRouterUsageCharts(sessionToken)
      .then((c) => setCharts(c))
      .catch(() => setCharts(null));
    fetchAdminCustomerAccounts(sessionToken)
      .then((res) => setCustomers(res.accounts ?? []))
      .catch(() => setCustomers([]));
  }, [sessionToken]);

  const openAdd = () => {
    setEditId(null);
    setDraft({ ...emptyDraft, role: roleFilter ?? emptyDraft.role });
    setStatus(null);
    setStatusFor(null);
    setDialogOpen(true);
  };

  const openEdit = (router: MikroTikRouterSummary) => {
    setEditId(router.id);
    setDraft({
      id: router.id,
      label: router.label,
      kind: router.kind,
      host: router.host,
      restPort: String(router.restPort),
      restUser: router.restUser,
      password: '',
      webfigUrl: router.webfigUrl ?? '',
      gamingSourceIp: router.gamingSourceIp ?? '',
      notes: router.notes ?? '',
      role: router.role,
      customerAccountId: router.customerAccountId ?? '',
    });
    setStatus(null);
    setDialogOpen(true);
    void loadStatus(router.id);
  };

  const loadStatus = useCallback(
    async (id: string) => {
      setStatusFor(id);
      setStatus(null);
      setUsage(null);
      try {
        const [s, u] = await Promise.all([
          fetchRouterStatus(sessionToken, id),
          fetchRouterWgUsage(sessionToken, id, 30).catch(() => ({ windowDays: 30, usage: [] })),
        ]);
        setStatus(s.status);
        setUsage(u.usage);
      } catch {
        setStatus(null);
      }
    },
    [sessionToken],
  );

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (editId) {
        await updateRouter(sessionToken, editId, {
          label: draft.label,
          kind: draft.kind,
          host: draft.host,
          restPort: Number(draft.restPort) || 80,
          restUser: draft.restUser,
          ...(draft.password ? { password: draft.password } : {}),
          webfigUrl: draft.webfigUrl || null,
          gamingSourceIp: draft.gamingSourceIp || null,
          notes: draft.notes || null,
          role: draft.role,
          customerAccountId: draft.role === 'gateway' ? (draft.customerAccountId || null) : null,
        });
        setNotice(`Updated ${draft.label}`);
        setDialogOpen(false);
        await load();
      } else {
        const payload: CreateMikroTikRouterRequest = {
          id: draft.id,
          label: draft.label,
          kind: draft.kind,
          host: draft.host,
          restPort: Number(draft.restPort) || 80,
          restUser: draft.restUser,
          password: draft.password || null,
          webfigUrl: draft.webfigUrl || null,
          gamingSourceIp: draft.gamingSourceIp || null,
          notes: draft.notes || null,
          role: draft.role,
          customerAccountId: draft.role === 'gateway' ? (draft.customerAccountId || null) : null,
        };
        const res = await createRouter(sessionToken, payload);
        setNotice(`Added ${draft.label} — now copy the connect config below and paste it into the MikroTik terminal`);
        await load();
        // Keep the dialog open and switch into the saved router so the connect-config
        // button (which needs a persisted router) is available right away.
        setEditId(res.router.id);
        void loadStatus(res.router.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (router: MikroTikRouterSummary) => {
    if (!window.confirm(`Remove ${router.label}? This only deletes it from the panel.`)) return;
    setBusy((b) => ({ ...b, [router.id]: true }));
    try {
      await deleteRouter(sessionToken, router.id);
      setNotice(`Removed ${router.label}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy((b) => ({ ...b, [router.id]: false }));
    }
  };

  const setRate = async (peerKey: string, pricePerGb: number, label: string | null) => {
    if (!editId) return;
    try {
      const res = await setRouterWgRate(sessionToken, editId, { peerKey, pricePerGb, label });
      setUsage(res.usage);
      setNotice('Rate saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save rate');
    }
  };

  const loadRollup = async () => {
    setRollupLoading(true);
    try {
      const results = await Promise.all(
        visibleRows.map(async (r) => ({
          router: r.label,
          rows: (await fetchRouterWgUsage(sessionToken, r.id, 30).catch(() => ({ usage: [] as MikroTikWgUsage[] }))).usage,
        })),
      );
      setRollup(results.filter((r) => r.rows.length));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load usage');
    } finally {
      setRollupLoading(false);
    }
  };

  const showPassword = async () => {
    if (!editId) return;
    try {
      const res = await fetchRouterCredential(sessionToken, editId);
      setDraft((d) => ({ ...d, password: res.password ?? '' }));
      setNotice('Stored password revealed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reveal password');
    }
  };

  const generatePassword = async () => {
    if (!editId) {
      setDraft((d) => ({ ...d, password: clientStrongPassword() }));
      return;
    }
    setSaving(true);
    try {
      const res = await rotateRouterPassword(sessionToken, editId);
      setDraft((d) => ({ ...d, password: res.password ?? '' }));
      setNotice('New strong password generated and applied to the router');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rotate password');
    } finally {
      setSaving(false);
    }
  };

  const copyConnectConfig = async () => {
    if (!editId) return;
    try {
      const res = await fetchRouterConnectConfig(sessionToken, editId);
      await navigator.clipboard.writeText(res.script);
      setNotice('Connect config copied — paste it into the MikroTik terminal');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build connect config');
    }
  };

  const toggleEgress = async (router: MikroTikRouterSummary) => {
    const next = !router.egressEnabled;
    setBusy((b) => ({ ...b, [router.id]: true }));
    setRows((prev) => prev.map((r) => (r.id === router.id ? { ...r, egressEnabled: next } : r)));
    try {
      await setRouterEgress(sessionToken, router.id, next);
      setNotice(`${router.label}: Afrows internet ${next ? 'ON' : 'OFF (local)'}`);
    } catch (err) {
      setRows((prev) => prev.map((r) => (r.id === router.id ? { ...r, egressEnabled: router.egressEnabled } : r)));
      setError(err instanceof Error ? err.message : 'Egress toggle failed');
    } finally {
      setBusy((b) => ({ ...b, [router.id]: false }));
    }
  };

  const reconnectModem = async (iface: string) => {
    if (!editId) return;
    setModemBusy((b) => ({ ...b, [iface]: true }));
    try {
      const res = await reconnectRouterModem(sessionToken, editId, iface);
      setNotice(res.message ?? `Reconnect sent to ${iface}`);
      await loadStatus(editId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reconnect failed');
    } finally {
      setModemBusy((b) => ({ ...b, [iface]: false }));
    }
  };

  const toggleMode = async (router: MikroTikRouterSummary) => {
    const next = router.mode === 'game' ? 'normal' : 'game';
    setBusy((b) => ({ ...b, [router.id]: true }));
    setRows((prev) => prev.map((r) => (r.id === router.id ? { ...r, mode: next } : r)));
    try {
      await setRouterMode(sessionToken, router.id, next);
      setNotice(`${router.label}: ${next === 'game' ? 'Game (Starlink)' : 'Normal'} mode`);
    } catch (err) {
      setRows((prev) => prev.map((r) => (r.id === router.id ? { ...r, mode: router.mode } : r)));
      setError(err instanceof Error ? err.message : 'Mode change failed');
    } finally {
      setBusy((b) => ({ ...b, [router.id]: false }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-afro-muted">
          Manage your MikroTik routers — status, Game/Normal egress, and full configuration.
        </p>
        <div className="flex items-center gap-2">
          <button className={btnClass} onClick={() => void load()} type="button">
            <RefreshCw size={15} /> Refresh
          </button>
          <button className={primaryBtnClass} onClick={openAdd} type="button">
            <Plus size={15} /> Add MikroTik
          </button>
        </div>
      </div>

      {error ? <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div> : null}

      {charts ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className={cardClass}>
            <div className="text-sm font-bold text-afro-ink">Data used per day — last 15 days (GB)</div>
            <EChart ariaLabel="GB used per day, last 15 days" className="mt-2 h-[220px] w-full" option={barOption(charts.daily, '#2f6f6a')} />
          </div>
          <div className={cardClass}>
            <div className="text-sm font-bold text-afro-ink">Usage by hour — last 24h (peak time, Tehran)</div>
            <EChart ariaLabel="Usage by hour, last 24 hours" className="mt-2 h-[220px] w-full" option={barOption(charts.hourly, '#b9772b')} />
          </div>
        </div>
      ) : null}

      <div className={cardClass}>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-bold text-afro-ink">WireGuard usage — all tunnels (30 days)</div>
          <button className={btnClass} disabled={rollupLoading || visibleRows.length === 0} onClick={() => void loadRollup()} type="button">
            <RefreshCw size={14} /> {rollupLoading ? 'Loading…' : rollup ? 'Refresh' : 'Load usage'}
          </button>
        </div>
        {rollup ? (
          rollup.length ? (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-afro-line text-left text-xs uppercase text-afro-muted">
                  <th className="py-1 pr-2">Router</th>
                  <th className="py-1 pr-2">Tunnel</th>
                  <th className="py-1 pr-2 text-right">↓ in</th>
                  <th className="py-1 pr-2 text-right">↑ out</th>
                  <th className="py-1 pr-2 text-right">total</th>
                  <th className="py-1 text-right">cost</th>
                </tr>
              </thead>
              <tbody>
                {rollup.flatMap((g) =>
                  g.rows.map((u) => (
                    <tr className="border-b border-afro-line/40" key={`${g.router}:${u.peerKey}`}>
                      <td className="py-1 pr-2">{g.router}</td>
                      <td className="py-1 pr-2">{u.label ?? u.iface ?? u.comment ?? u.peerKey.slice(0, 12)}</td>
                      <td className="py-1 pr-2 text-right font-mono">{formatBytes(u.rxBytes)}</td>
                      <td className="py-1 pr-2 text-right font-mono">{formatBytes(u.txBytes)}</td>
                      <td className="py-1 pr-2 text-right font-mono font-bold">{formatBytes(u.totalBytes)}</td>
                      <td className="py-1 text-right font-mono">{formatCost(u.cost, u.currency)}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          ) : (
            <div className="mt-2 text-xs text-afro-muted">No usage yet — samples accrue every ~15 min.</div>
          )
        ) : (
          <div className="mt-2 text-xs text-afro-muted">Click “Load usage” for per-tunnel data across all routers (great for billing the village tunnels).</div>
        )}
      </div>

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-afro-line text-left text-xs uppercase text-afro-muted">
              <th className="py-2 pr-3">Router</th>
              <th className="py-2 pr-3">Host</th>
              <th className="py-2 pr-3">Role</th>
              <th className="py-2 pr-3">Customer</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Mode (Game / Normal)</th>
              <th className="py-2 pr-3">Afrows internet</th>
              <th className="py-2 pr-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && visibleRows.length === 0 ? (
              <tr><td className="py-4 text-afro-muted" colSpan={8}>Loading…</td></tr>
            ) : visibleRows.length === 0 ? (
              <tr><td className="py-4 text-afro-muted" colSpan={8}>No MikroTiks yet — add one with the button above.</td></tr>
            ) : (
              visibleRows.map((router) => (
                <tr className="border-b border-afro-line/60 align-middle" key={router.id}>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2 font-bold text-afro-ink">
                      <RouterIcon size={16} /> {router.label}
                      {router.kind === 'village' ? (
                        <span className="rounded-full bg-afro-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-afro-accent" title="Critical egress hub — locked">
                          Primary
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-afro-muted">{router.kind}{router.board ? ` · ${router.board}` : ''}{router.version ? ` · ${router.version}` : ''}</div>
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs">{router.host}:{router.restPort}</td>
                  <td className="py-3 pr-3">
                    {router.role === 'transport' ? (
                      <span className="text-xs text-afro-muted">Transport</span>
                    ) : (
                      <span className="rounded bg-afro-line/40 px-1.5 py-0.5 text-xs">Gateway</span>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-xs">
                    {router.role === 'transport' ? (
                      <span className="text-afro-muted">—</span>
                    ) : router.customerDisplayName ? (
                      <span className="text-afro-ink">{router.customerDisplayName}</span>
                    ) : (
                      <span className="text-amber-500">— unassigned</span>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <span className={`inline-flex items-center gap-1.5 ${router.online ? 'text-emerald-600' : 'text-red-500'}`}>
                      <span className={`size-2 rounded-full ${router.online ? 'bg-emerald-500' : 'bg-red-400'}`} />
                      {router.online ? 'Online' : 'Offline'}
                    </span>
                    {router.uptime ? <div className="text-xs text-afro-muted">up {router.uptime}</div> : null}
                  </td>
                  <td className="py-3 pr-3">
                    {router.kind === 'village' ? (
                      <span className="text-xs font-bold text-afro-muted" title="Primary hub — mode is fixed">Locked</span>
                    ) : (
                      <ModeToggle
                        mode={router.mode}
                        disabled={Boolean(busy[router.id])}
                        onToggle={() => void toggleMode(router)}
                      />
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    {router.kind === 'village' ? (
                      <span className="text-xs font-bold text-emerald-600" title="Primary hub — always on">Always on</span>
                    ) : (
                      <OnOffToggle
                        on={router.egressEnabled}
                        disabled={Boolean(busy[router.id])}
                        onToggle={() => void toggleEgress(router)}
                      />
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button className={btnClass} onClick={() => openEdit(router)} type="button" title="Edit / details">
                        <Pencil size={14} /> Edit
                      </button>
                      {router.webfigUrl ? (
                        <a className={btnClass} href={router.webfigUrl} target="_blank" rel="noreferrer" title="Open the router's own web UI">
                          <ExternalLink size={14} /> Advanced
                        </a>
                      ) : null}
                      <button className={`${btnClass} hover:border-red-400 hover:text-red-500`} disabled={Boolean(busy[router.id]) || router.kind === 'village'} onClick={() => void remove(router)} type="button" title={router.kind === 'village' ? 'Primary hub — cannot be removed' : 'Remove from panel'}>
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

      {dialogOpen ? (
        <RouterDialog
          draft={draft}
          editId={editId}
          saving={saving}
          status={statusFor === editId ? status : null}
          usage={statusFor === editId ? usage : null}
          modemBusy={modemBusy}
          customers={customers}
          onChange={setDraft}
          onClose={() => setDialogOpen(false)}
          onCopyConfig={() => void copyConnectConfig()}
          onGeneratePassword={() => void generatePassword()}
          onReconnect={(iface) => void reconnectModem(iface)}
          onSetRate={(peerKey, price, label) => void setRate(peerKey, price, label)}
          onShowPassword={() => void showPassword()}
          onSave={() => void save()}
        />
      ) : null}
    </div>
  );
}

function ModeToggle({ mode, disabled, onToggle }: { mode: 'game' | 'normal' | null; disabled: boolean; onToggle: () => void }) {
  const isGame = mode === 'game';
  return (
    <button
      aria-pressed={isGame}
      className="inline-flex items-center gap-2 disabled:opacity-50"
      disabled={disabled}
      onClick={onToggle}
      type="button"
      title={isGame ? 'Game mode (egress via Starlink) — click for Normal' : 'Normal mode (relay pool) — click for Game'}
    >
      <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isGame ? 'bg-afro-blue' : 'bg-afro-line'}`}>
        <span className={`inline-block size-4 transform rounded-full bg-white shadow transition-transform ${isGame ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
      <span className={`text-xs font-bold ${isGame ? 'text-afro-blue' : 'text-afro-muted'}`}>{isGame ? 'Game' : 'Normal'}</span>
    </button>
  );
}

function OnOffToggle({ on, disabled, onToggle }: { on: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <button
      aria-pressed={on}
      className="inline-flex items-center gap-2 disabled:opacity-50"
      disabled={disabled}
      onClick={onToggle}
      type="button"
      title={on ? 'Clients use Afrows internet — click to turn OFF (local internet)' : 'Clients use local internet — click to route through Afrows'}
    >
      <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-afro-line'}`}>
        <span className={`inline-block size-4 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
      <span className={`text-xs font-bold ${on ? 'text-emerald-600' : 'text-afro-muted'}`}>{on ? 'On' : 'Off'}</span>
    </button>
  );
}

function RouterDialog({
  draft,
  editId,
  saving,
  status,
  usage,
  modemBusy,
  customers,
  onChange,
  onClose,
  onCopyConfig,
  onGeneratePassword,
  onReconnect,
  onSetRate,
  onShowPassword,
  onSave,
}: {
  draft: DraftForm;
  customers: AdminCustomerAccountSummary[];
  editId: string | null;
  saving: boolean;
  status: MikroTikRouterStatus | null;
  usage: MikroTikWgUsage[] | null;
  modemBusy: Record<string, boolean>;
  onChange: (d: DraftForm) => void;
  onClose: () => void;
  onCopyConfig: () => void;
  onGeneratePassword: () => void;
  onReconnect: (iface: string) => void;
  onSetRate: (peerKey: string, pricePerGb: number, label: string | null) => void;
  onShowPassword: () => void;
  onSave: () => void;
}) {
  const set = (patch: Partial<DraftForm>) => onChange({ ...draft, ...patch });
  const field = 'min-h-9 w-full rounded-md border border-afro-line px-2 text-sm';
  const labelClass = 'mb-1 block text-xs font-bold text-afro-muted';
  const [showPw, setShowPw] = useState(false);
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-afro-ink">{editId ? `Edit ${draft.label}` : 'Add MikroTik'}</h2>
          <button className="text-afro-muted hover:text-afro-ink" onClick={onClose} type="button"><X size={18} /></button>
        </div>

        {!editId ? (
          <div className="mt-3 rounded-md border border-afro-line bg-afro-bg/40 px-3 py-2 text-xs text-afro-muted">
            Afrows auto-assigns the tunnel IP, generates the WireGuard keys, and a strong password.
            Just set an ID + label, click <b>Add</b>, then <b>Copy connect config</b> and paste it into the new MikroTik terminal — that's the only step.
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {!editId ? (
            <div>
              <label className={labelClass}>ID (slug)</label>
              <input className={field} placeholder="village" value={draft.id} onChange={(e) => set({ id: e.target.value })} />
            </div>
          ) : null}
          <div>
            <label className={labelClass}>Label</label>
            <input className={field} placeholder="Village ax3" value={draft.label} onChange={(e) => set({ label: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>Kind</label>
            <select className={field} value={draft.kind} onChange={(e) => set({ kind: e.target.value as MikroTikRouterKind })}>
              {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Role</label>
            <select
              className={field}
              value={draft.role}
              disabled={draft.kind === 'village'}
              onChange={(e) => set({ role: e.target.value as MikroTikRouterRole })}
            >
              <option value="gateway">Gateway (customer)</option>
              <option value="transport">Transport (infra)</option>
            </select>
          </div>
          {draft.role === 'gateway' ? (
            <div>
              <label className={labelClass}>Customer</label>
              <select className={field} value={draft.customerAccountId} onChange={(e) => set({ customerAccountId: e.target.value })}>
                <option value="">— unassigned —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.displayName ?? c.loginEmail ?? c.id}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <label className={labelClass}>Host (tunnel IP){!editId ? ' — leave blank to auto-assign' : ''}</label>
            <input className={field} placeholder={editId ? '10.22.0.3' : 'auto-assigned by Afrows'} value={draft.host} onChange={(e) => set({ host: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>REST port</label>
            <input className={field} value={draft.restPort} onChange={(e) => set({ restPort: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>REST user</label>
            <input className={field} value={draft.restUser} onChange={(e) => set({ restUser: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>Password</label>
            <div className="flex items-center gap-1">
              <input className={field} type={showPw ? 'text' : 'password'} placeholder={editId ? '(blank = keep)' : ''} value={draft.password} onChange={(e) => set({ password: e.target.value })} />
              <button className={`${btnClass} min-h-9 px-2`} onClick={() => setShowPw((v) => !v)} type="button" title={showPw ? 'Hide' : 'Show typed'}><Eye size={14} /></button>
              <button className={`${btnClass} min-h-9 px-2`} onClick={onGeneratePassword} type="button" title={editId ? 'Generate + apply a strong password to the router' : 'Generate a strong password'}><KeyRound size={14} /></button>
            </div>
            {editId ? (
              <button className="mt-1 text-xs font-bold text-afro-blue hover:underline" onClick={onShowPassword} type="button">Reveal stored password</button>
            ) : null}
          </div>
          <div>
            <label className={labelClass}>WebFig URL (Advanced button)</label>
            <input className={field} placeholder="https://afrows.com/router/village/" value={draft.webfigUrl} onChange={(e) => set({ webfigUrl: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>Gaming source IP (for Game mode)</label>
            <input className={field} placeholder="10.7.0.2" value={draft.gamingSourceIp} onChange={(e) => set({ gamingSourceIp: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Notes</label>
            <input className={field} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
          </div>
        </div>

        {editId ? (
          <div className="mt-4 rounded-md border border-afro-line bg-afro-bg/40 p-3">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button className={btnClass} onClick={onCopyConfig} type="button" title="Copy a RouterOS script to paste into the MikroTik terminal to connect it to Afrows">
                <ClipboardCopy size={14} /> Copy connect config
              </button>
              {draft.webfigUrl ? (
                <a className={btnClass} href={draft.webfigUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} /> Open WebFig (Advanced)
                </a>
              ) : null}
            </div>
            <div className="mb-2 text-xs font-bold uppercase text-afro-muted">Live status</div>
            {!status ? (
              <div className="text-sm text-afro-muted">Loading status…</div>
            ) : status.error ? (
              <div className="text-sm text-red-600">{status.error}</div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="text-afro-ink">
                  {status.identity ?? status.label} · {status.board ?? '—'} · {status.version ?? '—'} · up {status.uptime ?? '—'} · CPU {status.cpuLoad ?? 0}%
                </div>
                {status.wans.length ? (
                  <div>
                    <div className="mb-1 text-xs font-bold text-afro-muted">Modems / WANs</div>
                    <table className="w-full text-xs">
                      <tbody>
                        {status.wans.map((w) => (
                          <tr className="border-b border-afro-line/40" key={w.name}>
                            <td className="py-1 pr-2">
                              <span className={w.running ? 'text-emerald-600' : 'text-red-500'}>●</span> {w.name}
                            </td>
                            <td className="py-1 pr-2 font-mono">{w.sim ?? (w.comment ?? '')}</td>
                            <td className="py-1 pr-2 font-mono text-afro-muted">{w.address ?? '—'}</td>
                            <td className="py-1 text-right">
                              <button
                                className={`${btnClass} min-h-7 px-2 py-0`}
                                disabled={Boolean(modemBusy[w.name])}
                                onClick={() => onReconnect(w.name)}
                                title="Renew this WAN link (a full power reboot needs the modem's own login)"
                                type="button"
                              >
                                <RefreshCw size={12} /> {modemBusy[w.name] ? '…' : 'Reconnect'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {status.wgPeers.length ? (
                  <div>
                    <div className="text-xs font-bold text-afro-muted">WireGuard peers</div>
                    {status.wgPeers.map((p) => (
                      <div className="font-mono text-xs" key={p.interfaceName + (p.endpoint ?? '')}>
                        {p.interfaceName} → {p.endpoint ?? '—'} · hs {p.lastHandshakeSeconds != null ? `${p.lastHandshakeSeconds}s` : '—'} · ↓{formatBytes(p.rxBytes)} ↑{formatBytes(p.txBytes)}
                      </div>
                    ))}
                  </div>
                ) : null}
                {usage && usage.length ? (
                  <div>
                    <div className="mb-1 text-xs font-bold text-afro-muted">WireGuard usage + billing (last 30 days)</div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-afro-muted">
                          <th className="py-1 pr-2">Tunnel</th>
                          <th className="py-1 pr-2 text-right">total</th>
                          <th className="py-1 pr-2 text-right">price/GB</th>
                          <th className="py-1 pr-2 text-right">cost</th>
                          <th className="py-1"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {usage.map((u) => {
                          const inputVal = rateInputs[u.peerKey] ?? (u.pricePerGb != null ? String(u.pricePerGb) : '');
                          return (
                            <tr className="border-b border-afro-line/40" key={u.peerKey}>
                              <td className="py-1 pr-2">{u.label ?? u.iface ?? u.comment ?? u.peerKey.slice(0, 12)}</td>
                              <td className="py-1 pr-2 text-right font-mono font-bold">{formatBytes(u.totalBytes)}</td>
                              <td className="py-1 pr-2 text-right">
                                <input
                                  className="w-20 rounded border border-afro-line px-1 text-right text-xs"
                                  inputMode="decimal"
                                  value={inputVal}
                                  onChange={(e) => setRateInputs((m) => ({ ...m, [u.peerKey]: e.target.value }))}
                                />
                              </td>
                              <td className="py-1 pr-2 text-right font-mono">{formatCost(u.cost, u.currency)}</td>
                              <td className="py-1 text-right">
                                <button
                                  className={`${btnClass} min-h-7 px-2 py-0`}
                                  onClick={() => onSetRate(u.peerKey, Number(inputVal) || 0, u.label ?? u.comment ?? null)}
                                  type="button"
                                >
                                  Save
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="mt-1 text-[11px] text-afro-muted">Set a price per GB per tunnel → cost = usage × rate. Default currency IRT.</div>
                  </div>
                ) : usage ? (
                  <div className="text-xs text-afro-muted">No usage samples yet — they accrue every ~15 min.</div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button className={btnClass} onClick={onClose} type="button">Cancel</button>
          <button className={primaryBtnClass} disabled={saving || !draft.label || (!editId && !draft.id)} onClick={onSave} type="button">
            {saving ? 'Saving…' : editId ? 'Save changes' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
