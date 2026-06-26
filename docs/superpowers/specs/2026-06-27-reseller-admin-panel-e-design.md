# Reseller admin panel (sub-project E) — design

**Date:** 2026-06-27
**Status:** Approved (brainstorm + audit) → ready for implementation plan
**Part of:** dashboard UX overhaul. **E** = the admin-facing Resellers (نمایندگی) management UI.

## Problem / audit finding

The reseller backend is **fully built** — `/admin/resellers` CRUD, wallet **top-up + ledger + package-debit**, reseller **workspace**, `reseller` admin-role auth, margin (`sellerMarginBps`) + credit limits + package sales; all shared types exist. The **reseller-side** dashboard also works (a `reseller` login gets their scoped workspace). The only gap is the **admin-facing UI**: no page, no API wrappers, no nav entry for an admin to create/manage resellers, top up wallets, or view ledgers. So E is dashboard-only — wire the admin UI to the existing backend (same shape as D1).

## Goal (E)

A new **Resellers** page (Main nav) where an admin can:
1. **List** resellers — display name, margin %, wallet balance + credit limit + available, customers (active/total), status.
2. **Create** a reseller account — choose an existing **`reseller`-role admin user** (the login; created on the Admins page) + set margin %, currency, credit limit → `POST /admin/resellers`.
3. **Top up** a reseller's wallet (`POST /admin/resellers/:id/wallet/topups`) + **view the wallet ledger** (`GET .../wallet-ledger`).
4. **Edit** margin / status / credit limit (`PATCH /admin/resellers/:id`).

No backend changes. The Admins page already offers the `reseller` role (`managedAdminRoles` includes it), so the login prerequisite is met.

## Design

### Nav
- Add `ActiveView` **`resellers`**; add to `MAIN_VIEWS` (after `billing` — it's a sales/business entity). `nav-config` icon (e.g. `Store` or `Handshake` from lucide). `nav.resellers` + `pageHeaders.resellers` i18n (en + fa).
- `ROUTE_VIEWS` gains `resellers` (deep-linkable).

### API wrappers (`apps/dashboard/src/api/admin.ts`) — all against existing endpoints
- `fetchAdminResellers(token)` → `AdminResellerAccountsResponse`
- `createAdminReseller(token, payload: CreateResellerAccountRequest)` → `AdminResellerAccountSummary`
- `updateAdminReseller(token, id, payload: UpdateResellerAccountRequest)` → `AdminResellerAccountSummary`
- `fetchResellerWalletLedger(token, id)` → `AdminResellerWalletLedgerResponse`
- `topUpResellerWallet(token, id, payload: TopUpResellerWalletRequest)` → `AdminResellerWalletActionResponse`
- (reuse existing `fetchAdminUsers` to populate the reseller-login picker, filtered to `role === 'reseller'`.)

### `ResellersPage` (new)
- **Table** (DataTable): name (+ contact/telegram), **margin** (`sellerMarginBps/100`%), **wallet** (`balanceAmount` / credit `creditLimitAmount`, available `availableBalanceAmount`) shown with `currency`, **customers** (`activeCustomerAccountCount`/`customerAccountCount`), **status** (active/suspended/disabled). Right-aligned money; status badge.
- **Add reseller** (form/panel): a `<select>` of reseller-role admin users (from `fetchAdminUsers`; show only those not already linked to a reseller), `displayName`, **margin %** (→ bps), `currency` (default IRT), `creditLimitAmount`, optional contact/telegram/notes → `createAdminReseller`. If no reseller-role users exist, show a hint to create one on the **Admins** page first.
- **Per-row actions:**
  - **Top up**: amount input → `topUpResellerWallet` (shows new balance).
  - **Ledger**: expand/drawer listing `AdminResellerWalletLedgerEntry[]` (type, amount, balance-after, source, customer/package, date).
  - **Edit**: margin %, status, credit limit → `updateAdminReseller`.
  - **Open customers**: jump to Customers filtered to this reseller (best-effort; or just show the count for now).
- Money/percent: margin stored as bps (show/edit as %); amounts are integers in the reseller `currency` (IRT/toman) — display with `toLocaleString`.

### i18n
`nav.resellers`, `pageHeaders.resellers`, and a `resellersPage` group (column headers, add-form labels, top-up, ledger, edit, "create a reseller login first" hint) — en + fa.

## Non-goals
- No backend changes (all endpoints exist).
- Not rebuilding the reseller-side workspace (already works).
- Per-reseller customer **filtering** in the Customers page is optional/best-effort (the `resellerAccountId`/`resellerDisplayName` fields exist on customers; a deep filter can be a follow-up).

## Testing
- **Unit (extend `nav-views.test.ts`):** `resellers` in Main; sidebar membership updated.
- **Gates:** `tsc --noEmit` + `vite build`.
- **Manual:** create a `reseller`-role admin user (Admins) → Resellers page → Add reseller linked to that user with a margin → appears in the list → top up wallet (balance rises, ledger entry) → edit margin/status → log in as that reseller and confirm their workspace shows the wallet/margin. FA renders.

## Rollout
Dashboard-only, reversible (remove the nav entry). Ships with the next deploy.
