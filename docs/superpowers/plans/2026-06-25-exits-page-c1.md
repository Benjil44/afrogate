# Exits page — C1 (consolidation, no Settings extraction) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one **Exits** sidebar item (Main group) that hosts Outbounds, Routes, and the transport (Village/Starlink) MikroTiks as three tabs, and filter the standalone MikroTiks item to gateway routers — all by reusing existing page components, with no Settings change.

**Architecture:** New `ExitsPage` tabbed shell (uses the existing `DashboardTabs` primitive) renders the unchanged `OutboundsPage`, `RoutesPage`, and `MicrotiksPage` (role-filtered) as tab panels. `DashboardApp` gains a `case 'exits'` that forwards the same props it already computes for the `routes` case. `nav-views`/`nav-config` swap `outbounds`+`routes` out of the sidebar for `exits`; both keep their `ROUTE_VIEWS` keys so deep links still load.

**Tech Stack:** React 19 + Vite + TypeScript, `lucide-react`, `node --test` (pure nav logic), `tsc --noEmit` + `vite build` gates.

**Spec:** `docs/superpowers/specs/2026-06-25-exits-page-design.md` (C1 = everything except the Settings→Route extraction, which is C2).

**Scope note:** C1 does **not** touch `SettingsPage` — the Route tab stays in Settings for now. The Exits "Failover & routing" tab renders the existing `RoutesPage` only. C2 (separate plan) does the extraction.

---

## File structure

| File | Responsibility | New/Modify |
|------|----------------|------------|
| `apps/dashboard/src/dashboard-types.ts` | `ActiveView` gains `'exits'`; add `ExitsTab` type. | Modify |
| `apps/dashboard/src/nav-views.ts` | Sidebar groups: add `exits` to Main, remove `outbounds`+`routes`. | Modify |
| `apps/dashboard/src/nav-views.test.ts` | Update assertions for the new sidebar membership. | Modify |
| `apps/dashboard/src/nav-config.ts` | Add `exits` to the icon map. | Modify |
| `apps/dashboard/src/i18n.en.ts` / `i18n.fa.ts` | `nav.exits` + Exits tab labels. | Modify |
| `apps/dashboard/src/pages/MicrotiksPage.tsx` | Optional `roleFilter` prop → filter rows + default form role. | Modify |
| `apps/dashboard/src/pages/ExitsPage.tsx` | Tabbed shell rendering Outbounds/Routes/transport-MikroTiks. | **New** |
| `apps/dashboard/src/DashboardApp.tsx` | `case 'exits'`; `microtiks` case → `roleFilter="gateway"`; `ROUTE_VIEWS` gains `exits`. | Modify |

---

### Task 1: Types — `ActiveView` gains `exits`, add `ExitsTab`

**Files:**
- Modify: `apps/dashboard/src/dashboard-types.ts:16` (`ActiveView`), and `RoutesTab` neighborhood (`:23`) for the new `ExitsTab`.

- [ ] **Step 1: Add `exits` to `ActiveView`**

In `apps/dashboard/src/dashboard-types.ts`, change the `ActiveView` union (line 16) to include `'exits'`:
```ts
export type ActiveView = 'dashboard' | 'servers' | 'users' | 'customers' | 'connections' | 'inbounds' | 'audit' | 'backups' | 'billing' | 'reports' | 'routes' | 'outbounds' | 'microtiks' | 'alerts' | 'settings' | 'exits';
```

- [ ] **Step 2: Add the `ExitsTab` type**

In `apps/dashboard/src/dashboard-types.ts`, directly after the `RoutesTab` line (`export type RoutesTab = ...`), add:
```ts
export type ExitsTab = 'egress' | 'routing' | 'sources';
```

- [ ] **Step 3: Type-check (expect failures, that's fine)**

Run: `npm --workspace @afrows/dashboard run typecheck`
Expected: errors only about `exits` missing from the `NAV_ICONS` `Record<ActiveView, …>` in `nav-config.ts` and possibly `pageHeaders`/render switch exhaustiveness. These are resolved in later tasks. Do NOT commit yet — commit at Task 3 once types are consistent.

---

### Task 2: nav-views — swap Outbounds/Routes out, Exits in (TDD)

**Files:**
- Modify: `apps/dashboard/src/nav-views.ts:7-15`
- Test: `apps/dashboard/src/nav-views.test.ts`

- [ ] **Step 1: Update the test first**

Replace the body of `apps/dashboard/src/nav-views.test.ts` (keep the imports at the top) so the three structural tests reflect the new sidebar. Replace the existing `ALL_VIEWS` constant and the first three `test(...)` blocks with:
```ts
// Views shown in the sidebar after C1 (outbounds + routes are routable but hidden).
const SIDEBAR_VIEWS = [
  'dashboard', 'customers', 'billing', 'exits', 'microtiks', 'alerts', 'users', 'settings',
  'servers', 'inbounds', 'connections', 'audit', 'backups', 'reports',
];

test('Main has the 8 everyday views in order', () => {
  assert.deepEqual(MAIN_VIEWS, [
    'dashboard', 'customers', 'billing', 'exits', 'microtiks', 'alerts', 'users', 'settings',
  ]);
});

test('Advanced has the 6 infrastructure views in order', () => {
  assert.deepEqual(ADVANCED_VIEWS, [
    'servers', 'inbounds', 'connections', 'audit', 'backups', 'reports',
  ]);
});

test('sidebar groups: no duplicates, and outbounds/routes are hidden', () => {
  const union = [...MAIN_VIEWS, ...ADVANCED_VIEWS];
  assert.equal(new Set(union).size, union.length, 'duplicate view across groups');
  assert.deepEqual([...union].sort(), [...SIDEBAR_VIEWS].sort(), 'union != expected sidebar set');
  assert.ok(!union.includes('outbounds'), 'outbounds must not be a sidebar item');
  assert.ok(!union.includes('routes'), 'routes must not be a sidebar item');
});
```
Leave the two `parseAdvancedMode`/`serializeAdvancedMode` tests unchanged.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON apps/dashboard/src/nav-views.test.ts`
Expected: FAIL — `MAIN_VIEWS`/`ADVANCED_VIEWS` still contain the old membership.

- [ ] **Step 3: Update the arrays**

In `apps/dashboard/src/nav-views.ts`, replace the two arrays (`:7-15`):
```ts
// Main: everyday business tasks. Always visible.
export const MAIN_VIEWS: ActiveView[] = [
  'dashboard', 'customers', 'billing', 'exits', 'microtiks', 'alerts', 'users', 'settings',
];

// Advanced: raw infrastructure / xray plumbing. Visible only when Advanced mode is ON.
export const ADVANCED_VIEWS: ActiveView[] = [
  'servers', 'inbounds', 'connections', 'audit', 'backups', 'reports',
];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON apps/dashboard/src/nav-views.test.ts`
Expected: PASS — `# pass 5`, `# fail 0`.

---

### Task 3: nav-config + i18n labels (sidebar item renders)

**Files:**
- Modify: `apps/dashboard/src/nav-config.ts` (imports + `NAV_ICONS`)
- Modify: `apps/dashboard/src/i18n.en.ts` (`nav` block ~`:182`, `tabs` block) and `apps/dashboard/src/i18n.fa.ts` (parity)

- [ ] **Step 1: Add the `exits` icon**

In `apps/dashboard/src/nav-config.ts`, add `Waypoints` is already imported. Add an `exits` entry to `NAV_ICONS` (reuse `Waypoints` — it reads as "paths out"):
```ts
  outbounds: Waypoints,
  exits: Waypoints,
  microtiks: RouterIcon,
```
(Insert the `exits: Waypoints,` line; keep all existing entries.)

- [ ] **Step 2: Add `nav.exits` (English)**

In `apps/dashboard/src/i18n.en.ts`, inside the `nav:` block, add:
```ts
      exits: 'Exits',
```

- [ ] **Step 3: Add Exits tab strings (English)**

In `apps/dashboard/src/i18n.en.ts`, inside the `tabs:` object, add:
```ts
      exitsSections: 'Exits sections',
      exitsEgress: 'Egress paths',
      exitsRouting: 'Failover & routing',
      exitsSources: 'Sources',
```

- [ ] **Step 4: Add the same keys (arabic)**

In `apps/dashboard/src/i18n.fa.ts`, inside the `nav:` block add:
```ts
      exits: 'خروجی‌ها',
```
and inside the `tabs:` object add:
```ts
      exitsSections: 'بخش‌های خروجی',
      exitsEgress: 'مسیرهای خروج',
      exitsRouting: 'فیل‌اوور و مسیریابی',
      exitsSources: 'منابع',
```

- [ ] **Step 5: Type-check**

Run: `npm --workspace @afrows/dashboard run typecheck`
Expected: errors now only from `DashboardApp.tsx` (no `case 'exits'` yet → if `pageHeaders` is indexed by `ActiveView`, a missing `exits` header; and the render switch). If `pageHeaders` requires an `exits` entry, add one in Step 6.

- [ ] **Step 6: Add `pageHeaders.exits` if required**

If Step 5 reports a missing `pageHeaders.exits`, add to `i18n.en.ts` `pageHeaders`:
```ts
      exits: { eyebrow: 'Connectivity', title: 'Exits / internet sources' },
```
and to `i18n.fa.ts` `pageHeaders`:
```ts
      exits: { eyebrow: 'اتصال', title: 'خروجی‌ها / منابع اینترنت' },
```
Re-run `npm --workspace @afrows/dashboard run typecheck`. Remaining errors should be confined to `DashboardApp.tsx` render switch (fixed in Task 6).

- [ ] **Step 7: Commit (types + nav + i18n)**

```bash
git add apps/dashboard/src/dashboard-types.ts apps/dashboard/src/nav-views.ts apps/dashboard/src/nav-views.test.ts apps/dashboard/src/nav-config.ts apps/dashboard/src/i18n.en.ts apps/dashboard/src/i18n.fa.ts
git commit -m "feat(dashboard): add Exits nav view + tab strings; drop Outbounds/Routes from sidebar"
```

---

### Task 4: MicrotiksPage `roleFilter` prop

**Files:**
- Modify: `apps/dashboard/src/pages/MicrotiksPage.tsx:74` (signature), the list render (`~:474-479`), the rollup button/loader (`~:288,419`), and the create-dialog default role (`draft` init `~:65-72`).

- [ ] **Step 1: Add the prop + a filtered view of rows**

In `apps/dashboard/src/pages/MicrotiksPage.tsx`, change the signature (line 74) to accept an optional `roleFilter`:
```ts
export function MicrotiksPage({ roleFilter, sessionToken, t }: { roleFilter?: MikroTikRouterRole; sessionToken: string; t: DashboardStrings }) {
```
(`MikroTikRouterRole` is already imported.) Then, immediately after the `rows` state is declared (line 76, `const [rows, setRows] = useState<MikroTikRouterSummary[]>([]);`), add:
```ts
  const visibleRows = roleFilter ? rows.filter((router) => router.role === roleFilter) : rows;
```

- [ ] **Step 2: Render and count from `visibleRows`**

In the same file, in the JSX that lists routers (around `:474-479`), replace the three `rows` references used for **display/count** with `visibleRows`:
- `loading && rows.length === 0` → `loading && visibleRows.length === 0`
- `rows.length === 0` (empty-state check) → `visibleRows.length === 0`
- `rows.map((router) => (` → `visibleRows.map((router) => (`

Also update the usage-rollup button (`~:419`) `disabled={rollupLoading || rows.length === 0}` → `disabled={rollupLoading || visibleRows.length === 0}`.

Leave all `setRows(...)` state updates (`:343,348,372,377`) and the `loadRollup` internals operating on the full `rows` untouched **except** the rollup source: in `loadRollup` (around `:288`, `rows.map(async (r) => ...)`), change it to `visibleRows.map(async (r) => ...)` so usage loads only for shown routers.

- [ ] **Step 3: Default the create-dialog role to the filter**

In the `draft` initial state (the `useState` whose object has `role: 'gateway'`, `~:65-72`), set the role from the filter so creating from a filtered view pre-selects the right role:
```ts
    role: roleFilter ?? 'gateway',
```

- [ ] **Step 4: Type-check**

Run: `npm --workspace @afrows/dashboard run typecheck`
Expected: no NEW errors from `MicrotiksPage.tsx` (the existing `DashboardApp` render-switch error for `exits` may still be present — fixed in Task 6).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/pages/MicrotiksPage.tsx
git commit -m "feat(dashboard): MicrotiksPage roleFilter prop (transport/gateway split)"
```

---

### Task 5: ExitsPage tabbed shell

**Files:**
- Create: `apps/dashboard/src/pages/ExitsPage.tsx`

`ExitsPage` takes exactly the prop shape `RoutesPage` needs (so `DashboardApp` forwards the same values it already computes for the `routes` case), and additionally feeds `OutboundsPage` (`sessionToken, t`) and `MicrotiksPage` (`sessionToken, t, roleFilter`).

- [ ] **Step 1: Create the component**

Create `apps/dashboard/src/pages/ExitsPage.tsx`:
```tsx
import { useState } from 'react';
import type { AdminSessionResponse, AdminTunnelSummary } from '@afrows/shared';
import { DashboardTabs } from '../components/primitives';
import type { DashboardTabItem, DataState, ExitsTab, OutboundRowData, RouteFailoverRowData, TunnelRowData } from '../dashboard-types';
import type { DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { OutboundsPage } from './OutboundsPage';
import { RoutesPage } from './RoutesPage';
import { MicrotiksPage } from './MicrotiksPage';

export function ExitsPage({
  dataState,
  failoverRows,
  format,
  outbounds,
  session,
  sessionToken,
  tunnelDataState,
  tunnelSummaries,
  tunnels,
  t,
}: {
  dataState: DataState;
  failoverRows: RouteFailoverRowData[];
  format: DashboardFormatters;
  outbounds: OutboundRowData[];
  session: AdminSessionResponse;
  sessionToken: string;
  tunnelDataState: DataState;
  tunnelSummaries: AdminTunnelSummary[];
  tunnels: TunnelRowData[];
  t: DashboardStrings;
}) {
  const [activeTab, setActiveTab] = useState<ExitsTab>('egress');

  const tabs: Array<DashboardTabItem<ExitsTab>> = [
    { id: 'egress', label: t.tabs.exitsEgress },
    { id: 'routing', label: t.tabs.exitsRouting },
    { id: 'sources', label: t.tabs.exitsSources },
  ];

  return (
    <div className="flex flex-col gap-4">
      <DashboardTabs activeTab={activeTab} ariaLabel={t.tabs.exitsSections} onChange={setActiveTab} tabs={tabs} />
      {activeTab === 'egress' ? <OutboundsPage sessionToken={sessionToken} t={t} /> : null}
      {activeTab === 'routing' ? (
        <RoutesPage
          dataState={dataState}
          failoverRows={failoverRows}
          format={format}
          outbounds={outbounds}
          session={session}
          sessionToken={sessionToken}
          tunnelDataState={tunnelDataState}
          tunnelSummaries={tunnelSummaries}
          tunnels={tunnels}
          t={t}
        />
      ) : null}
      {activeTab === 'sources' ? <MicrotiksPage roleFilter="transport" sessionToken={sessionToken} t={t} /> : null}
    </div>
  );
}
```

> NOTE: confirm the import path/casing of `DashboardTabItem`, `DataState`, `OutboundRowData`, `RouteFailoverRowData`, `TunnelRowData` in `dashboard-types.ts` and `DashboardFormatters` in `formatters.ts` match what `RoutesPage.tsx` imports (copy its import lines if a name differs). `DashboardTabs` is exported from `../components/primitives` (as used by `RoutesPage`).

- [ ] **Step 2: Type-check**

Run: `npm --workspace @afrows/dashboard run typecheck`
Expected: no errors from `ExitsPage.tsx` itself. (The `DashboardApp` render-switch `exits` error persists until Task 6.) If an imported type name mismatches, align it with `RoutesPage.tsx`'s imports and re-run.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/pages/ExitsPage.tsx
git commit -m "feat(dashboard): ExitsPage tabbed shell (egress/routing/sources)"
```

---

### Task 6: Wire DashboardApp — render Exits, gateway-filter MikroTiks, route key

**Files:**
- Modify: `apps/dashboard/src/DashboardApp.tsx` — import (`~:462` import region), `ROUTE_VIEWS` (`:646-648`), render switch (`case 'routes'` ~`:1264`, `case 'outbounds'` ~`:1280`, `case 'microtiks'` ~`:1282`).

- [ ] **Step 1: Import ExitsPage**

In `apps/dashboard/src/DashboardApp.tsx`, near the other page imports (e.g. after the `OutboundsPage` import at `:211`), add:
```ts
import { ExitsPage } from './pages/ExitsPage';
```

- [ ] **Step 2: Add `exits` to `ROUTE_VIEWS`**

In `DashboardApp.tsx`, the `ROUTE_VIEWS` array (`:645-648`) — append `'exits'` so the view is routable/deep-linkable:
```ts
const ROUTE_VIEWS: ActiveView[] = [
  'dashboard', 'servers', 'users', 'customers', 'connections', 'inbounds', 'audit',
  'backups', 'billing', 'reports', 'routes', 'outbounds', 'microtiks', 'alerts', 'settings', 'exits',
];
```

- [ ] **Step 3: Add the `case 'exits'` render**

In `DashboardApp.tsx`, directly above `case 'routes':` (`:1264`), add a case that forwards the same props as the `routes` case:
```tsx
    case 'exits':
      return (
        <ExitsPage
          dataState={routeDataState}
          failoverRows={routeFailoverRows}
          format={format}
          outbounds={routeOutbounds}
          session={session}
          sessionToken={sessionToken}
          tunnelDataState={tunnelDataState}
          tunnelSummaries={routeTunnelSummaries}
          tunnels={routeTunnels}
          t={t}
        />
      );
```

- [ ] **Step 4: Gateway-filter the standalone MikroTiks view**

In `DashboardApp.tsx`, change the `case 'microtiks'` render (`:1282`):
```tsx
    case 'microtiks':
      return <MicrotiksPage roleFilter="gateway" sessionToken={sessionToken} t={t} />;
```

- [ ] **Step 5: Full type-check**

Run: `npm --workspace @afrows/dashboard run typecheck`
Expected: PASS, no errors.

- [ ] **Step 6: Unit test + build gates**

Run: `node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON apps/dashboard/src/nav-views.test.ts`
Expected: PASS (5 tests).
Run: `npm --workspace @afrows/dashboard run build`
Expected: `tsc --noEmit` clean + `vite build` succeeds.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/DashboardApp.tsx
git commit -m "feat(dashboard): render Exits view + gateway-only standalone MikroTiks"
```

---

### Task 7: Manual verification (no code)

Run `npm --workspace @afrows/dashboard run dev` (serves `127.0.0.1:4000`), logged in as a full admin.

- [ ] **Step 1:** Sidebar Main shows **Exits** (not Outbounds, not Routes). Advanced mode ON shows Servers/Inbounds/Connections/Audit/Backups/Reports (no Routes).
- [ ] **Step 2:** Open Exits → three tabs: **Egress paths** = the old Outbounds (list/test/subscriptions); **Failover & routing** = the Routes page with its overview/policy/canary/history sub-tabs; **Sources** = MikroTiks list showing **only transport** routers (Village/Starlink).
- [ ] **Step 3:** Open the standalone **MikroTiks** item → shows **only gateway** routers (Home/Office); the add-router dialog defaults role to "gateway".
- [ ] **Step 4:** Deep links still load with the items hidden: navigate to `?view=routes` and `?view=outbounds` (per `viewFromUrl`) — both render their pages.
- [ ] **Step 5:** Settings still has its **Route** tab (untouched in C1).
- [ ] **Step 6:** Switch to FA — Exits label reads "خروجی‌ها" and the tabs render in arabic.

---

## Self-Review

**1. Spec coverage (C1 subset):**
- One Exits item in Main, tabs reuse components → Tasks 2,3,5,6. ✓
- Tab 1 Egress = Outbounds, Tab 2 Routing = Routes, Tab 3 Sources = transport MikroTiks → Task 5. ✓
- Remove Outbounds/Routes from sidebar but keep routable → Task 2 (groups) + Task 6 Step 2 (`ROUTE_VIEWS`). ✓
- MikroTik role split: Sources=transport, standalone=gateway → Tasks 4, 5, 6 Step 4. ✓
- i18n nav + tabs (en+fa parity) → Task 3. ✓
- No Settings change (deferred to C2) → explicitly excluded; Task 7 Step 5 verifies Settings Route tab remains. ✓
- No backend/data change → none in any task. ✓

**2. Placeholder scan:** No TBD/vague steps; every code step shows code. The two NOTE blocks give concrete fallbacks (align imports with `RoutesPage`; add `pageHeaders.exits` only if tsc demands), not vague instructions. ✓

**3. Type consistency:** `ExitsTab` defined Task 1, used Tasks 3 (strings) + 5 (component). `roleFilter?: MikroTikRouterRole` defined Task 4, used Tasks 5 (`"transport"`) + 6 (`"gateway"`). `ExitsPage` prop shape (Task 5) matches the `routes`-case props forwarded in Task 6 Step 3 exactly (`routeDataState→dataState`, `routeFailoverRows→failoverRows`, `routeOutbounds→outbounds`, `routeTunnelSummaries→tunnelSummaries`, `routeTunnels→tunnels`, plus `tunnelDataState`/`format`/`session`/`sessionToken`/`t`). `nav.exits` + `tabs.exits*` defined Task 3, used Task 5. ✓
