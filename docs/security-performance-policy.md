# AfroGate Security and Performance Policy

## Mission

AfroGate must be designed like infrastructure people depend on, not a casual dashboard. Stable, private, high-quality internet access can affect work, safety, education, family, and basic human freedom.

That means every feature must pass three checks:

- Does it improve reliable access?
- Does it preserve safety and privacy?
- Does it run efficiently on expensive, low-resource VPS machines?

## Clean Code Rules

- Do not duplicate business logic. Put shared contracts in `packages/shared`.
- Keep app boundaries clear:
  - backend owns API rules, auth, billing, alerts, route decisions.
  - dashboard owns UI and visualization.
  - agent owns lightweight metrics collection.
  - infra owns deployment and hardening.
- Keep functions small and named by intent.
- Prefer typed DTOs and explicit validation over loose objects.
- Put route scoring, alert thresholds, billing math, and role checks behind isolated services with tests.
- Avoid hidden side effects in utility functions.
- Every security-sensitive action needs an audit event.

## Low-Resource VPS Policy

VPS resources are expensive and often limited. AfroGate must avoid waste:

- No Kubernetes for MVP.
- No heavy metrics stack until needed.
- PostgreSQL first; TimescaleDB/partitioning later if metrics volume requires it.
- Redis only when queueing or alert fanout needs it.
- Agent must stay lightweight and send compact payloads.
- Use polling first where enough; use SSE/WebSocket only where it improves operations.
- Cache read-heavy dashboard data briefly.
- Keep metrics retention tiered:
  - high-resolution recent data
  - downsampled older data
  - deleted sensitive data after retention

## Speed and Routing Policy

Routing must be fast, explainable, and stable.

- Use WireGuard cryptokey routing carefully with explicit `AllowedIPs`.
- Never auto-route blindly.
- Every route decision must record:
  - current route
  - candidate route
  - health score
  - reason for change or rejection
  - cooldown state
- Health-based movement may bypass normal score hysteresis only when the current managed route is unhealthy and a healthy managed candidate exists; route lock, manual mode, cooldown, and audit requirements still apply.
- Use hysteresis to avoid route flapping.
- Support route lock for users/configs that should not move.
- Prefer kernel-level routing and firewall tools over app-level hacks.
- Monitor per-route ping, jitter, packet loss, throughput, and saturation.
- Score routes by protocol profile where useful: TCP, UDP, QUIC/HTTP3, DNS, and WireGuard/tunnel health can differ on the same server.
- Keep smart-route profile recommendations advisory and synthetic-signal-based. Do not infer a user's actual destinations or traffic contents to choose TCP, UDP, QUIC, DNS, WireGuard, gaming, stability, or throughput policy.
- Keep protocol probes privacy-safe: use synthetic configured targets, do not inspect user payloads, and do not store user destination history.
- Keep client VPN route preferences separate from admin/seller workflows. Client country detection may store only coarse ISO country codes plus a detection source and timestamp; do not store client IP history or traffic destinations for this feature.
- Let client apps request automatic country detection, a preferred exit country, or a specific server/outbound, but exact server/outbound choice must be explicit and lock-aware so games and active sessions are not silently moved.
- Route decision previews may use saved client country/outbound preference plus managed server country metadata to rank candidates, but unavailable or unhealthy preferences must fall back to the normal health/session-safe recommendation with visible reason codes rather than forcing a bad path.
- Keep mobile/client API auth separate from admin auth. Client access tokens must be one-time plaintext at issuance, stored only as hashes, revocable by admins, scoped to one client config, and limited to client-owned profile/quota/route-preference actions under `/api/client/*`.
- Classify route use cases by speed profile. Low-speed paths should favor stability and low loss; high-speed paths should favor throughput headroom without accepting bad jitter/loss.
- Keep the latency-sensitive/gaming profile available before production auto-routing. This advisory profile prioritizes stable latency, low jitter, low packet loss, route consistency, and fast congestion avoidance over raw bandwidth or speedtest throughput.
- For gaming, UDP, QUIC, WireGuard, and stability-sensitive profiles, normal route improvements must prefer sticky sessions and new-session-only drains over mid-session route changes; emergency switching is reserved for failing current routes where staying put is worse than possible session reset.
- Keep profile scoring, persisted assignment controls, and route decision preview conservative until the route apply engine is audited: admins may save auto-route, route lock, current/locked route, cooldown, and hysteresis policy; preview events may record the proposed action, reason codes, non-secret candidate-review context, advisory smart-load-balancing roles/weights, session-safety policy, transparent switch-engine planning steps, structured apply-plan context, apply-adapter readiness, and normalized secret-safe dry-run snapshots with `applied_at = null`; read-role admins may inspect stored event detail on demand without bloating the recent-events list; and assignment-only apply may update saved control-plane assignment with `dataPlaneApplied = false` plus a switch-execution summary for sticky-session, drain, cooldown, rollback, and data-plane-blocked state. Automatic server OS/data-plane movement still requires `AFROGATE_ROUTE_DATA_PLANE_APPLY_ENABLED=true`, a real audited adapter, safe apply logic, cooldown enforcement, hysteresis checks, route lock checks, and drain-safe behavior in the apply path.
- Before any future data-plane movement, route decision previews must pass a switch-preflight checklist for feature flag, adapter implementation/support, dry-run safety, route guards, session safety, rollback, cooldown, audit, and health verification. Failing or future preflight gates must stay visible to admins and persisted in decision context.
- Future data-plane movement must start with a rollout plan that pins existing sessions, canaries new sessions first, verifies packet loss/jitter/latency rollback thresholds, honors a route-consistency hold, and persists the planned steps for audit before any automatic expansion.
- Rollout evaluation must remain advisory until the audited data-plane adapter exists. A failed packet-loss, jitter, latency, or score guard should recommend hold, manual review, or rollback instead of expanding traffic.
- Switch orchestration must keep the full next-action state visible: route lock, manual mode, cooldown, preflight, sticky-session, canary, hold, verify, expand, rollback, and assignment-only boundaries must be explicit before any future live movement can be trusted.
- Do not require GPU acceleration for MVP route intelligence. Packet-loss and jitter reduction depends on path measurement, bufferbloat control, policy routing, and stable switching rules; compact CPU-side time-series scoring is the right default for low-resource VPS machines.

## Buffering and Latency Policy

Throughput alone is not success. High speed with high latency under load is still bad service.

- Track latency while links are busy, not only idle ping.
- Detect bufferbloat by comparing idle ping vs loaded ping.
- Treat loaded-latency deltas as route-quality signals: medium risk should recommend SQM/AQM review, and high risk should avoid the path for latency-sensitive or under-load routing decisions unless an admin deliberately locks it.
- Prefer SQM/AQM where useful:
  - CAKE when CPU can handle it.
  - fq_codel when resources are weaker.
- Do not enable shaping blindly on 1 Gbps servers without measuring CPU impact.
- Alert when jitter or packet loss rises under load.

## Firewall and Exposure Policy

Every server should start with a closed posture:

- Public:
  - `80/tcp` and `443/tcp` only through Nginx.
  - WireGuard UDP ports only when needed.
- Restricted:
  - SSH only from trusted admin IP ranges where possible.
- Private/local only:
  - backend API port
  - dashboard internal port
  - PostgreSQL
  - Redis
  - metrics internals

No production database, Redis, or backend admin port should be exposed directly to the internet.

## Roles and Permissions

Initial roles:

- Superadmin: permanent bootstrap root account for the system owner. It must not be removable, disableable, or mutable by other admins.
- Owner: full control, security settings, roles, backups.
- Admin: operational management, users, servers, routes.
- Support: user support and safe read/update actions only.
- Auditor: read-only audit and reports.
- Agent: metrics write-only, no dashboard access.

Rules:

- Deny by default.
- Role checks must happen server-side.
- Admins can have broad operational access, but they must not remove, disable, or change the superadmin account.
- Managed admin accounts must store password hashes only; local MVP storage uses scrypt hashes in `AFROGATE_ADMIN_USERS_FILE`, and production should move this to PostgreSQL with the same superadmin invariant.
- Support must not access secrets or private routing keys.
- Agent tokens must not be accepted for admin APIs.
- Sensitive role changes require audit logs and later MFA.

## Attack Resistance

Required protections:

- Rate limiting at Nginx and API layer.
- Request body size limits.
- Strict CORS.
- Helmet/security headers before production.
- Validation on every input DTO.
- No stack traces in production responses.
- Brute-force detection for admin login.
- Agent authentication for metrics ingest.
- Separate tokens per agent.
- Secret rotation plan.
- Paid numbers must be write-only in admin APIs and stored as HMAC hashes with `AFROGATE_IDENTITY_HASH_KEY` or the deployment secrets key; never return raw paid numbers to the dashboard.
- Payment provider catalogs may expose non-secret public config only. PayPal client secrets, webhook secrets, merchant credentials, and private gateway keys must use encrypted secret storage or deployment secrets, never `payment_methods.public_config`.
- Payment orders must be idempotent where provider/client keys exist, must store only non-secret provider metadata, and must use audited status transitions. `client_usage_events` is the append-only usage ledger for consumed traffic and must use source/idempotency keys to avoid double-counting; paid orders still should not allocate purchased quota until the separate charge allocation path can consume them idempotently.
- `AFROGATE_SECRETS_KEY` must be configured from a deployment secret source before storing Settings/server private keys; encrypted secret rows must expose only references to dashboard clients.
- Server credential storage is write-only: the guarded server credential endpoint may encrypt and link SSH/API credential material to an access profile, but API responses must return only metadata and active/readiness flags, never decrypted credential payloads.
- Protocol provisioning must stay secret-safe and default-inactive: control-plane draft provisioning may create disabled maintenance outbounds, while real server apply actions require audit logs and post-apply health validation.
- Protocol server apply adapters must expose a dry-run-only command-runner, non-secret config-material boundary, generated-command policy boundary, protocol-secret readiness boundary, server-credential readiness boundary, and separate decrypt gates before live execution is enabled. Complete saved non-secret config material, allowlisted command previews, a saved protocol `secretRef`, or an active `server_credentials` record is not enough by itself: `AFROGATE_PROTOCOL_SERVER_APPLY_SECRET_DECRYPT_ENABLED=false` and `AFROGATE_PROTOCOL_SERVER_APPLY_CREDENTIAL_DECRYPT_ENABLED=false` keep decrypt permission off by default, and live mutation must still require the protocol apply flag, live executor flag, installed access profile, explicit superadmin action, audited adapter implementation, audit logging, and post-apply health validation. Generated commands must be single-purpose, timeout-bounded, secret-safe, rollback-backed for mutations, and free of shell chaining before a future executor can run them. Decrypted protocol or server credentials must never be returned to dashboard clients, stored in dry-run snapshots, or logged.
- Server root passwords must not be kept as normal long-term credentials; use temporary bootstrap credentials, then agent plus SSH keys for a dedicated management user.
- Saved server secrets must never be displayed back to admins; support replace, test, rotate, revoke, and audit instead.
- Database least-privilege accounts.
- Backups encrypted and tested.

## Implementation Priority

1. Close public holes: firewall, Nginx, metrics token guard.
2. Add admin auth and roles.
3. Add audit logs.
4. Add rate limiting and brute-force protection.
5. Add secure backup/restore.
6. Add route decision audit writes, route lock controls, and audited route apply.
7. Add dependency scanning and secret scanning.

## References

- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) for secure application requirements.
- [Ubuntu Server firewall documentation](https://ubuntu.com/server/docs/how-to/security/firewalls/) for UFW/netfilter basics.
- [WireGuard documentation](https://www.wireguard.com/) for cryptokey routing.
- [Nginx `limit_req` documentation](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html) for request rate limiting.
- [PostgreSQL `pg_hba.conf` documentation](https://www.postgresql.org/docs/current/auth-pg-hba-conf.html) for host-based authentication.
- [Vite production build documentation](https://vite.dev/guide/build) for static dashboard deployment.
