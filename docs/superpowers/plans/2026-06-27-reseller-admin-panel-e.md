# Reseller admin panel — E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** An admin **Resellers** page to list/create/edit resellers, top up wallets, and view ledgers — wired to the already-complete reseller backend. Dashboard-only.

**Architecture:** New `ResellersPage` (DataTable + add-panel + per-row actions) using new `api/admin.ts` wrappers over existing endpoints. New `resellers` ActiveView in Main nav. Reuses `fetchAdminUsers` for the reseller-login picker.

**Spec:** `docs/superpowers/specs/2026-06-27-reseller-admin-panel-e-design.md`

Confirmed shapes: `AdminResellerAccountsResponse{resellers}`, `AdminResellerWalletLedgerResponse{entries}`, `AdminResellerWalletActionResponse{reseller,ledgerEntry}`, `AdminUserSummary{id,username,role,...}`, `CreateResellerAccountRequest{adminUserId,displayName,sellerMarginBps?,currency?,creditLimitAmount?,...}`, `UpdateResellerAccountRequest`, `TopUpResellerWalletRequest{amount,...}`.

---

### Task 1: Types + nav (TDD)

**Files:** `dashboard-types.ts`, `nav-views.ts`, `nav-views.test.ts`

- [ ] **Step 1:** `dashboard-types.ts` — add `'resellers'` to the `ActiveView` union.
- [ ] **Step 2:** `nav-views.test.ts` — update `SIDEBAR_VIEWS` and the Main test to include `resellers` after `billing`:
```ts
const SIDEBAR_VIEWS = [
  'dashboard', 'customers', 'billing', 'resellers', 'exits', 'microtiks', 'alerts', 'users', 'settings',
  'network', 'servers', 'audit', 'backups', 'reports',
];

test('Main has the 9 everyday views in order', () => {
  assert.deepEqual(MAIN_VIEWS, [
    'dashboard', 'customers', 'billing', 'resellers', 'exits', 'microtiks', 'alerts', 'users', 'settings',
  ]);
});
```
- [ ] **Step 3:** Run → fail: `node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON apps/dashboard/src/nav-views.test.ts`.
- [ ] **Step 4:** `nav-views.ts` — add `'resellers'` to `MAIN_VIEWS` after `'billing'`.
- [ ] **Step 5:** Run → pass (`# pass 5`).
- [ ] **Step 6:** Commit `git commit -m "feat(dashboard): add Resellers nav view"`

---

### Task 2: nav-config icon + i18n

**Files:** `nav-config.ts`, `i18n.en.ts`, `i18n.fa.ts`

- [ ] **Step 1:** `nav-config.ts` — import `Store` from lucide-react; add `resellers: Store,` to `NAV_ICONS`.
- [ ] **Step 2:** `i18n.en.ts` — `nav` block add `resellers: 'Resellers',`; `pageHeaders` add `resellers: { eyebrow: 'Sales channel', title: 'Resellers' },`; add a top-level `resellersPage` group:
```ts
    resellersPage: {
      add: 'Add reseller',
      colName: 'Reseller',
      colMargin: 'Margin',
      colWallet: 'Wallet',
      colCustomers: 'Customers',
      colStatus: 'Status',
      colActions: '',
      login: 'Login (reseller-role admin user)',
      noLogins: 'Create a reseller-role user on the Admins page first.',
      displayName: 'Display name',
      marginPercent: 'Margin %',
      currency: 'Currency',
      creditLimit: 'Credit limit',
      create: 'Create reseller',
      topUp: 'Top up',
      topUpAmount: 'Top-up amount',
      ledger: 'Ledger',
      edit: 'Edit',
      save: 'Save',
      cancel: 'Cancel',
      balance: 'Balance',
      available: 'available',
      empty: 'No resellers yet.',
      ledgerEmpty: 'No wallet entries yet.',
    },
```
- [ ] **Step 3:** `i18n.fa.ts` — mirror every key (nav.resellers «نمایندگان», pageHeaders.resellers «کانال فروش»/«نمایندگان», and the `resellersPage` group in arabic).
- [ ] **Step 4:** `npm --workspace @afrows/dashboard run typecheck` → CLEAN (parity).
- [ ] **Step 5:** Commit `git commit -m "feat(dashboard): Resellers nav icon + i18n"`

---

### Task 3: API wrappers

**Files:** `apps/dashboard/src/api/admin.ts`

- [ ] **Step 1:** Add the shared-type imports: `AdminResellerAccountsResponse, AdminResellerAccountSummary, AdminResellerWalletLedgerResponse, AdminResellerWalletActionResponse, CreateResellerAccountRequest, UpdateResellerAccountRequest, TopUpResellerWalletRequest` from `@afrows/shared`.
- [ ] **Step 2:** Add wrappers (mirror existing helper style — `requestAdminAuth`/`createSessionHeaders`/`getApiBaseUrl`):
```ts
export async function fetchAdminResellers(sessionToken: string, signal?: AbortSignal): Promise<AdminResellerAccountsResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/resellers`, { headers: createSessionHeaders(sessionToken), signal });
  return response.json() as Promise<AdminResellerAccountsResponse>;
}

export async function createAdminReseller(sessionToken: string, payload: CreateResellerAccountRequest): Promise<AdminResellerAccountSummary> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/resellers`, {
    method: 'POST', headers: createSessionHeaders(sessionToken), body: JSON.stringify(payload),
  });
  return response.json() as Promise<AdminResellerAccountSummary>;
}

export async function updateAdminReseller(sessionToken: string, id: string, payload: UpdateResellerAccountRequest): Promise<AdminResellerAccountSummary> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/resellers/${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: createSessionHeaders(sessionToken), body: JSON.stringify(payload),
  });
  return response.json() as Promise<AdminResellerAccountSummary>;
}

export async function fetchResellerWalletLedger(sessionToken: string, id: string, signal?: AbortSignal): Promise<AdminResellerWalletLedgerResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/resellers/${encodeURIComponent(id)}/wallet-ledger`, { headers: createSessionHeaders(sessionToken), signal });
  return response.json() as Promise<AdminResellerWalletLedgerResponse>;
}

export async function topUpResellerWallet(sessionToken: string, id: string, payload: TopUpResellerWalletRequest): Promise<AdminResellerWalletActionResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/resellers/${encodeURIComponent(id)}/wallet/topups`, {
    method: 'POST', headers: createSessionHeaders(sessionToken), body: JSON.stringify(payload),
  });
  return response.json() as Promise<AdminResellerWalletActionResponse>;
}
```
- [ ] **Step 3:** `npm --workspace @afrows/dashboard run typecheck` → CLEAN.
- [ ] **Step 4:** Commit `git commit -m "feat(dashboard): admin reseller API wrappers"`

---

### Task 4: ResellersPage

**Files:** create `apps/dashboard/src/pages/ResellersPage.tsx`

- [ ] **Step 1:** Create the page (list + add-panel + top-up/edit/ledger; mirror CustomersPage patterns — `DataTable`, `inputClass`, money via `toLocaleString`):
```tsx
import { useEffect, useMemo, useState } from 'react';
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
  useEffect(() => { void load(); }, [sessionToken]);

  // reseller-role users not yet linked to a reseller account
  const availableLogins = useMemo(() => {
    const linked = new Set(rows.map((r) => r.adminUserId));
    return resellerUsers.filter((u) => !linked.has(u.id));
  }, [rows, resellerUsers]);

  const onCreate = async () => {
    if (!adminUserId || !displayName.trim()) return;
    setBusy(true); setError(null);
    try {
      await createAdminReseller(sessionToken, {
        adminUserId,
        displayName: displayName.trim(),
        sellerMarginBps: Math.round((Number(marginPct) || 0) * 100),
        currency: currency.trim() || 'IRT',
        creditLimitAmount: Math.round(Number(creditLimit) || 0),
      });
      setShowAdd(false); setAdminUserId(''); setDisplayName(''); setMarginPct('20'); setCreditLimit('0');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const onTopUp = async (id: string) => {
    const amount = Math.round(Number(topUpAmount) || 0);
    if (amount <= 0) return;
    setBusy(true); setError(null);
    try {
      await topUpResellerWallet(sessionToken, id, { amount });
      setTopUpFor(null); setTopUpAmount('');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const onToggleStatus = async (r: AdminResellerAccountSummary) => {
    const next = r.status === 'active' ? 'disabled' : 'active';
    setError(null);
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: next } : x)));
    try { await updateAdminReseller(sessionToken, r.id, { status: next }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); await load(); }
  };

  const openLedger = async (id: string) => {
    setLedgerFor(id); setLedger([]);
    try { const res = await fetchResellerWalletLedger(sessionToken, id); setLedger(res.entries); } catch { /* ignore */ }
  };

  const money = (n: number, cur: string) => `${n.toLocaleString()} ${cur}`;

  const columns: Array<DataTableColumn<AdminResellerAccountSummary>> = [
    { key: 'name', header: s.colName, render: (r) => (
      <span><strong className="block text-afro-ink">{r.displayName}</strong>
        <span className="text-[12px] text-afro-muted">{r.contactName || r.telegramUsername || '—'}</span></span>
    ) },
    { key: 'margin', header: s.colMargin, alignRight: true, render: (r) => `${r.sellerMarginPercent}%` },
    { key: 'wallet', header: s.colWallet, alignRight: true, render: (r) => (
      <span className="text-[12px]"><strong>{money(r.balanceAmount, r.currency)}</strong>
        <span className="block text-afro-muted">{money(r.availableBalanceAmount, r.currency)} {s.available}</span></span>
    ) },
    { key: 'customers', header: s.colCustomers, alignRight: true, render: (r) => `${r.activeCustomerAccountCount} / ${r.customerAccountCount}` },
    { key: 'status', header: s.colStatus, render: (r) => {
      const on = r.status === 'active';
      return (
        <span className="inline-flex items-center gap-2">
          <button type="button" role="switch" aria-checked={on} onClick={() => void onToggleStatus(r)}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full ${on ? 'bg-afro-teal' : 'bg-afro-line'}`}>
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
          </button>
          <span className="text-[12px] text-afro-muted">{String(r.status)}</span>
        </span>
      );
    } },
    { key: 'actions', header: s.colActions, alignRight: true, render: (r) => (
      <div className="flex items-center justify-end gap-1.5">
        <button type="button" onClick={() => { setTopUpFor(r.id); setTopUpAmount(''); }} className="inline-flex h-8 items-center rounded-md border border-afro-line px-2 text-xs font-bold hover:border-afro-teal hover:text-afro-teal">{s.topUp}</button>
        <button type="button" onClick={() => void openLedger(r.id)} className="inline-flex h-8 items-center rounded-md border border-afro-line px-2 text-xs font-bold hover:border-afro-teal hover:text-afro-teal">{s.ledger}</button>
      </div>
    ) },
  ];

  return (
    <section className="grid gap-4">
      {error ? <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</div> : null}
      <div className="flex items-center justify-between">
        <PanelHeading title={s.colName} />
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
          <div className="md:col-span-2"><button type="button" disabled={busy || !adminUserId || !displayName.trim()} onClick={() => void onCreate()} className="inline-flex min-h-9 items-center rounded-md bg-afro-teal px-4 text-sm font-bold text-white disabled:opacity-50">{s.create}</button></div>
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
          <div className="flex items-center justify-between"><strong className="text-[13px]">{s.ledger}</strong>
            <button type="button" onClick={() => setLedgerFor(null)} className="text-[12px] font-bold text-afro-muted hover:text-afro-ink">{s.cancel}</button></div>
          {ledger.length === 0 ? <span className="text-[12px] text-afro-muted">{s.ledgerEmpty}</span> : ledger.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-afro-line/60 py-1 text-[12px]">
              <span className="font-bold uppercase tracking-wide">{e.entryType}</span>
              <span dir="ltr">{e.amount.toLocaleString()} {e.currency}</span>
              <span className="text-afro-muted">{e.customerDisplayName || e.volumePackageName || e.source}</span>
              <span className="text-afro-muted">{new Date(e.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      ) : null}

      {rows.length === 0 ? <EmptyState title={s.empty} /> : <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} minWidth="820px" />}
    </section>
  );
}
```
> NOTE: confirm `EmptyState`/`PanelHeading`/`DataTable` import names + `EmptyState` prop (`title`) against `CustomersPage.tsx`; align if different. `format` prop is accepted but unused now (kept for signature parity / future) — if tsc's config flags unused params it won't (matches other pages), but drop it if it complains.

- [ ] **Step 2:** `npm --workspace @afrows/dashboard run typecheck` → CLEAN. Fix any import-name mismatches per the NOTE.
- [ ] **Step 3:** Commit `git commit -m "feat(dashboard): ResellersPage (list/create/top-up/ledger/status)"`

---

### Task 5: Wire DashboardApp

**Files:** `apps/dashboard/src/DashboardApp.tsx`

- [ ] **Step 1:** Import `import { ResellersPage } from './pages/ResellersPage';`
- [ ] **Step 2:** `ROUTE_VIEWS` — append `'resellers'`.
- [ ] **Step 3:** Add a render case in `ActivePage`'s switch (near `case 'customers'`):
```tsx
    case 'resellers':
      return <ResellersPage format={format} sessionToken={sessionToken} t={t} />;
```
- [ ] **Step 4:** Gates: `typecheck` clean; `node --test … nav-views.test.ts` pass 5; `build` clean.
- [ ] **Step 5:** Commit `git commit -m "feat(dashboard): render Resellers view + route key"`

---

### Task 6: Deploy + manual verification

- [ ] **Step 1:** Merge to `main`, push, `sync.ps1`; confirm backend health + `GET /admin/resellers` responds.
- [ ] **Step 2:** Admins page → create a user with role **reseller** (login). Resellers page → **Add reseller** linked to that user, margin 20% → appears in the list.
- [ ] **Step 3:** **Top up** the wallet → balance rises; **Ledger** shows the top-up entry. **Toggle status** off/on. **Edit** margin (if edit wired) persists.
- [ ] **Step 4:** Log in as that reseller → their workspace shows the wallet/margin; they can create + sell a customer (debits wallet).
- [ ] **Step 5:** FA renders all strings.

---

## Self-Review

**1. Spec coverage:** list/create/top-up/ledger/status (T4); nav + Main placement (T1); icon + i18n (T2); API wrappers over existing endpoints (T3); render + route (T5); verify reseller end-to-end (T6). ✓ (Per-reseller customer filtering noted optional in spec — deferred.)
**2. Placeholders:** ResellersPage + wrappers written in full; the one NOTE is a concrete import-name verification. ✓
**3. Type consistency:** wrappers' return types (T3) match the page's usage (T4); `CreateResellerAccountRequest` fields (adminUserId/displayName/sellerMarginBps/currency/creditLimitAmount) match the create form; `resellers` ActiveView (T1) used in nav/ROUTE_VIEWS/case (T5); `resellersPage` i18n keys (T2) match `s.*` usage (T4). Margin shown as `sellerMarginPercent`, created from `marginPct*100` bps. ✓
