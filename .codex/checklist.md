# AfroGate Checklist

## Project Setup

- [x] Create initial planning documents.
- [x] Create Codex control folder.
- [x] Add root agent instructions.
- [x] Add repository ignore rules.
- [x] Initialize local git repository.
- [x] Create initial local commit.
- [x] Configure target `origin` URL for `Benjil44/afrogate`.
- [x] Add enhancement approach documentation.
- [x] Keep repository local-first for now.
- [x] Create remote repository named `afrogate`.
- [x] Push initial commits to GitHub.
- [x] Add versioning policy, changelog, and VERSION tracking.
- [x] Add local AfroGate versioning plugin and skill.
- [x] Show application version in dashboard sidebar.
- [x] Add multilingual UI policy documentation.

## Phase 0: Foundation

- [x] Choose initial backend direction: NestJS/TypeScript.
- [x] Choose initial frontend direction: React/Vite/Tailwind dashboard.
- [x] Choose initial database direction: PostgreSQL.
- [x] Decide Docker is optional for now, not required for local start.
- [x] Add implementation start plan documentation.
- [x] Choose ORM: Drizzle.
- [x] Choose metrics storage approach: PostgreSQL tables first, TimescaleDB/partitioning later if needed.
- [ ] Add Ubuntu deployment notes with systemd and Nginx.
- [ ] Define optional Docker Compose for later reproducible deployment.
- [x] Add `.env.example`.
- [x] Define database schema migration tool.
- [ ] Add basic CI checks.
- [x] Scaffold `apps/backend`.
- [x] Scaffold `apps/dashboard`.
- [x] Scaffold `apps/agent`.
- [x] Scaffold `packages/shared`.
- [x] Scaffold `infra/ubuntu`.
- [x] Add root workspace scripts.
- [x] Add security and performance policy.
- [x] Add UFW baseline sample.
- [x] Add systemd hardening sample.
- [x] Add Nginx rate-limit/security-header sample.
- [x] Define control-plane egress proxy strategy.
- [x] Define server access and outbound management strategy.
- [x] Add agent token guard for metrics ingest.
- [x] Run manual dependency audit with zero vulnerabilities.
- [x] Switch dashboard to React/Vite static build for lower resource use.
- [x] Add Tailwind CSS to dashboard.
- [x] Convert dashboard UI to Tailwind utility classes.

## Phase 1: Monitoring MVP

- [x] Backend bootstrap auth guard for admin APIs.
- [x] Role guard/decorator foundation.
- [ ] Dashboard session login and MFA-ready admin auth.
- [ ] Apply admin guards to sensitive server/outbound APIs.
- [ ] Audit log foundation.
- [ ] CRUD for servers.
- [x] Data model for server access and outbound failover.
- [ ] Server edit screen with safe access/bootstrap tabs.
- [ ] Encrypted server credential storage.
- [ ] CRUD for tunnels and interfaces.
- [ ] CRUD for outbound routes/gateways.
- [ ] Outbound priority move up/down.
- [ ] Outbound health check scheduler.
- [ ] Outbound failover history.
- [ ] Agent registration endpoint.
- [x] Metrics ingest endpoint.
- [x] Protect metrics ingest with agent bearer token.
- [ ] Server agent heartbeat.
- [x] CPU/RAM/disk metrics.
- [x] Multi-storage volume metrics.
- [x] Network throughput metrics.
- [ ] WireGuard tunnel status metrics.
- [ ] Ping/jitter/packet loss probes.
- [x] Health score calculation.
- [ ] Alert engine.
- [ ] Telegram alert sender.
- [ ] Backend shared outbound HTTP client for Telegram/API calls.
- [x] Agent outbound proxy support for restricted servers.
- [x] Dashboard overview.
- [x] Realtime dashboard health chart with ECharts.
- [x] Second-LCD NOC dashboard layout.
- [x] Header system resource strip.
- [x] Separate dashboard download and upload traffic values.
- [x] English/Persian dashboard language toggle.
- [x] Sidebar footer language icon.
- [x] Local Persian font-face wiring for IRANSans assets.
- [x] Non-scrolling responsive sidebar.
- [x] Desktop fixed sidebar with main-content-only scrolling.
- [x] Compact second-LCD dashboard density so 1920x1080 monitoring fits without main-content overflow.
- [x] Sidebar alert severity indicator with red critical state.
- [x] Responsive smoke check for dashboard pages in English and Persian.
- [x] Sidebar pages implementation checklist.
- [x] Sidebar navigation state.
- [x] Initial Servers page.
- [x] Initial Routes page.
- [x] Initial Alerts page.
- [ ] Server detail page.
- [ ] Tunnel detail page.
- [ ] Real alert API-bound Alerts page.

## UI/UX Audit Backlog

- [x] Run browser UI audit across Dashboard, Servers, Routes, and Alerts in English/Persian at mobile, tablet, desktop, and second-LCD widths.
- [x] Sidebar alert severity indicator with red critical state.
- [x] Persian font and number/unit localization pass.
- [x] Replace cramped server CPU/RAM/disk text chips with icon+value indicators.
- [x] Simplify the health chart so timeline labels and the plot are readable in dashboard density.
- [x] Keep the 1920x1080 second-LCD dashboard at zero main-content overflow in English and Persian.
- [x] Reduce dashboard vertical scroll at 1440x900 without making the 1920x1080 NOC display feel sparse.
- [ ] Improve mobile/tablet resource strip density.
- [ ] Add empty/loading/error states for every dashboard panel.
- [ ] Add hover/tooltips for dense icon-only monitoring controls and metrics.
- [ ] Review color contrast for warning/critical states in light and dark sidebar contexts.
- [ ] Bind alert/sidebar severity to real alert API rows instead of fallback/computed rows.
- [ ] Add screenshot-based visual regression captures for the dense dashboard layout.

## Phase 2: Users, Usage, Billing

- [ ] Telegram identity user model.
- [ ] Privacy-safe paid number storage.
- [ ] Volume package model.
- [ ] Price per GB setting.
- [ ] Usage accounting.
- [ ] Remaining volume display.
- [ ] Telegram bot user commands.

## Phase 3: Auto Route

- [ ] Route assignment model.
- [ ] Auto route toggle.
- [ ] Route lock toggle.
- [ ] Health-based route decision.
- [ ] Hysteresis and cooldown.
- [ ] Route decision audit reason.

## Phase 4: Current Panel Integration

- [ ] Read users from Marzban/X-UI/current panel.
- [ ] Sync volume usage.
- [ ] Charge/update user volume.
- [ ] Import/export configs.

## Phase 5: Enterprise Path

- [ ] Owner/Admin/Support roles.
- [ ] Backup and restore UI.
- [ ] Reports and data analysis.
- [ ] Tenant/brand settings.
- [ ] Enterprise deployment guide.

## Enhancement Tracks

- [ ] Incident timeline.
- [ ] Telegram critical alert flow.
- [ ] Route health score history.
- [ ] Charge allocation delay tracking.
- [ ] Backup status monitoring.
- [ ] Route canary rollout.
- [ ] Adapter-based migration from current panels.
- [ ] Privacy threat model.
- [ ] Security threat model.
- [ ] Rate limiting at API layer.
- [ ] Dependency audit in CI.
- [ ] Secret scan in CI.
- [ ] Per-agent token rotation.
- [ ] Database least-privilege roles.
- [ ] Loaded latency and bufferbloat monitoring.
