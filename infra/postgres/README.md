# PostgreSQL

AfroGate starts with PostgreSQL as the source of truth for operational data, audit logs, alerts, and usage data.

## Apply Migrations

Set `DATABASE_URL` in your shell or local `.env`, then run:

```powershell
npm --workspace @afrogate/backend run db:migrate
```

The current migration files are idempotent and live in `infra/postgres/migrations`.

## Production Notes

- Keep PostgreSQL bound to localhost or a private network.
- Do not expose `5432/tcp` publicly.
- Use a least-privilege application user.
- Back up the database before every migration.
- Test restore, not just backup creation.

