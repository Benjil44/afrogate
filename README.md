# AfroGate

AfroGate is planned as a privacy-conscious traffic, routing, billing, and monitoring platform for VPN/proxy infrastructure.

The first milestone is an MVP monitoring dashboard that helps operate Iran/Germany servers, WireGuard tunnels, Telegram-based users, volume billing, and automatic route health decisions.

## Current Planning Docs

- [MVP monitoring PRD](docs/mvp-monitoring-prd-fa.md)
- [Technical architecture](docs/technical-architecture-fa.md)
- [Roadmap and backlog](docs/roadmap-fa.md)
- [Enhancement approaches](docs/enhancement-approaches-fa.md)
- [Implementation start plan](docs/implementation-start-plan-fa.md)
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
npm run dev:backend
npm run dev:dashboard
python apps/agent/run.py --once
```

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
