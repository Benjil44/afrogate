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
- [x] Add Ubuntu deployment notes with systemd and Nginx.
- [x] Define optional Docker Compose for later reproducible deployment.
- [x] Add `.env.example`.
- [x] Define database schema migration tool.
- [x] Add local PostgreSQL setup script.
- [x] Install local PostgreSQL, create the AfroGate development database, and run migrations.
- [x] Add basic CI checks.
- [x] Scaffold `apps/backend`.
- [x] Scaffold `apps/dashboard`.
- [x] Scaffold `apps/agent`.
- [x] Scaffold `packages/shared`.
- [x] Scaffold `infra/ubuntu`.
- [x] Add root workspace scripts.
- [x] Standardize direct local development ports.
- [x] Move direct local development ports to dashboard `4000` and backend `7000`.
- [x] Add Playwright dashboard smoke test wiring.
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
- [x] Dashboard session login and MFA-ready admin auth.
- [x] Superadmin/admin user management foundation.
- [x] Users sidebar page for admin account management.
- [x] Supervisor role foundation for read-oriented dashboard access.
- [x] Apply admin guards to sensitive server/outbound APIs.
- [x] Audit log foundation.
- [x] CRUD for servers.
- [x] Data model for server access and outbound failover.
- [x] Server edit screen with safe access/bootstrap tabs.
- [x] Encrypted server credential storage.
- [x] CRUD for tunnels and interfaces.
- [x] CRUD for outbound routes/gateways.
- [x] Outbound priority move up/down.
- [x] Outbound health check scheduler.
- [x] Outbound failover history.
- [x] Settings page for guided WireGuard and system setup.
- [x] Initial secret-safe WireGuard private-key/config setup draft workflow.
- [x] Initial WireGuard health comparison UI for route selection.
- [x] Initial automatic/manual route selection controls.
- [x] Initial superadmin protocol draft factory for WireGuard, VLESS, L2TP, and IKEv2.
- [x] Persist Settings protocol drafts and route selection settings through guarded backend APIs.
- [x] Shape real WireGuard route candidates from outbound health rows when available.
- [x] Persist secret-safe WireGuard private-key/config workflow with encrypted backend credential storage.
- [x] Initial backend protocol provisioning engine that converts saved WireGuard, VLESS, L2TP, and IKEv2 drafts into disabled managed outbound rows.
- [x] Secret-safe protocol server apply plan and readiness preview for WireGuard, VLESS, L2TP, and IKEv2.
- [x] Target-server selection and server-access readiness binding for Settings protocol provisioning.
- [x] Secret-safe protocol server apply dry-run event recording and audit snapshot storage.
- [x] Admin-visible protocol server apply event list/detail inspection with stored dry-run snapshots.
- [x] Protocol server apply preflight/readiness gates for feature flag, adapter, dry-run safety, server access, outbound health, rollback, audit, and health verification.
- [x] Superadmin-only live protocol apply request boundary that records blocked audit events without executing server mutation.
- [x] Protocol server apply adapter scaffold with dry-run-only command runner and active server-credential readiness boundary.
- [x] Protocol server apply credential-decrypt readiness gate separated from active server-credential checks.
- [x] Protocol server apply protocol-secret decrypt readiness gate separated from secret reference checks.
- [x] Protocol server apply non-secret config-material readiness gate before production executor enablement.
- [x] Protocol server apply generated-command allowlist and timeout policy gate before live executor enablement.
- [x] Production server-side protocol apply engine for WireGuard, VLESS, L2TP, IKEv2, and future high-speed/high-security protocols.
- [x] Agent registration endpoint.
- [x] Metrics ingest endpoint.
- [x] Protect metrics ingest with agent bearer token.
- [x] Server agent heartbeat.
- [x] CPU/RAM/disk metrics.
- [x] Multi-storage volume metrics.
- [x] Network throughput metrics.
- [x] WireGuard tunnel status metrics.
- [x] Real WireGuard health checks per tunnel for admin route selection.
- [x] Ping/jitter/packet loss probes.
- [x] Initial protocol-aware route probe contract and opt-in agent TCP/UDP/QUIC-reachability/DNS probes.
- [x] Protocol-aware route probes for TCP, UDP, QUIC/HTTP3, DNS, and WireGuard.
- [x] Health score calculation.
- [x] Backend protocol-aware route scoring for low-speed/high-speed and traffic-profile decisions.
- [x] Alert engine.
- [x] Telegram alert sender.
- [x] Backend shared outbound HTTP client for Telegram/API calls.
- [x] Agent outbound proxy support for restricted servers.
- [x] Dashboard overview.
- [x] Realtime dashboard health chart with ECharts.
- [x] Second-LCD NOC dashboard layout.
- [x] Header system resource strip.
- [x] Separate dashboard download and upload traffic values.
- [x] English/Persian dashboard language toggle.
- [x] Sidebar footer language icon.
- [x] Local Persian font-face wiring for YekanBakh assets.
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
- [x] Server detail page.
- [x] Tunnel detail page.
- [x] Real server API-bound Servers page.
- [x] Real route/outbound API-bound Routes page.
- [x] Routes page default route assignment controls for auto-route, route lock, current/locked outbound, hysteresis, and cooldown.
- [x] Real alert API-bound Alerts page.

## UI/UX Audit Backlog

- [x] Run browser UI audit across Dashboard, Servers, Routes, and Alerts in English/Persian at mobile, tablet, desktop, and second-LCD widths.
- [x] Sidebar alert severity indicator with red critical state.
- [x] Persian font and number/unit localization pass.
- [x] Replace cramped server CPU/RAM/disk text chips with icon+value indicators.
- [x] Simplify the health chart so timeline labels and the plot are readable in dashboard density.
- [x] Keep the 1920x1080 second-LCD dashboard at zero main-content overflow in English and Persian.
- [x] Reduce dashboard vertical scroll at 1440x900 without making the 1920x1080 NOC display feel sparse.
- [x] Add a desktop sidebar collapse/expand control with persisted state and accessible labels.
- [x] Compact panel headers so metadata like node/link counts stays inline with the title.
- [x] Improve mobile/tablet resource strip density.
- [x] Add empty/loading/error states for every dashboard panel.
- [x] Add hover/tooltips for dense icon-only monitoring controls and metrics.
- [x] Review color contrast for warning/critical states in light and dark sidebar contexts.
- [x] Bind alert/sidebar severity to real alert API rows instead of fallback/computed rows.
- [x] Add Playwright browser smoke test for fixed-port dashboard rendering.
- [x] Add screenshot-based visual regression captures for the dense dashboard layout.

## Phase 2: Users, Usage, Billing

- [x] Telegram identity user model.
- [x] Privacy-safe paid number storage.
- [x] Customer account model that can own multiple client configs/devices.
- [x] Volume package model.
- [x] Price per GB setting.
- [x] Shared account GB quota with optional per-client/device caps.
- [x] Route usage multipliers for expensive outbounds and rated usage events.
- [x] Extensible payment method catalog with PayPal as a first-class provider.
- [x] Payment order lifecycle with pending/paid/failed/refunded states.
- [x] Separate seller/admin and VPN-client UX boundaries in the backend contract.
- [x] Reseller/representative role foundation for mobile-shop sellers.
- [x] Reseller account and wallet ledger schema.
- [x] Guarded admin reseller wallet APIs for account listing, package quote, top-up, and package debit.
- [x] Reseller-scoped dashboard/panel so each representative can manage only their own customers, orders, and wallet.
- [x] Wallet-gated reseller client creation/renewal that automatically debits AfroGate share at sale time.
- [x] Reseller seller workspace sidebar with scoped Dashboard, Users, and Billing pages, sales charts, Users-page add-user dialog sale action, sold-users table, and wallet selling summary.
- [x] PayPal checkout capture adapter and webhook verification.
- [x] Paid payment order quota allocation.
- [x] Rewarded-ad quota credit ledger and mobile client claim surface.
- [x] Admin-managed rewarded-ad reward and daily cap settings.
- [x] Admin dashboard usage and billing page.
- [x] Admin dashboard customer account limit manager for shared account and per-client GB caps.
- [x] Additional payment provider adapters for card, crypto, bank transfer, and local gateways.
- [x] Verified rewarded-ad provider SDK/webhook adapter.
- [x] Usage accounting.
- [x] Remaining volume display.
- [x] Client-scoped mobile API/auth for VPN users.
- [x] Client subscription refresh endpoint for updated safe server addresses.
- [x] Telegram bot user commands.
- [x] Superadmin Settings Telegram bot setup for BotFather token, webhook secret, allowed chat/admin IDs, and Telegram API connection test.
- [x] Telegram bot onboarding and rotation guide that explains bot creation happens in Telegram BotFather, while AfroGate stores only encrypted/write-only token material.
- [x] Telegram purchase fulfillment flow that sends one client-scoped VLESS config plus a private usage/status link after verified payment.

## Phase 3: Auto Route

- [x] Route assignment model.
- [x] Read-only route decision preview with advisory action, route lock, cooldown, hysteresis, and reason codes.
- [x] Candidate recommendation/rejection detail review in the read-only route decision preview.
- [x] Assignment-only route decision apply boundary with audit event and data-plane disabled.
- [x] Route apply plan with guard, assignment, drain, switch, verify, and rollback steps.
- [x] Route apply adapter readiness registry with data-plane apply disabled by default.
- [x] Dry-run-only WireGuard apply command and config preview.
- [x] Persist dry-run route apply snapshots in decision event context.
- [x] Admin-visible route decision event detail with stored dry-run snapshot inspection.
- [x] Auto route toggle.
- [x] Route lock toggle.
- [x] Manual route override for choosing a specific WireGuard/protocol path.
- [x] Advanced smart load balancing by health score, packet loss, jitter, latency, throughput, load, and security profile.
- [x] Health-based route decision.
- [x] Smart-route profile selection for TCP-heavy, UDP-heavy, QUIC, DNS-sensitive, low-speed, and high-speed routes.
- [x] Latency-sensitive/gaming route profile prioritizing stable latency, low jitter, low packet loss, and route consistency over raw bandwidth.
- [x] Bufferbloat and loaded-latency detection with SQM/AQM recommendations for routes that look fast but lag under load.
- [x] Initial route quality history analytics API and Settings recommendations from synthetic probes.
- [x] Initial hourly route quality summary table and aggregation scheduler.
- [x] Route quality history aggregation by server, outbound, operator, protocol profile, and time bucket.
- [x] Time-of-day and day-of-week route analytics for operator/outbound patterns such as Irancell/BTS windows.
- [x] Predictive route recommendations before historically degraded time windows.
- [x] Gaming-safe sticky-session and drain policy preview for active session protection.
- [x] Transparent switch-engine planning preview with guard, session pinning, new-session routing, drain, active switch, verify, and rollback phases.
- [x] Assignment-only switch execution envelope with sticky-session, drain, cooldown, and data-plane-blocked audit state.
- [x] Switch-engine preflight/readiness checklist for feature flag, adapter, dry-run, guard, session-safety, rollback, cooldown, audit, and health-verify gates.
- [x] Advisory route canary rollout plan with pinned existing sessions, new-session canary percentages, rollback thresholds, and route-consistency holds.
- [x] Advisory route canary health evaluation for packet-loss, jitter, latency, score, and rollback/hold recommendations.
- [x] Transparent route switch engine with sticky sessions, route locks, cooldown, and drain-safe apply behavior.
- [x] Hysteresis and cooldown.
- [x] Route decision audit reason.
- [x] Per-client route preference model for auto country detection, preferred exit country, and explicit server/outbound choice.
- [x] Route decision filtering by per-client preferred exit country and available country/server candidates.
- [x] Mobile client UX for automatic route, country selection, and explicit server choice.
- [x] Native client per-app VPN split tunneling profile with local app selection, Android include-only `VpnService` enforcement reference, and iOS managed-profile boundary so selected apps can use AfroGate where native enforcement is available while other apps stay on normal internet.
- [x] Adaptive MTU/fragmentation diagnostics and safe MTU recommendations for mobile/VPN routes, with no automatic mid-session change unless session-safety gates allow it.

## Phase 4: Current Panel Integration

- [x] Read users from Marzban/X-UI/current panel.
- [x] Controlled current-panel config import into AfroGate client configs with baseline usage events.
- [x] Sync volume usage.
- [x] Charge/update user volume.
- [x] Import/export configs.
- [x] Protocol-specific client subscription config-link readiness for WireGuard, VLESS, L2TP, and IKEv2.
- [x] Secret-backed per-client subscription config-link renderer with encrypted client credentials.

## Phase 5: Enterprise Path

- [x] Owner/Admin/Supervisor/Support/Auditor role foundation.
- [x] Guarded audit log API and dashboard Audit Logs page.
- [x] Fine-grained production RBAC policy and permission UI.
- [x] Backup and restore UI.
- [x] Reports and data analysis.
- [x] Tenant/brand settings.
- [x] Enterprise deployment guide.

## Enhancement Tracks

- [x] Incident timeline.
- [x] Telegram critical alert flow.
- [x] Route health score history.
- [x] Operator and outbound time-window quality reports.
- [x] Initial advisory route quality suggestions from historical synthetic probes.
- [x] Predictive route quality suggestions.
- [x] Charge allocation delay tracking.
- [x] Backup status monitoring.
- [x] Route canary rollout.
- [x] Adapter-based migration from current panels.
- [x] Privacy threat model.
- [x] Security threat model.
- [x] Rate limiting at API layer.
- [x] Dependency audit in CI.
- [x] Secret scan in CI.
- [x] Per-agent token rotation.
- [x] Database least-privilege roles.
- [x] Loaded latency and bufferbloat monitoring.

## UI/UX Refactor Track

Progress: 11 / 11 complete (100.0%), 0 remaining.

- [x] Create dedicated UI/UX implementation checklist.
- [x] Add reusable dashboard tabs.
- [x] Add reusable dashboard table primitive.
- [x] Add dashboard donut/circle chart support.
- [x] Convert Users page into Admin users/Permissions tabs.
- [x] Convert Routes page into Overview/Policy/Canary/History tabs.
- [x] Convert Billing page into Catalog/Customers/Panel Import/Telegram/Orders tabs.
- [x] Convert Settings page into Route/WireGuard/Protocols/Branding/Telegram tabs.
- [x] Move admin users, billing customer accounts, and payment orders onto the shared table primitive.
- [x] Run full browser UI audit across all dashboard pages after the tab refactor.
- [x] Continue migrating Audit Logs, tunnels, and reseller wallet/sold-user tables to the shared table primitive.

## Phase 6: Release Readiness & Security Hardening

Added 2026-06-01 after a full backend/frontend/security/firewall audit. Every feature
checklist above is complete, but these items are required before a real paid customer
rollout and before treating the system as "cannot be hacked". Verified facts:
typecheck passes, production build passes, 20/20 Playwright UI smoke tests pass,
`npm audit` clean, firewall/Nginx hardening samples are strong.

### Automated test coverage (highest priority)

- [x] Set up a backend test runner (done 2026-06-02: Node's built-in `node:test` with TS type-stripping, no new deps; `npm run test:backend`, wired into CI). Test files live in `apps/backend/test/`.
- [~] Add backend unit/integration tests. 117 tests across bearer-token, rbac, password, session-token, client-token, reseller-ownership, reseller-wallet-math, rewarded-ad-webhook crypto, command-safety, outbound-url-policy (SSRF), rate-limit-window, and the admin route-guard + XSS/SQLi static regression guards. Remaining: PayPal/Telegram webhook verification and transactional allocation idempotency.
- [x] Test auth crypto: token parsing + timing-safe compare (`bearer-token.test.ts`), scrypt password hash/verify (`password.test.ts`), and session-token sign/parse/tamper-rejection (`session-token.test.ts`). Done 2026-06-02 by extracting the previously-private `AuthService` crypto into non-decorated `security/password.ts` + `security/session-token.ts`. Still pending: full `login()`/session-expiry path through `AuthService` (needs DI mocks) and default-credential rejection.
- [x] Test RBAC: role × permission matrix covered (`rbac.test.ts`) for superadmin/owner wildcard, admin (no `adminUsers:write`), supervisor/support/auditor read scopes, reseller own-scope, and `getEffectiveRolePermissions`. (Still want a route-level guard regression test — see below.)
- [x] Test reseller own-scope enforcement (`ensureCustomerAccountBelongsToReseller`, `ensureClientConfigBelongsToReseller`) against cross-tenant IDOR attempts. Done 2026-06-02: extracted to `billing/reseller-ownership.ts` and covered by `reseller-ownership.test.ts` (belongs / not-found / cross-reseller / cross-customer / null-owner, plus parameterization assertions) via the in-memory fake executor.
- [x] Test client-token scoping. Done 2026-06-02: extracted `normalizeScopes`/`assertClientScope` into `security/client-token.ts` and covered them plus `hashClientToken` in `client-token.test.ts` (deterministic SHA-256 hashing so tokens are looked up by hash never plaintext, scope dedup/normalization, and ForbiddenException when a token lacks the required scope). The own-config/quota row mapping is enforced in `authenticateClientAccessToken` (token→own clientConfigId); a DB-fake test of that query is the remaining transactional piece.
- [~] Test wallet/quota math. Done 2026-06-02: extracted the pure reseller wallet math to `billing/reseller-wallet-math.ts` and covered it in `reseller-wallet-math.test.ts` (margin-bps validation/bounds, AfroGate-share complement clamping, price→margin/debit split with rounding, no-negative debit, credit-limit floor). Still pending the transactional pieces: top-up + allocation idempotency / no-double-credit (these run inside DB transactions and need the fake-executor harness extended to multi-query flows).
- [x] Add an automated security-regression test that asserts every `@Controller('admin')` route declares `@Roles`. Done 2026-06-02 (`admin-route-guards.test.ts` scans controller sources and fails if any admin route lacks `@Roles`/`@Public`).

### Web hardening

- [x] Add a Content-Security-Policy header to the Nginx samples (done on `hardening/web-security`: CSP added to `infra/ubuntu/nginx.conf.sample` and `infra/docker/nginx.conf.sample`).
- [x] Make backend CORS fail-closed: `main.ts` uses the explicit `CORS_ORIGIN` allowlist and falls back to `origin: false` (same-origin only) with a warning when unset.
- [x] Added app-layer security headers in `main.ts` (no new dependency): nosniff, X-Frame-Options DENY, Referrer-Policy, Cross-Origin-Resource-Policy, X-Permitted-Cross-Domain-Policies, and a strict `default-src none` CSP for the JSON API — defense in depth if exposed without Nginx.
- [x] Documented `AFROGATE_RATE_LIMIT_TRUST_PROXY_HEADERS` production guidance in `.env.example` (set true behind Nginx so per-IP limits use the real client IP).

### Injection & input-security testing (to implement after the dashboard split)

2026-06-01 static review found no obvious injection holes (no XSS sinks; SQL is fully
parameterized with `$N`; interpolated SQL identifiers are hardcoded literals; global
`ValidationPipe({ whitelist: true })` is on). These tasks turn that review into tested,
enforced guarantees and cover the one high-risk path the review could not fully verify.

- [x] XSS: `static-injection-guards.test.ts` fails on any `dangerouslySetInnerHTML`/`innerHTML=`/`eval(`/`new Function(` in dashboard + client src; CSP header added to Nginx samples (on `hardening/web-security`).
- [x] XSS: user-controlled strings (display names, Telegram usernames, notes, server/tunnel names, alert messages) render through React, which escapes all string children by default; `static-injection-guards.test.ts` proves there is no `dangerouslySetInnerHTML`/`innerHTML`/`eval` bypass, so those values cannot break out of text context.
- [x] SQL injection: `static-injection-guards.test.ts` asserts parameterized SQL only — no value interpolation on placeholder lines (allows index builders + no-arg `*Sql()` fragment builders) and no string-concatenated SQL in backend services.
- [x] **Command injection:** extracted the protocol-apply sanitizers into `operations/command-safety.ts` (safePathSegment, safeRouteTableName, routeMarkHex, shellToken, safeConfigFileName, safeWireGuardInterfaceName) and covered them in `command-safety.test.ts` (path-traversal/metacharacter neutralization, POSIX single-quote escaping of `'; rm -rf /` payloads, interface-name allowlist). Production executor stays disabled-by-default behind feature flags + superadmin.
- [x] SSRF: extracted `outbound/outbound-url-policy.ts` (consumed by the shared outbound HTTP client) enforcing http/https-only and blocking cloud-metadata endpoints (169.254.169.254, metadata.google.internal, IMDSv6); covered by `outbound-url-policy.test.ts`. Targets remain admin/config-controlled and egress stays on the proxy path on restricted servers.
- [~] Auth/JWT tampering: covered session-token forgery/tamper (cannot re-sign without the secret) and payload validation (`session-token.test.ts`) plus client-token scope enforcement (`client-token.test.ts`). The session model uses a fixed HMAC scheme (no `alg` field, so alg-swap is N/A); expiry check + agent-token rejection live in the decorated AuthService/guards and remain to cover via a guard-level harness.
- [~] Webhook forgery: rewarded-ad webhook fully covered (`rewarded-ad-webhook.crypto.test.ts`) — HMAC signature match, payload-tamper and wrong-secret rejection, replayed/stale-timestamp rejection, and canonical-JSON key-order independence. PayPal (external `verifyWebhook` adapter) and Telegram (secret-token header) verification remain.
- [x] Rate-limit/DoS: extracted the fixed-window counter into `security/rate-limit-window.ts` and covered it in `rate-limit-window.test.ts` (allow-up-to-limit, block-over-limit with retry-after, window reset, per-key isolation, expired/oldest eviction). Request body caps are enforced at Nginx (`client_max_body_size 1m`) in the samples.
- [x] Added CodeQL SAST workflow (`.github/workflows/codeql.yml`, `security-extended` queries) alongside the existing secret scan + `npm audit`.

### Code structure / maintainability (UI/UX)

- [x] Split `apps/dashboard/src/DashboardApp.tsx` 14,862 -> ~1,294 lines (~91%) on `refactor/split-large-files`: extracted types/formatters/mappers/tone/labels/route-labels/route-helpers/server-helpers/chart-options/ui-classes/session-access plus `components/` (primitives, panels, dashboard-panels, route-decision, protocol-apply, settings-form, Sidebar, SystemResourceHeader) and `pages/` (all pages). Root orchestrator remains in DashboardApp.tsx.
- [~] Split the large backend services. Begun by extracting focused, testable modules out of them: `operations/command-safety.ts`; `billing/reseller-ownership.ts`, `billing/reseller-wallet-math.ts`, `billing/rewarded-ad-webhook.crypto.ts`; plus `security/password.ts` and `security/session-token.ts` from auth. Full domain split of operations.service.ts / billing.service.ts is the remaining structural work.
- [~] `apps/dashboard/src/i18n.ts` remains a single typed English/Persian translation object (type-safe, one source of truth). Per-namespace file splitting is optional polish and not yet done.

### Release / deployment validation

- [~] Ubuntu install drill runbook prepared (`docs/release-readiness-runbooks.md` §1) with verification steps; **execution needs a live host** (cannot be run in CI/by agent).
- [~] Encrypted backup + restore drill runbook prepared (`docs/release-readiness-runbooks.md` §2); **execution needs a live host/DB**.
- [~] Load/scale test prepared: k6 starter `scripts/loadtest/afrogate-smoke.js` + plan (`docs/release-readiness-runbooks.md` §3); **execution needs a deployed host + k6**.
- [~] Penetration-test scope & readiness package prepared (`docs/release-readiness-runbooks.md` §4) referencing the threat models; **needs an external auditor** to execute.
- [~] Agent-token & secret-rotation runbook documented (`docs/release-readiness-runbooks.md` §5); **rehearsal needs a staging environment**.
