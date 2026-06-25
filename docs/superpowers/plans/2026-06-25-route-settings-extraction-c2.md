# Route-settings extraction into Exits — C2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the route **editing** UI out of `SettingsPage` into a self-contained `RouteSettingsPanel` rendered in **Exits → Failover & routing** (above `RoutesPage`), while leaving `routeMode`/`loadBalanceStrategy`/`activeWireGuard`/candidates as **read-only** state in Settings so the Protocols + WireGuard tabs keep working.

**Architecture:** A new pure `route-candidates.ts` module (the WireGuard-candidate derivation, unit-tested) is consumed by both Settings and the new panel. The panel owns its own data fetch + state + handlers + markup (route control section + decision/intelligence panels), with two adaptations vs. the Settings original: `routeGroup` is hardcoded `'main'` (every existing route fetch already uses `'main'`), and the protocol-profile coupling becomes a local `routeProfile` state (seeded from `routeSettings.protocolProfile`). Settings then deletes the route tab + route-only state/handlers/markup and trims `applyRouteAssignment`.

**Tech Stack:** React 19 + Vite + TypeScript, `lucide-react`, `node --test` (pure module), `tsc --noEmit` + `vite build` gates. **tsc is the primary safety net — run it after every task.**

**Spec:** `docs/superpowers/specs/2026-06-25-route-settings-extraction-c2-design.md`

**Sequencing rationale:** Build the shared module (1) → make Settings use it with zero behavior change (2) → build the new panel (3) → wire it into Exits and verify it works (4) → only THEN delete the route tab from Settings (5). The panel is proven before the Settings deletion, and there's a brief intentional window (after task 4, before task 5) where route config shows in both places.

---

## File structure

| File | Responsibility | New/Modify |
|------|----------------|------------|
| `apps/dashboard/src/route-candidates.ts` | Pure: `buildSampleWireGuardCandidates`, `pickWireGuardCandidates`, `deriveActiveWireGuard`. | **New** |
| `apps/dashboard/src/route-candidates.test.ts` | `node --test` for the pure derivations. | **New** |
| `apps/dashboard/src/pages/SettingsPage.tsx` | (T2) use the module; (T5) delete route tab + route-only state/handlers/markup, trim `applyRouteAssignment`, keep read-only route values. | Modify |
| `apps/dashboard/src/components/route-settings-panel.tsx` | New self-contained route editing component. | **New** |
| `apps/dashboard/src/pages/ExitsPage.tsx` | Render `RouteSettingsPanel` above `RoutesPage` in the routing tab. | Modify |
| `apps/dashboard/src/dashboard-types.ts` | `SettingsTab` drops `'route'`. | Modify |

---

### Task 1: Pure `route-candidates` module (TDD)

**Files:**
- Create: `apps/dashboard/src/route-candidates.ts`
- Test: `apps/dashboard/src/route-candidates.test.ts`

Reference — current inline logic in `SettingsPage.tsx`: sample list `:110-156`, `wireGuardCandidates` `:157-160`, derivations `:360-362`.

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/src/route-candidates.test.ts`:
```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveActiveWireGuard, pickWireGuardCandidates } from './route-candidates.ts';

const mk = (id: string, score: number) => ({
  id, name: id, endpoint: null, routeGroup: 'main', healthStatus: 'healthy',
  score, latencyMs: 0, jitterMs: 0, packetLossPercent: 0, loadPercent: 0,
  checkedAt: null, source: 'sample' as const,
});

test('pickWireGuardCandidates prefers api, falls back to sample', () => {
  const sample = [mk('s', 1)];
  const api = [mk('a', 2)];
  assert.deepEqual(pickWireGuardCandidates(api, sample), api);
  assert.deepEqual(pickWireGuardCandidates([], sample), sample);
});

test('deriveActiveWireGuard: best = highest score', () => {
  const c = [mk('a', 50), mk('b', 90), mk('c', 70)];
  const { best } = deriveActiveWireGuard(c, 'automatic', '');
  assert.equal(best.id, 'b');
});

test('deriveActiveWireGuard: automatic → active is best; manual → active is selected', () => {
  const c = [mk('a', 50), mk('b', 90)];
  assert.equal(deriveActiveWireGuard(c, 'automatic', 'a').active.id, 'b');
  assert.equal(deriveActiveWireGuard(c, 'manual', 'a').active.id, 'a');
});

test('deriveActiveWireGuard: selected falls back to best when id not found', () => {
  const c = [mk('a', 50), mk('b', 90)];
  const { selected } = deriveActiveWireGuard(c, 'manual', 'missing');
  assert.equal(selected.id, 'b');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON apps/dashboard/src/route-candidates.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

Create `apps/dashboard/src/route-candidates.ts`:
```ts
import type { LoadBalanceStrategy, RouteSelectionMode } from '@afrows/shared';
import type { WireGuardHealthCandidate } from './dashboard-types';
import type { DashboardStrings } from './i18n';

// Sample fallback candidates shown when the API returns none. Moved verbatim from
// SettingsPage; `endpoint` lets the WireGuard-setup form override the primary's label.
export function buildSampleWireGuardCandidates(
  t: DashboardStrings,
  endpoint?: string,
): WireGuardHealthCandidate[] {
  return [
    {
      id: 'wg-primary', name: t.settings.primaryGateway,
      endpoint: (endpoint && endpoint.trim()) || 'gateway.example.com:51820',
      routeGroup: 'main', healthStatus: 'healthy', score: 92, latencyMs: 48, jitterMs: 5,
      packetLossPercent: 0.1, loadPercent: 42, checkedAt: null, source: 'sample',
    },
    {
      id: 'wg-backup', name: t.settings.backupGateway, endpoint: 'backup.example.com:51820',
      routeGroup: 'main', healthStatus: 'healthy', score: 84, latencyMs: 63, jitterMs: 9,
      packetLossPercent: 0.3, loadPercent: 31, checkedAt: null, source: 'sample',
    },
    {
      id: 'wg-control', name: t.settings.controlGateway, endpoint: 'control.example.com:51820',
      routeGroup: 'main', healthStatus: 'degraded', score: 71, latencyMs: 88, jitterMs: 15,
      packetLossPercent: 0.7, loadPercent: 58, checkedAt: null, source: 'sample',
    },
  ];
}

export function pickWireGuardCandidates(
  api: WireGuardHealthCandidate[],
  sample: WireGuardHealthCandidate[],
): WireGuardHealthCandidate[] {
  return api.length > 0 ? api : sample;
}

export function deriveActiveWireGuard(
  candidates: WireGuardHealthCandidate[],
  routeMode: RouteSelectionMode,
  selectedWireGuardId: string,
): { best: WireGuardHealthCandidate; selected: WireGuardHealthCandidate; active: WireGuardHealthCandidate } {
  const best = candidates.reduce((b, c) => (c.score > b.score ? c : b), candidates[0]);
  const selected = candidates.find((c) => c.id === selectedWireGuardId) ?? best;
  const active = routeMode === 'manual' ? selected : best;
  return { best, selected, active };
}

// Re-export so callers have one import site for the load-balance option list shape.
export type { LoadBalanceStrategy };
```

> NOTE: confirm `WireGuardHealthCandidate` is exported from `./dashboard-types` (it is — imported there by SettingsPage at `:6`) and `RouteSelectionMode`/`LoadBalanceStrategy` from `@afrows/shared` (SettingsPage imports them from there at `:4`). If `node --test` can't resolve `@afrows/shared` (path alias), the test only imports `deriveActiveWireGuard`/`pickWireGuardCandidates` which don't need runtime values from it — the `import type` is erased, so the test still runs. Keep all `@afrows/shared` imports as `import type`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON apps/dashboard/src/route-candidates.test.ts`
Expected: PASS — `# pass 4`.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/route-candidates.ts apps/dashboard/src/route-candidates.test.ts
git commit -m "feat(dashboard): pure route-candidates module (derive active WireGuard) + tests"
```

---

### Task 2: SettingsPage uses route-candidates (zero behavior change)

**Files:**
- Modify: `apps/dashboard/src/pages/SettingsPage.tsx` (`:110-164`, `:360-362`)

Swap the inline sample/pick/derive logic for the module so Settings and the panel share one source. No tab/state removal yet.

- [ ] **Step 1: Import the module**

In `SettingsPage.tsx`, add near the other `./` imports:
```ts
import { buildSampleWireGuardCandidates, deriveActiveWireGuard, pickWireGuardCandidates } from '../route-candidates';
```

- [ ] **Step 2: Replace the sample + pick useMemos (`:110-160`)**

Replace the `sampleWireGuardCandidates` useMemo (`:110-156`) and the `wireGuardCandidates` useMemo (`:157-160`) with:
```ts
  const sampleWireGuardCandidates = useMemo<WireGuardHealthCandidate[]>(
    () => buildSampleWireGuardCandidates(t, draft.endpoint),
    [draft.endpoint, t],
  );
  const wireGuardCandidates = useMemo<WireGuardHealthCandidate[]>(
    () => pickWireGuardCandidates(apiWireGuardCandidates, sampleWireGuardCandidates),
    [apiWireGuardCandidates, sampleWireGuardCandidates],
  );
```
(Leave `managedWireGuardCandidates` `:161-164` unchanged for now.)

- [ ] **Step 3: Replace the best/selected/active derivations (`:360-362`)**

Replace the three lines:
```ts
  const bestWireGuard = wireGuardCandidates.reduce((best, candidate) => candidate.score > best.score ? candidate : best, wireGuardCandidates[0]);
  const selectedWireGuard = wireGuardCandidates.find((candidate) => candidate.id === selectedWireGuardId) ?? bestWireGuard;
  const activeWireGuard = routeMode === 'manual' ? selectedWireGuard : bestWireGuard;
```
with:
```ts
  const { best: bestWireGuard, selected: selectedWireGuard, active: activeWireGuard } = deriveActiveWireGuard(wireGuardCandidates, routeMode, selectedWireGuardId);
```

- [ ] **Step 4: Type-check + build**

Run: `npm --workspace @afrows/dashboard run typecheck`  → expect CLEAN.
Run: `npm --workspace @afrows/dashboard run build` → expect clean.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/pages/SettingsPage.tsx
git commit -m "refactor(dashboard): SettingsPage uses shared route-candidates module"
```

---

### Task 3: Create `RouteSettingsPanel`

**Files:**
- Create: `apps/dashboard/src/components/route-settings-panel.tsx`

This moves the route editing logic+markup. Source references in `SettingsPage.tsx`: state `:45-53,82,90-94,100,103-105`; `applyRouteAssignment` `:165-184`; load fetches `:202-346` (route subset); handlers `saveRouteSettings :695-743`, `recordDecisionEvent :833-857`, `inspectDecisionEvent :859-873`, `applyDecisionAssignment :875-901`; markup section `:987-1171` and decision/intelligence `:1713-1732`; `loadBalanceOptions :364-368`; `managedWireGuardCandidates :161-164`.

**Adaptations (apply while moving):**
- `routeGroup` is always `'main'` (replace every `protocolDraft.routeGroup.trim() || draft.routeGroup.trim() || 'main'` with the literal `'main'`).
- The protocol-profile coupling becomes a local `routeProfile` state (`ProtocolProfile`, init `'balanced'`), seeded from `routeSettings.protocolProfile` on load and from `assignment.speedProfile` in the panel's `applyRouteAssignment`; `saveRouteSettings` sends `protocolProfile: routeProfile` / `speedProfile: routeProfile`.
- Sample candidates via `buildSampleWireGuardCandidates(t)` (no endpoint — the WireGuard form lives in Settings).
- Drop the `${activeSettingsTab === 'route' ? '' : 'hidden'}` gating in the moved markup (the panel is always its tab's content).

- [ ] **Step 1: Create the component skeleton with imports, state, derivations**

Create `apps/dashboard/src/components/route-settings-panel.tsx`:
```tsx
import { useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, CheckCircle2 } from 'lucide-react';
import type { AdminRouteAssignmentSummary, AdminRouteDecisionEventDetail, AdminRouteDecisionEventSummary, AdminRouteDecisionPreviewResponse, AdminRouteDecisionSwitchExecutionSummary, AdminRouteQualityAnalyticsResponse, AdminSessionResponse, AdminSettingsResponse, LoadBalanceStrategy, ProtocolProfile, RouteSelectionMode } from '@afrows/shared';
import { applyRouteDecisionPreview, fetchAdminSettings, fetchRouteAssignment, fetchRouteDecisionEvent, fetchRouteDecisionEvents, fetchRouteDecisionPreview, fetchRouteQualityAnalytics, recordRouteDecisionPreview, updateAdminRouteAssignment, updateAdminRouteSettings } from '../api/admin';
import { PanelHeading, StatusBadge } from '../components/primitives';
import { RouteDecisionPreviewPanel, RouteIntelligencePanel } from '../components/route-decision';
import { SettingsInput } from '../components/settings-form';
import type { DataState, WireGuardHealthCandidate } from '../dashboard-types';
import { clamp, type DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { buildSampleWireGuardCandidates, deriveActiveWireGuard, pickWireGuardCandidates } from '../route-candidates';
import { getWireGuardScoreTone } from '../tone';
import { wireGuardCandidateSourceLabel } from '../wireguard-helpers';

const panelClass = 'rounded-lg border border-afro-line bg-white p-3.5 shadow-sm';

export function RouteSettingsPanel({
  format,
  session,
  sessionToken,
  t,
}: {
  format: DashboardFormatters;
  session: AdminSessionResponse;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const [routeMode, setRouteMode] = useState<RouteSelectionMode>('automatic');
  const [loadBalanceStrategy, setLoadBalanceStrategy] = useState<LoadBalanceStrategy>('balanced');
  const [selectedWireGuardId, setSelectedWireGuardId] = useState('wg-primary');
  const [routeProfile, setRouteProfile] = useState<ProtocolProfile>('balanced');
  const [assignmentAutoRouteEnabled, setAssignmentAutoRouteEnabled] = useState(true);
  const [assignmentRouteLocked, setAssignmentRouteLocked] = useState(false);
  const [assignmentCurrentOutboundId, setAssignmentCurrentOutboundId] = useState('');
  const [assignmentLockedOutboundId, setAssignmentLockedOutboundId] = useState('');
  const [assignmentHysteresisScoreDelta, setAssignmentHysteresisScoreDelta] = useState('15');
  const [assignmentCooldownSeconds, setAssignmentCooldownSeconds] = useState('180');
  const [apiWireGuardCandidates, setApiWireGuardCandidates] = useState<WireGuardHealthCandidate[]>([]);
  const [routeQualityAnalytics, setRouteQualityAnalytics] = useState<AdminRouteQualityAnalyticsResponse | null>(null);
  const [routeDecisionPreview, setRouteDecisionPreview] = useState<AdminRouteDecisionPreviewResponse | null>(null);
  const [routeDecisionEvents, setRouteDecisionEvents] = useState<AdminRouteDecisionEventSummary[]>([]);
  const [routeDecisionEventDetail, setRouteDecisionEventDetail] = useState<AdminRouteDecisionEventDetail | null>(null);
  const [routeDecisionSwitchExecution, setRouteDecisionSwitchExecution] = useState<AdminRouteDecisionSwitchExecutionSummary | null>(null);
  const [routeMessage, setRouteMessage] = useState<string | null>(null);
  const [dataState, setDataState] = useState<DataState>('loading');
  const [isRouteSaving, setIsRouteSaving] = useState(false);
  const [isDecisionRecording, setIsDecisionRecording] = useState(false);
  const [isDecisionApplying, setIsDecisionApplying] = useState(false);
  const [isDecisionEventDetailLoading, setIsDecisionEventDetailLoading] = useState(false);

  const sampleWireGuardCandidates = useMemo<WireGuardHealthCandidate[]>(() => buildSampleWireGuardCandidates(t), [t]);
  const wireGuardCandidates = useMemo<WireGuardHealthCandidate[]>(
    () => pickWireGuardCandidates(apiWireGuardCandidates, sampleWireGuardCandidates),
    [apiWireGuardCandidates, sampleWireGuardCandidates],
  );
  const managedWireGuardCandidates = useMemo(
    () => wireGuardCandidates.filter((candidate) => candidate.source === 'outbound'),
    [wireGuardCandidates],
  );
  const { best: bestWireGuard, selected: selectedWireGuard, active: activeWireGuard } = deriveActiveWireGuard(wireGuardCandidates, routeMode, selectedWireGuardId);
  const routeModeDescription = routeMode === 'automatic' ? t.settings.autoModeDescription : t.settings.manualModeDescription;
  const loadBalanceOptions: Array<[LoadBalanceStrategy, string]> = [
    ['balanced', t.settings.balancedStrategy],
    ['stability', t.settings.stabilityStrategy],
    ['throughput', t.settings.throughputStrategy],
  ];

  const applyRouteAssignment = (assignment: AdminRouteAssignmentSummary) => {
    setAssignmentAutoRouteEnabled(assignment.autoRouteEnabled);
    setAssignmentRouteLocked(assignment.routeLocked);
    setAssignmentCurrentOutboundId(assignment.currentOutboundId ?? '');
    setAssignmentLockedOutboundId(assignment.lockedOutboundId ?? assignment.currentOutboundId ?? '');
    setAssignmentHysteresisScoreDelta(String(assignment.hysteresisScoreDelta));
    setAssignmentCooldownSeconds(String(assignment.cooldownSeconds));
    setRouteMode(assignment.autoRouteEnabled ? 'automatic' : 'manual');
    if (assignment.currentOutboundId) setSelectedWireGuardId(assignment.currentOutboundId);
    if (
      assignment.speedProfile === 'balanced' || assignment.speedProfile === 'highSpeed' ||
      assignment.speedProfile === 'highSecurity' || assignment.speedProfile === 'gaming'
    ) {
      setRouteProfile(assignment.speedProfile);
    }
  };

  // (load effect, handlers, and return markup added in the next steps)
  return null;
}
```

- [ ] **Step 2: Add the load effect**

Replace `return null;` with the effect first (then the handlers + markup in later steps). Insert before the `return`:
```tsx
  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();
    setDataState('loading');
    setRouteQualityAnalytics(null);
    setRouteDecisionPreview(null);
    setRouteDecisionEvents([]);
    setRouteDecisionEventDetail(null);

    fetchAdminSettings(sessionToken, 'main', controller.signal)
      .then((data: AdminSettingsResponse) => {
        if (!isActive) return;
        setApiWireGuardCandidates(data.wireGuardCandidates);
        setDataState('live');
        if (
          data.routeSettings.loadBalanceStrategy === 'balanced' ||
          data.routeSettings.loadBalanceStrategy === 'stability' ||
          data.routeSettings.loadBalanceStrategy === 'throughput'
        ) {
          setLoadBalanceStrategy(data.routeSettings.loadBalanceStrategy);
        }
        if (data.routeSettings.selectedOutboundId) setSelectedWireGuardId(data.routeSettings.selectedOutboundId);
        if (
          data.routeSettings.protocolProfile === 'balanced' || data.routeSettings.protocolProfile === 'highSpeed' ||
          data.routeSettings.protocolProfile === 'highSecurity' || data.routeSettings.protocolProfile === 'gaming'
        ) {
          setRouteProfile(data.routeSettings.protocolProfile);
        }
      })
      .catch((error) => {
        if (!isActive || (error instanceof DOMException && error.name === 'AbortError')) return;
        setDataState('fallback');
      });

    fetchRouteAssignment(sessionToken, 'main', 'default', controller.signal)
      .then((data) => { if (isActive) applyRouteAssignment(data); })
      .catch((error) => { if (!isActive || (error instanceof DOMException && error.name === 'AbortError')) return; });

    fetchRouteQualityAnalytics(sessionToken, 'main', 168, controller.signal)
      .then((data) => { if (isActive) setRouteQualityAnalytics(data); })
      .catch((error) => { if (!isActive || (error instanceof DOMException && error.name === 'AbortError')) return; setRouteQualityAnalytics(null); });

    fetchRouteDecisionPreview(sessionToken, 'main', 'default', controller.signal)
      .then((data) => { if (isActive) setRouteDecisionPreview(data); })
      .catch((error) => { if (!isActive || (error instanceof DOMException && error.name === 'AbortError')) return; setRouteDecisionPreview(null); });

    fetchRouteDecisionEvents(sessionToken, 'main', 'default', 10, controller.signal)
      .then((data) => { if (isActive) setRouteDecisionEvents(data.events); })
      .catch((error) => { if (!isActive || (error instanceof DOMException && error.name === 'AbortError')) return; setRouteDecisionEvents([]); });

    return () => { isActive = false; controller.abort(); };
  }, [sessionToken]);
```

- [ ] **Step 3: Add the handlers**

Add the four handlers (copied from `SettingsPage.tsx` with the two adaptations — `routeGroup = 'main'`, profile = `routeProfile`):
```tsx
  const saveRouteSettings = async () => {
    setIsRouteSaving(true);
    setRouteMessage(null);
    try {
      const routeGroup = 'main';
      const selectedManagedOutboundId = activeWireGuard.source === 'outbound' ? activeWireGuard.id : null;
      const currentOutboundId = assignmentCurrentOutboundId || selectedManagedOutboundId;
      const lockedOutboundId = assignmentRouteLocked ? assignmentLockedOutboundId || currentOutboundId : null;
      const mode: RouteSelectionMode = assignmentAutoRouteEnabled ? 'automatic' : 'manual';
      const hysteresisScoreDelta = clamp(Math.round(Number(assignmentHysteresisScoreDelta) || 15), 1, 100);
      const cooldownSeconds = clamp(Math.round(Number(assignmentCooldownSeconds) || 180), 30, 3600);
      await updateAdminRouteSettings(sessionToken, {
        routeGroup, mode,
        selectedOutboundId: mode === 'manual' ? currentOutboundId || null : null,
        loadBalanceStrategy, protocolProfile: routeProfile, speedProfile: routeProfile,
      });
      const savedAssignment = await updateAdminRouteAssignment(sessionToken, {
        routeGroup, assignmentKey: 'default', assignmentLabel: t.settings.defaultAssignment,
        currentOutboundId: currentOutboundId || null, lockedOutboundId: lockedOutboundId || null,
        autoRouteEnabled: assignmentAutoRouteEnabled, routeLocked: assignmentRouteLocked,
        protocolProfile: routeProfile, speedProfile: routeProfile, hysteresisScoreDelta, cooldownSeconds,
      });
      const preview = await fetchRouteDecisionPreview(sessionToken, routeGroup, 'default');
      applyRouteAssignment(savedAssignment);
      setRouteDecisionPreview(preview);
      setRouteDecisionEventDetail(null);
      setRouteDecisionSwitchExecution(null);
      setRouteMode(mode);
      setRouteMessage(t.settings.routeSettingsSaved);
      setDataState('live');
    } catch (error) {
      setRouteMessage(t.settings.saveFailed);
    } finally {
      setIsRouteSaving(false);
    }
  };

  const recordDecisionEvent = async () => {
    setIsDecisionRecording(true);
    setRouteMessage(null);
    try {
      const response = await recordRouteDecisionPreview(sessionToken, { routeGroup: 'main', assignmentKey: 'default' });
      setRouteDecisionPreview(response.preview);
      setRouteDecisionEvents((current) => [response.event, ...current.filter((event) => event.id !== response.event.id)].slice(0, 10));
      setRouteDecisionEventDetail(null);
      setRouteDecisionSwitchExecution(null);
      setRouteMessage(t.settings.routeDecisionRecorded);
    } catch (error) {
      setRouteMessage(t.settings.routeDecisionRecordFailed);
    } finally {
      setIsDecisionRecording(false);
    }
  };

  const inspectDecisionEvent = async (eventId: string) => {
    setIsDecisionEventDetailLoading(true);
    setRouteMessage(null);
    try {
      const response = await fetchRouteDecisionEvent(sessionToken, eventId);
      setRouteDecisionEventDetail(response.event);
      setRouteDecisionSwitchExecution(response.event.switchExecution ?? null);
    } catch (error) {
      setRouteMessage(t.settings.decisionEventDetailFailed);
    } finally {
      setIsDecisionEventDetailLoading(false);
    }
  };

  const applyDecisionAssignment = async () => {
    setIsDecisionApplying(true);
    setRouteMessage(null);
    try {
      const response = await applyRouteDecisionPreview(sessionToken, { routeGroup: 'main', assignmentKey: 'default', applyMode: 'assignmentOnly' });
      applyRouteAssignment(response.assignment);
      setRouteDecisionPreview(response.preview);
      setRouteDecisionSwitchExecution(response.switchExecution);
      setRouteDecisionEvents((current) => [response.event, ...current.filter((event) => event.id !== response.event.id)].slice(0, 10));
      setRouteDecisionEventDetail(null);
      setRouteMessage(response.dataPlaneApplied ? t.settings.routeDecisionApplied : t.settings.routeDecisionAssignmentApplied);
    } catch (error) {
      setRouteMessage(t.settings.routeDecisionApplyFailed);
    } finally {
      setIsDecisionApplying(false);
    }
  };
```

- [ ] **Step 4: Add the return markup**

Replace `return null;` with the markup below. The route control `<section>` body is copied **verbatim** from `SettingsPage.tsx:989-1170` (the `<div className="mt-3 grid gap-3">…</div>` inner block — everything between `<PanelHeading … />` and `</section>`); the only change is the outer wrapper has no `activeSettingsTab` gating. Then the two decision/intelligence panels are copied from `:1714` and `:1718-1731` without their `activeSettingsTab` wrappers:
```tsx
  return (
    <div className="flex flex-col gap-3">
      <section className={panelClass}>
        <PanelHeading title={t.panels.routeControl} icon={ArrowDownUp} meta={t.settings.smartRoute} />
        {/* VERBATIM COPY of SettingsPage.tsx:989-1170 — the `<div className="mt-3 grid gap-3"> … </div>`
            block. It already references only: routeMode, setRouteMode, assignment* + setters,
            managedWireGuardCandidates, loadBalanceOptions, loadBalanceStrategy, setLoadBalanceStrategy,
            wireGuardCandidates, selectedWireGuard, setSelectedWireGuardId, bestWireGuard, activeWireGuard,
            dataState (was settingsDataState — RENAME to dataState), getWireGuardScoreTone, format, t,
            StatusBadge, SettingsInput, wireGuardCandidateSourceLabel, isRouteSaving, saveRouteSettings,
            routeMessage — all defined above. */}
      </section>
      <RouteIntelligencePanel analytics={routeQualityAnalytics} format={format} t={t} />
      <RouteDecisionPreviewPanel
        eventDetail={routeDecisionEventDetail}
        events={routeDecisionEvents}
        format={format}
        isApplying={isDecisionApplying}
        isEventDetailLoading={isDecisionEventDetailLoading}
        isRecording={isDecisionRecording}
        onApply={() => void applyDecisionAssignment()}
        onInspectEvent={(eventId) => void inspectDecisionEvent(eventId)}
        onRecord={() => void recordDecisionEvent()}
        preview={routeDecisionPreview}
        switchExecution={routeDecisionSwitchExecution}
        t={t}
      />
    </div>
  );
```
When copying `:989-1170`, make exactly one rename: `settingsDataState` → `dataState` (line `:1157`). Everything else resolves to symbols declared in this component.

> NOTE: verify the import source of `wireGuardCandidateSourceLabel` — grep `SettingsPage.tsx` for its import line and copy that exact specifier into the panel (the placeholder `'../wireguard-helpers'` above is a guess; replace it with the real path). Same for any other helper the copied markup calls that isn't already imported (e.g. confirm `clamp` path).

- [ ] **Step 5: Type-check**

Run: `npm --workspace @afrows/dashboard run typecheck`
Expected: errors only if an import path/name differs — fix by matching `SettingsPage.tsx`'s imports. No `session` unused warning expected (tsc doesn't error on unused props; the prop is kept for parity/future RBAC). When clean, continue.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/components/route-settings-panel.tsx
git commit -m "feat(dashboard): RouteSettingsPanel (self-contained route editing)"
```

---

### Task 4: Render the panel in Exits → Failover & routing

**Files:**
- Modify: `apps/dashboard/src/pages/ExitsPage.tsx`

- [ ] **Step 1: Import + render above RoutesPage**

In `ExitsPage.tsx`, add the import:
```ts
import { RouteSettingsPanel } from '../components/route-settings-panel';
```
Replace the `routing` tab block:
```tsx
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
```
with:
```tsx
      {activeTab === 'routing' ? (
        <div className="flex flex-col gap-4">
          <RouteSettingsPanel format={format} session={session} sessionToken={sessionToken} t={t} />
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
        </div>
      ) : null}
```

- [ ] **Step 2: Type-check + build**

Run: `npm --workspace @afrows/dashboard run typecheck` → CLEAN.
Run: `npm --workspace @afrows/dashboard run build` → clean.

- [ ] **Step 3: Manual smoke (panel works before deleting Settings copy)**

`npm --workspace @afrows/dashboard run dev` → Exits → Failover & routing: the route config panel renders on top, RoutesPage below. Change mode/lock and **Save** → succeeds. (Route config still ALSO appears in Settings at this point — expected; removed in Task 5.)

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/pages/ExitsPage.tsx
git commit -m "feat(dashboard): render RouteSettingsPanel above RoutesPage in Exits"
```

---

### Task 5: Remove the route tab from SettingsPage (keep read-only route values)

**Files:**
- Modify: `apps/dashboard/src/dashboard-types.ts:20`
- Modify: `apps/dashboard/src/pages/SettingsPage.tsx`

**Keep (read-only, still fetched) in Settings:** `routeMode`, `loadBalanceStrategy`, `selectedWireGuardId`, `apiWireGuardCandidates`, `wireGuardCandidates`, `bestWireGuard`, `selectedWireGuard`, `activeWireGuard` — used by Protocols (`createProtocolSetupConfig` `:565`) + WireGuard tab + readiness rows.
**Remove from Settings:** the `assignment*` fields, `routeMessage`, `routeQualityAnalytics`, `routeDecisionPreview`, `routeDecisionEvents`, `routeDecisionEventDetail`, `routeDecisionSwitchExecution`, `isRouteSaving`, `isDecisionRecording`, `isDecisionApplying`, `isDecisionEventDetailLoading`, `managedWireGuardCandidates`, `loadBalanceOptions`, the route handlers, the route fetches (quality/preview/events), the route `<section>`, and the two route side-rail panels.

- [ ] **Step 1: `SettingsTab` drops `'route'`**

In `dashboard-types.ts:20`:
```ts
export type SettingsTab = 'wireguard' | 'protocols' | 'branding' | 'telegram';
```

- [ ] **Step 2: Default tab + tabs list + side-rail**

In `SettingsPage.tsx`:
- Change `useState<SettingsTab>('route')` (`:75`) → `useState<SettingsTab>('protocols')`.
- Delete the `route` entry from `settingsTabs` (`:948-952`).
- Change `settingsHasSideRail` (`:974`) to drop the route clause:
```ts
  const settingsHasSideRail = activeSettingsTab === 'wireguard' || activeSettingsTab === 'protocols';
```

- [ ] **Step 3: Delete the route markup**

In `SettingsPage.tsx`, delete:
- the route `<section className={`${panelClass} ${activeSettingsTab === 'route' ? '' : 'hidden'}`}>` … `</section>` block (`:987-1171`).
- the two route side-rail blocks `<div className={activeSettingsTab === 'route' ? '' : 'hidden'}><RouteIntelligencePanel … /></div>` (`:1713-1715`) and `<div …><RouteDecisionPreviewPanel … /></div>` (`:1717-1732`).

- [ ] **Step 4: Trim `applyRouteAssignment` to the retained read-only values**

Replace `applyRouteAssignment` (`:165-184`) with a version that no longer sets the removed `assignment*` state — it keeps only what Protocols/WireGuard need plus the cosmetic profile pre-fill:
```ts
  const applyRouteAssignment = (assignment: AdminRouteAssignmentSummary) => {
    setRouteMode(assignment.autoRouteEnabled ? 'automatic' : 'manual');
    if (assignment.currentOutboundId) setSelectedWireGuardId(assignment.currentOutboundId);
    setProtocolDraft((current) => ({
      ...current,
      profile:
        assignment.speedProfile === 'balanced' || assignment.speedProfile === 'highSpeed' ||
        assignment.speedProfile === 'highSecurity' || assignment.speedProfile === 'gaming'
          ? assignment.speedProfile
          : current.profile,
    }));
  };
```

- [ ] **Step 5: Delete route-only state, handlers, derivations, and load fetches**

In `SettingsPage.tsx`, delete these declarations/blocks (all now in the panel):
- State: `assignmentAutoRouteEnabled`, `assignmentRouteLocked`, `assignmentCurrentOutboundId`, `assignmentLockedOutboundId`, `assignmentHysteresisScoreDelta`, `assignmentCooldownSeconds` (`:48-53`); `routeMessage` (`:82`); `routeQualityAnalytics`, `routeDecisionPreview`, `routeDecisionEvents`, `routeDecisionEventDetail`, `routeDecisionSwitchExecution` (`:90-94`); `isRouteSaving` (`:100`); `isDecisionRecording`, `isDecisionApplying`, `isDecisionEventDetailLoading` (`:103-105`).
- Derivations: `managedWireGuardCandidates` (`:161-164`) and `loadBalanceOptions` (`:364-368`).
- Handlers: `saveRouteSettings` (`:695-743`), `recordDecisionEvent` (`:833-857`), `inspectDecisionEvent` (`:859-873`), `applyDecisionAssignment` (`:875-901`).
- Load effect: the resets for route decision state (`:207-210`) and the `fetchRouteQualityAnalytics` (`:292-302`), `fetchRouteDecisionPreview` (`:304-314`), `fetchRouteDecisionEvents` (`:316-326`) blocks. **Keep** `fetchAdminSettings` and `fetchRouteAssignment` (they populate the retained read-only `routeMode`/`loadBalanceStrategy`/`selectedWireGuardId`/`apiWireGuardCandidates`).

- [ ] **Step 6: Remove now-unused imports**

In `SettingsPage.tsx`, remove imports that are no longer referenced after the deletions. Candidates: `RouteDecisionPreviewPanel`, `RouteIntelligencePanel` (`:15`); the route-decision API fns used only by deleted handlers (`applyRouteDecisionPreview`, `fetchRouteDecisionEvent`, `fetchRouteDecisionEvents`, `fetchRouteDecisionPreview`, `fetchRouteQualityAnalytics`, `recordRouteDecisionPreview`, `updateAdminRouteAssignment`, `updateAdminRouteSettings`) from the `../api/admin` import (`:5`); `ArrowDownUp`, `CheckCircle2` icons (`:3`) if unused elsewhere; type imports only used by removed code. **Let `tsc` tell you exactly** — it reports every unused import as an error under this repo's config; remove precisely those it names. Do NOT remove `fetchRouteAssignment`/`fetchAdminSettings` or `SettingsInput` (still used).

- [ ] **Step 7: Type-check + unit test + build**

Run: `npm --workspace @afrows/dashboard run typecheck` → CLEAN (fix any remaining unused-import/missing-symbol errors it lists).
Run: `node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON apps/dashboard/src/route-candidates.test.ts` → PASS.
Run: `npm --workspace @afrows/dashboard run build` → clean.

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/src/dashboard-types.ts apps/dashboard/src/pages/SettingsPage.tsx
git commit -m "feat(dashboard): remove Route tab from Settings (route editing now in Exits)"
```

---

### Task 6: Manual verification (no code)

`npm --workspace @afrows/dashboard run dev`, full-admin login.

- [ ] **Step 1:** Exits → Failover & routing: route config panel on top (mode/lock/managed-route/load-balance/save), RoutesPage sub-tabs below. Change mode + **Save** → persists across reload.
- [ ] **Step 2:** Decision preview: **Record** + **Apply** + inspecting an event still work in the panel.
- [ ] **Step 3:** Settings: **no Route tab**; default tab is Protocols; tabs = Protocols · WireGuard · Branding · Telegram.
- [ ] **Step 4:** Settings → **Protocols**: provision/preview reflects the current route mode + active WireGuard (read-only, from backend); creating a setup still succeeds.
- [ ] **Step 5:** Settings → **WireGuard**: active-candidate readout + candidate table render normally.
- [ ] **Step 6:** FA: route panel + Settings render with no missing strings.

---

## Self-Review

**1. Spec coverage:**
- Pure shared module + unit test → Task 1. ✓
- Self-contained `RouteSettingsPanel` (state/effect/handlers/markup, `routeGroup='main'`, `routeProfile`) → Task 3. ✓
- Rendered above RoutesPage in Exits→routing → Task 4. ✓
- Settings drops Route tab, default→Protocols, deletes route-only state/handlers/markup, trims `applyRouteAssignment`, removes unused imports → Task 5. ✓
- Settings KEEPS read-only `routeMode`/`loadBalanceStrategy`/`activeWireGuard`/candidates for Protocols+WireGuard → Task 5 "Keep" list + Steps 4–5 retain those + their two fetches. ✓
- No new strings / no backend change → all strings reused; only existing api fns. ✓
- `tsc` after every task → Tasks 2,3,4,5 each gate. ✓

**2. Placeholder scan:** New files are written in full; the one bulk markup move (Task 3 Step 4) is specified as a verbatim copy of an exact line range with a single named rename (`settingsDataState`→`dataState`) and an explicit symbol-availability list — concrete, not hand-waved. The two NOTE blocks point to `tsc`/grep to resolve exact import specifiers (a real verification action, not a deferred decision). ✓

**3. Type consistency:** `deriveActiveWireGuard`/`pickWireGuardCandidates`/`buildSampleWireGuardCandidates` signatures defined in Task 1, consumed identically in Tasks 2 & 3. `RouteSettingsPanel` prop shape `{ format, session, sessionToken, t }` defined Task 3, supplied Task 4. `routeProfile: ProtocolProfile` defined and used consistently in the panel's `applyRouteAssignment`/load/`saveRouteSettings`. Retained-vs-removed Settings symbols are partitioned with no overlap (read-only kept set ∩ removed set = ∅). ✓
