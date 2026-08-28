# Seller (Reseller) Feature — Implementation Checklist

**Goal:** Sellers log in and create/manage their own customers, billed against a wallet.
**Scope decisions (2026-08-28):**
- **Polish the current in-dashboard role-gated seller view** — NOT a separate portal/app/URL. Sellers use the same login + dashboard SPA and see only their scoped Overview / Customers / Revenue views.
- **Admin creates sellers** — no public self-signup. But streamline creation to ONE step (make the login + reseller account together).

> **Status legend:** ✅ already built · 🔴 P0 must-fix · 🟠 P1 core-completion · 🟡 P2 nice-to-have

> **PROGRESS (2026-08-28, branch `feat/reseller-hardening`):**
> - **P0 — DONE** (`801705a`): free-quota bypass closed via `stripResellerManagedQuotaFields` (strip, not reject, so edits round-trip); quota field read-only for resellers in the editor. 5 unit tests; full suite 710/710.
> - **P1a — DONE** (`5daba4b`): `POST /admin/reseller/customer-accounts/:id/reset-password` (IDOR-guarded) + "Reset login password" button.
> - **P1b — DONE** (`40cfe23`): one-step create-seller — `POST /admin/resellers` accepts `newLoginUsername`+`newLoginPassword`, creates the reseller-role login and links it; Sellers form gets a link-existing / create-new toggle.
> - **P0/P1a/P1b — DEPLOYED as 0.115.9** (live, smoke-tested).
> - **P2a — DONE** (`feat/reseller-caps`): per-seller customer cap (`max_customers`, migration 0058) enforced on both create paths; admin sets it at create + inline "Limit" editor + shown in the Customers column. Not yet deployed.
> - **P2b — SKIPPED (intentional):** reseller sale customers are always `normal` tier (the sale INSERT omits `egress_tier`), so tier-based pricing has nothing to price differently — dead code until "resellers sell a premium tier" is a feature. Revisit only if that's wanted.
> - **Remaining:** deploy P2a.

---

## 0. What already exists (do NOT rebuild)

Verified via code map, 2026-08-28. All refs are `file:line`.

| Capability | Status | Where |
|---|---|---|
| Reseller role + permissions (`dashboard:read, billing:read, customers:read/write, resellerWallet:read`) | ✅ | `packages/shared/src/index.ts:3,142-148` |
| Reseller login (reuses admin `/auth/login` + signed session; role recognized end-to-end) | ✅ | `apps/backend/src/auth/auth.service.ts:107-136,50,442` |
| Role-gated seller view (Overview/Customers/Revenue only) | ✅ | `apps/dashboard/src/DashboardApp.tsx:812,1516-1526`; `nav-views.ts:125-129` |
| Reseller creates/manages own customers (wallet-debited, IDOR-scoped) | ✅ | `billing.service.ts:2272-2418,2643+`; UI `BillingReseller.tsx:270-406` |
| Wallet: transactional debit, `FOR UPDATE`, ledger-backed, credit-limit enforced | ✅ | `billing.service.ts:2272-2418`; `reseller-wallet-math.ts:76-78` |
| Seller creates login-capable customers (`login_email`+password → `/client/login`) | ✅ | `billing.service.ts:3445-3497` |
| Wallet top-up request (receipt upload) + admin approval → credit | ✅ | `reseller-topup.ts:76-171`; UI `ResellerTopupRequestsPage.tsx` |
| Admin: create/list/edit sellers, top-up, ledger, enable/disable, drill-down | ✅ | `ResellersPage.tsx`; ctrl `billing.controller.ts:492-578` |
| "Sign in as seller" impersonation (superadmin-only) | ✅ | `billing.controller.ts:597-610`; `auth/impersonation.ts:32-48` |

**Net:** the core "seller logs in and creates their own users" loop is complete. Remaining work is closing gaps.

---

## 1. 🔴 P0 — Close the free-quota bypass (billing integrity)

**Problem:** `POST /admin/reseller/customer-accounts` → `createResellerCustomerAccount` (`billing.service.ts:2630-2641`) creates a customer with **no wallet debit** and **no quota restriction** — `assertResellerCustomerPayload` (`9453-9460`) only blocks paid-number fields. A seller can hand out an arbitrary `quotaLimitBytes` for free, bypassing the metered GB-charge/package-sale paths (which DO block preset quota at `6486-6491`).

- [ ] **Decide the rule:** the bare create path should either (a) reject any preset `quotaLimitBytes > 0` / `usedBytes > 0` (mirror `6486-6491`), forcing quota to be granted only via a wallet-debiting sale; or (b) route the quota grant through the same wallet-debit as `createResellerGbCharge`. **Recommended: (a)** — simplest, keeps one billing path (`createResellerGbCharge` / `createResellerPackageSale`) authoritative for all metered grants.
- [ ] Extend `assertResellerCustomerPayload` (`billing.service.ts:9453-9460`) to reject `quotaLimitBytes`, `perClientLimitBytes`, `usedBytes` on the reseller create/update paths.
- [ ] Apply the same guard to `updateResellerCustomerAccount` (`2814-2821`) so a seller can't raise quota via PATCH either.
- [ ] **Acceptance:** a reseller POST/PATCH with `quotaLimitBytes>0` returns 400; the only way a seller grants data is a wallet-debiting GB-charge or package-sale; existing sale flows unaffected.
- [ ] **Test:** backend Jest covering both the bare-create and the PATCH path; assert wallet balance unchanged on create and quota==0 until a sale.

---

## 2. 🟠 P1 — Complete "manage their own users"

### 2a. Reseller-scoped customer password reset/rotate
Today a customer login password is only settable at creation; there is no reseller surface to rotate it. Admin logic exists (`resetCustomerAccountPassword` `billing.service.ts:4746-4757`, `SetCustomerAccountPasswordDto`).

- [ ] Add reseller endpoint `PATCH /admin/reseller/customer-accounts/:id/password` `@Roles('reseller')`, IDOR-guarded via `ensureCustomerAccountBelongsToReseller` (`reseller-ownership.ts:9-23`).
- [ ] Wire it to the existing reset logic; return the new password once (or accept a supplied one) per current admin behaviour.
- [ ] Dashboard: add a "Reset login password" action to the reseller customer row/editor (`BillingReseller.tsx` reseller customers table).
- [ ] **Acceptance:** seller resets only their OWN customer's password; cross-reseller id → 403; customer can log in at `/client/login` with the new password.

### 2b. One-step "Create seller" (login + reseller account together)
Today admin must first create a `reseller`-role user in Users, THEN link it in Sellers (`ResellersPage.tsx:84-87,278-288` only lists existing `availableLogins`).

- [ ] Backend: extend `POST /admin/resellers` (`billing.controller.ts:516-523`) to optionally create the `admin_users` login (role `reseller`, username + generated/supplied password) in the same transaction, then the `reseller_accounts` row linked by `admin_user_id`.
- [ ] Dashboard `ResellersPage.tsx`: add a "new login" mode to the create form (username + password) alongside the existing "link existing user" mode; surface the generated credential once.
- [ ] **Acceptance:** admin creates a working seller (login + wallet) in one action; the seller can immediately log in and reach their scoped view.

---

## 3. 🟡 P2 — Business controls (optional, do after P0/P1)

### 3a. Per-seller customer / GB cap
Only the wallet `credit_limit_amount` constrains a seller today; no customer-count or total-GB cap (`reseller_accounts` has no such column).

- [ ] Migration: add `max_customers int null` and/or `max_total_bytes bigint null` to `reseller_accounts`.
- [ ] Enforce in the create + sale paths; admin sets it in `ResellersPage.tsx`.
- [ ] **Acceptance:** seller over cap → 400 with a clear message; null = unlimited (current behaviour).

### 3b. Wire egress-tier pricing into reseller debits
`egress_tier_prices` (`0037_egress_tier_prices.sql`) exists but the reseller debit math uses only `billing_settings.price_per_gb` — gaming-tier customers aren't priced higher for the seller.

- [ ] In the GB-charge/package-sale quote (`reseller-wallet-math.ts`), price by the customer's `egress_tier`.
- [ ] **Acceptance:** a gaming-tier sale debits the seller at the gaming price; normal tier unchanged.

---

## 4. Verification / regression gate (all phases)

- [ ] `npm --workspace @afrows/backend run typecheck` clean.
- [ ] `npm run test:backend` green (new tests for P0/P1 included).
- [ ] Manual: admin creates a seller (one step) → seller logs in → creates a customer via a package/GB sale (wallet debits) → attempts a free high-quota create (blocked) → resets that customer's password → customer logs in.
- [ ] CHANGELOG + VERSION bump per release ritual.

---

## Out of scope (per 2026-08-28 decisions)
- Separate seller portal app / branded login / subdomain.
- Public seller self-signup / onboarding queue.
- Reseller sub-users / staff logins under a seller.
