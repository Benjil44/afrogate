# Dashboard nav: Simple/Advanced split + Advanced-mode toggle (sub-project A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the dashboard's flat 15-item sidebar into a **Main** group (always visible) and an **Advanced** group (shown only when a per-admin Advanced-mode toggle is ON, default OFF), and rename the "Users" nav label to "Admins" — with zero route/data/page changes.

**Architecture:** Move the nav item list out of `Sidebar.tsx` into two new files: `nav-views.ts` (pure, dependency-free view-id arrays + the Advanced-mode localStorage helpers — unit-testable under `node --test`) and `nav-config.ts` (builds the `NavItemData[]` arrays with icons from those view arrays). `Sidebar.tsx` renders Main always and Advanced conditionally with a footer toggle; `DashboardApp.tsx` owns the persisted `advancedMode` boolean (mirroring the existing kiosk-mode pattern). Deep links and the `ROUTE_VIEWS` router are untouched, so hidden pages still load by URL.

**Tech Stack:** React 19 + Vite + TypeScript (dashboard), `lucide-react` icons, `node --test` with native type-stripping (Node v24, mirrors `apps/backend`), `tsc --noEmit` as the type gate.

**Spec:** `docs/superpowers/specs/2026-06-25-dashboard-nav-simple-advanced-design.md`

---

## File structure

| File | Responsibility | New/Modify |
|------|----------------|------------|
| `apps/dashboard/src/nav-views.ts` | Source of truth for which views are Main vs Advanced (`ActiveView[]`), plus pure Advanced-mode localStorage parse/serialize helpers + the storage key. Zero runtime imports (type-only). | **New** |
| `apps/dashboard/src/nav-views.test.ts` | Asserts Main=8, Advanced=7, union=all 15 `ActiveView`, no dupes; `parseAdvancedMode`/`serializeAdvancedMode` behavior. | **New** |
| `apps/dashboard/src/nav-config.ts` | Builds `MAIN_NAV`/`ADVANCED_NAV` (`NavItemData[]`) by mapping the view arrays through an exhaustive icon map. | **New** |
| `apps/dashboard/src/i18n.en.ts` | Rename `nav.users` label → "Admins"; add Advanced-mode toggle + group-label strings. | Modify |
| `apps/dashboard/src/i18n.fa.ts` | Same keys in Persian (typed against `DashboardStrings`, so tsc enforces parity). | Modify |
| `apps/dashboard/src/components/Sidebar.tsx` | Consume `MAIN_NAV`/`ADVANCED_NAV`; apply RBAC filter to both; render Advanced group conditionally; add footer Advanced-mode toggle; new props. | Modify |
| `apps/dashboard/src/DashboardApp.tsx` | Add persisted `advancedMode` state (mirror kiosk helpers) and pass `advancedMode`/`onToggleAdvancedMode` to `Sidebar`. | Modify |

**Key invariant:** `nav-views.ts` must NOT import any runtime module (only `import type`), so `node --test` can load it without tsconfig path-alias resolution (`@afrows/shared`) or the `lucide-react` ESM barrel. All icon wiring lives in `nav-config.ts`, which is covered by `tsc`, not by the unit test.

---

### Task 1: Pure nav-views module + helpers (TDD)

**Files:**
- Create: `apps/dashboard/src/nav-views.ts`
- Test: `apps/dashboard/src/nav-views.test.ts`

Reference — the full `ActiveView` union (15 keys) from `apps/dashboard/src/dashboard-types.ts:16`:
`'dashboard' | 'servers' | 'users' | 'customers' | 'connections' | 'inbounds' | 'audit' | 'backups' | 'billing' | 'reports' | 'routes' | 'outbounds' | 'microtiks' | 'alerts' | 'settings'`

Reference — existing kiosk pattern in `DashboardApp.tsx:635-642` that the Advanced-mode helpers mirror:
```ts
const kioskStorageKey = 'afrows.dashboard.kiosk';
function loadInitialKioskMode() {
  return window.localStorage.getItem(kioskStorageKey) === 'enabled';
}
```

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/src/nav-views.test.ts`:
```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAIN_VIEWS, ADVANCED_VIEWS, parseAdvancedMode, serializeAdvancedMode } from './nav-views.ts';

const ALL_VIEWS = [
  'dashboard', 'servers', 'users', 'customers', 'connections', 'inbounds',
  'audit', 'backups', 'billing', 'reports', 'routes', 'outbounds',
  'microtiks', 'alerts', 'settings',
];

test('Main has the 8 everyday views in order', () => {
  assert.deepEqual(MAIN_VIEWS, [
    'dashboard', 'customers', 'billing', 'outbounds', 'microtiks', 'alerts', 'users', 'settings',
  ]);
});

test('Advanced has the 7 infrastructure views in order', () => {
  assert.deepEqual(ADVANCED_VIEWS, [
    'servers', 'inbounds', 'connections', 'routes', 'audit', 'backups', 'reports',
  ]);
});

test('Main + Advanced cover every ActiveView exactly once', () => {
  const union = [...MAIN_VIEWS, ...ADVANCED_VIEWS];
  assert.equal(union.length, ALL_VIEWS.length, 'wrong total count');
  assert.equal(new Set(union).size, union.length, 'duplicate view across groups');
  assert.deepEqual([...union].sort(), [...ALL_VIEWS].sort(), 'union != all views');
});

test('parseAdvancedMode: only "enabled" is true; default false', () => {
  assert.equal(parseAdvancedMode('enabled'), true);
  assert.equal(parseAdvancedMode('disabled'), false);
  assert.equal(parseAdvancedMode(null), false);
  assert.equal(parseAdvancedMode(''), false);
});

test('serializeAdvancedMode round-trips through parseAdvancedMode', () => {
  assert.equal(parseAdvancedMode(serializeAdvancedMode(true)), true);
  assert.equal(parseAdvancedMode(serializeAdvancedMode(false)), false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON apps/dashboard/src/nav-views.test.ts`
Expected: FAIL — cannot resolve `./nav-views.ts` (module does not exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `apps/dashboard/src/nav-views.ts`:
```ts
// Source of truth for the two sidebar groups (sub-project A). Pure data + the
// Advanced-mode localStorage helpers. NO runtime imports — only a type import —
// so this module is loadable by `node --test` (no path-alias / lucide barrel).
import type { ActiveView } from './dashboard-types';

// Main: everyday business tasks. Always visible.
export const MAIN_VIEWS: ActiveView[] = [
  'dashboard', 'customers', 'billing', 'outbounds', 'microtiks', 'alerts', 'users', 'settings',
];

// Advanced: raw infrastructure / xray plumbing. Visible only when Advanced mode is ON.
export const ADVANCED_VIEWS: ActiveView[] = [
  'servers', 'inbounds', 'connections', 'routes', 'audit', 'backups', 'reports',
];

// Persisted per-admin toggle. Mirrors the kiosk-mode pattern in DashboardApp.tsx.
export const advancedModeStorageKey = 'afrows.dashboard.advanced';

export function parseAdvancedMode(stored: string | null): boolean {
  return stored === 'enabled';
}

export function serializeAdvancedMode(enabled: boolean): string {
  return enabled ? 'enabled' : 'disabled';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON apps/dashboard/src/nav-views.test.ts`
Expected: PASS — `# pass 5`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/nav-views.ts apps/dashboard/src/nav-views.test.ts
git commit -m "feat(dashboard): pure nav-views split (Main/Advanced) + advanced-mode helpers"
```

---

### Task 2: nav-config with icons (NavItemData arrays)

**Files:**
- Create: `apps/dashboard/src/nav-config.ts`
- Reference: `apps/dashboard/src/components/Sidebar.tsx:1` (icon import list) and `:9-25` (current `navItems` icon mapping), `apps/dashboard/src/dashboard-types.ts:190-194` (`NavItemData`).

`NavItemData` shape (`dashboard-types.ts:190`):
```ts
export interface NavItemData {
  id: ActiveView;
  labelKey: ActiveView;
  icon: ...; // lucide icon component
}
```

- [ ] **Step 1: Create the nav-config module**

Create `apps/dashboard/src/nav-config.ts`. The icon assignments come verbatim from the current `Sidebar.tsx:10-24` list:
```ts
// Builds the sidebar NavItemData arrays for each group from the pure view-id
// arrays in nav-views.ts. Icons live here (Sidebar.tsx no longer owns the list).
import { Activity, Archive, Bell, CreditCard, Gauge, LogIn, Network, Route, Router as RouterIcon, ScrollText, Server, Settings as SettingsIcon, Users, UserRound, Waypoints } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ActiveView, NavItemData } from './dashboard-types';
import { ADVANCED_VIEWS, MAIN_VIEWS } from './nav-views';

// Exhaustive icon per view (TS errors if a view is missing).
const NAV_ICONS: Record<ActiveView, LucideIcon> = {
  dashboard: Activity,
  servers: Server,
  users: UserRound,
  customers: Users,
  audit: ScrollText,
  backups: Archive,
  billing: CreditCard,
  reports: Gauge,
  routes: Route,
  connections: Network,
  inbounds: LogIn,
  outbounds: Waypoints,
  microtiks: RouterIcon,
  alerts: Bell,
  settings: SettingsIcon,
};

function toNavItem(id: ActiveView): NavItemData {
  return { id, labelKey: id, icon: NAV_ICONS[id] };
}

export const MAIN_NAV: NavItemData[] = MAIN_VIEWS.map(toNavItem);
export const ADVANCED_NAV: NavItemData[] = ADVANCED_VIEWS.map(toNavItem);
```

> NOTE: `LogOut` and `Languages` etc. stay imported in `Sidebar.tsx` — only the nav-item icons move here. Confirm `LucideIcon` is exported by the installed `lucide-react@0.468`; if `tsc` reports it missing, use `import type { ComponentType } from 'react'` and type the map as `Record<ActiveView, ComponentType<{ size?: number; className?: string }>>` instead.

- [ ] **Step 2: Type-check**

Run: `npm --workspace @afrows/dashboard run typecheck`
Expected: PASS (no errors). If `LucideIcon` import fails, apply the fallback in the NOTE above and re-run.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/nav-config.ts
git commit -m "feat(dashboard): nav-config builds Main/Advanced NavItemData with icons"
```

---

### Task 3: i18n — rename Users→Admins + add Advanced-mode strings

**Files:**
- Modify: `apps/dashboard/src/i18n.en.ts` (`:8-9` toggle strings region, `:172` nav.users)
- Modify: `apps/dashboard/src/i18n.fa.ts` (`:10-11`, `:174` nav.users)

`DashboardStrings = typeof en` (`i18n.ts:14`), so every key added to `en` MUST also be added to `fa` or `tsc` fails — that is the parity gate.

- [ ] **Step 1: Add Advanced-mode strings to English**

In `apps/dashboard/src/i18n.en.ts`, after line 9 (`exitKioskMode: 'Exit kiosk display',`) add:
```ts
    showAdvancedNav: 'Show advanced',
    hideAdvancedNav: 'Hide advanced',
    advancedNavGroup: 'Advanced',
```

- [ ] **Step 2: Rename the Users nav label to Admins (English)**

In `apps/dashboard/src/i18n.en.ts`, change line 172 inside the `nav:` block:
```ts
      users: 'Admins',
```
(Was `users: 'Users'`. Route key stays `users`; this is label-only.)

- [ ] **Step 3: Add the same strings to Persian**

In `apps/dashboard/src/i18n.fa.ts`, after line 11 (`exitKioskMode: 'خروج از نمایش کیوسک',`) add:
```ts
    showAdvancedNav: 'نمایش پیشرفته',
    hideAdvancedNav: 'پنهان کردن پیشرفته',
    advancedNavGroup: 'پیشرفته',
```

- [ ] **Step 4: Rename the Users nav label to Admins (Persian)**

In `apps/dashboard/src/i18n.fa.ts`, change the `users:` line inside the `nav:` block:
```ts
      users: 'مدیران',
```
(Was `users: 'کاربران'`.)

- [ ] **Step 5: Type-check (parity gate)**

Run: `npm --workspace @afrows/dashboard run typecheck`
Expected: PASS. A missing/extra key in `fa` would fail here.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/i18n.en.ts apps/dashboard/src/i18n.fa.ts
git commit -m "feat(dashboard): rename Users nav label to Admins + add advanced-mode strings"
```

---

### Task 4: Sidebar renders Main always + Advanced conditionally + footer toggle

**Files:**
- Modify: `apps/dashboard/src/components/Sidebar.tsx`

Current relevant code: the local `navItems` array (`:9-25`) is removed; the icon imports it used (`Activity, Archive, Bell, CreditCard, Gauge, LogIn, Network, Route, RouterIcon, ScrollText, Server, SettingsIcon, Users, UserRound, Waypoints`) are removed from `:1` (keep `Languages, LogOut, Maximize2, Minimize2, PanelLeft*, PanelRight*, ShieldCheck` — the ones still used by buttons; add `Layers` for the toggle). The RBAC filter at `:52-60` is reused via a helper applied to both groups.

- [ ] **Step 1: Update imports and remove the local navItems array**

In `apps/dashboard/src/components/Sidebar.tsx`, replace the icon import on line 1 with only the icons still used in this file, and add `Layers`:
```ts
import { Languages, Layers, LogOut, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, ShieldCheck } from 'lucide-react';
```
Add the nav-config import below the existing `import type { ActiveView, NavItemData, SidebarAlertState }` line:
```ts
import { ADVANCED_NAV, MAIN_NAV } from '../nav-config';
```
Delete the entire `const navItems: NavItemData[] = [ ... ];` block (`:9-25`).

- [ ] **Step 2: Add a session-aware filter helper (replaces the inline filter)**

In `Sidebar.tsx`, above the `Sidebar` function, add a module-level helper that contains the exact RBAC logic currently inlined at `:52-60`:
```ts
function filterNavForSession(items: NavItemData[], session: AdminSessionResponse): NavItemData[] {
  return items.filter((item) => {
    if (session.actor.role === 'reseller') return resellerNavViews.has(item.id);
    if (item.id === 'users') return canViewAdminUsers(session);
    if (item.id === 'audit') return canViewAuditLogs(session);
    if (item.id === 'backups') return canViewBackupStatus(session);
    if (item.id === 'reports') return canViewReports(session);
    return true;
  });
}
```

- [ ] **Step 3: Add the two new props to the Sidebar signature**

In `Sidebar.tsx`, add `advancedMode` and `onToggleAdvancedMode` to both the destructured params and the prop type. Updated header (insert `advancedMode,` first in the destructure and the matching type lines):
```ts
export function Sidebar({
  activeView,
  advancedMode,
  isCollapsed,
  isRtl,
  nextLanguage,
  onLanguageChange,
  onSignOut,
  onToggleAdvancedMode,
  onToggleCollapse,
  onViewChange,
  sidebarAlertState,
  session,
  t,
}: {
  activeView: ActiveView;
  advancedMode: boolean;
  isCollapsed: boolean;
  isRtl: boolean;
  nextLanguage: DashboardLanguage;
  onLanguageChange: (language: DashboardLanguage) => void;
  onSignOut: () => void;
  onToggleAdvancedMode: () => void;
  onToggleCollapse: () => void;
  onViewChange: (view: ActiveView) => void;
  sidebarAlertState: SidebarAlertState | null;
  session: AdminSessionResponse;
  t: DashboardStrings;
}) {
```

- [ ] **Step 4: Compute the two filtered groups inside the component**

In `Sidebar.tsx`, replace the old `const visibleNavItems = navItems.filter(...)` block (`:52-60`) with:
```ts
  const mainItems = filterNavForSession(MAIN_NAV, session);
  const advancedItems = filterNavForSession(ADVANCED_NAV, session);
  const canUseAdvancedToggle = session.actor.role !== 'reseller';
  const showAdvanced = advancedMode && canUseAdvancedToggle && advancedItems.length > 0;
```

- [ ] **Step 5: Render Main always, Advanced conditionally**

In `Sidebar.tsx`, replace the `<nav>...</nav>` block (`:79-91`) — the one mapping `visibleNavItems` — with:
```tsx
      <nav className={`mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-6 lg:flex-1 lg:grid-cols-1 lg:content-start ${isCollapsed ? 'lg:mt-6' : 'lg:mt-8'}`}>
        {mainItems.map((item) => (
          <NavItem
            item={item}
            alertState={item.id === 'alerts' ? sidebarAlertState : null}
            isActive={activeView === item.id}
            isSidebarCollapsed={isCollapsed}
            key={item.id}
            onClick={() => onViewChange(item.id)}
            t={t}
          />
        ))}
        {showAdvanced ? (
          <>
            <div
              className={`col-span-2 mt-2 px-3 text-[10px] font-bold uppercase tracking-wide text-[#7c9490] sm:col-span-6 lg:col-span-1 ${isCollapsed ? 'lg:sr-only' : ''}`}
            >
              {t.advancedNavGroup}
            </div>
            {advancedItems.map((item) => (
              <NavItem
                item={item}
                alertState={item.id === 'alerts' ? sidebarAlertState : null}
                isActive={activeView === item.id}
                isSidebarCollapsed={isCollapsed}
                key={item.id}
                onClick={() => onViewChange(item.id)}
                t={t}
              />
            ))}
          </>
        ) : null}
      </nav>
```

- [ ] **Step 6: Add the Advanced-mode toggle button to the footer**

In `Sidebar.tsx`, the footer block (`:92-117`) renders Language/SignOut in both collapsed and expanded layouts. Add the toggle in both. In the collapsed branch (`:94-98`, the `flex flex-col items-center gap-2` div), add as the first child:
```tsx
            {canUseAdvancedToggle ? (
              <AdvancedToggleButton isActive={advancedMode} isCollapsed onToggle={onToggleAdvancedMode} t={t} />
            ) : null}
```
In the expanded branch, inside the `<div className="flex items-center gap-2">` that holds Language+SignOut (`:106-109`), add as the first child:
```tsx
              {canUseAdvancedToggle ? (
                <AdvancedToggleButton isActive={advancedMode} onToggle={onToggleAdvancedMode} t={t} />
              ) : null}
```

- [ ] **Step 7: Add the AdvancedToggleButton component**

In `Sidebar.tsx`, add this component (place it next to `KioskToggleButton`, after `:140`). It mirrors the kiosk button styling and uses the new strings:
```tsx
function AdvancedToggleButton({
  isActive,
  isCollapsed = false,
  onToggle,
  t,
}: {
  isActive: boolean;
  isCollapsed?: boolean;
  onToggle: () => void;
  t: DashboardStrings;
}) {
  const label = isActive ? t.hideAdvancedNav : t.showAdvancedNav;
  const activeClass = isActive
    ? 'border-afro-teal text-afro-teal'
    : 'border-[#334852] text-[#c8d7d5] hover:border-[#5c7782] hover:text-white';

  return (
    <button
      aria-label={label}
      aria-pressed={isActive}
      className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border px-2 ${activeClass}`}
      data-advanced-toggle="true"
      onClick={onToggle}
      title={label}
      type="button"
    >
      <Layers className="shrink-0" size={16} />
      {isCollapsed ? <span className="sr-only">{label}</span> : <span className="text-[11px] font-bold">{label}</span>}
    </button>
  );
}
```

- [ ] **Step 8: Type-check**

Run: `npm --workspace @afrows/dashboard run typecheck`
Expected: PASS. (Will fail at the `<Sidebar .../>` call site in `DashboardApp.tsx` for the two new required props — that is fixed in Task 5. If you want a clean check now, run only after Task 5; otherwise expect exactly those two "missing prop" errors and no others.)

- [ ] **Step 9: Commit**

```bash
git add apps/dashboard/src/components/Sidebar.tsx
git commit -m "feat(dashboard): Sidebar renders Main always + Advanced group behind toggle"
```

---

### Task 5: DashboardApp owns the persisted advancedMode state

**Files:**
- Modify: `apps/dashboard/src/DashboardApp.tsx` (`:635-642` kiosk helpers, `:743` state, `:935-939` persist effect, `:1068-1080` `<Sidebar>` usage)

- [ ] **Step 1: Import the helpers and add the initial-load function**

In `DashboardApp.tsx`, add to the imports near the top (alongside other `./` imports):
```ts
import { advancedModeStorageKey, parseAdvancedMode, serializeAdvancedMode } from './nav-views';
```
Then, directly after `loadInitialKioskMode()` (`:641-643`), add:
```ts
function loadInitialAdvancedMode() {
  if (typeof window === 'undefined') return false;
  return parseAdvancedMode(window.localStorage.getItem(advancedModeStorageKey));
}
```

- [ ] **Step 2: Add the state**

In `DashboardApp.tsx`, directly after the kiosk state line `const [isKioskMode, setIsKioskMode] = useState(loadInitialKioskMode);` (`:743`), add:
```ts
  const [advancedMode, setAdvancedMode] = useState(loadInitialAdvancedMode);
```

- [ ] **Step 3: Persist on change (mirror the kiosk effect)**

In `DashboardApp.tsx`, the kiosk persist effect at `:938-940` is:
```ts
  useEffect(() => {
    window.localStorage.setItem(kioskStorageKey, isKioskMode ? 'enabled' : 'disabled');
  }, [isKioskMode]);
```
Add an equivalent effect immediately after it:
```ts
  useEffect(() => {
    window.localStorage.setItem(advancedModeStorageKey, serializeAdvancedMode(advancedMode));
  }, [advancedMode]);
```

- [ ] **Step 4: Pass the two props to Sidebar**

In `DashboardApp.tsx`, the `<Sidebar .../>` usage at `:1068`. Add `advancedMode` and `onToggleAdvancedMode` (keep props alphabetical to match the existing order — `advancedView` goes right after `activeView`):
```tsx
        <Sidebar
          activeView={activeView}
          advancedMode={advancedMode}
          isCollapsed={isSidebarCollapsed}
          isRtl={isRtl}
          nextLanguage={nextLanguage}
          onLanguageChange={onLanguageChange}
          onSignOut={onSignOut}
          onToggleAdvancedMode={() => setAdvancedMode((current) => !current)}
          onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
          onViewChange={setActiveView}
          sidebarAlertState={sidebarAlertState}
          session={session}
          t={t}
        />
```

- [ ] **Step 5: Full type-check (whole dashboard now consistent)**

Run: `npm --workspace @afrows/dashboard run typecheck`
Expected: PASS, no errors.

- [ ] **Step 6: Re-run the unit test (regression guard)**

Run: `node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON apps/dashboard/src/nav-views.test.ts`
Expected: PASS — `# pass 5`, `# fail 0`.

- [ ] **Step 7: Production build gate**

Run: `npm --workspace @afrows/dashboard run build`
Expected: `tsc --noEmit` clean + `vite build` succeeds (emits `dist/`).

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/src/DashboardApp.tsx
git commit -m "feat(dashboard): persist per-admin advanced-mode + wire Sidebar toggle"
```

---

### Task 6: Manual verification (no code)

**Files:** none — this is a verification checklist run with `npm --workspace @afrows/dashboard run dev` (serves on `127.0.0.1:4000`).

- [ ] **Step 1: Default state is Simple**

Open the dashboard logged in as a full admin (clear `localStorage` first or use a fresh profile). Confirm the sidebar shows exactly the 8 Main items: Dashboard, Customers, Billing, Outbounds, Microtiks, Alerts, **Admins**, Settings — and a "Show advanced" toggle in the footer. None of the 7 Advanced items appear.

- [ ] **Step 2: Toggle reveals Advanced**

Click "Show advanced". Confirm an "Advanced" divider label appears followed by Servers, Inbounds, Connections, Routes, Audit logs, Backups, Reports. The toggle now reads "Hide advanced".

- [ ] **Step 3: Persistence**

Reload the page. Confirm Advanced stays visible (read from `localStorage` key `afrows.dashboard.advanced` = `enabled`). Click "Hide advanced", reload, confirm it stays hidden.

- [ ] **Step 4: Deep link still works with toggle OFF**

With Advanced hidden, navigate directly to the routes page URL (e.g. append `?view=routes` or the app's route form — see `viewFromUrl()` / `ROUTE_VIEWS` in `DashboardApp.tsx`). Confirm the Routes page still loads even though it is not in the sidebar.

- [ ] **Step 5: Rename + RBAC + reseller**

Confirm the former "Users" item reads "Admins" and still opens the same page. If a reseller login is available, confirm it shows only its allowed Main items and **no** Advanced toggle.

- [ ] **Step 6: Persian**

Switch language to FA. Confirm the toggle reads "نمایش پیشرفته" / "پنهان کردن پیشرفته", the group label is "پیشرفته", and the Admins item reads "مدیران".

---

## Self-Review

**1. Spec coverage:**
- Two nav groups (Main 8 / Advanced 7) → Tasks 1 (pure source), 2 (icons), 4 (render). ✓
- Advanced-mode toggle, default OFF, localStorage, mirrors kiosk pattern → Tasks 1 (helpers), 5 (state + persist). ✓
- Toggle rendered at sidebar footer near language/logout → Task 4 Steps 6-7. ✓
- Advanced group under an "Advanced" divider/label → Task 4 Step 5 + Task 3 `advancedNavGroup`. ✓
- Deep links keep working (router untouched) → no change to `ROUTE_VIEWS`/`viewFromUrl`; verified Task 6 Step 4. ✓
- Users→Admins label-only rename, route key stays `users` → Task 3 (label in i18n only; `view:'users'` unchanged). ✓
- Role visibility forward-compat (reseller gets no toggle) → Task 4 `canUseAdvancedToggle` gate. ✓
- Testing: pure `splitNav`-equivalent unit (Main 8 / Advanced 7 / union 15 / no dupes) + `loadAdvancedMode` defaults/persist + `tsc --noEmit` gate → Task 1 test + Task 5 Steps 5-7. ✓

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to" — every code step shows full code. ✓ (The single conditional NOTE in Task 2 gives an exact fallback, not a vague instruction.)

**3. Type consistency:** `MAIN_VIEWS`/`ADVANCED_VIEWS` (Task 1) consumed by `nav-config.ts` (Task 2) and `nav-views.test.ts`; `MAIN_NAV`/`ADVANCED_NAV` (Task 2) consumed by `Sidebar.tsx` (Task 4); `advancedModeStorageKey`/`parseAdvancedMode`/`serializeAdvancedMode` (Task 1) consumed by `DashboardApp.tsx` (Task 5); `advancedMode`/`onToggleAdvancedMode` props defined in Task 4 and supplied in Task 5; i18n keys `showAdvancedNav`/`hideAdvancedNav`/`advancedNavGroup` defined in Task 3 and used in Task 4. All names consistent. ✓
