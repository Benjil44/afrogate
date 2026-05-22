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
- [x] Add agent token guard for metrics ingest.
- [x] Run manual dependency audit with zero vulnerabilities.
- [x] Switch dashboard to React/Vite static build for lower resource use.
- [x] Add Tailwind CSS to dashboard.
- [x] Convert dashboard UI to Tailwind utility classes.

## Phase 1: Monitoring MVP

- [ ] Backend auth for admin.
- [ ] Role-based authorization.
- [ ] Audit log foundation.
- [ ] CRUD for servers.
- [ ] CRUD for tunnels and interfaces.
- [ ] Agent registration endpoint.
- [x] Metrics ingest endpoint.
- [x] Protect metrics ingest with agent bearer token.
- [ ] Server agent heartbeat.
- [ ] CPU/RAM/disk metrics.
- [ ] Network throughput metrics.
- [ ] WireGuard tunnel status metrics.
- [ ] Ping/jitter/packet loss probes.
- [x] Health score calculation.
- [ ] Alert engine.
- [ ] Telegram alert sender.
- [ ] Backend shared outbound HTTP client for Telegram/API calls.
- [x] Agent outbound proxy support for restricted servers.
- [x] Dashboard overview.
- [ ] Server detail page.
- [ ] Tunnel detail page.
- [ ] Alerts page.

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
