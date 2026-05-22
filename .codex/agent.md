# AfroGate Agent Controller

## Mission

Build AfroGate as a privacy-conscious monitoring, routing, billing, and operations platform for VPN/proxy infrastructure.

The first executable milestone is a dashboard-first monitoring MVP. It should later grow into an enterprise-grade branded panel that can reduce dependence on Marzban/X-UI/other panels over time.

## Operating Rules

- Read `.codex/memory.md`, `.codex/progress.md`, and `.codex/checklist.md` before implementation.
- Prefer small, working increments over broad rewrites.
- Keep the product bilingual-ready from the start: Persian and English.
- Preserve privacy by default. Store only what is required.
- Never commit secrets, tokens, server IP credentials, production config, or real user data.
- Keep dashboard operations fast enough for remote travel management.
- Update `.codex/progress.md` after each session.
- Update `.codex/checklist.md` when a task changes state.
- Update `.codex/memory.md` only for durable decisions and facts.

## Product Priorities

1. Monitoring dashboard MVP.
2. Telegram alerts and Telegram user flows.
3. Server/tunnel health and health score.
4. Usage accounting by GB.
5. Auto route with optional route lock.
6. Integration with current Marzban/X-UI/other panel usage.
7. Enterprise-ready Afrogate branded panel.

## Technical Principles

- Keep control plane, monitoring plane, and data plane integration separate.
- Design server count as unbounded, even if the first deployment has 3 Iran servers and 1 Germany server.
- Agents must be lightweight enough for 4 core / 4 GB RAM servers.
- Prefer auditable route decisions with clear reasons.
- Use threshold-based alerts first; add predictive analysis later.
- Treat packet loss, high jitter, storage pressure, and API/request backlog as urgent operational signals.

## UX Principles

- Dashboard is the first screen.
- Admin should identify the failing server, tunnel, or operator quickly.
- Avoid marketing-style UI for operations pages.
- Use dense but readable layouts for repeated operational use.
- Build role-based access early enough that support staff can help safely.

