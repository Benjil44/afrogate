# Repository Structure

AfroGate uses a small monorepo layout so product, API, dashboard, agent, and deployment assets can evolve together without mixing responsibilities.

```text
apps/
  backend/       NestJS API, alerts, billing, backup status, metrics ingest, protocol-aware route decisions
  dashboard/     React/Vite/Tailwind admin dashboard
  client/        React/Vite/Tailwind VPN client route and quota surface
  agent/         Python server monitoring agent and privacy-safe route probes
packages/
  shared/        Shared TypeScript contracts and constants
infra/
  ubuntu/        Native Ubuntu deployment notes and samples
  postgres/      SQL migrations and database notes
  docker/        Optional Docker Compose deployment samples
docs/            Product, architecture, roadmap, threat model, and implementation docs
.codex/          Persistent project memory, checklist, and progress
tests/e2e/       Playwright browser smoke and dense dashboard visual-capture tests
```

## Development Flow

1. Keep changes small and commit meaningful milestones.
2. Backend owns API behavior and operational rules.
3. Dashboard owns admin experience and visualization.
4. Agent owns lightweight server-side metrics collection and synthetic route probes.
5. Shared package owns stable contracts only; avoid putting app logic there.
6. Local direct-run wiring stays fixed on dashboard `4000`, client app `4100`, and backend `7000`.
7. Playwright tests verify browser-visible dashboard behavior without allowing Vite to drift to fallback ports, and dense dashboard visual captures attach screenshots for mobile, tablet, desktop, and second-LCD viewports.

## Local Port Wiring

Direct local development should use one dashboard and one backend process:

```text
dashboard http://127.0.0.1:4000 -> backend http://127.0.0.1:7000/api
client    http://127.0.0.1:4100 -> backend http://127.0.0.1:7000/api
agent AFROGATE_API_URL -> backend http://127.0.0.1:7000/api
```

The dashboard and client Vite servers use `strictPort` so port conflicts fail fast. Do not rely on Vite fallback ports such as `4001`, `4002`, or `4101`; stop the conflicting process and restart AfroGate on the documented port.

## Protocol-Aware Routing Structure

Smart routing should not look at real user traffic contents. The agent should run compact synthetic probes against configured targets and report protocol health to the backend:

- TCP: connect latency, optional TLS handshake latency, failure rate, and small request timing.
- UDP: reachability, jitter, packet loss, and response delay when a safe echo/probe target exists.
- QUIC/HTTP3: handshake and request timing for routes where UDP-based web traffic matters.
- DNS: lookup latency and failure rate through the route when DNS behavior affects users.
- WireGuard/tunnel: handshake freshness, peer transfer counters, and tunnel up/down state.
- Loaded path checks: short bounded throughput samples and loaded latency, not continuous speed tests.

The backend should convert these probe samples into route scores by protocol and speed profile:

- Low-speed or unstable links prefer low loss, low jitter, and stable latency.
- High-speed routes prefer available throughput and low saturation while still respecting latency/loss limits.
- UDP-heavy routes should favor jitter/loss/NAT stability.
- TCP-heavy routes should favor connect/TLS timing, retransmission symptoms, and request latency.

Automatic route changes must still use cooldown, hysteresis, route locks, and audit reasons so smart routing improves quality without route flapping.

## First Runnable Path

```text
agent -> backend /api/metrics -> dashboard overview
```

The first data path is backed by PostgreSQL:

```text
agent POST /api/metrics -> servers/server_metrics -> GET /api/metrics/latest -> dashboard
```

The metrics payload already includes CPU/RAM/storage/network counters and privacy-safe WireGuard status telemetry when `wg` is installed on the agent host.

Settings route candidates can now come from two sources: managed outbound health rows and live agent WireGuard telemetry. Only managed outbound rows can be persisted as selected outbounds for route settings; agent candidates remain live diagnostics until provisioning/apply links them to routing state.

Agent ping/jitter/packet-loss metrics are collected only for configured synthetic targets via `AFROGATE_PING_TARGETS`; empty configuration keeps those fields null. The agent also has opt-in protocol-aware route probes through `AFROGATE_TCP_PROBE_TARGETS`, `AFROGATE_UDP_PROBE_TARGETS`, `AFROGATE_QUIC_PROBE_TARGETS`, and `AFROGATE_DNS_PROBE_TARGETS`; empty configuration sends no TCP/UDP/QUIC/DNS route-probe rows. WireGuard route-probe rows are derived from local `wg` telemetry when available, using interface status, active peer count, and handshake freshness without raw keys. Route probe rows may include optional `loadedLatencyMs` and `loadedLatencyDeltaMs` values from bounded synthetic checks so the backend can detect paths that look fine at idle but lag under load.

The Settings API scores WireGuard route candidates by the saved route strategy. Each candidate keeps the existing selected `score` field and can also include advisory profile scores for balanced, stability, throughput, gaming, TCP, UDP, QUIC, DNS, and WireGuard decisions plus compact reason codes. The scoring layer is privacy-safe and uses synthetic probe metrics only. Route candidates also carry a compact bufferbloat assessment with loaded-latency delta, severity, and a recommendation such as watch, SQM/AQM, or avoid-under-load. Decision previews compare usable managed candidates across those profile scores and return advisory profile recommendations so admins can see whether stability, throughput, gaming, or a protocol-specific profile fits current route conditions better before saving any policy.

The route decision foundation adds `route_assignments`, `route_decision_events`, `/api/admin/route-assignments/current`, `/api/admin/route-decisions/preview`, `/api/admin/route-decisions/events`, `/api/admin/route-decisions/events/:id`, `/api/admin/route-decisions/preview-events`, and `/api/admin/route-decisions/apply-preview`. Assignment controls persist the default route assignment, auto-route enabled state, route lock, current managed outbound, locked managed outbound, hysteresis delta, and cooldown seconds. The preview is read-only: it compares the current and recommended managed route, evaluates route lock, cooldown, hysteresis, selected score profile, and reason codes, then returns an advisory action plus candidate-review dispositions, rejection reasons, score deltas, score-penalty reasons, smart-load-balancing roles/weights, session-safety policy, transparent switch-engine stages, and a structured apply plan for the Settings page. If the current managed route is unhealthy and a healthy managed candidate exists, the preview records a health-based switch reason and can bypass normal score-delta hysteresis for assignment-only movement while still respecting lock, manual mode, cooldown, and managed-candidate gates. The smart-load-balancing summary ranks managed candidates by selected profile score plus health, packet loss, jitter, latency, throughput/load, loaded-latency, and high-security/route-consistency constraints, but remains advisory and does not mutate OS routing. The session-safety summary protects games and other active UDP-sensitive flows by distinguishing safe switches, sticky holds, new-session-only drains, and emergency health switches before any future data-plane adapter is allowed to move traffic. The switch-engine summary sequences guard checks, sticky session pinning, new-session routing, drain, active switch, verify, and rollback stages; mutation stages stay future/planning-only until a real audited adapter is ready. The apply plan includes adapter readiness metadata plus dry-run command/config previews for the future WireGuard data-plane adapter and reports disabled/missing reasons while `AFROGATE_ROUTE_DATA_PLANE_APPLY_ENABLED` is false and no audited adapter exists. Recorded preview and assignment-apply events persist a normalized `dryRunSnapshot` inside `decision_context` so the exact planned command/config preview survives later scoring or adapter changes. The recent-events list stays compact, while the detail endpoint and Settings inspector fetch stored context on demand for read-role admins. Admins can record that preview as an advisory decision event with `applied_at = null`. The apply endpoint is currently assignment-only: it updates saved control-plane state and records `dataPlaneApplied = false`; automatic server OS/data-plane route apply remains future work.

Client VPN route preferences live under `client_route_preferences` instead of the admin dashboard route settings. The table links a client config to a route group, coarse detected country, preferred exit country, optional preferred outbound, score profile, route-lock state, and sticky-session protection. Admin endpoints can manage this foundation now, and admins can issue one-time client access tokens backed by hashed rows in `client_access_tokens`. Usage accounting uses compact append-only `client_usage_events` rows with per-source idempotency keys; accepted events increment account/client `used_bytes` counters atomically, while duplicate reports do not double-count. Rated usage events can reference a managed outbound and apply that outbound's `usage_multiplier`, preserving raw bytes and charged bytes for expensive route billing. Paid payment orders credit quota through `payment_order_allocations`, an idempotent purchase-allocation ledger that increases account quota once per paid order. Rewarded ads credit small data rewards through admin-managed `rewarded_ad_settings` and `rewarded_ad_grants`, with per-client idempotency and daily caps before quota changes. The dashboard has a Usage/Billing page for guarded admin reads across catalog, customers, orders, quota usage, and non-secret rewarded-ad reward/cap settings, plus a customer limit manager for creating/updating customer accounts with shared account quota or per-client GB caps. Mobile/client APIs are scoped under `/api/client/*` and separate from `/api/admin/*`: they expose only the authenticated client's profile/quota summary, rewarded-ad status/claim path, route preference, selectable route options, subscription refresh metadata, protocol config render status, client-owned rendered config output when an active encrypted per-client credential exists, and the client-owned route-preference update path. `apps/client` is the first mobile-first VPN client surface for those APIs, with token login, remaining-volume display, rewarded-data claims, automatic/country/server route controls, subscription server visibility, route charge multipliers, private config copy readiness, and bilingual labels. Route decision previews now read `client_config:<id>` assignments and use the stored preference to prefer a healthy managed candidate in the selected country or exact outbound when available, returning explicit availability and mismatch reasons while keeping live routing unchanged.

Assignment-only apply events also persist a `switchExecution` context object. It records control-plane assignment state, sticky-session/drain/cooldown deadlines, rollback readiness, future data-plane step ids, and data-plane-blocked reasons so the dashboard can show what was armed without claiming that OS routing changed.

Route decision previews and event detail also include `switchPreflight`. This readiness checklist covers feature flag, apply adapter, dry-run, guard, session-safety, rollback, cooldown, audit, and post-switch health-verification gates so admins can see why data-plane switching is not executable yet. It is advisory/audit metadata only until an audited adapter exists.

Route decision previews and event detail also include `switchRollout`. This advisory plan records the future rollout strategy, pinned existing-session behavior, initial and maximum new-session canary percentages, health rollback thresholds, route-consistency hold time, and rollout steps. It remains planning-only and must not mutate OS routing until the audited apply adapter exists.

Route decision previews and event detail also include `switchRolloutEvaluation`. This advisory guard result records observed candidate loss, jitter, latency, and score against the rollout thresholds, then recommends hold, start canary, expand canary, manual review, or rollback without mutating OS routing.

Route decision previews and event detail also include `switchOrchestration`. This state-machine-style summary combines route locks, manual mode, cooldown, preflight, rollout plan, canary guard, sticky-session policy, route-consistency hold, and rollback readiness into one audited next-action model. It can recommend assignment-only control-plane recording, hold, canary, expand, rollback, or manual review while keeping server OS/data-plane mutation disabled until an audited adapter exists.

Backup status monitoring lives in the backend as a read-only control-plane API under `/api/admin/backups/status`. External backup jobs own backup execution and may publish a compact JSON status file; AfroGate returns only sanitized readiness evidence for the dashboard and does not expose local file paths, decrypted data, object-store credentials, raw dumps, or restore controls.

Route-quality analytics currently live in the backend operations service and dashboard Settings page. The first endpoint, `/api/admin/route-quality/analytics`, derives hourly recommendations from historical synthetic route probes already stored in `server_metrics.raw`, so it adds no extra agent payload and no new traffic-derived user data.

Hourly route-quality summaries are stored in `route_quality_hourly` through migration `0007_route_quality_hourly.sql`. Migration `0008_route_quality_dimensions.sql` adds outbound, operator, score-profile, and day/hour dimensions so route intelligence can identify patterns such as one operator being better or worse during specific windows. The backend aggregation service keeps this table fresh from recent synthetic route probes, allowing day/week/month intelligence to query compact rows instead of repeatedly scanning raw JSON metrics.
