# Route-settings extraction into Exits (sub-project C2) — design

**Date:** 2026-06-25
**Status:** Approved (brainstorm) → ready for implementation plan
**Part of:** the dashboard UX overhaul. **C2** = the route-config extraction deliberately split out of C1 (which shipped: Exits page with Egress/Routing/Sources tabs). A and C1 are merged to `main`.

## Problem

The route **config** still lives in **Settings → Route**, while route **monitoring** now lives in **Exits → Failover & routing** (C1's `RoutesPage`). That re-creates a "two places for routing" split. C2 moves the route *editing* into Exits so routing has one home.

## Constraint discovered during brainstorm (drives the whole design)

Route state in `SettingsPage` is **not route-only**. `routeMode`, `loadBalanceStrategy`, and the derived `activeWireGuard` are consumed by:
- **Protocols** tab → `createProtocolSetupConfig(draft, routeMode, loadBalanceStrategy, activeWireGuard, selectedTargetServer)` when provisioning a setup.
- **WireGuard** tab + readiness/status rows → `activeWireGuard` / `wireGuardCandidates` display.

So a pure "delete route from Settings" breaks Protocols + WireGuard. **Decision (approved): extract the route EDITING UI into Exits, but keep route/candidate values as READ-ONLY state in Settings** so the surviving tabs keep working.

## Goal (C2 only)

- New `RouteSettingsPanel` component, self-contained (own data fetch + state + handlers + markup), rendered in **Exits → Failover & routing** **above** the existing `RoutesPage` (config on top, monitoring below — approved layout).
- Remove the **Route** tab from `SettingsPage` (`SettingsTab` drops `'route'`, default tab → `'protocols'`); delete the route editing section, the route decision/intelligence side-rail panels, and the route-only state/handlers from Settings.
- Keep in Settings (read-only, still fetched): `routeMode`, `loadBalanceStrategy`, `selectedWireGuardId`, `wireGuardCandidates`, and the derived `activeWireGuard` — needed by Protocols + WireGuard.
- Extract the shared WireGuard-candidate logic into a **pure, unit-testable** module used by both Settings and `RouteSettingsPanel`.

Dashboard-only. No backend/API change. No new strings (reuse existing `t.settings.*` / `t.panels.routeControl` / `t.routePolicy.*` — they move with the markup, not renamed).

## Non-goals

- Deeper decoupling (making Protocol provisioning fetch the active route from the API) — explicitly rejected in brainstorm as higher-risk; Settings keeps a read-only local copy instead.
- Any change to RoutesPage monitoring (C1 already placed it in Exits).
- B / D / E.

## Design

### New pure module: `apps/dashboard/src/route-candidates.ts`
Extracts the candidate logic currently inline in `SettingsPage` so both consumers share one source of truth (and we get a real test without a React harness):
- `buildSampleWireGuardCandidates(t: DashboardStrings): WireGuardHealthCandidate[]` — the body of the current `sampleWireGuardCandidates` useMemo (depends on `t` strings; not pure but deterministic).
- `pickWireGuardCandidates(api, sample)` → `api.length > 0 ? api : sample`.
- `deriveActiveWireGuard(candidates, routeMode, selectedWireGuardId)` → `{ best, selected, active }` where `best` = highest `score`, `selected` = `find(id) ?? best`, `active` = `routeMode === 'manual' ? selected : best`. **Pure → unit-tested.**
- (`getWireGuardScoreTone` already lives in `../tone`; reused, not moved.)

### New component: `apps/dashboard/src/components/route-settings-panel.tsx`
`RouteSettingsPanel({ format, session, sessionToken, t })`. Self-contained:
- **State (moved from Settings):** `routeMode`, `loadBalanceStrategy`, `selectedWireGuardId`, the `assignment*` editing fields (`assignmentAutoRouteEnabled`, `assignmentRouteLocked`, `assignmentCurrentOutboundId`, `assignmentLockedOutboundId`, `assignmentHysteresisScoreDelta`, `assignmentCooldownSeconds`), `apiWireGuardCandidates`, `routeQualityAnalytics`, `routeDecisionPreview`, `routeDecisionEvents`, `routeDecisionEventDetail`, `routeDecisionSwitchExecution`, `routeMessage`, `isRouteSaving`, `isDecisionRecording`, `isDecisionApplying`, `isDecisionEventDetailLoading`, `dataState`.
- **Own load effect (moved):** `fetchAdminSettings` (for `routeSettings` → `loadBalanceStrategy`/`selectedWireGuardId`, and `wireGuardCandidates`), `fetchRouteAssignment`, `fetchRouteQualityAnalytics`, `fetchRouteDecisionPreview`, `fetchRouteDecisionEvents`.
- **Handlers (moved):** `saveRouteSettings` (`updateAdminRouteSettings` + `updateAdminRouteAssignment`), the decision `record`/`apply`/`event-detail` handlers (`recordRouteDecisionPreview`, `applyRouteDecisionPreview`, `fetchRouteDecisionEvent`).
- **Markup (moved):** the route control `<section>` (mode selector, assignment lock, managed-route selectors, candidate list/best-health) **and** the `RouteIntelligencePanel` + `RouteDecisionPreviewPanel`.
- **Derivations:** uses `route-candidates.ts` for candidates + `deriveActiveWireGuard`.

### `SettingsPage` changes
- `SettingsTab` (in `dashboard-types.ts`) drops `'route'`; initial `activeSettingsTab` → `'protocols'`; remove `'route'` from `settingsTabs` and from the `settingsHasSideRail` condition.
- Delete the route `<section>`, the side-rail `RouteIntelligencePanel`/`RouteDecisionPreviewPanel`, and the route-only state + handlers listed above (now in the panel).
- **Keep** (read-only): `routeMode`, `loadBalanceStrategy`, `selectedWireGuardId`, `apiWireGuardCandidates`, candidate derivation via `route-candidates.ts`, and `activeWireGuard` — for Protocols (`createProtocolSetupConfig`) + WireGuard display. These remain populated by the surviving `fetchAdminSettings` + `fetchRouteAssignment` calls in Settings' load effect (`applyRouteAssignment` keeps setting `routeMode`/`selectedWireGuardId` + the cosmetic `protocolDraft.profile` pre-fill, which is now retained since the fetch stays). The `assignment*` editing fields are removed from Settings.
- Replace the inline `sampleWireGuardCandidates` useMemo + `wireGuardCandidates`/`bestWireGuard`/`selectedWireGuard`/`activeWireGuard` derivations with calls into `route-candidates.ts`.
- Remove now-unused imports (`RouteDecisionPreviewPanel`, `RouteIntelligencePanel`, route-decision API fns used only by the moved handlers, `ArrowDownUp` if unused, etc.).

### ExitsPage change
`Exits → Failover & routing` tab renders `RouteSettingsPanel` then `RoutesPage`:
```tsx
{activeTab === 'routing' ? (
  <div className="flex flex-col gap-4">
    <RouteSettingsPanel format={format} session={session} sessionToken={sessionToken} t={t} />
    <RoutesPage … />
  </div>
) : null}
```

## Testing

- **Unit (new `route-candidates.test.ts`, `node --test`):** `deriveActiveWireGuard` — best = max score; selected = id match else best; active = manual→selected, automatic→best; empty candidates handled. `pickWireGuardCandidates` — prefers api, falls back to sample.
- **Gates:** `tsc --noEmit` clean (catches every moved-symbol mismatch + the `SettingsTab` fallout) and `vite build` clean. tsc is the primary safety net for this mechanical move.
- **Manual (critical — no React harness):**
  1. Exits → Failover & routing shows the route config on top, RoutesPage below; changing mode/lock + **Save** persists (route still works).
  2. Decision preview / record / apply still function in the panel.
  3. Settings has **no** Route tab; default tab is Protocols.
  4. Settings → **Protocols**: provisioning a setup still embeds the right route mode/active WireGuard (read-only reflects backend).
  5. Settings → **WireGuard**: active-candidate readout + candidate table still render.
  6. FA renders (no missing strings).

## Rollout
Dashboard-only, no migration, reversible (restore the Settings route tab + state). Risk is concentrated in the mechanical move of ~20 state vars / 4 handlers / 2 markup regions inside an 1887-line file; mitigations = the pure-module TDD anchor + `tsc` + the manual checklist. Recommended execution: subagent/inline task-by-task with a `tsc` gate after **every** task so a broken move surfaces immediately.
