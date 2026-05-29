# AfroGate Progress

## 2026-05-23

### Completed

- Created initial project planning docs from the 40-point product answers.
- Added MVP monitoring PRD in Persian.
- Added technical architecture proposal in Persian.
- Added roadmap and backlog in Persian.
- Added root `README.md`.
- Added root `AGENTS.md` so future coding agents know what to read first.
- Added `.codex/` control folder with agent, skills, checklist, progress, and memory files.
- Added `.gitignore`.
- Initialized local git repository on branch `main`.
- Linked README to agent instructions and Codex memory.
- Created initial local commit `9ce7684`.
- Configured `origin` as `https://github.com/Benjil44/afrogate.git`.
- Initial push failed before the GitHub repository existed.
- Added enhancement approach documentation covering reliability, observability, route intelligence, privacy, billing safety, progressive migration, enterprise readiness, data analysis, and development sequencing.
- Linked enhancement documentation from README, AGENTS, agent rules, checklist, and memory.
- Created local documentation commit for the enhancement approach.
- Retried push before remote creation and it was still unavailable at that time.
- User decided to keep the repository local-first for now and maybe push to remote later.
- Added implementation start plan and initial stack direction: NestJS backend, React/Vite/Tailwind dashboard, PostgreSQL, Python agent, Docker optional.
- Replaced Next.js dashboard scaffold with React/Vite to reduce VPS resource usage and keep dependency audit clean.
- User created GitHub repository `Benjil44/afrogate`.
- Updated `origin` to `https://github.com/Benjil44/afrogate.git`.
- Pushed local `main` to GitHub and set it to track `origin/main`.
- Chose Drizzle ORM for backend database access while keeping migrations as hand-written SQL.
- Added PostgreSQL schema and idempotent migration for servers, server metrics, alerts, audit logs, and agent token records.
- Added backend database service with a small configurable PostgreSQL pool.
- Persisted incoming agent metrics into PostgreSQL and exposed the latest metric per server at `/api/metrics/latest`.
- Added basic critical storage alert synchronization when free disk space drops below 10%.
- Added shared latest-metrics TypeScript contract and configured app prebuild/pretypecheck scripts to build shared declarations first.
- Connected the dashboard to live latest metrics with 10-second polling, stale/live status, and a local fallback sample.
- Added control-plane egress strategy for restricted servers that need Telegram/API access through a local outbound proxy.
- Added Python agent support for `AFROGATE_OUTBOUND_PROXY_URL`.
- Added server access and outbound management strategy: temporary bootstrap credentials, agent-first monitoring, encrypted secrets, ordered outbounds, health checks, and failover rules.
- Added ECharts-based realtime health timeline with 15m/1h/6h/24h ranges and a backend `/api/metrics/timeseries` endpoint.
- Added PostgreSQL/Drizzle database foundation for server access profiles, encrypted credential records, outbounds, outbound health checks, and route failover events.
- Added backend bootstrap admin bearer-token guard, role decorator, role guard, and shared bearer-token parsing/constant-time comparison helper.
- Added second-LCD NOC dashboard layout with clock, health chart, servers, tunnels, alerts, outbounds, capacity, and control-plane status in one dense display.
- Added dashboard sidebar pages checklist so every sidebar item has a development target before implementation.
- Replaced placeholder sidebar anchors with real in-app navigation and initial Dashboard, Servers, Routes, and Alerts pages.
- Added agent/backend metric support for local CPU, RAM, all detected storage volumes, network interface counters, and traffic rates.
- Added dashboard header system resource strip before the connectivity/routing monitor sections.
- Added AfroGate versioning workflow with SemVer bump scripts, version consistency checks, changelog, and local Codex plugin/skill.
- Added dashboard sidebar version footer sourced from root `package.json`.
- Split dashboard traffic into separate download and upload values in the header resource strip, summary cards, capacity panel, and server rows.
- Added typed English/Persian dashboard translations with persisted language choice and page `lang`/`dir` updates.
- Added a sidebar footer language icon toggle beside the version display.
- Added multilingual UI policy documentation and linked it from README and AGENTS.
- Added local IRANSans font-face wiring for Persian mode and an asset folder for licensed font files without using a CDN.
- Moved the workspace-provided `Iranian Sans.ttf` into the dashboard font assets as `IranianSans.ttf`.
- Reworked the dashboard sidebar so mobile navigation wraps instead of horizontally scrolling and desktop navigation remains sticky.
- Tightened responsive dashboard layouts for storage chips, capacity cards, nav labels, and server row traffic details.
- Added stable `data-view` attributes to sidebar navigation for browser-level layout verification.
- Changed the desktop shell to `h-screen`/`overflow-hidden` and made the main content pane the only vertical scroll container.
- Compacted the dashboard into a denser NOC layout with smaller cards, rows, charts, resource strips, and earlier multi-column dashboard sections.
- Verified the dashboard, Servers, Routes, and Alerts pages fit without main-content overflow on a 1920x1080 second-LCD viewport.
- Fixed the packet-loss dashboard translations so Persian shows `افت بسته` and English no longer shows Persian text.
- Strengthened Persian dashboard typography and number formatting so Persian mode uses local IRANSans, Persian digits, Persian units, localized clock/latency/threshold values, and localized fallback sample names.
- Added alert-aware sidebar navigation so the Alerts item shows warning/critical counts and turns red when critical alerts exist.

- Added guarded backend admin APIs under `/api/admin` for server inventory/detail/create/update/delete, outbound list/detail/create/update/delete, outbound priority moves, and route failover history reads.
- Added shared TypeScript contracts for admin server, access profile, outbound, and route failover event responses.
- Added a backend audit service and audit events for server and outbound mutations.
- Kept outbound route management secret-safe by rejecting secret-like config keys, redacting legacy secret-like config values in responses, and exposing only `hasSecretRef` instead of saved secret references.
- Bumped AfroGate to `0.4.0` for the guarded admin management API capability.
- Switched Persian dashboard typography from IRANSans to the local YekanBakh FaNum variable webfont under `apps/dashboard/public/assets/fonts/YekanBakh/`.
- Updated dashboard DOM CSS and ECharts font-family wiring to use `AfroGate YekanBakh`.
- Bumped AfroGate to `0.4.1` for the Persian font update.
- Replaced the dashboard-facing admin token login with username/password login through `/api/auth/login`.
- Added signed admin session tokens for dashboard sessions, with `/api/admin/session` verifying the signed bearer session.
- Added the permanent `superadmin` role concept and optional configured `admin` login support while keeping the legacy admin bearer token as an API/bootstrap fallback.
- Updated dashboard English/Persian login copy, `.env.example`, and the security/performance policy for the superadmin/admin login model.
- Bumped AfroGate to `0.5.0` for the username/password admin session auth capability.
- Fixed a local login UX issue where `superadmin` appeared as placeholder text but was not submitted; the login form now pre-fills `superadmin`, marks both fields required, and focuses the password field.
- Bumped AfroGate to `0.5.1` for the login form usability fix.
- Added a `Users` sidebar page for superadmin-focused admin account management.
- Added guarded `/api/admin/users` endpoints for listing, creating, disabling/enabling, deleting, and changing passwords for managed admin users.
- Kept bootstrap/env admin accounts protected: the bootstrap `superadmin` is listed but cannot be removed, disabled, or password-changed through normal user-management actions.
- Added `supervisor` as a managed admin-user role with read-oriented dashboard access.
- Added local scrypt-hashed managed admin user storage through `AFROGATE_ADMIN_USERS_FILE`, defaulting to git-ignored `tmp/admin-users.json`.
- Bumped AfroGate to `0.6.0` for the admin user-management capability.

### Current State

- The repository now has a scaffolded backend, dashboard, agent, shared package, and infra samples.
- Local git repository exists on branch `main`.
- Remote target is configured for `Benjil44/afrogate` and local `main` tracks `origin/main`.
- Backend, dashboard, agent, shared package, and infra folders are scaffolded.
- Current highest priority remains the monitoring MVP, now moving from admin user management into guarded dashboard server/outbound edit flows, alert API binding, and alert delivery.
- Enhancement approach is documented, but not implemented yet.
- First real data path exists: agent-style metrics can be accepted by the backend, persisted to PostgreSQL, and rendered by the dashboard when the API/database are configured.

### Next Recommended Step

Continue the monitoring MVP:

1. Add real server edit flow with safe access/bootstrap tabs.
2. Add alert listing endpoints and bind dashboard alerts to real alert rows.
3. Add Telegram critical alert delivery using the shared control-plane egress policy.
4. Add WireGuard tunnel metrics to the Python agent.
5. Add dashboard API binding for guarded server/outbound reads now that the dashboard has an admin session flow.

Repository remote is ready:

1. Continue implementation locally.
2. Commit meaningful changes.
3. Push with `git push`.

### Verification

- File creation verified locally.
- Git repository initialized locally.
- Initial commit created.
- Earlier push attempts were blocked before the remote repository existed.
- Remote owner set to `Benjil44`.
- Enhancement documentation added and linked.
- Latest push after repository creation succeeded.
- Local-first git direction recorded.
- Implementation start plan added.
- GitHub repository created by user.
- Initial commits pushed successfully.
- Created application monorepo structure for backend, dashboard, agent, shared package, and infra folders.
- Added root workspace package, TypeScript base config, environment example, editor config, and repository structure documentation.
- Verified package JSON files parse.
- Verified Python agent compiles and runs once locally.
- Added security and performance policy.
- Added root security policy.
- Added Ubuntu UFW baseline and sysctl network sample.
- Hardened backend systemd sample and Nginx sample.
- Protected metrics ingest with an agent bearer-token guard.
- Switched dashboard from Next.js to React/Vite static build for lower VPS resource use and cleaner dependency audit.
- Regenerated `package-lock.json`.
- Verified `npm audit` reports zero vulnerabilities.
- Verified backend, dashboard, and shared TypeScript checks.
- Verified backend and dashboard production builds.
- Added Tailwind CSS v4 through the official Vite plugin.
- Converted dashboard styling from custom CSS classes to Tailwind utility classes and small reusable React components.
- Verified Tailwind dashboard build keeps static output and zero dependency vulnerabilities.
- Chose Drizzle ORM for backend database access while keeping migrations as hand-written SQL.
- Added PostgreSQL schema and idempotent migration for servers, server metrics, alerts, audit logs, and agent token records.
- Added backend database service with a small configurable PostgreSQL pool.
- Persisted incoming agent metrics into PostgreSQL and exposed the latest metric per server at `/api/metrics/latest`.
- Added basic critical storage alert synchronization when free disk space drops below 10%.
- Added shared latest-metrics TypeScript contract and configured app prebuild/pretypecheck scripts to build shared declarations first.
- Connected the dashboard to live latest metrics with 10-second polling, stale/live status, and a local fallback sample.
- Verified `npm audit` reports zero vulnerabilities after adding PostgreSQL/Drizzle runtime dependencies.
- Verified `npm run typecheck --workspaces --if-present`.
- Verified `npm run build --workspaces --if-present`.
- Verified `node --check apps\backend\scripts\migrate.mjs`.
- Verified `python -m compileall apps\agent`.
- Verified `python apps\agent\run.py --once`; local disk free was below 10%, which matches the new critical storage alert threshold when posted to the backend.
- Verified Python agent still compiles after adding outbound proxy support.
- Verified ECharts health timeline with dependency audit, workspace typecheck, and production build.
- Verified server access/outbound schema foundation with dependency audit, workspace typecheck, and production build.
- Verified backend bootstrap admin/role guard foundation with dependency audit, workspace typecheck, and production build.
- Verified second-LCD NOC dashboard layout with dependency audit, workspace typecheck, and production build.
- Verified sidebar navigation pages with dependency audit, workspace typecheck, and production build.
- Verified system resource metric collection with Python compile/run and workspace typecheck.
- Verified dashboard system resource header with dependency audit, workspace typecheck, and production build.
- Verified versioning workflow with `npm run version:check`, workspace typecheck, and production build.
- Verified dashboard upload/download split with `npm run version:check`, workspace typecheck, production build, and dependency audit.
- Verified dashboard multilingual support with `npm run version:check`, workspace typecheck, production build, and dependency audit.
- Verified Persian font asset wiring and copied font asset with version check, workspace typecheck, production build, and dependency audit.
- Verified Dashboard, Servers, Routes, and Alerts pages in English and Persian at 375x812, 768x1024, 1440x900, and 1920x1080 using local Edge CDP against the Vite server on port 3100.
- Verified English/LTR fixed-sidebar behavior at 1440x900 and 1920x1080: window scroll stays at 0, document height equals viewport height, sidebar stays top-left, and content scrolls independently when needed.
- Verified compact dashboard density in local Edge CDP: 1920x1080 reports `0px` main-content overflow for Dashboard, Servers, Routes, and Alerts; 1440x900 Dashboard content was reduced from about `2581px` to `1182px`.
- Verified packet-loss translation fix with dashboard typecheck and version consistency check.
- Verified Persian dashboard font and runtime text in local Edge CDP: `main` and buttons compute to `"AfroGate IRANSans"`, and sample text renders Persian digits, units, latency, packet loss, and localized sample labels.
- Verified sidebar alert warning state in local Edge CDP with the fallback warning sample; critical severity uses the same alert-row source with a red class path.
- Added a UI/UX audit checklist and fixed the first dashboard density issues: compact icon resource rows, simplified health timeline spacing, and zero main-content overflow on the 1920x1080 Dashboard view in English and Persian.
- Verified the latest UI/UX pass with dashboard typecheck and local Edge CDP across Dashboard, Servers, Routes, and Alerts in English/Persian at mobile, tablet, desktop, and second-LCD sizes; measured text overflow cases are now zero.
- Added desktop sidebar collapse/expand support with persisted state, localized labels/tooltips, English left-side collapse, and Persian right-side collapse verification in local Edge CDP.
- Repositioned the sidebar collapse control from an awkward internal row to an icon-only edge handle on the sidebar/content divider, mirrored for RTL.
- Compacted dashboard panel headers and panel/table spacing so metadata counts stay inline with titles; verified English/Persian dashboard headings stay same-line with zero measured text overflow in local Edge CDP.
- Verified guarded admin management API code with workspace typecheck and production build.
- Verified `npm run version:check` after the `0.4.0` bump.
- Verified `npm audit` still reports zero vulnerabilities.
- Verified the running Vite server returns HTTP 200 for `yekanbakh.css` and the `YekanBakhFaNum-VF.woff2` font file.
- Verified the YekanBakh switch with workspace typecheck and production build.
- Verified `npm run version:check` after the `0.4.1` bump.
- Verified `npm audit` still reports zero vulnerabilities after the YekanBakh switch.
- Database migration script was added but not run in this session because no local PostgreSQL connection was configured.
- Verified username/password login by restarting the local backend with `superadmin` and `admin` development credentials and calling `/api/auth/login` plus `/api/admin/session`.
- Verified the admin session auth change with workspace typecheck, production build, `npm run version:check`, and `npm audit --audit-level=moderate`.
- Verified the local dashboard server on `127.0.0.1:3003` returns HTTP 200 after the auth UI change.
- Fixed a local login UX issue where `superadmin` appeared as placeholder text but was not submitted; the login form now pre-fills `superadmin`, marks both fields required, and focuses the password field.
- Bumped AfroGate to `0.5.1` for the login form usability fix.
- Verified the `0.5.1` login usability fix with workspace typecheck, production build, and `npm run version:check`.
- Verified admin user management by logging in as superadmin, listing users, creating a temporary support user, confirming it was deletable, deleting it, and confirming the bootstrap superadmin stayed protected.
- Verified the `supervisor` role path by creating and deleting a temporary supervisor user through the guarded admin user API.
- Verified the `0.6.0` user-management capability with workspace typecheck, production build, `npm run version:check`, and `npm audit --audit-level=moderate`.

## 2026-05-24

### Completed

- Synced `.codex` control notes after the superadmin/users implementation.
- Updated memory and agent rules to include the `supervisor` role, protected `superadmin` invariant, and hashed admin-user runtime storage expectations.
- Updated checklist state so the admin-user role foundation is marked done while production fine-grained RBAC remains pending.
- Simplified the dashboard Users page so it focuses on the admin-user table instead of showing the global server/resource strip.
- Moved admin-user creation out of the side panel and toward a top Add user flow available to the protected `superadmin` session.
- Updated the Users table action heading through the typed multilingual layer and inserted newly created users directly into the visible table after successful API persistence.
- Bumped AfroGate to `0.6.1` for the Users page UI refinement.
- Restored the Users page title, replaced the add-user modal with a separate inline create-user section above the history table, and kept server card country metadata inline with server names.
- Bumped AfroGate to `0.6.2` for the follow-up Users and Servers page layout refinement.
- Documented protocol-aware smart routing across the architecture, PRD, route-management, security/performance, roadmap, and repository-structure docs.
- Added pending checklist tasks for agent TCP/UDP/QUIC/DNS/WireGuard probes, backend protocol-aware route scoring, and smart-route profile selection.
- Bumped AfroGate to `0.6.3` for the protocol-aware smart-routing documentation update.
- Added the initial Servers page edit workflow with selectable server cards and a right-side edit panel.
- Added Overview, Access, Monitoring, Interfaces, and Audit tabs to the server edit panel while keeping access/bootstrap read-only and secret-safe.
- Marked the server edit screen and dashboard edit tabs complete in the project checklists.
- Bumped AfroGate to `0.7.0` for the server edit workflow capability.
- Added the admin-guarded `POST /api/agents/register` backend endpoint to upsert a server and issue a one-time agent token.
- Changed metrics ingest authentication so non-revoked database-issued agent tokens with `metrics:write` scope are accepted alongside the legacy environment fallback token.
- Added shared request/response contracts for agent registration and documented the registered-token environment flow.
- Marked the agent registration endpoint checklist item complete.
- Bumped AfroGate to `0.8.0` for the agent registration capability.
- Added protected `POST /api/agents/heartbeat` for lightweight server agent heartbeats.
- Updated the Python agent to send heartbeat metadata before each metrics push through the same token and outbound proxy path.
- Marked the server agent heartbeat checklist item complete.
- Bumped AfroGate to `0.9.0` for the server agent heartbeat capability.
- Standardized direct local development ports to dashboard `3000` and backend `8000`.
- Added strict Vite port behavior so AfroGate does not drift to `3001+` when port `3000` is busy.
- Installed and wired Playwright browser smoke tests for fixed-port dashboard rendering.
- Documented frontend/backend/agent local API wiring in `docs/local-development.md`.
- Bumped AfroGate to `0.9.1` for local development and Playwright test wiring.
- Tried to install local PostgreSQL with Chocolatey, but Windows blocked the install because the current shell is not running as Administrator.
- Confirmed PostgreSQL remains the preferred development database over SQLite because the backend already depends on PostgreSQL-specific migrations and queries.
- Added `scripts/setup-local-postgres.ps1` and root `db:setup:local` to install/prepare local PostgreSQL, create the `afrogate` role/database, optionally write `.env`, and run migrations.
- Documented local PostgreSQL setup in `docs/local-development.md` and `infra/postgres/README.md`.
- Bumped AfroGate to `0.9.2` for local PostgreSQL setup tooling and documentation.
- Installed PostgreSQL 18.4 locally on Windows, created the `afrogate` role/database, wrote the local ignored `.env`, and applied all PostgreSQL migrations.
- Added `C:\Program Files\PostgreSQL\18\bin` to the user PATH so new shells can run `psql` directly.
- Fixed `scripts/setup-local-postgres.ps1` so missing role/database scalar checks handle empty `psql` output.
- Added guarded read-only `/api/admin/alerts` listing with status/severity/source filters and shared alert response contracts.
- Bound the dashboard Alerts page, dashboard alert panel, summary critical count, and sidebar alert badge to real backend alert rows when the admin API is available.
- Marked local PostgreSQL setup, real alert API binding, and real alert/sidebar severity binding complete in the project checklists.
- Bumped AfroGate to `0.10.0` for the guarded alert API and dashboard alert binding capability.
- Stopped local Node dev-server listeners that were occupying ports `3000`, `8000`, and `8080`.
- Stopped a later restarted local Node listener on port `8000` so old backend port stays clear.
- Moved AfroGate direct local development wiring to dashboard `4000` and backend `7000` so ports `3000` and `8080` can be used by another app.
- Updated dashboard defaults, backend default port, Playwright smoke-test URL, `.env.example`, the local PostgreSQL `.env` template, docs, Ubuntu samples, and the local ignored `.env` for the new ports.
- Updated backend configuration loading to read both backend-workspace and repository-root `.env` files for root workspace dev commands.
- Bumped AfroGate to `0.10.1` for the local port migration.
- Fixed the local login CORS mismatch where the dashboard on `127.0.0.1:4000` called `localhost:7000` while the backend allowed only `localhost:4000`.
- Added a login password show/hide icon button with typed English/Persian labels.
- Updated the local ignored `.env` to allow both local origins, call the backend through `127.0.0.1:7000`, and match the local superadmin password chosen for this machine.
- Bumped AfroGate to `0.10.2` for the local login/CORS and password visibility fix.

### Verification

- Earlier documentation-only sync required no product version bump or code verification.
- Verified the Users page UI refinement with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified version consistency with `npm run version:check`.
- Verified the `0.6.2` layout refinement with workspace typecheck, production build, and version consistency check.
- Verified the `0.6.3` protocol-aware routing documentation bump with `npm run version:check`.
- Verified the server edit workflow implementation with `npm run typecheck --workspaces --if-present`.
- Verified the `0.7.0` server edit workflow with `npm run version:check`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified the agent registration endpoint implementation with `npm run typecheck --workspaces --if-present`.
- Verified the `0.8.0` agent registration capability with `npm run version:check`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified the heartbeat backend contracts with `npm run typecheck --workspaces --if-present`.
- Verified the Python heartbeat client changes with `python -m compileall apps\agent`.
- Verified the `0.9.0` heartbeat capability with `npm run version:check`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified Playwright CLI availability with `npx playwright --version`.
- Verified the `0.9.1` local development/test wiring with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified fixed-port dashboard rendering with `npm run test:e2e`.
- Verified dependency audit after adding Playwright with `npm audit --audit-level=moderate`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified the direct-run backend on `http://127.0.0.1:8000/api/health` and dashboard on `http://127.0.0.1:3000`.
- Verified local superadmin login against backend `8000` using local-only development credentials.
- Verified the local PostgreSQL setup script parses with the PowerShell parser.
- Verified `package.json` parses after adding `db:setup:local`.
- Verified the `0.9.2` local PostgreSQL setup tooling with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified dependency audit with `npm audit --audit-level=moderate`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified local PostgreSQL service, app database connectivity, and migrated tables after install.
- Verified `npm run db:setup:local -- -SkipInstall` is idempotent after the scalar-output fix.
- Verified the `0.10.0` alert binding capability with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified the guarded alert API by logging in locally and calling `/api/admin/alerts?status=open&limit=100`; the current local database returned a valid empty alert list.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified there are no active `LISTENING` processes on ports `3000`, `4000`, `7000`, `8000`, or `8080` after cleanup.
- Verified local ignored `.env` points to `PORT=7000`, `CORS_ORIGIN=http://localhost:4000`, and API URLs on `http://localhost:7000/api`.
- Verified the `0.10.1` port migration with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test on `http://127.0.0.1:4000` with `npm run test:e2e`.
- Verified the fixed local CORS preflight for `Origin: http://127.0.0.1:4000`; backend now returns `Access-Control-Allow-Origin: http://127.0.0.1:4000`.
- Verified direct `superadmin` login against `http://127.0.0.1:7000/api/auth/login` with the local `.env` password and confirmed a session token is returned.
- Verified the Vite-served dashboard API module uses `http://127.0.0.1:7000/api` instead of `localhost:7000`.
- Verified fixed-port dashboard smoke test again with `npm run test:e2e`.
- Added dashboard admin API fetchers for servers, outbounds, and route failover events.
- Bound the Servers page to guarded `/api/admin/servers`, preserving local metric fallback only when the API is unavailable.
- Bound the Routes page and dashboard outbound panel to guarded `/api/admin/outbounds` and `/api/admin/route-failover-events`, with localized empty states for real empty lists.
- Marked real server and route/outbound dashboard API bindings complete in the project checklists.
- Bumped AfroGate to `0.11.0` for real Servers/Routes API binding.
- Verified the `0.11.0` API binding with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Added a backend alert engine scheduler that creates and resolves alerts from server freshness, latest metrics, route-quality thresholds, and outbound health status.
- Added configurable alert thresholds for stale heartbeats/metrics, CPU, RAM, disk free, ping, jitter, and packet loss.
- Marked the Alert engine checklist item complete.
- Added pending checklist and agent guidance for a guided, secret-safe WireGuard/system Settings page before real-server onboarding.
- Bumped AfroGate to `0.14.0` for the alert engine capability.
- Verified the `0.14.0` alert engine with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Added a backend outbound health scheduler for due enabled/non-maintenance outbounds.
- Added synthetic HTTP and TCP health probes driven by outbound config (`healthUrl` or `healthHost`/`healthPort`) without inspecting user traffic.
- Persisted outbound health samples to `outbound_health_checks` and updated `outbounds.health_status`, `last_checked_at`, and `last_healthy_at` with fail/recovery threshold handling.
- Documented outbound health scheduler environment variables and local test config.
- Marked the outbound health check scheduler checklist item complete.
- Bumped AfroGate to `0.13.0` for the outbound health scheduler capability.
- Verified the `0.13.0` outbound health scheduler with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified local logged-in admin reads for `/api/admin/servers`, `/api/admin/outbounds`, and `/api/admin/route-failover-events`; the current local database returned valid empty lists.
- Added a backend shared outbound HTTP client for Telegram/API control-plane calls with direct HTTP/HTTPS and localhost HTTP proxy support.
- Added disabled-by-default Telegram critical-alert delivery that polls open critical backend alerts when Telegram bot/chat environment values are configured.
- Added best-effort audit rows for Telegram alert send/failure outcomes without storing bot tokens or message secrets.
- Documented local Telegram alert configuration and marked the Telegram sender, shared outbound HTTP client, and Telegram critical alert flow checklist items complete.
- Bumped AfroGate to `0.12.0` for the Telegram critical-alert delivery foundation.
- Verified the `0.12.0` Telegram alert foundation with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Added a dashboard Settings page with a real sidebar entry for guided WireGuard and system setup.
- Added write-only private-key draft handling: validation accepts the key, clears it from the form, and never echoes it in the safe preview.
- Added Settings route controls for automatic/manual mode, manual WireGuard selection, smart load-balance strategy, and sample WireGuard health comparison by score, latency, jitter, packet loss, and load.
- Added a superadmin-only protocol draft factory for WireGuard, VLESS, L2TP, and IKEv2 with balanced, high-speed, and high-security profiles.
- Marked the Settings page, initial secret-safe WireGuard setup draft, WireGuard health comparison UI, route mode controls, and initial protocol draft factory complete in the checklists.
- Tracked remaining production work: encrypted backend persistence, real per-tunnel WireGuard health checks, protocol provisioning, and advanced smart load balancing.
- Bumped AfroGate to `0.15.0` for the Settings/protocol setup workflow.
- Verified the `0.15.0` Settings/protocol setup workflow with `npm run typecheck --workspaces --if-present`.
- Verified the `0.15.0` Settings/protocol setup workflow with `npm run version:check`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Added PostgreSQL migration `0004_settings_protocols.sql` for `protocol_setups` and `route_settings`.
- Added guarded backend Settings APIs for reading Settings state, saving route mode/load-balance settings, and creating superadmin-only protocol setup drafts.
- Kept Settings persistence secret-safe by storing non-secret protocol shape and optional secret references, not raw private keys.
- Bound the dashboard Settings page to the backend Settings API, including saved protocol drafts and real WireGuard candidates from existing `wireguard` outbound health samples when available.
- Verified the new local Settings API read/write path by logging in with the local superadmin account, reading `/api/admin/settings`, creating a non-secret WireGuard protocol draft, and saving route settings.
- Bumped AfroGate to `0.16.0` for the Settings persistence/API foundation.
- Verified the `0.16.0` Settings persistence/API foundation with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.

## 2026-05-25

### Completed

- Added PostgreSQL migration `0005_secret_records.sql` for encrypted Settings/server secret references.
- Added backend `SecretVaultService` using AES-256-GCM with `AFROGATE_SECRETS_KEY` and `AFROGATE_SECRETS_KEY_ID`.
- Added guarded superadmin `POST /api/admin/settings/secrets` to store write-only Settings private-key material and return only `secretRef` metadata.
- Linked protocol setup draft creation to active matching `secretRef` records so raw private keys stay out of `protocol_setups.config`.
- Updated the dashboard Settings WireGuard setup flow to save private keys through the encrypted backend secret API, clear the field, and show encrypted-storage readiness.
- Documented the local/deployment requirement for `AFROGATE_SECRETS_KEY`.
- Marked the encrypted Settings private-key persistence checklist item complete.
- Bumped AfroGate to `0.17.0` for the encrypted Settings secret-storage capability.
- Added PostgreSQL migration `0006_protocol_provisioning.sql` to link protocol setup drafts to provisioned outbound rows.
- Added guarded superadmin `POST /api/admin/settings/protocol-setups/:id/provision` to convert a saved protocol draft into a managed outbound row without applying server OS/service changes.
- Kept initial provisioned outbounds disabled and in maintenance mode by default, with `health_status='unknown'`, secret references preserved, and audit logging for the provisioning action.
- Added Settings UI actions for provisioning saved protocol drafts and showing when a draft has become a managed outbound.
- Tightened the backend direct-run bind address to default to `127.0.0.1`, with `HOST` available for explicit deployment overrides.
- Documented that current provisioning is control-plane-only and that production server-side apply plus health validation remains pending.
- Marked the initial backend protocol provisioning engine complete while tracking the production server-side apply engine separately.
- Bumped AfroGate to `0.18.0` for the initial protocol provisioning capability.
- Added privacy-safe WireGuard telemetry to the Python agent using `wg show all dump` when available, including interface status, peer counts, handshake age, transfer counters, and rate deltas.
- Fingerprinted WireGuard peer public keys before reporting them and kept raw public keys, private keys, and preshared keys out of metrics payloads.
- Added shared/backend metric contracts and DTO validation for `wireGuardInterfaces`, and returned that telemetry through latest metrics and admin server inventory rows.
- Included WireGuard interface health in backend health-score penalties when all/some peers are down or degraded.
- Surfaced WireGuard status, active-peer counts, handshake age, and traffic rates in the dashboard Server Monitoring and Interfaces tabs with English/Persian labels.
- Marked WireGuard tunnel status metrics complete while keeping route-selection health scoring and active protocol probes pending.
- Bumped AfroGate to `0.19.0` for the WireGuard tunnel telemetry capability.
- Merged live agent WireGuard telemetry into the Settings WireGuard route candidate list alongside managed outbound health rows.
- Added backend scoring for agent-sourced WireGuard candidates using tunnel state, active peer ratio, handshake freshness, and server health.
- Added Settings UI source badges plus active-peer, handshake, and throughput details for WireGuard candidates.
- Marked real per-tunnel WireGuard health checks for admin route selection complete while keeping ping/jitter/packet-loss and full protocol-aware probes pending.
- Bumped AfroGate to `0.20.0` for agent-backed WireGuard route candidates.
- Finished opt-in agent ping/jitter/packet-loss probes using configured synthetic targets from `AFROGATE_PING_TARGETS`.
- Kept empty ping target configuration privacy-safe by reporting null route-quality values rather than probing uncontrolled destinations.
- Added the missing typed English/Persian `routeQuality` dashboard label used by the server monitoring tab.
- Marked ping/jitter/packet-loss probes complete while keeping full TCP/UDP/QUIC/DNS protocol-aware probes pending.
- Bumped AfroGate to `0.21.0` for the opt-in ping/jitter/packet-loss probe capability.

### Verification

- Applied PostgreSQL migrations through `0005_secret_records.sql` with `npm.cmd --workspace @afrogate/backend run db:migrate`.
- Verified the local Settings secret API by logging in as the local superadmin, storing a fake WireGuard private key with a temporary in-process encryption key, creating a protocol setup linked to the returned `secretRef`, reading Settings, and confirming the fake key was not stored in plaintext.
- Removed the local `verify-wg-secret-*` smoke-test rows from `protocol_setups` and `secret_records` after verification.
- Verified `0.17.0` with `npm.cmd run version:check`.
- Verified workspace TypeScript checks with `npm.cmd run typecheck --workspaces --if-present`.
- Verified production build with `npm.cmd run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm.cmd run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Applied PostgreSQL migrations through `0006_protocol_provisioning.sql` with `npm.cmd --workspace @afrogate/backend run db:migrate`.
- Verified the local provision API by logging in as superadmin, storing a fake encrypted WireGuard private key, creating a temporary protocol setup, provisioning it into a disabled maintenance-mode outbound, checking the Settings linkage, and cleaning the smoke-test rows.
- Verified `0.18.0` with `npm.cmd run version:check`.
- Verified workspace TypeScript checks with `npm.cmd run typecheck --workspaces --if-present`.
- Verified production build with `npm.cmd run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm.cmd run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified the WireGuard telemetry implementation with `python -m compileall apps\agent`.
- Verified a one-shot local agent run returns `wireGuardInterfaces: []` cleanly when `wg` is not installed on the Windows dev machine.
- Verified `0.19.0` with `npm.cmd run version:check`.
- Verified backend/dashboard/shared TypeScript checks with `npm.cmd run typecheck --workspaces --if-present`.
- Verified production build with `npm.cmd run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm.cmd run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified the Settings WireGuard candidate merge with `npm.cmd run typecheck --workspaces --if-present`.
- Verified `0.20.0` with `npm.cmd run version:check`.
- Verified production build with `npm.cmd run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm.cmd run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified the ping/jitter/packet-loss agent path with `python -m compileall apps\agent`.
- Verified a one-shot local agent run with `AFROGATE_PING_TARGETS=127.0.0.1` returns populated `pingMs`, `jitterMs`, and `packetLossPercent` values without sending data to the backend.
- Verified `0.21.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.

## 2026-05-26

### Completed

- Added opt-in agent protocol-aware route probes for TCP connect, UDP response, QUIC-labeled UDP response, and DNS lookup targets.
- Added route-probe settings through `AFROGATE_TCP_PROBE_TARGETS`, `AFROGATE_UDP_PROBE_TARGETS`, `AFROGATE_QUIC_PROBE_TARGETS`, `AFROGATE_DNS_PROBE_TARGETS`, `AFROGATE_ROUTE_PROBE_COUNT`, and `AFROGATE_ROUTE_PROBE_TIMEOUT_SECONDS`.
- Added shared/backend `routeProbes` contracts, metrics ingest validation, latest-metrics mapping, admin server metric mapping, and health-score penalties for degraded route-probe status.
- Surfaced route-probe health in the dashboard Server Monitoring tab with typed English/Persian labels.
- Documented the route-probe local development and synthetic-target rules.
- Marked the initial protocol-aware route probe foundation complete while keeping full QUIC/HTTP3 handshake/request probing and backend protocol-aware route scoring pending.
- Bumped AfroGate to `0.22.0` for the protocol-aware route-probe foundation.
- Added backend advisory route scoring for Settings WireGuard candidates across balanced, stability, throughput, TCP, UDP, QUIC, DNS, and WireGuard profiles.
- Kept Settings candidate scoring privacy-safe by using managed outbound health, latest synthetic route probes, server health, load, and WireGuard telemetry without inspecting user traffic or applying routes automatically.
- Marked backend protocol-aware route scoring for low-speed/high-speed and traffic-profile decisions complete while leaving route apply, cooldown, hysteresis, and decision audit work pending.
- Bumped AfroGate to `0.23.0` for the advisory protocol-aware route scoring capability.
- Captured the next route-intelligence direction: historical quality analytics by time window, operator, outbound, and protocol profile, with predictive suggestions before known bad windows.
- Added future work for transparent route switching that preserves user experience through sticky assignments, route locks, cooldown, hysteresis, drain-safe apply behavior, and audit reasons.
- Added a guarded read-only route-quality analytics endpoint at `/api/admin/route-quality/analytics` that groups historical synthetic route probes by server, protocol, and hour-of-day.
- Added shared route-quality analytics contracts and a Settings page Route Intelligence panel with best/degraded time-window recommendations.
- Marked the initial advisory route-quality analytics slice complete while keeping operator/outbound/day-of-week reports, proactive recommendations, and automatic transparent switching pending.
- Bumped AfroGate to `0.24.0` for the initial route-quality analytics and recommendation capability.
- Added PostgreSQL migration `0007_route_quality_hourly.sql` for compact hourly route-quality summaries.
- Added `RouteQualityAggregationService` to keep hourly summaries fresh from recent synthetic route probes, with configurable enable/interval/lookback environment values.
- Updated the route-quality analytics endpoint to prefer the compact hourly summary table and fall back to raw metrics when summaries are unavailable.
- Marked the initial hourly route-quality aggregation scheduler complete while keeping full outbound/operator/profile aggregation pending.
- Bumped AfroGate to `0.25.0` for the hourly route-quality aggregation foundation.
- Added migration `0008_route_quality_dimensions.sql` to expand hourly route-quality summaries by outbound, operator, protocol score profile, day-of-week, and hour.
- Added optional non-secret route-probe metadata in the agent/backend contracts so synthetic probes can identify route group, outbound, operator, and score profile without inspecting user traffic.
- Added predictive read-only route recommendations for upcoming historically degraded windows and surfaced operator/profile context in the Settings Route Intelligence panel.
- Marked route-quality aggregation by server/outbound/operator/profile/time bucket, day-of-week analytics, and predictive advisory recommendations complete while keeping automatic transparent route switching pending.
- Recorded latency-sensitive/gaming routing direction: optimize stable latency, low jitter, low packet loss, route consistency, and congestion avoidance over raw bandwidth, with CPU-side analytics as the MVP default rather than GPU dependency.
- Bumped AfroGate to `0.26.0` for dimensioned route intelligence and predictive advisory recommendations.
- Added a first-class advisory `gaming` route score profile for latency-sensitive users, with stricter packet-loss, jitter, latency, load, and tunnel-freshness penalties.
- Extended backend route settings, metrics probe metadata validation, shared profile-score contracts, and Settings UI profile selection to understand the `gaming` profile.
- Added `gaming` rows to route-quality profile expansion so hourly analytics and future recommendations can compare latency-sensitive windows without inspecting user traffic.
- Marked the latency-sensitive/gaming route profile checklist item complete while keeping automatic transparent route switching, route locks, cooldown, hysteresis, and drain-safe apply behavior pending.
- Bumped AfroGate to `0.27.0` for the advisory gaming route profile capability.
- Added route decision foundation tables for assignments and future decision events.
- Added a read-only `/api/admin/route-decisions/preview` endpoint that evaluates current route, recommended route, route lock, cooldown, hysteresis, score profile, and reason codes without applying route changes.
- Added a Settings Decision Preview panel with typed English/Persian labels so admins can see what AfroGate would do before an audited switch engine exists.
- Marked the route assignment model and read-only route decision preview checklist items complete while keeping auto-route toggles, route-lock controls, live transparent switching, and decision event writes pending.
- Bumped AfroGate to `0.28.0` for the route decision preview foundation.
- Added guarded route assignment read/update APIs for the default assignment.
- Persisted auto-route, route lock, current managed outbound, locked managed outbound, hysteresis score delta, and cooldown seconds with audit metadata but no live route apply.
- Added Settings controls for those assignment policies and refreshed the decision preview after saving.
- Marked auto-route toggle, route lock toggle, manual route override, and hysteresis/cooldown controls complete while keeping transparent switching and persisted decision-event writes pending.
- Bumped AfroGate to `0.29.0` for persisted route assignment controls.
- Added guarded APIs to list recent route decision events and record the current preview as an advisory decision event.
- Stored advisory decision events with action, score profile, current/recommended managed outbounds, score delta, hysteresis, cooldown, lock state, reason codes, and non-secret preview context while keeping `applied_at` null.
- Updated the Settings Decision Preview panel with a record action and recent decision-event history.
- Marked route decision audit reasons complete while keeping live transparent route apply and drain-safe switching pending.
- Bumped AfroGate to `0.30.0` for advisory route decision event logging.
- Added candidate-review rows to the advisory route decision preview response, including dispositions, score deltas from the current route, rejection/recommendation reasons, and compact score-penalty details.
- Surfaced candidate review details in the Settings Decision Preview panel with typed English/Persian labels.
- Marked candidate recommendation/rejection detail review complete while keeping live transparent route apply and drain-safe switching pending.
- Bumped AfroGate to `0.31.0` for candidate recommendation/rejection explanations in the advisory route decision preview.
- Added guarded `POST /api/admin/route-decisions/apply-preview` for assignment-only route decision apply.
- Enforced the apply boundary through the existing preview: only `switchRecommended` managed outbound decisions can update saved assignment state, set cooldown, and write an `assignment_apply` event.
- Kept live server/data-plane routing disabled by returning and recording `dataPlaneApplied = false`.
- Added a Settings Decision Preview action to apply the recommended route to saved assignment state with English/Persian labels.
- Bumped AfroGate to `0.32.0` for the assignment-only route decision apply boundary.
- Added a structured route apply plan to decision preview responses with guard, assignment, drain, switch, verify, and rollback steps.
- Surfaced the apply plan in the Settings Decision Preview panel, including whether steps are control-plane-only or future data-plane mutations.
- Bumped AfroGate to `0.33.0` for the route apply plan foundation.
- Added route apply adapter readiness metadata to preview apply plans for the future WireGuard policy-routing adapter.
- Added disabled-by-default `AFROGATE_ROUTE_DATA_PLANE_APPLY_ENABLED=false` configuration and surfaced the adapter/feature-flag state in Settings.
- Kept adapter implementation marked missing and `dataPlaneReady=false` until the real server-side apply adapter is audited.
- Bumped AfroGate to `0.34.0` for the route apply adapter readiness layer.
- Added secret-safe dry-run command strings and config-change previews to the future WireGuard policy-routing adapter metadata.
- Surfaced dry-run commands in the Settings apply plan without executing any OS command or exposing tunnel secrets.
- Bumped AfroGate to `0.35.0` for the dry-run WireGuard apply preview.
- Added normalized `dryRunSnapshot` persistence to route decision event context for both advisory preview records and assignment-only apply events.
- Added dry-run command/config counts to route decision audit payloads.
- Bumped AfroGate to `0.36.0` for persisted dry-run apply snapshots in route decision events.
- Added guarded route decision event detail reads at `/api/admin/route-decisions/events/:id` so read-role admins can inspect stored decision context on demand.
- Added a Settings recent-decision inspector that fetches a stored event detail and renders the normalized dry-run snapshot, adapter status, command/config counts, and secret-safe command/config previews.
- Kept the list endpoint compact by leaving large `decision_context` payloads out of recent-event summaries.
- Bumped AfroGate to `0.37.0` for route decision event detail inspection.
- Added optional loaded-latency fields to route-probe contracts and backend ingest validation.
- Added backend bufferbloat assessment for route candidates, including loaded-latency delta, severity, SQM/AQM recommendation, and avoid-under-load guidance.
- Penalized route health and profile scores when loaded latency rises, with stronger impact on stability/gaming profiles and decision-review reason labels.
- Surfaced loaded-latency guidance in Settings route candidate and decision review panels with English/Persian labels.
- Bumped AfroGate to `0.38.0` for loaded-latency and bufferbloat-aware route guidance.
- Added advisory smart-route profile recommendations to route decision previews across balanced, stability, throughput, gaming, TCP, UDP, QUIC, DNS, and WireGuard profiles.
- Compared usable managed candidates by existing privacy-safe per-profile scores, including score delta from the currently selected profile and the best candidate for each profile.
- Surfaced smart-route profile recommendations in the Settings decision preview with typed English/Persian labels.
- Bumped AfroGate to `0.39.0` for advisory smart-route profile recommendations.
- Added explicit health-based switch reasons to route decision previews when the current managed route is unhealthy and a healthy managed candidate exists.
- Let assignment-only apply and apply-plan guards bypass score-delta hysteresis for health-based switches while still respecting route lock, manual mode, cooldown, and managed-candidate checks.
- Surfaced current-route-unhealthy and health-based-switch reason labels in English/Persian Settings UI.
- Bumped AfroGate to `0.40.0` for explicit health-based route decisions.
- Added advisory smart-load-balancing summaries to route decision previews with primary, secondary, standby, weight, adjusted-score, and risk guidance.
- Weighted managed candidates by selected route profile plus health, packet loss, jitter, latency, throughput/load, loaded-latency, and high-security/route-consistency constraints while keeping data-plane routing disabled.
- Surfaced the smart-load-balancing panel in Settings with typed English/Persian labels.
- Bumped AfroGate to `0.41.0` for advisory smart load balancing.
- Added gaming-safe session-safety summaries to route decision previews so future data-plane switching can distinguish safe switches, sticky holds, new-session-only drains, and emergency health switches.
- Wired session-safety drain timing into the apply-plan estimate while keeping real data-plane movement disabled.
- Surfaced the session-safety panel in Settings with typed English/Persian labels for sticky TTL, drain wait, new-session-only movement, emergency permission, and disconnect risk.
- Bumped AfroGate to `0.42.0` for gaming-safe session-safety route decision guidance.
- Added transparent switch-engine planning summaries to route decision previews with guard, session pinning, new-session routing, drain, switch, verify, and rollback stages.
- Surfaced switch-engine readiness in Settings with planning-only/data-plane-ready status, session impact, step state, and rollback indicators in English/Persian.
- Kept every data-plane mutation step future/planning-only while the server apply adapter remains disabled or missing.
- Bumped AfroGate to `0.43.0` for transparent switch-engine planning.
- Added switch-execution summaries to assignment-only route apply events so applied decisions record control-plane assignment, sticky-session deadlines, drain deadlines, cooldown deadlines, rollback readiness, and future data-plane steps.
- Surfaced switch-execution results in Settings and decision event detail with typed English/Persian labels.
- Kept switch execution data-plane state blocked/not-applied until the audited apply adapter exists.
- Bumped AfroGate to `0.44.0` for assignment-only switch execution audit state.
- Added switch-preflight readiness summaries to route decision previews so future data-plane switching is gated by feature-flag, apply-adapter, dry-run, guard, session-safety, rollback, cooldown, audit, and health-verification checks.
- Persisted switch-preflight context in route decision event detail and surfaced it in Settings with typed English/Persian labels.
- Kept preflight `canExecuteDataPlane=false` while the feature flag is off or the audited server apply adapter is missing.
- Bumped AfroGate to `0.45.0` for switch preflight/readiness gating.
- Added advisory switch-rollout plans to route decision previews with pinned existing sessions, new-session canary percentages, route-consistency holds, health verification, rollback thresholds, and future expansion steps.
- Persisted switch-rollout context in route decision event detail for audit.
- Surfaced the switch-rollout plan in Settings with typed English/Persian labels while keeping all data-plane movement planning-only until the audited adapter exists.
- Bumped AfroGate to `0.46.0` for advisory switch-rollout/canary planning.
- Added advisory switch-rollout health evaluation to route decision previews so canary candidates are checked against packet-loss, jitter, latency, and score guards.
- Persisted switch-rollout evaluation context in route decision event detail for audit.
- Surfaced canary guard pass/hold/rollback guidance in Settings with typed English/Persian labels while keeping traffic movement planning-only.
- Bumped AfroGate to `0.47.0` for advisory switch-rollout health evaluation.
- Added a session-safe switch orchestration summary to route decision previews so route lock, manual mode, cooldown, preflight, rollout, canary guard, sticky sessions, route-consistency hold, and rollback state resolve into one audited next action.
- Persisted switch orchestration context in route decision event detail for audit.
- Surfaced the switch orchestrator in Settings with typed English/Persian labels for assignment-only, hold, canary, expand, rollback, manual review, active-session protection, and stage state.
- Bumped AfroGate to `0.48.0` for transparent switch orchestration.
- Added secret-safe protocol server apply plan summaries for saved WireGuard, VLESS, L2TP, and IKEv2 setup drafts, including readiness status, future command previews, config-change counts, and blocker reason codes.
- Returned protocol apply readiness from Settings provisioning responses while preserving disabled server OS/service mutation until an audited adapter and server access target exist.
- Surfaced the protocol apply plan in Settings with typed English/Persian labels for planning, dry-run, blocked, apply-ready, target, command, and config-change state.
- Bumped AfroGate to `0.49.0` for protocol server apply readiness planning.
- Added target-server selection to Settings protocol drafts so provisioning can bind generated managed outbounds to a selected managed server.
- Added `protocol_setups.target_server_id` persistence plus backend response fields for target labels and server-access readiness.
- Updated protocol server apply plans to distinguish missing target servers from missing access profiles while keeping server OS/service mutation disabled.
- Bumped AfroGate to `0.50.0` for target-server protocol provisioning readiness.
- Added `protocol_apply_events` storage and a guarded admin API for recording secret-safe protocol server apply dry-run snapshots.
- Persisted provisioned protocol apply plan state, target server, outbound id, command/config counts, blocker reasons, and audit metadata without executing SSH, shell commands, secret decrypts, service reloads, or OS route changes.
- Surfaced a Settings action to record dry-run protocol apply snapshots in English/Persian for provisioned protocol drafts.
- Bumped AfroGate to `0.51.0` for audited protocol server apply dry-run recording.
- Added read-role admin APIs for listing compact protocol server apply dry-run events and fetching full stored snapshot detail on demand.
- Surfaced a Settings protocol apply audit panel with English/Persian labels, compact recent event cards, last-event linkage per setup, and secret-safe command/config snapshot inspection.
- Kept recent protocol apply event lists lightweight while preserving full dry-run snapshots only in detail responses; no SSH, shell, secret decrypt, service reload, OS route, or outbound enablement is executed.
- Bumped AfroGate to `0.52.0` for protocol apply event inspection.

### Verification

- Verified the route-probe agent changes with `python -m compileall apps\agent`.
- Verified a one-shot local agent run with `AFROGATE_DNS_PROBE_TARGETS=localhost` returns a healthy `routeProbes` DNS row without sending data to the backend.
- Verified `0.22.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified the route-quality aggregation scheduler wiring with `npm run typecheck --workspaces --if-present`.
- Verified the advisory route scoring contracts with `npm run typecheck --workspaces --if-present`.
- Verified `0.23.0` with `npm run version:check`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- No new code verification was required for the route-intelligence planning note.
- Verified the route-quality analytics API and dashboard contracts with `npm run typecheck --workspaces --if-present`.
- Verified `0.24.0` with `npm run version:check`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified `0.25.0` with `npm run version:check`.
- Applied PostgreSQL migrations through `0007_route_quality_hourly.sql` with `npm --workspace @afrogate/backend run db:migrate`.
- Verified route-quality aggregation type safety with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified `0.26.0` with `npm run version:check`.
- Applied PostgreSQL migrations through `0008_route_quality_dimensions.sql` with `npm --workspace @afrogate/backend run db:migrate`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified Python agent compilation with `python -m compileall apps\agent`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified `0.27.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Applied PostgreSQL migrations through `0009_route_decision_foundation.sql` with `npm --workspace @afrogate/backend run db:migrate`.
- Verified `0.28.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified `0.29.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified `0.30.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified `0.31.0` with `npm run version:check`.
- Verified candidate-review contracts and dashboard rendering with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified the assignment-only apply contract and Settings UI with `npm run typecheck --workspaces --if-present`.
- Verified `0.32.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified the route apply plan contracts and Settings rendering with `npm run typecheck --workspaces --if-present`.
- Verified `0.33.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified adapter-readiness contracts and Settings rendering with `npm run typecheck --workspaces --if-present`.
- Verified `0.34.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified dry-run adapter contracts and Settings command rendering with `npm run typecheck --workspaces --if-present`.
- Verified `0.35.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified dry-run snapshot persistence typing with `npm run typecheck --workspaces --if-present`.
- Verified `0.36.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified route decision event detail contracts and Settings inspector rendering with `npm run typecheck --workspaces --if-present`.
- Verified `0.37.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified loaded-latency/bufferbloat contracts and Settings rendering with `npm run typecheck --workspaces --if-present`.
- Verified `0.38.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified smart-route profile recommendation contracts and Settings rendering with `npm run typecheck --workspaces --if-present`.
- Verified `0.39.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified health-based route decision behavior and Settings labels with `npm run typecheck --workspaces --if-present`.
- Verified `0.40.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified smart-load-balancing preview contracts and Settings rendering with `npm run typecheck --workspaces --if-present`.
- Verified `0.41.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified gaming-safe session-safety preview contracts and Settings rendering with `npm run typecheck --workspaces --if-present`.
- Verified `0.42.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified transparent switch-engine planning contracts and Settings rendering with `npm run typecheck --workspaces --if-present`.
- Verified `0.43.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified switch-execution response/event-detail contracts and Settings rendering with `npm run typecheck --workspaces --if-present`.
- Verified `0.44.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified switch-preflight contracts and Settings rendering with `npm run typecheck --workspaces --if-present`.
- Verified `0.45.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified switch-rollout contracts and Settings rendering with `npm run typecheck --workspaces --if-present`.
- Verified `0.46.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified switch-rollout health evaluation contracts and Settings rendering with `npm run typecheck --workspaces --if-present`.
- Verified `0.47.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified switch-orchestration contracts and Settings rendering with `npm run typecheck --workspaces --if-present`.
- Verified `0.48.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified protocol server apply plan contracts and Settings rendering with `npm run typecheck --workspaces --if-present`.
- Verified `0.49.0` with `npm run version:check`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Applied PostgreSQL migrations through `0010_protocol_target_server.sql` with `npm --workspace @afrogate/backend run db:migrate`.
- Verified `0.50.0` with `npm run version:check`.
- Verified target-server provisioning contracts and Settings rendering with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.

- Added guarded read-only backup status monitoring at `GET /api/admin/backups/status` with environment-driven freshness, encryption, retention, artifact, destination-label, and restore-test readiness.
- Added `BackupStatusService` for sanitized external backup-status JSON ingestion without returning status file paths, decrypted data, object-store credentials, raw dumps, or restore execution controls.
- Added the dashboard Backups page, role-aware sidebar item, NOC backup badge, English/Persian labels, and browser coverage for healthy monitored backup readiness.
- Updated `.env.example`, architecture, repository, security/performance, memory, dashboard checklist, and main checklist for the read-only backup monitoring boundary.
- Bumped AfroGate to `0.83.0` for the guarded backup status API and dashboard page.
- Checklist completion after this slice is `211 / 229` items, or `92.1%` complete with `7.9%` remaining.
- Verified version alignment with `npm run version:check`.
- Verified repository secret hygiene with `npm run secrets:check`.
- Verified dashboard contrast with `npm run contrast:check`.
- Verified workspace typecheck and production build with `npm run typecheck` and `npm run build`.
- Verified dashboard/client browser coverage with `npm run test:e2e`; 10 tests passed including the new Backups flow.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added outbound `usage_multiplier` from `1x` to `100x` with migration `0021_outbound_usage_multiplier_subscription.sql`.
- Rated client usage events can now reference an outbound id, preserve raw observed bytes, store the applied multiplier, and charge the multiplied byte delta to account/client quota without double-counting idempotent events.
- Added client subscription refresh metadata at `GET /api/client/subscription` so client apps can refresh safe public endpoint addresses after a VPS address change without exposing raw outbound config, private keys, client tokens, or generated secret-bearing config links.
- Extended route options and the VPN client app to show route charge multipliers and usable remaining data on high-cost paths.
- Updated shared contracts, backend DTOs/schema, client/dashboard labels, architecture/security docs, memory, roadmap, and checklist for subscription refresh and expensive-route billing.
- Bumped AfroGate to `0.84.0` for the route usage multiplier and client subscription refresh foundation.
- Checklist completion after this slice is `213 / 232` items, or `91.8%` complete with `8.2%` remaining.
- Verified the migration stack with `npm --workspace @afrogate/backend run db:migrate`.
- Verified version alignment with `npm run version:check`.
- Verified repository secret hygiene with `npm run secrets:check`.
- Verified dashboard contrast with `npm run contrast:check`.
- Verified workspace typecheck and production build with `npm run typecheck` and `npm run build`.
- Verified dashboard/client browser coverage with `npm run test:e2e`; 10 tests passed.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.

- Added protocol-specific client subscription config readiness descriptors to `GET /api/client/subscription`.
- The subscription response now includes `configLinks` for WireGuard, VLESS, L2TP, and IKEv2, with render status, safe public endpoint/profile metadata, usage multiplier labels, and missing-field/warning codes.
- Kept secret-bearing config generation blocked: the backend does not return private keys, client UUIDs, PSKs, passwords, certificates, raw outbound config JSON, or connectable generated links.
- Surfaced subscription config readiness in the VPN client app with English/Persian labels for config-link count, format, missing endpoint state, unsupported protocol state, and required client secret state.
- Updated architecture, security, repository, roadmap, multilingual, memory, checklist, changelog, and version docs for the secret-safe subscription renderer boundary.
- Bumped AfroGate to `0.85.0` for the client subscription config readiness contract.
- Checklist completion after this slice is `214 / 233` items, or `91.8%` complete with `8.2%` remaining.
- Verified focused shared, backend, and client typing with `npm run typecheck --workspace @afrogate/shared`, `npm run typecheck --workspace @afrogate/backend`, and `npm run typecheck --workspace @afrogate/client`.
- Verified version alignment with `npm run version:check`.
- Verified repository secret hygiene with `npm run secrets:check`.
- Verified workspace typecheck and production build with `npm run typecheck` and `npm run build`.
- Verified dashboard contrast with `npm run contrast:check`.
- Verified fixed-port dashboard/client browser coverage with `npm run test:e2e`; 10 tests passed.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added the secret-backed per-client subscription config renderer foundation with migration `0022_client_subscription_credentials.sql`.
- Admins can now store, list, and revoke encrypted client-owned subscription credential material for WireGuard, VLESS, L2TP, and IKEv2 through guarded admin APIs; responses return metadata only and audit store/revoke actions.
- `/api/client/subscription` now renders connectable output only when the authenticated client has an active encrypted credential for that outbound/protocol and the outbound publishes explicit public endpoint metadata.
- Rendered client outputs support VLESS URIs plus WireGuard/L2TP/IKEv2 profile text, while invalid or unavailable credentials surface explicit blocked render states instead of leaking secrets.
- The VPN client app now shows rendered private config readiness and a copy action through typed English/Persian labels without exposing admin/server secrets or raw outbound config JSON.
- Updated checklist and memory for the completed encrypted per-client renderer boundary.
- Bumped AfroGate to `0.86.0` for the encrypted per-client subscription renderer schema/API/client capability.
- Added future Telegram bot setup work to the checklist: superadmin Settings should guide BotFather token entry, encrypted/write-only token storage, webhook secret, allowed chat/admin IDs, and Telegram API connection tests.
- Checklist completion after adding the Telegram bot setup follow-up is `215 / 235` items, or `91.5%` complete with `8.5%` remaining.
- Remaining: continue Phase 4 panel import/sync work for Marzban/X-UI/current panel users, usage, charge/update, and import/export flows.

- Verified protocol server apply dry-run event contracts and Settings rendering with `npm run typecheck --workspaces --if-present`.
- Applied PostgreSQL migrations through `0011_protocol_apply_events.sql` with `npm --workspace @afrogate/backend run db:migrate`.
- Verified `0.51.0` with `npm run version:check`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Verified protocol apply event list/detail contracts and Settings inspector rendering with `npm run typecheck --workspaces --if-present`.
- Verified `0.52.0` with `npm run version:check`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added protocol server apply preflight readiness gates for the feature flag, audited adapter, dry-run safety, provisioned outbound, outbound health, default disabled/maintenance posture, secret reference, server access, rollback, audit, and health verification.
- Persisted protocol apply preflight summaries in plan responses, dry-run snapshots, and audit payloads while keeping live server mutation blocked until every data-plane gate passes.
- Surfaced protocol apply preflight state in Settings plan cards and stored dry-run snapshot inspection with typed English/Persian labels.
- Updated protocol apply docs, checklist, memory, and dashboard coverage checklist to keep the production server-side apply engine as the next unfinished milestone.
- Bumped AfroGate to `0.53.0` for protocol server apply preflight gating.
- Verified `0.53.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added a superadmin-only live protocol apply request boundary at `/api/admin/settings/protocol-setups/:id/server-apply/live-request`.
- Live protocol apply requests now persist blocked `protocol_apply_events` snapshots with `applyMode=live`, preflight context, blocked reason codes, and `dataPlaneMutationExecuted=false` without SSH, shell execution, service reload, OS route mutation, secret decrypt, or outbound enablement.
- Surfaced a Settings live-apply request action and apply-mode labels in English/Persian while preserving the disabled production server-side apply engine boundary.
- Updated protocol apply docs, memory, checklist, and dashboard checklist for the non-mutating live request boundary.
- Bumped AfroGate to `0.54.0` for the live protocol apply request workflow.
- Verified `0.54.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added protocol server apply adapter metadata to plans and stored snapshots, including supported protocols, adapter status, dry-run support, command-runner mode, and data-plane readiness.
- Added a server-access credential boundary for protocol server apply that checks installed access profiles and active `server_credentials` records without decrypting credentials or executing commands.
- Extended preflight with server-credential and command-runner gates so live mutation remains blocked while the command runner is dry-run-only and credential decrypt is disabled.
- Surfaced the protocol apply adapter, dry-run-only runner, access profile, credential record, and credential-decrypt boundary in Settings with typed English/Persian labels.
- Updated protocol apply docs, memory, checklist, dashboard checklist, and security/performance policy for the adapter scaffold.
- Bumped AfroGate to `0.55.0` for protocol apply adapter scaffolding.
- Verified `0.55.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added guarded write-only server credential storage at `/api/admin/servers/:id/credentials`; credentials are encrypted with `AFROGATE_SECRETS_KEY`, stored in `server_credentials`, linked to the server access profile, and returned only as metadata.
- Updated access-profile saving so existing credential links are preserved unless explicitly changed, preventing profile edits from silently unlinking the active credential.
- Added Servers page Access-tab forms for access-profile metadata and write-only credential replacement with typed English/Persian labels.
- Updated protocol/server access docs, memory, and checklist to mark encrypted server credential storage complete while keeping credential decrypt, SSH execution, service reloads, OS route mutation, and outbound enablement blocked until the audited production apply engine exists.
- Bumped AfroGate to `0.56.0` for encrypted server credential storage and access-profile editing.
- Verified `0.56.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added PostgreSQL migration `0012_tunnels_interfaces.sql` plus Drizzle schema for `server_interfaces` and `tunnels`.
- Added guarded admin CRUD APIs for server interfaces and tunnels, including audit log entries and ownership checks so linked interfaces cannot silently cross servers.
- Added shared TypeScript contracts for interface/tunnel summaries and list responses.
- Bound the dashboard tunnel panel to `/api/admin/tunnels` rows with localized empty states and sample fallback when the tunnel API is unavailable.
- Updated docs, checklist, memory, and dashboard coverage notes to mark tunnel/interface CRUD complete while keeping this slice inventory-only and non-mutating.
- Bumped AfroGate to `0.57.0` for tunnel/interface inventory management.
- Applied PostgreSQL migrations through `0012_tunnels_interfaces.sql` with `npm --workspace @afrogate/backend run db:migrate`.
- Verified `0.57.0` with `npm run version:check`.
- Verified tunnel/interface contracts and dashboard rendering with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added Routes page default route assignment controls for auto-route, route lock, current/locked managed outbound, hysteresis delta, and cooldown seconds.
- Bound the Routes page route policy panel to guarded route-assignment APIs with read visibility for signed-in route readers and write controls limited to admin/owner/superadmin roles.
- Added localized English/Persian empty-state copy for missing managed outbounds and updated the dashboard sidebar checklist for the completed Routes page controls.
- Kept this slice control-plane-only: no server OS route changes, tunnel service reloads, credential decrypts, or live user traffic switching are performed.
- Bumped AfroGate to `0.58.0` for Routes page route assignment controls.
- Verified `0.58.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added an API-bound Server Detail surface that fetches `/api/admin/servers/:id` when an admin selects a managed node.
- Bound the Server Detail Interfaces tab to server-scoped `/api/admin/server-interfaces` and `/api/admin/tunnels` rows while keeping metric/WireGuard telemetry visible as live monitoring context.
- Added overview rows for access readiness, open alerts, managed outbounds, inventory counts, tags, and detail source with localized English/Persian labels.
- Kept this slice non-mutating: no credential decrypt, SSH connection, command execution, service reload, OS route mutation, or live traffic switching is performed.
- Updated checklist, dashboard page coverage notes, and memory to mark the Server detail page complete.
- Bumped AfroGate to `0.59.0` for the Server Detail workflow.
- Verified `0.59.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added a selected Tunnel Detail surface on the Routes page that loads guarded `/api/admin/tunnels/:id` detail for API-backed tunnel rows and falls back to list/sample context when detail is unavailable.
- Surfaced tunnel status, type, server, route group, local interface/operator, remote endpoint, lockability, route-quality metrics, health score, updated time, and detail source with localized English/Persian labels.
- Kept the tunnel detail workflow read-only and non-mutating: no credential decrypt, SSH access, service reload, OS route mutation, or live traffic switching is performed.
- Updated checklist, dashboard page coverage notes, memory, and changelog to mark the Tunnel detail page complete.
- Bumped AfroGate to `0.60.0` for the Tunnel Detail workflow.
- Verified `0.60.0` with `npm run version:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Remaining high-priority work includes the production server-side protocol apply engine, protocol-aware route probes, shared empty/loading/stale states, alert filters/history, Ubuntu deployment notes, Docker Compose, and basic CI checks.
- Added GitHub Actions CI at `.github/workflows/ci.yml` for pushes to `main`, pull requests, and manual dispatch.
- CI now runs `npm ci`, `npm run version:check`, `npm run secrets:check`, workspace typecheck/build, Playwright dashboard smoke tests with CI-installed Chromium, and `npm audit --audit-level=moderate`.
- Added `scripts/check-secrets.mjs` and root `npm run secrets:check` to scan repository files for high-confidence private-key/token patterns and sensitive secret filenames, including untracked non-ignored files during local runs.
- Updated Playwright config so local checks continue using installed Microsoft Edge while CI uses Chromium after installation.
- Updated checklist and memory to mark basic CI, dependency audit in CI, and secret scan in CI complete.
- Bumped AfroGate to `0.61.0` for the CI and secret-scan workflow.
- Verified `0.61.0` with `npm run version:check`.
- Verified secret scanning with `npm run secrets:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Remaining high-priority work includes the production server-side protocol apply engine, protocol-aware route probes, shared empty/loading/stale states, alert filters/history, Ubuntu deployment notes, and Docker Compose.
- Expanded `infra/ubuntu/README.md` into a native deployment runbook covering host layout, local/private PostgreSQL, secret-safe env files, build commands, migrations, backend systemd, Nginx, firewall, optional agent service, update flow, rollback, and production gaps.
- Hardened the backend systemd sample around `/etc/afrogate/afrogate.env`, dedicated service state/log directories, localhost binding, and low-privilege runtime settings.
- Updated the Nginx sample for HTTP-to-HTTPS redirect, TLS placeholders, static dashboard hosting, `/api` proxying to `127.0.0.1:7000`, login/API rate limits, security headers, and static asset caching.
- Added backend and agent environment samples plus an optional agent systemd sample without committing real secrets.
- Updated checklist and memory to mark Ubuntu deployment notes with systemd and Nginx complete.
- Bumped AfroGate to `0.61.1` for the Ubuntu deployment documentation and samples.
- Verified `0.61.1` with `npm run version:check`.
- Verified placeholder env safety with `npm run secrets:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Remaining high-priority work includes the production server-side protocol apply engine, protocol-aware route probes, shared empty/loading/stale states, and alert filters/history.
- Added optional Docker Compose deployment samples for private PostgreSQL, private backend, and a static dashboard/Nginx web edge.
- Added backend and dashboard Dockerfiles, a container Nginx proxy config, a local Compose env template, and `.dockerignore` rules so reproducible builds avoid local secrets and build artifacts.
- Updated checklist, memory, and repository-structure docs to mark Docker Compose as optional and complete while keeping the native Ubuntu path primary.
- Bumped AfroGate to `0.61.2` for the optional Docker Compose deployment samples.
- Verified `0.61.2` with `npm run version:check`.
- Verified placeholder env safety with `npm run secrets:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Docker Compose config/build was not run because the Docker CLI is not installed in this workspace.
- Remaining high-priority work includes the production server-side protocol apply engine, protocol-aware route probes, shared empty/loading/stale states, and alert filters/history.
- Extended the Python agent protocol-aware route probes so TCP, UDP, QUIC-labeled UDP, and DNS samples use protocol-specific degraded/critical thresholds.
- Added derived `wireguard` route-probe rows from local WireGuard telemetry, using interface status, active peer count, and handshake freshness without exposing raw keys.
- Updated agent environment docs, local development notes, repository structure, checklist, and memory for the complete TCP/UDP/QUIC/DNS/WireGuard route-probe coverage.
- Bumped AfroGate to `0.62.0` for the completed protocol-aware agent route-probe capability.
- Verified `0.62.0` with `npm run version:check`.
- Verified placeholder/env safety with `npm run secrets:check`.
- Verified Python agent compilation with `python -m compileall apps\agent`.
- Verified no-config agent collection with `python apps\agent\run.py --once`.
- Verified configured TCP/DNS route-probe payload shape with a local agent dry run.
- Verified derived WireGuard route-probe payload shape with fake non-secret interface telemetry.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Remaining high-priority work includes the production server-side protocol apply engine, alert filters/history, dense monitoring tooltips, color-contrast review, and visual regression captures.
- Added a shared dashboard panel-state primitive for empty, loading, stale, fallback, and error states with typed English/Persian copy.
- Wired the shared states through the Dashboard, Servers, Routes, Alerts, Users, and Settings-adjacent operational panels so stale/fallback/sample data is visibly labeled instead of silently mixing with live rows.
- Updated the user-management panel to use the same loading/error/empty state surface and kept all user-facing copy in the multilingual layer.
- Updated checklist, dashboard sidebar page checklist, and memory to mark shared empty/loading/stale/error states complete.
- Bumped AfroGate to `0.62.1` for the shared dashboard panel-state UI refinement.
- Verified `0.62.1` with `npm run version:check`.
- Verified placeholder/env safety with `npm run secrets:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Improved the Dashboard system resource strip density for mobile and tablet layouts with two-column compact resource cards, earlier tablet columns, truncated metric labels/values, hover titles, and a one-row internal storage scroller.
- Updated checklist and memory to mark the mobile/tablet resource strip density pass complete.
- Bumped AfroGate to `0.62.2` for the mobile/tablet resource strip density refinement.
- Verified `0.62.2` with `npm run version:check`.
- Verified placeholder/env safety with `npm run secrets:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added reusable hover tooltip/accessibility coverage for dense Dashboard monitoring UI: compact metric cards, resource/storage cards, status badges, detail rows, route decision metrics, chart range controls, panel headings, and primitive table cells now expose localized labels and formatted values without new hardcoded English copy.
- Updated checklist and memory to mark the dense monitoring tooltip pass complete and preserve the localized-tooltip convention.
- Bumped AfroGate to `0.62.3` for the dashboard tooltip refinement.
- Verified `0.62.3` with `npm run version:check`.
- Verified placeholder/env safety with `npm run secrets:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added `npm run contrast:check` to validate dashboard warning/critical contrast for dark sidebar alert nav/count states and light status badges against AA text thresholds.
- Wired the dashboard contrast check into CI after secret scanning so future alert color changes are reviewed automatically.
- Updated checklist and memory to mark the warning/critical color-contrast review complete.
- Bumped AfroGate to `0.62.4` for the dashboard contrast guard.
- Verified `0.62.4` with `npm run version:check`.
- Verified placeholder/env safety with `npm run secrets:check`.
- Verified dashboard contrast locally with `npm run contrast:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke test with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added signed-in dense dashboard visual capture coverage in Playwright for mobile, tablet, desktop, and second-LCD viewports using mocked admin, metrics, alert, outbound, tunnel, and failover APIs.
- The visual capture tests attach PNG screenshots to the Playwright report and keep the horizontal-overflow guard active for each dense layout viewport.
- Updated checklist, memory, and repository structure docs to mark dense dashboard screenshot capture coverage complete.
- Bumped AfroGate to `0.62.5` for the dashboard visual capture tests.
- Verified `0.62.5` with `npm run version:check`.
- Verified placeholder/env safety with `npm run secrets:check`.
- Verified dashboard contrast with `npm run contrast:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified the desktop visual capture path with `npm run test:e2e -- --grep "desktop dashboard capture"`.
- Verified the full fixed-port dashboard smoke and visual capture suite with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added Alerts page filtering for open/resolved status, severity, and alert source while leaving dashboard/sidebar open-alert counts sourced from the existing unfiltered open-alert fetch.
- Added resolved alert history loading through the guarded admin alerts API and kept empty/loading/fallback states visible for history rows.
- Updated dashboard sidebar page checklist and memory to mark alert severity filters, source filters, and resolved alert history complete.
- Added Playwright coverage for switching the Alerts page to resolved history and filtering by severity/source.
- Bumped AfroGate to `0.63.0` for the Alerts page filters/history capability.
- Verified `0.63.0` with `npm run version:check`.
- Verified placeholder/env safety with `npm run secrets:check`.
- Verified dashboard contrast with `npm run contrast:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified the alert filter interaction path with `npm run test:e2e -- --grep "alerts page filters"`.
- Verified the full fixed-port dashboard smoke, visual capture, and alert filter suite with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Remaining high-priority work includes the production server-side protocol apply engine.
- Added a disabled-by-default credential-decrypt readiness gate to protocol server apply planning so active server credentials and decrypt permission are evaluated separately.
- Updated protocol apply preflight reason codes, env samples, deployment notes, memory, checklist, and server-access/security docs for `AFROGATE_PROTOCOL_SERVER_APPLY_CREDENTIAL_DECRYPT_ENABLED=false`.
- Kept live protocol mutation blocked: the protocol apply flag, live executor flag, credential decrypt flag, installed access profile, active credential, and audited adapter implementation are still all required before any future command runner can use decrypted material.
- Verified protocol apply credential-decrypt typing with `npm run typecheck --workspaces --if-present`.
- Bumped AfroGate to `0.63.1` for the protocol apply credential-decrypt readiness gate.
- Verified `0.63.1` with `npm run version:check`.
- Verified placeholder/env safety with `npm run secrets:check`.
- Verified dashboard contrast with `npm run contrast:check`.
- Verified workspace TypeScript checks with `npm run typecheck --workspaces --if-present`.
- Verified production build with `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke, visual capture, and alert filter suite with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Remaining high-priority work includes the production server-side protocol apply engine.
- Added a disabled-by-default protocol-secret decrypt readiness gate to protocol server apply planning so saved secret references and decrypt permission are evaluated separately.
- Exposed protocol apply secret reference and secret-decrypt readiness as separate translated Settings plan and audit snapshot badges.
- Tightened the server-credential decrypt readiness path so decrypt permission also requires an implemented/audited protocol apply adapter, not only feature flags and an active credential.
- Updated protocol apply preflight reason codes, env samples, deployment notes, memory, checklist, and server-access/security docs for `AFROGATE_PROTOCOL_SERVER_APPLY_SECRET_DECRYPT_ENABLED=false`.
- Verified protocol apply secret-decrypt typing with `npm run typecheck --workspaces --if-present`.
- Bumped AfroGate to `0.63.2` for the protocol apply secret-decrypt readiness gate.
- Verified version alignment with `npm run version:check`.
- Verified repository secret hygiene with `npm run secrets:check`.
- Verified dashboard contrast with `npm run contrast:check`.
- Verified workspace typecheck and production build with `npm run typecheck --workspaces --if-present` and `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke, dense visual capture, and alert filter coverage with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added admin-managed rewarded-ad settings for the mobile rewarded-data flow.
- Added shared contracts and guarded admin APIs at `GET /api/admin/rewarded-ads/settings` and `PATCH /api/admin/rewarded-ads/settings`.
- Admins can now adjust enabled state, reward bytes, UTC daily cap, provider key, and verification mode with bounded validation and audit logging.
- Documented rewarded-ad settings as non-secret policy; provider secrets and verified ad-network callback credentials remain out of these settings.
- Marked admin-managed rewarded-ad reward and daily cap settings complete in the checklist.
- Bumped AfroGate to `0.77.0` for the rewarded-ad admin settings API contract.
- Checklist completion after this slice is `203 / 226` items, or `89.8%` complete with `10.2%` remaining.
- Verified the migration stack with `npm --workspace @afrogate/backend run db:migrate`.
- Confirmed the running backend returns `401` for unauthenticated `/api/admin/rewarded-ads/settings`, proving the guarded admin route is registered.
- Verified focused shared/backend typing with `npm run typecheck --workspace @afrogate/shared` and `npm run typecheck --workspace @afrogate/backend`.
- Verified version alignment with `npm run version:check`.
- Verified repository secret hygiene with `npm run secrets:check`.
- Verified dashboard contrast with `npm run contrast:check`.
- Verified workspace typecheck and production build with `npm run typecheck --workspaces --if-present` and `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard/client browser coverage with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added the PayPal checkout/capture provider adapter.
- Added guarded admin APIs to create PayPal hosted checkout orders and capture approved PayPal orders from existing pending `payment_orders`.
- Added a public PayPal webhook endpoint that verifies PayPal signature headers through PayPal before updating any local payment order.
- PayPal events can now mark matching orders paid, failed, or refunded, while repeated capture-completed events stay idempotent for already-paid orders.
- PayPal credentials, webhook ID, API base URL, return/cancel URLs, and timeout are configured through `AFROGATE_PAYPAL_*` deployment environment values; provider secrets remain out of `payment_methods.public_config`.
- PayPal outbound calls use the shared proxy-aware backend outbound HTTP client so restricted deployments can reuse `AFROGATE_OUTBOUND_PROXY_URL`.
- Updated shared contracts, backend DTOs, architecture/security docs, checklist, and memory for the PayPal adapter.
- Marked PayPal checkout capture adapter and webhook verification complete in the checklist.
- Bumped AfroGate to `0.74.0` for the PayPal adapter API contract.
- Checklist completion after this slice is `199 / 222` items, or `89.6%` complete with `10.4%` remaining.
- Verified shared/backend typing with `npm run typecheck --workspace @afrogate/shared` and `npm run typecheck --workspace @afrogate/backend`.
- Verified version alignment with `npm run version:check`.
- Verified repository secret hygiene with `npm run secrets:check`.
- Verified workspace typecheck and production build with `npm run typecheck --workspaces --if-present` and `npm run build --workspaces --if-present`.
- Verified dashboard contrast with `npm run contrast:check`.
- Verified fixed-port dashboard/client browser coverage with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added paid payment-order quota allocation with the new `payment_order_allocations` ledger.
- Added guarded admin allocation API `POST /api/admin/payment-orders/:id/allocate`, allocation-status filtering, and payment-order allocation delay fields.
- Allocation now consumes a paid order exactly once, credits purchased volume to `customer_accounts.quota_limit_bytes`, and treats a null quota limit as the current used-byte baseline before adding purchased volume.
- Updated shared contracts, backend DTOs, schema, migration, architecture/security/enhancement/roadmap docs, checklist, and memory for the purchase-allocation layer.
- Marked paid payment order quota allocation and charge allocation delay tracking complete in the checklist.
- Bumped AfroGate to `0.75.0` for the allocation schema/API contract.
- Checklist completion after this slice is `201 / 223` items, or `90.1%` complete with `9.9%` remaining.
- Verified migration `0019_payment_order_allocations.sql` with `npm --workspace @afrogate/backend run db:migrate`.
- Verified authenticated local allocation API smoke: a paid 1GB order created one allocation, increased account quota to `1073741824`, and a repeated allocation returned `duplicate = true`.
- Verified version alignment with `npm run version:check`.
- Verified repository secret hygiene with `npm run secrets:check`.
- Verified dashboard contrast with `npm run contrast:check`.
- Verified workspace typecheck and production build with `npm run typecheck --workspaces --if-present` and `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard/client browser coverage with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added the rewarded-ad quota credit foundation for the mobile client app.
- Added `rewarded_ad_settings` with a default 100 MB reward, 20-ad UTC daily cap, provider key, and verification mode.
- Added `rewarded_ad_grants` as an idempotent per-client ledger that credits account quota, and credits explicit/effective client quota when per-client caps are active.
- Added `/api/client/rewarded-ads` and `/api/client/rewarded-ads/claim` behind client tokens with the new `reward:claim` scope.
- Added a mobile rewarded-data card in `apps/client` with English/Persian labels and daily remaining-ad counters.
- Documented that `client_callback_mvp` is not fraud-resistant production ad verification; a verified ad-network SDK/webhook adapter remains a follow-up.
- Updated shared contracts, backend DTOs, schema, migration, client API, client UI, architecture/security/roadmap/multilingual docs, checklist, and memory.
- Bumped AfroGate to `0.76.0` for the rewarded-ad quota-credit schema/API/mobile UI contract.
- Checklist completion after this slice is `202 / 225` items, or `89.8%` complete with `10.2%` remaining after adding the verified ad-provider adapter follow-up.
- Verified focused shared/backend/client typing with `npm run typecheck --workspace @afrogate/shared`, `npm run typecheck --workspace @afrogate/backend`, and `npm run typecheck --workspace @afrogate/client`.
- Verified migration `0020_rewarded_ad_grants.sql` with `npm --workspace @afrogate/backend run db:migrate`.
- Verified version alignment with `npm run version:check`.
- Verified repository secret hygiene with `npm run secrets:check`.
- Verified dashboard contrast with `npm run contrast:check`.
- Verified workspace typecheck and production build with `npm run typecheck --workspaces --if-present` and `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard/client browser coverage with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added per-client preference-aware route decision previews for `client_config:<id>` assignments.
- Route decision previews now include client route preference context, candidate server country/region metadata, preferred-country/exact-outbound availability, match/mismatch review reasons, and preference-aware recommendation selection.
- Country-mode client preferences prefer healthy managed outbounds in the preferred exit country when available; exact-outbound mode prefers the requested healthy managed outbound when available; unavailable or unhealthy preferences fall back to the normal health/session-safe route ranking.
- Surfaced client route preference context and candidate country hints in the Settings Decision Preview panel with English/Persian labels.
- Updated route/security/repository docs and memory to keep the privacy boundary explicit: no client IP history, no destination inspection, and no live data-plane mutation.
- Marked route decision filtering by per-client preferred exit country and available country/server candidates complete.
- Bumped AfroGate to `0.70.0` for the client preference-aware route decision preview API/UI contract.
- Checklist completion after this slice is `194 / 222` items, or `87.4%` complete with `12.6%` remaining.
- Verified authenticated local API smoke by creating dev-only servers/outbounds in `DE` and `US`, saving a client country-mode preference for preferred exit `DE`, and confirming `/api/admin/route-decisions/preview` recommended a `DE` managed outbound with `preferred_country_applied`.
- Verified version alignment with `npm run version:check`.
- Verified repository secret hygiene with `npm run secrets:check`.
- Verified dashboard contrast with `npm run contrast:check`.
- Verified workspace typecheck and production build with `npm run typecheck --workspaces --if-present` and `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke, dense visual capture, and alert filter coverage with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added the first client-scoped mobile API/auth boundary for VPN users.
- Added `client_access_tokens` with admin-issued one-time plaintext tokens stored only as SHA-256 hashes, revocation metadata, scopes, and last-used timestamps.
- Added guarded admin APIs to list, issue, and revoke client access tokens under `/api/admin/client-configs/:id/access-tokens` and `/api/admin/client-access-tokens/:id/revoke`.
- Added `/api/client/me`, `/api/client/route-preference`, and `/api/client/route-options` behind a separate client token guard so mobile apps can see only their own profile/quota, route preference, and selectable non-critical route options.
- Added client-owned route-preference updates that preserve sticky-session protection, force exact outbound choice to be explicit/locked, store country detection as `client_app`, and reject updates when admin override is disabled.
- Updated shared API contracts, schema, route/security docs, roadmap, checklist, and memory for the separate VPN-client surface.
- Marked client-scoped mobile API/auth for VPN users complete.
- Bumped AfroGate to `0.71.0` for the client-scoped mobile API/auth contract.
- Checklist completion after this slice is `195 / 222` items, or `87.8%` complete with `12.2%` remaining.
- Verified the client access token migration with `npm --workspace @afrogate/backend run db:migrate`.
- Verified authenticated local API smoke by creating a dev-only customer/client config, issuing a client mobile token, reading `/api/client/me`, reading `/api/client/route-options`, and saving an `auto`/`gaming` route preference with detected country `IR` stored as `client_app`.
- Verified version alignment with `npm run version:check`.
- Verified repository secret hygiene with `npm run secrets:check`.
- Verified dashboard contrast with `npm run contrast:check`.
- Verified the focused shared/backend typing with `npm run typecheck --workspace @afrogate/shared` and `npm run typecheck --workspace @afrogate/backend`.
- Verified workspace typecheck and production build with `npm run typecheck --workspaces --if-present` and `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke and dense visual capture coverage with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added the first separate VPN-client UX in `apps/client` using React/Vite/Tailwind on local port `4100`.
- The client app uses a client token login, stores the token client-side, and calls only `/api/client/*` for profile/quota, route preference, route options, and preference updates.
- Added mobile-first controls for automatic routing, preferred exit country, explicit server/outbound choice, route score profile, coarse device-locale country detection, and admin override-locked state.
- Added typed English/Persian client app labels and formatting separate from the admin dashboard translation layer.
- Updated workspace scripts, repository/multilingual/route docs, checklist, and memory for the separate client surface.
- Marked mobile client UX for automatic route, country selection, and explicit server choice complete.
- Bumped AfroGate to `0.72.0` for the separate mobile-first VPN client app.
- Checklist completion after this slice is `196 / 222` items, or `88.3%` complete with `11.7%` remaining.
- Verified focused client typing and production build with `npm run typecheck --workspace @afrogate/client` and `npm run build --workspace @afrogate/client`.
- Verified combined dashboard and client browser coverage with `npm run test:e2e`; the suite now includes the fixed-port client smoke test on `127.0.0.1:4100`.
- Added idempotent client usage accounting with the `client_usage_events` PostgreSQL table.
- Added guarded admin APIs to list and record client usage events under `/api/admin/client-configs/:id/usage-events`.
- Recording a non-duplicate usage event now atomically increments both account and client `used_bytes`; repeated `(source, idempotencyKey)` reports return `duplicate = true` without double-counting.
- Updated shared contracts, backend DTO validation, schema, architecture/security docs, checklist, and memory for the usage ledger.
- Marked usage accounting and remaining volume display complete in the checklist.
- Bumped AfroGate to `0.73.0` for the usage-accounting API and schema contract.
- Checklist completion after this slice is `198 / 222` items, or `89.2%` complete with `10.8%` remaining.
- Verified shared/backend typing with `npm run typecheck --workspace @afrogate/shared` and `npm run typecheck --workspace @afrogate/backend`.
- Verified migration `0018_client_usage_events.sql` with `npm --workspace @afrogate/backend run db:migrate`.
- Verified authenticated local usage API smoke: first event added `3145728` bytes, duplicate idempotency key did not double-count, and remaining volume updated.
- Verified version alignment with `npm run version:check`.
- Verified repository secret hygiene with `npm run secrets:check`.
- Verified dashboard contrast with `npm run contrast:check`.
- Verified workspace typecheck and production build with `npm run typecheck --workspaces --if-present` and `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard/client browser coverage with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added the client route preference foundation for the future VPN mobile/client UX.
- Added `client_route_preferences` with per-client auto/country/outbound mode, coarse detected country, preferred exit country, optional preferred outbound, score profile, route lock, and sticky-session protection.
- Added guarded admin APIs to read and update a client config route preference under `/api/admin/client-configs/:id/route-preference`.
- Saving a client route preference now maintains a per-client `route_assignments` key shaped as `client_config:<id>` so route decisions can later be evaluated per VPN client instead of only globally.
- Documented that admin/seller UX and VPN-client UX are separate, and that client country detection must store only coarse country codes without client IP history or user destinations.
- Bumped AfroGate to `0.69.0` for the client route preference schema/API contract.
- Checklist completion after this slice is `193 / 222` items, or `86.9%` complete with `13.1%` remaining.
- Verified the client route preference migration with `npm --workspace @afrogate/backend run db:migrate`.
- Verified authenticated local API smoke by creating a dev-only customer/client config, reading the default route preference, saving a country-mode preference from detected `IR` to preferred exit `DE`, and confirming the per-client route assignment uses the `gaming` profile.
- Verified version alignment with `npm run version:check`.
- Verified repository secret hygiene with `npm run secrets:check`.
- Verified dashboard contrast with `npm run contrast:check`.
- Verified workspace typecheck and production build with `npm run typecheck --workspaces --if-present` and `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke, dense visual capture, and alert filter coverage with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added the Phase 2 payment-order lifecycle foundation with `payment_orders`.
- Added guarded admin APIs to list, create, inspect, and update payment orders under `/api/admin/payment-orders`.
- Payment orders now snapshot the customer account, volume package, payment method, provider, amount, currency, volume, duration, and price-per-GB at creation time.
- Payment order status transitions are audited and constrained to pending, paid, failed, and refunded lifecycle states.
- Payment order metadata and payment method public config now reject secret-like metadata keys so provider secrets stay out of non-secret JSON fields.
- Kept paid-order tracking separate from future quota allocation; usage ledger and charge allocation remain the next billing layer before customer/client volume changes.
- Updated checklist, memory, architecture docs, enhancement docs, and security policy for payment orders.
- Bumped AfroGate to `0.68.0` for the payment-order lifecycle schema/API contract.
- Checklist completion after this slice is `191 / 217` items, or `88.0%` complete with `12.0%` remaining.
- Verified the payment-order migration with `npm --workspace @afrogate/backend run db:migrate`.
- Verified authenticated local API lifecycle smoke by creating a dev-only customer, package, payment method, payment order, and moving the order from `pending` to `paid`.
- Verified version alignment with `npm run version:check`.
- Verified repository secret hygiene with `npm run secrets:check`.
- Verified dashboard contrast with `npm run contrast:check`.
- Verified workspace typecheck and production build with `npm run typecheck --workspaces --if-present` and `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke, dense visual capture, and alert filter coverage with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added the Phase 2 billing catalog foundation with `billing_settings`, `volume_packages`, and `payment_methods`.
- Added guarded admin APIs for billing settings, volume packages, payment methods, and the combined billing catalog.
- Added shared TypeScript contracts for billing settings, volume package requests/responses, payment method requests/responses, and the billing catalog.
- Added PayPal as a first-class payment provider key while keeping payment method support extensible for manual, card, crypto, bank transfer, and local gateway methods.
- Documented that PayPal client secrets, webhook secrets, merchant credentials, and private gateway keys must not be stored in payment public config.
- Updated checklist, memory, PRD, implementation plan, technical architecture, and security policy for billing catalog and provider-method support.
- Bumped AfroGate to `0.67.0` for the billing package/payment-method API and schema contract.
- Checklist completion after adding package/pricing/payment-method support and the new payment-order/provider follow-up tasks is `190 / 217` items, or `87.6%` complete with `12.4%` remaining.
- Verified the billing catalog foundation with `npm --workspace @afrogate/backend run db:migrate`.
- Confirmed authenticated local backend reads return `200` for `/api/admin/billing/settings`, `/api/admin/volume-packages`, `/api/admin/payment-methods`, and `/api/admin/billing/catalog`.
- Verified version alignment with `npm run version:check`.
- Verified repository secret hygiene with `npm run secrets:check`.
- Verified dashboard contrast with `npm run contrast:check`.
- Verified workspace typecheck and production build with `npm run typecheck --workspaces --if-present` and `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke, dense visual capture, and alert filter coverage with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Kept live protocol mutation blocked: protocol apply, live executor, protocol-secret decrypt, server-credential decrypt, installed access profile, active credential, and audited adapter implementation are all required before any future command runner can use decrypted material.
- Remaining high-priority work includes the production server-side protocol apply engine.
- Checklist completion before this slice was `181 / 209` items, or `86.6%` complete with `13.4%` remaining.
- Added a protocol server apply config-material readiness gate so data-plane readiness is blocked when required non-secret setup fields are missing.
- WireGuard plans now check interface name, address CIDR, listen port, endpoint, allowed IPs, and peer public-key presence; VLESS/L2TP/IKEv2 plans check endpoint and port material.
- Stored protocol apply plan and audit snapshots now include config-material readiness and missing-field names without secret material.
- Surfaced config-material readiness as separate translated Settings plan and audit snapshot badges, distinct from protocol-secret and server-credential readiness.
- Updated checklist, memory, dashboard checklist, server-access docs, and security policy while keeping the production protocol executor open.
- Verified protocol apply config-material typing with `npm run typecheck --workspaces --if-present`.
- Bumped AfroGate to `0.64.0` for the protocol apply config-material readiness contract.
- Verified version alignment with `npm run version:check`.
- Verified repository secret hygiene with `npm run secrets:check`.
- Verified dashboard contrast with `npm run contrast:check`.
- Verified workspace typecheck and production build with `npm run typecheck --workspaces --if-present` and `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke, dense visual capture, and alert filter coverage with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Checklist completion after this slice is `182 / 210` items, or `86.7%` complete with `13.3%` remaining.
- Added a protocol server apply generated-command policy gate so data-plane readiness is blocked if generated commands are not allowlisted, timeout-bounded, secret-safe, mutation-rooted, and rollback-backed.
- Split protocol apply command previews that previously used shell chaining into single-purpose generated commands before the future executor boundary.
- Stored command policy readiness, policy violations, allowlist state, and timeout metadata in protocol apply plans and audit snapshots.
- Surfaced command policy readiness and per-command timeout/allowlist metadata in the Settings protocol apply UI.
- Captured the billing product decision that customer accounts can own multiple client configs/devices, with shared account-level GB quota and optional per-client/device caps.
- Updated checklist, memory, dashboard checklist, technical architecture, server-access docs, and security policy while keeping the production protocol executor and Phase 2 billing implementation open.
- Verified protocol apply command-policy typing with `npm run typecheck --workspaces --if-present`.
- Bumped AfroGate to `0.65.0` for the protocol apply command-policy readiness contract and account quota model decision.
- Checklist completion after adding the command-policy gate and new billing quota tasks is `183 / 213` items, or `85.9%` complete with `14.1%` remaining.
- Verified version alignment with `npm run version:check`.
- Verified repository secret hygiene with `npm run secrets:check`.
- Verified dashboard contrast with `npm run contrast:check`.
- Verified workspace typecheck and production build with `npm run typecheck --workspaces --if-present` and `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke, dense visual capture, and alert filter coverage with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added the Phase 2 customer-account database foundation with `customer_accounts` and `client_configs`.
- Added guarded admin APIs for listing, creating, and updating customer accounts, plus creating/updating account-owned client configs.
- Added account-level shared quota fields, optional default per-client quota caps, and client-specific quota overrides with remaining-byte summaries.
- Added write-only paid-number handling that stores only HMAC hashes using `AFROGATE_IDENTITY_HASH_KEY` or the deployment secrets key fallback.
- Added shared TypeScript contracts, backend DTO validation, env/deployment notes, and architecture/security docs for the customer-account quota foundation.
- Marked Telegram identity, privacy-safe paid-number storage, multi-client customer accounts, and shared/per-client quota modeling complete in the checklist.
- Bumped AfroGate to `0.66.0` for the customer-account quota-management foundation.
- Checklist completion after this slice is `187 / 213` items, or `87.8%` complete with `12.2%` remaining.
- Verified the customer-account foundation with `npm --workspace @afrogate/backend run db:migrate`.
- Confirmed the running backend returns `401` for unauthenticated `/api/admin/customer-accounts`, which proves the guarded route is registered.
- Confirmed authenticated `GET /api/admin/customer-accounts` returns an empty account list on the local database without SQL errors.
- Verified version alignment with `npm run version:check`.
- Verified repository secret hygiene with `npm run secrets:check`.
- Verified dashboard contrast with `npm run contrast:check`.
- Verified workspace typecheck and production build with `npm run typecheck --workspaces --if-present` and `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard smoke, dense visual capture, and alert filter coverage with `npm run test:e2e`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added the dashboard Usage/Billing page for seller/admin operations.
- The page reads guarded billing catalog, customer account, payment order, and rewarded-ad settings APIs.
- It shows billing summary cards, volume packages, payment methods, recent payment orders, allocation state, customer quota usage, and rewarded-ad reward/cap policy.
- Admin/owner/superadmin sessions can update non-secret rewarded-ad enabled state, reward MB, daily limit, provider key, and verification mode from the dashboard.
- Added typed English/Persian labels for the billing page and a Playwright flow that opens Billing, verifies catalog data, edits reward MB, and confirms the saved state.
- Marked admin dashboard usage and billing page complete in `.codex/checklist.md` and marked Usage and billing complete in the dashboard sidebar checklist.
- Bumped AfroGate to `0.78.0` for the admin Usage/Billing dashboard workflow.
- Checklist completion after this slice is `204 / 227` items, or `89.9%` complete with `10.1%` remaining.
- Verified the migration stack with `npm --workspace @afrogate/backend run db:migrate`.
- Verified focused dashboard/shared typing with `npm run typecheck --workspace @afrogate/dashboard` and `npm run typecheck --workspace @afrogate/shared`.
- Verified version alignment with `npm run version:check`.
- Verified repository secret hygiene with `npm run secrets:check`.
- Verified dashboard contrast with `npm run contrast:check`.
- Verified workspace typecheck and production build with `npm run typecheck --workspaces --if-present` and `npm run build --workspaces --if-present`.
- Verified fixed-port dashboard/client browser coverage with `npm run test:e2e`; 8 tests passed including the new billing page flow.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added a guarded customer account limit manager to the dashboard Usage/Billing page.
- Admin/owner/superadmin sessions can now create or update customer display metadata, Telegram username, account status, quota scope, shared account GB quota, optional per-client GB caps, and notes from the seller/admin dashboard.
- Added dashboard API helpers for `POST /api/admin/customer-accounts` and `PATCH /api/admin/customer-accounts/:id`.
- Kept paid-number handling out of the dashboard limit-manager workflow so raw paid numbers remain write-only/backend-scoped.
- Added typed English/Persian labels and Playwright browser coverage for creating a customer with per-client quota caps.
- Updated architecture, repository, multilingual, security/performance, roadmap, dashboard checklist, checklist, and memory docs for the customer-limit workflow.
- Bumped AfroGate to `0.79.0` for the admin customer account limit-management workflow.
- Checklist completion after this slice is `205 / 228` items, or `89.9%` complete with `10.1%` remaining.
- Verified the migration stack with `npm --workspace @afrogate/backend run db:migrate`.
- Verified focused dashboard typing with `npm run typecheck --workspace @afrogate/dashboard`.
- Verified version alignment with `npm run version:check`.
- Verified repository secret hygiene with `npm run secrets:check`.
- Verified dashboard contrast with `npm run contrast:check`.
- Verified workspace typecheck and production build with `npm run typecheck --workspaces --if-present` and `npm run build --workspaces --if-present`.
- Verified the final dashboard production build with `npm run build --workspace @afrogate/dashboard`.
- Verified fixed-port dashboard/client browser coverage with `npm run test:e2e`; 8 tests passed after tightening the new Billing form selector.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added the backend Telegram user-command webhook at `POST /api/telegram/webhook` for `/start`, `/help`, `/status`, and `/quota`.
- The webhook is disabled by default, requires `AFROGATE_TELEGRAM_BOT_COMMANDS_ENABLED=true`, a configured bot token, and a matching Telegram secret-token header before it processes updates.
- Added safe linked-account lookup by Telegram id with username fallback; replies expose only account status, remaining quota, used quota, and client counts, not paid numbers, tokens, traffic destinations, or server secrets.
- Extended the existing Telegram alert sender with a reusable `sendMessage` method so bot replies honor the shared outbound HTTP proxy path.
- Updated `.env.example`, control-plane egress docs, architecture, security docs, dashboard checklist, checklist, and memory for the Telegram command boundary.
- Bumped AfroGate to `0.80.0` for the Telegram user-command workflow.
- Checklist completion after this slice is `206 / 228` items, or `90.4%` complete with `9.6%` remaining.
- Verified version alignment with `npm run version:check`.
- Verified workspace typecheck and production build with `npm run typecheck` and `npm run build`.
- Verified repository secret hygiene with `npm run secrets:check`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.

- Added guarded `GET /api/admin/audit-logs` with exact-match filters, bounded result limits, newest-first ordering, and dashboard-safe metadata redaction for secret-like keys.
- Added the dashboard Audit Logs page with summary cards, action/target filters, compact event table, English/Persian labels, and role-aware sidebar visibility that excludes support-role sessions.
- Added Playwright browser coverage for the Audit Logs page and sanitized metadata display.
- Updated the dashboard sidebar checklist, main checklist, memory, security policy, architecture notes, changelog, and version for the audit-log review workflow.
- Bumped AfroGate to `0.82.0` for the guarded audit log API and dashboard page.
- Checklist completion after this slice is `210 / 229` items, or `91.7%` complete with `8.3%` remaining.
- Verified version alignment with `npm run version:check`.
- Verified workspace typecheck and production build with `npm run typecheck` and `npm run build`.
- Verified dashboard/client browser coverage with `npm run test:e2e`; 9 tests passed including the new Audit Logs flow.
- Verified repository secret hygiene with `npm run secrets:check`.
- Verified dashboard contrast with `npm run contrast:check`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added `docs/security-threat-model.md` covering assets, trust boundaries, attacker-controlled inputs, existing mitigations, attacker stories, and severity calibration.
- Added `docs/privacy-threat-model.md` covering data categories, no-traffic-inspection invariants, client/admin/provider boundaries, privacy failure stories, and required controls.
- Linked the threat models from `SECURITY.md`, `docs/security-performance-policy.md`, and `docs/repository-structure.md`.
- Marked privacy and security threat models complete in `.codex/checklist.md`.
- Bumped AfroGate to `0.81.1` for the threat-model documentation slice.
- Checklist completion after this slice is `209 / 228` items, or `91.7%` complete with `8.3%` remaining.
- Verified version alignment with `npm run version:check`.
- Verified repository secret hygiene with `npm run secrets:check`.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.
- Added a backend API rate-limit guard with bounded in-memory fixed-window counters and response headers for limit, remaining count, reset, and retry-after.
- Applied default API rate limits to `POST /api/auth/login`, `POST /api/payments/paypal/webhook`, and `POST /api/telegram/webhook`.
- Added deployment controls for `AFROGATE_RATE_LIMIT_ENABLED`, `AFROGATE_RATE_LIMIT_TRUST_PROXY_HEADERS`, and `AFROGATE_RATE_LIMIT_MAX_KEYS`.
- Kept proxy header trust disabled by default so direct backend exposure cannot spoof rate-limit identities.
- Updated `.env.example`, security policy, architecture docs, SECURITY.md, checklist, and memory for the API rate-limit boundary.
- Bumped AfroGate to `0.81.0` for the API-layer rate-limiting foundation.
- Checklist completion after this slice is `207 / 228` items, or `90.8%` complete with `9.2%` remaining.
- Verified version alignment with `npm run version:check`.
- Verified workspace typecheck and production build with `npm run typecheck` and `npm run build`.
- Verified repository secret hygiene with `npm run secrets:check`.
- Verified dependency audit with `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Verified whitespace safety with `git diff --check`; only existing CRLF conversion warnings were reported.

## 2026-05-29 Telegram Bot Settings Slice

### Completed

- Added PostgreSQL migration `0023_telegram_bot_settings.sql` for database-backed Telegram bot setup metadata.
- Added encrypted/write-only Telegram BotFather token and webhook-secret storage through `secret_records` scope `telegram_bot`.
- Added guarded superadmin Settings APIs for reading Telegram bot readiness metadata, saving token/webhook/chat settings, and testing Telegram `getMe` through the shared outbound HTTP client.
- Updated Telegram alert delivery and user-command webhook runtime resolution to use database settings with environment values as bootstrap/fallback.
- Added a dashboard Settings Telegram Bot Setup panel with bilingual labels, write-only token inputs, alert/admin chat ID controls, alerts/commands toggles, and API test action.
- Added `docs/telegram-bot-setup.md` for BotFather setup and token rotation.
- Recorded native client per-app VPN split tunneling as a future client requirement: selected apps can use AfroGate while other apps stay on normal internet without exposing installed-app inventories or traffic destinations.
- Marked Telegram bot setup and onboarding/rotation guide complete in `.codex/checklist.md`; checklist completion is now `217 / 236` items, or `91.9%` complete with `8.1%` remaining.
- Bumped AfroGate to `0.87.0` and updated `CHANGELOG.md`.

### Verification

- Ran `npm --workspace @afrogate/backend run db:migrate`.
- Ran `npm run typecheck --workspaces --if-present`.
- Ran `npm run version:check`.
- Ran `npm run build --workspaces --if-present`.
- Ran `npm run secrets:check`.
- Ran `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Ran `npm run test:e2e`; 10 tests passed.
- Ran `npm run contrast:check`.
- Ran `git diff --check`; only existing CRLF conversion warnings were reported.

### Remaining

- Implement native client per-app VPN split tunneling in a future mobile/desktop client phase.
- Keep the separate Telegram bot operations page pending until there is more operational state to manage beyond setup/readiness.

## 2026-05-29 Agent Token Rotation Slice

### Completed

- Added guarded `POST /api/agents/:serverId/tokens/rotate` for admin/owner/superadmin agent token rotation.
- Rotation revokes all active tokens for the target server, issues one new plaintext token once, stores only its SHA-256 hash, and records an `agent.token.rotate` audit event.
- Added shared rotation contracts, a DTO, and an active-token lookup index migration `0024_agent_token_rotation_index.sql`.
- Updated security, repository, local-development, threat-model, env-sample, roadmap, checklist, and memory docs for the rotation workflow.
- Marked per-agent token rotation complete in `.codex/checklist.md`; checklist completion is now `218 / 236` items, or `92.4%` complete with `7.6%` remaining.
- Bumped AfroGate to `0.88.0` and updated `CHANGELOG.md`.

### Verification

- Ran `npm run typecheck --workspace @afrogate/backend --workspace @afrogate/shared`.
- Ran `npm --workspace @afrogate/backend run db:migrate`.
- Ran `npm run version:check`.
- Ran `npm run secrets:check`.
- Ran `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Ran `npm run typecheck --workspaces --if-present`.
- Ran `npm run build --workspaces --if-present`.
- Ran `npm run contrast:check`.
- Ran `npm run test:e2e`; 10 tests passed.
- Ran `git diff --check`; only existing CRLF conversion warnings were reported.

### Remaining

- Database least-privilege roles were the next security hardening target after this slice.
- Production protocol apply, panel migration adapters, additional payment providers, verified rewarded-ad provider callbacks, reports, tenant branding, and native per-app VPN split tunneling remain future work.

## 2026-05-29 Database Least-Privilege Roles Slice

### Completed

- Added `DATABASE_MIGRATION_URL` support to the backend migration runner, with `DATABASE_URL` retained as the local/dev fallback.
- Updated the local PostgreSQL setup script to create `afrogate_owner`, `afrogate_migrator`, and `afrogate_app`, apply least-privilege grants before/after migrations, and write separate runtime/migration URLs when requested.
- Added production SQL templates for applying and verifying the PostgreSQL owner/migrator/runtime role boundary.
- Updated local, Ubuntu, PostgreSQL, architecture, repository, security, env-sample, checklist, and memory docs for the least-privilege database workflow.
- Marked database least-privilege roles complete in `.codex/checklist.md`; checklist completion is now `219 / 236` items, or `92.8%` complete with `7.2%` remaining.
- Bumped AfroGate to `0.89.0` and updated `CHANGELOG.md`.

### Verification

- Parsed `scripts/setup-local-postgres.ps1` as a PowerShell script block.
- Ran `npm --workspace @afrogate/backend run db:migrate`.
- Ran `npm run version:check`.
- Ran `npm run secrets:check`.
- Ran `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Ran `npm run typecheck --workspaces --if-present`.
- Ran `npm run build --workspaces --if-present`.
- Ran `npm run contrast:check`.
- Ran `npm run test:e2e`; 10 tests passed.
- Ran `git diff --check`; only existing CRLF conversion warnings were reported.

### Remaining

- Production protocol apply, panel migration adapters, additional payment providers, verified rewarded-ad provider callbacks, reports, tenant branding, and native per-app VPN split tunneling remain future work.
- Existing single-role PostgreSQL deployments should back up first and may need manual object ownership reassignment before future DDL-heavy migrations run as `afrogate_migrator`.

## 2026-05-29 Fine-Grained RBAC Slice

### Completed

- Added a shared admin permission catalog and role-permission policy in `packages/shared`.
- Extended backend guard metadata with `@Permissions(...)` and updated `RolesGuard` to enforce both role and permission requirements.
- Added guarded `GET /api/admin/permissions` so the dashboard can inspect the permission catalog, role matrix, current role, and effective permissions.
- Added `adminUsers:read` and `adminUsers:write` checks to admin-user endpoints while preserving protected bootstrap/env account invariants.
- Allowed `owner` and `superadmin` sessions to manage local managed admin users; normal admins can inspect but not mutate, and support/supervisor/auditor sessions do not see the Users page.
- Added the bilingual Role Permissions matrix to the Users page and Playwright coverage for it.
- Added `docs/admin-rbac.md` and updated security, repository, roadmap, dashboard checklist, checklist, and memory docs.
- Marked fine-grained production RBAC policy and permission UI complete in `.codex/checklist.md`; checklist completion is now `220 / 236` items, or `93.2%` complete with `6.8%` remaining.
- Bumped AfroGate to `0.90.0` and updated `CHANGELOG.md`.

### Verification

- Ran focused typechecks for shared, backend, and dashboard during implementation.
- Ran `npm --workspace @afrogate/backend run db:migrate`.
- Ran `npm run version:check`.
- Ran `npm run secrets:check`.
- Ran `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Ran `npm run typecheck --workspaces --if-present`.
- Ran `npm run build --workspaces --if-present`.
- Ran `npm run contrast:check`.
- Ran `npm run test:e2e`; 11 tests passed, including the new RBAC permission matrix flow.
- Ran `git diff --check`; only existing CRLF conversion warnings were reported.

### Remaining

- Production protocol apply, panel migration adapters, additional payment providers, verified rewarded-ad provider callbacks, reports/data analysis, tenant branding, enterprise deployment guide, and native per-app VPN split tunneling remain future work.

## 2026-05-29 Route Health Score History Slice

### Completed

- Added guarded `GET /api/admin/route-health/history` for read-role admins with `routes:read` permission enforcement.
- The endpoint reads compact `route_quality_hourly` summaries, groups recent hourly points by route group, server, outbound, operator, protocol, and score profile, and derives healthy/degraded/critical status from score, loss, degraded sample share, and critical sample share.
- Added shared route-health-history contracts for backend and dashboard use.
- Added a Routes-page Route Health History panel with bilingual labels, localized formatting, loading/stale/empty states, and synthetic-probe-only metadata.
- Added Playwright coverage for the Routes page history panel.
- Updated docs, memory, dashboard checklist, and main checklist; checklist completion is now `221 / 236` items, or `93.6%` complete with `6.4%` remaining.

### Verification

- Ran focused typechecks for shared, backend, and dashboard during implementation.
- Ran `npm --workspace @afrogate/backend run db:migrate`.
- Ran `npm run version:check`.
- Ran `npm run secrets:check`.
- Ran `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Ran `npm run typecheck --workspaces --if-present`.
- Ran `npm run build --workspaces --if-present`.
- Ran `npm run contrast:check`.
- Ran `npm run test:e2e`; 12 tests passed, including the new Routes route-health-history flow.
- Ran `git diff --check`; only existing CRLF conversion warnings were reported.

### Remaining

- Production protocol apply, panel migration adapters, additional payment providers, verified rewarded-ad provider callbacks, reports/data analysis, tenant branding, enterprise deployment guide, incident timeline, route canary rollout, and native per-app VPN split tunneling remain future work.

## 2026-05-29 Incident Timeline Slice

### Completed

- Added guarded `GET /api/admin/incidents/timeline` for read-role admins with `alerts:read` plus `routes:read` permission enforcement.
- The endpoint derives compact timeline events from existing alert open/resolve timestamps and route decision/assignment records, then returns a sorted read-only operational timeline.
- Added shared incident-timeline contracts for backend and dashboard use.
- Added an Alerts-page Incident Timeline panel with bilingual labels, localized formatting, loading/fallback/empty states, route group/source context, and route-decision detail.
- Added Playwright coverage for the Alerts page timeline panel and fixed the alert filter selects with explicit accessible labels.
- Updated docs, memory, dashboard checklist, and main checklist; checklist completion is now `222 / 236` items, or `94.1%` complete with `5.9%` remaining.
- Bumped AfroGate to `0.92.0` and updated `CHANGELOG.md`.

### Verification

- Ran focused workspace typecheck during implementation.
- Ran `npm --workspace @afrogate/backend run db:migrate`.
- Ran `npm run version:check`.
- Ran `npm run secrets:check`.
- Ran `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Ran `npm run typecheck --workspaces --if-present`.
- Ran `npm run build --workspaces --if-present`.
- Ran `npm run contrast:check`.
- Ran `npm run test:e2e`; 12 tests passed, including the Alerts incident-timeline flow.
- Ran `git diff --check`; only existing CRLF conversion warnings were reported.

### Remaining

- Production protocol apply, panel migration adapters, additional payment providers, verified rewarded-ad provider callbacks, reports/data analysis, tenant branding, enterprise deployment guide, route canary rollout, adapter-based migration, and native per-app VPN split tunneling remain future work.

## 2026-05-29 Route Canary Rollout Status Slice

### Completed

- Added shared `AdminRouteCanaryStatusResponse` for a standalone canary rollout status surface.
- Added guarded `GET /api/admin/route-canary/status` with `routes:read` permission enforcement. The endpoint reuses the existing route decision preview, rollout plan, rollout evaluation, and orchestration summaries instead of creating a separate switching engine.
- Added a Routes-page Route Canary Rollout panel with bilingual labels, loading/stale/empty states, current and recommended candidate cards, guard readiness, data-plane readiness, canary readiness, rollout thresholds, orchestration next action, and session-safety state.
- Added Playwright coverage for the Routes page canary rollout panel.
- Updated docs, memory, dashboard checklist, and main checklist; checklist completion is now `223 / 236` items, or `94.5%` complete with `5.5%` remaining.
- Bumped AfroGate to `0.93.0` and updated `CHANGELOG.md`.

### Verification

- Ran focused workspace typecheck during implementation.
- Ran `npm --workspace @afrogate/backend run db:migrate`.
- Ran `npm run version:check`.
- Ran `npm run secrets:check`.
- Ran `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Ran `npm run typecheck --workspaces --if-present`.
- Ran `npm run build --workspaces --if-present`.
- Ran `npm run contrast:check`.
- Ran `npm run test:e2e`; 12 tests passed, including the Routes route-canary-rollout flow. An initial e2e run found an ambiguous strict-mode locator in the new assertion; the assertion was tightened and the suite passed.
- Ran `git diff --check`; only existing CRLF conversion warnings were reported.

### Remaining

- Production protocol apply, panel migration adapters, additional payment providers, verified rewarded-ad provider callbacks, reports/data analysis, tenant branding, enterprise deployment guide, adapter-based migration, and native per-app VPN split tunneling remain future work.

## 2026-05-29 Current Panel Import Preview Slice

### Completed

- Added shared current-panel import preview contracts for Marzban, X-UI, Sanayi, and generic panel export payloads.
- Added adapter-scoped backend parsing in `current-panel-import.adapters.ts` plus guarded `POST /api/admin/current-panels/import-preview`.
- The endpoint normalizes read-only user/config candidates with status, protocol, quota, usage, expiry, external ids, warnings, and rejected-row counts while fingerprinting link-like identifiers and avoiding raw payload storage.
- Added a Billing page Current Panel Import preview panel with typed English/Persian labels and Playwright coverage.
- Updated docs, memory, dashboard checklist, and main checklist; checklist completion is now `225 / 236` items, or `95.3%` complete with `4.7%` remaining.
- Bumped AfroGate to `0.94.0` and updated `CHANGELOG.md`.

### Verification

- Ran focused workspace typecheck during implementation.
- Ran `npm --workspace @afrogate/backend run db:migrate`.
- Ran `npm run version:check`.
- Ran `npm run secrets:check`.
- Ran `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Ran `npm run typecheck --workspaces --if-present`.
- Ran `npm run build --workspaces --if-present`.
- Ran `npm run contrast:check`.
- Ran `npm run test:e2e`; 12 tests passed, including the Billing current-panel import preview flow. An initial e2e run found an ambiguous strict-mode locator in the new assertion; the assertion was tightened and the suite passed.
- Ran a direct built-adapter smoke call for a Marzban-style payload; it returned one active candidate with `25 GB` quota and `6 GB` usage. An initial smoke payload used an expiry timestamp too close to the current date, so the sample timestamp was moved to `2030-01-01`.
- Ran `git diff --check`; only existing CRLF conversion warnings were reported.

### Remaining

- Production protocol apply, controlled panel writes/import, usage reconciliation, charge/update sync, additional payment providers, verified rewarded-ad provider callbacks, reports/data analysis, tenant branding, enterprise deployment guide, and native per-app VPN split tunneling remain future work.

## 2026-05-29 Current Panel Controlled Config Import Slice

### Completed

- Added shared current-panel controlled-import contracts for server-side config import results, skipped candidates, and baseline usage counts.
- Added guarded `POST /api/admin/current-panels/import-configs` for admin/owner/superadmin sessions.
- The import endpoint re-runs the current-panel adapter server-side, skips duplicate or unsupported candidates, imports sanitized rows into `client_configs`, and records panel-reported used bytes through idempotent `panel_sync` baseline `client_usage_events` so account/client counters stay consistent.
- Added Billing page controls to choose a customer, import the same pasted/exported current-panel payload after preview, show imported/skipped counts, and optimistically update customer usage/client totals.
- Updated docs, memory, dashboard checklist, and main checklist; checklist completion is now `226 / 237` items, or `95.4%` complete with `4.6%` remaining.
- Bumped AfroGate to `0.95.0` and updated `CHANGELOG.md`.

### Verification

- Ran `npm run version:check`.
- Ran `npm run build --workspaces --if-present`.
- Ran `npm run secrets:check`.
- Ran `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Ran `npm run contrast:check`.
- Ran `npm run typecheck`.
- Ran `npm run test:e2e`; 12 tests passed, including the Billing current-panel preview/import flow.
- Ran `git diff --check`; only existing CRLF conversion warnings were reported.

### Remaining

- Full ongoing usage reconciliation, charge/update sync back to external panels, config export, live external-panel write adapters, production protocol apply, additional payment providers, verified rewarded-ad provider callbacks, reports/data analysis, tenant branding, enterprise deployment guide, and native per-app VPN split tunneling remain future work.

## 2026-05-29 Current Panel Controlled Usage Sync Slice

### Completed

- Added shared current-panel usage-sync contracts for matched/synced/skipped counts, positive synced deltas, updated configs, and skipped candidates.
- Added guarded `POST /api/admin/current-panels/sync-usage` for admin sessions.
- The sync endpoint re-runs the current-panel adapter server-side, matches existing imported `client_configs`, records only positive panel-counter deltas through idempotent `panel_sync` `client_usage_events`, and skips missing, ambiguous, cross-account, duplicate, or non-advancing candidates.
- Added Billing page controls to run usage sync from the same current-panel export box, show synced/skipped counts, and optimistically update customer usage totals.
- Updated docs, memory, dashboard checklist, and main checklist; checklist completion is now `227 / 237` items, or `95.8%` complete with `4.2%` remaining.
- Bumped AfroGate to `0.96.0` and updated `CHANGELOG.md`.

### Verification

- Ran `npm run version:check`.
- Ran `npm run typecheck`.
- Ran `npm run build --workspaces --if-present`.
- Ran `npm run test:e2e`; 12 tests passed, including the Billing current-panel preview/import/sync flow.
- Ran `npm run secrets:check`.
- Ran `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Ran `npm run contrast:check`.
- Ran `git diff --check`; only existing CRLF conversion warnings were reported.

### Remaining

- Charge/update sync back to external panels, config import/export, live external-panel write adapters, scheduled external-panel reconciliation, production protocol apply, additional payment providers, verified rewarded-ad provider callbacks, reports/data analysis, tenant branding, enterprise deployment guide, and native per-app VPN split tunneling remain future work.

## 2026-05-29 Sanitized Client Config Export Slice

### Completed

- Added shared `AdminClientConfigsExportResponse` for sanitized account-scoped client config export.
- Added guarded `GET /api/admin/customer-accounts/:id/client-configs/export` for admin/supervisor/support/auditor sessions.
- The export endpoint returns AfroGate client config summaries in `afrogate_client_configs_export_v1` format, audits compact export metadata, and excludes subscription credentials, secret-bearing config material, raw panel payloads, paid numbers, client tokens, and external-panel API calls.
- Added Billing page controls to export configs for the selected customer, show exported count, and display read-only JSON with bilingual labels.
- Updated docs, memory, dashboard checklist, and main checklist; checklist completion is now `228 / 237` items, or `96.2%` complete with `3.8%` remaining.
- Bumped AfroGate to `0.97.0` and updated `CHANGELOG.md`.

### Verification

- Ran `npm run version:check`.
- Ran `npm run typecheck`.
- Ran `npm run build --workspaces --if-present`.
- Ran `npm run test:e2e`; 12 tests passed, including the Billing current-panel preview/import/sync/export flow.
- Ran `npm run secrets:check`.
- Ran `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Ran `npm run contrast:check`.
- Ran `git diff --check`; only existing CRLF conversion warnings were reported.

### Remaining

- Charge/update sync back to external panels, live external-panel write adapters, scheduled external-panel reconciliation, production protocol apply, backup/restore UI, reports/data analysis, tenant branding, enterprise deployment guide, and native per-app VPN split tunneling remain future work.

## 2026-05-29 Current Panel Volume Charge Slice

### Completed

- Added guarded `POST /api/admin/current-panels/charge-volume` for audited local AfroGate quota top-ups.
- Added `quota_charge_events` migration/schema support with account quota deltas, selected-client quota-change metadata, optional idempotency, non-secret metadata, and explicit external-panel write status.
- Added shared charge request/response contracts and backend validation for account-only, selected-client, and account-plus-selected-client charge scopes.
- Added Billing page controls to charge the selected customer by GB, update the account summary, and show bilingual success/failure copy.
- Updated docs, memory, dashboard checklist, and main checklist; checklist completion is now `229 / 237` items, or `96.6%` complete with `3.4%` remaining.
- Bumped AfroGate to `0.98.0` and updated `CHANGELOG.md`.

### Verification

- Ran `npm --workspace @afrogate/backend run db:migrate`; local migrations completed through `0025_quota_charge_events.sql`.
- Ran `npm run version:check`.
- Ran `npm run typecheck`.
- Ran `npm run build --workspaces --if-present`.
- Ran `npm run test:e2e`; 12 tests passed, including the Billing current-panel preview/import/sync/export/charge flow.
- Ran `npm run secrets:check`.
- Ran `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Ran `npm run contrast:check`.
- Ran `git diff --check`; only existing CRLF conversion warnings were reported.

### Remaining

- Live external-panel quota write adapters, scheduled external-panel reconciliation, production protocol apply, backup/restore UI, reports/data analysis, tenant branding, enterprise deployment guide, additional payment providers, verified rewarded-ad provider callbacks, and native per-app VPN split tunneling remain future work.

## 2026-05-29 Backup Restore Readiness UI Slice

### Completed

- Added shared backup restore-plan contracts for readiness status, execution-disabled state, checks, blockers/warnings, safety notes, target artifact classes, and manual runbook steps.
- Added guarded `GET /api/admin/backups/restore-plan` with `backups:read` permission; it derives a read-only restore plan from sanitized backup status and does not expose dumps, local paths, object-store credentials, decrypted data, or restore controls.
- Added Backups page restore-readiness and restore-runbook panels with bilingual labels, evidence checks, blocker/warning counts, safety notes, and non-executable restore steps.
- Updated docs, memory, dashboard checklist, and main checklist; checklist completion is now `230 / 237` items, or `97.0%` complete with `3.0%` remaining.
- Bumped AfroGate to `0.99.0` and updated `CHANGELOG.md`.

### Verification

- Ran `npm run version:check`.
- Ran `npm run typecheck`.
- Ran `npm run build --workspaces --if-present`.
- Ran `npm run test:e2e`; 12 tests passed, including the Backups restore-readiness/runbook page.
- Ran `npm run secrets:check`.
- Ran `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Ran `npm run contrast:check`.
- Ran `git diff --check`; only existing CRLF conversion warnings were reported.

### Remaining

- Production protocol apply, additional payment provider adapters, verified rewarded-ad provider callbacks, reports/data analysis, tenant branding, enterprise deployment guide, and native per-app VPN split tunneling remain future work.

## 2026-05-29 Reports and Data Analysis Slice

### Completed

- Added shared reports summary contracts for operational risk, server/outbound health counts, open alert counts, backup readiness, and synthetic route-quality recommendations.
- Added `AdminReportsService` and guarded `GET /api/admin/reports/summary` with `reports:read` permission.
- Added a Reports dashboard sidebar page with bilingual labels, risk score/level, operational health mix, risk reasons, and route-quality analysis.
- Kept reports aggregate and privacy-safe: no customer identities, user destinations, traffic contents, client IP history, raw backups, exports, or secrets are returned.
- Updated docs, memory, dashboard checklist, and main checklist; checklist completion is now `231 / 237` items, or `97.5%` complete with `2.5%` remaining.
- Bumped AfroGate to `0.100.0` and updated `CHANGELOG.md`.

### Verification

- Ran `npm run version:check`.
- Ran `npm run typecheck`.
- Ran `npm run build --workspaces --if-present`.
- Ran `npm run test:e2e`; 13 tests passed, including the Reports page.
- Ran `npm run secrets:check`.
- Ran `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Ran `npm run contrast:check`.
- Ran `git diff --check`; only existing CRLF conversion warnings were reported.

### Remaining

- Production protocol apply, additional payment provider adapters, verified rewarded-ad provider callbacks, tenant branding, enterprise deployment guide, and native per-app VPN split tunneling remain future work.

## 2026-05-29 Tenant Branding Settings Slice

### Completed

- Added default-tenant brand settings backed by PostgreSQL migration `0026_tenant_brand_settings.sql` and schema metadata.
- Added shared tenant-branding contracts plus `tenantBranding:read` and `tenantBranding:write` permissions.
- Added guarded admin `GET/PATCH /api/admin/tenant-branding` with validation and audit logging for public brand/support metadata.
- Added a dashboard Settings-page branding form and preview for brand names, support contacts, logo URL, colors, client app title, and client support copy.
- Aligned the admin role permission matrix with the visible Reports page by granting `reports:read` to the `admin` role.
- Kept the feature public-metadata-only: no secrets, customer identity, paid numbers, client IP history, user destinations, traffic contents, or production config belong in tenant branding.
- Updated docs, memory, dashboard checklist, and main checklist; checklist completion is now `232 / 237` items, or `97.9%` complete with `2.1%` remaining.
- Bumped AfroGate to `0.101.0` and updated `CHANGELOG.md`.

### Verification

- Ran `npm --workspace @afrogate/backend run db:migrate`; local migrations completed through `0026_tenant_brand_settings.sql`.
- Ran `npm run version:check`.
- Ran `npm run typecheck`.
- Ran `npm run build --workspaces --if-present`.
- Ran `npm run test:e2e`; 14 tests passed, including the Settings tenant-branding save flow.
- Ran `npm run secrets:check`.
- Ran `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Ran `npm run contrast:check`.
- Ran `git diff --check`; only existing CRLF conversion warnings were reported.

### Remaining

- Production protocol apply, additional payment provider adapters, verified rewarded-ad provider callbacks, enterprise deployment guide, and native per-app VPN split tunneling remain future work.

## 2026-05-29 Enterprise Deployment Guide Slice

### Completed

- Added `docs/enterprise-deployment-guide.md` as the production control-plane deployment runbook.
- Covered native Ubuntu/Nginx/systemd/PostgreSQL topology, public-port boundaries, host provisioning, environment secrets, least-privilege database roles, migrations, service setup, firewall, agent rules, backups, monitoring, update flow, rollback, privacy rules, and go/no-go checks.
- Explicitly kept live route/protocol data-plane apply, native per-app VPN split tunneling, and additional production payment provider hardening behind future implementation gates.
- Linked the guide from `README.md`, `SECURITY.md`, repository structure docs, and dashboard/sidebar checklist.
- Updated memory and main checklist; checklist completion is now `233 / 237` items, or `98.3%` complete with `1.7%` remaining.
- Bumped AfroGate to `0.101.1` and updated `CHANGELOG.md`.

### Verification

- Ran `npm run version:check`.
- Ran `npm run secrets:check`.
- Ran `git diff --check`; only existing CRLF conversion warnings were reported.

### Remaining

- Production protocol apply, additional production payment provider hardening, and native per-app VPN split tunneling remain future work.

## 2026-05-29 Payment Provider Adapter Slice

### Completed

- Added shared payment-provider adapter contracts and extended the billing catalog with adapter readiness for PayPal, card, local gateway, bank transfer, and crypto.
- Added guarded `POST /api/admin/payment-orders/:id/provider/checkout` for non-PayPal provider preparation.
- Card and local-gateway methods can now prepare hosted checkout URLs from non-secret public config, while bank-transfer and crypto methods can prepare payment references and manual instructions.
- Kept non-PayPal generic providers honest: they do not mark orders paid, verify settlement, allocate quota, or store provider secrets. Admin verification or a future provider-specific verified callback is required before paid status and quota allocation.
- Added Billing page adapter readiness visibility with bilingual labels.
- Updated docs, memory, dashboard checklist, and main checklist; checklist completion is now `234 / 237` items, or `98.7%` complete with `1.3%` remaining.
- Bumped AfroGate to `0.102.0` and updated `CHANGELOG.md`.

### Verification

- Ran `npm run version:check`.
- Ran `npm run typecheck`.
- Ran `npm run build --workspaces --if-present`.
- Ran `npm run secrets:check`.
- Ran `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Ran `npm run test:e2e`; 17 tests passed.
- Ran `npm run contrast:check`.
- Ran `git diff --check`; only CRLF conversion warnings were reported.
- Ran `npm run version:check`.
- Ran `npm run secrets:check`.
- Ran `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Ran `npm run build --workspaces --if-present`.
- Ran `npm run test:e2e`; 14 tests passed, including the Billing provider-adapter readiness check.
- Ran `npm run contrast:check`.
- Ran a built Node smoke test for card checkout URL preparation.
- Ran `git diff --check`; only existing CRLF conversion warnings were reported.

### Remaining

- Production protocol apply and native per-app VPN split tunneling remain future work.

## 2026-05-29 Rewarded-Ad Signed Webhook Slice

### Completed

- Added public `POST /api/rewarded-ads/webhook` with rate limiting for provider/server-to-server rewarded-ad callbacks.
- Added HMAC-SHA256 signature verification over `timestamp.canonicalJson(payload)` using `AFROGATE_REWARDED_AD_WEBHOOK_SECRET` plus timestamp freshness through `AFROGATE_REWARDED_AD_WEBHOOK_TOLERANCE_SECONDS`.
- Required admin rewarded-ad verification mode to be `signed_webhook` or `provider_signed_webhook` before signed callbacks can credit quota.
- Reused the existing rewarded-ad grant ledger for client/account locking, provider/session idempotency, daily caps, audit logging, account quota updates, and per-client quota updates when per-client caps are active.
- Kept callback metadata minimal and non-secret: provider event id, ad unit/placement id, reward amount/currency, timestamp, and signed-webhook marker only.
- Updated env examples, docs, privacy/security threat models, memory, dashboard checklist, and main checklist; checklist completion is now `235 / 237` items, or `99.2%` complete with `0.8%` remaining.
- Bumped AfroGate to `0.103.0` and updated `CHANGELOG.md`.

### Verification

- Ran focused `npm run typecheck` during implementation.
- Ran `npm run version:check`.
- Ran `npm run secrets:check`.
- Ran `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Ran `npm run typecheck`.
- Ran `npm run build --workspaces --if-present`.
- Ran a built Node smoke test for the rewarded-ad webhook verifier; a valid HMAC signature produced the expected idempotency key and signed-webhook metadata.
- Ran `npm run test:e2e`; 14 tests passed.
- Ran `npm run contrast:check`.
- Ran `git diff --check`; only existing CRLF conversion warnings were reported.

### Remaining

- Production protocol apply and native per-app VPN split tunneling remain future work.

## 2026-05-29 Dashboard Kiosk Display Slice

### Completed

- Added a localized icon-only dashboard kiosk display toggle in the NOC dashboard header.
- Kiosk mode stores local browser state in `afrogate.dashboard.kiosk`, requests browser fullscreen when available, hides the sidebar, and expands the dashboard grid to the full viewport.
- Kept kiosk mode UI-only: no backend state, route policy, session assignment, OS route, or data-plane traffic behavior changes.
- Added Playwright coverage for entering and exiting kiosk display mode.
- Marked the dashboard/sidebar `Fullscreen/kiosk display toggle` item complete.
- Bumped AfroGate to `0.103.1` and updated `CHANGELOG.md`.

### Verification

- Ran a focused `npm run typecheck` before the version bump.
- Ran focused `npm run test:e2e -- --grep "kiosk display"`; 1 test passed.
- Ran `npm run version:check`.
- Ran `npm run secrets:check`.
- Ran `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Ran `npm run typecheck`.
- Ran `npm run build --workspaces --if-present`.
- Ran `npm run test:e2e`; 15 tests passed, including the dashboard kiosk display flow.
- Ran `npm run contrast:check`.
- Ran `git diff --check`; only existing CRLF conversion warnings were reported.

### Remaining

- Main checklist completion remains `235 / 237` items, or `99.2%` complete with `0.8%` remaining.
- Production protocol apply and native per-app VPN split tunneling remain future work.

## 2026-05-29 Dashboard Foundation Checklist Verification

### Completed

- Verified the dashboard still starts on the NOC/wall display by default through `activeView = 'dashboard'`.
- Verified the dashboard already uses guarded backend outbound rows for the Dashboard and Routes pages, with local sample outbounds only as fallback.
- Added Playwright coverage that checks the default NOC heading, backend outbound row rendering, and static client-side page switches that keep the browser path stable.
- Marked the dashboard/sidebar checklist items for default NOC display, second-LCD passive layout, static-first page transitions, and real backend outbound rows complete.
- Bumped AfroGate to `0.103.2` and updated `CHANGELOG.md`.

### Verification

- Ran focused `npm run test:e2e -- --grep "NOC view"`; 1 test passed.
- Ran `npm run version:check`.
- Ran `npm run secrets:check`.
- Ran `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Ran `npm run test:e2e`; 16 tests passed, including the dashboard NOC/default/static-switch verification.
- Ran `git diff --check`; only existing CRLF conversion warnings were reported.

### Remaining

- Main checklist completion remains `235 / 237` items, or `99.2%` complete with `0.8%` remaining.
- Production protocol apply and native per-app VPN split tunneling remain future work.

## 2026-05-29 Telegram Purchase Fulfillment Checklist Slice

### Completed

- Added a pending Phase 2 checklist item for Telegram purchase fulfillment after verified payment.
- Defined the future bot delivery shape: one client-scoped VLESS config plus a private usage/status link after quota allocation.
- Updated the dashboard/sidebar backlog, roadmap, PRD, architecture notes, security/performance policy, and durable memory with the secret-safe boundary for Telegram fulfillment.
- Kept the requirement pending because no Telegram purchase fulfillment code or bot operations UI was implemented in this slice.
- Main checklist completion is now `235 / 238` items, or `98.7%` complete with `1.3%` remaining.
- Bumped AfroGate to `0.103.3` and updated `CHANGELOG.md`.

### Verification

- Ran `npm run version:check`.
- Ran `npm run secrets:check`.
- Ran `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Ran `git diff --check`; only existing CRLF conversion warnings were reported.

### Remaining

- Production protocol apply, Telegram purchase fulfillment, and native per-app VPN split tunneling remain future main-checklist work.

## 2026-05-29 Telegram Purchase Fulfillment Implementation

### Completed

- Implemented Telegram purchase fulfillment from the verified payment-order quota allocation path.
- Added a secret-free `telegramFulfillment` allocation response summary with delivery status, reason codes, selected client id, and usage-link availability.
- Reused the existing client-scoped subscription renderer to send one rendered VLESS URI only when the linked account has exactly one enabled renderable VLESS client.
- Added private Telegram usage/status deep-link support through `/start status`, plus a `/usage` command alias for linked account status.
- Kept duplicate allocations idempotent: quota allocation can return the previous allocation without resending a sensitive config.
- Marked the main Telegram purchase fulfillment checklist item complete.
- Main checklist completion is now `236 / 238` items, or `99.2%` complete with `0.8%` remaining.
- Bumped AfroGate to `0.104.0` and updated `CHANGELOG.md`.

### Verification

- Ran `npm run version:check`.
- Ran `npm run secrets:check`.
- Ran `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Ran `npm run typecheck`.
- Ran `npm run build --workspaces --if-present`.
- Ran `npm run test:e2e`; 16 tests passed.
- Ran `git diff --check`; only existing CRLF conversion warnings were reported.

### Remaining

- Production server-side protocol apply and native per-app VPN split tunneling remain future main-checklist work.
- Dedicated Telegram bot operations UI remains pending in the dashboard/sidebar backlog.

## 2026-05-29 Native Client Per-App VPN Split Tunneling

### Completed

- Added local per-app VPN selection to the client app with `All apps` and `Selected apps` modes plus common app presets for Instagram, Telegram, WhatsApp, Chrome, Firefox, and YouTube.
- Added a shared native split-tunnel profile contract that includes selected app identifiers, client config id, route group, platform readiness flags, and explicit privacy flags.
- Added native-client references for Android include-only VPN enforcement through `VpnService.Builder.addAllowedApplication` and documented the iOS managed per-app VPN boundary.
- Added focused Playwright coverage for the client split-tunnel panel and overflow guard.
- Updated the architecture, roadmap, repository structure, privacy, security/performance, enterprise deployment, memory, and checklist records with the implemented client/native boundary.
- Marked the main native per-app VPN split-tunneling checklist item complete.
- Main checklist completion is now `237 / 238` items, or `99.6%` complete with `0.4%` remaining.

### Verification

- Ran `npm run version:check`.
- Ran `npm run typecheck`.
- Ran focused `npm run test:e2e -- --grep "per-app VPN"`; 1 test passed.
- Ran `npm run build --workspaces --if-present`.
- Ran `npm run test:e2e`; 17 tests passed.
- Ran `npm run secrets:check`.
- Ran `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Ran `npm run contrast:check`.
- Ran `git diff --check`; only existing CRLF conversion warnings were reported.

### Remaining

- Production server-side protocol apply remains the only future main-checklist work.
- Packaged native Android/iOS app distribution and iOS MDM profile deployment remain deployment/productization work beyond the current client/native profile foundation.
- Dedicated Telegram bot operations UI remains pending in the dashboard/sidebar backlog.

## 2026-05-29 Production Protocol Server Apply Engine

### Completed

- Implemented the guarded live protocol server apply execution path behind the existing protocol apply, live executor, protocol-secret decrypt, and server-credential decrypt flags.
- Added an OpenSSH/SCP runner that records an accepted audit event before mutation, decrypts protocol/server secrets only in backend memory, stages rendered config to `/var/lib/afrogate/protocols`, installs the target service config, runs allowlisted timeout-bounded commands, verifies health, and records a secret-free execution snapshot.
- Kept blocked live requests non-mutating when any preflight gate is missing, and added final success/failure/rollback execution metadata without storing stdout, stderr, private keys, protocol secrets, or rendered secret-bearing config.
- Updated WireGuard live readiness to require the actual peer public key, added VLESS sing-box rendering from a protocol credential, and kept L2TP/IKEv2 on raw secret config material for their managed single-file apply target.
- Surfaced accepted/executed live-apply status and execution counts in the Settings protocol apply audit detail with typed English/Persian labels.
- Marked the production protocol server apply checklist item complete.
- Main checklist completion is now `238 / 238` items, or `100.0%` complete with `0.0%` remaining.
- Bumped AfroGate to `0.106.0` and updated `CHANGELOG.md`.

### Verification

- Ran `npm run typecheck`.

### Remaining

- Dedicated Telegram bot operations UI remains pending in the dashboard/sidebar backlog.
- Live route data-plane mutation, packaged native Android/iOS distribution, iOS MDM deployment, and fleet-specific protocol-apply rollout audits remain future productization/deployment work.

## 2026-05-29 Billing Telegram Operations Visibility

### Completed

- Added a Billing-page Telegram Operations panel that shows bot identity, BotFather token presence, webhook-secret readiness, user command readiness, alert readiness, Telegram API test status, outbound proxy state, linked Telegram accounts, delivery candidates, allocated linked orders, and pending paid allocations.
- Loaded superadmin Telegram bot settings as a non-blocking Billing-page operations signal so billing catalog/orders/accounts/rewarded ads still render if Telegram settings cannot be read.
- Kept the panel secret-safe: it does not show BotFather tokens, webhook secrets, Telegram chat IDs, delivered VLESS URIs, provider secrets, paid numbers, raw config JSON, or other clients' usage.
- Added English/Persian typed dashboard labels and Playwright coverage for the Billing-page Telegram Operations panel.
- Marked the dashboard/sidebar Telegram bot operations and Telegram purchase-fulfillment visibility items complete.
- Main checklist remains `238 / 238` complete. Dashboard/sidebar checklist now has `1` unchecked item remaining: PostgreSQL-backed admin-user persistence.
- Bumped AfroGate to `0.107.0` and updated `CHANGELOG.md`.

### Verification

- Ran `npm run typecheck`.
- Ran focused `npm run test:e2e -- --grep "billing page"`; 1 test passed.
- Ran `npm run version:check`.
- Ran `npm run build --workspaces --if-present`.
- Ran `npm run secrets:check`.
- Ran `npm audit --audit-level=moderate`; zero vulnerabilities found.
- Ran `npm run contrast:check`.
- Ran full `npm run test:e2e`; 17 tests passed.
- Ran `git diff --check`; only existing CRLF conversion warnings were reported.

### Remaining

- Persist admin users in PostgreSQL when production database auth replaces the current local file store.
- Live route data-plane mutation, packaged native Android/iOS distribution, iOS MDM deployment, and fleet-specific protocol-apply rollout audits remain future productization/deployment work.
