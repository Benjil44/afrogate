# Dashboard Sidebar Pages Checklist

The sidebar must map to real operational pages, not placeholder anchors. Each page should work with fallback/sample data first, then connect to real backend APIs as each API lands.

## Page Foundation

- [x] Replace decorative anchors with real dashboard view state or routing.
- [ ] Keep the NOC/wall display as the default `Dashboard` page.
- [ ] Preserve the second-LCD layout for passive monitoring.
- [ ] Keep page transitions instant and static-first.
- [x] Add shared empty/loading/stale states.

## Dashboard Page

- [x] Summary cards.
- [x] Realtime health chart.
- [x] Server, tunnel, alert, outbound, capacity, and control-plane panels.
- [x] Real alert rows from backend.
- [x] Real tunnel inventory rows from backend.
- [ ] Real outbound rows from backend.
- [ ] Fullscreen/kiosk display toggle.

## Servers Page

- [x] Server inventory table/cards.
- [x] Server detail page with API-bound overview, monitoring, access, interface/tunnel inventory, and audit context.
- [x] Server edit action.
- [x] Safe access/bootstrap tab.
- [x] Access-profile edit form with write-only encrypted server credential storage.
- [x] Monitoring tab with CPU/RAM/disk/network history.
- [x] Interfaces tab for operators and linked tunnels.
- [x] Agent WireGuard status telemetry in Monitoring and Interfaces tabs.
- [x] Audit tab.
- [x] Real server CRUD API binding after admin guards are enforced.

## Routes Page

- [x] Tunnel table with operator, ping, jitter, loss, health score.
- [x] Outbound priority list with move up/down controls.
- [x] Maintenance mode indicator.
- [x] Failover history.
- [x] Route lock and auto-route controls.
- [x] Real route/outbound API binding after admin guards are enforced.
- [x] Real tunnel inventory API binding after admin guards are enforced.
- [x] Tunnel detail page with selected tunnel status, server/interface context, lockability, endpoint, route quality, and guarded API detail loading.

## Alerts Page

- [x] Open alert list.
- [x] Alert severity filters.
- [x] Alert source filters.
- [x] Resolved alert history.
- [x] Telegram alert delivery status.
- [x] Real alert API binding.

## Settings Page

- [x] Settings sidebar entry.
- [x] Guided WireGuard/system setup form with write-only private-key handling.
- [x] WireGuard health comparison surface for route selection.
- [x] Automatic/manual route mode controls.
- [x] Smart load-balance strategy selector.
- [x] Superadmin protocol draft factory for WireGuard, VLESS, L2TP, and IKEv2.
- [x] Persist Settings workflows through guarded backend APIs.
- [x] Read real WireGuard candidates from outbound health rows when available.
- [x] Store Settings private-key material through encrypted backend secret references.
- [x] Convert saved protocol drafts into disabled managed outbound rows for local control-plane provisioning.
- [x] Real per-tunnel WireGuard health checks from agent/backend metrics.
- [x] Persist default route assignment controls for auto-route, route lock, current/locked route, hysteresis, and cooldown.
- [x] Record and list advisory route decision events from the Settings decision preview.
- [x] Explain route decision candidate recommendations and rejections in the Settings preview.
- [x] Apply the recommended decision to saved assignment state only, with data-plane apply still disabled.
- [x] Show a route apply plan with guards, assignment steps, future data-plane steps, and rollback placeholders.
- [x] Show route apply adapter readiness and disabled data-plane feature-flag state.
- [x] Show dry-run-only WireGuard apply commands and config-change previews without executing them.
- [x] Persist dry-run apply snapshots in route decision event context for audit.
- [x] Inspect stored route decision event context and dry-run snapshots from Settings.
- [x] Show loaded-latency and bufferbloat/SQM guidance in route candidate and decision review surfaces.
- [x] Show advisory smart-route profile recommendations in the Settings decision preview.
- [x] Show advisory smart-load-balancing roles, weights, adjusted scores, and risks in the Settings decision preview.
- [x] Show health-based switch reasons when the current managed route is unhealthy.
- [x] Show gaming-safe session policy guidance for sticky holds, new-session-only movement, drain waits, and emergency switches.
- [x] Show transparent switch-engine planning stages for guards, session pinning, new-session routing, drain, active switch, verify, and rollback readiness.
- [x] Show assignment-only switch execution results with sticky-session, drain, cooldown, and data-plane-blocked state.
- [x] Show switch-preflight readiness checks for feature flag, adapter, dry-run, guard, session-safety, rollback, cooldown, audit, and health-verification gates.
- [x] Show advisory switch-rollout/canary plans with pinned existing sessions, new-session percentages, rollback thresholds, and route-consistency holds.
- [x] Show advisory switch-rollout health evaluation with guard pass/hold/rollback recommendations from packet loss, jitter, latency, and score.
- [x] Show session-safe switch orchestration with route-lock, cooldown, sticky-session, canary, hold, expand, rollback, and manual-review next-action guidance.
- [x] Show secret-safe protocol server apply plan/readiness previews for saved protocol drafts.
- [x] Record secret-safe protocol server apply dry-run audit snapshots for provisioned protocol drafts.
- [x] Inspect stored protocol server apply dry-run events and snapshots from Settings.
- [x] Show protocol server apply preflight gates for feature flag, adapter, dry-run safety, server access, outbound health, rollback, audit, and health verification.
- [x] Request live protocol apply from Settings as a superadmin-only blocked audit event without server mutation.
- [x] Show protocol server apply adapter, dry-run command-runner, and server-credential readiness boundaries.
- [x] Show protocol server apply credential-decrypt readiness separately from active server-credential readiness.
- [x] Show protocol server apply protocol-secret decrypt readiness separately from secret reference readiness.
- [x] Show protocol server apply config-material readiness separately from secret and credential readiness.
- [x] Show protocol server apply generated-command policy readiness and command timeout metadata.
- [ ] Production server-side protocol apply engine with encrypted secret storage.

## Users Page

- [x] Admin users sidebar entry.
- [x] Superadmin-protected admin user list.
- [x] Create, disable/enable, delete, and password-change actions for managed admin users.
- [x] Prevent normal admins from mutating the bootstrap superadmin account.
- [ ] Persist admin users in PostgreSQL when production database auth replaces the local file store.

## Later Pages

- [x] Usage and billing.
- [x] Usage/Billing customer account limit manager for shared account and per-client GB caps.
- [x] Backend Telegram bot user-command webhook for linked account status and quota replies.
- [ ] Telegram bot operations.
- [ ] Backups.
- [x] Audit logs.
- [x] Settings with guided WireGuard/system setup and write-only secret inputs.
