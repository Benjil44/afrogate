# Outbounds Management Page — Design

Date: 2026-06-06
Status: Approved (design); implementation pending plan

## Problem

The operator has connections (e.g. a VLESS outbound) to add and monitor, but the
dashboard has **no clear place to add/manage outbounds**. The backend already has
full outbound support; the gap is a usable UI. Operators are confused between
**Servers**, **Routes**, and where a connection like VLESS belongs.

## Concepts (clarified)

- **Server** — a node/VPS the operator runs (SSH access, runs the proxy, reports
  CPU/RAM). Managed on the **Servers** page.
- **Outbound** — an **egress connection to the internet** (VLESS / WireGuard /
  L2TP). *This is what a VLESS link is.* Today only surfaced as counts (Servers)
  and health (Routes); no add/manage table.
- **Route** — the logic choosing which outbound to use (health history, quality,
  canary). The **Routes** page = monitoring + decisions, not for adding a connection.

## Goals (v1)

- New **"Outbounds"** sidebar page: one table of all outbounds.
- **Add** outbound via a top panel with a **protocol picker (VLESS / WireGuard /
  L2TP)**; VLESS supports **paste `vless://`** auto-fill.
- Per-row columns: **Status, Ping, Jitter, Download, Upload**, plus Name/Type/Actions.
- **Live** status/ping/jitter (reuse the agent's existing probes; table polls ~20s).
- **Test** per row and **Sync now** (test all) — runs probe + **download/upload
  speed test** on demand.
- **Auto toggle**: ON → system re-tests all outbounds every **10 minutes**; OFF →
  manual only.
- Edit / enable-disable / delete outbounds.

## Non-goals (later)

- Speed **history**/time-series charts per outbound.
- Configurable auto interval other than 10 min (fixed for v1).
- Deep per-protocol advanced-config editors (v1 covers the common fields + paste).

## What already exists (reused, not rebuilt)

- **Outbounds table** (`infra/postgres/migrations/0002_server_access_outbounds.sql`):
  `outbounds(id, server_id?, name, type, route_group, priority, enabled,
  maintenance_mode, config jsonb, secret_ref, health_status, health_interval_seconds,
  fail_threshold, recovery_threshold, cooldown_seconds, weight, max_users,
  last_checked_at, …)`. `type` ∈ {vless, wireguard, l2tp}; `server_id` is nullable
  (standalone third-party egress allowed).
- **Outbound CRUD API** (`operations.controller.ts`): `GET /outbounds`,
  `GET /outbounds/:id`, `POST /outbounds`, `PATCH /outbounds/:id`,
  `POST /outbounds/:id/move`, `DELETE /outbounds/:id`.
- **Agent probes** (`apps/agent/afrows_agent/collect.py`) already measure
  **ping / jitter / status** per outbound and report `outboundHealth`
  (`operations.service.ts` `probe()` / `outboundHealth`).
- Protocol support for vless/wireguard/l2tp throughout the backend.

## Architecture (Approach A — reuse & extend)

```
Dashboard (new Outbounds page)
  ├─ table: GET /outbounds  (+ latest health: status/ping/jitter, last throughput)
  ├─ add/edit/delete: existing POST/PATCH/DELETE /outbounds  (+ vless:// parser, client-side)
  ├─ poll ~20s for live status/ping/jitter (from agent probes)
  ├─ Test (row) / Sync now (all): POST /outbounds/:id/test  (or /outbounds/test-all)
  └─ Auto toggle: persists a setting; backend worker honors it (10-min full test)

Backend
  ├─ POST /outbounds/:id/test  -> enqueue a test job for the owning server's agent
  ├─ GET /outbounds -> include latest status/ping/jitter + last down/up throughput
  ├─ setting: outbounds.autoTest (bool) + 10-min scheduler that triggers test-all when on
  └─ reuse outboundHealth storage; add throughput fields if missing
     (last_throughput_down_mbps, last_throughput_up_mbps, last_speed_test_at)

Agent (collect.py)
  ├─ existing: ping/jitter/status probe per outbound (unchanged, periodic)
  └─ NEW: speed test — route a sized download + upload THROUGH the outbound's
     local proxy, measure Mbps; run on the test command (and within the 10-min
     auto cycle). Reports throughput back via the existing report channel.
```

**On-demand test mechanism:** backend marks a test request; the server's agent
picks it up on its next heartbeat/poll (exact channel pinned in the plan — reuse
the existing agent↔backend command/heartbeat path), runs probe + speed test,
reports results; the dashboard row updates on its next poll (or via the test
response). No new realtime transport required for v1.

## UI

```
Outbounds                         [ Auto ⦿ ]  [ Sync now ]  [ + Add outbound ]
──────────────────────────────────────────────────────────────────────────────
 Name        Type       Status  Ping  Jitter   ↓ Down    ↑ Up     Actions
 My VLESS    vless      ● up    18ms   3ms     92 Mbps   41 Mbps  [Test][Edit][⋯]
 Backup WG   wireguard  ● up    24ms   5ms      —         —       [Test][Edit][⋯]
 EU L2TP     l2tp       ● down   —     —        —         —       [Test][Edit][⋯]
──────────────────────────────────────────────────────────────────────────────
```

- **Auto toggle** (left of Sync now): when ON, shows "auto-testing every 10 min";
  when OFF, Sync now is the way to refresh speed.
- **Add panel** (opens at top on "+ Add outbound"): protocol picker →
  - **VLESS:** "Paste `vless://` link" → auto-fill name/address/port/uuid/sni/flow/
    network/security; editable before save.
  - **WireGuard:** paste config (or fields).
  - **L2TP:** fields (server, username, secret/PSK).
  - Save → `POST /outbounds` with `type` + `config`.
- Row actions: **Test**, **Edit**, ⋯ (Enable/Disable, Move group, Delete).
- Bilingual (FA/EN) + RTL, consistent with the dashboard's existing patterns.

## `vless://` parsing

Parse client-side: `vless://<uuid>@<host>:<port>?encryption=none&security=<tls|reality>&sni=<>&flow=<>&type=<tcp|ws|grpc>&...#<name>`.
Map into the outbound `config` jsonb the backend expects for `type='vless'`
(confirm exact shape against existing vless handling during planning). Show a
parse error if the link is malformed.

## Changes by layer

- **Frontend (`apps/dashboard`):** new `pages/OutboundsPage.tsx`, sidebar entry
  `outbounds`, add/edit form + `vless://` parser util, polling, Test/Sync-now,
  Auto toggle; FA/EN strings.
- **Backend (`apps/backend`):** `POST /outbounds/:id/test` + `/outbounds/test-all`;
  include health + throughput in `GET /outbounds`; `outbounds.autoTest` setting +
  10-min scheduler; throughput columns/migration if missing.
- **Agent (`apps/agent`):** download/upload speed-test routine in `collect.py`,
  triggered by the test command and the 10-min auto cycle; report throughput.

## Testing / verification

- Backend unit tests for the `vless://` parser and the test endpoint
  (`node:test`, matching existing backend tests).
- Add a VLESS outbound by pasting a link → row appears; Status/Ping/Jitter populate
  from agent; **Test** fills Download/Upload; **Sync now** refreshes all; **Auto**
  toggles the 10-min cycle; Edit/Disable/Delete work.
- Live verify on the box against the operator's real VLESS outbound.

## Docs / housekeeping (per operator request)

- Add this feature to `.codex/checklist.md` (new "Phase 9: Outbounds management").
- Record progress in `.codex/progress.md`.
- Note the **agent** gains a speed-test capability (update agent docs/changelog).

## Rollout phases (for the plan)

1. Outbounds page shell + sidebar + `GET /outbounds` table (Status/Ping/Jitter live).
2. Add/Edit/Delete + `vless://` parser (+ WireGuard/L2TP forms).
3. Agent speed test + `POST /outbounds/:id/test` + Download/Upload columns + per-row Test.
4. Sync now (test-all) + Auto toggle (10-min scheduler).
5. Deploy, verify against the real VLESS, update checklist/progress.
