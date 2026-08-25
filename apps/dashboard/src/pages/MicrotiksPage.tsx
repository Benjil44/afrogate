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
  // Decimal units (1 GB = 1e9 bytes) — matches Afrows quota math everywhere.
  while (n >= 1000 && i < units.length - 1) {
    n /= 1000;
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

export function MicrotiksPage({ customerAccountId, roleFilter, sessionToken, t }: { customerAccountId?: string; roleFilter?: MikroTikRouterRole; sessionToken: string; t: DashboardStrings }) {
  const s = t.microtiksPage;
  const [rows, setRows] = useState<MikroTikRouterSummary[]>([]);
  const visibleRows = rows.filter((router) =>
    (roleFilter ? router.role === roleFilter : true) &&
    (customerAccountId ? router.customerAccountId === customerAccountId : true),
  );
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
      setError(s.loadError);
    } finally {
      setLoading(false);
    }
  }, [s.loadError, sessionToken]);

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
        setNotice(s.updatedNotice(draft.label));
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
        setNotice(s.addedNotice(draft.label));
        await load();
        // Keep the dialog open and switch into the saved router so the connect-config
        // button (which needs a persisted router) is available right away.
        setEditId(res.router.id);
        void loadStatus(res.router.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : s.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (router: MikroTikRouterSummary) => {
    if (!window.confirm(s.removeConfirm(router.label))) return;
    setBusy((b) => ({ ...b, [router.id]: true }));
    try {
      await deleteRouter(sessionToken, router.id);
      setNotice(s.removedNotice(router.label));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : s.deleteFailed);
    } finally {
      setBusy((b) => ({ ...b, [router.id]: false }));
    }
  };

  const setRate = async (peerKey: string, pricePerGb: number, label: string | null) => {
    if (!editId) return;
    try {
      const res = await setRouterWgRate(sessionToken, editId, { peerKey, pricePerGb, label });
      setUsage(res.usage);
      setNotice(s.rateSaved);
    } catch (err) {
      setError(err instanceof Error ? err.message : s.rateSaveFailed);
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
      setError(err instanceof Error ? err.message : s.usageLoadFailed);
    } finally {
      setRollupLoading(false);
    }
  };

  const showPassword = async () => {
    if (!editId) return;
    try {
      const res = await fetchRouterCredential(sessionToken, editId);
      setDraft((d) => ({ ...d, password: res.password ?? '' }));
      setNotice(s.passwordRevealed);
    } catch (err) {
      setError(err instanceof Error ? err.message : s.passwordRevealFailed);
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
      setNotice(s.passwordRotated);
    } catch (err) {
      setError(err instanceof Error ? err.message : s.passwordRotateFailed);
    } finally {
      setSaving(false);
    }
  };

  const copyConnectConfig = async () => {
    if (!editId) return;
    try {
      const res = await fetchRouterConnectConfig(sessionToken, editId);
      await navigator.clipboard.writeText(res.script);
      setNotice(s.configCopied);
    } catch (err) {
      setError(err instanceof Error ? err.message : s.configCopyFailed);
    }
  };

  const toggleEgress = async (router: MikroTikRouterSummary) => {
    const next = !router.egressEnabled;
    setBusy((b) => ({ ...b, [router.id]: true }));
    setRows((prev) => prev.map((r) => (r.id === router.id ? { ...r, egressEnabled: next } : r)));
    try {
      await setRouterEgress(sessionToken, router.id, next);
      setNotice(s.egressNotice(router.label, next ? s.egressOnState : s.egressOffState));
    } catch (err) {
      setRows((prev) => prev.map((r) => (r.id === router.id ? { ...r, egressEnabled: router.egressEnabled } : r)));
      setError(err instanceof Error ? err.message : s.egressToggleFailed);
    } finally {
      setBusy((b) => ({ ...b, [router.id]: false }));
    }
  };

  const reconnectModem = async (iface: string) => {
    if (!editId) return;
    setModemBusy((b) => ({ ...b, [iface]: true }));
    try {
      const res = await reconnectRouterModem(sessionToken, editId, iface);
      setNotice(res.message ?? s.reconnectSent(iface));
      await loadStatus(editId);
    } catch (err) {
      setError(err instanceof Error ? err.message : s.reconnectFailed);
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
      setNotice(s.modeNotice(router.label, next === 'game' ? s.modeGameStarlink : s.normal));
    } catch (err) {
      setRows((prev) => prev.map((r) => (r.id === router.id ? { ...r, mode: router.mode } : r)));
      setError(err instanceof Error ? err.message : s.modeChangeFailed);
    } finally {
      setBusy((b) => ({ ...b, [router.id]: false }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-afro-muted">
          {s.intro}
        </p>
        <div className="flex items-center gap-2">
          <button className={btnClass} onClick={() => void load()} type="button">
            <RefreshCw size={15} /> {s.refresh}
          </button>
          <button className={primaryBtnClass} onClick={openAdd} type="button">
            <Plus size={15} /> {s.addButton}
          </button>
        </div>
      </div>

      {error ? <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div> : null}

      {charts ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className={cardClass}>
            <div className="text-sm font-bold text-afro-ink">{s.dailyChartTitle}</div>
            <EChart ariaLabel={s.dailyChartAria} className="mt-2 h-[220px] w-full" option={barOption(charts.daily, '#2f6f6a')} />
          </div>
          <div className={cardClass}>
            <div className="text-sm font-bold text-afro-ink">{s.hourlyChartTitle}</div>
            <EChart ariaLabel={s.hourlyChartAria} className="mt-2 h-[220px] w-full" option={barOption(charts.hourly, '#b9772b')} />
          </div>
        </div>
      ) : null}

      <div className={cardClass}>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-bold text-afro-ink">{s.rollupTitle}</div>
          <button className={btnClass} disabled={rollupLoading || visibleRows.length === 0} onClick={() => void loadRollup()} type="button">
            <RefreshCw size={14} /> {rollupLoading ? s.loading : rollup ? s.refresh : s.loadUsage}
          </button>
        </div>
        {rollup ? (
          rollup.length ? (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-afro-line text-start text-xs uppercase text-afro-muted">
                  <th className="py-1 pe-2 text-start">{s.colRouter}</th>
                  <th className="py-1 pe-2 text-start">{s.colTunnel}</th>
                  <th className="py-1 pe-2 text-end">{s.colIn}</th>
                  <th className="py-1 pe-2 text-end">{s.colOut}</th>
                  <th className="py-1 pe-2 text-end">{s.colTotal}</th>
                  <th className="py-1 text-end">{s.colCost}</th>
                </tr>
              </thead>
              <tbody>
                {rollup.flatMap((g) =>
                  g.rows.map((u) => (
                    <tr className="border-b border-afro-line/40" key={`${g.router}:${u.peerKey}`}>
                      <td className="py-1 pe-2">{g.router}</td>
                      <td className="py-1 pe-2">{u.label ?? u.iface ?? u.comment ?? u.peerKey.slice(0, 12)}</td>
                      <td className="py-1 pe-2 text-end font-mono" dir="ltr">{formatBytes(u.rxBytes)}</td>
                      <td className="py-1 pe-2 text-end font-mono" dir="ltr">{formatBytes(u.txBytes)}</td>
                      <td className="py-1 pe-2 text-end font-mono font-bold" dir="ltr">{formatBytes(u.totalBytes)}</td>
                      <td className="py-1 text-end font-mono" dir="ltr">{formatCost(u.cost, u.currency)}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          ) : (
            <div className="mt-2 text-xs text-afro-muted">{s.noUsageYet}</div>
          )
        ) : (
          <div className="mt-2 text-xs text-afro-muted">{s.rollupHint}</div>
        )}
      </div>

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-afro-line text-start text-xs uppercase text-afro-muted">
              <th className="py-2 pe-3 text-start">{s.colRouter}</th>
              <th className="py-2 pe-3 text-start">{s.colHost}</th>
              <th className="py-2 pe-3 text-start">{s.colRole}</th>
              <th className="py-2 pe-3 text-start">{s.colCustomer}</th>
              <th className="py-2 pe-3 text-start">{s.colStatus}</th>
              <th className="py-2 pe-3 text-start">{s.colMode}</th>
              <th className="py-2 pe-3 text-start">{s.colInternet}</th>
              <th className="py-2 pe-3 text-end">{s.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {loading && visibleRows.length === 0 ? (
              <tr><td className="py-4 text-afro-muted" colSpan={8}>{s.loading}</td></tr>
            ) : visibleRows.length === 0 ? (
              <tr><td className="py-4 text-afro-muted" colSpan={8}>{s.emptyTable}</td></tr>
            ) : (
              visibleRows.map((router) => (
                <tr className="border-b border-afro-line/60 align-middle" key={router.id}>
                  <td className="py-3 pe-3">
                    <div className="flex items-center gap-2 font-bold text-afro-ink">
                      <RouterIcon size={16} /> {router.label}
                      {router.kind === 'village' ? (
                        <span className="rounded-full bg-afro-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-afro-accent" title={s.primaryBadgeTitle}>
                          {s.primaryBadge}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-afro-muted">{router.kind}{router.board ? ` · ${router.board}` : ''}{router.version ? ` · ${router.version}` : ''}</div>
                  </td>
                  <td className="py-3 pe-3 font-mono text-xs" dir="ltr">{router.host}:{router.restPort}</td>
                  <td className="py-3 pe-3">
                    {router.role === 'transport' ? (
                      <span className="text-xs text-afro-muted">{s.roleTransport}</span>
                    ) : (
                      <span className="rounded bg-afro-line/40 px-1.5 py-0.5 text-xs">{s.roleGateway}</span>
                    )}
                  </td>
                  <td className="py-3 pe-3 text-xs">
                    {router.role === 'transport' ? (
                      <span className="text-afro-muted">—</span>
                    ) : router.customerDisplayName ? (
                      <span className="text-afro-ink">{router.customerDisplayName}</span>
                    ) : (
                      <span className="text-amber-500">{s.unassigned}</span>
                    )}
                  </td>
                  <td className="py-3 pe-3">
                    <span className={`inline-flex items-center gap-1.5 ${router.online ? 'text-emerald-600' : 'text-red-500'}`}>
                      <span className={`size-2 rounded-full ${router.online ? 'bg-emerald-500' : 'bg-red-400'}`} />
                      {router.online ? s.online : s.offline}
                    </span>
                    {router.uptime ? <div className="text-xs text-afro-muted">{s.uptime(router.uptime)}</div> : null}
                  </td>
                  <td className="py-3 pe-3">
                    {router.kind === 'village' ? (
                      <span className="text-xs font-bold text-afro-muted" title={s.modeLockedTitle}>{s.modeLocked}</span>
                    ) : (
                      <ModeToggle
                        mode={router.mode}
                        disabled={Boolean(busy[router.id])}
                        onToggle={() => void toggleMode(router)}
                        s={s}
                      />
                    )}
                  </td>
                  <td className="py-3 pe-3">
                    {router.kind === 'village' ? (
                      <span className="text-xs font-bold text-emerald-600" title={s.alwaysOnTitle}>{s.alwaysOn}</span>
                    ) : (
                      <OnOffToggle
                        on={router.egressEnabled}
                        disabled={Boolean(busy[router.id])}
                        onToggle={() => void toggleEgress(router)}
                        s={s}
                      />
                    )}
                  </td>
                  <td className="py-3 pe-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button className={btnClass} onClick={() => openEdit(router)} type="button" title={s.editActionTitle}>
                        <Pencil size={14} /> {s.edit}
                      </button>
                      {router.webfigUrl ? (
                        <a className={btnClass} href={router.webfigUrl} target="_blank" rel="noreferrer" title={s.advancedTitle}>
                          <ExternalLink size={14} /> {s.advanced}
                        </a>
                      ) : null}
                      <button className={`${btnClass} hover:border-red-400 hover:text-red-500`} disabled={Boolean(busy[router.id]) || router.kind === 'village'} onClick={() => void remove(router)} type="button" title={router.kind === 'village' ? s.removeLockedTitle : s.removeTitle}>
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
          s={s}
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

type MicrotiksStrings = DashboardStrings['microtiksPage'];

function ModeToggle({ mode, disabled, onToggle, s }: { mode: 'game' | 'normal' | null; disabled: boolean; onToggle: () => void; s: MicrotiksStrings }) {
  const isGame = mode === 'game';
  return (
    <button
      aria-pressed={isGame}
      className="inline-flex items-center gap-2 disabled:opacity-50"
      disabled={disabled}
      onClick={onToggle}
      type="button"
      title={isGame ? s.gameModeTitle : s.normalModeTitle}
    >
      <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isGame ? 'bg-afro-blue' : 'bg-afro-line'}`}>
        <span className={`inline-block size-4 transform rounded-full bg-white shadow transition-transform ${isGame ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
      <span className={`text-xs font-bold ${isGame ? 'text-afro-blue' : 'text-afro-muted'}`}>{isGame ? s.game : s.normal}</span>
    </button>
  );
}

function OnOffToggle({ on, disabled, onToggle, s }: { on: boolean; disabled: boolean; onToggle: () => void; s: MicrotiksStrings }) {
  return (
    <button
      aria-pressed={on}
      className="inline-flex items-center gap-2 disabled:opacity-50"
      disabled={disabled}
      onClick={onToggle}
      type="button"
      title={on ? s.egressOnTitle : s.egressOffTitle}
    >
      <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-afro-line'}`}>
        <span className={`inline-block size-4 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
      <span className={`text-xs font-bold ${on ? 'text-emerald-600' : 'text-afro-muted'}`}>{on ? s.on : s.off}</span>
    </button>
  );
}

function RouterDialog({
  draft,
  editId,
  s,
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
  s: MicrotiksStrings;
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
          <h2 className="text-lg font-bold text-afro-ink">{editId ? s.dialogEditTitle(draft.label) : s.addButton}</h2>
          <button className="text-afro-muted hover:text-afro-ink" onClick={onClose} type="button"><X size={18} /></button>
        </div>

        {!editId ? (
          <div className="mt-3 rounded-md border border-afro-line bg-afro-bg/40 px-3 py-2 text-xs text-afro-muted">
            {s.addIntro}
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {!editId ? (
            <div>
              <label className={labelClass}>{s.fldId}</label>
              <input className={field} dir="ltr" placeholder="village" value={draft.id} onChange={(e) => set({ id: e.target.value })} />
            </div>
          ) : null}
          <div>
            <label className={labelClass}>{s.fldLabel}</label>
            <input className={field} placeholder="Village ax3" value={draft.label} onChange={(e) => set({ label: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>{s.fldKind}</label>
            <select className={field} value={draft.kind} onChange={(e) => set({ kind: e.target.value as MikroTikRouterKind })}>
              {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>{s.fldRole}</label>
            <select
              className={field}
              value={draft.role}
              disabled={draft.kind === 'village'}
              onChange={(e) => set({ role: e.target.value as MikroTikRouterRole })}
            >
              <option value="gateway">{s.roleGatewayOption}</option>
              <option value="transport">{s.roleTransportOption}</option>
            </select>
          </div>
          {draft.role === 'gateway' ? (
            <div>
              <label className={labelClass}>{s.fldCustomer}</label>
              <select className={field} value={draft.customerAccountId} onChange={(e) => set({ customerAccountId: e.target.value })}>
                <option value="">{s.customerUnassignedOption}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.displayName ?? c.loginEmail ?? c.id}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <label className={labelClass}>{s.fldHost}{!editId ? s.fldHostAutoHint : ''}</label>
            <input className={field} dir="ltr" placeholder={editId ? '10.22.0.3' : s.hostAutoPlaceholder} value={draft.host} onChange={(e) => set({ host: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>{s.fldRestPort}</label>
            <input className={field} dir="ltr" value={draft.restPort} onChange={(e) => set({ restPort: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>{s.fldRestUser}</label>
            <input className={field} dir="ltr" value={draft.restUser} onChange={(e) => set({ restUser: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>{s.fldPassword}</label>
            <div className="flex items-center gap-1">
              <input className={field} dir="ltr" type={showPw ? 'text' : 'password'} placeholder={editId ? s.passwordKeepPlaceholder : ''} value={draft.password} onChange={(e) => set({ password: e.target.value })} />
              <button className={`${btnClass} min-h-9 px-2`} onClick={() => setShowPw((v) => !v)} type="button" title={showPw ? s.hidePassword : s.showTyped}><Eye size={14} /></button>
              <button className={`${btnClass} min-h-9 px-2`} onClick={onGeneratePassword} type="button" title={editId ? s.generateApplyTitle : s.generateTitle}><KeyRound size={14} /></button>
            </div>
            {editId ? (
              <button className="mt-1 text-xs font-bold text-afro-blue hover:underline" onClick={onShowPassword} type="button">{s.revealStored}</button>
            ) : null}
          </div>
          <div>
            <label className={labelClass}>{s.fldWebfig}</label>
            <input className={field} dir="ltr" placeholder="https://afrows.com/router/village/" value={draft.webfigUrl} onChange={(e) => set({ webfigUrl: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>{s.fldGamingIp}</label>
            <input className={field} dir="ltr" placeholder="10.7.0.2" value={draft.gamingSourceIp} onChange={(e) => set({ gamingSourceIp: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>{s.fldNotes}</label>
            <input className={field} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
          </div>
        </div>

        {editId ? (
          <div className="mt-4 rounded-md border border-afro-line bg-afro-bg/40 p-3">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button className={btnClass} onClick={onCopyConfig} type="button" title={s.copyConfigTitle}>
                <ClipboardCopy size={14} /> {s.copyConfig}
              </button>
              {draft.webfigUrl ? (
                <a className={btnClass} href={draft.webfigUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} /> {s.openWebfig}
                </a>
              ) : null}
            </div>
            <div className="mb-2 text-xs font-bold uppercase text-afro-muted">{s.liveStatus}</div>
            {!status ? (
              <div className="text-sm text-afro-muted">{s.loadingStatus}</div>
            ) : status.error ? (
              <div className="text-sm text-red-600">{status.error}</div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="text-afro-ink">
                  {s.statusSummary(status.identity ?? status.label, status.board ?? '—', status.version ?? '—', status.uptime ?? '—', String(status.cpuLoad ?? 0))}
                </div>
                {status.wans.length ? (
                  <div>
                    <div className="mb-1 text-xs font-bold text-afro-muted">{s.modemsTitle}</div>
                    <table className="w-full text-xs">
                      <tbody>
                        {status.wans.map((w) => (
                          <tr className="border-b border-afro-line/40" key={w.name}>
                            <td className="py-1 pe-2">
                              <span className={w.running ? 'text-emerald-600' : 'text-red-500'}>●</span> {w.name}
                            </td>
                            <td className="py-1 pe-2 font-mono" dir="ltr">{w.sim ?? (w.comment ?? '')}</td>
                            <td className="py-1 pe-2 font-mono text-afro-muted" dir="ltr">{w.address ?? '—'}</td>
                            <td className="py-1 text-end">
                              <button
                                className={`${btnClass} min-h-7 px-2 py-0`}
                                disabled={Boolean(modemBusy[w.name])}
                                onClick={() => onReconnect(w.name)}
                                title={s.reconnectTitle}
                                type="button"
                              >
                                <RefreshCw size={12} /> {modemBusy[w.name] ? '…' : s.reconnect}
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
                    <div className="text-xs font-bold text-afro-muted">{s.wgPeersTitle}</div>
                    {status.wgPeers.map((p) => (
                      <div className="font-mono text-xs" dir="ltr" key={p.interfaceName + (p.endpoint ?? '')}>
                        {p.interfaceName} → {p.endpoint ?? '—'} · {s.handshakeAbbrev} {p.lastHandshakeSeconds != null ? `${p.lastHandshakeSeconds}s` : '—'} · ↓{formatBytes(p.rxBytes)} ↑{formatBytes(p.txBytes)}
                      </div>
                    ))}
                  </div>
                ) : null}
                {usage && usage.length ? (
                  <div>
                    <div className="mb-1 text-xs font-bold text-afro-muted">{s.usageBillingTitle}</div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-start text-afro-muted">
                          <th className="py-1 pe-2 text-start">{s.colTunnel}</th>
                          <th className="py-1 pe-2 text-end">{s.colTotal}</th>
                          <th className="py-1 pe-2 text-end">{s.colPricePerGb}</th>
                          <th className="py-1 pe-2 text-end">{s.colCost}</th>
                          <th className="py-1"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {usage.map((u) => {
                          const inputVal = rateInputs[u.peerKey] ?? (u.pricePerGb != null ? String(u.pricePerGb) : '');
                          return (
                            <tr className="border-b border-afro-line/40" key={u.peerKey}>
                              <td className="py-1 pe-2">{u.label ?? u.iface ?? u.comment ?? u.peerKey.slice(0, 12)}</td>
                              <td className="py-1 pe-2 text-end font-mono font-bold" dir="ltr">{formatBytes(u.totalBytes)}</td>
                              <td className="py-1 pe-2 text-end">
                                <input
                                  className="w-20 rounded border border-afro-line px-1 text-end text-xs"
                                  dir="ltr"
                                  inputMode="decimal"
                                  value={inputVal}
                                  onChange={(e) => setRateInputs((m) => ({ ...m, [u.peerKey]: e.target.value }))}
                                />
                              </td>
                              <td className="py-1 pe-2 text-end font-mono" dir="ltr">{formatCost(u.cost, u.currency)}</td>
                              <td className="py-1 text-end">
                                <button
                                  className={`${btnClass} min-h-7 px-2 py-0`}
                                  onClick={() => onSetRate(u.peerKey, Number(inputVal) || 0, u.label ?? u.comment ?? null)}
                                  type="button"
                                >
                                  {s.saveRate}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="mt-1 text-[11px] text-afro-muted">{s.rateHint}</div>
                  </div>
                ) : usage ? (
                  <div className="text-xs text-afro-muted">{s.noUsageSamples}</div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button className={btnClass} onClick={onClose} type="button">{s.cancel}</button>
          <button className={primaryBtnClass} disabled={saving || !draft.label || (!editId && !draft.id)} onClick={onSave} type="button">
            {saving ? s.saving : editId ? s.saveChanges : s.add}
          </button>
        </div>
      </div>
    </div>
  );
}
