# Customers reorg — D1 (gateway-in-Customers + per-customer Exit selector) — design

**Date:** 2026-06-25
**Status:** Approved (brainstorm) → ready for implementation plan
**Part of:** the dashboard UX overhaul (A–E). This is **D1** (dashboard reorg). A, C1, C2 are merged + deployed. **D2** (data-plane enforcement of per-customer exit) and **E** (reseller panel) are separate.

## Problem

The operator's flow is "create an account, pick its protocol + exit, sell internet." Today:
- Protocol-on-create already works (Customers form picks protocols; app does Auto on login).
- Gateway MikroTiks (Home/Office = a customer's router) are managed on a **separate** standalone MikroTiks page, away from the customer they belong to.
- A customer's **exit** (Auto best-path vs a fixed IP) has a full `route_preference` data model + admin endpoints, but is **not surfaced** in the Customers UI.

## Goal (D1 only)

Make the Customers page the single place to create + manage + sell a customer: fold gateway-MikroTik management into the customer's edit view, remove the standalone MikroTiks nav item, and add a per-config **Exit** selector (Auto / fixed) that saves the existing `route_preference`. Dashboard-only; **no new backend endpoints**; **no data-plane change**.

## Non-goals (deferred)

- **Enforcing** the fixed exit in the data plane (egress reconciler per-customer routing) → **D2**. In D1 the selector is honestly labelled "saved — applies once per-customer routing ships."
- Reseller panel → **E**.
- Any change to transport MikroTiks (they live in Exits→Sources from C1) or to protocol-on-create (already done).

## Findings the design relies on

- Admin route-preference endpoints already exist: `GET/PATCH /billing/client-configs/:id/route-preference` (`UpsertClientRoutePreferenceDto`: `routeGroup`, `mode`, `preferredExitCountryCode`, `preferredOutboundId`, `scoreProfile`, `autoDetectCountry`, `allowClientOverride`, `routeLocked`). The dashboard's `api/admin.ts` has **no wrapper** for them yet → D1 adds two thin client wrappers (not new endpoints).
- `ClientRoutePreferenceMode = 'auto' | 'country' | 'outbound'`. D1 uses **`auto`** (best path) and **`outbound`** + `preferredOutboundId` (fixed exit). `country` is out of scope.
- `route_preference` is keyed **per client-config** (+ `routeGroup`), so the Exit selector is per protocol-row. D1 uses `routeGroup: 'main'` (consistent with the rest of the app).
- `MikroTikRouterSummary` carries `customerAccountId` and `role`, so `MicrotiksPage` can be filtered to one customer's gateway(s).
- `fetchAdminOutbounds` exists to populate the fixed-exit dropdown.

## Design

### 1. `MicrotiksPage` gains a `customerAccountId` filter
Add an optional prop `customerAccountId?: string` (alongside the C1 `roleFilter`). When set, `visibleRows` additionally filters to `router.customerAccountId === customerAccountId`. Both filters compose (`roleFilter="gateway"` + `customerAccountId=<id>` → that customer's gateways only). Unset → unchanged. This reuses the entire existing management UI (egress on/off, reboot/reconnect, rate, credential reveal, connect-config, usage charts).

### 2. Gateway management inside the Customers edit view
In `CustomersPage` **edit** mode (`editId` set), render an "Internet gateway" section containing `<MicrotiksPage roleFilter="gateway" customerAccountId={editId} sessionToken={…} t={…} />`. Plus an **assign/unassign** control in edit mode (today gateway-attach only exists at create): a dropdown of unassigned gateway routers → `updateRouter(id, { role: 'gateway', customerAccountId: editId })`; and an unassign action → `updateRouter(id, { customerAccountId: null })`. (Both already exist via `updateRouter`.)

### 3. Per-config Exit selector
In the edit view's protocol/config list, each client-config row gets an **Exit** control:
- **Auto (best ping/jitter/speed)** → `PATCH client-configs/:id/route-preference { routeGroup:'main', mode:'auto' }`.
- **Fixed: \<outbound\>** → `{ routeGroup:'main', mode:'outbound', preferredOutboundId:<id> }`, dropdown from `fetchAdminOutbounds`.
- Current value loaded via `GET client-configs/:id/route-preference`.
- Helper text: "Saved. Takes effect when per-customer routing ships (D2)." — honest about non-enforcement.
- New dashboard API wrappers in `api/admin.ts`: `fetchAdminClientRoutePreference(token, configId, routeGroup?)` and `updateAdminClientRoutePreference(token, configId, payload)` calling the existing endpoints.

### 4. Remove the standalone MikroTiks nav item
Remove `'microtiks'` from `MAIN_VIEWS` in `nav-views.ts` (sidebar goes 8→7 Main items). **Keep** `'microtiks'` in `ROUTE_VIEWS` + the `case 'microtiks'` render (gateway-filtered) so deep links still work (same pattern C1 used for Outbounds/Routes). `nav-config.ts` `NAV_ICONS` keeps its `microtiks` entry (still a valid `ActiveView`).

## Implementation shape (files)

- **Modify** `apps/dashboard/src/pages/MicrotiksPage.tsx` — add `customerAccountId?` filter prop (composes with `roleFilter`).
- **Modify** `apps/dashboard/src/nav-views.ts` — drop `microtiks` from `MAIN_VIEWS`.
- **Modify** `apps/dashboard/src/nav-views.test.ts` — assert microtiks not in sidebar, still routable.
- **Modify** `apps/dashboard/src/api/admin.ts` — add the two route-preference wrappers.
- **Modify** `apps/dashboard/src/pages/CustomersPage.tsx` — edit-view gateway section (embed filtered `MicrotiksPage` + assign/unassign) and per-config Exit selector.
- **Modify** `apps/dashboard/src/i18n.en.ts` / `i18n.fa.ts` — strings for the gateway section, Exit selector (Auto / Fixed / the "saved, not yet enforced" note), assign/unassign.
- No backend change. `DashboardApp.tsx` unchanged except (optionally) nothing — `case 'microtiks'` stays for deep-link.

## Testing

- **Unit (extend `nav-views.test.ts`):** `MAIN_VIEWS` no longer includes `microtiks`; `ADVANCED_VIEWS` unchanged; assert `microtiks` absent from the sidebar union (still present in `ROUTE_VIEWS` is a DashboardApp concern, checked by tsc).
- **Gates:** `tsc --noEmit` + `vite build`.
- **Manual:** standalone MikroTiks nav item gone; opening a customer shows its gateway(s) with working management (egress toggle, reboot, rate, credential, usage); assign/unassign a gateway works; Exit selector loads current value and saves Auto + Fixed; deep link `?view=microtiks` still loads; FA strings render.

## Rollout
Dashboard-only, no migration, no data-plane change, reversible (restore the nav item). D2 will make the saved Exit actually route (extend the egress reconciler to emit per-account rules from `route_preference.preferredOutboundId`, mirroring the existing gaming-tier pattern).
