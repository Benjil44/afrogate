import { useEffect, useMemo, useState } from 'react';
import { Activity, Archive, ArchiveRestore, Database, Loader2, LogIn, Store } from 'lucide-react';
import type {
  AdminCustomerAccountSummary,
  AdminResellerAccountSummary,
  AdminResellerWalletLedgerEntry,
  AdminUserSummary,
  ResellerAccountStatus,
} from '@afrows/shared';
import {
  archiveAdminReseller,
  createAdminReseller,
  fetchAdminResellers,
  fetchAdminUsers,
  fetchResellerWalletLedger,
  restoreAdminReseller,
  topUpResellerWallet,
  updateAdminReseller,
} from '../api/admin';
import { fetchGbPrice, fetchResellerCustomers, impersonateReseller, type ImpersonateResellerResult } from '../api/reseller-pricing';
import { DataTable, type DataTableColumnDef } from '../components/DataTable';
import { MetricPill, PanelHeading, StatusBadge, UsageBar } from '../components/primitives';
import { billingStatusTone, customerAccountStatusLabel } from '../labels';
import type { DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';

const inputClass = 'min-h-10 rounded-md border border-afro-line bg-white px-3 text-sm outline-none focus:border-afro-teal';
const rowActionBtn =
  'inline-flex h-8 items-center gap-1 rounded-md border border-afro-line px-2 text-xs font-bold hover:border-afro-teal hover:text-afro-teal disabled:cursor-wait disabled:opacity-60';

type LoadState = 'idle' | 'loading' | 'live' | 'error';

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
  const [showArchived, setShowArchived] = useState(false);
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
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  // Archive/restore in-flight row id, so only that row's action shows a spinner.
  const [archiveBusyId, setArchiveBusyId] = useState<string | null>(null);
  // Only one seller's sub-row is ever open at a time.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    try {
      const [res, users] = await Promise.all([
        fetchAdminResellers(sessionToken, undefined, showArchived ? 'all' : 'active'),
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
  }, [sessionToken, showArchived]);

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

  const onToggleStatus = async (r: AdminResellerAccountSummary) => {
    if (r.archivedAt) return;
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

  const onArchive = async (r: AdminResellerAccountSummary) => {
    if (!window.confirm(s.archiveConfirm(r.displayName, r.customerAccountCount))) return;
    setArchiveBusyId(r.id);
    setError(null);
    try {
      await archiveAdminReseller(sessionToken, r.id);
      if (expandedId === r.id) setExpandedId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : s.archiveFailed);
    } finally {
      setArchiveBusyId(null);
    }
  };

  const onRestore = async (r: AdminResellerAccountSummary) => {
    setArchiveBusyId(r.id);
    setError(null);
    try {
      await restoreAdminReseller(sessionToken, r.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : s.restoreFailed);
    } finally {
      setArchiveBusyId(null);
    }
  };

  const money = (n: number, cur: string) => `${n.toLocaleString()} ${cur}`;

  const columns: Array<DataTableColumnDef<AdminResellerAccountSummary>> = [
    {
      key: 'name',
      header: s.colName,
      render: (r) => (
        <span>
          <strong className="block text-afro-ink">
            {r.displayName}
            {r.archivedAt ? (
              <span className="ms-1.5 inline-flex whitespace-nowrap rounded-full border border-afro-line bg-afro-page px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-afro-muted">
                {s.archivedBadge}
              </span>
            ) : null}
          </strong>
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
        const archived = Boolean(r.archivedAt);
        return (
          <span className="inline-flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={on}
              disabled={archived}
              onClick={() => void onToggleStatus(r)}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full disabled:opacity-40 ${on ? 'bg-afro-teal' : 'bg-afro-line'}`}
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
      width: '1%',
      render: (r) => {
        const rowBusy = archiveBusyId === r.id;
        const archived = Boolean(r.archivedAt);
        return (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {!archived ? (
              <button
                data-seller-impersonate={r.id}
                type="button"
                disabled={impersonatingId !== null}
                onClick={() => void onSignInAs(r)}
                title={s.signInAs}
                className={`${rowActionBtn} hover:border-afro-blue hover:text-afro-blue`}
              >
                {impersonatingId === r.id ? <Loader2 className="animate-spin" size={13} /> : <LogIn size={13} />}
                <span className="sr-only sm:not-sr-only">{impersonatingId === r.id ? s.signingInAs : s.signInAs}</span>
              </button>
            ) : null}
            {archived ? (
              <button
                type="button"
                disabled={rowBusy}
                onClick={() => void onRestore(r)}
                title={s.restore}
                className={`${rowActionBtn} hover:border-afro-green hover:text-afro-green`}
              >
                {rowBusy ? <Loader2 className="animate-spin" size={13} /> : <ArchiveRestore size={13} />}
                <span className="sr-only sm:not-sr-only">{rowBusy ? s.restoring : s.restore}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={rowBusy}
                onClick={() => void onArchive(r)}
                title={s.archive}
                className={`${rowActionBtn} hover:border-red-400 hover:text-red-600`}
              >
                {rowBusy ? <Loader2 className="animate-spin" size={13} /> : <Archive size={13} />}
                <span className="sr-only sm:not-sr-only">{rowBusy ? s.archiving : s.archive}</span>
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <section className="grid gap-4">
      {error ? <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</div> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PanelHeading title={s.colName} icon={Store} />
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex min-h-11 items-center gap-2 text-[13px] font-bold text-afro-muted md:min-h-9">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="h-4 w-4 accent-afro-teal"
            />
            {s.showArchived}
          </label>
          <button type="button" onClick={() => setShowAdd((v) => !v)} className="inline-flex min-h-9 items-center gap-1 rounded-md bg-afro-sidebar px-3 text-sm font-bold text-white hover:bg-[#1f3138]">+ {s.add}</button>
        </div>
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

      <DataTable
        columns={columns}
        detailCollapseLabel={s.collapseRow}
        detailExpandLabel={s.expandRow}
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
        expandedRows={expandedId ? { [expandedId]: true } : {}}
        loading={loadState === 'loading'}
        loadingLabel={t.panelStates.loadingTitle}
        minWidth="900px"
        onToggleRow={(key) => setExpandedId((current) => (current === key ? null : key))}
        renderDetail={(r) => (
          <SellerDetailPanel format={format} onSaved={load} r={r} s={s} sessionToken={sessionToken} t={t} />
        )}
        rowKey={(r) => r.id}
        rows={rows}
        stickyLastColumn
      />
    </section>
  );
}

/**
 * Everything for one seller that used to be a top-stacked panel — consolidated
 * Edit (margin/credit/max/status), Top up, Ledger, and the customer drill-down —
 * now lives directly under that seller's row. Mounted only while its row is
 * expanded, so each seller gets a fresh, independent copy of this state.
 */
function SellerDetailPanel({
  format,
  onSaved,
  r,
  s,
  sessionToken,
  t,
}: {
  format: DashboardFormatters;
  onSaved: () => Promise<void>;
  r: AdminResellerAccountSummary;
  s: DashboardStrings['resellersPage'];
  sessionToken: string;
  t: DashboardStrings;
}) {
  // Consolidated edit
  const [marginPct, setMarginPct] = useState(String(r.sellerMarginPercent));
  const [creditLimit, setCreditLimit] = useState(String(r.creditLimitAmount));
  const [maxCustomers, setMaxCustomers] = useState(r.maxCustomers != null ? String(r.maxCustomers) : '');
  const [status, setStatus] = useState<ResellerAccountStatus | string>(r.status);
  const [editBusy, setEditBusy] = useState(false);
  const [editMessage, setEditMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Top up
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpBusy, setTopUpBusy] = useState(false);
  const [topUpError, setTopUpError] = useState<string | null>(null);

  // Ledger
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledger, setLedger] = useState<AdminResellerWalletLedgerEntry[]>([]);
  const [ledgerState, setLedgerState] = useState<LoadState>('idle');

  // Customers drill-down
  const [customers, setCustomers] = useState<AdminCustomerAccountSummary[]>([]);
  const [customersState, setCustomersState] = useState<LoadState>('loading');

  useEffect(() => {
    let cancelled = false;
    setCustomersState('loading');
    fetchResellerCustomers(sessionToken, r.id)
      .then((accounts) => {
        if (cancelled) return;
        setCustomers(accounts);
        setCustomersState('live');
      })
      .catch(() => {
        if (!cancelled) setCustomersState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [sessionToken, r.id]);

  const onSaveEdit = async () => {
    setEditBusy(true);
    setEditMessage(null);
    try {
      await updateAdminReseller(sessionToken, r.id, {
        sellerMarginBps: Math.round((Number(marginPct) || 0) * 100),
        creditLimitAmount: Math.max(0, Math.round(Number(creditLimit) || 0)),
        maxCustomers: maxCustomers.trim() ? Math.max(0, Math.round(Number(maxCustomers) || 0)) : null,
        status: status as ResellerAccountStatus,
      });
      setEditMessage({ ok: true, text: s.editSaved });
      await onSaved();
    } catch (e) {
      setEditMessage({ ok: false, text: e instanceof Error ? e.message : s.editFailed });
    } finally {
      setEditBusy(false);
    }
  };

  const onTopUp = async () => {
    const amount = Math.round(Number(topUpAmount) || 0);
    if (amount <= 0) return;
    setTopUpBusy(true);
    setTopUpError(null);
    try {
      await topUpResellerWallet(sessionToken, r.id, { amount });
      setTopUpAmount('');
      await onSaved();
    } catch (e) {
      setTopUpError(e instanceof Error ? e.message : s.topUpFailed);
    } finally {
      setTopUpBusy(false);
    }
  };

  const onToggleLedger = () => {
    if (ledgerOpen) {
      setLedgerOpen(false);
      return;
    }
    setLedgerOpen(true);
    if (ledgerState === 'idle' || ledgerState === 'error') {
      setLedgerState('loading');
      fetchResellerWalletLedger(sessionToken, r.id)
        .then((res) => {
          setLedger(res.entries);
          setLedgerState('live');
        })
        .catch(() => setLedgerState('error'));
    }
  };

  return (
    <div className="grid gap-3">
      {/* Consolidated edit: margin, credit limit, max customers, status. */}
      <div className="grid gap-2 rounded-md border border-afro-line bg-white p-2.5 sm:grid-cols-2 lg:grid-cols-5">
        <label className="grid gap-1">
          <span className="text-[12px] font-bold text-afro-muted">{s.marginPercent}</span>
          <input className={inputClass} inputMode="numeric" value={marginPct} onChange={(e) => setMarginPct(e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="text-[12px] font-bold text-afro-muted">{s.creditLimit}</span>
          <input className={inputClass} inputMode="numeric" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="text-[12px] font-bold text-afro-muted">{s.maxCustomers}</span>
          <input className={inputClass} inputMode="numeric" placeholder={s.unlimited} value={maxCustomers} onChange={(e) => setMaxCustomers(e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="text-[12px] font-bold text-afro-muted">{s.statusLabel}</span>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">{s.statusActive}</option>
            <option value="suspended">{s.statusSuspended}</option>
            <option value="disabled">{s.statusDisabled}</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button type="button" disabled={editBusy} onClick={() => void onSaveEdit()} className="inline-flex min-h-10 items-center rounded-md bg-afro-teal px-4 text-sm font-bold text-white disabled:opacity-50">
            {editBusy ? <Loader2 className="animate-spin" size={14} /> : s.save}
          </button>
        </div>
        {editMessage ? (
          <span className={`sm:col-span-2 lg:col-span-5 text-[12px] ${editMessage.ok ? 'text-afro-green' : 'text-red-600'}`}>{editMessage.text}</span>
        ) : null}
      </div>

      {/* Top up + ledger. */}
      <div className="grid gap-2 rounded-md border border-afro-line bg-white p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-bold text-afro-muted">{s.topUpAmount}:</span>
          <input className={`${inputClass} w-32`} inputMode="numeric" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} />
          <button type="button" disabled={topUpBusy || Math.round(Number(topUpAmount) || 0) <= 0} onClick={() => void onTopUp()} className="inline-flex min-h-9 items-center rounded-md bg-afro-sidebar px-3 text-sm font-bold text-white disabled:opacity-50">
            {topUpBusy ? <Loader2 className="animate-spin" size={14} /> : s.topUp}
          </button>
          <button type="button" onClick={onToggleLedger} className="inline-flex min-h-9 items-center rounded-md border border-afro-line px-3 text-sm font-bold hover:border-afro-teal hover:text-afro-teal">
            {s.ledger}
          </button>
          {topUpError ? <span className="text-[12px] text-red-600">{topUpError}</span> : null}
        </div>
        {ledgerOpen ? (
          <div className="grid gap-1 border-t border-afro-line pt-2">
            {ledgerState === 'loading' ? (
              <span className="inline-flex items-center gap-2 text-[12px] text-afro-muted"><Loader2 className="animate-spin" size={14} />{t.panelStates.loadingTitle}</span>
            ) : ledgerState === 'error' ? (
              <span className="text-[12px] text-afro-muted">{t.panelStates.errorTitle}</span>
            ) : ledger.length === 0 ? (
              <span className="text-[12px] text-afro-muted">{s.ledgerEmpty}</span>
            ) : (
              ledger.map((e) => (
                <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-afro-line/60 py-1 text-[12px] last:border-b-0">
                  <span className="font-bold uppercase tracking-wide">{e.entryType}</span>
                  <span dir="ltr">{e.amount.toLocaleString()} {e.currency}</span>
                  <span className="text-afro-muted">{e.customerDisplayName || e.volumePackageName || e.source}</span>
                  <span className="text-afro-muted">{new Date(e.createdAt).toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>

      {/* Customers drill-down. */}
      <div className="grid gap-1.5 rounded-md border border-afro-line bg-white p-2.5">
        <strong className="text-[13px]">{s.customersTitle(r.displayName)}</strong>
        {customersState === 'loading' ? (
          <span className="inline-flex items-center gap-2 text-[12px] text-afro-muted"><Loader2 className="animate-spin" size={14} />{t.panelStates.loadingTitle}</span>
        ) : customersState === 'error' ? (
          <span className="text-[12px] text-afro-muted">{s.customersLoadFailed}</span>
        ) : customers.length === 0 ? (
          <span className="text-[12px] text-afro-muted">{s.customersEmpty}</span>
        ) : (
          customers.map((account) => {
            const hasQuota = typeof account.quotaLimitBytes === 'number';
            const remainingBytes = hasQuota ? Math.max(0, (account.quotaLimitBytes as number) - account.usedBytes) : null;
            const usagePercent = hasQuota && (account.quotaLimitBytes as number) > 0
              ? Math.min(100, (account.usedBytes / (account.quotaLimitBytes as number)) * 100)
              : null;

            return (
              <div key={account.id} className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-afro-line/60 py-1.5 last:border-b-0">
                <span className="min-w-0">
                  <strong className="block truncate text-[13px] text-afro-ink">
                    {account.displayName ?? account.telegramUsername ?? account.id.slice(0, 8)}
                  </strong>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <MetricPill icon={Database} label={s.remainingGb} value={remainingBytes === null ? t.billing.unlimited : format.bytes(remainingBytes)} />
                    <UsageBar format={format} icon={Activity} label={s.usage} value={usagePercent} />
                  </span>
                </span>
                <StatusBadge tone={billingStatusTone(account.status)}>{customerAccountStatusLabel(account.status, t)}</StatusBadge>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
