import { useEffect, useMemo, useState } from 'react';
import { Store } from 'lucide-react';
import type { AdminResellerAccountSummary, AdminResellerWalletLedgerEntry, AdminUserSummary } from '@afrows/shared';
import { createAdminReseller, fetchAdminResellers, fetchAdminUsers, fetchResellerWalletLedger, topUpResellerWallet, updateAdminReseller } from '../api/admin';
import { DataTable, EmptyState, PanelHeading } from '../components/primitives';
import type { DataTableColumn } from '../dashboard-types';
import type { DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';

const inputClass = 'min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm outline-none focus:border-afro-teal';

export function ResellersPage({ sessionToken, t }: { format: DashboardFormatters; sessionToken: string; t: DashboardStrings }) {
  const s = t.resellersPage;
  const [rows, setRows] = useState<AdminResellerAccountSummary[]>([]);
  const [resellerUsers, setResellerUsers] = useState<AdminUserSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [adminUserId, setAdminUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [marginPct, setMarginPct] = useState('20');
  const [currency, setCurrency] = useState('IRT');
  const [creditLimit, setCreditLimit] = useState('0');
  const [busy, setBusy] = useState(false);
  const [topUpFor, setTopUpFor] = useState<string | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [ledgerFor, setLedgerFor] = useState<string | null>(null);
  const [ledger, setLedger] = useState<AdminResellerWalletLedgerEntry[]>([]);

  const load = async () => {
    try {
      const [res, users] = await Promise.all([
        fetchAdminResellers(sessionToken),
        fetchAdminUsers(sessionToken).catch(() => ({ users: [] as AdminUserSummary[] })),
      ]);
      setRows(res.resellers);
      setResellerUsers(users.users.filter((u) => u.role === 'reseller'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => {
    void load();
  }, [sessionToken]);

  // reseller-role users not yet linked to a reseller account
  const availableLogins = useMemo(() => {
    const linked = new Set(rows.map((r) => r.adminUserId));
    return resellerUsers.filter((u) => !linked.has(u.id));
  }, [rows, resellerUsers]);

  const onCreate = async () => {
    if (!adminUserId || !displayName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createAdminReseller(sessionToken, {
        adminUserId,
        displayName: displayName.trim(),
        sellerMarginBps: Math.round((Number(marginPct) || 0) * 100),
        currency: currency.trim() || 'IRT',
        creditLimitAmount: Math.round(Number(creditLimit) || 0),
      });
      setShowAdd(false);
      setAdminUserId('');
      setDisplayName('');
      setMarginPct('20');
      setCreditLimit('0');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onTopUp = async (id: string) => {
    const amount = Math.round(Number(topUpAmount) || 0);
    if (amount <= 0) return;
    setBusy(true);
    setError(null);
    try {
      await topUpResellerWallet(sessionToken, id, { amount });
      setTopUpFor(null);
      setTopUpAmount('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onToggleStatus = async (r: AdminResellerAccountSummary) => {
    const next = r.status === 'active' ? 'disabled' : 'active';
    setError(null);
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: next } : x)));
    try {
      await updateAdminReseller(sessionToken, r.id, { status: next });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      await load();
    }
  };

  const openLedger = async (id: string) => {
    setLedgerFor(id);
    setLedger([]);
    try {
      const res = await fetchResellerWalletLedger(sessionToken, id);
      setLedger(res.entries);
    } catch {
      /* ignore */
    }
  };

  const money = (n: number, cur: string) => `${n.toLocaleString()} ${cur}`;

  const columns: Array<DataTableColumn<AdminResellerAccountSummary>> = [
    {
      key: 'name',
      header: s.colName,
      render: (r) => (
        <span>
          <strong className="block text-afro-ink">{r.displayName}</strong>
          <span className="text-[12px] text-afro-muted">{r.contactName || r.telegramUsername || '—'}</span>
        </span>
      ),
    },
    { key: 'margin', header: s.colMargin, alignRight: true, render: (r) => `${r.sellerMarginPercent}%` },
    {
      key: 'wallet',
      header: s.colWallet,
      alignRight: true,
      render: (r) => (
        <span className="text-[12px]">
          <strong>{money(r.balanceAmount, r.currency)}</strong>
          <span className="block text-afro-muted">{money(r.availableBalanceAmount, r.currency)} {s.available}</span>
        </span>
      ),
    },
    { key: 'customers', header: s.colCustomers, alignRight: true, render: (r) => `${r.activeCustomerAccountCount} / ${r.customerAccountCount}` },
    {
      key: 'status',
      header: s.colStatus,
      render: (r) => {
        const on = r.status === 'active';
        return (
          <span className="inline-flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={on}
              onClick={() => void onToggleStatus(r)}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full ${on ? 'bg-afro-teal' : 'bg-afro-line'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-[12px] text-afro-muted">{String(r.status)}</span>
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: s.colActions,
      alignRight: true,
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <button type="button" onClick={() => { setTopUpFor(r.id); setTopUpAmount(''); }} className="inline-flex h-8 items-center rounded-md border border-afro-line px-2 text-xs font-bold hover:border-afro-teal hover:text-afro-teal">{s.topUp}</button>
          <button type="button" onClick={() => void openLedger(r.id)} className="inline-flex h-8 items-center rounded-md border border-afro-line px-2 text-xs font-bold hover:border-afro-teal hover:text-afro-teal">{s.ledger}</button>
        </div>
      ),
    },
  ];

  return (
    <section className="grid gap-4">
      {error ? <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</div> : null}
      <div className="flex items-center justify-between">
        <PanelHeading title={s.colName} icon={Store} />
        <button type="button" onClick={() => setShowAdd((v) => !v)} className="inline-flex min-h-9 items-center gap-1 rounded-md bg-afro-sidebar px-3 text-sm font-bold text-white hover:bg-[#1f3138]">+ {s.add}</button>
      </div>

      {showAdd ? (
        <div className="grid gap-2 rounded-lg border border-afro-line bg-white p-3 md:grid-cols-2">
          <label className="grid gap-1 md:col-span-2">
            <span className="text-[13px] font-bold text-afro-muted">{s.login}</span>
            {availableLogins.length === 0 ? (
              <span className="text-[12px] text-afro-muted">{s.noLogins}</span>
            ) : (
              <select className={inputClass} value={adminUserId} onChange={(e) => setAdminUserId(e.target.value)}>
                <option value="">—</option>
                {availableLogins.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
              </select>
            )}
          </label>
          <label className="grid gap-1"><span className="text-[13px] font-bold text-afro-muted">{s.displayName}</span>
            <input className={inputClass} value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
          <label className="grid gap-1"><span className="text-[13px] font-bold text-afro-muted">{s.marginPercent}</span>
            <input className={inputClass} inputMode="numeric" value={marginPct} onChange={(e) => setMarginPct(e.target.value)} /></label>
          <label className="grid gap-1"><span className="text-[13px] font-bold text-afro-muted">{s.currency}</span>
            <input className={inputClass} value={currency} onChange={(e) => setCurrency(e.target.value)} /></label>
          <label className="grid gap-1"><span className="text-[13px] font-bold text-afro-muted">{s.creditLimit}</span>
            <input className={inputClass} inputMode="numeric" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} /></label>
          <div className="md:col-span-2">
            <button type="button" disabled={busy || !adminUserId || !displayName.trim()} onClick={() => void onCreate()} className="inline-flex min-h-9 items-center rounded-md bg-afro-teal px-4 text-sm font-bold text-white disabled:opacity-50">{s.create}</button>
          </div>
        </div>
      ) : null}

      {topUpFor ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-afro-line bg-white p-3">
          <span className="text-[13px] font-bold text-afro-muted">{s.topUpAmount}:</span>
          <input className={`${inputClass} w-40`} inputMode="numeric" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} />
          <button type="button" disabled={busy} onClick={() => void onTopUp(topUpFor)} className="inline-flex min-h-9 items-center rounded-md bg-afro-teal px-4 text-sm font-bold text-white disabled:opacity-50">{s.topUp}</button>
          <button type="button" onClick={() => setTopUpFor(null)} className="inline-flex min-h-9 items-center rounded-md border border-afro-line px-3 text-sm font-bold">{s.cancel}</button>
        </div>
      ) : null}

      {ledgerFor ? (
        <div className="grid gap-1 rounded-lg border border-afro-line bg-white p-3">
          <div className="flex items-center justify-between">
            <strong className="text-[13px]">{s.ledger}</strong>
            <button type="button" onClick={() => setLedgerFor(null)} className="text-[12px] font-bold text-afro-muted hover:text-afro-ink">{s.cancel}</button>
          </div>
          {ledger.length === 0 ? (
            <span className="text-[12px] text-afro-muted">{s.ledgerEmpty}</span>
          ) : (
            ledger.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-afro-line/60 py-1 text-[12px]">
                <span className="font-bold uppercase tracking-wide">{e.entryType}</span>
                <span dir="ltr">{e.amount.toLocaleString()} {e.currency}</span>
                <span className="text-afro-muted">{e.customerDisplayName || e.volumePackageName || e.source}</span>
                <span className="text-afro-muted">{new Date(e.createdAt).toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      ) : null}

      {rows.length === 0 ? <EmptyState message={s.empty} /> : <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} minWidth="820px" />}
    </section>
  );
}
