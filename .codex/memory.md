# AfroGate Memory

## Stable Product Facts

- Product name: AfroGate / Afrogate.
- First milestone: monitoring MVP.
- Long-term goal: branded enterprise panel that can be sold and improved beyond current third-party panels.
- Current users connect through Telegram bot.
- User-facing channels: Telegram first, app later.
- Admin wants dashboard first, with Telegram alerts.
- Product must be safe for people and human-rights conscious.
- Product should support Persian and English.
- Admin needs remote-friendly management while traveling.
- Backups are required, especially for monitoring and configuration data.

## Current Scale and Capacity

- Initial target: about 150 users.
- Future target: about 10000 users.
- Current total user outbound download is around 20 MB/s.
- Each user should have at least 1 MB/s when capacity allows.
- If the server is quiet, users should be able to use maximum available speed.
- Billing/usage model is volume-based: each GB costs configurable `X` toman.

## Infrastructure Facts

- Current Iran servers: 3.
- Server count should be unlimited in design.
- Iran server examples:
  - 6 cores / 6 GB RAM.
  - 4 cores / 4 GB RAM.
- Germany server:
  - 4 cores / 8 GB RAM.
  - 1 Gbps internet.
- Iran servers have 1 Gbps internet.
- Starlink observed speed test over wireless router:
  - download around 250 Mbps.
  - upload around 67 Mbps.
  - ping around 50 ms.

## Operator and Tunnel Facts

- `ether1`: Mobinnet.
- `ether2`: Irancell.
- `ether5`: Irancell.
- `ether1` connected to `wg1`.
- `ether2` connected to `wireguard2`.
- `ether5` connected to `wireguard3`.

## Quality Rules

- Packet loss should be very low.
- Ping best case is under 10 ms.
- Ping worst case is above 150 ms.
- High ping and jitter cause stuck requests, delayed volume allocation, and laggy speed.
- Alerting should happen within seconds.
- Auto route is desired, but route lock must be available for users/configs that should not move.

## Current Tooling Context

- Current production/operations use Marzban and panel Sanayi/X-UI style tooling.
- AfroGate should not simply depend on another app forever; integration can be used first, then replaced gradually.

## Durable Technical Preferences

- Separate control plane, monitoring plane, and data plane integration.
- Keep server agent lightweight.
- Store minimal personal data:
  - Telegram user id or username.
  - paid number only when needed.
- Avoid storing traffic content.
- Keep audit logs for sensitive admin actions.
- Encrypt secrets and backups.
- Enhancement work should be progressive: visibility first, reliability second, manual control third, automation fourth, enterprise readiness last.
- Current GitHub remote is `https://github.com/Benjil44/afrogate.git`.
- Repository has been pushed to GitHub and local `main` tracks `origin/main`.
- Repository can still be developed local-first; push when useful.
- Initial implementation direction: NestJS/TypeScript backend, React/Vite/Tailwind dashboard, PostgreSQL database, Python agent.
- Docker should not block the first local MVP. For Ubuntu, start with native services plus systemd/Nginx; Docker Compose can be added later.
- Current repository structure uses `apps/backend`, `apps/dashboard`, `apps/agent`, `packages/shared`, `infra/ubuntu`, and `infra/docker`.
- Clean code, typed boundaries, and no duplicated business logic are required.
- VPS efficiency is a core requirement because servers are expensive and low-resource.
- Security posture is default-deny: close public holes, require roles, protect metrics ingest, and keep database/cache/backend internals private.
- Stable internet is treated as a human-rights and safety goal, not a casual feature.
- Dashboard should stay static-first where possible to reduce server runtime exposure and resource use.
- Tailwind CSS is the dashboard styling direction for faster UI implementation and consistent operational components.
- Backend persistence uses PostgreSQL with Drizzle ORM runtime queries and hand-written SQL migrations to avoid vulnerable migration dependencies.
- Apps consume shared TypeScript contracts from built `packages/shared/dist` declarations; app prebuild/pretypecheck scripts build the shared package first.
- The dashboard polls the backend latest-metrics endpoint every 10 seconds and keeps a local sample fallback so the UI remains useful while the database/API is offline.
- Dashboard monitoring charts use Apache ECharts with direct modular imports, canvas rendering, and backend `/api/metrics/timeseries` data.
- Dashboard should serve a second-LCD/NOC display use case: one dense screen with clock, live status, health chart, servers, tunnels, alerts, outbounds, capacity, and control-plane status.
- Sidebar items must correspond to real pages; default page is the NOC dashboard, then Servers, Routes, and Alerts should become functional views before adding later pages.
- Agents collect local system resources for each installed system: CPU load, RAM usage, all detected storage volumes, network interface counters, and traffic rate deltas.
- Agents collect WireGuard interface and peer telemetry from `wg show all dump` when available, but report only interface names, health/rate counters, handshake age, and SHA-256 peer-key fingerprints. Raw public keys, private keys, and preshared keys must not be stored or sent.
- Future smart routing should be protocol-aware and privacy-safe: agents collect synthetic TCP, UDP, QUIC/HTTP3, DNS, and WireGuard route-health probes against configured targets, while backend scoring chooses routes by protocol profile and speed profile without inspecting user traffic contents or storing destination history.
- Smart-route speed profiles should separate low-speed stability paths from high-speed throughput paths. Low-speed paths prioritize low packet loss, low jitter, and stable latency; high-speed paths prioritize throughput headroom and saturation while still rejecting bad loss/jitter.
- Dashboard header shows local system resources first, then a divider, then connectivity/routing/traffic monitoring sections.
- Restricted Iran servers need a control-plane egress path for Telegram/API access; first implementation should use `AFROGATE_OUTBOUND_PROXY_URL` with a localhost HTTP proxy exposed by a local VLESS/sing-box/xray or gateway client.
- Server management should use temporary bootstrap credentials only when needed, then agent-first monitoring plus a dedicated SSH-key-based management user; do not build normal workflows around stored reusable root passwords.
- Outbound management should support ordered priorities, move up/down, health checks, failover thresholds, cooldowns, maintenance mode, and route locks.
- Server access and outbound failover database foundation exists in PostgreSQL migration `0002_server_access_outbounds.sql`; mutation APIs should wait for admin auth/roles.
- Backend has bootstrap admin bearer-token and role-guard foundations; future sensitive APIs should use `AdminTokenGuard` plus `Roles`.
- Dashboard admin auth now uses username/password login through `/api/auth/login`, with signed bearer session tokens stored client-side after login.
- `superadmin` is the permanent bootstrap/root dashboard account concept; it must not be removable, disableable, or password-changeable by normal admins in future user-management flows.
- Configured `admin` accounts can have broad operational access, but they must not be allowed to remove, disable, or change the `superadmin` account.
- Legacy `AFROGATE_ADMIN_TOKEN` is kept only as a direct API/bootstrap fallback; it is no longer the human-facing dashboard login model.
- Dashboard now has a `Users` page for admin account management. Managed admin users are stored as scrypt hashes in `AFROGATE_ADMIN_USERS_FILE` (default `tmp/admin-users.json`, ignored by git); bootstrap/env accounts remain protected configuration-owned accounts.
- Managed admin-user roles now include `owner`, `admin`, `supervisor`, `support`, and `auditor`; `supervisor` is intended as read-oriented dashboard supervision access.
- AfroGate uses one product version across root/workspace packages, shown in the dashboard sidebar and tracked in `VERSION` plus `CHANGELOG.md`.
- After every meaningful implementation section, agents should run the appropriate `npm run version:*` command, update `CHANGELOG.md`, run `npm run version:check`, and commit the bump with the implementation.
- Local versioning guidance lives in `docs/versioning-policy.md` and the `plugins/afrogate-versioning` Codex plugin.
- Dashboard traffic display separates download and upload values; current MVP mapping uses agent aggregate inbound/RX as download and outbound/TX as upload until route-aware attribution is added.
- Dashboard multilingual support uses `apps/dashboard/src/i18n.ts` for English/Persian strings, persists language in localStorage, and exposes the language icon toggle in the sidebar footer.
- New dashboard user-facing labels should be added to the typed translation object in the same commit as the UI change.
- Packet loss should be labeled `Packet loss` / `Loss` in English and `افت بسته` in Persian dashboard contexts.
- Persian mode should format generated numbers/times/units through the dashboard formatter: Persian digits, `٪`, `مگابایت/ث`, `میلی‌ثانیه`, localized thresholds, and local sample display labels.
- Persian dashboard typography is wired to local YekanBakh assets under `apps/dashboard/public/assets/fonts/YekanBakh/` through `apps/dashboard/public/assets/fonts/yekanbakh.css`; no CDN font source should be used, and proprietary font files should only be committed with a valid license.
- Persian typography must be applied both through CSS (`html[lang="fa"]` and `[lang="fa"]`) and ECharts options, because canvas chart text does not inherit DOM font styles reliably.
- Dashboard sidebar should not use horizontal scrolling; mobile nav wraps in a compact grid and desktop sidebar stays sticky with no sidebar scroll.
- Responsive checks should cover Dashboard, Servers, Routes, and Alerts in English and Persian at mobile, tablet, desktop, and second-LCD widths.
- Desktop dashboard shell uses a fixed-height viewport layout: document scrolling is disabled, the sidebar stays fixed at the left in English/LTR, and `main > section` owns vertical scrolling.
- The second-LCD dashboard target is 1920x1080 with no main-content overflow; keep NOC sections compact, use truncation for dense labels, and prefer panel-internal density over growing the page height.
- The global server/resource strip belongs only on the main Dashboard view; management pages should stay focused on their own workflow data.
- Users page admin-user creation should open as an inline section above the users table, not as a blocking modal.
- Sidebar alert navigation state is driven by computed alert rows: critical count wins and must render red; warning-only state renders amber; counts should use the current dashboard formatter.
- Dashboard UI/UX audits should check Dashboard, Servers, Routes, and Alerts in English and Persian at mobile, tablet, 1440x900, and 1920x1080; the second-LCD Dashboard target is `0px` main-content overflow and zero measured text-overflow cases.
- Dense dashboard rows should use compact icon indicators with accessible labels/tooltips for repeated CPU/RAM/disk/download/upload values, especially in Persian where localized units are longer.
- Desktop sidebar collapse state is stored in `afrogate.dashboard.sidebar`; expanded width is 248px, collapsed width is 80px, and mobile/tablet navigation should stay full-width even when the stored state is collapsed.
- Sidebar collapse/expand should remain an icon-only edge handle on the sidebar/content divider, not a text button row inside the sidebar header.
- Panel header metadata such as node/link/visible counts should stay inline with the panel title; avoid two-line headers for short operational metadata.
- Servers page now has an edit workflow: selecting a server opens Overview, Access, Monitoring, Interfaces, and Audit tabs. The Access tab can save access-profile metadata and store a write-only encrypted server credential linked to `server_access_profiles.credential_ref`; decrypted credentials are never returned to the dashboard.
- Backend admin server/outbound APIs live under `/api/admin/*`, use `AdminTokenGuard` plus `RolesGuard`, allow read access to admin/supervisor/support/auditor roles, and reserve writes for admin/owner/superadmin.
- Server and outbound write APIs create audit log rows for create, update, delete, and outbound priority moves.
- Outbound API responses do not expose `secretRef` values; they expose `hasSecretRef`, redact secret-like config keys, and reject new outbound config payloads containing secret-looking keys so raw secrets stay out of normal route management.
- Agent onboarding now uses an admin-guarded `POST /api/agents/register` endpoint to upsert a server and issue a one-time plaintext agent token stored only as a SHA-256 hash in `agent_tokens`; metrics ingest accepts non-revoked registered tokens with `metrics:write` scope and keeps the legacy `AFROGATE_AGENT_TOKEN` only as a fallback.
- Python agents now send a lightweight `POST /api/agents/heartbeat` before metrics pushes; the backend updates `servers.last_seen_at`, hostname/platform, and status without writing noisy audit rows.
- Direct local development uses fixed ports: dashboard `4000` and backend `7000`. Vite is strict-port configured so AfroGate must fail fast instead of drifting to `4001+`; ports `3000` and `8080` stay available for other local apps.
- Backend config loading checks both the backend workspace `.env` and the repository root `.env`, so root workspace dev commands can use the local PostgreSQL/login settings created by `npm run db:setup:local`.
- Local browser development should prefer `127.0.0.1` consistently for the dashboard API URL while allowing both `http://127.0.0.1:4000` and `http://localhost:4000` in backend CORS.
- Playwright browser smoke tests live under `tests/e2e`, run with `npm run test:e2e`, and target the installed Microsoft Edge channel for local checks without requiring a bundled browser download.
- Development database should stay PostgreSQL, not SQLite, because AfroGate uses PostgreSQL-specific migrations and query behavior (`jsonb`, UUIDs, `ON CONFLICT`, and token scope checks). Windows local setup is scripted through `npm run db:setup:local`.
- Dashboard alert state now prefers guarded backend rows from `/api/admin/alerts` after admin login; fallback/computed alert rows are only for local sample or API-unavailable states.
- The current alert API is read-only and scoped to listing existing alert rows. Alert resolution, filters in the UI, delivery retries, and the full alert engine remain later MVP work.
- Dashboard Servers and Routes pages now prefer guarded admin API rows from `/api/admin/servers`, `/api/admin/outbounds`, and `/api/admin/route-failover-events` after login; sample server/outbound/failover rows are fallback-only when those APIs are unavailable.
- Backend Telegram critical-alert delivery is disabled by default and only starts when `AFROGATE_TELEGRAM_ALERTS_ENABLED=true` plus bot token/chat id are configured. It reuses the shared outbound HTTP client and honors `AFROGATE_OUTBOUND_PROXY_URL` for restricted control-plane egress.
- Backend outbound health scheduling is enabled by default, checks only due enabled/non-maintenance outbounds, supports synthetic HTTP `healthUrl` and TCP `healthHost`/`healthPort` targets, stores samples in `outbound_health_checks`, and applies fail/recovery thresholds before changing `outbounds.health_status`.
- Backend alert engine is enabled by default and creates/resolves alerts from latest server metrics, stale server/metrics timestamps, route quality thresholds, and outbound health status using idempotent source/title keys.
- WireGuard and system setup should become a guided Settings page before real-server onboarding depends on manual config editing. WireGuard private keys and tunnel secrets must be write-only and secret-safe.
- The dashboard Settings page is the canonical setup surface for protocol/system onboarding. Its current MVP covers a guided WireGuard draft, write-only private-key validation, automatic/manual route controls, WireGuard health comparison, smart load-balance strategy selection, and a superadmin-only protocol draft factory for WireGuard, VLESS, L2TP, and IKEv2.
- Settings protocol drafts and route selection settings are now persisted through guarded backend APIs under `/api/admin/settings*`, backed by PostgreSQL tables `protocol_setups` and `route_settings`.
- Settings APIs must not return raw tunnel secrets. The Settings private-key flow now stores write-only key material in encrypted `secret_records` rows through `/api/admin/settings/secrets`, returns only `secretRef` metadata, and links protocol setup drafts to active matching secret references.
- Settings WireGuard route candidates now merge managed outbound health rows with live agent WireGuard telemetry. Agent-sourced candidates are health/selection signals only until a managed outbound or server-side apply step exists for that tunnel.
- Initial Settings/protocol provisioning converts saved protocol setup drafts into disabled, maintenance-mode managed outbound rows with secret references preserved; it does not mutate real server OS/service config yet.
- Settings/protocol setup responses now include a secret-safe server apply plan for WireGuard, VLESS, L2TP, and IKEv2. The plan exposes readiness status, future command/config previews, feature-flag and server-access blockers, and secret-safe guarantees, but `canExecute` remains false until a real audited adapter and target server access are implemented.
- Settings protocol drafts can now store a target managed server. Provisioning links generated managed outbounds to that target server, and protocol server apply readiness treats access as ready only when the target server has an installed access profile with a stored credential reference.
- Protocol server apply dry-runs can now be recorded as `protocol_apply_events` audit snapshots for provisioned setup drafts. These snapshots store secret-safe plan state, command/config counts, target server, outbound id, readiness flags, and blocker reasons, but they do not execute SSH, shell commands, secret decrypts, OS route changes, service reloads, or outbound enablement.
- Protocol server apply dry-run events are now listable for read-role admins through a compact Settings API and inspectable on demand through a detail endpoint. The list omits stored snapshots; detail returns the secret-safe dry-run snapshot for dashboard inspection without exposing decrypted secrets or executing server mutations.
- Protocol server apply plans and stored dry-run snapshots now carry explicit preflight gates for feature flag, audited adapter, dry-run safety, provisioned outbound, outbound health, default disabled/maintenance posture, secret reference, server access, rollback, audit, and health verification. Live server mutation remains blocked until every data-plane gate passes; secret-safe dry-run recording can still be used for audit while the adapter is missing.
- Live protocol server apply requests now have a superadmin-only non-mutating boundary. `/api/admin/settings/protocol-setups/:id/server-apply/live-request` records a blocked `protocol_apply_events` audit snapshot with `applyMode = live`, blocked reason codes, and `dataPlaneMutationExecuted = false`; it does not decrypt server-install secrets, open SSH, run shell commands, reload services, change OS routes, or enable outbounds.
- Protocol server apply plans now include an adapter scaffold with supported protocol metadata, a dry-run-only command-runner boundary, and a server-access credential boundary. The credential boundary checks for an installed access profile and an active `server_credentials` row but keeps `credentialDecryptAllowed = false`; live command execution remains blocked until the production apply engine is implemented and audited.
- Server credential storage is available through `POST /api/admin/servers/:id/credentials`: it requires an existing access profile, encrypts the submitted secret with `AFROGATE_SECRETS_KEY`, stores it in `server_credentials`, links the active credential id to the access profile, revokes the previously linked active credential, writes an audit log, and returns only credential metadata plus the refreshed server summary.
- Settings/protocol production readiness still needs real per-tunnel health metrics and a server-side apply engine before production use.
- Agent ping/jitter/packet-loss probes are opt-in through configured synthetic targets such as `AFROGATE_PING_TARGETS`; empty configuration keeps route-quality fields null, and probes must not use user destinations or traffic-derived hosts.
- Agent protocol-aware route probes are opt-in through `AFROGATE_TCP_PROBE_TARGETS`, `AFROGATE_UDP_PROBE_TARGETS`, `AFROGATE_QUIC_PROBE_TARGETS`, and `AFROGATE_DNS_PROBE_TARGETS`; empty configuration sends no `routeProbes`, and UDP/QUIC-labeled probes require controlled responders rather than arbitrary public endpoints.
- Backend Settings route candidates now receive advisory per-profile scores for balanced, stability, throughput, gaming, TCP, UDP, QUIC, DNS, and WireGuard decisions; the selected `score` follows the saved route strategy, but no automatic route apply happens until the later audited decision engine with cooldown, hysteresis, and route locks exists.
- Future route intelligence should learn time-of-day and day-of-week quality patterns per server, outbound, operator, and protocol profile from privacy-safe synthetic metrics. Example: Irancell/BTS may be better or worse during specific windows such as 18:00-20:00, and AfroGate should first suggest better paths before later automating transparent changes.
- Transparent route changes must preserve user experience: use route locks, sticky assignments, cooldown, hysteresis, drain-safe switching, and route-decision audit reasons so users do not feel unstable IP/path changes.
- Latency-sensitive users such as gamers should be optimized for stable latency, low jitter, low packet loss, route consistency, and fast congestion avoidance rather than raw Mbps or speedtest numbers. AfroGate cannot guarantee absolute zero packet loss on broken ISP/radio/upstream paths, but it should minimize perceived loss through predictive routing, stable assignments, bufferbloat detection, and careful reroute policy.
- AfroGate now has a first-class advisory `gaming` score profile. It is stricter about packet loss, jitter, latency, load, and stale tunnel signals, and it remains recommendation-only until the audited route switch engine exists.
- GPU-assisted analysis is not a priority for AfroGate routing. The expected route-intelligence workload is compact time-series scoring and decision logic that should run on CPU on low-resource VPS machines; GPU use would add cost and operational complexity without helping the core loss/jitter switching path in the MVP.
- Route probes and route candidates now carry optional loaded-latency and loaded-latency-delta signals. The backend scores bufferbloat risk, can recommend SQM/AQM or avoiding a path under load, penalizes health/route scores when loaded latency rises, and surfaces the guidance in Settings without inspecting user traffic.
- Route decision previews now include advisory smart-route profile recommendations across balanced, stability, throughput, gaming, TCP, UDP, QUIC, DNS, and WireGuard profiles. Recommendations compare usable managed candidates by existing privacy-safe profile scores and stay advisory until an admin saves a profile or future audited automation exists.
- Route decision previews now treat an unhealthy current managed route as an explicit health-based switch reason. The health override can bypass the normal score-delta hysteresis check for assignment-only movement, but still respects route lock, manual mode, cooldown, managed-candidate requirements, and the disabled data-plane boundary.
- Route decision previews now include an advisory smart-load-balancing summary. It ranks managed candidates by selected profile score plus health, packet loss, jitter, latency, throughput/load, loaded-latency, and high-security/route-consistency constraints, then suggests primary/secondary/standby roles and weights without applying data-plane routing.
- Route decision previews now include gaming-safe session-safety guidance. For gaming/UDP/QUIC/WireGuard/stability profiles, normal route improvements should keep existing active sessions sticky and move only new sessions until the drain window passes; emergency switches are reserved for failing current routes.
- Route decision previews now include a transparent switch-engine planning summary. It sequences guard checks, sticky session pinning, new-session route assignment, drain, active switch, verify, and rollback stages, but marks data-plane mutation stages as future/planning-only until an audited adapter is ready.
- Route decision assignment-only apply events now persist a switch-execution summary. It records the control-plane assignment result, sticky-session and drain deadlines, cooldown deadline, rollback readiness, future data-plane steps, and data-plane-blocked reasons without mutating server OS routes or user traffic.
- Route decision previews now include a switch-preflight readiness summary. It checks the data-plane feature flag, server apply adapter, secret-safe dry-run artifacts, route guards, session-safety policy, rollback, cooldown, audit, and health verification gates before any future audited data-plane execution can be enabled.
- Route decision previews now include an advisory switch-rollout plan. It starts future data-plane movement with pinned existing sessions, new-session canary percentages, health verification, rollback thresholds, and route-consistency holds, but remains planning-only until the audited adapter exists.
- Route decision previews now include an advisory switch-rollout evaluation. It checks the recommended canary candidate against packet-loss, jitter, latency, and score guards, then suggests hold, start canary, expand canary, manual review, or rollback without applying traffic changes.
- Route decision previews now include a switch orchestration summary. It combines route lock, manual mode, cooldown, preflight, rollout, canary guard, sticky-session, route-consistency hold, and rollback state into a single audited next-action model while keeping live data-plane mutation disabled until an audited adapter exists.
- The first route-intelligence analytics slice is read-only: `/api/admin/route-quality/analytics` groups historical synthetic route probes by server, protocol, and hour-of-day, then the dashboard Settings page shows advisory best/degraded time-window recommendations. It does not inspect user traffic, infer user destinations, or switch routes.
- Route-quality history now has an hourly aggregation foundation in `route_quality_hourly` populated by `RouteQualityAggregationService`. It compacts synthetic route probes by route group, server, protocol, hour, and day-of-week so future day/week/month recommendations do not repeatedly scan raw metrics on small VPS machines.
- Route decision foundation is now advisory/read-only: `route_assignments` and `route_decision_events` exist, and `/api/admin/route-decisions/preview` evaluates the current/recommended candidate with route lock, cooldown, hysteresis, selected score profile, and reason codes. It does not apply live route changes or write decision events yet.
- Route assignment controls are persisted through guarded admin APIs: admins can set auto-route enabled, route lock, current managed outbound, locked outbound, hysteresis delta, and cooldown seconds for the default assignment. This updates control-plane state and audit logs only; it still does not apply live OS/data-plane route changes.
- Route decision events can now be recorded from the preview engine as advisory audit rows. `/api/admin/route-decisions/preview-events` stores the preview action, score delta, current/recommended managed outbounds, reason codes, cooldown/lock state, and context in `route_decision_events`, then updates the assignment's last decision state. `applied_at` remains null because no live route apply is performed.
- Route decision preview responses now include candidate-review rows with dispositions, rejection/recommendation reasons, score deltas from the current route, and compact score-penalty reasons. This explains why a path was recommended or skipped while remaining advisory-only and non-secret.
- Route decision apply is currently assignment-only. `/api/admin/route-decisions/apply-preview` accepts only an apply-ready `switchRecommended` preview, updates the saved current outbound, sets cooldown, records an `assignment_apply` event, and marks `dataPlaneApplied = false`; it does not mutate server OS routes or user traffic.
- Route decision preview responses now include a structured apply plan with guard checks, assignment-only steps, future data-plane drain/switch/verify steps, rollback placeholders, and explicit `dataPlaneReady = false` until real apply adapters exist.
- Route data-plane apply has a disabled-by-default readiness layer. Preview apply plans report the WireGuard policy-routing adapter status, supported outbound/protocol types, missing implementation state, and `AFROGATE_ROUTE_DATA_PLANE_APPLY_ENABLED` state; no data-plane mutation is possible until both the feature flag and audited adapter implementation are present.
- WireGuard route apply previews now include dry-run command strings and config-change targets for the future policy-routing adapter. They are secret-safe preview artifacts only; AfroGate does not execute them and does not include private keys, peer keys, or decrypted secret material.
- Route decision event contexts now persist a normalized `dryRunSnapshot` for both advisory preview records and assignment-only apply events. The snapshot stores adapter state, command/config counts, command/config previews, and aggregate `secretSafe` status so future audits can compare what was planned at the time.
- Route decision event detail is now inspectable through read-role admin access at `/api/admin/route-decisions/events/:id`. The Settings page fetches detail on demand and shows the stored dry-run snapshot without returning large event context in the recent-events list.
- Route-quality probe and summary data is now dimension-ready for operator/outbound/profile intelligence. Agents may attach optional non-secret route metadata (`routeGroup`, `outboundId`, `outboundKey`, `outboundName`, `operator`, `scoreProfile`) to synthetic probe rows; the backend stores compact hourly summaries by server, outbound, operator, protocol, score profile, day-of-week, and hour. Predictive recommendations can warn about upcoming historically degraded windows, but route changes remain advisory-only until the audited route switch engine exists.
- Server interfaces and tunnels are now first-class control-plane inventory rows in PostgreSQL (`server_interfaces`, `tunnels`) with guarded admin CRUD and audit logging. The dashboard tunnel panel can prefer `/api/admin/tunnels` rows, while live WireGuard telemetry and route switching remain separate non-mutating health/decision layers.
- The Routes page can now load and update the default route assignment controls through guarded admin APIs: auto-route enabled, route lock, current managed outbound, locked managed outbound, hysteresis delta, and cooldown seconds. This is still control-plane assignment state only; it does not mutate server OS routes, live tunnel services, or user traffic paths.
- The Servers page detail surface now fetches guarded server detail plus server-scoped interface and tunnel inventory when an admin selects a node. It shows overview, access readiness, monitoring telemetry, inventory rows, and audit context without decrypting credentials, opening SSH, executing commands, or mutating server services.
