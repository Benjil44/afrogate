# Customer-owned MikroTik gateways — design

**Date:** 2026-06-21
**Status:** Approved (brainstorm) → ready for implementation plan

## Problem

The "Microtiks" panel models every MikroTik as pure operator infrastructure. The
`mikrotik_routers` table has a `kind` (`village` / `home` / `other`), a Game/Normal
toggle, and an "Afrows internet" on/off toggle — but **no link to a customer**, and
no notion of a router's *direction/role*. So:

- `home ac3` and `office ax3` route their LAN clients **out through Afrows** (they
  are effectively customers consuming an Afrows data plan), yet nothing ties them
  to a `customer_account`, their usage isn't billed to anyone, and the table can't
  show who owns them or that they're connected.
- `village ax3` is the opposite: it's the **ingress/transport hub** Afrows egresses
  *through* (Afrows → village → Germany/Starlink). It is infrastructure, not a
  customer — but the table doesn't make this distinction explicit.

The operator wants a router like `home` to belong to a customer (e.g. `home` → Ben),
with usage billed to that account, control tied to the account's state, and clear
visibility in both the Routers and Customers tables.

## Goals

Visibility **+** billing **+** control:

1. **Role** — every router is explicitly `transport` or `gateway`.
2. **Ownership** — a `gateway` router links to a `customer_account`; `transport` does not.
3. **Billing** — a gateway's Afrows usage counts against its linked customer's quota.
4. **Control** — an expired/over-quota customer auto-disables its gateway's Afrows egress (with an alert).
5. **Visibility** — Routers table shows Role + Customer; Customers view shows the owned router + live connection state.

## Non-goals (YAGNI)

- Per-LAN-device accounting on the router (we meter the whole-LAN WG tunnel aggregate).
- Auto re-enable after renewal — re-enabling is **manual** (operator flips Afrows internet back on).
- Any change to the village/transport egress behavior (it stays "Locked / Always on").

## Current-state references

- Schema/table: `infra/postgres/migrations/0038_mikrotik_routers.sql`,
  `apps/backend/src/database/schema.ts` (`mikrotik_routers`, `customer_accounts`).
- Router service: `apps/backend/src/routers/routers.service.ts`
  - `setEgress()` toggles the router-side `afrows-egress` mangle rule via REST and
    writes `egress_enabled` (~line 186). Village is guarded by `assertNotPrimary` (kind==='village').
  - `kind` CHECK is `('village','home','other')`.
- Usage sampling: `apps/backend/src/routers/router-usage-sampler.service.ts` snapshots
  every managed router's `/interface/wireguard/peers` rx/tx into `mikrotik_wg_samples`
  (migration 0039) every ~15 min; per-tunnel rates in `mikrotik_wg_rates` (0040).
- Customer account fields: `customer_accounts.quota_limit_bytes`, `used_bytes`,
  `expires_at`, `status` (`apps/backend/src/database/schema.ts`).
- Customer usage delta model: `client_usage_events` (`used_bytes_delta`, reset-aware) —
  the pattern the gateway meter follows.
- Dashboard: `apps/dashboard/src/pages/MicrotiksPage.tsx` (table + Edit dialog),
  `apps/dashboard/src/pages/CustomersPage.tsx` (customer table).

## Design

### 1. Data model

Migration `00NN_mikrotik_router_customer.sql`:

```sql
ALTER TABLE mikrotik_routers
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'gateway',
  ADD COLUMN IF NOT EXISTS customer_account_id uuid
    REFERENCES customer_accounts(id) ON DELETE SET NULL;

-- backfill: existing village = transport, everything else = gateway
UPDATE mikrotik_routers SET role = 'transport' WHERE kind = 'village';

ALTER TABLE mikrotik_routers
  ADD CONSTRAINT mikrotik_routers_role_chk CHECK (role IN ('transport','gateway'));
```

Service-enforced invariants (not DB-level, so a gateway can be created then linked):

- `role='transport'` ⇒ `customer_account_id` MUST be null (reject otherwise).
- `role='gateway'` MAY have `customer_account_id` null = **unassigned** (allowed,
  surfaced in UI; no billing/control until linked).
- A `transport` router keeps the existing `assertNotPrimary` protections; `kind='village'`
  is forced to `role='transport'`.

### 2. Metering (billing)

A periodic reconciler — `GatewayBillingService` (NestJS interval, reuse the
existing sampler cadence or run just after it) — for each `gateway` router with a
linked customer:

- Resolve the router's **Afrows tunnel** sample: the WG peer in `mikrotik_wg_samples`
  representing the router↔Afrows link (the peer whose endpoint/allowed-ips point at
  Afrows; the implementation plan pins the exact selector per router). Usage = rx+tx.
- Compute the **delta** since the last processed sample for that tunnel (reset-aware:
  if the new absolute counter < previous, treat the new value as the delta — same
  logic as `routers.service.ts` WG usage and the client usage-event model).
- Add the delta to the linked customer's `customer_accounts.used_bytes` and write a
  `client_usage_events`-style audit row (source = `mikrotik_gateway`, carries the
  router id) so the charge is traceable.
- Persist a per-tunnel cursor (last absolute counter + sample id) so deltas aren't
  double-counted across cycles. Cursor lives in a small table or a column on the
  router row (decide in the plan).

### 3. Control (enforcement)

Same reconciler cycle, after metering, for each gateway with a linked customer:

- Violation = customer `expires_at` in the past **OR** (`quota_limit_bytes` set AND
  `used_bytes ≥ quota_limit_bytes`) **OR** `status` not active.
- If violation AND `egress_enabled = true`: call the existing `setEgress(router, false)`
  (disables the router-side `afrows-egress` mangle rule via REST — LAN falls back to
  its own local internet, not a hard cut) and raise an alert.
- Re-enable is **manual**: the operator flips "Afrows internet" back on after
  renewal/top-up. The reconciler never auto-re-enables.
- Idempotent: only acts when state needs to change; if the router is unreachable,
  `setEgress` still records the intended state (existing behavior) and the alert fires.

### 4. Alerts

New alert type `gateway_customer_blocked` (fits the existing alert engine):
- Fired when the reconciler disables a gateway for an expired/over-quota customer.
- Payload: router id/label, customer id/display name, reason (expired | over_quota | inactive).

### 5. API

Router DTOs/summaries (`apps/backend/src/routers/…` + shared types):
- Create/Update accept `role` and `customerAccountId` (with the invariants above).
- Router summary returns `role`, `customerAccountId`, `customerDisplayName`, and the
  existing live `online`/status — so the table can render Role + Customer + connected.
- Customer detail/list returns any owned gateway routers (id, label, online) so the
  Customers view can show "MikroTik: home ac3 · connected".

### 6. UI

**`MicrotiksPage.tsx`** — Routers table:
- New **Role** column: `Transport` (village) / `Gateway` (home, office).
- New **Customer** column: linked display name (e.g. "Ben"); "— unassigned" for a
  gateway with no customer; "—" for transport.
- Edit dialog: a **Role** selector (Transport/Gateway) and a **Customer** picker
  (searchable account list; hidden/disabled when Role = Transport).

**`CustomersPage.tsx`** — customer table/detail:
- For an account that owns a gateway, show a **"MikroTik: <label> · connected/offline"**
  indicator (green/red from the router's live status).

## Data flow

```
RouterUsageSamplerService (~15m)
  → mikrotik_wg_samples (per-tunnel rx/tx)
      → GatewayBillingService (interval)
          → delta vs cursor → customer_accounts.used_bytes += delta
          → write usage-event audit row (source=mikrotik_gateway)
          → if customer expired/over-quota & egress on → setEgress(false) + alert
Dashboard
  → router summary (role, customer, online) → Routers table columns
  → customer detail (owned gateway + online) → Customers indicator
```

## Testing

- **Unit:** role/customer invariants (transport rejects a customer; gateway allows
  null); delta computation incl. counter reset; violation predicate (expired / over
  quota / inactive); enforcement only flips when state changes; idempotent re-runs.
- **Integration:** create a gateway, link a customer, feed two WG samples → customer
  `used_bytes` increases by the delta and a usage-event row exists; push the customer
  over quota → next cycle disables egress (mock REST) and emits the alert; renew →
  reconciler does NOT auto-re-enable.
- **Typecheck:** backend `tsc`, dashboard `tsc`, shared build (the project's gates).

## Rollout

- Additive migration (defaults + backfill); safe to deploy before the UI.
- After deploy: set `home ac3` → role `gateway`, customer = Ben; `office ax3` →
  gateway, customer = (office account); `village` stays transport (auto-backfilled).
- No change to village/transport egress behavior.
