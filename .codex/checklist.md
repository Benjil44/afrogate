# AfroGate Checklist

## Project Setup

- [x] Create initial planning documents.
- [x] Create Codex control folder.
- [x] Add root agent instructions.
- [x] Add repository ignore rules.
- [x] Initialize local git repository.
- [x] Create initial local commit.
- [x] Configure target `origin` URL for `benjil44/afrogate`.
- [x] Add enhancement approach documentation.
- [ ] Create remote repository named `afrogate`.
- [ ] Push initial commit.

## Phase 0: Foundation

- [ ] Choose backend stack: FastAPI or NestJS.
- [ ] Choose frontend stack: Next.js or React/Vite.
- [ ] Choose metrics storage approach: PostgreSQL tables, TimescaleDB, or Prometheus bridge.
- [ ] Define Docker Compose for local development.
- [ ] Add `.env.example`.
- [ ] Define database schema migration tool.
- [ ] Add basic CI checks.

## Phase 1: Monitoring MVP

- [ ] Backend auth for admin.
- [ ] CRUD for servers.
- [ ] CRUD for tunnels and interfaces.
- [ ] Agent registration endpoint.
- [ ] Metrics ingest endpoint.
- [ ] Server agent heartbeat.
- [ ] CPU/RAM/disk metrics.
- [ ] Network throughput metrics.
- [ ] WireGuard tunnel status metrics.
- [ ] Ping/jitter/packet loss probes.
- [ ] Health score calculation.
- [ ] Alert engine.
- [ ] Telegram alert sender.
- [ ] Dashboard overview.
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
