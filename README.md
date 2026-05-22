# AfroGate

AfroGate is planned as a privacy-conscious traffic, routing, billing, and monitoring platform for VPN/proxy infrastructure.

The first milestone is an MVP monitoring dashboard that helps operate Iran/Germany servers, WireGuard tunnels, Telegram-based users, volume billing, and automatic route health decisions.

## Current Planning Docs

- [MVP monitoring PRD](docs/mvp-monitoring-prd-fa.md)
- [Technical architecture](docs/technical-architecture-fa.md)
- [Roadmap and backlog](docs/roadmap-fa.md)
- [Enhancement approaches](docs/enhancement-approaches-fa.md)
- [Implementation start plan](docs/implementation-start-plan-fa.md)
- [Control-plane egress](docs/control-plane-egress.md)
- [Server access and outbound management](docs/server-access-and-outbound-management.md)
- [Dashboard sidebar pages checklist](docs/dashboard-sidebar-pages-checklist.md)
- [Repository structure](docs/repository-structure.md)
- [Security and performance policy](docs/security-performance-policy.md)
- [Security policy](SECURITY.md)
- [Agent instructions](AGENTS.md)
- [Codex project memory](.codex/memory.md)

## App Structure

```text
apps/backend       NestJS API
apps/dashboard     React/Vite/Tailwind dashboard
apps/agent         Python monitoring agent
packages/shared    Shared TypeScript contracts
infra/ubuntu       Native Ubuntu deployment notes
infra/docker       Optional future Docker assets
```

## Local Development

Install dependencies when you are ready to run the apps:

```powershell
npm install
npm --workspace @afrogate/backend run db:migrate
npm run dev:backend
npm run dev:dashboard
python apps/agent/run.py --once
```

The backend expects `DATABASE_URL` and a real `AFROGATE_AGENT_TOKEN` before accepting agent metrics. The dashboard reads `VITE_API_BASE_URL` and falls back to local sample data when the API is unavailable.

Restricted servers can route AfroGate Telegram/API calls through a local egress proxy with `AFROGATE_OUTBOUND_PROXY_URL`; see [control-plane egress](docs/control-plane-egress.md).

## MVP Direction

- Dashboard-first monitoring.
- Telegram alerts and Telegram user identity.
- Per-server, per-tunnel, and per-user traffic visibility.
- Health scoring for ping, jitter, packet loss, bandwidth, CPU, RAM, and storage.
- Volume-based packages with configurable price per GB.
- Privacy-first data model: store Telegram user ID and paid number only when needed.
- Bilingual product surface: Persian and English.

## Continuing Work

Before each implementation session, read `AGENTS.md` and the `.codex/` folder so progress, memory, and checklist stay synchronized.
