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
- Use hysteresis to avoid route flapping.
- Support route lock for users/configs that should not move.
- Prefer kernel-level routing and firewall tools over app-level hacks.
- Monitor per-route ping, jitter, packet loss, throughput, and saturation.

## Buffering and Latency Policy

Throughput alone is not success. High speed with high latency under load is still bad service.

- Track latency while links are busy, not only idle ping.
- Detect bufferbloat by comparing idle ping vs loaded ping.
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

- Owner: full control, security settings, roles, backups.
- Admin: operational management, users, servers, routes.
- Support: user support and safe read/update actions only.
- Auditor: read-only audit and reports.
- Agent: metrics write-only, no dashboard access.

Rules:

- Deny by default.
- Role checks must happen server-side.
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
6. Add route decision audit and route lock.
7. Add dependency scanning and secret scanning.

## References

- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) for secure application requirements.
- [Ubuntu Server firewall documentation](https://ubuntu.com/server/docs/how-to/security/firewalls/) for UFW/netfilter basics.
- [WireGuard documentation](https://www.wireguard.com/) for cryptokey routing.
- [Nginx `limit_req` documentation](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html) for request rate limiting.
- [PostgreSQL `pg_hba.conf` documentation](https://www.postgresql.org/docs/current/auth-pg-hba-conf.html) for host-based authentication.
- [Vite production build documentation](https://vite.dev/guide/build) for static dashboard deployment.
