import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Pencil, Plus, RefreshCw, Router as RouterIcon, Trash2, X } from 'lucide-react';
import type {
  CreateMikroTikRouterRequest,
  MikroTikRouterKind,
  MikroTikRouterStatus,
  MikroTikRouterSummary,
} from '@afrows/shared';
import type { DashboardStrings } from '../i18n';
import {
  createRouter,
  deleteRouter,
  fetchRouterStatus,
  fetchRouters,
  setRouterMode,
  updateRouter,
} from '../api/admin';

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

const cardClass = 'rounded-lg border border-afro-line bg-white p-4 shadow-sm';
const btnClass =
  'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-afro-line px-3 text-sm font-bold text-afro-ink hover:border-afro-blue hover:text-afro-blue disabled:opacity-50';
const primaryBtnClass =
  'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md bg-afro-blue px-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50';

export function MicrotiksPage({ sessionToken, t }: { sessionToken: string; t: DashboardStrings }) {
  void t;
  const [rows, setRows] = useState<MikroTikRouterSummary[]>([]);
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

  const openAdd = () => {
    setEditId(null);
    setDraft(emptyDraft);
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
    });
    setStatus(null);
    setDialogOpen(true);
    void loadStatus(router.id);
  };

  const loadStatus = useCallback(
    async (id: string) => {
      setStatusFor(id);
      setStatus(null);
      try {
        const res = await fetchRouterStatus(sessionToken, id);
        setStatus(res.status);
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
        });
        setNotice(`Updated ${draft.label}`);
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
        };
        await createRouter(sessionToken, payload);
        setNotice(`Added ${draft.label}`);
      }
      setDialogOpen(false);
      await load();
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

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-afro-line text-left text-xs uppercase text-afro-muted">
              <th className="py-2 pr-3">Router</th>
              <th className="py-2 pr-3">Host</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Mode (Game / Normal)</th>
              <th className="py-2 pr-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td className="py-4 text-afro-muted" colSpan={5}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="py-4 text-afro-muted" colSpan={5}>No MikroTiks yet — add one with the button above.</td></tr>
            ) : (
              rows.map((router) => (
                <tr className="border-b border-afro-line/60 align-middle" key={router.id}>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2 font-bold text-afro-ink">
                      <RouterIcon size={16} /> {router.label}
                    </div>
                    <div className="text-xs text-afro-muted">{router.kind}{router.board ? ` · ${router.board}` : ''}{router.version ? ` · ${router.version}` : ''}</div>
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs">{router.host}:{router.restPort}</td>
                  <td className="py-3 pr-3">
                    <span className={`inline-flex items-center gap-1.5 ${router.online ? 'text-emerald-600' : 'text-red-500'}`}>
                      <span className={`size-2 rounded-full ${router.online ? 'bg-emerald-500' : 'bg-red-400'}`} />
                      {router.online ? 'Online' : 'Offline'}
                    </span>
                    {router.uptime ? <div className="text-xs text-afro-muted">up {router.uptime}</div> : null}
                  </td>
                  <td className="py-3 pr-3">
                    <ModeToggle
                      mode={router.mode}
                      disabled={Boolean(busy[router.id])}
                      onToggle={() => void toggleMode(router)}
                    />
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
                      <button className={`${btnClass} hover:border-red-400 hover:text-red-500`} disabled={Boolean(busy[router.id])} onClick={() => void remove(router)} type="button" title="Remove from panel">
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
          onChange={setDraft}
          onClose={() => setDialogOpen(false)}
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

function RouterDialog({
  draft,
  editId,
  saving,
  status,
  onChange,
  onClose,
  onSave,
}: {
  draft: DraftForm;
  editId: string | null;
  saving: boolean;
  status: MikroTikRouterStatus | null;
  onChange: (d: DraftForm) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const set = (patch: Partial<DraftForm>) => onChange({ ...draft, ...patch });
  const field = 'min-h-9 w-full rounded-md border border-afro-line px-2 text-sm';
  const labelClass = 'mb-1 block text-xs font-bold text-afro-muted';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-afro-ink">{editId ? `Edit ${draft.label}` : 'Add MikroTik'}</h2>
          <button className="text-afro-muted hover:text-afro-ink" onClick={onClose} type="button"><X size={18} /></button>
        </div>

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
            <label className={labelClass}>Host (tunnel IP)</label>
            <input className={field} placeholder="10.20.0.2" value={draft.host} onChange={(e) => set({ host: e.target.value })} />
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
            <label className={labelClass}>{editId ? 'Password (blank = keep)' : 'Password'}</label>
            <input className={field} type="password" value={draft.password} onChange={(e) => set({ password: e.target.value })} />
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
                    <div className="text-xs font-bold text-afro-muted">WANs</div>
                    {status.wans.map((w) => (
                      <div className="font-mono text-xs" key={w.name}>
                        <span className={w.running ? 'text-emerald-600' : 'text-red-500'}>●</span> {w.name} {w.address ?? ''} {w.comment ? `(${w.comment})` : ''}
                      </div>
                    ))}
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
              </div>
            )}
            {draft.webfigUrl ? (
              <a className={`${btnClass} mt-3`} href={draft.webfigUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={14} /> Open WebFig (Advanced)
              </a>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button className={btnClass} onClick={onClose} type="button">Cancel</button>
          <button className={primaryBtnClass} disabled={saving || !draft.label || !draft.host || (!editId && !draft.id)} onClick={onSave} type="button">
            {saving ? 'Saving…' : editId ? 'Save changes' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
