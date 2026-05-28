# Changelog

## 0.61.0 - 2026-05-28

- Added GitHub Actions CI for version consistency, repository-file secret scanning, workspace typecheck/build, dashboard Playwright smoke tests, and dependency audit.
- Added a local `npm run secrets:check` script for high-confidence token/private-key and sensitive filename checks without relying on a third-party CI action.
- Updated Playwright to use installed Edge locally and Chromium in CI after the workflow installs the browser.

## 0.60.0 - 2026-05-28

- Added a selected Tunnel Detail surface on the Routes page with guarded tunnel detail loading.
- Surfaced tunnel server, interface/operator, route group, lockability, endpoint, health score, and route-quality context with English/Persian labels.
- Kept tunnel detail read-only and non-mutating, with no service reload, OS route mutation, credential decrypt, or traffic switching.

## 0.59.0 - 2026-05-28

- Added an API-bound Server Detail surface that loads guarded server detail when a node is selected.
- Bound the detail view to server-scoped interface and tunnel inventory alongside access readiness, monitoring telemetry, and audit context.
- Kept the server detail workflow non-mutating: no credential decrypt, SSH connection, command execution, service reload, or OS route change.

## 0.58.0 - 2026-05-28

- Added Routes page controls for the default route assignment: auto-route, route lock, current/locked managed outbound, hysteresis, and cooldown.
- Bound the Routes page policy panel to guarded route-assignment APIs with admin-only writes and read-role visibility.
- Kept route policy changes control-plane-only, with no server OS route mutation, tunnel service reload, or live user traffic switching.

## 0.57.0 - 2026-05-28

- Added PostgreSQL and Drizzle inventory tables for managed server interfaces and tunnels.
- Added guarded admin CRUD APIs for server interfaces and tunnels with audit logging and server/interface ownership checks.
- Bound the dashboard tunnel panel to guarded `/api/admin/tunnels` rows with localized empty states while keeping sample data as an API-unavailable fallback.

## 0.56.0 - 2026-05-27

- Added guarded write-only server credential storage that encrypts submitted credentials, stores only metadata in API responses, links the active credential to the server access profile, and revokes the previously linked active credential.
- Added Servers page Access-tab forms for access-profile metadata and encrypted credential replacement with English and Persian labels.
- Preserved existing credential links when access profiles are updated without a credential field, while keeping credential decrypt, SSH execution, service reloads, OS route changes, and outbound enablement blocked.

## 0.55.0 - 2026-05-27

- Added protocol server apply adapter metadata to plans and stored snapshots, including supported protocols, dry-run support, command-runner mode, and data-plane readiness.
- Added a server-access credential boundary that verifies installed access profiles and active `server_credentials` records without decrypting credentials or executing commands.
- Surfaced the protocol apply adapter, dry-run-only runner, and credential boundary in Settings with English and Persian labels while keeping live server mutation blocked.

## 0.54.0 - 2026-05-27

- Added a superadmin-only live protocol apply request endpoint that records blocked audit events without executing SSH, shell commands, service reloads, OS route changes, secret decrypts, or outbound enablement.
- Extended protocol apply contracts and snapshots with `live` request mode plus blocked reason codes so stored event detail can explain why live mutation did not run.
- Surfaced a Settings live-apply request action and mode labels in English and Persian while keeping the production server-side apply engine disabled.

## 0.53.0 - 2026-05-27

- Added explicit protocol server apply preflight gates for feature flag, audited adapter, dry-run safety, provisioned outbound, outbound health, default disabled/maintenance posture, secret reference, server access, rollback, audit, and health verification.
- Persisted the preflight summary in protocol apply dry-run snapshots and audit payloads so stored event detail can explain why live server mutation is blocked or ready.
- Surfaced the preflight gate summary in Settings protocol apply plans and stored snapshot inspection with English and Persian labels while keeping live server mutation disabled until every data-plane gate passes.

## 0.52.0 - 2026-05-27

- Added read-role admin APIs for listing compact protocol server apply dry-run events and fetching stored snapshot detail on demand.
- Surfaced a Settings protocol apply audit panel with recent event cards, per-setup last-event linkage, and secret-safe snapshot inspection in English and Persian.
- Kept recent event payloads lightweight while preserving full dry-run command/config snapshots only in detail responses, with no SSH, shell, secret decrypt, service reload, OS route, or outbound enablement.

## 0.51.0 - 2026-05-27

- Added `protocol_apply_events` storage and a guarded admin API for recording secret-safe protocol server apply dry-run snapshots.
- Persisted protocol apply plan status, blocker reason codes, command/config counts, target server, and audit metadata without executing SSH, shell, or data-plane mutations.
- Surfaced a Settings action to record provisioned protocol apply dry-runs for audit in English and Persian while keeping the production server-side apply engine disabled.

## 0.50.0 - 2026-05-27

- Added target-server selection to Settings protocol drafts so WireGuard, VLESS, L2TP, and IKEv2 provisioning can bind generated managed outbounds to a real managed server.
- Added PostgreSQL/API support for `protocol_setups.target_server_id` and surfaced target labels plus server-access readiness in protocol setup responses.
- Updated protocol server apply plans to distinguish missing target servers from missing access profiles while still keeping all server OS/service mutation disabled until the audited adapter exists.

## 0.49.0 - 2026-05-27

- Added secret-safe protocol server apply plan summaries for saved WireGuard, VLESS, L2TP, and IKEv2 setup drafts, including readiness status, future command previews, config-change counts, and blocker reason codes.
- Returned protocol apply readiness from Settings provisioning responses while keeping server OS/service mutation disabled until a real audited adapter and server access target exist.
- Surfaced the protocol apply plan in Settings with English/Persian labels so admins can see planning, dry-run, blocked, and apply-ready state without exposing secrets.

## 0.48.0 - 2026-05-27

- Added a session-safe switch orchestration summary to route decision previews, combining route locks, cooldown, preflight, rollout, canary guard, sticky sessions, and rollback state into one next-action model.
- Persisted orchestration context in route decision event detail for audit.
- Surfaced the switch orchestrator in Settings with English/Persian labels so admins can see whether the safe next step is assignment-only, hold, canary, expand, rollback, or manual review.

## 0.47.0 - 2026-05-27

- Added advisory switch-rollout health evaluation to route decision previews, comparing canary candidates against packet-loss, jitter, latency, and score guards.
- Persisted rollout evaluation context in route decision event detail for audit.
- Surfaced the canary guard in Settings with English/Persian labels while keeping route movement planning-only until an audited adapter exists.

## 0.46.0 - 2026-05-27

- Added advisory switch-rollout/canary plans to route decision previews, including new-session canary percentages, route-consistency holds, rollback thresholds, and rollout steps.
- Persisted rollout context in route decision event detail for audit.
- Surfaced the rollout plan in Settings with English/Persian labels while keeping all data-plane movement planning-only until an audited adapter exists.

## 0.45.0 - 2026-05-27

- Added switch-preflight readiness summaries to route decision previews, covering feature flag, adapter, dry-run, guard, session-safety, rollback, cooldown, audit, and health-verification gates.
- Persisted switch-preflight context in route decision event detail so admins can audit why data-plane switching is still planning-only or blocked.
- Surfaced the preflight checklist in Settings with English/Persian labels while keeping live server OS/data-plane mutation disabled.

## 0.44.0 - 2026-05-26

- Added switch-execution summaries for assignment-only route apply events, including sticky-session, drain, cooldown, and future data-plane step state.
- Persisted switch-execution context in route decision event detail so admins can audit what was armed after an apply action.
- Surfaced the switch-execution result in Settings with English/Persian labels while keeping server OS/data-plane mutation disabled.

## 0.43.0 - 2026-05-26

- Added transparent switch-engine planning summaries to route decision previews with guard, session-pin, new-session route, drain, active switch, verify, and rollback phases.
- Surfaced switch-engine planning in Settings with English/Persian labels for status, mode, session impact, step readiness, and reason codes.
- Kept data-plane steps planning-only while the WireGuard apply adapter remains disabled or missing.

## 0.42.0 - 2026-05-26

- Added gaming-safe session-safety summaries to route decision previews, distinguishing safe switches, sticky holds, new-session-only drains, and emergency switches.
- Surfaced session-safety guidance in Settings with sticky TTL, drain wait, new-session-only, emergency, and disconnect-risk labels in English/Persian.
- Wired session-safety drain estimates into apply plans while keeping all real data-plane movement disabled.

## 0.41.0 - 2026-05-26

- Added advisory smart-load-balancing summaries to route decision previews with primary, secondary, standby, weight, adjusted-score, and risk guidance.
- Weighted managed route candidates by selected profile, health, packet loss, jitter, latency, throughput/load, loaded-latency, and high-security/route-consistency constraints.
- Surfaced smart-load-balancing guidance in Settings with English/Persian labels while keeping data-plane routing disabled.

## 0.40.0 - 2026-05-26

- Added explicit health-based switch reasons to route decision previews when the current managed route is unhealthy and a healthy managed candidate exists.
- Allowed assignment-only apply and apply-plan guards to bypass score-delta hysteresis for health-based switches while still respecting route lock, manual mode, cooldown, and managed-candidate gates.
- Surfaced current-route-unhealthy and health-based-switch reasons in Settings with English/Persian labels.

## 0.39.0 - 2026-05-26

- Added advisory smart-route profile recommendations to route decision previews.
- Compared usable managed candidates across balanced, stability, throughput, gaming, TCP, UDP, QUIC, DNS, and WireGuard profile scores.
- Surfaced the best candidate, profile score, and score delta from the selected profile in the Settings decision preview.
- Kept profile guidance privacy-safe and advisory-only; it uses synthetic route scores and does not inspect user traffic.

## 0.38.0 - 2026-05-26

- Added optional loaded-latency fields to route-probe contracts and backend ingest validation.
- Added backend bufferbloat assessment for route candidates, including loaded-latency delta, severity, SQM/AQM guidance, and avoid-under-load recommendations.
- Penalized health and route scores when loaded latency rises, with stronger impact for stability and gaming profiles.
- Surfaced loaded-latency guidance in Settings route candidate and decision review panels.

## 0.37.0 - 2026-05-26

- Added guarded route decision event detail reads at `/api/admin/route-decisions/events/:id` for read-role admins.
- Surfaced an on-demand Settings inspector for stored decision context and normalized dry-run snapshots.
- Kept the recent decision-events list compact while exposing secret-safe command/config snapshot details only when inspected.

## 0.36.0 - 2026-05-26

- Persisted normalized dry-run apply snapshots in `route_decision_events.decision_context` for both advisory preview records and assignment-only apply events.
- Included adapter state, command/config counts, command/config previews, and aggregate secret-safety status in the stored dry-run snapshot.
- Added dry-run command/config counts to route decision audit payloads.

## 0.35.0 - 2026-05-26

- Added dry-run-only WireGuard apply command previews to the route decision apply adapter metadata.
- Added secret-safe config-change previews for the future policy-routing adapter without exposing tunnel secrets or decrypted key material.
- Surfaced dry-run commands and config-change targets in the Settings apply plan while keeping all OS/data-plane execution disabled.

## 0.34.0 - 2026-05-26

- Added route apply adapter readiness metadata to decision preview apply plans for the future WireGuard policy-routing adapter.
- Added disabled-by-default `AFROGATE_ROUTE_DATA_PLANE_APPLY_ENABLED=false` configuration and surfaced the feature-flag state in Settings.
- Kept the adapter implementation marked missing and `dataPlaneReady = false` until a real audited server-side apply adapter exists.

## 0.33.0 - 2026-05-26

- Added a structured route apply plan to decision preview responses, including guard, assignment, drain, switch, verify, and rollback steps.
- Surfaced the apply plan in Settings with English/Persian labels and explicit control-plane versus future data-plane step badges.
- Kept real data-plane switching disabled by marking preview plans `dataPlaneReady = false` until audited server apply adapters exist.

## 0.32.0 - 2026-05-26

- Added a guarded assignment-only route decision apply API at `/api/admin/route-decisions/apply-preview`.
- Enforced route lock, cooldown, managed-candidate, and `switchRecommended` preview checks before updating the saved current outbound.
- Added a Settings Decision Preview action to apply the recommended route to control-plane assignment state while explicitly keeping server/data-plane routing disabled with `dataPlaneApplied = false`.

## 0.31.0 - 2026-05-26

- Added candidate-review details to the advisory route decision preview, including route disposition, score delta from the current route, rejection/recommendation reasons, and compact score-penalty reasons.
- Surfaced candidate recommendation and rejection explanations in the Settings Decision Preview panel with English/Persian labels.
- Kept the feature advisory-only: preview recording can store non-secret candidate context, but `applied_at` remains empty and live route switching is still future audited work.

## 0.30.0 - 2026-05-26

- Added guarded route decision event APIs for listing recent decisions and recording the current preview as an advisory audit row.
- Stored preview action, score profile, current/recommended outbounds, score delta, cooldown/lock state, and reason codes in `route_decision_events` with `applied_at` left empty.
- Added Settings UI support for recording advisory decision events and reviewing recent decision history.

## 0.29.0 - 2026-05-26

- Added guarded admin route assignment read/update APIs for the default assignment.
- Persisted auto-route, route lock, current managed outbound, locked managed outbound, hysteresis, and cooldown policy without applying live route changes.
- Added Settings controls for route assignment policy and refreshed the read-only decision preview after saving.

## 0.28.0 - 2026-05-26

- Added the route decision foundation with `route_assignments` and `route_decision_events` schema for future audited routing.
- Added a read-only admin route decision preview API that compares current and recommended routes with route lock, cooldown, hysteresis, score profile, and reason-code checks.
- Surfaced the advisory decision preview in Settings with English/Persian labels, while keeping live route switching disabled until audited apply logic exists.

## 0.27.0 - 2026-05-26

- Added a first-class advisory `gaming` route score profile for latency-sensitive users who need stable latency, low jitter, very low packet loss, and route consistency more than raw throughput.
- Exposed the gaming profile in Settings with English/Persian labels and route-settings persistence.
- Included gaming scores in route-quality hourly/profile analytics so future recommendations can reason about latency-sensitive windows without inspecting user traffic.
- Kept the new profile recommendation-only; automatic route switching still waits for audited route locks, cooldown, hysteresis, and drain-safe apply behavior.

## 0.26.0 - 2026-05-26

- Added route-quality dimension migration `0008_route_quality_dimensions.sql` for outbound, operator, score-profile, day-of-week, and time-window analytics.
- Added optional non-secret route-probe metadata in the agent/backend contract for route group, outbound, operator, and score profile.
- Added read-only predictive route recommendations for upcoming historically degraded windows in the Settings Route Intelligence panel.
- Recorded latency-sensitive/gaming routing direction: prioritize low jitter/loss and route consistency over raw throughput, without GPU dependency for the MVP.

## 0.25.0 - 2026-05-26

- Added PostgreSQL migration `0007_route_quality_hourly.sql` for compact hourly route-quality summaries.
- Added a backend route-quality aggregation scheduler that compacts recent synthetic route probes by route group, server, protocol, hour, and day-of-week.
- Updated route-quality analytics to prefer hourly summary rows and fall back to raw metrics when summaries are unavailable.
- Documented route-quality aggregation environment controls for low-resource VPS deployments.

## 0.24.0 - 2026-05-26

- Added a guarded read-only route-quality analytics endpoint that groups historical synthetic route probes by server, protocol, and hour-of-day.
- Added shared route-quality analytics contracts and advisory best/degraded time-window recommendations for future smart routing.
- Surfaced the first Route Intelligence panel in Settings, using typed English/Persian labels and keeping route changes manual until the audited apply engine exists.

## 0.23.0 - 2026-05-26

- Added backend advisory route scoring for Settings WireGuard candidates across balanced, stability, throughput, TCP, UDP, QUIC, DNS, and WireGuard profiles.
- Kept the existing candidate `score` field strategy-aware while exposing optional per-profile scores and compact reason codes for future explainable route decisions.
- Allowed route settings to carry protocol-specific traffic profiles such as TCP, UDP, QUIC, DNS, and WireGuard without inspecting user traffic or applying route changes automatically.

## 0.22.0 - 2026-05-26

- Added an opt-in protocol-aware route-probe foundation to the Python agent for TCP connect, UDP response, QUIC-labeled UDP response, and DNS lookup targets.
- Added shared/backend `routeProbes` metric contracts, ingest validation, latest-metrics mapping, and health-score penalties for degraded protocol probe status.
- Surfaced configured protocol-probe health in the dashboard Server Monitoring tab with typed English/Persian labels.
- Documented the new route-probe environment variables and kept all probes disabled unless synthetic targets are explicitly configured.

## 0.21.0 - 2026-05-25

- Added opt-in Python agent ping/jitter/packet-loss probes driven by configured synthetic targets in `AFROGATE_PING_TARGETS`.
- Kept route-quality probing privacy-safe: empty target configuration sends null route-quality metrics and never probes user destinations.
- Wired the probe values through the existing metrics ingest, health scoring, alert engine thresholds, and dashboard route-quality displays.

## 0.20.0 - 2026-05-25

- Merged live agent WireGuard telemetry into Settings route candidates alongside managed outbound health rows.
- Added backend scoring for agent-sourced WireGuard candidates based on tunnel state, active peers, handshake freshness, and server health.
- Extended Settings WireGuard health cards with candidate source, active peer count, latest handshake age, and tunnel throughput.
- Marked real per-tunnel WireGuard health checks for admin route selection complete while leaving ping/jitter/packet-loss and protocol-aware probes for the next step.

## 0.19.0 - 2026-05-25

- Added privacy-safe WireGuard interface and peer telemetry to the Python agent using `wg show all dump` when available.
- Added shared/backend `wireGuardInterfaces` contracts, ingest validation, latest-metrics/admin-server response mapping, and health-score penalties for down/degraded tunnel state.
- Surfaced WireGuard tunnel status, active peer counts, handshake freshness, and traffic rates in the dashboard Server Monitoring and Interfaces tabs.
- Documented that WireGuard telemetry reports peer fingerprints only and never sends raw private keys, preshared keys, or full public keys.

## 0.18.0 - 2026-05-25

- Added an initial superadmin protocol provisioning endpoint that converts saved Settings drafts into managed outbound rows.
- Linked protocol setup drafts to their provisioned outbound records while preserving encrypted `secretRef` references.
- Kept provisioned outbounds disabled and in maintenance mode by default so real server apply and health validation remain explicit later steps.
- Added a Settings UI action for provisioning saved protocol drafts and showing managed-outbound status.

## 0.17.0 - 2026-05-25

- Added an encrypted Settings secret-record store for write-only WireGuard/private-key material.
- Added a guarded superadmin Settings secret API that stores encrypted secret payloads and returns only `secretRef` metadata.
- Linked protocol setup draft creation to active matching `secretRef` values so raw private keys stay out of protocol config rows.
- Updated the dashboard Settings WireGuard flow to save private keys through the encrypted backend path, clear the field, and show encrypted-storage readiness.

## 0.16.0 - 2026-05-24

- Added PostgreSQL-backed Settings persistence tables for protocol setup drafts and route selection settings.
- Added guarded admin Settings APIs for reading setup state, saving automatic/manual route settings, and creating superadmin-only protocol drafts without storing raw secrets.
- Bound the dashboard Settings page to the guarded backend API while keeping sample WireGuard health data as a fallback when no real WireGuard outbounds exist.
- Added real WireGuard candidate shaping from `wireguard` outbounds and their latest outbound health samples.

## 0.15.0 - 2026-05-24

- Added a dashboard Settings page for guided WireGuard and system setup.
- Added write-only private-key handling in the Settings draft flow, clearing the secret from the form after validation and never echoing it in the preview.
- Added initial automatic/manual route controls, WireGuard health comparison, and smart load-balance strategy selection in Settings.
- Added a superadmin-only protocol draft factory for WireGuard, VLESS, L2TP, and IKEv2 setup planning.
- Added typed English/Persian Settings labels and sidebar navigation for the setup workflow.

## 0.14.0 - 2026-05-24

- Added a backend alert engine scheduler for stale servers, stale metrics, CPU/RAM/disk thresholds, route-quality thresholds, and unhealthy outbounds.
- Added configurable alert thresholds through environment variables while reusing the existing guarded alert API and alerts table.
- Recorded the guided, secret-safe WireGuard/system Settings page as the next important UI/UX setup workflow.

## 0.13.0 - 2026-05-24

- Added a lightweight backend outbound health-check scheduler for enabled, non-maintenance outbounds.
- Added synthetic HTTP and TCP outbound probes using non-secret `healthUrl` or `healthHost`/`healthPort` config targets.
- Persisted outbound health samples and updated outbound health status with fail and recovery threshold handling.

## 0.12.0 - 2026-05-24

- Added a shared backend outbound HTTP client for Telegram/API calls, including optional localhost HTTP proxy routing through `AFROGATE_OUTBOUND_PROXY_URL`.
- Added disabled-by-default Telegram critical-alert delivery for open critical backend alerts when bot token and alert chat environment values are configured.
- Added best-effort audit rows for Telegram alert send/failure outcomes without committing or exposing Telegram secrets.

## 0.11.0 - 2026-05-24

- Bound the dashboard Servers page to guarded `/api/admin/servers` rows after admin login, including real latest metrics, access-profile state, alert counts, and outbound counts when available.
- Bound the dashboard Routes page and dashboard outbound panel to guarded `/api/admin/outbounds` and `/api/admin/route-failover-events` rows, with sample data used only as an API-unavailable fallback.
- Added localized empty states for real server, outbound, and route-failover API lists.

## 0.10.2 - 2026-05-24

- Fixed local dashboard login CORS by using `127.0.0.1` for the local API URL and allowing both `127.0.0.1:4000` and `localhost:4000` as development origins.
- Trimmed comma-separated backend CORS origins so local environment lists are more forgiving.
- Added an accessible show/hide password icon button to the dashboard admin login form.

## 0.10.1 - 2026-05-24

- Moved direct local development to dashboard port `4000` and backend port `7000`.
- Updated dashboard API defaults, CORS examples, local PostgreSQL `.env` generation, Playwright smoke-test wiring, and local development documentation for the new ports.
- Updated Ubuntu deployment samples so the backend internal port is `7000` and the dashboard dev/preview port is `4000`.
- Made the backend load the repository root `.env` as well as a workspace `.env` so root workspace dev commands pick up local database and login settings.

## 0.10.0 - 2026-05-24

- Added a guarded `/api/admin/alerts` read endpoint for open/resolved alert rows.
- Added shared alert response contracts and dashboard polling through the signed admin session.
- Bound the dashboard Alerts page, dashboard alert panel, summary critical count, and sidebar alert badge to real backend alert rows when available.
- Fixed the local PostgreSQL setup script so missing role/database checks handle empty `psql` scalar output correctly.

## 0.9.2 - 2026-05-24

- Added a Windows local PostgreSQL setup script that creates the `afrogate` role/database and runs migrations.
- Documented why development should use PostgreSQL instead of SQLite for AfroGate.
- Added a root `db:setup:local` script for repeatable local database setup.

## 0.9.1 - 2026-05-24

- Standardized direct local development ports to dashboard `3000` and backend `8000`.
- Made the dashboard Vite server use strict ports so duplicate frontends fail fast instead of drifting to `3001+`.
- Added Playwright browser smoke-test wiring and local development documentation for frontend/backend/agent API wiring.

## 0.9.0 - 2026-05-24

- Added protected server agent heartbeat ingestion at `POST /api/agents/heartbeat`.
- Updated heartbeats to refresh server `last_seen_at`, hostname/platform, and status without noisy audit rows.
- Updated the Python agent to send heartbeat metadata before each metrics push through the same token and outbound proxy path.

## 0.8.0 - 2026-05-24

- Added an admin-guarded agent registration endpoint at `POST /api/agents/register`.
- Agent registration now upserts the server inventory row and returns a one-time plaintext agent token while storing only its SHA-256 hash.
- Metrics ingest now accepts non-revoked database-issued agent tokens with `metrics:write` scope, while keeping `AFROGATE_AGENT_TOKEN` as a legacy fallback.

## 0.7.0 - 2026-05-24

- Added the first Servers page edit workflow with selectable server cards and a dedicated edit panel.
- Added server edit tabs for overview, safe access/bootstrap, monitoring, interfaces, and audit state.
- Kept the access/bootstrap edit surface read-only and secret-safe until credential mutation/storage is implemented.

## 0.6.3 - 2026-05-24

- Documented protocol-aware smart routing responsibilities across agent, backend, and repository structure.
- Added privacy-safe TCP, UDP, QUIC/HTTP3, DNS, and WireGuard probe guidance for route health detection.
- Added smart-route scoring guidance for low-speed stability, high-speed throughput, and protocol-specific traffic profiles.

## 0.6.2 - 2026-05-24

- Restored the Users page title while keeping server resource details off management pages.
- Replaced the Add user modal with a separate inline create-user section above the Users table.
- Kept server card country/location metadata inline with the server name.

## 0.6.1 - 2026-05-24

- Limited the global dashboard server/resource strip to the main Dashboard view.
- Simplified the Users page to focus on the admin-user history table.
- Moved admin-user creation into an Add user modal and inserted successful creates directly into the table.

## 0.6.0 - 2026-05-23

- Added a `Users` sidebar page for superadmin-focused admin account management.
- Added guarded admin-user management APIs under `/api/admin/users` for listing, creating, disabling/enabling, deleting, and changing passwords for managed admin users.
- Preserved the bootstrap `superadmin` account as protected and immutable from normal user-management actions.
- Added `supervisor` as a managed admin-user role with read-oriented dashboard access.
- Added a local ignored admin-user store at `AFROGATE_ADMIN_USERS_FILE` so managed admin accounts persist without committing secrets.

## 0.5.1 - 2026-05-23

- Prefilled the dashboard login username with `superadmin` so the visible bootstrap username is an actual submitted value rather than placeholder-only text.
- Added required browser validation and password autofocus to reduce failed local login attempts.

## 0.5.0 - 2026-05-23

- Replaced the human-facing admin token login with username/password admin login through `/api/auth/login`.
- Added signed admin session tokens for dashboard sessions while keeping the legacy admin bearer token as a fallback for direct API bootstrap use.
- Added a permanent `superadmin` role concept, optional configured admin login, MFA-ready session metadata, and server-side role handling that always lets superadmin pass admin guards.
- Updated the dashboard login form, English/Persian auth copy, environment example, and security policy for the superadmin/admin login model.

## 0.4.1 - 2026-05-23

- Switched Persian dashboard typography from IRANSans to the local YekanBakh FaNum variable font.
- Updated DOM and ECharts Persian font-family wiring so canvas chart labels match the app typography.
- Updated multilingual UI documentation and project memory to point at the local YekanBakh asset path.

## 0.4.0 - 2026-05-23

- Added guarded `/api/admin` server management APIs for inventory, detail, create, update, and delete operations.
- Added guarded outbound management APIs for listing, detail, create, update, delete, priority moves, and route failover history reads.
- Added shared admin management response contracts and audit log writes for server and outbound mutations.
- Kept outbound management secret-safe by rejecting secret-like config keys and returning only `hasSecretRef` with redacted config values.

## 0.3.11 - 2026-05-23

- Compacted shared panel headers so metadata such as `3 nodes`, `3 links`, and `3 visible` renders inline with the title.
- Reduced panel padding, body gaps, and table row padding for denser network-operations monitoring sections.
- Kept server-row CPU/RAM/disk indicators on one desktop line to reduce wasted row height.

## 0.3.10 - 2026-05-23

- Repositioned the desktop sidebar collapse control as a professional icon-only handle on the sidebar/content divider.
- Mirrored the collapse handle placement and icon direction for Persian/RTL layouts.

## 0.3.9 - 2026-05-23

- Added a desktop sidebar collapse/expand control that turns the sidebar into an 80px icon rail.
- Persisted the sidebar width preference in local storage so monitoring displays reopen in the chosen layout.
- Added English and Persian accessible labels/tooltips for the sidebar collapse control.

## 0.3.8 - 2026-05-23

- Added a UI/UX audit checklist for the dense monitoring dashboard and remaining layout hardening work.
- Reworked dashboard server rows into compact icon-based CPU/RAM/disk/download/upload indicators with accessible labels and tooltips.
- Simplified the ECharts health timeline density by removing the visible slider, tightening chart spacing, and keeping inside zoom support.
- Verified the 1920x1080 second-LCD Dashboard view has zero main-content overflow and no measured text overflow in English or Persian.

## 0.3.7 - 2026-05-23

- Added sidebar alert severity state so the Alerts navigation item shows an amber warning badge or a red critical badge with localized counts.
- Improved Alerts navigation accessibility by including the current warning/critical count in the item label.

## 0.3.6 - 2026-05-23

- Strengthened Persian dashboard typography so the app subtree, controls, bold text, and ECharts use the local IRANSans family.
- Added Persian-aware dashboard formatting for clock, percentages, throughput units, latency, packet loss, thresholds, counts, and chart labels.
- Localized known fallback monitoring sample labels in Persian mode, including server names, operators, outbounds, and CPU/RAM labels.

## 0.3.5 - 2026-05-23

- Fixed dashboard packet-loss translations so English uses `Packet loss` / `Loss` and Persian uses `افت بسته`.

## 0.3.4 - 2026-05-23

- Compacted the dashboard information density with smaller panels, cards, rows, charts, and resource strips.
- Reworked the dashboard grid so the second-LCD 1920x1080 monitoring view fits without main-content overflow.
- Added truncation and fixed row sizing to reduce Persian/English label wrapping in dense operational panels.

## 0.3.3 - 2026-05-23

- Changed the desktop dashboard shell so the sidebar remains fixed in place and only the main content pane scrolls.
- Verified English/LTR desktop and second-LCD layouts keep the sidebar flush left with no document-level scrolling.

## 0.3.2 - 2026-05-23

- Fixed the dashboard sidebar so navigation wraps instead of horizontally scrolling on mobile and remains sticky on desktop.
- Hardened dashboard responsive layouts across Dashboard, Servers, Routes, and Alerts pages for English and Persian.
- Added stable navigation data attributes for browser-level responsive checks.

## 0.3.1 - 2026-05-23

- Added local IRANSans/Iranian Sans font-face wiring for Persian dashboard mode without using a CDN.
- Added the dashboard font asset folder, copied the local `Iranian Sans.ttf` asset into it, and documented license-safe font handling.

## 0.3.0 - 2026-05-23

- Added English/Persian dashboard translations with persisted language selection and page direction updates.
- Added a language icon toggle at the bottom of the sidebar beside the version display.
- Added multilingual UI policy documentation and extended version checks to cover local plugin manifests.

## 0.2.1 - 2026-05-23

- Split dashboard traffic monitoring into separate download and upload values in the resource strip, summary cards, capacity panel, and server rows.
- Removed the hardcoded single outbound throughput card from the dashboard.

## 0.2.0 - 2026-05-23

- Added AfroGate versioning workflow with SemVer scripts, changelog policy, version consistency checks, and a local Codex plugin/skill.
- Added the dashboard sidebar version footer sourced from root `package.json`.
- Captured current MVP foundation state after monitoring storage, ECharts dashboard, system resources, sidebar pages, admin guard foundation, control-plane egress, and outbound-management planning.
