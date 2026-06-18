# MikroTik Management ("Microtiks") — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Backend = NestJS module talking to MikroTik REST over the wg tunnels; storage = Postgres; frontend = the typed/i18n React dashboard. Router REST passwords are encrypted at rest via `SecretVaultService` (AES-256-GCM). Never commit secrets.

**Goal:** A "Microtiks" sidebar section: a table of the operator's MikroTiks (village, home, future), with an **Add** button, per-row **status columns**, a **Game/Normal toggle**, and an **Edit** view to see/change the configuration we set up on each router (plus an **Advanced** button that opens the router's own WebFig UI).

**Architecture:** `mikrotik_routers` Postgres table holds each router's connection info (host, REST user, encrypted password, WebFig URL, the gaming source IP, kind). A backend `routers` module does CRUD + live status (calls MikroTik `/rest` over the tunnel) + a `setMode` action (Game/Normal). The dashboard adds a `microtiks` view: table + Add dialog + Edit drawer + toggle, all behind super-admin auth.

**Tech stack:** NestJS, node `http` (direct to private tunnel IPs — bypasses the SSRF outbound policy on purpose), Postgres, React + the existing typed i18n dashboard, `lucide-react` icons.

**UI decision:** the Game/Normal column is a **toggle switch** (binary, instantly readable) — not checkbox (implies multi-select) or radio (needs 2 cells).

---

## Data model — migration `0038_mikrotik_routers.sql`
```sql
CREATE TABLE IF NOT EXISTS mikrotik_routers (
  id            text PRIMARY KEY,              -- e.g. 'village', 'home-ac3'
  label         text NOT NULL,
  kind          text NOT NULL DEFAULT 'other', -- 'village' | 'home' | 'other'
  host          text NOT NULL,                 -- tunnel IP, e.g. 10.20.0.2
  rest_port     integer NOT NULL DEFAULT 80,
  rest_user     text NOT NULL DEFAULT 'claude',
  rest_password_enc text,                      -- SecretVaultService envelope (context='mikrotik:'||id)
  webfig_url    text,                          -- e.g. https://afrows.com/router/village/
  gaming_source_ip text,                       -- the afrows-xray source IP toggled for Game mode (home=10.7.0.2)
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
```
Mode (Game/Normal) is **derived live** from whether `gaming_source_ip` is in `AFROWS_GAMING_EXTRA_SOURCES` (afrows env) — not stored as a column, to stay the single source of truth with `afrows-egress-mode-sync.py`.

## Backend — `apps/backend/src/routers/`
- `mikrotik-client.service.ts` — `call(router, method, path, body?)` via node `http` Basic-Auth to `host:rest_port/rest/...` (timeout, private-IP allowed).
- `routers.service.ts`:
  - `list()` → metadata (no secrets) + `online` (cheap `/system/resource` probe) + `mode`.
  - `getStatus(id)` → identity/board/version/uptime/cpu, WANs (`/interface/ethernet`+`/ip/address`), WG peers (`/interface/wireguard/peers` rx/tx/handshake).
  - `create(dto)` / `update(id,dto)` / `remove(id)` — encrypt password via `SecretVaultService`.
  - `setMode(id, 'game'|'normal')` → add/remove the router's `gaming_source_ip` in the afrows env + trigger `afrows-egress-mode-sync` (sudo systemctl start) — same path as the existing billing→reconciler trigger.
- `routers.controller.ts` — `@Controller('admin')` + `@UseGuards(AdminTokenGuard, RolesGuard)`:
  - `GET routers` `@Roles('admin','supervisor','support','auditor')`
  - `GET routers/:id/status` (same roles)
  - `POST routers` / `PATCH routers/:id` / `DELETE routers/:id` `@Roles('admin')`
  - `POST routers/:id/mode` `@Roles('admin','supervisor')`
- Register controller + services in `app.module.ts`.

## Shared types — `packages/shared/src/index.ts`
`MikroTikRouterSummary`, `MikroTikRouterStatus`, `MikroTikWan`, `MikroTikWgPeer`, `MikroTikMode='game'|'normal'`, request/response wrappers (`AdminRoutersResponse`, `AdminRouterStatusResponse`, `Create/UpdateMikroTikRouterRequest`, `SetMikroTikModeRequest`).

## Frontend — dashboard
- `dashboard-types.ts`: add `'microtiks'` to `ActiveView`.
- `i18n.en.ts` + `i18n.fa.ts`: add `nav.microtiks` + `pageHeaders.microtiks` (keep page-body strings minimal/inline for v1).
- `components/Sidebar.tsx`: add nav item (icon `Router`).
- `DashboardApp.tsx`: `case 'microtiks': return <MicrotiksPage sessionToken={sessionToken} t={t} />;`
- `api/routers.ts`: `fetchRouters`, `fetchRouterStatus`, `createRouter`, `updateRouter`, `deleteRouter`, `setRouterMode`.
- `pages/MicrotiksPage.tsx`:
  - **Table** columns: Label, Kind, Host, Status (online dot + board/version/uptime), WANs/transport summary, **Mode (toggle)**, Actions (**Edit**, **Advanced→WebFig**).
  - **Add** button → dialog (label, kind, host, rest user/password, webfig url, gaming source ip).
  - **Edit** → drawer: full live status (WANs, WG peers w/ handshake+traffic) + editable connection fields + the **Advanced** (WebFig) button + (later) inline config controls (transport modem, gaming sources).

## Phases
1. **Phase 1 (foundation):** migration 0038 + shared types + backend module (list/status/create/update/delete/setMode) + register. Verify `tsc` builds.
2. **Phase 2 (frontend):** sidebar + table + Add dialog + Mode toggle + Advanced(WebFig). Verify dashboard build.
3. **Phase 3 (edit):** Edit drawer with live status + editable fields + inline config controls.
4. **Phase 4 (WebFig proxy + deploy):** nginx reverse-proxy `afrows.com/router/<id>/` → `host`, seed the 2 routers, set `AFROWS_SECRETS_KEY`, deploy.

## Safety / notes
- Router passwords: encrypted at rest (`SecretVaultService`), never returned to the client (responses omit them).
- `setMode` reuses the proven env + `afrows-egress-mode-sync` path; no new egress logic.
- Never touch the friends' tunnels; this panel only manages the operator's routers.
- Deploy only when the operator says so.
