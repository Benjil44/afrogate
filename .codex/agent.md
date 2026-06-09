# Afrows Agent Controller

## Mission

Build Afrows as a privacy-conscious monitoring, routing, billing, and operations platform for VPN/proxy infrastructure.

The first executable milestone is a dashboard-first monitoring MVP. It should later grow into an enterprise-grade branded panel that can reduce dependence on Marzban/X-UI/other panels over time.

## Operating Rules

- Read `.codex/memory.md`, `.codex/progress.md`, and `.codex/checklist.md` before implementation.
- Prefer small, working increments over broad rewrites.
- Keep the product bilingual-ready from the start: Persian and English.
- Preserve privacy by default. Store only what is required.
- Never commit secrets, tokens, server IP credentials, production config, or real user data.
- Keep dashboard operations fast enough for remote travel management.
- Keep control-plane egress separate from user/data traffic; use the documented outbound proxy/gateway pattern for Telegram and external APIs on restricted servers.
- Treat server access as bootstrap-plus-agent-first: avoid storing reusable root passwords, prefer dedicated management users, SSH keys, secret rotation, and audit logs.
- Build protocol and system setup as a guided Settings workflow before relying on real-server onboarding. Private keys and tunnel secrets must be write-only, secret-safe, and never shown back in UI, logs, `.codex`, or git.
- Keep protocol creation superadmin-owned. The setup engine should support WireGuard, VLESS, L2TP, IKEv2, and future high-speed/high-security protocols without forcing admins to edit raw config files.
- Keep Settings persistence secret-safe: store non-secret protocol shape and route settings in PostgreSQL, store only secret references for key material, and reject raw private keys or token-like config values.
- Store Settings private keys only through the encrypted `secret_records` path and return `secretRef` metadata only; do not add dashboard or admin endpoints that read decrypted secret material back to users.
- Keep protocol provisioning control-plane-first until real server access exists: draft provisioning may create disabled, maintenance-mode managed outbounds, but server OS/service changes need a separate audited apply step and health validation.
- Keep WireGuard telemetry privacy-safe: collect tunnel/peer health from the local `wg` command when available, send peer public-key fingerprints only, and never persist or return raw WireGuard private keys, preshared keys, or full public keys.
- Treat agent-sourced WireGuard route candidates as live health signals for admin selection, not as applied routes, until a managed outbound or audited server-side apply step links them to real routing state.
- Optional route-probe metadata must stay non-secret and operational only: route group, outbound key/name/id, operator, and score profile are allowed; user destinations, user IP history, credentials, and traffic contents are not.
- Treat username/password admin login as the dashboard-facing auth path; `AFROWS_ADMIN_TOKEN` is only a legacy direct API/bootstrap fallback.
- Preserve the permanent `superadmin` account invariant in future user-management work: normal admins must not remove, disable, or change it.
- Treat managed dashboard roles as `owner`, `admin`, `supervisor`, `support`, and `auditor`; `supervisor` is read-oriented supervision, while superadmin remains the protected bootstrap root.
- Store managed admin-user passwords as hashes only. Production/default managed users live in PostgreSQL `admin_users`; `AFROWS_ADMIN_USERS_FILE` is only a legacy fallback/import source. Never place real passwords or admin-user runtime data in `.codex` or git.
- Update `.codex/progress.md` after each session.
- Update `.codex/checklist.md` when a task changes state.
- Update `.codex/memory.md` only for durable decisions and facts.
- For every meaningful implementation section, bump the Afrows version, update `CHANGELOG.md`, run `npm run version:check`, and commit the version with the work.

## Product Priorities

1. Monitoring dashboard MVP.
2. Telegram alerts and Telegram user flows.
3. Server/tunnel health and health score.
4. Usage accounting by GB.
5. Auto route with optional route lock.
6. Integration with current Marzban/X-UI/other panel usage.
7. Enterprise-ready Afrows branded panel.
8. Reliability, observability, route intelligence, privacy, and enterprise-readiness enhancements from `docs/enhancement-approaches-fa.md`.
9. Local-first implementation using the direction in `docs/implementation-start-plan-fa.md`.

## Technical Principles

- Keep control plane, monitoring plane, and data plane integration separate.
- Design server count as unbounded, even if the first deployment has 3 Iran servers and 1 Germany server.
- Agents must be lightweight enough for 4 core / 4 GB RAM servers.
- Prefer auditable route decisions with clear reasons.
- Use threshold-based alerts first; add predictive analysis later.
- Treat packet loss, high jitter, storage pressure, and API/request backlog as urgent operational signals.
- Keep enhancement work progressive: visibility first, reliability second, manual control third, automation fourth, enterprise polish last.
- Do not make GitHub remote work a blocker; local git is enough until the user asks to push.
- Separate **inbound reachability** (users → panel/landing) from **outbound** (the box's own internet). The raw Iran VPS IP is filtered (reachable from inside Iran, unreliable from abroad/foreign-exits), so "reachable from any network" needs **fronting** (ArvanCloud/CDN), not server tweaks. The box's own outbound internet must run through a managed, health-checked outbound (xray client → a *working* outbound), never a hardcoded/dead first-setup proxy.
- Measure outbound throughput **backend-on-box** (spawn a throwaway xray SOCKS proxy bound to the outbound and transfer through it); the Python agent is static/env-driven and not the place for it. Reachability is **vantage-dependent** — an outbound healthy from one network can be dead from another.
- When access fails, isolate **client vs server first**: ping bypasses browser proxies and caches can mask failures, so confirm with a fresh/hard reload and check whether the client is routed through a (possibly dead) v2ray/proxy before assuming a server or DPI fault. For VLESS/proxy configs, probe `config.address` (the dial endpoint), not `config.host` (the SNI/HTTP camouflage hostname).
- Afrows is its **own** VPN engine (no Marzban): user inbound = VLESS+Reality on **443** behind the panel (Reality `dest`→ local nginx on 8444); per-user provisioning via `xray api`; supply=Outbounds, engine=Routes, sell=Inbounds+accounts. Reality clients MUST carry pbk/sid/fp/flow — import links, never hand-type. To debug "connected but 0 traffic," run a Reality client on the box to prove the server, then suspect the client.
- Ship a **visible app version** in the mobile client (bump every build) — an old APK on a stale config looks like a server bug. Confirm the installed version before diagnosing.

## UX Principles

- Dashboard is the first screen.
- Admin should identify the failing server, tunnel, or operator quickly.
- Avoid marketing-style UI for operations pages.
- Use dense but readable layouts for repeated operational use.
- Build role-based access early enough that support staff can help safely.
- Prefer guided setup pages for complex infrastructure tasks such as WireGuard, outbound gateways, and agent bootstrap so admins do not have to edit raw config files for normal workflows.
- Treat automatic/manual route selection and advanced load balancing as core UX: admins need health visibility for each WireGuard/protocol path, automatic best-path selection, and manual override when operations require it.
