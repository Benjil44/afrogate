# Customers reorg — D1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Customers the single place to manage a customer: fold gateway-MikroTik management into the customer's edit view, remove the standalone MikroTiks nav item, and add a per-config Exit selector (Auto / fixed) that saves the existing `route_preference` (not yet enforced).

**Architecture:** Reuse `MicrotiksPage` by adding a `customerAccountId` filter (composes with the C1 `roleFilter`) and embedding it in the Customers edit view. Add two thin dashboard API wrappers for the existing admin route-preference endpoints; list a customer's client-configs (with IDs) via the existing `exportAdminCustomerClientConfigs`. Drop `microtiks` from the sidebar but keep it routable.

**Tech Stack:** React 19 + Vite + TS, `node --test` (nav-views), `tsc --noEmit` + `vite build` gates. No backend change.

**Spec:** `docs/superpowers/specs/2026-06-25-customers-reorg-d1-design.md`

---

## File structure

| File | Responsibility | New/Modify |
|------|----------------|------------|
| `apps/dashboard/src/pages/MicrotiksPage.tsx` | add `customerAccountId?` filter (composes with `roleFilter`) | Modify |
| `apps/dashboard/src/nav-views.ts` | drop `microtiks` from `MAIN_VIEWS` | Modify |
| `apps/dashboard/src/nav-views.test.ts` | assert microtiks not in sidebar | Modify |
| `apps/dashboard/src/api/admin.ts` | `fetchAdminClientRoutePreference` + `updateAdminClientRoutePreference` wrappers | Modify |
| `apps/dashboard/src/i18n.en.ts` / `i18n.fa.ts` | strings for gateway section + Exit selector | Modify |
| `apps/dashboard/src/pages/CustomersPage.tsx` | edit-view gateway section + Exit selector | Modify |

---

### Task 1: `MicrotiksPage` gains a `customerAccountId` filter

**Files:** Modify `apps/dashboard/src/pages/MicrotiksPage.tsx:113` (signature) and `:116` (visibleRows).

- [ ] **Step 1: Extend the signature**

Change line 113:
```ts
export function MicrotiksPage({ customerAccountId, roleFilter, sessionToken, t }: { customerAccountId?: string; roleFilter?: MikroTikRouterRole; sessionToken: string; t: DashboardStrings }) {
```

- [ ] **Step 2: Compose the filter**

Replace the `visibleRows` line (`:116`):
```ts
  const visibleRows = rows.filter((router) =>
    (roleFilter ? router.role === roleFilter : true) &&
    (customerAccountId ? router.customerAccountId === customerAccountId : true),
  );
```

- [ ] **Step 3: Type-check**

Run: `npm --workspace @afrows/dashboard run typecheck`
Expected: CLEAN (the standalone `case 'microtiks'` call in DashboardApp passes no `customerAccountId` — fine, it's optional).

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/pages/MicrotiksPage.tsx
git commit -m "feat(dashboard): MicrotiksPage customerAccountId filter (composes with roleFilter)"
```

---

### Task 2: Drop `microtiks` from the sidebar (TDD)

**Files:** Modify `apps/dashboard/src/nav-views.ts:7-9` and `apps/dashboard/src/nav-views.test.ts`.

Current `MAIN_VIEWS` (after C1): `dashboard, customers, billing, exits, microtiks, alerts, users, settings`.

- [ ] **Step 1: Update the test first**

In `apps/dashboard/src/nav-views.test.ts`, replace the `SIDEBAR_VIEWS` constant and the first two `test(...)` blocks with:
```ts
// Views shown in the sidebar after D1 (microtiks dropped; still routable via ROUTE_VIEWS).
const SIDEBAR_VIEWS = [
  'dashboard', 'customers', 'billing', 'exits', 'alerts', 'users', 'settings',
  'servers', 'inbounds', 'connections', 'audit', 'backups', 'reports',
];

test('Main has the 7 everyday views in order', () => {
  assert.deepEqual(MAIN_VIEWS, [
    'dashboard', 'customers', 'billing', 'exits', 'alerts', 'users', 'settings',
  ]);
});

test('Advanced has the 6 infrastructure views in order', () => {
  assert.deepEqual(ADVANCED_VIEWS, [
    'servers', 'inbounds', 'connections', 'audit', 'backups', 'reports',
  ]);
});
```
Then update the third test's hidden-assertions block to also assert microtiks is hidden — replace its body with:
```ts
test('sidebar groups: no duplicates, and outbounds/routes/microtiks are hidden', () => {
  const union = [...MAIN_VIEWS, ...ADVANCED_VIEWS];
  assert.equal(new Set(union).size, union.length, 'duplicate view across groups');
  assert.deepEqual([...union].sort(), [...SIDEBAR_VIEWS].sort(), 'union != expected sidebar set');
  assert.ok(!union.includes('outbounds'), 'outbounds must not be a sidebar item');
  assert.ok(!union.includes('routes'), 'routes must not be a sidebar item');
  assert.ok(!union.includes('microtiks'), 'microtiks must not be a sidebar item');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON apps/dashboard/src/nav-views.test.ts`
Expected: FAIL — `MAIN_VIEWS` still contains `microtiks`.

- [ ] **Step 3: Update `MAIN_VIEWS`**

In `apps/dashboard/src/nav-views.ts`, change the Main array to drop `microtiks`:
```ts
export const MAIN_VIEWS: ActiveView[] = [
  'dashboard', 'customers', 'billing', 'exits', 'alerts', 'users', 'settings',
];
```
(Leave `ADVANCED_VIEWS` unchanged.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON apps/dashboard/src/nav-views.test.ts`
Expected: PASS — `# pass 5`.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/nav-views.ts apps/dashboard/src/nav-views.test.ts
git commit -m "feat(dashboard): drop MikroTiks from sidebar (gateway management moves to Customers)"
```

---

### Task 3: i18n strings

**Files:** Modify `apps/dashboard/src/i18n.en.ts` and `apps/dashboard/src/i18n.fa.ts` (the `customersPage` object — en anchor near `:123 fldProtocols`).

- [ ] **Step 1: Add English strings**

In `apps/dashboard/src/i18n.en.ts`, inside the `customersPage:` object (e.g. right after the `fldProtocols:` line), add:
```ts
      gatewaySection: 'Internet gateway',
      gatewayAssign: 'Assign gateway router',
      gatewayUnassign: 'Unassign',
      gatewayNone: 'No gateway assigned to this customer.',
      exitSection: 'Exit per config',
      exitAuto: 'Auto (best ping / jitter / speed)',
      exitFixed: 'Fixed exit',
      exitChooseOutbound: 'Choose exit',
      exitSavedNote: 'Saved. Takes effect when per-customer routing ships.',
      exitSaved: 'Exit preference saved',
      exitSaveFailed: 'Could not save exit preference',
```

- [ ] **Step 2: Add arabic strings**

In `apps/dashboard/src/i18n.fa.ts`, inside the `customersPage:` object at the matching spot, add:
```ts
      gatewaySection: 'گیت‌وی اینترنت',
      gatewayAssign: 'تخصیص روتر گیت‌وی',
      gatewayUnassign: 'لغو تخصیص',
      gatewayNone: 'گیت‌ویی به این مشتری تخصیص نیافته است.',
      exitSection: 'خروج برای هر کانفیگ',
      exitAuto: 'خودکار (بهترین پینگ / جیتر / سرعت)',
      exitFixed: 'خروج ثابت',
      exitChooseOutbound: 'انتخاب خروج',
      exitSavedNote: 'ذخیره شد. با راه‌اندازی مسیریابی هر مشتری اعمال می‌شود.',
      exitSaved: 'ترجیح خروج ذخیره شد',
      exitSaveFailed: 'ذخیره ترجیح خروج ناموفق بود',
```

- [ ] **Step 3: Type-check (parity gate)**

Run: `npm --workspace @afrows/dashboard run typecheck`
Expected: CLEAN (en/fa key parity enforced by `DashboardStrings = typeof en`).

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/i18n.en.ts apps/dashboard/src/i18n.fa.ts
git commit -m "feat(dashboard): i18n for Customers gateway section + Exit selector"
```

---

### Task 4: Route-preference API wrappers

**Files:** Modify `apps/dashboard/src/api/admin.ts` (near the other client-config wrappers ~`:705`) and its shared-type imports (~`:7`).

Backend endpoints (already exist): `GET /admin/client-configs/:id/route-preference?routeGroup=main` and `PATCH /admin/client-configs/:id/route-preference`. Response type: `AdminClientRoutePreferenceResponse` (shared). Request body fields: `routeGroup`, `mode` (`'auto'|'country'|'outbound'`), `preferredOutboundId`, `preferredExitCountryCode`, `scoreProfile`, `autoDetectCountry`, `allowClientOverride`, `routeLocked` (all optional).

- [ ] **Step 1: Import the response type**

In `apps/dashboard/src/api/admin.ts`, add `AdminClientRoutePreferenceResponse` to the existing `@afrows/shared` type import block (alongside `AdminClientConfigSummary` etc.).

- [ ] **Step 2: Add the two wrappers**

Add after `createAdminClientConfig` (~`:720`):
```ts
export async function fetchAdminClientRoutePreference(
  sessionToken: string,
  configId: string,
  routeGroup = 'main',
  signal?: AbortSignal,
): Promise<AdminClientRoutePreferenceResponse> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/client-configs/${encodeURIComponent(configId)}/route-preference?routeGroup=${encodeURIComponent(routeGroup)}`,
    { headers: createSessionHeaders(sessionToken), signal },
  );
  return response.json() as Promise<AdminClientRoutePreferenceResponse>;
}

export async function updateAdminClientRoutePreference(
  sessionToken: string,
  configId: string,
  payload: { routeGroup?: string; mode?: 'auto' | 'country' | 'outbound'; preferredOutboundId?: string | null },
): Promise<AdminClientRoutePreferenceResponse> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/client-configs/${encodeURIComponent(configId)}/route-preference`,
    {
      method: 'PATCH',
      headers: createSessionHeaders(sessionToken),
      body: JSON.stringify(payload),
    },
  );
  return response.json() as Promise<AdminClientRoutePreferenceResponse>;
}
```

> NOTE: confirm `requestAdminAuth`/`createSessionHeaders`/`getApiBaseUrl` are the helpers used by neighboring functions (they are — see `createAdminClientConfig`). Confirm `AdminClientRoutePreferenceResponse` exposes `mode` and `preferredOutboundId` (it does — shared `:373-377`); if the property names differ, align the Exit selector in Task 6 to the real names.

- [ ] **Step 3: Type-check**

Run: `npm --workspace @afrows/dashboard run typecheck`
Expected: CLEAN.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/api/admin.ts
git commit -m "feat(dashboard): admin client route-preference API wrappers"
```

---

### Task 5: Gateway management inside the Customers edit view

**Files:** Modify `apps/dashboard/src/pages/CustomersPage.tsx` (imports; the edit-view body near `:806`; assign/unassign handlers near the other handlers ~`:195`).

- [ ] **Step 1: Import MicrotiksPage**

In `CustomersPage.tsx`, add:
```ts
import { MicrotiksPage } from './MicrotiksPage';
```

- [ ] **Step 2: Add assign/unassign handlers**

Near `onAddProtocol` (~`:195`), add:
```ts
  const assignGatewayInEdit = async (routerId: string) => {
    if (!editId || !routerId) return;
    setError(null);
    try {
      await updateRouter(sessionToken, routerId, { role: 'gateway', customerAccountId: editId });
      await fetchRouters(sessionToken).then((r) => setRouters(r.routers)).catch(() => undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const unassignGateway = async (routerId: string) => {
    setError(null);
    try {
      await updateRouter(sessionToken, routerId, { customerAccountId: null });
      await fetchRouters(sessionToken).then((r) => setRouters(r.routers)).catch(() => undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
```
(`updateRouter` + `fetchRouters` are already imported.)

- [ ] **Step 3: Render the gateway section in edit mode**

In the edit-view JSX, after the protocol list block (the `editId ? (…protocol chips…)` block ends ~`:805`), add a gateway section gated on `editId`:
```tsx
            {editId ? (
              <div className="grid gap-2 md:col-span-2">
                <span className="text-[13px] font-bold text-afro-muted">{s.gatewaySection}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className={inputClass}
                    value=""
                    onChange={(e) => { void assignGatewayInEdit(e.target.value); }}
                  >
                    <option value="">{s.gatewayAssign}</option>
                    {routers
                      .filter((r) => r.kind !== 'village' && !r.customerAccountId)
                      .map((r) => (
                        <option key={r.id} value={r.id}>{r.label}{r.online ? ' · online' : ' · offline'}</option>
                      ))}
                  </select>
                  {routers.filter((r) => r.customerAccountId === editId).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => void unassignGateway(r.id)}
                      className="inline-flex min-h-8 items-center gap-1 rounded-md border border-afro-line px-2.5 text-[12px] font-bold text-afro-ink hover:border-red-400 hover:text-red-500"
                    >
                      {r.label} · {s.gatewayUnassign}
                    </button>
                  ))}
                </div>
                {routers.some((r) => r.customerAccountId === editId) ? (
                  <MicrotiksPage roleFilter="gateway" customerAccountId={editId} sessionToken={sessionToken} t={t} />
                ) : (
                  <span className="text-[12px] text-afro-muted">{s.gatewayNone}</span>
                )}
              </div>
            ) : null}
```

- [ ] **Step 4: Type-check + build**

Run: `npm --workspace @afrows/dashboard run typecheck` → CLEAN.
Run: `npm --workspace @afrows/dashboard run build` → clean.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/pages/CustomersPage.tsx
git commit -m "feat(dashboard): manage a customer's gateway MikroTik inside the Customers edit view"
```

---

### Task 6: Per-config Exit selector

**Files:** Modify `apps/dashboard/src/pages/CustomersPage.tsx` (imports; state near `:92`; `openEdit` ~`:170`; edit-view JSX after the gateway section).

Plan: on `openEdit`, fetch the customer's configs (with IDs) via `exportAdminCustomerClientConfigs` and the outbounds list via `fetchAdminOutbounds`; load each config's current route-preference; render an Exit control per config; PATCH on change.

- [ ] **Step 1: Imports**

In `CustomersPage.tsx`, ensure these are imported from `../api/admin`: `exportAdminCustomerClientConfigs`, `fetchAdminOutbounds`, `fetchAdminClientRoutePreference`, `updateAdminClientRoutePreference`. And the types `AdminClientConfigSummary`, `AdminOutboundSummary` from `@afrows/shared`.

- [ ] **Step 2: State**

Near `:92`, add:
```ts
  const [editConfigs, setEditConfigs] = useState<AdminClientConfigSummary[]>([]);
  const [exitOutbounds, setExitOutbounds] = useState<AdminOutboundSummary[]>([]);
  // configId -> { mode, preferredOutboundId }
  const [exitPrefs, setExitPrefs] = useState<Record<string, { mode: string; preferredOutboundId: string | null }>>({});
  const [exitMsg, setExitMsg] = useState<string | null>(null);
```

- [ ] **Step 3: Load configs + prefs + outbounds in `openEdit`**

In `openEdit` (~`:170`), after `setEditId(a.id);`, add a fire-and-forget loader:
```ts
    setEditConfigs([]);
    setExitPrefs({});
    setExitMsg(null);
    void (async () => {
      try {
        const [cfgRes, obRes] = await Promise.all([
          exportAdminCustomerClientConfigs(sessionToken, a.id),
          fetchAdminOutbounds(sessionToken).catch(() => ({ outbounds: [] as AdminOutboundSummary[] })),
        ]);
        setEditConfigs(cfgRes.configs);
        setExitOutbounds(obRes.outbounds);
        const prefs: Record<string, { mode: string; preferredOutboundId: string | null }> = {};
        await Promise.all(cfgRes.configs.map(async (cfg) => {
          try {
            const { routePreference } = await fetchAdminClientRoutePreference(sessionToken, cfg.id, 'main');
            prefs[cfg.id] = { mode: routePreference?.mode ?? 'auto', preferredOutboundId: routePreference?.preferredOutboundId ?? null };
          } catch {
            prefs[cfg.id] = { mode: 'auto', preferredOutboundId: null };
          }
        }));
        setExitPrefs(prefs);
      } catch {
        /* best-effort; selector simply won't populate */
      }
    })();
```

- [ ] **Step 4: Save handler**

Near the other handlers, add:
```ts
  const saveExitPref = async (configId: string, mode: 'auto' | 'outbound', preferredOutboundId: string | null) => {
    setExitMsg(null);
    setExitPrefs((cur) => ({ ...cur, [configId]: { mode, preferredOutboundId } }));
    try {
      await updateAdminClientRoutePreference(sessionToken, configId, { routeGroup: 'main', mode, preferredOutboundId: mode === 'outbound' ? preferredOutboundId : null });
      setExitMsg(s.exitSaved);
    } catch (e) {
      setExitMsg(s.exitSaveFailed);
    }
  };
```

- [ ] **Step 5: Render the Exit section (edit mode)**

After the gateway section block, add:
```tsx
            {editId && editConfigs.length > 0 ? (
              <div className="grid gap-2 md:col-span-2">
                <span className="text-[13px] font-bold text-afro-muted">{s.exitSection}</span>
                {editConfigs.map((cfg) => {
                  const pref = exitPrefs[cfg.id] ?? { mode: 'auto', preferredOutboundId: null };
                  const isFixed = pref.mode === 'outbound';
                  return (
                    <div key={cfg.id} className="flex flex-wrap items-center gap-2 rounded-md border border-afro-line px-2.5 py-2">
                      <span className="text-[12px] font-bold uppercase tracking-wide text-afro-ink">{cfg.protocol}</span>
                      <select
                        className={inputClass}
                        value={isFixed ? 'outbound' : 'auto'}
                        onChange={(e) => {
                          const mode = e.target.value === 'outbound' ? 'outbound' : 'auto';
                          const ob = mode === 'outbound' ? (pref.preferredOutboundId || exitOutbounds[0]?.id || null) : null;
                          void saveExitPref(cfg.id, mode, ob);
                        }}
                      >
                        <option value="auto">{s.exitAuto}</option>
                        <option value="outbound">{s.exitFixed}</option>
                      </select>
                      {isFixed ? (
                        <select
                          className={inputClass}
                          value={pref.preferredOutboundId ?? ''}
                          onChange={(e) => void saveExitPref(cfg.id, 'outbound', e.target.value || null)}
                        >
                          <option value="">{s.exitChooseOutbound}</option>
                          {exitOutbounds.map((ob) => (
                            <option key={ob.id} value={ob.id}>{ob.name}</option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                  );
                })}
                <span className="text-[11px] text-afro-muted">{s.exitSavedNote}</span>
                {exitMsg ? <span className="text-[12px] font-bold text-afro-teal">{exitMsg}</span> : null}
              </div>
            ) : null}
```

> NOTE: confirm `AdminOutboundSummary` has `id` + `name` (it does — used by OutboundsPage) and `AdminClientRoutePreferenceResponse` wraps the preference under `routePreference` with `.mode`/`.preferredOutboundId` (matches the controller's `{ routePreference: … }` response). If the response is flat (no `routePreference` wrapper), drop the destructure and read fields directly.

- [ ] **Step 6: Type-check + unit test + build**

Run: `npm --workspace @afrows/dashboard run typecheck` → CLEAN.
Run: `node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON apps/dashboard/src/nav-views.test.ts` → PASS.
Run: `npm --workspace @afrows/dashboard run build` → clean.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/pages/CustomersPage.tsx
git commit -m "feat(dashboard): per-config Exit selector (Auto/fixed) on Customers edit view"
```

---

### Task 7: Manual verification (no code)

`npm --workspace @afrows/dashboard run dev`, full-admin login.

- [ ] **Step 1:** Sidebar no longer shows **MikroTiks** (Main = Dashboard, Customers, Billing, Exits, Alerts, Admins, Settings). Advanced unchanged.
- [ ] **Step 2:** Deep link `?view=microtiks` still loads the gateway list (routable).
- [ ] **Step 3:** Open a customer that owns a gateway → the **Internet gateway** section shows that router with working management (egress toggle, reboot/reconnect, rate, credential, usage charts).
- [ ] **Step 4:** Assign an unassigned gateway to the customer (dropdown) → it appears; **Unassign** removes it.
- [ ] **Step 5:** **Exit per config**: each protocol shows Auto by default; switching to **Fixed exit** + choosing an outbound saves ("Exit preference saved"); reopening the customer reflects the saved choice; the "takes effect when per-customer routing ships" note is visible.
- [ ] **Step 6:** FA renders all new strings.

---

## Self-Review

**1. Spec coverage:**
- Gateway → Customers: `customerAccountId` filter (T1) + embed + assign/unassign (T5). ✓
- Per-config Exit selector saving route_preference (Auto/fixed), honest non-enforcement note: T3 (strings) + T4 (wrappers) + T6. ✓
- Remove microtiks from sidebar, keep routable: T2 (+ ROUTE_VIEWS untouched in DashboardApp → still routable; verified T7 Step 2). ✓
- No new backend endpoint: T4 wraps existing routes; configs via existing `exportAdminCustomerClientConfigs`. ✓
- Protocol-on-create unchanged. ✓

**2. Placeholder scan:** All steps show full code. The two NOTE blocks are concrete verification actions (confirm helper/field names against existing neighbors), not deferred decisions. ✓

**3. Type consistency:** `customerAccountId?: string` defined T1, supplied T5. `fetchAdminClientRoutePreference`/`updateAdminClientRoutePreference` defined T4, used T6. `editConfigs: AdminClientConfigSummary[]`/`exitOutbounds: AdminOutboundSummary[]`/`exitPrefs` defined T6 Step 2, used T6 Step 5. Mode literals `'auto'|'outbound'` consistent across wrapper (T4), handler, and selector (T6). i18n keys (T3) match `s.*` usages (T5/T6). ✓
