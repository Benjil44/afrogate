# Reseller per-GB pricing + wallet-topup approval — plan

**Locked decisions (operator, 2026-07-27):**
- **Per-GB pricing.** Superadmin sets ONE **current price per GB** (the platform's *cost*), changeable anytime (raise it during a blackout, lower it later). No fixed packages for the reseller flow — resellers sell by GB amount.
- **Manual price control.** A single current value; every reseller sale + every reseller-facing display uses the current value.
- **Margin = markup on COST (flip the current model).** Reseller wallet is debited the **cost** (`GB × currentGbPrice`). The reseller sells to their own customer at `cost × (1 + margin)` and **keeps the markup as cash** — the platform never takes the markup, only the cost. (Current code debits `price − margin`; change to debit = cost, margin = markup the reseller keeps.)
- **Reseller tops up their wallet by card-to-card → superadmin approves** (mirror the Telegram deposit-slip → Top-ups approval flow), and the reseller panel **shows their available credit** + the markup they earn.

**Worked example (from the operator):**
- Superadmin sets GB price = **200,000**. Reseller wallet = 5,000,000.
- Reseller sells **20 GB** to a user → wallet debited `20 × 200,000 = 4,000,000` → balance 1,000,000.
- Reseller charges their user `20 × 240,000` (cost 200,000 + **40,000 markup/GB**) → keeps `20 × 40,000` cash.
- Platform only ever took the **200,000/GB cost**.

---

## What already exists (reuse)
- Reseller role + login; the dashboard shows a reseller their own panel (`ResellerDashboardPage`/`ResellerUsersPage`).
- Reseller **prepaid wallet** + ledger (`reseller_wallets`, migration 0028); admin `Resellers` page (create/top-up/ledger/status).
- Reseller **creates customers** (`POST /reseller/customer-accounts`) and **wallet debit** on sale (`createResellerPackageSale` → `computeResellerSaleAmounts` in `reseller-wallet-math.ts`).
- Telegram **deposit-slip → admin approval** pattern (`telegram_topup_requests`, Top-ups page) — mirror it for reseller wallet top-ups.
- `sellerMarginBps` per reseller (default 20%).

## To build

### 1. Per-GB price setting (superadmin)
- A current **GB price** (amount + currency) in billing settings (new column/setting), superadmin GET/PATCH endpoint, dashboard control (Settings or Billing → "Price per GB"). Audited. Changeable anytime.

### 2. Per-GB reseller sale (margin = markup on cost)
- Reseller grants a customer **N GB** → wallet debited `N × currentGbPrice` (the cost). Change `computeResellerSaleAmounts`/the sale path so **debit = cost** and `sellerMarginAmount = cost × marginBps` is the reseller's **kept markup** (informational, NOT debited). Quote returns: `gbPrice`, `gb`, `costAmount` (=walletDebit), `resellerSellPrice = cost × (1+margin)`, `marginAmount`.
- Reuse the reseller wallet debit + create-customer; add the GB-based charge.

### 3. Reseller wallet top-up via card-to-card + approval
- New `reseller_wallet_topup_requests` (id, reseller_account_id, amount, currency, receipt_file_id/receipt via upload, status pending/approved/rejected, created_at, reviewed_by/at, note). Reseller **requests** a top-up (amount + card-to-card receipt); superadmin **approves** → credits the wallet (existing `topUpResellerWallet` path) → notify the reseller.
- Endpoints: reseller `POST /reseller/wallet/topup-requests` (+ receipt upload), `GET` own; admin `GET /admin/reseller-topups?status=`, `POST …/:id/approve`, `…/:id/reject`, receipt view. Mirror the Telegram Top-ups controller/guards.
- Card-to-card destination: reuse the existing card-to-card setting (or a reseller-specific one).

### 4. Visibility
- **Reseller panel:** prominent "**Today: <gbPrice> / GB**", their **wallet balance/available credit**, their **margin %** and the markup they keep per GB; a "Top up wallet" (card-to-card request) action; per-GB sell form (enter GB → shows cost debited + their suggested sell price).
- **Superadmin:** the GB-price control; a **Reseller top-ups** approval surface (list + receipt + approve/reject), pending badge — like the Telegram Top-ups page.

### 5. Bilingual (fa/en) throughout; audited; keep the existing reseller/admin flows working.

## Phasing
1. Backend: GB-price setting + per-GB sale (margin-on-cost) + reseller-topup requests (table/endpoints/approval/credit) + workspace exposes gbPrice/credit + shared types + admin.ts.
2. Frontend: superadmin GB-price control + reseller-topups approval page; reseller panel (gb price + credit + per-GB sell + wallet top-up request).
3. QA + bilingual.

## Note
Deploy is gated on village power (SSH path is village-routed); build proceeds independently and deploys when the village is back.
