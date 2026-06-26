# Network map — G1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** A read-only **Network** view with a live Map (Incoming → Afrows → Outgoing) plus Inbounds + Connections as tabs; remove Inbounds/Connections from the sidebar (kept deep-linkable). No data-plane changes.

**Architecture:** New `NetworkPage` tabbed shell (like `ExitsPage`) hosting a new `NetworkMap` component + the reused `InboundsPage`/`ConnectionsPage`. The map composes from `fetchAdminInbounds` + four fixed egress-path nodes, highlighting the **applied catch-all** returned by a tiny new read-only `GET /admin/network-overview` (reads the catch-all outbound tag from the live xray config).

**Tech Stack:** NestJS, React+Vite+TS, `node --test`, `tsc` + `vite build`.

**Spec:** `docs/superpowers/specs/2026-06-26-network-map-g1-design.md`

---

### Task 1: Types + nav swap (TDD)

**Files:** `apps/dashboard/src/dashboard-types.ts`, `apps/dashboard/src/nav-views.ts`, `apps/dashboard/src/nav-views.test.ts`

- [ ] **Step 1: Types** — in `dashboard-types.ts`: add `'network'` to the `ActiveView` union; add `export type NetworkTab = 'map' | 'inbounds' | 'connections';`.

- [ ] **Step 2: Update the test** — in `nav-views.test.ts`, set `SIDEBAR_VIEWS` and the Advanced assertion to the new set (Advanced gains `network`, loses `inbounds`+`connections`):
```ts
const SIDEBAR_VIEWS = [
  'dashboard', 'customers', 'billing', 'exits', 'microtiks', 'alerts', 'users', 'settings',
  'network', 'servers', 'audit', 'backups', 'reports',
];

test('Advanced has the 5 infrastructure views in order', () => {
  assert.deepEqual(ADVANCED_VIEWS, ['network', 'servers', 'audit', 'backups', 'reports']);
});
```
Also change the "Main has the 8" test to keep its existing 8 (unchanged), and in the no-duplicates test add:
```ts
  assert.ok(!union.includes('inbounds'), 'inbounds must not be a sidebar item');
  assert.ok(!union.includes('connections'), 'connections must not be a sidebar item');
```

- [ ] **Step 3: Run → fail** `node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON apps/dashboard/src/nav-views.test.ts`.

- [ ] **Step 4: Update `nav-views.ts`** `ADVANCED_VIEWS`:
```ts
export const ADVANCED_VIEWS: ActiveView[] = [
  'network', 'servers', 'audit', 'backups', 'reports',
];
```

- [ ] **Step 5: Run → pass** (same command) → `# pass 5`.

- [ ] **Step 6: Commit**
```bash
git add apps/dashboard/src/dashboard-types.ts apps/dashboard/src/nav-views.ts apps/dashboard/src/nav-views.test.ts
git commit -m "feat(dashboard): add Network view; drop Inbounds/Connections from sidebar"
```

---

### Task 2: nav-config icon + i18n

**Files:** `nav-config.ts`, `i18n.en.ts`, `i18n.fa.ts`

- [ ] **Step 1: Icon** — in `nav-config.ts`, import `Workflow` from lucide-react and add `network: Workflow,` to `NAV_ICONS`.

- [ ] **Step 2: en strings** — in `i18n.en.ts` `nav` block add `network: 'Network',`; in `tabs` block add:
```ts
      networkSections: 'Network sections',
      networkMap: 'Map',
      networkInbounds: 'Inbounds',
      networkConnections: 'Connections',
```
Add a `networkMap` string group (top-level under the dashboard strings root, near `outboundsPage`):
```ts
    networkMapView: {
      incoming: 'Incoming',
      outgoing: 'Outgoing',
      server: 'Afrows server',
      active: 'active',
      standby: 'standby',
      catchAll: 'Catch-all egress',
      asOf: 'live · updated',
      viaGermany: 'Germany (via village)',
      viaVillage: 'Starlink (village)',
      proxy: 'Relay pool',
      direct: 'Direct (Iran uplink)',
      openExits: 'Open Exits',
      openInbounds: 'Open Inbounds',
    },
```
Add a `pageHeaders.network`:
```ts
      network: { eyebrow: 'Topology', title: 'Network map' },
```

- [ ] **Step 3: fa strings** — mirror all keys in `i18n.fa.ts` (`nav.network: 'شبکه'`, tabs, `networkMapView` (incoming «ورودی», outgoing «خروجی», server «سرور Afrows», active «فعال», standby «آماده‌به‌کار», catchAll «خروج پیش‌فرض», asOf «زنده · به‌روزرسانی», viaGermany «آلمان (از طریق روستا)», viaVillage «استارلینک (روستا)», proxy «استخر رله», direct «مستقیم (آپلینک ایران)», openExits «باز کردن خروجی‌ها», openInbounds «باز کردن این‌باندها»), `pageHeaders.network` («توپولوژی» / «نقشه شبکه»)).

- [ ] **Step 4: typecheck** `npm --workspace @afrows/dashboard run typecheck` → CLEAN (en/fa parity).

- [ ] **Step 5: Commit**
```bash
git add apps/dashboard/src/nav-config.ts apps/dashboard/src/i18n.en.ts apps/dashboard/src/i18n.fa.ts
git commit -m "feat(dashboard): Network nav icon + i18n (map labels)"
```

---

### Task 3: Backend network-overview (applied catch-all)

**Files:** create `apps/backend/src/client/network-overview.service.ts` + `network-overview.controller.ts`; modify `app.module.ts`; `packages/shared/src/index.ts`; `apps/dashboard/src/api/admin.ts`.

- [ ] **Step 1: Shared type** in `packages/shared/src/index.ts`:
```ts
export interface AdminNetworkOverviewResponse {
  /** xray outbound tag the client catch-all currently routes to (via-germany/via-village/proxy/direct), or null. */
  appliedCatchAll: string | null;
}
```

- [ ] **Step 2: Service** `apps/backend/src/client/network-overview.service.ts` — reads the catch-all from the live xray config (the rule whose inboundTag includes `afrows-in`):
```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import type { AdminNetworkOverviewResponse } from '@afrows/shared';

@Injectable()
export class NetworkOverviewService {
  constructor(private readonly config: ConfigService) {}

  async overview(): Promise<AdminNetworkOverviewResponse> {
    const path = this.config.get<string>('AFROWS_XRAY_CONFIG_PATH')?.trim() || '/usr/local/etc/afrows-xray/config.json';
    try {
      const cfg = JSON.parse(await readFile(path, 'utf8')) as { routing?: { rules?: Array<{ inboundTag?: string[]; outboundTag?: string }> } };
      const rules = cfg.routing?.rules ?? [];
      const rule = rules.find((r) => Array.isArray(r.inboundTag) && r.inboundTag.includes('afrows-in') && Boolean(r.outboundTag));
      return { appliedCatchAll: rule?.outboundTag ?? null };
    } catch {
      return { appliedCatchAll: null };
    }
  }
}
```

- [ ] **Step 3: Controller** `apps/backend/src/client/network-overview.controller.ts` — match the auth pattern of a neighboring admin controller (e.g. the inbounds/connections admin controller: same `@Controller('admin')` base + guards/`@Roles`):
```ts
import { Controller, Get } from '@nestjs/common';
import type { AdminNetworkOverviewResponse } from '@afrows/shared';
import { NetworkOverviewService } from './network-overview.service';
// + the same guard/role decorators the sibling admin controllers use.

@Controller('admin')
export class NetworkOverviewController {
  constructor(private readonly service: NetworkOverviewService) {}

  @Get('network-overview')
  overview(): Promise<AdminNetworkOverviewResponse> {
    return this.service.overview();
  }
}
```
> NOTE: copy the exact guard/`@Roles`/decorator setup from the controller that serves `GET /admin/inbounds` so auth matches; register both the controller (in `controllers`) and service (in `providers`) in `app.module.ts`.

- [ ] **Step 4: Register in `app.module.ts`** — import + add `NetworkOverviewController` to `controllers` and `NetworkOverviewService` to `providers`.

- [ ] **Step 5: Dashboard wrapper** in `apps/dashboard/src/api/admin.ts`:
```ts
export async function fetchAdminNetworkOverview(sessionToken: string, signal?: AbortSignal): Promise<AdminNetworkOverviewResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/network-overview`, { headers: createSessionHeaders(sessionToken), signal });
  return response.json() as Promise<AdminNetworkOverviewResponse>;
}
```
(import `AdminNetworkOverviewResponse` from `@afrows/shared`.)

- [ ] **Step 6: Build** `npm --workspace @afrows/backend run build` + `npm --workspace @afrows/dashboard run typecheck` → clean.

- [ ] **Step 7: Commit**
```bash
git add packages/shared/src/index.ts apps/backend/src/client/network-overview.service.ts apps/backend/src/client/network-overview.controller.ts apps/backend/src/app.module.ts apps/dashboard/src/api/admin.ts
git commit -m "feat(backend): GET admin/network-overview (applied catch-all egress)"
```

---

### Task 4: NetworkMap component

**Files:** create `apps/dashboard/src/components/network-map.tsx`

- [ ] **Step 1: Create the component** — read-only 3-column map; fetches inbounds + overview; fixed egress nodes; highlights the applied one:
```tsx
import { useEffect, useState } from 'react';
import type { AdminInboundSummary } from '@afrows/shared';
import { fetchAdminInbounds, fetchAdminNetworkOverview } from '../api/admin';
import type { DashboardStrings } from '../i18n';

const EGRESS = [
  { tag: 'via-germany', key: 'viaGermany' as const },
  { tag: 'via-village', key: 'viaVillage' as const },
  { tag: 'proxy', key: 'proxy' as const },
  { tag: 'direct', key: 'direct' as const },
];

export function NetworkMap({ sessionToken, t, onOpenExits, onOpenInbounds }: {
  sessionToken: string;
  t: DashboardStrings;
  onOpenExits: () => void;
  onOpenInbounds: () => void;
}) {
  const m = t.networkMapView;
  const [inbounds, setInbounds] = useState<AdminInboundSummary[]>([]);
  const [applied, setApplied] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [ib, ov] = await Promise.all([
          fetchAdminInbounds(sessionToken).catch(() => ({ inbounds: [] as AdminInboundSummary[] })),
          fetchAdminNetworkOverview(sessionToken).catch(() => ({ appliedCatchAll: null })),
        ]);
        if (!active) return;
        setInbounds(ib.inbounds);
        setApplied(ov.appliedCatchAll);
        setUpdatedAt(new Date());
      } catch { /* keep last */ }
    };
    void load();
    const timer = setInterval(() => void load(), 20000);
    return () => { active = false; clearInterval(timer); };
  }, [sessionToken]);

  const card = 'rounded-lg border border-afro-line bg-white p-3 shadow-sm';
  const dot = (on: boolean) => `inline-flex h-2 w-2 rounded-full ${on ? 'bg-afro-teal' : 'bg-afro-line'}`;

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold text-afro-muted">{m.catchAll}: <span className="text-afro-ink">{applied ?? '—'}</span></span>
        {updatedAt ? <span className="text-[11px] text-afro-muted">{m.asOf} {updatedAt.toLocaleTimeString()}</span> : null}
      </div>
      <div className="grid items-start gap-3 md:grid-cols-3">
        {/* Incoming */}
        <div className="grid gap-2">
          <div className="text-[11px] font-bold uppercase tracking-wide text-afro-muted">{m.incoming}</div>
          {inbounds.length === 0 ? <div className={card}>—</div> : inbounds.map((ib) => (
            <button key={ib.tag} type="button" onClick={onOpenInbounds} className={`${card} flex items-center justify-between gap-2 text-left hover:border-afro-teal`}>
              <span className="min-w-0">
                <strong className="block truncate text-[13px] text-afro-ink">{ib.protocol.toUpperCase()} · :{ib.port}</strong>
                <span className="block truncate text-[11px] text-afro-muted" dir="ltr">{ib.network}{ib.path ? ` ${ib.path}` : ''}</span>
              </span>
              <span className={dot(true)} />
            </button>
          ))}
        </div>
        {/* Afrows */}
        <div className="grid gap-2">
          <div className="text-[11px] font-bold uppercase tracking-wide text-afro-muted">&nbsp;</div>
          <div className={`${card} text-center`}>
            <strong className="block text-[13px] text-afro-ink">{m.server}</strong>
            <span className="block text-[11px] text-afro-muted" dir="ltr">94.74.145.199</span>
            <span className="mt-1 inline-block text-[11px] text-afro-muted">xray · wg0 → {applied ?? '—'}</span>
          </div>
        </div>
        {/* Outgoing */}
        <div className="grid gap-2">
          <div className="text-[11px] font-bold uppercase tracking-wide text-afro-muted">{m.outgoing}</div>
          {EGRESS.map((e) => {
            const isActive = applied === e.tag;
            return (
              <button key={e.tag} type="button" onClick={onOpenExits} className={`${card} flex items-center justify-between gap-2 text-left hover:border-afro-teal ${isActive ? 'border-afro-teal ring-1 ring-afro-teal/40' : ''}`}>
                <span className="min-w-0">
                  <strong className="block truncate text-[13px] text-afro-ink">{m[e.key]}</strong>
                  <span className="block text-[11px] text-afro-muted">{isActive ? m.active : m.standby}</span>
                </span>
                <span className={dot(isActive)} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: typecheck** → CLEAN.

- [ ] **Step 3: Commit**
```bash
git add apps/dashboard/src/components/network-map.tsx
git commit -m "feat(dashboard): NetworkMap (incoming -> afrows -> outgoing, live applied egress)"
```

---

### Task 5: NetworkPage tabbed shell

**Files:** create `apps/dashboard/src/pages/NetworkPage.tsx`

- [ ] **Step 1: Create** — tabs Map/Inbounds/Connections (reuse existing pages):
```tsx
import { useState } from 'react';
import { DashboardTabs } from '../components/primitives';
import type { DashboardTabItem, NetworkTab } from '../dashboard-types';
import type { DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { NetworkMap } from '../components/network-map';
import { InboundsPage } from './InboundsPage';
import { ConnectionsPage } from './ConnectionsPage';

export function NetworkPage({ format, sessionToken, onOpenExits, t }: {
  format: DashboardFormatters;
  sessionToken: string;
  onOpenExits: () => void;
  t: DashboardStrings;
}) {
  const [tab, setTab] = useState<NetworkTab>('map');
  const tabs: Array<DashboardTabItem<NetworkTab>> = [
    { id: 'map', label: t.tabs.networkMap },
    { id: 'inbounds', label: t.tabs.networkInbounds },
    { id: 'connections', label: t.tabs.networkConnections },
  ];
  return (
    <div className="flex flex-col gap-4">
      <DashboardTabs activeTab={tab} ariaLabel={t.tabs.networkSections} onChange={setTab} tabs={tabs} />
      {tab === 'map' ? <NetworkMap sessionToken={sessionToken} t={t} onOpenExits={onOpenExits} onOpenInbounds={() => setTab('inbounds')} /> : null}
      {tab === 'inbounds' ? <InboundsPage format={format} sessionToken={sessionToken} t={t} /> : null}
      {tab === 'connections' ? <ConnectionsPage format={format} sessionToken={sessionToken} t={t} /> : null}
    </div>
  );
}
```

- [ ] **Step 2: typecheck** → CLEAN.

- [ ] **Step 3: Commit**
```bash
git add apps/dashboard/src/pages/NetworkPage.tsx
git commit -m "feat(dashboard): NetworkPage shell (Map/Inbounds/Connections tabs)"
```

---

### Task 6: Wire DashboardApp

**Files:** `apps/dashboard/src/DashboardApp.tsx` (import; `ROUTE_VIEWS`; render switch `:1314-1317`).

- [ ] **Step 1: Import** `import { NetworkPage } from './pages/NetworkPage';`

- [ ] **Step 2: `ROUTE_VIEWS`** — append `'network'` (keep `inbounds`/`connections` for deep links).

- [ ] **Step 3: Render case** — add before `case 'inbounds':`:
```tsx
    case 'network':
      return <NetworkPage format={format} sessionToken={sessionToken} onOpenExits={() => setActiveView('exits')} t={t} />;
```
Leave `case 'inbounds'` and `case 'connections'` as-is (deep-link support).

- [ ] **Step 4: Gates**
```
npm --workspace @afrows/dashboard run typecheck   # clean
node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON apps/dashboard/src/nav-views.test.ts   # pass 5
npm --workspace @afrows/dashboard run build        # clean
```

- [ ] **Step 5: Commit**
```bash
git add apps/dashboard/src/DashboardApp.tsx
git commit -m "feat(dashboard): render Network view + route key"
```

---

### Task 7: Deploy + manual verification

- [ ] **Step 1:** Merge to `main`, push, `sync.ps1`. Confirm backend health + `GET /admin/network-overview` responds (returns `appliedCatchAll`, e.g. `via-germany`).
- [ ] **Step 2:** Sidebar Advanced shows **Network · Servers · Audit logs · Backups · Reports** (Inbounds/Connections gone).
- [ ] **Step 3:** Network → **Map**: incoming nodes (VLESS-WS/TCP, WireGuard), Afrows node showing the catch-all, 4 egress nodes with the **applied** one highlighted ("active"); "live · updated" stamp refreshes (~20s). Clicking an egress node → Exits; clicking incoming → Inbounds tab.
- [ ] **Step 4:** Network → Inbounds + Connections tabs render the existing pages. Deep links `/inbounds` + `/connections` still load.
- [ ] **Step 5:** FA renders.

---

## Self-Review

**1. Spec coverage:** Network view + Map/Inbounds/Connections tabs (T5,T6); read-only 3-column map w/ applied egress highlighted (T3 endpoint + T4); Inbounds/Connections out of sidebar but deep-linkable (T1 + T6); icon + i18n (T2). ✓
**2. Placeholders:** New files written in full; the one NOTE (copy the sibling admin controller's guards) is a concrete verification. ✓
**3. Type consistency:** `NetworkTab` (T1) used T5; `AdminNetworkOverviewResponse` (T3) used in service/controller/wrapper/map; `fetchAdminNetworkOverview` (T3) used T4; `network` ActiveView (T1) used in nav/ROUTE_VIEWS/case (T6); `t.networkMapView`/`t.tabs.network*` (T2) used T4/T5. ✓
