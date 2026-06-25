# Dashboard nav: Simple/Advanced split + Advanced-mode toggle (sub-project A) — design

**Date:** 2026-06-25
**Status:** Approved (brainstorm) → ready for implementation plan
**Part of:** the dashboard UX overhaul (A–E). This is **A** (the nav shell). B–E are separate specs.

## Problem

The dashboard sidebar shows **15 pages flat**, mixing everyday business tasks (sell,
bill, watch health) with raw infrastructure/xray plumbing (Inbounds, Outbounds,
Routes, Connections, Servers). The operator can't tell what each is, there's
duplication (route/failover appears in Outbounds, Routes, and Settings→Route),
and there's no "simple" view. Result: confusing and busy.

## Goal (A only)

Reorganize the **existing** pages into two groups with a per-admin **Advanced
mode** toggle (default Simple), plus the single clarity-critical rename. **No new
pages, no merges, no backend change** — those are sub-projects B–E.

## Non-goals (deferred to later sub-projects, recorded here for direction)

- Merging Outbounds + Routes + Settings→Route into one **"Exits / Internet
  sources"** page → **sub-project C**.
- Moving Protocol to Customer creation + per-customer exit choice → **sub-project D**.
- The **Reseller (نمایندگی) panel** → **sub-project E**.
- Alert-noise purge + Dashboard trim → **sub-project B**.
- **Splitting the MikroTiks page by role** (operator's insight: separate the
  MikroTiks that bring internet *into* the server from those that send it *out
  to users*). This is real and the data already supports it — each router has a
  `role` of **`transport`** (Village/Starlink = internet **source** → belongs
  with **Exits**, sub-project C) or **`gateway`** (Home/Office = a **customer's**
  router → belongs with **Customers**, sub-project D). In A the MikroTiks page
  stays whole and in Main; C and D split it by `role`.

## Design

### Two nav groups
The current flat nav (`ROUTE_VIEWS` in `DashboardApp.tsx:645`) splits into:

- **Main (always visible):**
  `dashboard · customers · billing · outbounds · microtiks · alerts · users · settings`
- **Advanced (visible only when Advanced mode is ON):**
  `servers · inbounds · connections · routes · audit · backups · reports`

(All 15 existing `ActiveView` keys are covered; none are removed.)

### Advanced-mode toggle
- A persisted boolean, **default OFF (Simple)**, stored in `localStorage` under a
  dedicated key — mirroring the existing kiosk-mode pattern
  (`loadInitialKioskMode()` / `kioskStorageKey` in `DashboardApp.tsx:641`).
- Rendered as a labelled switch at the **bottom of the sidebar** near the
  language (`FA`) / logout controls.
- When OFF, the Advanced group is not rendered in the sidebar. When ON, it appears
  (e.g. under a small "Advanced" divider/label).

### Deep links keep working
Visibility is **sidebar-only**. `viewFromUrl()` / the `ROUTE_VIEWS` router stay
unchanged, so a direct URL or bookmark to a hidden page (e.g. `/routes`) still
loads it. The toggle never blocks navigation; it only declutters the sidebar.

### Rename (just one in A)
- **"Users" → "Admins"** (label only; the route key stays `users` so URLs/links
  don't break). It manages admin/RBAC accounts and was confusing next to
  "Customers". Bigger renames (Outbounds→"Exits", Inbounds→"Connection methods")
  are deferred to C so we don't rename twice.

### Role visibility (forward-compatible, not built in A)
The toggle is per-admin. When the Reseller panel (E) lands, resellers get the
Main group with **no** Advanced toggle. A should structure the nav config so a
future role check can hide the toggle without rework (e.g. the toggle render is
already conditional on a single flag).

## Implementation shape

Contained to the dashboard shell (`apps/dashboard/src/DashboardApp.tsx` + the
sidebar render):
- Define `MAIN_NAV` and `ADVANCED_NAV` arrays (each an ordered list of the
  existing nav items: `{ view, label, icon }`), replacing the single flat list.
- Add `advancedMode` state initialized from `localStorage` (mirror the kiosk
  helpers), with a setter that persists on change.
- Sidebar renders `MAIN_NAV` always; renders `ADVANCED_NAV` (under an "Advanced"
  label) only when `advancedMode`. Add the toggle control in the sidebar footer.
- Change the "Users" item's display label to "Admins"; keep `view: 'users'`.
- `ROUTE_VIEWS`, `viewFromUrl`, routing, and all page components are unchanged.

## Testing

- **Unit:** a pure helper `splitNav(items)` (or the two arrays) — assert Main has
  the 8 expected views, Advanced has the 7, union == all 15, no duplicates/omissions.
- **Unit:** `loadAdvancedMode()` defaults false; persists/reads true.
- **Manual:** default load shows 8 Main items + the toggle; flipping ON reveals
  the 7 Advanced items under the "Advanced" label and persists across reload;
  a direct URL to a hidden page (`/routes`) still loads with the toggle OFF;
  "Users" reads "Admins".
- `flutter`/dashboard gate: `npx tsc --noEmit` clean.

## Rollout
Frontend-only; ships with the next dashboard deploy. Zero data/route changes, so
no migration and fully reversible (toggle default OFF = same pages, just grouped).
