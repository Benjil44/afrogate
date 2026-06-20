# Customer-owned MikroTik gateways — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a `gateway` MikroTik (home/office) belong to a customer account — billing the router's Afrows usage to that customer, auto-disabling its Afrows egress when the customer is expired/over-quota, and showing role + owner + connection in the dashboard.

**Architecture:** Add `role` (transport|gateway) and `customer_account_id` to `mikrotik_routers`. A new `GatewayBillingService` (interval, after the usage sampler) sums each gateway's reset-aware WG-tunnel deltas from `mikrotik_wg_samples` into the linked customer's `customer_accounts.used_bytes` (via a per-peer cursor), then disables egress + raises an alert for expired/over-quota customers. Dashboard surfaces role/customer on the Routers table and the owned gateway on the Customers view.

**Tech Stack:** NestJS + raw SQL (pg), Postgres migrations, `@afrows/shared` types, React + Vite + TS dashboard. Backend tests: `node --test` (`test/**/*.test.ts`).

**Spec:** `docs/superpowers/specs/2026-06-21-customer-owned-mikrotik-gateways-design.md`

**Key existing references:**
- `apps/backend/src/routers/routers.service.ts` — `RouterRow` (L25), `create` (L69), `update` (L100), `setEgress` (~L186), `toSummary` (L497), reset-aware delta (L354-358), `sampleUsage`/`getWgUsage`.
- `apps/backend/src/routers/dto/router.dto.ts` — DTOs + `MIKROTIK_ROUTER_KINDS`.
- `apps/backend/src/alerts/alert-engine.service.ts:318` — alert upsert SQL.
- `apps/backend/src/database/schema.ts` — `mikrotik_routers`, `customer_accounts` (`quota_limit_bytes`, `used_bytes`, `expires_at`, `status`).
- `packages/shared/src/index.ts` — `MikroTikRouterSummary`, `CreateMikroTikRouterRequest`, `UpdateMikroTikRouterRequest`.
- `apps/dashboard/src/pages/MicrotiksPage.tsx`, `apps/dashboard/src/pages/CustomersPage.tsx`.

**Decision (resolves spec's open selector):** A gateway router's only WG tunnels are Afrows-bound (unlike the village's friend tunnels), so a gateway's Afrows usage = the **sum of all its peers'** reset-aware deltas in `mikrotik_wg_samples`. No per-peer Afrows selector is needed. The village stays `transport` and is never billed.

**Conventions:** run backend commands from `apps/backend`; build shared first when shared types change (`npm --workspace @afrows/shared run build`). Commit after each task.

---

## File Structure

- Create: `infra/postgres/migrations/0046_mikrotik_router_customer.sql` — role + customer link + cursor table.
- Modify: `packages/shared/src/index.ts` — add `MikroTikRouterRole`, extend router types.
- Modify: `apps/backend/src/routers/dto/router.dto.ts` — `role` + `customerAccountId` fields.
- Modify: `apps/backend/src/routers/routers.service.ts` — `RouterRow`, `create`/`update` (invariants), `toSummary` (role/customer).
- Create: `apps/backend/src/routers/gateway-billing.service.ts` — metering + enforcement logic.
- Create: `apps/backend/src/routers/gateway-billing.runner.ts` — NestJS interval that drives it.
- Modify: `apps/backend/src/app.module.ts` — register the new provider + runner.
- Modify: `apps/dashboard/src/pages/MicrotiksPage.tsx` — Role + Customer columns + Edit picker.
- Modify: `apps/dashboard/src/pages/CustomersPage.tsx` — owned-gateway indicator.
- Create tests: `apps/backend/test/gateway-billing.test.ts`, `apps/backend/test/router-customer-invariants.test.ts`.

---

## Task 1: Migration — role, customer link, billing cursor

**Files:**
- Create: `infra/postgres/migrations/0046_mikrotik_router_customer.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Customer-owned MikroTik gateways: explicit role + customer link + a per-peer
-- billing cursor so a gateway's Afrows WG usage is attributed (once) to its
-- customer's quota. village = transport (no customer); home/office = gateway.
ALTER TABLE mikrotik_routers
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'gateway',
  ADD COLUMN IF NOT EXISTS customer_account_id uuid
    REFERENCES customer_accounts(id) ON DELETE SET NULL;

UPDATE mikrotik_routers SET role = 'transport' WHERE kind = 'village';

DO $$ BEGIN
  ALTER TABLE mikrotik_routers
    ADD CONSTRAINT mikrotik_routers_role_chk CHECK (role IN ('transport','gateway'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS mikrotik_routers_customer_idx
  ON mikrotik_routers (customer_account_id);

-- Per-(router,peer) cursor of the last absolute WG counters already billed, so
-- repeated billing cycles only add the new delta.
CREATE TABLE IF NOT EXISTS mikrotik_gateway_usage_cursor (
  router_id  text NOT NULL REFERENCES mikrotik_routers(id) ON DELETE CASCADE,
  peer_key   text NOT NULL,
  last_rx    bigint NOT NULL DEFAULT 0,
  last_tx    bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (router_id, peer_key)
);
```

- [ ] **Step 2: Apply locally and verify** (if a local Postgres/migrate runner is available; otherwise this is applied on deploy by `db:migrate`)

Run: `cd apps/backend && node scripts/migrate.mjs`
Expected: migration `0046_mikrotik_router_customer` applied; no error. If no local DB, skip and rely on deploy (Task 9).

- [ ] **Step 3: Commit**

```bash
git add infra/postgres/migrations/0046_mikrotik_router_customer.sql
git commit -m "feat(db): mikrotik router role + customer link + gateway usage cursor"
```

---

## Task 2: Shared types — role + customer fields

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Add the role type and extend the router interfaces**

Find `MikroTikRouterKind` (near `MikroTikRouterSummary`) and add after it:

```ts
export type MikroTikRouterRole = 'transport' | 'gateway';
```

In `MikroTikRouterSummary` add (after `egressEnabled`):

```ts
  role: MikroTikRouterRole;
  customerAccountId?: string | null;
  customerDisplayName?: string | null;
```

In `CreateMikroTikRouterRequest` and `UpdateMikroTikRouterRequest` add (after `notes`):

```ts
  role?: MikroTikRouterRole;
  customerAccountId?: string | null;
```

Add a customer-facing summary of an owned gateway (used by the Customers view). Find `AdminCustomerAccountSummary` (or the customer account summary interface) and add a field:

```ts
  gatewayRouter?: { id: string; label: string; online: boolean } | null;
```

- [ ] **Step 2: Build shared**

Run: `npm --workspace @afrows/shared run build`
Expected: no TS errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): MikroTik router role + customer link types"
```

---

## Task 3: Router DTO + service invariants

**Files:**
- Modify: `apps/backend/src/routers/dto/router.dto.ts`
- Modify: `apps/backend/src/routers/routers.service.ts`
- Test: `apps/backend/test/router-customer-invariants.test.ts`

- [ ] **Step 1: Write the failing test** (`apps/backend/test/router-customer-invariants.test.ts`)

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRouterRoleAndCustomer } from '../src/routers/router-role.util';

test('transport router rejects a customer link', () => {
  assert.throws(() => resolveRouterRoleAndCustomer('transport', 'cust-1'), /transport router cannot have a customer/i);
});

test('gateway may be unassigned (null customer)', () => {
  assert.deepEqual(resolveRouterRoleAndCustomer('gateway', null), { role: 'gateway', customerAccountId: null });
});

test('gateway keeps its customer', () => {
  assert.deepEqual(resolveRouterRoleAndCustomer('gateway', 'cust-1'), { role: 'gateway', customerAccountId: 'cust-1' });
});

test('village kind forces transport role and null customer', () => {
  assert.deepEqual(resolveRouterRoleAndCustomer('gateway', 'cust-1', 'village'), { role: 'transport', customerAccountId: null });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/backend && node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON test/router-customer-invariants.test.ts`
Expected: FAIL — cannot find module `router-role.util`.

- [ ] **Step 3: Create the util** (`apps/backend/src/routers/router-role.util.ts`)

```ts
import { BadRequestException } from '@nestjs/common';
import type { MikroTikRouterRole } from '@afrows/shared';

/**
 * Normalizes a router's role + customer link, enforcing the invariants:
 * - kind 'village' is always a transport hub (no customer).
 * - transport routers must not have a customer.
 * - gateway routers may be unassigned (null customer) until linked.
 */
export function resolveRouterRoleAndCustomer(
  role: MikroTikRouterRole,
  customerAccountId: string | null | undefined,
  kind?: string | null,
): { role: MikroTikRouterRole; customerAccountId: string | null } {
  if (kind === 'village') return { role: 'transport', customerAccountId: null };
  const cust = customerAccountId && customerAccountId.trim() ? customerAccountId.trim() : null;
  if (role === 'transport') {
    if (cust) throw new BadRequestException('A transport router cannot have a customer');
    return { role: 'transport', customerAccountId: null };
  }
  return { role: 'gateway', customerAccountId: cust };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd apps/backend && node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON test/router-customer-invariants.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Add DTO fields** (`apps/backend/src/routers/dto/router.dto.ts`)

Add near the top:

```ts
export const MIKROTIK_ROUTER_ROLES = ['transport', 'gateway'] as const;
```

Add to BOTH `CreateMikroTikRouterDto` and `UpdateMikroTikRouterDto`:

```ts
  @IsOptional()
  @IsIn(MIKROTIK_ROUTER_ROLES)
  role?: (typeof MIKROTIK_ROUTER_ROLES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  customerAccountId?: string | null;
```

- [ ] **Step 6: Wire role/customer into the service** (`apps/backend/src/routers/routers.service.ts`)

Add to the imports:

```ts
import { resolveRouterRoleAndCustomer } from './router-role.util';
```

Add to `interface RouterRow` (after `egress_enabled`):

```ts
  role: string;
  customer_account_id: string | null;
```

In `create()`, before the INSERT, compute the resolved role/customer:

```ts
    const resolved = resolveRouterRoleAndCustomer(dto.role ?? 'gateway', dto.customerAccountId, dto.kind);
```

Add `role, customer_account_id` to the INSERT column list + values (`resolved.role`, `resolved.customerAccountId`). (Append two columns and two `$n` placeholders.)

In `update()`, after computing existing, add:

```ts
    if (dto.role !== undefined || dto.customerAccountId !== undefined) {
      const resolved = resolveRouterRoleAndCustomer(
        dto.role ?? (existing.role as 'transport' | 'gateway'),
        dto.customerAccountId !== undefined ? dto.customerAccountId : existing.customer_account_id,
        dto.kind ?? existing.kind,
      );
      set('role', resolved.role);
      set('customer_account_id', resolved.customerAccountId);
    }
```

- [ ] **Step 7: Enrich `toSummary` with role + customer name**

`listRouters()` currently maps rows to summaries individually. Change `listRouters` to first load a customer-name map, then pass it to `toSummary`. Add a private helper:

```ts
  private async customerNamesByIds(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) return new Map();
    const res = await this.database.query<{ id: string; display_name: string | null }>(
      `SELECT id, display_name FROM customer_accounts WHERE id = ANY($1::uuid[])`,
      [unique],
    );
    return new Map(res.rows.map((r) => [r.id, r.display_name ?? r.id]));
  }
```

In `listRouters`, before mapping:

```ts
    const names = await this.customerNamesByIds(
      rows.map((r) => r.customer_account_id).filter((x): x is string => Boolean(x)),
    );
```

Change the `toSummary` signature to accept an optional name map and add the three fields to its return object:

```ts
  private toSummary(
    row: RouterRow,
    probe: { online: boolean; mode: MikroTikMode; resource?: Record<string, unknown> },
    customerNames?: Map<string, string>,
  ): MikroTikRouterSummary {
    // ...existing fields...
      role: (row.role as MikroTikRouterSummary['role']) ?? 'gateway',
      customerAccountId: row.customer_account_id,
      customerDisplayName: row.customer_account_id ? customerNames?.get(row.customer_account_id) ?? null : null,
  }
```

Pass `names` from `listRouters`'s map call: `return this.toSummary(row, probe, names);`. (Other `toSummary` call sites can omit the third arg — `customerDisplayName` resolves to null there, which is fine for mutation responses.)

- [ ] **Step 8: Typecheck**

Run: `cd apps/backend && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git add apps/backend/src/routers packages/shared apps/backend/test/router-customer-invariants.test.ts
git commit -m "feat(routers): role + customer link on create/update/summary with invariants"
```

---

## Task 4: Gateway billing — metering (usage → customer quota)

**Files:**
- Create: `apps/backend/src/routers/gateway-billing.service.ts`
- Test: `apps/backend/test/gateway-billing.test.ts`

The service exposes a pure `computeDelta` helper (unit-tested) and a `runCycle()` that does the DB work. Tests cover `computeDelta`; the DB wiring is covered by the integration step in Task 5.

- [ ] **Step 1: Write the failing test** (`apps/backend/test/gateway-billing.test.ts`)

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDelta } from '../src/routers/gateway-billing.service';

test('delta is newest minus cursor', () => {
  assert.equal(computeDelta({ rx: 1000, tx: 500 }, { rx: 200, tx: 100 }), 1200); // (1000-200)+(500-100)
});

test('delta is reset-aware: counter dropped below cursor', () => {
  // wg0 restarted: newest < cursor → count the newest as the whole delta
  assert.equal(computeDelta({ rx: 50, tx: 30 }, { rx: 1000, tx: 900 }), 80);
});

test('no cursor yet → newest counts as baseline (zero delta)', () => {
  assert.equal(computeDelta({ rx: 1000, tx: 500 }, null), 0);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/backend && node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON test/gateway-billing.test.ts`
Expected: FAIL — cannot find module `gateway-billing.service`.

- [ ] **Step 3: Create the service with `computeDelta` + `runCycle`** (`apps/backend/src/routers/gateway-billing.service.ts`)

```ts
import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RoutersService } from './routers.service';

export interface Counter { rx: number; tx: number }

/**
 * Reset-aware byte delta between the newest absolute WG counters and the last
 * billed cursor. A null cursor means "first time seen" → 0 (baseline only, never
 * back-bill historical usage). If a counter dropped below the cursor (wg restart)
 * the newest value is taken as the full delta.
 */
export function computeDelta(newest: Counter, cursor: Counter | null): number {
  if (!cursor) return 0;
  const rx = newest.rx >= cursor.rx ? newest.rx - cursor.rx : newest.rx;
  const tx = newest.tx >= cursor.tx ? newest.tx - cursor.tx : newest.tx;
  return rx + tx;
}

@Injectable()
export class GatewayBillingService {
  private readonly logger = new Logger(GatewayBillingService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly routers: RoutersService,
  ) {}

  /** One metering + enforcement pass over all gateway routers with a customer. */
  async runCycle(): Promise<void> {
    const gateways = await this.database.query<{
      id: string;
      customer_account_id: string;
      egress_enabled: boolean;
    }>(
      `SELECT id, customer_account_id, egress_enabled
         FROM mikrotik_routers
        WHERE role = 'gateway' AND customer_account_id IS NOT NULL`,
    );

    for (const g of gateways.rows) {
      try {
        const delta = await this.meterGateway(g.id, g.customer_account_id);
        if (delta > 0) {
          await this.database.query(
            `UPDATE customer_accounts SET used_bytes = used_bytes + $1, updated_at = now() WHERE id = $2`,
            [delta, g.customer_account_id],
          );
        }
        await this.enforce(g);
      } catch (err) {
        this.logger.warn(`gateway billing failed for ${g.id}: ${String(err)}`);
      }
    }
  }

  /**
   * Sums the reset-aware delta across ALL of the gateway's WG peers (a gateway's
   * tunnels are all Afrows-bound) using the newest sample per peer vs the stored
   * cursor, then advances the cursor. Returns the total new bytes to bill.
   */
  private async meterGateway(routerId: string, _customerId: string): Promise<number> {
    const samples = await this.database.query<{ peer_key: string; rx_bytes: string; tx_bytes: string }>(
      `SELECT DISTINCT ON (peer_key) peer_key, rx_bytes, tx_bytes
         FROM mikrotik_wg_samples
        WHERE router_id = $1
        ORDER BY peer_key, sampled_at DESC`,
      [routerId],
    );
    if (samples.rows.length === 0) return 0;

    const cursors = await this.database.query<{ peer_key: string; last_rx: string; last_tx: string }>(
      `SELECT peer_key, last_rx, last_tx FROM mikrotik_gateway_usage_cursor WHERE router_id = $1`,
      [routerId],
    );
    const cursorByPeer = new Map(cursors.rows.map((c) => [c.peer_key, { rx: Number(c.last_rx), tx: Number(c.last_tx) }]));

    let total = 0;
    for (const s of samples.rows) {
      const newest = { rx: Number(s.rx_bytes), tx: Number(s.tx_bytes) };
      total += computeDelta(newest, cursorByPeer.get(s.peer_key) ?? null);
      await this.database.query(
        `INSERT INTO mikrotik_gateway_usage_cursor (router_id, peer_key, last_rx, last_tx, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (router_id, peer_key)
         DO UPDATE SET last_rx = excluded.last_rx, last_tx = excluded.last_tx, updated_at = now()`,
        [routerId, s.peer_key, newest.rx, newest.tx],
      );
    }
    return total;
  }

  /** Enforcement is implemented in Task 5. */
  private async enforce(_g: { id: string; customer_account_id: string; egress_enabled: boolean }): Promise<void> {
    /* filled in Task 5 */
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd apps/backend && node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON test/gateway-billing.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/routers/gateway-billing.service.ts apps/backend/test/gateway-billing.test.ts
git commit -m "feat(routers): gateway billing meter (reset-aware delta -> customer quota)"
```

---

## Task 5: Gateway enforcement (auto-disable + alert) + interval runner

**Files:**
- Modify: `apps/backend/src/routers/gateway-billing.service.ts`
- Create: `apps/backend/src/routers/gateway-billing.runner.ts`
- Modify: `apps/backend/src/app.module.ts`
- Test: `apps/backend/test/gateway-billing.test.ts` (add a violation-predicate test)

- [ ] **Step 1: Add the violation-predicate test** (append to `apps/backend/test/gateway-billing.test.ts`)

```ts
import { isCustomerBlocked } from '../src/routers/gateway-billing.service';

test('blocked when expired', () => {
  const past = new Date(Date.now() - 1000).toISOString();
  assert.equal(isCustomerBlocked({ status: 'active', expiresAt: past, usedBytes: 0, quotaLimitBytes: 100 }), 'expired');
});

test('blocked when over quota', () => {
  assert.equal(isCustomerBlocked({ status: 'active', expiresAt: null, usedBytes: 100, quotaLimitBytes: 100 }), 'over_quota');
});

test('blocked when inactive', () => {
  assert.equal(isCustomerBlocked({ status: 'suspended', expiresAt: null, usedBytes: 0, quotaLimitBytes: null }), 'inactive');
});

test('not blocked when active, in-date, under quota', () => {
  assert.equal(isCustomerBlocked({ status: 'active', expiresAt: null, usedBytes: 10, quotaLimitBytes: 100 }), null);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/backend && node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON test/gateway-billing.test.ts`
Expected: FAIL — `isCustomerBlocked` is not exported.

- [ ] **Step 3: Add `isCustomerBlocked` and implement `enforce`** (`apps/backend/src/routers/gateway-billing.service.ts`)

Add the exported predicate near `computeDelta`:

```ts
export type BlockReason = 'expired' | 'over_quota' | 'inactive';

export function isCustomerBlocked(c: {
  status: string;
  expiresAt: string | null;
  usedBytes: number;
  quotaLimitBytes: number | null;
}): BlockReason | null {
  if (c.status !== 'active') return 'inactive';
  if (c.expiresAt && Date.parse(c.expiresAt) <= Date.now()) return 'expired';
  if (c.quotaLimitBytes != null && c.usedBytes >= c.quotaLimitBytes) return 'over_quota';
  return null;
}
```

Replace the stub `enforce` with:

```ts
  private async enforce(g: { id: string; customer_account_id: string; egress_enabled: boolean }): Promise<void> {
    const res = await this.database.query<{
      status: string; expires_at: Date | null; used_bytes: string; quota_limit_bytes: string | null; display_name: string | null;
    }>(
      `SELECT status, expires_at, used_bytes, quota_limit_bytes, display_name
         FROM customer_accounts WHERE id = $1`,
      [g.customer_account_id],
    );
    const row = res.rows[0];
    if (!row) return;
    const reason = isCustomerBlocked({
      status: row.status,
      expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
      usedBytes: Number(row.used_bytes),
      quotaLimitBytes: row.quota_limit_bytes == null ? null : Number(row.quota_limit_bytes),
    });
    if (!reason || !g.egress_enabled) return; // only act when blocked AND currently on

    await this.routers.setEgress(g.id, false); // disable Afrows egress via REST + record state
    await this.database.query(
      `INSERT INTO alerts (severity, status, source_type, source_id, title, message)
       VALUES ('warning', 'open', 'router', $1, $2, $3)
       ON CONFLICT (source_type, source_id, title) WHERE status = 'open'
       DO UPDATE SET message = excluded.message, last_seen_at = now()`,
      [
        g.id,
        'Gateway customer blocked — Afrows egress disabled',
        `Router ${g.id} disabled: customer ${row.display_name ?? g.customer_account_id} is ${reason}.`,
      ],
    );
  }
```

Confirm `RoutersService.setEgress(id, enabled)` is callable (it exists; signature `setEgress(id: string, enabled: boolean)` per `routers.service.ts` ~L186). If its current signature takes a DTO, add/confirm an `(id, enabled)` overload used here.

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `cd apps/backend && node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON test/gateway-billing.test.ts`
Expected: PASS (7/7).

- [ ] **Step 5: Create the interval runner** (`apps/backend/src/routers/gateway-billing.runner.ts`)

```ts
import { Injectable, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { GatewayBillingService } from './gateway-billing.service';

/**
 * Drives GatewayBillingService.runCycle() on an interval, just after the usage
 * sampler's cadence so fresh samples are available. setInterval, matching the
 * other metering services.
 */
@Injectable()
export class GatewayBillingRunnerService implements OnModuleInit, OnApplicationShutdown {
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly billing: GatewayBillingService) {}

  onModuleInit(): void {
    const intervalMs = Number(process.env.AFROWS_GATEWAY_BILLING_INTERVAL_MS ?? 900000); // 15 min
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) return;
    setTimeout(() => void this.billing.runCycle().catch(() => undefined), 60000); // after first sample
    this.timer = setInterval(() => void this.billing.runCycle().catch(() => undefined), intervalMs);
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
```

- [ ] **Step 6: Register providers** (`apps/backend/src/app.module.ts`)

Add both to the `providers` array of the module that owns `RoutersService` (the same module as `RouterUsageSamplerService`):

```ts
  GatewayBillingService,
  GatewayBillingRunnerService,
```

with the matching imports at the top of the file.

- [ ] **Step 7: Typecheck**

Run: `cd apps/backend && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/routers/gateway-billing.service.ts apps/backend/src/routers/gateway-billing.runner.ts apps/backend/src/app.module.ts apps/backend/test/gateway-billing.test.ts
git commit -m "feat(routers): gateway enforcement (auto-disable + alert) + interval runner"
```

---

## Task 6: Customers view — owned gateway indicator (API + UI)

**Files:**
- Modify: `apps/backend/src/billing/billing.service.ts` (customer list/detail query)
- Modify: `apps/dashboard/src/pages/CustomersPage.tsx`

- [ ] **Step 1: Add the owned-gateway lookup to the customer summary (backend)**

In the customer-accounts list method in `billing.service.ts` (the one that returns `AdminCustomerAccountSummary[]`), after the accounts are loaded, fetch owned gateways and attach them:

```ts
    const gw = await this.database.query<{ customer_account_id: string; id: string; label: string }>(
      `SELECT customer_account_id, id, label FROM mikrotik_routers
        WHERE role = 'gateway' AND customer_account_id = ANY($1::uuid[])`,
      [accountIds], // the ids you already selected for the page
    );
    const gwByAccount = new Map(gw.rows.map((r) => [r.customer_account_id, { id: r.id, label: r.label }]));
```

Then in the per-account mapping set:

```ts
      gatewayRouter: gwByAccount.get(account.id)
        ? { ...gwByAccount.get(account.id)!, online: false } // live status is resolved lazily in the panel
        : null,
```

(If resolving live `online` here is too heavy, leave `online:false`; the UI can show "linked" and the Routers page shows live status. Keeping the row lightweight is preferred — do NOT probe every router on the customer list.)

- [ ] **Step 2: Typecheck backend**

Run: `cd apps/backend && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Show the indicator in the customer table (dashboard)**

In `CustomersPage.tsx`, where each account row renders (near the Protocols badges), add:

```tsx
{a.gatewayRouter && (
  <span className="ml-2 inline-flex items-center gap-1 rounded bg-afro-line/40 px-1.5 py-0.5 text-[11px]">
    <span aria-hidden>🛰️</span> MikroTik: {a.gatewayRouter.label}
  </span>
)}
```

(Uses the `gatewayRouter` field added to the shared summary in Task 2.)

- [ ] **Step 4: Typecheck dashboard**

Run: `cd apps/dashboard && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/billing/billing.service.ts apps/dashboard/src/pages/CustomersPage.tsx
git commit -m "feat(customers): show owned MikroTik gateway on the customer row"
```

---

## Task 7: Routers table — Role + Customer columns + Edit picker

**Files:**
- Modify: `apps/dashboard/src/pages/MicrotiksPage.tsx`

- [ ] **Step 1: Add Role + Customer header cells**

In the routers table header row, add two `<th>`s (after ROUTER, before HOST or before STATUS — match existing column order):

```tsx
<th className="px-4 py-2 text-left">ROLE</th>
<th className="px-4 py-2 text-left">CUSTOMER</th>
```

- [ ] **Step 2: Add the matching body cells per router row**

```tsx
<td className="px-4 py-3">
  {r.role === 'transport'
    ? <span className="text-afro-muted">Transport</span>
    : <span className="rounded bg-afro-line/40 px-1.5 py-0.5 text-xs">Gateway</span>}
</td>
<td className="px-4 py-3">
  {r.role === 'transport'
    ? <span className="text-afro-muted">—</span>
    : (r.customerDisplayName ?? <span className="text-amber-500">— unassigned</span>)}
</td>
```

- [ ] **Step 3: Add Role + Customer controls to the Edit dialog**

In the router Edit form state, add `role` and `customerAccountId`. Add a Role `<select>` (Transport/Gateway) and, when role==='gateway', a customer picker populated from the existing admin customer list (reuse the customer-fetch the page or a sibling page already uses; if none, call the admin customer-list API). On save, include `role` and `customerAccountId` in the `updateAdminRouter` payload. For a `village`/transport router, disable both controls (it's locked).

```tsx
<label className="block text-sm">Role
  <select value={role} onChange={(e) => setRole(e.target.value as 'transport' | 'gateway')}
          disabled={editing?.kind === 'village'}
          className="mt-1 w-full rounded border border-afro-line bg-white px-2 py-1">
    <option value="gateway">Gateway (customer)</option>
    <option value="transport">Transport (infra)</option>
  </select>
</label>
{role === 'gateway' && (
  <label className="block text-sm">Customer
    <select value={customerAccountId ?? ''} onChange={(e) => setCustomerAccountId(e.target.value || null)}
            className="mt-1 w-full rounded border border-afro-line bg-white px-2 py-1">
      <option value="">— unassigned —</option>
      {customers.map((c) => <option key={c.id} value={c.id}>{c.displayName ?? c.id}</option>)}
    </select>
  </label>
)}
```

- [ ] **Step 4: Extend the dashboard router request type usage**

Ensure `updateAdminRouter`'s payload type (from `@afrows/shared` `UpdateMikroTikRouterRequest`, extended in Task 2) carries `role` + `customerAccountId`. No api.ts change beyond passing the fields.

- [ ] **Step 5: Typecheck dashboard + build**

Run: `cd apps/dashboard && npx tsc --noEmit && npx vite build`
Expected: exit 0, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/pages/MicrotiksPage.tsx
git commit -m "feat(microtiks): Role + Customer columns and Edit picker"
```

---

## Task 8: Full typecheck + test gate

**Files:** none (verification)

- [ ] **Step 1: Build shared, typecheck both apps, run backend tests**

```bash
npm --workspace @afrows/shared run build
( cd apps/backend && npx tsc --noEmit && node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON "test/**/*.test.ts" )
( cd apps/dashboard && npx tsc --noEmit )
```

Expected: all exit 0; gateway-billing + router-invariant tests pass.

- [ ] **Step 2: Commit any fixups** (only if needed)

```bash
git commit -am "chore: typecheck/test fixups for gateway feature"
```

---

## Task 9: Deploy + post-deploy data setup

**Files:** none (operational; requires operator go-ahead per the no-auto-deploy rule)

- [ ] **Step 1: Deploy** — `.\sync.ps1` (ships working tree; `db:migrate` applies migration 0046 on the VPS).

- [ ] **Step 2: Verify migration + service live** (SSH to the box)

```bash
# columns exist + service active
psql "$DBURL" -c "\d mikrotik_routers" | grep -E "role|customer_account_id"
systemctl is-active afrows-backend
grep -l GatewayBillingService /opt/afrows/apps/backend/dist/routers/*.js
```

Expected: `role` + `customer_account_id` present; backend active; GatewayBillingService in dist.

- [ ] **Step 3: Assign owners (via the dashboard Edit dialog)**
- `village ax3` → role auto-backfilled to `transport` (verify, no customer).
- `home ac3` → role `gateway`, customer = **Ben**.
- `office ax3` → role `gateway`, customer = (office account).

- [ ] **Step 4: Verify** — Routers table shows Role + Customer; Ben's customer row shows "MikroTik: home ac3"; after one billing cycle (~15 min) Ben's `used_bytes` increases by his home tunnel delta; pushing his account over quota disables home's Afrows egress + opens an alert.

---

## Self-Review notes (addressed)

- **Spec coverage:** role+customer model (T1–T3), metering (T4), enforcement+alert (T5), customer-view visibility (T6), routers-table visibility (T7), deploy+assignment (T9). All spec sections mapped.
- **Selector ambiguity** from the spec resolved in this plan: gateways sum all peers (their tunnels are all Afrows-bound); cursor table prevents double-counting.
- **Type consistency:** `MikroTikRouterRole`, `resolveRouterRoleAndCustomer`, `computeDelta`, `isCustomerBlocked`, `gatewayRouter` used identically across tasks.
- **Re-enable:** intentionally manual (no auto-re-enable path), per the approved spec.
