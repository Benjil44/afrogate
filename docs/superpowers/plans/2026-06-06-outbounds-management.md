# Outbounds Management Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dashboard **Outbounds** page to add/manage egress connections (VLESS/WireGuard/L2TP) in a table showing Status/Ping/Jitter/Download/Upload, with per-row Test, Sync-now, and a 10-minute Auto toggle.

**Architecture:** Reuse the existing outbound CRUD API and the agent's existing per-outbound latency/jitter probes. Extend the outbound list response with latest latency/jitter/throughput; add an on-demand test endpoint; add a download/upload speed-test probe to the agent; build a new dashboard page.

**Tech Stack:** NestJS + Postgres (backend), Python agent (`apps/agent`), React 19 + Tailwind v4 (dashboard), `node:test` (backend tests).

Spec: `docs/superpowers/specs/2026-06-06-outbounds-management-design.md`

---

## File structure

```
packages/shared/src/index.ts          # extend AdminOutboundSummary + add test response types
apps/backend/src/operations/
  operations.controller.ts             # + POST /outbounds/:id/test, POST /outbounds/test-all, autoTest setting
  operations.service.ts                # enrich listOutbounds w/ latency/jitter/throughput; requestOutboundTest; autoTest get/set
  outbound-vless-parser.ts  (NEW)      # parse vless:// -> config; pure + unit-tested
  outbound-vless-parser.test.ts (NEW)
infra/postgres/migrations/
  0029_outbound_throughput.sql (NEW)   # throughput columns + autoTest setting + speed-test request flag
apps/agent/afrows_agent/collect.py     # + _run_speed_test_probe(outbound) producing down/up Mbps
apps/dashboard/src/
  pages/OutboundsPage.tsx (NEW)        # table + add panel + test/sync/auto
  components/Sidebar.tsx               # add 'outbounds' nav item
  DashboardApp.tsx                     # route 'outbounds' -> OutboundsPage
  api/*                                # add listOutbounds/createOutbound/testOutbound/setAutoTest calls (mirror existing)
  i18n.en.ts / i18n.fa.ts              # outbounds strings
```

Existing references to MIRROR (read before writing):
- Outbound CRUD: `operations.controller.ts:383-403,658-700`; `createOutbound` `operations.service.ts:1317`.
- Summary type: `packages/shared/src/index.ts:1793-1818` (`AdminOutboundSummary`).
- Agent route probes (latency/jitter, `outboundId` metadata): `apps/agent/afrows_agent/collect.py:660-721,724+`.
- A simple dashboard page for wiring (api client + i18n + sidebar + routing): `apps/dashboard/src/pages/AlertsPage.tsx` and `components/Sidebar.tsx` items array.

---

## Task 1: Extend the outbound summary with live metrics (shared types)

**Files:** Modify `packages/shared/src/index.ts:1815` (inside `AdminOutboundSummary`, after `lastHealthyAt`).

- [ ] **Step 1: Add metric fields**

```ts
  // live metrics (latest measured; null until first probe/test)
  latestLatencyMs?: number | null;
  latestJitterMs?: number | null;
  latestDownMbps?: number | null;
  latestUpMbps?: number | null;
  lastSpeedTestAt?: string | null;
```

- [ ] **Step 2: Add test + auto-test response types** (end of the outbounds types block, after `AdminOutboundSummary`)

```ts
export interface AdminOutboundTestResult {
  outboundId: string;
  status: 'ok' | 'failed' | 'queued';
  latencyMs?: number | null;
  jitterMs?: number | null;
  downMbps?: number | null;
  upMbps?: number | null;
  measuredAt?: string | null;
  message?: string | null;
}
export interface AdminOutboundsAutoTestState { enabled: boolean; intervalSeconds: number; }
```

- [ ] **Step 3: Build shared** `npm --workspace @afrows/shared run build` → PASS.
- [ ] **Step 4: Commit** `git add packages/shared/src/index.ts && git commit -m "feat(shared): outbound live metrics + test result types"`

---

## Task 2: Migration — throughput columns, speed-test request flag, autoTest setting

**Files:** Create `infra/postgres/migrations/0029_outbound_throughput.sql`.

- [ ] **Step 1: Write migration**

```sql
ALTER TABLE outbounds
  ADD COLUMN IF NOT EXISTS latest_down_mbps double precision,
  ADD COLUMN IF NOT EXISTS latest_up_mbps double precision,
  ADD COLUMN IF NOT EXISTS last_speed_test_at timestamptz,
  ADD COLUMN IF NOT EXISTS speed_test_requested_at timestamptz;

-- key/value app settings table already exists for route policy; if a generic
-- settings table is present reuse it. Otherwise this dedicated row holds the toggle.
CREATE TABLE IF NOT EXISTS outbound_test_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  auto_enabled boolean NOT NULL DEFAULT false,
  interval_seconds integer NOT NULL DEFAULT 600,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO outbound_test_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2: Apply locally** (against the dev DB): `npm --workspace @afrows/backend run db:migrate` → "Applying 0029_outbound_throughput.sql" + "completed". (On the box it runs during deploy.)
- [ ] **Step 3: Commit** `git add infra/postgres/migrations/0029_outbound_throughput.sql && git commit -m "feat(db): outbound throughput columns + auto-test setting"`

---

## Task 3: `vless://` parser (pure, unit-tested)

**Files:** Create `apps/backend/src/operations/outbound-vless-parser.ts` + `.test.ts`.

> Note: parser lives in backend so it can be unit-tested with `node:test`; the dashboard add-form calls `POST /outbounds` with the parsed config. (Frontend may import the same logic later; for v1 the form posts the raw link to a parse step OR parses client-side by porting this — keep ONE source: backend parses on create when `config.importUrl` is present. See Task 5.)

- [ ] **Step 1: Write the failing test** `outbound-vless-parser.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVlessUrl } from './outbound-vless-parser.ts';

test('parses a vless:// link into name + config', () => {
  const url = 'vless://11111111-1111-1111-1111-111111111111@example.com:443?encryption=none&security=tls&sni=example.com&type=ws&host=example.com&path=%2Fws&flow=#My%20VLESS';
  const r = parseVlessUrl(url);
  assert.equal(r.name, 'My VLESS');
  assert.equal(r.config.address, 'example.com');
  assert.equal(r.config.port, 443);
  assert.equal(r.config.uuid, '11111111-1111-1111-1111-111111111111');
  assert.equal(r.config.security, 'tls');
  assert.equal(r.config.sni, 'example.com');
  assert.equal(r.config.network, 'ws');
  assert.equal(r.config.path, '/ws');
});

test('rejects non-vless input', () => {
  assert.throws(() => parseVlessUrl('https://x'), /vless/i);
});
```

- [ ] **Step 2: Run → FAIL** `node --test apps/backend/src/operations/outbound-vless-parser.test.ts` (if the repo runs TS tests via a loader, use the same invocation as existing backend tests — see `apps/backend` test script). Expected: cannot find module / assertion fail.

- [ ] **Step 3: Implement** `outbound-vless-parser.ts`

```ts
export interface ParsedVless { name: string; type: 'vless'; config: Record<string, unknown>; }

export function parseVlessUrl(input: string): ParsedVless {
  const raw = input.trim();
  if (!raw.toLowerCase().startsWith('vless://')) {
    throw new Error('Not a vless:// link');
  }
  const url = new URL(raw);
  const uuid = decodeURIComponent(url.username);
  const address = url.hostname;
  const port = Number(url.port || '443');
  if (!uuid || !address || !Number.isInteger(port)) throw new Error('Malformed vless:// link');
  const q = url.searchParams;
  const name = url.hash ? decodeURIComponent(url.hash.slice(1)) : `${address}:${port}`;
  const config: Record<string, unknown> = {
    address,
    port,
    uuid,
    encryption: q.get('encryption') ?? 'none',
    security: q.get('security') ?? 'none',
    sni: q.get('sni') ?? q.get('peer') ?? undefined,
    flow: q.get('flow') || undefined,
    network: q.get('type') ?? 'tcp',
    host: q.get('host') || undefined,
    path: q.get('path') ? decodeURIComponent(q.get('path') as string) : undefined,
    fingerprint: q.get('fp') || undefined,
    publicKey: q.get('pbk') || undefined,
    shortId: q.get('sid') || undefined,
  };
  for (const k of Object.keys(config)) if (config[k] === undefined) delete config[k];
  return { name, type: 'vless', config };
}
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Reconcile config shape** — read how existing code consumes a `type='vless'` outbound `config` (grep `'vless'` in `operations.service.ts` and `apps/agent`); if key names differ (e.g. `serverName` vs `sni`), adjust the mapping above so the parsed config matches what the route/agent layer expects. Re-run test.
- [ ] **Step 6: Commit** `git commit -am "feat(backend): vless:// parser"`

---

## Task 4: Enrich `listOutbounds` with latest latency/jitter/throughput

**Files:** Modify `operations.service.ts` (`listOutbounds` query/mapping) + `getOutbound`.

- [ ] **Step 1:** Read the current `listOutbounds` implementation (grep `listOutbounds(` in `operations.service.ts`). It already returns `AdminOutboundSummary[]` and joins server fields.
- [ ] **Step 2:** Add latest latency/jitter from the existing outbound-health/route-quality source. Find where `outboundHealth` / route-quality latency+jitter per outbound is stored (`operations.service.ts:7670,8667`, `schema.ts:1155`). Join the most-recent measurement per `outbound_id` (a `LATERAL` subquery selecting newest `latency_ms`, `jitter_ms`). Map into `latestLatencyMs`, `latestJitterMs`.
- [ ] **Step 3:** Map the new outbound columns `latest_down_mbps`, `latest_up_mbps`, `last_speed_test_at` → `latestDownMbps`, `latestUpMbps`, `lastSpeedTestAt`.
- [ ] **Step 4: Verify** `npm --workspace @afrows/backend run build` PASS; manually `GET /api/outbounds` locally returns the new fields (null when unmeasured).
- [ ] **Step 5: Commit** `git commit -am "feat(backend): surface latency/jitter/throughput in outbound list"`

---

## Task 5: Outbound create accepts a `vless://` import + test endpoints + autoTest setting

**Files:** Modify `operations.controller.ts` (new routes) + `operations.service.ts` (methods).

- [ ] **Step 1: Create import** — in `createOutbound` (service `:1317`), if `dto.config?.importUrl` is a string and `dto.type === 'vless'`, replace config via `parseVlessUrl(dto.config.importUrl).config` and default `dto.name` from the parsed name when blank. Keep `assertSafeConfig`.
- [ ] **Step 2: Test endpoint** — add to controller (mirror the `@Post('outbounds/:id/move')` style at `:677`):

```ts
@Post('outbounds/:id/test')
@Roles('admin', 'supervisor')
@Permissions('routes:write')
testOutbound(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<AdminOutboundTestResult> {
  return this.operationsService.requestOutboundTest(id);
}

@Post('outbounds/test-all')
@Roles('admin', 'supervisor')
@Permissions('routes:write')
testAllOutbounds(): Promise<{ requested: number }> {
  return this.operationsService.requestAllOutboundTests();
}

@Get('outbounds/test-settings')
@Roles('admin', 'supervisor', 'support', 'auditor')
getOutboundTestSettings(): Promise<AdminOutboundsAutoTestState> {
  return this.operationsService.getOutboundTestSettings();
}

@Patch('outbounds/test-settings')
@Roles('admin', 'supervisor')
@Permissions('routes:write')
setOutboundTestSettings(@Body() body: { enabled: boolean }): Promise<AdminOutboundsAutoTestState> {
  return this.operationsService.setOutboundTestSettings(Boolean(body.enabled));
}
```

- [ ] **Step 3: Service methods** in `operations.service.ts`:
  - `requestOutboundTest(id)` — `UPDATE outbounds SET speed_test_requested_at = now() WHERE id=$1`; return `{ outboundId: id, status: 'queued' }`. (The agent picks up the request on its next cycle — see Task 6.)
  - `requestAllOutboundTests()` — same UPDATE across enabled outbounds; return count.
  - `getOutboundTestSettings()` / `setOutboundTestSettings(enabled)` — read/write `outbound_test_settings` row; return `{ enabled, intervalSeconds }`.
- [ ] **Step 4: Build** `npm --workspace @afrows/backend run build` PASS.
- [ ] **Step 5: Commit** `git commit -am "feat(backend): outbound test endpoints + vless import + auto-test setting"`

---

## Task 6: ~~Agent~~ Backend-on-box download/upload speed test — DONE (2026-06-06)

> **Built backend-on-box, NOT in the agent.** The Python agent is static/env-driven with no command channel; backend + Postgres + `xray` share the VPS. Implemented as `outbound-speed-test.service.ts` (+ pure `outbound-xray-config.ts`, unit-tested): picks up `speed_test_requested_at`, measures TCP latency/jitter to `config.address`, and download/upload Mbps via a throwaway xray SOCKS proxy (curl, Cloudflare `__down`/`__up` defaults). Verified live on the box. Original agent-based steps below kept for history.

**Files:** Modify `apps/agent/afrows_agent/collect.py`.

- [ ] **Step 1:** Read how the agent receives per-outbound config/targets and how `outboundId` flows (`collect.py:660-721`) and how the agent fetches work + whether it sees `speed_test_requested_at` (grep the agent + the backend agent endpoint for what config the agent pulls). Confirm the channel that tells the agent "run a speed test for outbound X now" (the `speed_test_requested_at` flag must reach the agent — extend the agent's pull payload in the backend agent controller if needed).
- [ ] **Step 2: Implement** a `_run_speed_test_probe(outbound)` that, for an outbound with a reachable local proxy/interface, downloads a fixed-size payload and uploads one through that outbound, measuring Mbps; return `{ "type": "speed", "outboundId": ..., "downMbps": x, "upMbps": y, "ok": True }`. Use a conservative size (e.g. 10 MB) and timeout; cap concurrency to 1. Mirror the structure/return convention of the existing `_run_tcp_route_probe`.
- [ ] **Step 3:** Emit speed results to the backend via the existing report channel; backend stores them into `outbounds.latest_down_mbps/up_mbps/last_speed_test_at` and clears `speed_test_requested_at`. Add the store path in `operations.service.ts` where agent probe/health reports are ingested (grep where `outboundHealth` is written, `:7670/:8667`).
- [ ] **Step 4: Verify** on the box against the real VLESS: trigger a test → throughput appears.
- [ ] **Step 5: Commit** `git commit -am "feat(agent): outbound download/upload speed test"`

---

## Task 7: Auto-test scheduler (10 min) — DONE (2026-06-06)

> Implemented in the same `outbound-speed-test.service.ts` tick: when `outbound_test_settings.auto_enabled`, flags enabled outbounds whose `interval_seconds` has elapsed by setting `speed_test_requested_at`, reusing the Task 6 pickup path.

**Files:** Modify backend — add a scheduled tick (mirror an existing interval/cron in the backend; grep for `setInterval`/`@Cron`/scheduler in `apps/backend/src`).

- [ ] **Step 1:** On a 60s tick, if `outbound_test_settings.auto_enabled` and `now() - last_speed_test_at >= interval_seconds` (or never tested), set `speed_test_requested_at = now()` for enabled outbounds. (Reuses Task 6's pickup path.)
- [ ] **Step 2: Build** PASS.
- [ ] **Step 3: Commit** `git commit -am "feat(backend): 10-min auto outbound test scheduler"`

---

## Task 8: Dashboard API client methods

**Files:** Modify the dashboard api layer (find it: grep `outbounds` in `apps/dashboard/src/api`); mirror an existing GET/POST helper.

- [ ] **Step 1:** Add `listOutbounds()`, `createOutbound(body)`, `updateOutbound(id, body)`, `deleteOutbound(id)`, `testOutbound(id)`, `testAllOutbounds()`, `getOutboundTestSettings()`, `setOutboundTestSettings(enabled)` — typed with the shared interfaces, hitting `/api/outbounds*`.
- [ ] **Step 2: typecheck** `npm --workspace @afrows/dashboard run typecheck` PASS.
- [ ] **Step 3: Commit** `git commit -am "feat(dashboard): outbounds api client"`

---

## Task 9: i18n strings (FA/EN)

**Files:** Modify `apps/dashboard/src/i18n.en.ts` + `i18n.fa.ts` (mirror an existing page's string block).

- [ ] **Step 1:** Add an `outbounds` block: title, add, addVless, addWireguard, addL2tp, pasteVlessLink, protocol, name, type, status, ping, jitter, download, upload, actions, test, testAll, syncNow, auto, autoOn, autoOff, edit, disable, enable, delete, empty, parseError, up, down, unknown. Provide EN + FA values.
- [ ] **Step 2: typecheck** PASS. **Commit** `git commit -am "feat(dashboard): outbounds i18n"`

---

## Task 10: Outbounds page — table + live metrics

**Files:** Create `apps/dashboard/src/pages/OutboundsPage.tsx`; register in `Sidebar.tsx` (items array) + `DashboardApp.tsx` (route).

- [ ] **Step 1:** Build the page: fetch `listOutbounds()` on mount + **poll every 20s**; render a table (Name, Type badge, Status dot, Ping, Jitter, Download, Upload, Actions). Show `—` for null metrics. Header row: **Auto toggle** (calls get/set test-settings), **Sync now** (calls `testAllOutbounds()`), **+ Add outbound**. Use the dashboard's existing table/card styling (mirror `AlertsPage.tsx`/`ServersPage.tsx`). Bilingual via `t.outbounds`.
- [ ] **Step 2:** Register sidebar item `{ id: 'outbounds', ... }` (icon e.g. lucide `Waypoints`/`Network`) and route it to `<OutboundsPage/>` in `DashboardApp.tsx`.
- [ ] **Step 3: typecheck + build** `npm --workspace @afrows/dashboard run build` PASS.
- [ ] **Step 4: Commit** `git commit -am "feat(dashboard): Outbounds page table + live metrics + auto/sync"`

---

## Task 11: Add/Edit panel + per-row Test

**Files:** Modify `OutboundsPage.tsx` (add the top panel + row actions).

- [ ] **Step 1: Add panel** — "+ Add outbound" reveals a top section: protocol picker (VLESS/WireGuard/L2TP). VLESS: a "Paste vless:// link" textarea → on Save, `createOutbound({ type:'vless', name, config:{ importUrl: link } })` (backend parses, Task 5). WireGuard: a config textarea → `config:{ importConfig: text }` (or fields). L2TP: fields (address, username, secret) → `config:{...}`. Show `parseError` on failure.
- [ ] **Step 2: Row actions** — Test (`testOutbound(id)`, optimistic "testing…"), Edit (PATCH name/enabled/group), ⋯ menu (Enable/Disable via `updateOutbound`, Delete via `deleteOutbound` with confirm).
- [ ] **Step 3: typecheck + build** PASS.
- [ ] **Step 4: Commit** `git commit -am "feat(dashboard): outbound add/edit panel + row test/delete"`

---

## Task 12: Deploy + verify + docs

**Files:** ops (`sync.ps1` — `-WithDeps` not needed unless deps changed), `.codex/checklist.md`, `.codex/progress.md`.

- [ ] **Step 1: Deploy** `./sync.ps1` (runs migrations + builds all workspaces; ship the agent too — confirm the agent is included in the deploy or shipped to the server running the VLESS). 
- [ ] **Step 2: Verify on the box:** Outbounds page lists outbounds; add the real VLESS by pasting its link → row appears; Status/Ping/Jitter populate from the agent; click **Test** → Download/Upload fill; **Sync now** refreshes; **Auto** on → re-tests in ≤10 min; Edit/Disable/Delete work. Backend `GET /api/outbounds` shows metrics.
- [ ] **Step 3:** Tick Phase 9 in `.codex/checklist.md`; add a `progress.md` entry. Commit (secret-scan first).

---

## Self-review notes

- Spec coverage: page+table (T10), add w/ protocol picker + vless paste (T3,T5,T11), columns status/ping/jitter (T1,T4,T10) + down/up (T1,T2,T6), per-row Test + Sync now (T5,T11,T10), Auto 10-min (T2,T5,T7,T10), edit/disable/delete (T11), agent speed test (T6), docs (T12). All spec sections mapped.
- Reuse: outbound CRUD, agent latency/jitter probes, outboundHealth storage, dashboard page patterns — not rebuilt.
- Open integration points the executor MUST resolve by reading existing code (not placeholders — explicit pointers): exact `vless` config keys (T3 S5), the latest-health join source (T4 S2), the agent work-pull/report channel for the speed-test request + results (T6 S1,S3), and the backend scheduler pattern (T7 S1).
- Type consistency: shared `AdminOutboundSummary` (+metrics), `AdminOutboundTestResult`, `AdminOutboundsAutoTestState` used identically across backend + dashboard api + page.
