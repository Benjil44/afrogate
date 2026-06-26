# Network map (sub-project G1) — design

**Date:** 2026-06-26
**Status:** Approved (brainstorm) → ready for implementation plan
**Part of:** dashboard UX. New sub-project **G**. G1 = read-only live map + sidebar consolidation. G2 (interactive builder that edits the data plane) is deferred.

## Problem

There's no single place to *see how Afrows is wired* — incoming user methods, the engines/routing, and the outgoing egress are spread across separate table pages (Inbounds, Connections, Exits). The operator wants a visual "incoming internet → server → outgoing internet" map, and the Advanced sidebar has overlapping items to consolidate.

## Goal (G1, read-only)

A new **Network** view (tabbed) that:
1. **Map tab** — a live, read-only 3-column diagram: **Incoming → Afrows → Outgoing**, with status dots; click a node for details / a link to the relevant page.
2. **Inbounds tab** — the existing `InboundsPage` (reused).
3. **Connections tab** — the existing `ConnectionsPage` (reused).

And consolidate the sidebar: **Inbounds + Connections leave the sidebar** (folded into Network); **Network** is added to **Advanced**. No data-plane changes (read-only). No builder (G2).

## Design

### Nav (mirrors C1's pattern)
- Add `ActiveView` **`network`**; add it to `ADVANCED_VIEWS`.
- Remove **`inbounds`** and **`connections`** from `ADVANCED_VIEWS` (keep both in `ROUTE_VIEWS` + their `case` renders so deep links still work — same treatment C1 gave Outbounds/Routes).
- Advanced becomes: **Network · Servers · Audit logs · Backups · Reports** (6→5).
- `nav-config` icon for `network` (e.g. `Network`/`Workflow` from lucide).

### `NetworkPage` (new tabbed shell)
`apps/dashboard/src/pages/NetworkPage.tsx` — uses `DashboardTabs` (same as ExitsPage). Tabs: `map | inbounds | connections` (default `map`). It receives the props its children need and forwards them; `DashboardApp`'s `case 'network'` supplies them (the same values it already passes to the `inbounds`/`connections` cases, plus what the map needs).

### Map tab (`NetworkMap` component)
Three columns of nodes with connecting lines; the active path highlighted.

- **Incoming** (from `fetchAdminInbounds` → `AdminInboundSummary[]`): one node per inbound — label `protocol · :port` (e.g. "VLESS-WS · 443", "VLESS-TCP · 8080", "WireGuard · 51822"), `host/path` as subtext. Status dot = listening (present in config). Optional live device count per inbound from `fetchConnections` (best-effort; omit if not cheap).
- **Afrows (center)**: a single node for the box (`94.74.145.199`) showing the engines (xray + wg0) and the current **catch-all** target label. Backend health drives its dot.
- **Outgoing** (from `fetchAdminOutbounds` → health + `fetchRouteAssignment` → current/preferred): one node per egress path — **via-germany, via-village (Starlink), proxy (pool), direct** — with health dot and ping/score if available. The **active catch-all** egress is highlighted.
- **Lines**: incoming nodes → Afrows → the active outgoing node (active path bold; others faded).
- **Interactivity (read-only):** clicking an incoming node switches to the Inbounds tab (scrolled/filtered if easy); clicking an outgoing node deep-links to **Exits** (the egress detail). Hover shows status text.
- **Honest "as-of":** a "live · updated <time>" stamp; auto-refresh on an interval (e.g. 15–30 s) like other live views.

### Data sources (compose client-side; minimal backend)
- `fetchAdminInbounds`, `fetchAdminOutbounds`, `fetchRouteAssignment` — all exist.
- **Applied catch-all egress** (which of germany/village/proxy/direct is live *now*): not currently exposed by an admin API (it's in the egress reconciler's state file). **G1 approach:** mark the egress the route assignment points to / the healthiest preferred, and label it "preferred". If a precise "applied now" indicator is wanted, add a tiny read-only `GET /admin/network-overview` that returns the applied catch-all (read from the egress state file) + engine liveness — **optional, decided at plan time**; G1 ships fine without it using route-assignment + outbound health.
- Live connection counts (`fetchConnections`) — best-effort enrichment.

### i18n
`nav.network` (en "Network", fa "شبکه") + Network tab labels (`networkSections/networkMap/networkInbounds/networkConnections`) + map node labels (Incoming/Outgoing/Afrows server, "active", "preferred", "as-of"). Reuse existing inbound/outbound strings where possible.

## Non-goals
- **Interactive builder** (add/wire inbounds↔egress, edit the data plane) → **G2**.
- Changing actual routing/egress (read-only).
- Touching Servers/Audit/Backups/Reports (they stay in Advanced).

## Testing
- **Unit (extend `nav-views.test.ts`):** `network` in Advanced; `inbounds`/`connections` NOT in the sidebar union (still in `ROUTE_VIEWS`).
- **Gates:** `tsc --noEmit` + `vite build`.
- **Manual:** Network view shows Map/Inbounds/Connections tabs; map renders incoming nodes (WS/TCP/WG), the Afrows node, and egress nodes with health + the active/preferred path highlighted; clicking outgoing → Exits; deep links `?…/inbounds` + `/connections` still load; Advanced sidebar shows Network·Servers·Audit·Backups·Reports; FA renders.

## Rollout
Dashboard-only, reversible (restore the two nav entries). Ships with the next deploy. G2 (builder) is a separate, higher-risk project.
