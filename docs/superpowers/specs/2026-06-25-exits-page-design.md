# Exits / Internet-sources page (sub-project C) — design

**Date:** 2026-06-25
**Status:** Approved (brainstorm) → ready for implementation plan
**Part of:** the dashboard UX overhaul (A–E). This is **C**. A (nav Simple/Advanced split) shipped 2026-06-25. B/D/E are separate specs.

## Problem

The operator can't tell **Outbounds** vs **Routes** vs **Settings→Route** apart — they
overlap (failover/route logic appears in all three) and there's no single answer to
"where is my internet coming from and what happens when a path dies." Separately, the
**MikroTiks** page mixes two opposite things: routers that bring internet *into* the
server (Village/Starlink = `transport`) and routers that are *a customer's* gateway
sending internet *out* to users (Home/Office = `gateway`).

## Goal (C only)

Consolidate everything about **how Afrows reaches the foreign internet** into one
**Exits** page with tabs, reusing the existing page components as panels (low-risk, no
feature rewrites), and split the MikroTiks page by `role` so "internet coming in" lives
with Exits and "going out to a customer" stays separate. Dashboard-only — no backend or
data-model change (the `role` field already exists).

## Non-goals (deferred, recorded for direction)

- Gateway MikroTiks → **Customers** area + protocol-on-customer-creation + per-customer
  Auto/fixed-IP exit → **sub-project D**.
- Reseller (نمایندگی) panel → **sub-project E**.
- Alert-noise purge + Dashboard trim → **sub-project B**.
- Renaming **Inbounds → "Connection methods"** → left for a later pass (C only renames
  the Outbounds/Routes surfaces into "Exits").

## Design

### Nav change
- Add a new `ActiveView` **`exits`**, placed in the **Main** group (it's the everyday
  "where's my internet" page). Remove **`outbounds`** and **`routes`** from the sidebar
  groups (`MAIN_VIEWS`/`ADVANCED_VIEWS` in `apps/dashboard/src/nav-views.ts`).
- `outbounds` and `routes` **remain valid `ActiveView` route keys** and stay in
  `ROUTE_VIEWS`, so existing deep links / bookmarks (`?view=routes`) still load. They
  just no longer appear as sidebar items.
- The standalone **`microtiks`** item stays in Main but now shows **gateway routers
  only** (see "MikroTik role split").

### ExitsPage shell (new component)
`apps/dashboard/src/pages/ExitsPage.tsx` — a thin tabbed shell using the existing
`DashboardTabs` primitive (same pattern as `RoutesPage`/`SettingsPage`). It owns the
active-tab state (`ExitsTab = 'egress' | 'routing' | 'sources'`, default `'egress'`)
and renders existing components as panels. It receives the union of props its children
need and forwards them; `DashboardApp`'s `case 'exits'` supplies them (the same values
already computed for the `routes` and `microtiks` cases).

Three tabs:
1. **Egress paths** (`egress`) → renders existing **`OutboundsPage`** (`{ sessionToken, t }`)
   — the foreign relay outbounds: list, test, subscriptions. This is the surface the
   "Outbounds → Exits" rename refers to.
2. **Failover & routing** (`routing`) → renders existing **`RoutesPage`** (with its own
   overview/policy/canary/history sub-tabs) **plus** the extracted **`RouteSettingsPanel`**
   (see below). `RoutesPage` needs: `dataState, failoverRows, format, outbounds, session,
   sessionToken, tunnelDataState, tunnelSummaries, tunnels, t` — all already produced in
   `DashboardApp` for the `routes` case and forwarded through `ExitsPage`.
3. **Sources (Village/Starlink)** (`sources`) → renders **`MicrotiksPage`** filtered to
   `role: 'transport'` — the routers that bring internet *into* the server.

### RouteSettingsPanel extraction (the one real refactor)
`SettingsPage.tsx` is ~1887 lines; its **`route`** tab (route mode automatic/manual,
assignment lock, current/locked outbound selectors, `RouteDecisionPreviewPanel`,
`RouteIntelligencePanel`, and the associated route state + handlers) is intertwined with
Settings' own state. Leaving route *config* in Settings while route *monitoring* moves to
Exits would re-create the very "two places" confusion we're removing.

So: **extract the Settings route tab into a standalone `RouteSettingsPanel` component**
(`apps/dashboard/src/components/route-settings-panel.tsx`) that encapsulates its own route
state/handlers (route assignment fetch/update, route settings update, decision preview),
taking the props it needs (`session, sessionToken, format, t`, plus the outbound list for
the selectors). Then:
- Render `RouteSettingsPanel` inside Exits → **Failover & routing**.
- **Remove the `route` tab** from `SettingsPage` (`SettingsTab` drops `'route'`; default
  tab becomes `'protocols'`; delete the route `<section>` and now-unused route state from
  SettingsPage). Settings keeps `wireguard · protocols · branding · telegram`.

This is the only non-mechanical task; the other two tabs are reuse-as-is.

### MikroTik role split
- Add an optional prop **`roleFilter?: MikroTikRouterRole`** to `MicrotiksPage`. When set,
  the page lists only routers whose `role` matches (filter applied to the loaded rows; the
  add/edit form pre-selects that role). When unset, behavior is unchanged.
- Exits → **Sources** renders `<MicrotiksPage roleFilter="transport" … />`.
- The standalone **`microtiks`** nav view renders `<MicrotiksPage roleFilter="gateway" … />`
  (Home/Office only). D later relocates these into the Customers area and removes the
  standalone item.

### i18n
- Add `nav.exits` (en: "Exits", fa: e.g. "خروجی‌ها") for the sidebar label.
- Add Exits tab labels (`tabs.exitsEgress` / `tabs.exitsRouting` / `tabs.exitsSources`,
  + an `ariaLabel`) in both `i18n.en.ts` and `i18n.fa.ts` (parity enforced by
  `DashboardStrings = typeof en`).
- `RouteSettingsPanel` keeps reusing the existing `t.settings.*` / route strings it
  already uses (moved, not renamed) to avoid churn.

### Deep links & RBAC
- `viewFromUrl` / `ROUTE_VIEWS` unchanged except adding `exits`; `outbounds`/`routes`
  still resolve.
- RBAC: Exits has no new gate (Outbounds/Routes were ungated for non-resellers; resellers
  never saw them — `resellerNavViews` does not include `exits`, so resellers still don't).

## Implementation shape (files)

- **New** `apps/dashboard/src/pages/ExitsPage.tsx` — tabbed shell.
- **New** `apps/dashboard/src/components/route-settings-panel.tsx` — extracted route config.
- **Modify** `apps/dashboard/src/pages/SettingsPage.tsx` — remove `route` tab + route state.
- **Modify** `apps/dashboard/src/pages/MicrotiksPage.tsx` — add `roleFilter` prop.
- **Modify** `apps/dashboard/src/nav-views.ts` — add `exits` to Main; remove
  `outbounds`/`routes` from the group arrays.
- **Modify** `apps/dashboard/src/nav-config.ts` — add `exits` icon (e.g. `Waypoints`/`Route`).
- **Modify** `apps/dashboard/src/dashboard-types.ts` — `ActiveView` gains `exits`;
  add `ExitsTab`; `SettingsTab` loses `route`.
- **Modify** `apps/dashboard/src/DashboardApp.tsx` — add `case 'exits'` rendering
  `ExitsPage` with forwarded props; `case 'microtiks'` passes `roleFilter="gateway"`;
  `ROUTE_VIEWS` gains `exits`.
- **Modify** `apps/dashboard/src/i18n.en.ts` + `i18n.fa.ts` — `nav.exits` + Exits tab strings.

## Testing

- **Unit (extend `nav-views.test.ts`):** Main contains `exits`; Main/Advanced do **not**
  contain `outbounds` or `routes`; union of Main+Advanced has no duplicates. (Total
  sidebar views drop from 15 to 14; `exits` replaces two, so the "covers every ActiveView"
  assertion is replaced by an explicit expected-membership assertion since `ROUTE_VIEWS`
  still holds `outbounds`/`routes`.)
- **Gates:** `tsc --noEmit` clean (catches `SettingsTab`/`ActiveView` fallout + i18n
  parity) and `vite build` clean.
- **Manual:** Exits appears in Main with 3 tabs; Egress paths = the old Outbounds; Failover
  & routing shows Routes sub-tabs + the route-config formerly in Settings; Sources lists
  only transport routers; the standalone MikroTiks item lists only gateway routers;
  Settings no longer has a Route tab; deep links to `?view=routes` and `?view=outbounds`
  still load; FA labels render.

## Rollout
Dashboard-only; ships with the next dashboard build. No migration, no backend change,
fully reversible (restore the two nav entries + Settings route tab). Forward path: D
folds gateway MikroTiks into Customers and removes the standalone MikroTiks item.
