# Repository Structure

AfroGate uses a small monorepo layout so product, API, dashboard, agent, and deployment assets can evolve together without mixing responsibilities.

```text
apps/
  backend/       NestJS API, alerts, billing, metrics ingest, route decisions
  dashboard/     React/Vite admin dashboard
  agent/         Python server monitoring agent
packages/
  shared/        Shared TypeScript contracts and constants
infra/
  ubuntu/        Native Ubuntu deployment notes and samples
  docker/        Optional future Docker Compose work
docs/            Product, architecture, roadmap, and implementation docs
.codex/          Persistent project memory, checklist, and progress
```

## Development Flow

1. Keep changes small and commit meaningful milestones.
2. Backend owns API behavior and operational rules.
3. Dashboard owns admin experience and visualization.
4. Agent owns lightweight server-side metrics collection.
5. Shared package owns stable contracts only; avoid putting app logic there.

## First Runnable Path

```text
agent -> backend /api/metrics -> dashboard overview
```
