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

### Current State

- The repository now has a scaffolded backend, dashboard, agent, shared package, and infra samples.
- Local git repository exists on branch `main`.
- Remote target is configured for `Benjil44/afrogate` and local `main` tracks `origin/main`.
- Backend, dashboard, agent, shared package, and infra folders are scaffolded.
- Current highest priority remains the monitoring MVP, now moving from overview metrics into alert delivery and admin security.
- Enhancement approach is documented, but not implemented yet.
- First real data path exists: agent-style metrics can be accepted by the backend, persisted to PostgreSQL, and rendered by the dashboard when the API/database are configured.

### Next Recommended Step

Continue the monitoring MVP:

1. Add admin-safe server/outbound read APIs and mutation APIs after roles are enforced.
2. Add real server edit flow with safe access/bootstrap tabs.
3. Add alert listing endpoints and bind dashboard alerts to real alert rows.
4. Add Telegram critical alert delivery using the shared control-plane egress policy.
5. Add WireGuard tunnel metrics to the Python agent.

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
- Versioning workflow is being verified with `npm run version:check`, workspace typecheck, and production build.
- Database migration script was added but not run in this session because no local PostgreSQL connection was configured.
