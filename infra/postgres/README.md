# PostgreSQL

AfroGate starts with PostgreSQL as the source of truth for operational data, audit logs, alerts, and usage data.

## Apply Migrations

Set `DATABASE_URL` in your shell or local `.env`, then run:

```powershell
npm --workspace @afrogate/backend run db:migrate
```

The current migration files are idempotent and live in `infra/postgres/migrations`.

Migration `0007_route_quality_hourly.sql` adds compact hourly route-quality summaries for historical route intelligence. Migration `0008_route_quality_dimensions.sql` adds outbound, operator, and score-profile dimensions for predictive time-window recommendations. Apply migrations before enabling long-range route analytics in production so the backend can use `route_quality_hourly` instead of scanning raw `server_metrics` JSON for every recommendation request.

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

## Production Notes

- Keep PostgreSQL bound to localhost or a private network.
- Do not expose `5432/tcp` publicly.
- Use a least-privilege application user.
- Back up the database before every migration.
- Test restore, not just backup creation.
