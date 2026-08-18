# Schema Consistency Audit — Drizzle ORM vs. Migrations

**Date:** 2026-08-18 · **Scope:** read-only audit. No database, migrations, or runtime SQL changed.

## Context

The backend accesses Postgres almost entirely through **raw parameterized SQL** via
`DatabaseService.query()/transaction()` (`apps/backend/src/database/database.service.ts:8-54`),
**not** the Drizzle query builder. `apps/backend/src/database/schema.ts` defines **38 `pgTable`
entities** used for typing/`drizzle-kit`-free documentation. Because migrations are hand-authored
(applied by `apps/backend/scripts/migrate.mjs`) and `schema.ts` is maintained by hand, the ORM model
has **drifted** from the authoritative migration history in two ways:

1. **13 tables exist in migrations with no `pgTable` entity.**
2. **Two mapped entities (`customer_accounts`, `outbounds`) are missing columns their migrations added.**

Migrations are the authoritative source of truth throughout this audit.

## Universal facts

- All 13 tables are accessed only via raw SQL through `DatabaseService` (`database.service.ts`). None use Drizzle query-builder or a repository abstraction.
- Foreign keys from these raw tables into ORM-mapped tables are **invisible to the Drizzle relations graph** — the ORM cannot see cascades/joins the database enforces.

## Table-by-table verdict

| # | Table | Class | Drift | Invisible FK → mapped entity | Row-type coverage |
|---|---|---|---|---|---|
| 1 | reseller_wallet_topup_requests | A | Critical | reseller_accounts (CASCADE), reseller_wallet_ledger (SET NULL) | `ResellerTopupRequestRow` |
| 2 | mikrotik_routers | A | Critical | customer_accounts (SET NULL) | `RouterRow` (hand-synced across 3 ALTERs) |
| 3 | gems_ledger | A | High | customer_accounts (CASCADE) | none (inline shapes) |
| 4 | telegram_topup_requests | A | High | customer_accounts (CASCADE), volume_packages | `TopupRequestRow`/`TopupListRow` |
| 5 | outbound_subscriptions | A | High | ← `outbounds.subscription_id` (CASCADE, incoming) | `OutboundSubscriptionRow` |
| 6 | wireguard_peers | A | High | client_configs (CASCADE) | `WireguardPeerRecord` (partial) |
| 7 | client_device_sightings | A (borderline B) | Medium | client_configs (CASCADE) | none (inline) |
| 8 | telegram_users | A (+ D caveat) | Medium | none (ad-hoc `telegram_id` join) | `TelegramUserRow` |
| 9 | mikrotik_wg_samples | B | Medium | none | none (inline) |
| 10 | mikrotik_gateway_usage_cursor | B | Low-Med | mikrotik_routers (both raw) | none (inline) |
| 11 | mikrotik_wg_rates | B | Low | none | none (inline) |
| 12 | outbound_test_settings | B | Low | none | none (inline) |
| 13 | egress_tier_prices | B | Low | none | none (inline) |

**Classification key:** A = clearly missing from Drizzle, should have a `pgTable`. B = intentionally
raw-SQL-only (telemetry / composite-key config / singleton). C = legacy/obsolete (none found — all
actively used). D = unclear, needs human review.

**Tally:** 8× A, 5× B, 0× C, 1× D caveat (`telegram_users` natural text PK modeling).

## DDL highlights (from the authoritative migrations)

- **wireguard_peers** (0033/0034/0047): 16 cols, uuid PK, FK `client_config_id → client_configs(id) CASCADE`; CHECKs (`desired_state`, `rx/tx_bytes >= 0`); 4 indexes; metered counters + `endpoint_ip` added by ALTERs. Written transactionally in `billing.service.ts:5758+`, metered in `client/wireguard-metering.service.ts`.
- **mikrotik_routers** (0038/0041/0042/0045): text (caller-supplied) PK; FK `customer_account_id → customer_accounts(id) SET NULL`; CHECKs on `kind`/`role`/`rest_port`; evolved through 3 ALTERs; `RouterRow` at `routers.service.ts:26` hand-synced.
- **gems_ledger** (0053): uuid PK, FK `customer_account_id → customer_accounts(id) CASCADE`; append-only; `reason` enum enforced only in TS (`GemsReason`, `billing/gems.ts:49`), not in DB.
- **telegram_topup_requests** (0052): uuid PK; FKs to `customer_accounts` (CASCADE) + `volume_packages`; status CHECK-enum; `FOR UPDATE` approval flow in `telegram/telegram-topup.ts`.
- **reseller_wallet_topup_requests** (0054): uuid PK; FKs to `reseller_accounts` (CASCADE) + `reseller_wallet_ledger` (SET NULL); `bytea` receipt; `FOR UPDATE` state machine in `billing/reseller-topup.ts`.
- **outbound_subscriptions** (0032): uuid PK; conventional; referenced BY `outbounds.subscription_id` (CASCADE) — a column the mapped `outbounds` entity omits.
- **telegram_users** (0052/0053): text natural PK `telegram_id`; jsonb `state`; `language` NULL/CHECK relaxed in 0053.
- **client_device_sightings** (0047): uuid PK; FK `client_config_id → client_configs(id) CASCADE`; upsert + retention prune.
- **mikrotik_wg_samples** (0039): bigserial PK, append-only telemetry, no FK. **mikrotik_wg_rates** (0040) / **mikrotik_gateway_usage_cursor** (0045): composite natural PKs, UPSERT config/cursor. **outbound_test_settings** (0029/0050): boolean singleton PK. **egress_tier_prices** (0037): text `tier` PK, 2-row lookup.

## Cross-cutting finding — mapped entities are also wrong

Verified (0 occurrences in `schema.ts`, present in migrations):

- **`customer_accounts`** entity missing: `phone`, `gems_balance`, `referral_code`, `referred_by` (self-FK), `egress_tier` (migrations 0053, 0036).
- **`outbounds`** entity missing: `subscription_id` (FK → outbound_subscriptions CASCADE), `subscription_key`, `latest_down_mbps`, `latest_up_mbps`, `last_speed_test_at`, `speed_test_requested_at` (migrations 0032, 0029).

The ORM is silently wrong about two of the busiest tables, including a self-referential FK and a cross-table CASCADE it cannot see.

## Invisible FK map (raw → ORM graph)

- wireguard_peers, client_device_sightings → `client_configs` (CASCADE)
- mikrotik_routers → `customer_accounts` (SET NULL)
- telegram_topup_requests → `customer_accounts` (CASCADE), `volume_packages`
- gems_ledger → `customer_accounts` (CASCADE)
- reseller_wallet_topup_requests → `reseller_accounts` (CASCADE), `reseller_wallet_ledger` (SET NULL)
- outbounds.subscription_id → outbound_subscriptions (CASCADE, incoming; omitted by the mapped `outbounds` entity)
- mikrotik_gateway_usage_cursor → mikrotik_routers (both raw — chain entirely outside ORM)

## Top 5 for immediate investigation

1. **reseller_wallet_topup_requests** — money flow; two ORM-invisible FKs (one into the wallet ledger).
2. **mikrotik_routers** — 3 ALTERs; hand-synced `RouterRow`; FK into `customer_accounts`.
3. **`customer_accounts` / `outbounds` column drift** — the ORM actively misrepresents live tables.
4. **gems_ledger** — financial audit trail backing cached `gems_balance`; CASCADE from `customer_accounts`; no named row type.
5. **telegram_topup_requests** — financial approval path; status CHECK-enum; two FKs into mapped tables.

## Does adding `pgTable` help type-safety or create conflicts?

- **No conflict:** the app runs on raw SQL, so a `pgTable` doesn't compete with a query builder that isn't used. It becomes the **declarative schema-of-record** + a source for **derived row types** (`InferSelectModel`) to replace today's hand-maintained/inline shapes (the real drift hazard).
- **Benefit (class A):** one source of truth for columns/constraints/FKs; compile-time coverage of the financial rows; drift detectable.
- **Low value (class B):** telemetry/composite-key/singleton idioms gain little from ORM modeling.
- **Caveat:** adding entities changes nothing at runtime unless the derived types are actually used; and this repo has no `drizzle-kit`, so parity must be checked against migrations, not a generated introspection.

## Phased plan (proposal)

- **Phase 0 (this change):** fix the drifted mapped entities — add the missing columns to `customerAccounts` and `outbounds`. No new tables, no runtime/SQL/migration changes.
- **Phase 1:** money/audit class-A tables — `reseller_wallet_topup_requests`, `gems_ledger`, `telegram_topup_requests` (+ `relations()` so cascades become ORM-visible).
- **Phase 2:** remaining class-A — `mikrotik_routers`, `wireguard_peers`, `client_device_sightings`, `outbound_subscriptions`; confirm `telegram_users` natural-key intent (D caveat).
- **Keep raw-SQL-only:** `mikrotik_wg_samples`, `mikrotik_wg_rates`, `mikrotik_gateway_usage_cursor`, `outbound_test_settings`, `egress_tier_prices` — document as intentional idioms.

**Guardrails:** never `push`/`generate`/`migrate`; keep self-contained `node --test` modules (`gems.ts`, `telegram-topup.ts`) on type-only schema imports; land each phase behind the existing test suite.

## Remediation status (mapped-entity drift)

**Phase 0 (done):** added to `customerAccounts` — `phone`, `gems_balance`, `referral_code`, `referred_by` (self-FK), `egress_tier`; to `outbounds` — `subscription_id`, `subscription_key`, `latest_down_mbps`, `latest_up_mbps`, `last_speed_test_at`, `speed_test_requested_at`. `outbounds` reached full parity (28/28).

**Phase 0.5 (done):** added the 6 remaining `customerAccounts` columns discovered post-Phase-0 — all migration-authoritative:

| Column | Type | Null | Default | Migration | Index/notes |
|---|---|---|---|---|---|
| `login_email` | text | NULL | — | 0030 | UNIQUE `customer_accounts_login_email_key` on `lower(login_email)` WHERE not null |
| `password_hash` | text | NULL | — | 0030 | hash only, never plaintext |
| `password_set_at` | timestamptz | NULL | — | 0030 | set to `now()` when password set |
| `gaming_entitled` | boolean | NOT NULL | `false` | 0043 | admin entitlement; active on/off is `egress_tier` |
| `expires_at` | timestamptz | NULL | — | 0044 | NULL = never; past = cannot log in |
| `deleted_at` | timestamptz | NULL | — | 0051 | NULL = live; non-NULL = archived; partial index `customer_accounts_active_created_idx` |

**Phase 0.6 (done):** modeled the final column — `tags text[] NOT NULL DEFAULT '{}'` (migration 0044) as `text('tags').array().notNull().default([])` (Postgres `text[]` array, NOT jsonb — distinct from `servers.tags` which is jsonb). No index/constraint/CHECK on it. The original audit's parity regex had missed it (didn't handle the `text[]` array type).

**Current `customer_accounts` parity: 26 of 26 migration columns modeled — FULL migration-authoritative parity.** No column reverse drift (no ORM field absent from migrations). `outbounds` remains 28/28. Both previously-drifted mapped entities are now fully aligned.
