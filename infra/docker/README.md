# Optional Docker Compose Deployment

Docker is optional for AfroGate. The native Ubuntu path in `infra/ubuntu` remains the first production-style deployment because it uses fewer moving parts on small VPS machines. Use this folder when repeatable container builds are more important than native service simplicity.

The sample Compose stack runs:

- `postgres`: private PostgreSQL database, no published port.
- `backend`: NestJS API on the internal Compose network, no published port.
- `web`: static dashboard served by Nginx, proxying `/api` to the backend.

By default, `web` publishes only `127.0.0.1:8080:80`. Put a host TLS reverse proxy in front of it, or consciously change the port mapping after reviewing firewall and TLS exposure.

## Files

- `docker-compose.sample.yml`: optional Compose topology.
- `compose.env.sample`: local secret/config template. Copy it to `compose.env`; do not commit the copy.
- `backend.Dockerfile`: backend runtime image with production Node dependencies and migration scripts.
- `dashboard.Dockerfile`: static dashboard build served by Nginx.
- `nginx.conf.sample`: container Nginx config with dashboard routing, API proxying, login/API rate limits, and basic security headers.

## Quick Start

From this directory:

```powershell
Copy-Item compose.env.sample compose.env
```

Edit `compose.env` and set:

- `AFROGATE_POSTGRES_PASSWORD`
- `AFROGATE_SUPERADMIN_PASSWORD` or, for production, `AFROGATE_SUPERADMIN_PASSWORD_HASH`; admin authentication is rejected when both are empty.
- `ADMIN_SESSION_SECRET`
- `AFROGATE_SECRETS_KEY`
- `CORS_ORIGIN` if the public URL is not `http://127.0.0.1:8080`

Use URL-safe characters for `AFROGATE_POSTGRES_PASSWORD` because it is embedded in `DATABASE_URL`.

Build the images, start PostgreSQL, run migrations, then start the stack:

```powershell
docker compose --env-file compose.env -f docker-compose.sample.yml up --build -d postgres
docker compose --env-file compose.env -f docker-compose.sample.yml run --rm backend npm --workspace @afrogate/backend run db:migrate
docker compose --env-file compose.env -f docker-compose.sample.yml up -d
```

Check local health:

```powershell
curl.exe -fsS http://127.0.0.1:8080/api/health
```

The dashboard is available at `http://127.0.0.1:8080` unless you place a TLS reverse proxy in front of it.

## Production Notes

- Keep `compose.env` private and outside git.
- Keep PostgreSQL and backend private to the Compose network.
- Do not publish `5432`, `7000`, or local control-plane proxy ports.
- Keep `AFROGATE_ROUTE_DATA_PLANE_APPLY_ENABLED=false`, `AFROGATE_PROTOCOL_SERVER_APPLY_ENABLED=false`, `AFROGATE_PROTOCOL_SERVER_APPLY_LIVE_EXECUTOR_ENABLED=false`, and `AFROGATE_PROTOCOL_SERVER_APPLY_CREDENTIAL_DECRYPT_ENABLED=false` until the production route/protocol apply engines are implemented and audited.
- Prefer database-issued agent tokens from the admin registration API instead of a shared fallback token.
- Back up the PostgreSQL volume before migrations once real data exists.
- For public deployment, terminate HTTPS at a host reverse proxy and forward to `127.0.0.1:8080`, or replace the sample Nginx config with a TLS-ready one.

## Updates

```powershell
docker compose --env-file compose.env -f docker-compose.sample.yml build
docker compose --env-file compose.env -f docker-compose.sample.yml run --rm backend npm --workspace @afrogate/backend run db:migrate
docker compose --env-file compose.env -f docker-compose.sample.yml up -d
```

Rollback should restore both the previous image/revision and a compatible database backup if migrations changed stored data.
