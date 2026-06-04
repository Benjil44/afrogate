# Afrows Security Threat Model

## Overview

Afrows is a control plane for monitoring VPN/server health, billing VPN-client accounts, and making advisory route decisions for stable internet access. The repository contains:

- `apps/backend`: NestJS API for admin auth, billing, tenant branding, metrics ingest, alerts, route decisions, Telegram/PayPal/rewarded-ad integration, and server/outbound management.
- `apps/dashboard`: React admin/seller dashboard.
- `apps/client`: React VPN-client app for quota and route preference.
- `apps/agent`: Python monitoring agent that sends compact server metrics and synthetic route probes.
- `packages/shared`: API contracts shared by backend, dashboard, and client.
- `infra`: deployment samples for Ubuntu, PostgreSQL, Docker, and Nginx.

The highest-value assets are admin sessions, deployment secrets, server credentials, agent/client tokens, billing/payment state, customer identity metadata, route control state, audit logs, and the PostgreSQL database. The most important security invariant is that public or lower-privilege inputs must not mutate billing, server, route, secret, or admin state without the correct authentication, authorization, validation, and audit trail.

## Threat Model, Trust Boundaries, and Assumptions

Primary actors:

- Anonymous internet users reaching public HTTPS routes through Nginx.
- Admin/seller/support/auditor users authenticated to the dashboard.
- VPN clients authenticated with client-scoped access tokens.
- Agents authenticated with per-server hashed tokens or the legacy bootstrap fallback token.
- Payment, rewarded-ad, and Telegram providers sending public webhooks.
- Operators with deployment access to `.env`, systemd, Nginx, and database credentials.

Trust boundaries:

- Public internet to Nginx/backend: only HTTPS and required VPN UDP ports should be public. Backend port, dashboard dev port, PostgreSQL, Redis, and metrics internals must stay local/private.
- Browser to backend API: dashboard routes use admin session/auth guards; client routes under `/api/client/*` use client token guards and must not expose admin operations.
- Agent to backend: metrics ingest is write-only and token-authenticated. Agent payloads are not trusted just because they come from a known server.
- Provider webhooks to backend: PayPal, rewarded-ad, and Telegram webhooks are public inputs and require provider signature/secret checks before side effects.
- Backend to deployment secrets: decrypted secrets must remain server-side, write-only from API clients, and never appear in API responses, dry-run snapshots, logs, or dashboard state.
- Control plane to data plane: current route/protocol apply workflows are advisory or assignment-only unless explicit feature flags, audited adapters, secret readiness, rollback, cooldown, and health checks are present.

Attacker-controlled inputs include login credentials, webhook bodies and headers, client tokens, route preference updates, tenant branding form values from compromised admin accounts, admin form values from compromised lower-privilege accounts, agent metric payloads, public payment metadata, uploaded/imported panel data in future phases, and any data returned by external APIs. Operator-controlled inputs include environment variables, systemd files, Nginx config, migration execution, and deployment secrets. Developer-controlled inputs include code, migrations, tests, package scripts, and CI configuration.

Assumptions:

- Production is deployed behind Nginx with TLS, backend bound to localhost/private interfaces, and PostgreSQL not publicly exposed.
- Secrets are provisioned from deployment secret storage, not committed to git.
- Dashboard users can be malicious or compromised within their role; server-side role checks are required.
- Network quality signals are synthetic or local telemetry only. Afrows does not inspect user traffic payloads or destinations for routing decisions.

## Attack Surface, Mitigations, and Attacker Stories

Public/sensitive endpoints:

- `POST /api/auth/login` is protected by password hashing and API rate limiting.
- `POST /api/payments/paypal/webhook` must verify PayPal transmission signature headers before mutating payment orders.
- `POST /api/rewarded-ads/webhook` must verify HMAC signature and timestamp freshness before rewarding quota.
- `POST /api/telegram/webhook` is disabled by default and requires Telegram's secret-token header before replying.
- Agent metrics ingest must require agent authentication and reject unauthenticated writes.
- Import/sync APIs for Marzban/X-UI/current panels must treat panel responses as untrusted data.

Existing mitigations:

- Admin guards and role guards protect `/api/admin/*`.
- Client access tokens are one-time plaintext at issuance and stored only as hashes.
- Agent tokens are issued or rotated as one-time plaintext values, stored only as hashes, scoped to metrics writes, and revocable per server through a guarded audited admin endpoint.
- Paid numbers are write-only and stored as HMAC hashes.
- Server and protocol secrets use encrypted secret references; API responses return metadata only.
- Per-client subscription credentials use encrypted client-owned rows; admin APIs return metadata only, and client subscription rendering is scoped to the authenticated client's own active credential plus explicit public endpoint metadata.
- Route apply remains advisory/assignment-only until audited data-plane adapters are ready.
- API rate limiting is enabled by default for login and public webhook routes.
- PayPal provider credentials live in environment/deployment settings. Telegram bot/webhook secrets can live in encrypted Settings secret storage with environment values kept as bootstrap/fallback configuration.
- Tenant branding is guarded by explicit read/write permissions, audited on update, and limited to public metadata fields so it cannot become secret or production-config storage.
- Audit logs are required for sensitive admin, billing, routing, credential, and live-apply requests.
- CI includes version checks, secret scanning, dependency audit, typecheck, build, and browser smoke coverage.

Realistic attacker stories:

- Brute-force admin login or reuse leaked credentials to gain dashboard access.
- Send forged PayPal webhook events to mark orders paid or allocate quota without real payment.
- Send forged rewarded-ad webhook events to credit data without a real provider-confirmed ad view.
- Abuse Telegram webhook exposure to enumerate linked accounts or force outbound API calls.
- Compromise a support/admin account and attempt to read secrets, change quotas, or reroute users.
- Send malicious agent metrics or route-probe metadata to poison health scores and influence route decisions.
- Exploit panel import/sync/charge/export code with untrusted remote panel fields or over-broad local export surfaces; current controlled import/sync/export must keep parsing adapter-scoped, skip unsupported, duplicate, missing, ambiguous, cross-account, or non-advancing candidates, avoid raw payload storage, exclude subscription credentials and secret-bearing config material, and avoid external panel/API/data-plane side effects. Local volume charge must stay guarded, audited, idempotency-aware, and explicit that no external-panel write was executed.
- Abuse writable notes, metadata, tenant branding, or public config fields to store secrets or inject UI content.

Out-of-scope or lower-priority stories:

- Direct backend or database exposure is a deployment failure; Afrows still documents and checks for private binding, but production firewalls/Nginx must enforce it.
- OS-level compromise of a VPS can bypass application controls on that host.
- Perfect prevention of packet loss is not a security invariant; route stability is handled by health scoring, cooldown, route locks, and session-safe switching policy.

## Severity Calibration

Critical:

- Remote unauthenticated access to admin APIs, secrets, server credentials, or payment allocation mutation.
- Any path that decrypts and returns server/protocol secrets, client tokens, Telegram/PayPal secrets, or private keys.
- Live route/protocol apply that can execute shell commands, reload services, or change OS routing without superadmin authorization, audited adapter gates, rollback, and secret-safe handling.
- SQL injection or auth bypass that exposes or mutates PostgreSQL billing, customer, route, admin, or secret tables.

High:

- Forged PayPal payment state changes or duplicate allocation that credits quota without verified payment.
- Support/admin privilege escalation, superadmin mutation by non-superadmin, or broken role checks on credential or billing endpoints.
- Agent token bypass allowing attacker-controlled metrics to create critical alerts, poison route scores, or impersonate server health at scale.
- Stored XSS in dashboard-visible fields that can steal admin sessions or trigger privileged API calls.
- SSRF through health checks, outbound API calls, webhook verification, or future panel sync that reaches local metadata, private services, or control-plane ports.
- Tenant branding write access used for phishing, stored UI injection, or unsafe logo/support URLs if validation and role checks are weakened.

Medium:

- Missing rate limits on login/webhooks that enable brute-force, provider retry amplification, or resource exhaustion.
- Information leaks of customer identity metadata, hashed paid-number presence, quota state, route assignment state, or admin usernames beyond intended roles.
- Weak validation on route preferences, tenant branding, public provider config, rewarded-ad metadata, or notes that enables stored junk, UI confusion, or operational mistakes.
- Audit gaps for sensitive quota, route, credential, admin, or live-apply actions.

Low:

- UI-only display bugs that do not change backend authorization, secrets, payments, quotas, or routing.
- Overly broad local developer defaults that are documented as local-only and not reachable in production.
- Non-sensitive route scoring inaccuracies that remain advisory and cannot mutate live data-plane routing.
