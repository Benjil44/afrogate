# PostgreSQL

Afrows starts with PostgreSQL as the source of truth for operational data, audit logs, alerts, and usage data.

## Apply Migrations

Set `DATABASE_MIGRATION_URL` in your shell for the migration role, or fall back to `DATABASE_URL` for local/dev deployments, then run:

```powershell
npm --workspace @afrows/backend run db:migrate
```

The current migration files are idempotent and live in `infra/postgres/migrations`.

Migration `0007_route_quality_hourly.sql` adds compact hourly route-quality summaries for historical route intelligence. Migration `0008_route_quality_dimensions.sql` adds outbound, operator, and score-profile dimensions for predictive time-window recommendations. Migration `0026_tenant_brand_settings.sql` adds default-tenant public brand/support settings. Apply migrations before enabling long-range route analytics or tenant branding in production so the backend can rely on the expected tables instead of fallback behavior.

## Local Windows Setup

For local development, prefer native PostgreSQL over SQLite so migrations and API queries behave like production.

From an Administrator PowerShell:

```powershell
npm run db:setup:local -- -WriteEnv
```

If PostgreSQL is already installed and `psql.exe` is available:

```powershell
npm run db:setup:local -- -SkipInstall -WriteEnv
```

The local setup script now creates three roles:

- `afrows_owner`: no-login owner role for the database/schema boundary.
- `afrows_migrator`: migration-only login role used by `DATABASE_MIGRATION_URL`.
- `afrows_app`: runtime login role used by `DATABASE_URL`.

The backend runtime role receives DML privileges on current and future migration-created objects, but it does not receive `CREATE` on the `public` schema.

## Least-Privilege Production Roles

For production PostgreSQL, create separate owner, migrator, and runtime roles. Use deployment-secret passwords, not values from git:

```sql
CREATE ROLE afrows_owner NOLOGIN;
CREATE ROLE afrows_migrator LOGIN PASSWORD 'replace-with-migration-password';
CREATE ROLE afrows_app LOGIN PASSWORD 'replace-with-runtime-password';
CREATE DATABASE afrows OWNER afrows_owner;
```

Then connect to the `afrows` database as a PostgreSQL superuser and apply:

```bash
psql -d afrows -f infra/postgres/least-privilege-roles.sql
```

Run migrations with:

```bash
DATABASE_MIGRATION_URL=postgresql://afrows_migrator:...@127.0.0.1:5432/afrows \
  npm --workspace @afrows/backend run db:migrate
```

After migrations, re-run `least-privilege-roles.sql` so new objects are granted to `afrows_app`, then verify the privilege shape:

```bash
psql -d afrows -f infra/postgres/verify-least-privilege.sql
```

Expected verification: `app_database_create_should_be_false` and `app_schema_create_should_be_false` are `f`; `migrator_database_create_should_be_true` and `migrator_schema_create_should_be_true` are `t`.

`afrows_migrator` receives database-level `CREATE` so migrations can install trusted extensions such as `pgcrypto`. If your PostgreSQL policy blocks extension creation by the migrator, pre-install `pgcrypto` as `postgres` before running migrations.

Existing single-role deployments should back up first and may need a manual object-ownership migration before future DDL-heavy migrations run as `afrows_migrator`; the grant template gives the runtime app DML access but does not silently reassign old object owners.

## Production Notes

- Keep PostgreSQL bound to localhost or a private network.
- Do not expose `5432/tcp` publicly.
- Use `afrows_app` for the backend runtime and `afrows_migrator` only for migrations.
- Back up the database before every migration.
- Test restore, not just backup creation.
