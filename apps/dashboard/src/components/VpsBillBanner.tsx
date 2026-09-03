import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Check, Settings2, X } from 'lucide-react';
import type { DashboardStrings } from '../i18n';

/**
 * Operator reminder for the monthly VPS/hosting bill. The box was once suspended
 * for a missed payment (taking the whole service down), so this shows a top-of-
 * dashboard countdown to the next due date, escalating in color as it nears and
 * turning red when overdue. Config lives in localStorage (per-operator, no backend
 * needed) so it works even independently of the API.
 */

const STORAGE_KEY = 'afrows.vpsBill.v2'; // v2: due-day default 5 + window-based visibility
const DISMISS_KEY = 'afrows.vpsBill.dismissedPeriod'; // sessionStorage: hide once per period

interface VpsBillConfig {
  amount: number;
  currency: string;
  dueDay: number; // 1..28
  lastPaidPeriod: string | null; // 'YYYY-MM' marked paid
}

const DEFAULTS: VpsBillConfig = { amount: 30, currency: 'USD', dueDay: 5, lastPaidPeriod: null };

function readConfig(): VpsBillConfig {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<VpsBillConfig>;
    return {
      amount: Number.isFinite(Number(p.amount)) ? Number(p.amount) : DEFAULTS.amount,
      currency: typeof p.currency === 'string' && p.currency.trim() ? p.currency.trim() : DEFAULTS.currency,
      dueDay: Math.min(28, Math.max(1, Math.floor(Number(p.dueDay)) || DEFAULTS.dueDay)),
      lastPaidPeriod: typeof p.lastPaidPeriod === 'string' ? p.lastPaidPeriod : null,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeConfig(c: VpsBillConfig) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  } catch {
    /* private mode / storage disabled — reminder just won't persist */
  }
}

function periodOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function computeDue(cfg: VpsBillConfig) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisPeriod = periodOf(now);
  const paidThisPeriod = cfg.lastPaidPeriod === thisPeriod;
  const dueThisMonth = new Date(now.getFullYear(), now.getMonth(), cfg.dueDay);
  let target = dueThisMonth;
  let overdue = false;
  if (paidThisPeriod) {
    target = new Date(now.getFullYear(), now.getMonth() + 1, cfg.dueDay); // already paid → next month
  } else if (startOfToday.getTime() > dueThisMonth.getTime()) {
    overdue = true; // this month's due date passed and not marked paid
  }
  const days = Math.round(
    (new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime() - startOfToday.getTime()) / 86_400_000,
  );
  return { target, days, overdue, thisPeriod, paidThisPeriod };
}

export function VpsBillBanner({ t }: { t: DashboardStrings }) {
  const [cfg, setCfg] = useState<VpsBillConfig>(() => readConfig());
  const [editing, setEditing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // form state for the edit popover
  const [amount, setAmount] = useState(String(cfg.amount));
  const [currency, setCurrency] = useState(cfg.currency);
  const [dueDay, setDueDay] = useState(String(cfg.dueDay));

  const s = t.vpsBill;
  const { target, days, overdue, thisPeriod, paidThisPeriod } = useMemo(() => computeDue(cfg), [cfg]);

  // session-dismiss is per-period so it re-appears next cycle
  useEffect(() => {
    try {
      setDismissed(window.sessionStorage.getItem(DISMISS_KEY) === thisPeriod);
    } catch {
      setDismissed(false);
    }
  }, [thisPeriod]);

  // Paid this cycle → hidden until next month, ALWAYS (even if the due date already
  // passed) — this is what "Mark paid" does, so it must win over the overdue state.
  if (paidThisPeriod) return null;
  // Only show inside the reminder window: nothing until 10 days before the due day;
  // yellow from 10 days out; red near/after it. Outside the window → show nothing.
  const inWindow = overdue || days <= 10;
  if (!inWindow) return null;
  // Session-dismiss (the ✕) hides it for the session, but never an overdue warning.
  if (dismissed && !overdue) return null;

  const save = () => {
    const next: VpsBillConfig = {
      ...cfg,
      amount: Math.max(0, Number(amount) || 0),
      currency: currency.trim() || 'USD',
      dueDay: Math.min(28, Math.max(1, Math.floor(Number(dueDay)) || 1)),
    };
    setCfg(next);
    writeConfig(next);
    setEditing(false);
  };
  const markPaid = () => {
    const next = { ...cfg, lastPaidPeriod: thisPeriod };
    setCfg(next);
    writeConfig(next);
  };
  const dismiss = () => {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, thisPeriod);
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  // Within ~4 days of the due day (or overdue): blinking RED. From 10 to 5 days out: blinking YELLOW.
  const tone = overdue || days <= 4
    ? { box: 'border-red-300 bg-red-50 text-red-800', accent: 'text-red-700', blink: 'afro-blink-fast' }
    : { box: 'border-amber-300 bg-amber-50 text-amber-900', accent: 'text-amber-800', blink: 'afro-blink-slow' };

  const dueDateLabel = target.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const amountLabel = `${cfg.amount.toLocaleString()} ${cfg.currency}`;
  const statusText = overdue
    ? s.overdue
    : days <= 0
      ? s.dueToday
      : s.dueIn(days);

  return (
    <div className={`mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2 text-[13px] ${tone.box} ${tone.blink}`}>
      {overdue ? <AlertTriangle size={16} className={tone.accent} /> : <CalendarClock size={16} className={tone.accent} />}
      <span className="font-bold">{s.title}:</span>
      <span className="font-bold">{amountLabel}</span>
      <span className={`font-bold ${tone.accent}`}>— {statusText}</span>
      {!overdue ? <span className="text-afro-muted">({s.onDate(dueDateLabel)})</span> : null}

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={markPaid}
          className="inline-flex min-h-7 items-center gap-1 rounded-md border border-black/10 bg-white/70 px-2 text-[12px] font-bold hover:bg-white"
        >
          <Check size={13} /> {s.markPaid}
        </button>
        <button
          type="button"
          onClick={() => { setAmount(String(cfg.amount)); setCurrency(cfg.currency); setDueDay(String(cfg.dueDay)); setEditing((v) => !v); }}
          aria-label={s.edit}
          className="inline-flex size-7 items-center justify-center rounded-md border border-black/10 bg-white/70 hover:bg-white"
        >
          <Settings2 size={13} />
        </button>
        {!overdue ? (
          <button
            type="button"
            onClick={dismiss}
            aria-label={s.dismiss}
            className="inline-flex size-7 items-center justify-center rounded-md hover:bg-white/60"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-1 flex w-full flex-wrap items-end gap-2 border-t border-black/10 pt-2">
          <label className="grid gap-1">
            <span className="text-[11px] font-bold text-afro-muted">{s.amount}</span>
            <input className="min-h-8 w-24 rounded-md border border-afro-line bg-white px-2 text-sm text-afro-ink" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-[11px] font-bold text-afro-muted">{s.currency}</span>
            <input className="min-h-8 w-20 rounded-md border border-afro-line bg-white px-2 text-sm text-afro-ink" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-[11px] font-bold text-afro-muted">{s.dueDay}</span>
            <input className="min-h-8 w-20 rounded-md border border-afro-line bg-white px-2 text-sm text-afro-ink" inputMode="numeric" value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
          </label>
          <button type="button" onClick={save} className="inline-flex min-h-8 items-center rounded-md bg-afro-teal px-3 text-sm font-bold text-white">{s.save}</button>
          <button type="button" onClick={() => setEditing(false)} className="inline-flex min-h-8 items-center rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink">{s.cancel}</button>
        </div>
      ) : null}
    </div>
  );
}
