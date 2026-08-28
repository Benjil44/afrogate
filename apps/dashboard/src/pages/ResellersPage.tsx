import { useEffect, useMemo, useState } from 'react';
import { Loader2, LogIn, Store, Users } from 'lucide-react';
import type { AdminCustomerAccountSummary, AdminResellerAccountSummary, AdminResellerWalletLedgerEntry, AdminUserSummary } from '@afrows/shared';
import { createAdminReseller, fetchAdminResellers, fetchAdminUsers, fetchResellerWalletLedger, topUpResellerWallet, updateAdminReseller } from '../api/admin';
import { fetchGbPrice, fetchResellerCustomers, impersonateReseller, type ImpersonateResellerResult } from '../api/reseller-pricing';
import { DataTable, type DataTableColumnDef } from '../components/DataTable';
import { PanelHeading, StatusBadge } from '../components/primitives';
import { billingStatusTone, customerAccountStatusLabel } from '../labels';
import type { DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';

const inputClass = 'min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm outline-none focus:border-afro-teal';

type SellerCustomersState = 'loading' | 'live' | 'error';

export function ResellersPage({
  format,
  onImpersonate,
  sessionToken,
  t,
}: {
  format: DashboardFormatters;
  /** "Sign in as seller": hands the reseller-scoped session up to the app shell. */
  onImpersonate?: (result: ImpersonateResellerResult) => void;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const s = t.resellersPage;
  const [rows, setRows] = useState<AdminResellerAccountSummary[]>([]);
  const [resellerUsers, setResellerUsers] = useState<AdminUserSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  // First-load failure must not look like "no sellers yet".
  const [loadState, setLoadState] = useState<'loading' | 'live' | 'error'>('loading');
  const [showAdd, setShowAdd] = useState(false);
  const [adminUserId, setAdminUserId] = useState('');
  // One-step onboarding: link an existing reseller login, or create a fresh one.
  const [loginMode, setLoginMode] = useState<'existing' | 'new'>('existing');
  const [newLoginUsername, setNewLoginUsername] = useState('');
  const [newLoginPassword, setNewLoginPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [marginPct, setMarginPct] = useState('20');
  const [currency, setCurrency] = useState('IRT');
  // Platform billing currency (from the GB-price settings). A reseller whose
  // wallet currency differs is silently blocked (currency_mismatch) on every
  // per-GB sale, so the create form prefills + locks the currency to it.
  const [platformCurrency, setPlatformCurrency] = useState<string | null>(null);
  const [creditLimit, setCreditLimit] = useState('0');
  const [maxCustomers, setMaxCustomers] = useState(''); // '' = unlimited
  const [busy, setBusy] = useState(false);
  const [topUpFor, setTopUpFor] = useState<string | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('');
  // Inline per-seller customer-cap editor.
  const [limitFor, setLimitFor] = useState<string | null>(null);
  const [limitValue, setLimitValue] = useState('');
  // Inline per-seller credit-limit (overdraft allowance) editor.
  const [creditFor, setCreditFor] = useState<string | null>(null);
  const [creditValue, setCreditValue] = useState('');
  const [ledgerFor, setLedgerFor] = useState<string | null>(null);
  const [ledger, setLedger] = useState<AdminResellerWalletLedgerEntry[]>([]);
  // Drill-down: which seller's customers are expanded + their usage rows.
  const [customersFor, setCustomersFor] = useState<string | null>(null);
  const [customers, setCustomers] = useState<AdminCustomerAccountSummary[]>([]);
  const [customersState, setCustomersState] = useState<SellerCustomersState>('loading');
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  const load = async () => {
    try {
      const [res, users] = await Promise.all([
        fetchAdminResellers(sessionToken),
        fetchAdminUsers(sessionToken).catch(() => ({ users: [] as AdminUserSummary[] })),
      ]);
      setRows(res.resellers);
      setResellerUsers(users.users.filter((u) => u.role === 'reseller'));
      setLoadState('live');
    } catch {
      setLoadState('error');
    }
  };
  useEffect(() => {
    void load();
  }, [sessionToken]);

  useEffect(() => {
    const controller = new AbortController();
    fetchGbPrice(sessionToken, controller.signal)
      .then((price) => {
        setPlatformCurrency(price.currency);
        setCurrency(price.currency);
      })
      .catch(() => undefined); // settings unavailable -> currency stays editable
    return () => controller.abort();
  }, [sessionToken]);

  // reseller-role users not yet linked to a reseller account
  const availableLogins = useMemo(() => {
    const linked = new Set(rows.map((r) => r.adminUserId));
    return resellerUsers.filter((u) => !linked.has(u.id));
  }, [rows, resellerUsers]);

  const creatingNewLogin = loginMode === 'new';
  const createReady =
    displayName.trim().length > 0 &&
    (creatingNewLogin ? newLoginUsername.trim().length > 0 && newLoginPassword.trim().length >= 8 : Boolean(adminUserId));

  const onCreate = async () => {
    if (!createReady) return;
    setBusy(true);
    setError(null);
    try {
      await createAdminReseller(sessionToken, {
        ...(creatingNewLogin
          ? { newLoginUsername: newLoginUsername.trim(), newLoginPassword: newLoginPassword.trim() }
          : { adminUserId }),
        displayName: displayName.trim(),
        sellerMarginBps: Math.round((Number(marginPct) || 0) * 100),
        currency: platformCurrency ?? (currency.trim() || 'IRT'),
        creditLimitAmount: Math.round(Number(creditLimit) || 0),
        maxCustomers: maxCustomers.trim() ? Math.max(0, Math.round(Number(maxCustomers) || 0)) : null,
      });
      setShowAdd(false);
      setAdminUserId('');
      setNewLoginUsername('');
      setNewLoginPassword('');
      setDisplayName('');
      setMarginPct('20');
      setCreditLimit('0');
      setMaxCustomers('');
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

  const onSetLimit = async (id: string) => {
    // Empty input clears the cap (unlimited); a number sets it.
    const trimmed = limitValue.trim();
    const maxCustomers = trimmed ? Math.max(0, Math.round(Number(trimmed) || 0)) : null;
    setBusy(true);
    setError(null);
    try {
      await updateAdminReseller(sessionToken, id, { maxCustomers });
      setLimitFor(null);
      setLimitValue('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onSetCredit = async (id: string) => {
    // The seller's overdraft allowance: how far the wallet may go negative.
    const creditLimitAmount = Math.max(0, Math.round(Number(creditValue.trim()) || 0));
    setBusy(true);
    setError(null);
    try {
      await updateAdminReseller(sessionToken, id, { creditLimitAmount });
      setCreditFor(null);
      setCreditValue('');
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

  /** Drill into a seller: list their customer accounts + used/quota usage. */
  const openCustomers = async (id: string) => {
    if (customersFor === id) {
      setCustomersFor(null);
      return;
    }
    setCustomersFor(id);
    setCustomers([]);
    setCustomersState('loading');
    try {
      const accounts = await fetchResellerCustomers(sessionToken, id);
      setCustomers(accounts);
      setCustomersState('live');
    } catch {
      setCustomersState('error');
    }
  };

  /** Audited superadmin impersonation: opens the seller's own panel as them. */
  const onSignInAs = async (r: AdminResellerAccountSummary) => {
    setImpersonatingId(r.id);
    setError(null);
    try {
      const result = await impersonateReseller(sessionToken, r.id);
      onImpersonate?.(result);
    } catch {
      setError(s.signInAsFailed);
    } finally {
      setImpersonatingId(null);
    }
  };

  const money = (n: number, cur: string) => `${n.toLocaleString()} ${cur}`;

  const columns: Array<DataTableColumnDef<AdminResellerAccountSummary>> = [
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
          <span className="block text-afro-muted">{s.creditLimit}: {money(r.creditLimitAmount, r.currency)}</span>
        </span>
      ),
    },
    {
      key: 'customers',
      header: s.colCustomers,
      alignRight: true,
      render: (r) => (
        <span className="text-[12px]">
          {r.activeCustomerAccountCount} / {r.customerAccountCount}
          <span className="block text-afro-muted">
            {r.maxCustomers != null ? `${s.limit}: ${r.maxCustomers}` : s.unlimited}
          </span>
        </span>
      ),
    },
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
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <button type="button" onClick={() => { setTopUpFor(r.id); setTopUpAmount(''); }} className="inline-flex h-8 items-center rounded-md border border-afro-line px-2 text-xs font-bold hover:border-afro-teal hover:text-afro-teal">{s.topUp}</button>
          <button type="button" onClick={() => { setCreditFor(r.id); setCreditValue(String(r.creditLimitAmount)); }} className="inline-flex h-8 items-center rounded-md border border-afro-line px-2 text-xs font-bold hover:border-afro-teal hover:text-afro-teal">{s.creditLimit}</button>
          <button type="button" onClick={() => { setLimitFor(r.id); setLimitValue(r.maxCustomers != null ? String(r.maxCustomers) : ''); }} className="inline-flex h-8 items-center rounded-md border border-afro-line px-2 text-xs font-bold hover:border-afro-teal hover:text-afro-teal">{s.limit}</button>
          <button type="button" onClick={() => void openLedger(r.id)} className="inline-flex h-8 items-center rounded-md border border-afro-line px-2 text-xs font-bold hover:border-afro-teal hover:text-afro-teal">{s.ledger}</button>
          <button
            aria-expanded={customersFor === r.id}
            data-seller-customers-toggle={r.id}
            type="button"
            onClick={() => void openCustomers(r.id)}
            className={`inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-bold hover:border-afro-teal hover:text-afro-teal ${customersFor === r.id ? 'border-afro-teal text-afro-teal' : 'border-afro-line'}`}
          >
            <Users size={13} />
            {s.customers}
          </button>
          <button
            data-seller-impersonate={r.id}
            type="button"
            disabled={impersonatingId !== null}
            onClick={() => void onSignInAs(r)}
            title={s.signInAs}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-afro-line px-2 text-xs font-bold hover:border-afro-blue hover:text-afro-blue disabled:cursor-wait disabled:opacity-60"
          >
            {impersonatingId === r.id ? <Loader2 className="animate-spin" size={13} /> : <LogIn size={13} />}
            {impersonatingId === r.id ? s.signingInAs : s.signInAs}
          </button>
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
          <div className="grid gap-2 md:col-span-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLoginMode('existing')}
                className={`inline-flex min-h-9 items-center rounded-md px-3 text-sm font-bold ${loginMode === 'existing' ? 'bg-afro-teal text-white' : 'border border-afro-line bg-white text-afro-ink'}`}
              >
                {s.loginModeExisting}
              </button>
              <button
                type="button"
                onClick={() => setLoginMode('new')}
                className={`inline-flex min-h-9 items-center rounded-md px-3 text-sm font-bold ${loginMode === 'new' ? 'bg-afro-teal text-white' : 'border border-afro-line bg-white text-afro-ink'}`}
              >
                {s.loginModeNew}
              </button>
            </div>
            {loginMode === 'existing' ? (
              <label className="grid gap-1">
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
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-[13px] font-bold text-afro-muted">{s.newUsername}</span>
                  <input className={inputClass} value={newLoginUsername} onChange={(e) => setNewLoginUsername(e.target.value)} autoComplete="off" />
                </label>
                <label className="grid gap-1">
                  <span className="text-[13px] font-bold text-afro-muted">{s.newPassword}</span>
                  <input className={inputClass} type="password" value={newLoginPassword} onChange={(e) => setNewLoginPassword(e.target.value)} autoComplete="new-password" />
                </label>
              </div>
            )}
          </div>
          <label className="grid gap-1"><span className="text-[13px] font-bold text-afro-muted">{s.displayName}</span>
            <input className={inputClass} value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
          <label className="grid gap-1"><span className="text-[13px] font-bold text-afro-muted">{s.marginPercent}</span>
            <input className={inputClass} inputMode="numeric" value={marginPct} onChange={(e) => setMarginPct(e.target.value)} /></label>
          <label className="grid gap-1"><span className="text-[13px] font-bold text-afro-muted">{s.currency}</span>
            <input
              className={inputClass}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              readOnly={platformCurrency !== null}
              aria-describedby={platformCurrency !== null ? 'reseller-currency-hint' : undefined}
              data-reseller-currency-input="true"
            />
            {platformCurrency !== null ? (
              <span id="reseller-currency-hint" className="text-[12px] text-afro-muted">{s.currencyLocked}</span>
            ) : null}</label>
          <label className="grid gap-1"><span className="text-[13px] font-bold text-afro-muted">{s.creditLimit}</span>
            <input className={inputClass} inputMode="numeric" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} /></label>
          <label className="grid gap-1"><span className="text-[13px] font-bold text-afro-muted">{s.maxCustomers}</span>
            <input className={inputClass} inputMode="numeric" placeholder={s.unlimited} value={maxCustomers} onChange={(e) => setMaxCustomers(e.target.value)} />
            <span className="text-[12px] text-afro-muted">{s.maxCustomersHint}</span></label>
          <div className="md:col-span-2">
            <button type="button" disabled={busy || !createReady} onClick={() => void onCreate()} className="inline-flex min-h-9 items-center rounded-md bg-afro-teal px-4 text-sm font-bold text-white disabled:opacity-50">{s.create}</button>
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

      {creditFor ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-afro-line bg-white p-3">
          <span className="text-[13px] font-bold text-afro-muted">{s.creditLimit}:</span>
          <input className={`${inputClass} w-40`} inputMode="numeric" value={creditValue} onChange={(e) => setCreditValue(e.target.value)} />
          <button type="button" disabled={busy} onClick={() => void onSetCredit(creditFor)} className="inline-flex min-h-9 items-center rounded-md bg-afro-teal px-4 text-sm font-bold text-white disabled:opacity-50">{s.save}</button>
          <button type="button" onClick={() => setCreditFor(null)} className="inline-flex min-h-9 items-center rounded-md border border-afro-line px-3 text-sm font-bold">{s.cancel}</button>
          <span className="text-[12px] text-afro-muted">{s.creditLimitHint}</span>
        </div>
      ) : null}

      {limitFor ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-afro-line bg-white p-3">
          <span className="text-[13px] font-bold text-afro-muted">{s.maxCustomers}:</span>
          <input className={`${inputClass} w-40`} inputMode="numeric" placeholder={s.unlimited} value={limitValue} onChange={(e) => setLimitValue(e.target.value)} />
          <button type="button" disabled={busy} onClick={() => void onSetLimit(limitFor)} className="inline-flex min-h-9 items-center rounded-md bg-afro-teal px-4 text-sm font-bold text-white disabled:opacity-50">{s.save}</button>
          <button type="button" onClick={() => setLimitFor(null)} className="inline-flex min-h-9 items-center rounded-md border border-afro-line px-3 text-sm font-bold">{s.cancel}</button>
          <span className="text-[12px] text-afro-muted">{s.maxCustomersHint}</span>
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

      {customersFor ? (
        <div className="grid gap-1.5 rounded-lg border border-afro-line bg-white p-3" data-seller-customers="true">
          <div className="flex items-center justify-between gap-2">
            <strong className="min-w-0 truncate text-[13px]">
              {s.customersTitle(rows.find((r) => r.id === customersFor)?.displayName ?? '')}
            </strong>
            <button type="button" onClick={() => setCustomersFor(null)} className="inline-flex min-h-9 items-center px-1 text-[12px] font-bold text-afro-muted hover:text-afro-ink">{s.cancel}</button>
          </div>
          {customersState === 'loading' ? (
            <span className="inline-flex items-center gap-2 text-[12px] text-afro-muted"><Loader2 className="animate-spin" size={14} />{t.panelStates.loadingTitle}</span>
          ) : customersState === 'error' ? (
            <span className="text-[12px] text-afro-muted">{s.customersLoadFailed}</span>
          ) : customers.length === 0 ? (
            <span className="text-[12px] text-afro-muted">{s.customersEmpty}</span>
          ) : (
            customers.map((account) => (
              <div key={account.id} className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-afro-line/60 py-1.5 last:border-b-0">
                <span className="min-w-0">
                  <strong className="block truncate text-[13px] text-afro-ink">
                    {account.displayName ?? account.telegramUsername ?? account.id.slice(0, 8)}
                  </strong>
                  <span className="block truncate text-[12px] text-afro-muted" dir="ltr">
                    {s.colUsedQuota}: {format.bytes(account.usedBytes)} / {account.quotaLimitBytes === null || account.quotaLimitBytes === undefined ? t.billing.unlimited : format.bytes(account.quotaLimitBytes)}
                  </span>
                </span>
                <StatusBadge tone={billingStatusTone(account.status)}>{customerAccountStatusLabel(account.status, t)}</StatusBadge>
              </div>
            ))
          )}
        </div>
      ) : null}

      <DataTable
        columns={columns}
        empty={{ message: s.empty }}
        error={
          loadState === 'error'
            ? {
                detail: s.loadFailed,
                message: t.panelStates.errorTitle,
                onRetry: () => {
                  setLoadState('loading');
                  void load();
                },
                retryLabel: t.actions.retry,
              }
            : null
        }
        loading={loadState === 'loading'}
        loadingLabel={t.panelStates.loadingTitle}
        minWidth="980px"
        rowKey={(r) => r.id}
        rows={rows}
      />
    </section>
  );
}
