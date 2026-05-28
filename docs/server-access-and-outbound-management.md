# Server Access and Outbound Management

AfroGate needs server management, traffic visibility, route control, and outbound failover without turning the panel into a vault of reusable root passwords. This document defines the safer shape for the UI and backend.

## Best Practice Summary

- Use a server agent for normal monitoring.
- Use SSH only for bootstrap, repair, and explicit admin actions.
- Prefer SSH keys and a dedicated `afrogate` sudo user over reusable root passwords.
- If a provider only gives a root password, use it once during bootstrap, then install keys, create the dedicated user, and stop storing the root password.
- Never show saved secrets back to the admin. Allow replace, test, rotate, and revoke.
- Every sensitive action must create an audit log.
- Outbound routes must be ordered, health checked, and failed over with cooldown/hysteresis, not switched on every small ping spike.

## Server Edit Flow

Each server card can have an `Edit` button. The edit screen should be split into tabs:

- Overview: name, country, role, status, tags, last seen.
- Access: host/address, SSH port, access method, connection test, bootstrap action.
- Monitoring: CPU/RAM/disk/network/tunnel metrics and health interval.
- Interfaces: `ether1`, `ether2`, `ether5`, operators, linked WireGuard tunnel.
- Outbounds: ordered outbound/gateway configs available from this server.
- Routing: route group, auto route, route lock support, failover settings.
- Audit: who changed what and when.

WireGuard and system prerequisites should also have a guided Settings workflow so first-time setup is not hidden behind raw files. Any private key or tunnel secret entered there must be write-only: accept, validate, store by encrypted reference later, and never display the original secret back.

Current inventory implementation:

- Migration `0012_tunnels_interfaces.sql` adds `server_interfaces` and `tunnels` as control-plane inventory tables.
- `/api/admin/server-interfaces` and `/api/admin/tunnels` provide guarded list/detail/create/update/delete APIs with read-role access for admins, supervisors, support, and auditors, and write access for admins.
- Interface rows can track server ownership, physical/logical name, operator, kind, status, MAC/address metadata, notes, and a linked tunnel summary.
- Tunnel rows can track server ownership, tunnel type, endpoint, interface name, local interface link, route group, status, lockability, and notes.
- These APIs only manage inventory state and audit logs. They do not SSH into servers, decrypt credentials, reload services, change OS routes, or switch user traffic.

## Access Model

### Bootstrap Credential

This is only for first connection or emergency repair.

Allowed methods:

- temporary root password.
- temporary root SSH key.
- existing admin user SSH key.

Rules:

- Mark as temporary.
- Encrypt at rest if it must be saved before bootstrap.
- Delete or disable after agent/key installation.
- Do not display the secret again after save.
- Require Owner/Admin permission and later MFA.

### Managed Credential

This is the normal long-term access path.

Recommended shape:

```text
user: afrogate
auth: SSH key
sudo: restricted commands first, broader sudo only if explicitly enabled
root login: disabled or key-only emergency path
password auth: disabled when possible
```

OpenSSH supports controls such as `PermitRootLogin`, `PasswordAuthentication`, and `AuthorizedKeysFile`; AfroGate should generate hardening guidance around these options instead of encouraging permanent root-password use.

Current implementation:

- The Servers page Access tab can save server access profile metadata such as address, SSH port, username, access method, bootstrap state, and notes through the guarded admin server API.
- `POST /api/admin/servers/:id/credentials` accepts a server credential once, encrypts it with `AFROGATE_SECRETS_KEY`, stores it in `server_credentials`, links the active credential id to `server_access_profiles.credential_ref`, and returns only metadata plus the refreshed server summary.
- Replacing a linked credential revokes the previous active linked credential row. The dashboard never reads or displays decrypted server credentials.
- This storage path does not test SSH, decrypt credentials, execute commands, reload services, change OS routes, or enable outbounds. Those actions remain part of the future audited production apply engine.

## Monitoring Data Collection

Normal traffic and health visibility should come from the agent, not repeated SSH commands.

Agent metrics:

- CPU/RAM/disk.
- input/output bytes per interface.
- total inbound/outbound bps.
- WireGuard peer transfer and handshake state.
- ping/jitter/packet loss to configured targets.
- protocol-aware route probes:
  - TCP connect latency, failure rate, and optional TLS handshake latency.
  - UDP reachability, packet loss, jitter, and response delay when a safe probe target exists.
  - QUIC/HTTP3 timing when UDP-based web traffic matters.
  - DNS lookup latency and failure rate through the route.
  - short bounded loaded-latency and throughput samples for low-speed/high-speed classification.
- service health.
- control-plane egress health.

The current WireGuard status telemetry uses the local `wg show all dump` command when present. It keeps private keys, preshared keys, and full public keys out of payloads; peer identity is reduced to a short SHA-256 fingerprint for health correlation only.

Settings route selection can use these agent-sourced WireGuard tunnel rows as real health candidates alongside managed outbound health rows. Agent candidates are selection/diagnostic signals until a managed outbound or audited server-side apply step owns the actual route change.

Ping/jitter/packet-loss collection is opt-in through configured synthetic targets such as `AFROGATE_PING_TARGETS`. Do not use user destinations or traffic-derived hosts as probe targets.

Protocol-aware route probes are opt-in through `AFROGATE_TCP_PROBE_TARGETS`, `AFROGATE_UDP_PROBE_TARGETS`, `AFROGATE_QUIC_PROBE_TARGETS`, and `AFROGATE_DNS_PROBE_TARGETS`. TCP probes measure connect latency/failure rate. DNS probes measure lookup latency/failure rate. UDP and QUIC-labeled probes require a configured responder that replies to the small probe payload; they are reachability signals, not continuous speed tests. When `wg` telemetry is available, the agent also emits `wireguard` route-probe rows derived from interface status, active peer count, and handshake freshness without sending raw keys.

SSH can still be used for:

- installing/updating the agent.
- emergency service restart.
- one-time configuration sync.
- reading diagnostic logs with explicit admin action.

MVP should avoid a free-form terminal. Later enterprise terminal access should require MFA, session recording, command audit, and role restrictions.

## Outbound Management

An outbound is a control or data-plane path that can be used for Telegram/API access, route failover, or user traffic depending on its type.

Fields:

- name.
- type: `wireguard`, `vless-local-proxy`, `http-proxy`, `socks-proxy`, `direct`, `custom`.
- server id.
- route group.
- priority.
- enabled.
- health check interval.
- fail threshold.
- recovery threshold.
- cooldown seconds.
- max users or weight.
- secret reference, not raw secret.

UI actions:

- add outbound.
- edit outbound.
- delete/disable outbound.
- move up/down.
- test health now.
- mark as maintenance.
- view failover history.

Priority should be stored as an integer or decimal rank so moving up/down is cheap and auditable.

## Failover Policy

Do not fail over after one bad sample. Use thresholds:

```text
candidate is unhealthy if:
- N consecutive failed checks, or
- packet loss above threshold for duration, or
- ping/jitter above threshold for duration, or
- tunnel down / no recent handshake, or
- server health score below minimum
```

Do not fail back immediately. Use:

- recovery threshold: e.g. 3 healthy checks.
- cooldown: e.g. 60-300 seconds.
- hysteresis: new route must be meaningfully better.
- route lock: locked users stay on their route and only receive alerts.

## Smart Route Protocol Profiles

Automatic routing should use protocol-aware scores instead of one generic health number:

- `tcp`: prioritize TCP connect success, TLS/request timing, and retransmission symptoms.
- `udp`: prioritize packet loss, jitter, NAT stability, and WireGuard/UDP reachability.
- `quic`: prioritize UDP reachability plus QUIC/HTTP3 handshake/request timing.
- `dns`: prioritize lookup success and latency when DNS behavior affects the user path.
- `low-speed`: prefer stable latency, low loss, and low jitter over raw throughput.
- `high-speed`: prefer throughput headroom and lower saturation while still rejecting bad loss/jitter.
- `gaming`: prioritize stable latency, very low jitter, very low packet loss, route consistency, and congestion avoidance over raw throughput.

The backend route decision should store which profile was used, the old route, the candidate route, the score delta, and the reason. This keeps automatic routing explainable and auditable.

Probe rules:

- Use synthetic configured targets only; do not inspect user destinations or traffic contents.
- Keep probes compact and interval-based so small VPS machines are not overloaded.
- Use short active throughput checks only when needed, never continuous speed tests.
- Apply cooldown and hysteresis per protocol profile so one bad UDP sample does not move TCP-heavy users unnecessarily.

Current Settings route candidates are advisory only: the backend returns a selected score plus per-profile scores for balanced, stability, throughput, gaming, TCP, UDP, QUIC, DNS, and WireGuard health. These scores can use managed outbound health rows, latest agent route probes, server health, load, and WireGuard telemetry, but they do not apply route changes. Candidates also include loaded-latency and bufferbloat guidance when synthetic probes or outbound metadata provide it; medium risk recommends SQM/AQM review and high risk makes the route unattractive for under-load or gaming-sensitive use. Route decision previews now compare usable managed candidates across profile scores and show advisory profile recommendations, so an admin can see whether TCP, UDP/QUIC, DNS, WireGuard, gaming, stability, or throughput policy is currently the better fit without inspecting user traffic.

The first route-decision foundation adds `route_assignments`, `route_decision_events`, `/api/admin/route-assignments/current`, the read-only `/api/admin/route-decisions/preview` endpoint, advisory event endpoints for listing, detail inspection, and recording preview decisions, and an assignment-only `/api/admin/route-decisions/apply-preview` endpoint. The Settings page can now persist the default assignment's auto-route toggle, route lock toggle, current managed outbound, locked managed outbound, hysteresis score delta, and cooldown seconds. These controls update control-plane policy and audit logs only; they do not mutate OS routes or user traffic. The preview evaluates that saved state before any future automatic data-plane apply path exists and shows whether AfroGate would keep, switch, pause for cooldown, stay locked, or require better candidates. It can also recommend a health-based switch when the current managed route is unhealthy and a healthy managed candidate is available; this bypasses the normal score-delta hysteresis blocker only for assignment-only control-plane movement and still respects lock, manual mode, cooldown, and managed-candidate gates. It also returns candidate-review rows with dispositions, rejection reasons, score deltas, score-penalty reasons, an advisory smart-load-balancing summary with primary/secondary/standby roles and weights, a gaming-safe session-safety summary, a transparent switch-engine stage plan, and a structured apply plan with guard, assignment, drain, switch, verify, rollback, apply-adapter readiness details, and secret-safe dry-run command/config previews for the future WireGuard policy-routing adapter. The load-balancing summary weighs health, packet loss, jitter, latency, throughput/load, loaded-latency, and high-security/route-consistency constraints without inspecting user traffic or applying data-plane changes. The session-safety summary keeps active gaming/UDP/QUIC/WireGuard flows sticky during normal improvements, moves only new sessions during a drain window, and allows emergency switching only when the current managed route is failing. The switch-engine plan sequences guard checks, session pinning, new-session routing, drain, active switch, verify, and rollback readiness, while marking real mutation stages as future until the audited adapter exists. Recording or applying a preview stores a normalized `dryRunSnapshot` in `route_decision_events.decision_context` with adapter status, command/config counts, secret-safety state, commands, and config targets. The recent-events API remains compact, while `/api/admin/route-decisions/events/:id` lets read-role admins inspect stored non-secret decision context and dry-run snapshots on demand from Settings. Recording a preview stores the action, reason codes, score delta, cooldown/lock state, and candidate context with `applied_at = null`. Applying a preview is currently guarded to `assignmentOnly`: it accepts only a `switchRecommended` preview, updates the saved current outbound, sets cooldown, records `decision_kind = assignment_apply`, and marks `dataPlaneApplied = false` in context until the audited server-side apply engine exists. Data-plane apply is also gated by `AFROGATE_ROUTE_DATA_PLANE_APPLY_ENABLED=false` by default; enabling that flag alone is not enough until a real adapter is implemented and audited.

Assignment-only apply now also records a switch-execution summary. This captures the control-plane assignment result, whether existing sessions must stay sticky, the sticky/drain/cooldown deadlines, rollback readiness, and which data-plane steps remain future/blocked. It is an audit and UX safety layer for gaming-sensitive routes; it does not change server OS routing or user traffic.

Decision previews also include a switch-preflight readiness summary before any future live route movement. It checks the disabled data-plane feature flag, missing or unsupported apply adapter, secret-safe dry-run artifacts, route guards, session-safety requirements, rollback readiness, cooldown policy, audit readiness, and post-switch health verification. These checks are visible in Settings and persisted in decision-event context, but they remain planning-only until an audited adapter can execute them safely.

Decision previews and event detail also include an advisory switch-rollout plan. For normal gaming/stability-sensitive improvements, the plan keeps existing sessions pinned, starts with a small new-session canary, verifies packet loss, jitter, and latency rollback thresholds, observes a route-consistency hold, and only then describes future expansion. Emergency plans stay separate and are still planning-only until an audited adapter can enforce them safely.

The rollout plan also carries an advisory health evaluation. It compares the recommended canary path against the configured packet-loss, jitter, latency, and score guards, reports whether the guard passed, and suggests hold, manual review, start canary, expand canary, or rollback. This is audit and operator guidance only; it does not move existing or new sessions.

The switch orchestration summary combines the guard, assignment, sticky-session, canary, hold, verification, expansion, and rollback stages into one visible next-action model. This is the user-experience safety layer for gaming-sensitive routes: it can say "record assignment only", "hold", "start canary", "expand", "rollback", or "manual review" without hiding route-lock, cooldown, or data-plane-disabled reasons from the admin.

The first route-intelligence analytics endpoint, `/api/admin/route-quality/analytics`, reads historical synthetic route probes from `server_metrics.raw`, groups them by server, protocol, and hour-of-day, and returns advisory best/degraded time-window recommendations for the Settings page. This is intentionally read-only and privacy-safe: it does not inspect user destinations and does not change routes.

To keep this efficient on small VPS machines, `RouteQualityAggregationService` compacts recent synthetic probe history into `route_quality_hourly`. The scheduler is enabled by default through `AFROGATE_ROUTE_QUALITY_AGGREGATION_ENABLED=true`, runs every `AFROGATE_ROUTE_QUALITY_AGGREGATION_INTERVAL_SECONDS`, and looks back `AFROGATE_ROUTE_QUALITY_AGGREGATION_LOOKBACK_HOURS`. The analytics endpoint prefers these hourly summaries and falls back to raw metrics if the table is empty or not migrated yet.

Migration `0008_route_quality_dimensions.sql` expands these summaries by server, outbound key/name, operator, protocol, score profile, day-of-week, and hour-of-day. Agents can optionally tag synthetic route probes with non-secret metadata through `AFROGATE_ROUTE_PROBE_ROUTE_GROUP`, `AFROGATE_ROUTE_PROBE_OUTBOUND_ID`, `AFROGATE_ROUTE_PROBE_OUTBOUND_KEY`, `AFROGATE_ROUTE_PROBE_OUTBOUND_NAME`, `AFROGATE_ROUTE_PROBE_OPERATOR`, and `AFROGATE_ROUTE_PROBE_SCORE_PROFILE`. This supports operator/outbound patterns such as Irancell/BTS windows without storing user destinations or inspecting traffic.

Predictive recommendations stay advisory. The backend can flag historically degraded windows within `AFROGATE_ROUTE_QUALITY_PREDICTION_LOOKAHEAD_HOURS`, but it does not apply routes automatically; route locks, sticky assignments, cooldown, hysteresis, drain-safe switching, and audit reasons are still required before transparent route changes.

## Health Check Intervals

Recommended defaults:

- Latest dashboard cards: 5-10 seconds.
- Normal route health: 10-15 seconds.
- Outbound control-plane health: 30-60 seconds.
- Deep checks: 1-5 minutes.
- 1-second checks: diagnostics only, short-lived, for an active incident.

Permanent 1-second checks can waste CPU/network on small VPS machines and can cause noisy route flapping. If 1-second mode is added, it should auto-expire and require admin permission.

## Backend Health Scheduler

The backend runs a lightweight outbound health scheduler when `AFROGATE_OUTBOUND_HEALTH_SCHEDULER_ENABLED` is true. It checks only enabled, non-maintenance outbounds whose `last_checked_at` is older than their own `health_interval_seconds`.

Supported MVP probe targets are intentionally simple and synthetic:

- HTTP/HTTPS: set `config.healthUrl`, `config.url`, or `config.targetUrl`.
- TCP connect: set `config.healthHost`/`config.healthPort`, or `config.host`/`config.port`.

The scheduler stores every sample in `outbound_health_checks`, updates `outbounds.health_status`, and respects each outbound's `fail_threshold` and `recovery_threshold` so one bad sample does not immediately create a route flap. It does not inspect user traffic and it does not switch routes yet.

## Data Model Direction

Current and planned tables:

- `secret_records`
- `server_access_profiles`
- `server_credentials`
- `server_interfaces`
- `tunnels`
- `outbounds`
- `outbound_health_checks`
- `route_groups`
- `route_failover_events`
- `server_commands`

Credentials should store:

- encrypted secret material or external secret reference.
- secret type.
- last rotated time.
- last used time.
- owner.
- revoked time.

They should not store:

- plaintext passwords.
- user traffic content.
- unrestricted shell history without explicit enterprise audit mode.

Current Settings secret storage uses `secret_records` for write-only private-key material. The dashboard sends the secret once, the backend encrypts it with `AFROGATE_SECRETS_KEY`, and protocol setup rows store only `secretRef`. The dashboard must not read decrypted secret material back.

Initial Settings protocol provisioning is control-plane-only. A saved protocol setup can be converted into a managed outbound row with the encrypted secret reference preserved, but the outbound is created disabled and in maintenance mode until a later server-side apply step installs or updates the real WireGuard/VLESS/L2TP/IKEv2 service and health checks confirm it is usable.

Protocol server apply dry-runs are now auditable without server mutation. Recording a dry-run stores a secret-safe `protocol_apply_events` snapshot with target server, provisioned outbound, readiness flags, blocker reason codes, command/config counts, and preview artifacts. Read-role admins can list compact recent events through `/api/admin/settings/protocol-apply-events` and inspect stored snapshots on demand through `/api/admin/settings/protocol-apply-events/:id`, while the Settings page keeps the recent list lightweight and fetches detail only when requested. These flows do not open SSH, run shell commands, decrypt secrets, change OS routes, or enable the generated outbound.

Protocol server apply plans and stored dry-run snapshots now include a dedicated preflight readiness summary. The preflight gates check the disabled-by-default feature flag, missing audited apply adapter, dry-run secret safety, non-secret config material, generated-command policy, provisioned outbound presence, outbound health, default disabled/maintenance posture, secret reference, protocol-secret decrypt permission, server access, server credential record state, server-credential decrypt permission, rollback artifacts, audit readiness, and post-apply health verification. Dry-run recording remains available when the snapshot is secret-safe and provisioned, but live server mutation remains blocked until every data-plane gate passes and the audited adapter exists.

The first live-apply boundary is intentionally non-mutating. Superadmins can submit a live protocol apply request through `/api/admin/settings/protocol-setups/:id/server-apply/live-request`, and AfroGate records a `protocol_apply_events` row plus audit metadata with `applyMode = live`, blocked reason codes, preflight state, and `dataPlaneMutationExecuted = false`. This proves the API, UI, and audit path before any SSH command runner, secret decrypt for server installation, service reload, OS route change, or outbound enablement is allowed.

Protocol server apply plans now expose an adapter scaffold. The adapter reports supported protocols, disabled feature-flag state, missing live implementation state, a dry-run-only command-runner boundary, and a server-access boundary that checks for an installed access profile plus an active `server_credentials` record without decrypting the credential. Non-secret config-material readiness, generated-command policy readiness, secret reference readiness, protocol-secret decrypt permission, credential record readiness, and server-credential decrypt permission are separate gates: WireGuard plans require interface name, address CIDR, listen port, endpoint, allowed IPs, and peer public-key presence before data-plane readiness; VLESS/L2TP/IKEv2 plans require endpoint and port material before data-plane readiness. Generated command previews must be allowlisted, single-purpose, timeout-bounded, secret-safe, and rollback-backed before any future executor can be considered ready. `AFROGATE_PROTOCOL_SERVER_APPLY_SECRET_DECRYPT_ENABLED=false` keeps saved protocol material unavailable for config rendering, and `AFROGATE_PROTOCOL_SERVER_APPLY_CREDENTIAL_DECRYPT_ENABLED=false` keeps `credentialDecryptAllowed = false` even when a target server has an active credential. A live path must still have `AFROGATE_PROTOCOL_SERVER_APPLY_ENABLED=true`, `AFROGATE_PROTOCOL_SERVER_APPLY_LIVE_EXECUTOR_ENABLED=true`, complete non-secret config material, command-policy readiness, protocol-secret decrypt explicitly enabled, server-credential decrypt explicitly enabled, an installed access profile, an active credential reference, and an audited adapter implementation before any server command runner can use decrypted material. No decrypted secrets are returned to the dashboard, stored in snapshots, or logged.

## Security References

- OWASP recommends centralizing, standardizing, access-controlling, auditing, and rotating secrets: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- OpenSSH `sshd_config` documents `PermitRootLogin`, `PasswordAuthentication`, and authorized keys behavior: https://manpages.debian.org/bookworm/openssh-server/sshd_config.5.en.html
