# Admin RBAC Policy

AfroGate uses a deny-by-default admin RBAC model. Static roles still exist for operational simplicity, but the shared contract now exposes an explicit permission catalog so the backend, dashboard, and docs can agree on what each role can do.

## Roles

- `superadmin`: bootstrap root owner. Full access, cannot be removed, disabled, or changed by managed-user workflows.
- `owner`: full operational access for production ownership. Can manage local managed admin users, but cannot mutate bootstrap/env-protected accounts.
- `admin`: day-to-day operations across servers, tunnels, routes, billing, tenant branding, settings, audit, backups, and reports. Cannot create or mutate admin accounts.
- `supervisor`: read-oriented operations, billing/customer visibility, settings visibility, tenant branding reads, audit reads, backups, and reports.
- `support`: support-safe reads for dashboard, servers, tunnels, routes, alerts, billing, customers, and public tenant branding.
- `auditor`: read-only operational/compliance visibility for dashboard, servers, tunnels, routes, alerts, audit logs, backups, reports, and tenant branding.
- `agent`: metrics write-only. Agent tokens must never be accepted for admin APIs.

## Permission Catalog

The canonical permission ids live in `packages/shared/src/index.ts` as `ADMIN_PERMISSION_DEFINITIONS` and `ROLE_PERMISSIONS`.

Permission categories:

- `access`: admin-user and role management.
- `operations`: dashboard, servers, tunnels, and alerts.
- `routing`: route policy and route-decision application.
- `billing`: billing catalog, customer accounts, and quota operations.
- `settings`: protocol setup, tenant branding, and Telegram bot settings.
- `secrets`: write-only secret/credential storage paths.
- `compliance`: audit logs, backups, and reports.
- `agent`: metrics ingestion.

Risk levels:

- `low`: read-only operational visibility.
- `medium`: sensitive operational or compliance visibility.
- `high`: writes that affect users, billing, servers, or routing policy.
- `critical`: writes that touch secrets, admin access, protocol setup, Telegram bot control, or live route movement.

## Backend Enforcement

`RolesGuard` now understands both role metadata and permission metadata:

- `@Roles(...)` remains supported for coarse compatibility.
- `@Permissions(...)` adds fine-grained permission checks.
- `superadmin` and `owner` inherit full permissions at the guard layer.
- Service-level invariants still apply after guard approval. For example, bootstrap/env accounts stay protected even when an owner can manage local admin users.

Current production-visible endpoint:

- `GET /api/admin/permissions`: returns the permission catalog, role matrix, current role, effective current permissions, and the deny-by-default marker.

Admin-user endpoints now require admin-user permissions in addition to the existing admin route boundary:

- `adminUsers:read` for listing admin users.
- `adminUsers:write` for create/update/delete/password changes.

## Dashboard UI

The Users page now shows a Role Permissions panel. It renders the backend permission matrix with bilingual labels from the dashboard typed i18n layer, making permission risk and role access visible to admins before production rollout.

The sidebar hides the admin Users page from support/supervisor/auditor sessions. Admins can view admin-user state; only `superadmin` and `owner` can mutate local managed admin users.

## Production Notes

- Keep permission ids stable once external audit/reporting workflows depend on them.
- Add new endpoints with `@Permissions(...)` at implementation time instead of relying only on coarse roles.
- Do not grant support roles secret, credential, admin-user-write, route-apply, protocol-write, or provider-secret permissions.
- Future PostgreSQL-backed admin users should preserve the same permission ids and protected superadmin invariant.
