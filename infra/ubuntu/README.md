# Ubuntu Deployment Notes

This is the first production-style deployment path for Afrows. Keep it native and boring for the MVP:

```text
Internet -> Nginx 80/443 -> static dashboard
Internet -> Nginx 80/443 -> 127.0.0.1:7000 /api
Afrows backend -> local/private PostgreSQL
Agents -> https://your-domain.example/api
```

Docker Compose can be added later for reproducible deployments. The native path keeps CPU, RAM, and operational moving parts low on small VPS machines.

## Security Model

- Expose only `80/tcp` and `443/tcp` publicly through Nginx.
- Keep backend `7000/tcp`, dashboard dev `4000/tcp`, PostgreSQL `5432/tcp`, Redis `6379/tcp`, and any local egress proxy bound to localhost or private networks.
- Store production secrets only in `/etc/afrows/*.env` or a deployment secret store, never in git.
- Use a dedicated `afrows` service user for the backend.
- Keep `AFROWS_ROUTE_DATA_PLANE_APPLY_ENABLED=false` and keep all protocol apply live/decrypt flags disabled until the operator has audited server access profiles, SSH private-key credential storage, rollback behavior, and service health checks for the target fleet.
- Prefer database-issued agent tokens from `POST /api/agents/register`; use `AFROWS_AGENT_TOKEN` only as a temporary legacy fallback.
- Use Nginx rate limits for API/login paths and keep the backend behind Nginx.

## Host Layout

Recommended paths:

```text
/opt/afrows                  repository checkout
/etc/afrows/afrows.env     backend runtime environment, mode 0640
/etc/afrows/agent.env        optional agent runtime environment, mode 0640
/var/lib/afrows              backend state such as managed admin-user file
/var/log/afrows              backend logs if file logging is added later
/var/lib/afrows-agent        optional agent state
```

## Base Packages

Install Node.js 22 from an official package source or your server image, then install native services:

```bash
sudo apt update
sudo apt install -y nginx postgresql postgresql-client python3 git ca-certificates
node --version
npm --version
```

The root `package.json` requires Node.js `>=22`.

## Service Users

```bash
sudo adduser --system --group --home /opt/afrows afrows
sudo mkdir -p /opt/afrows /etc/afrows /var/lib/afrows /var/log/afrows
sudo chown -R afrows:afrows /opt/afrows /var/lib/afrows /var/log/afrows
sudo chmod 0750 /etc/afrows
```

If the monitoring agent runs on the same host:

```bash
sudo adduser --system --group --home /var/lib/afrows-agent afrows-agent
sudo mkdir -p /var/lib/afrows-agent
sudo chown -R afrows-agent:afrows-agent /var/lib/afrows-agent
```

## PostgreSQL

Keep PostgreSQL local or private. Example local setup:

```bash
sudo -u postgres psql
```

```sql
CREATE ROLE afrows_owner NOLOGIN;
CREATE ROLE afrows_migrator WITH LOGIN PASSWORD 'replace-with-long-random-migration-password';
CREATE ROLE afrows_app WITH LOGIN PASSWORD 'replace-with-long-random-runtime-password';
CREATE DATABASE afrows OWNER afrows_owner;
\q
```

Apply the least-privilege grants from the repository checkout as `postgres`:

```bash
sudo -u postgres psql -d afrows -f /opt/afrows/infra/postgres/least-privilege-roles.sql
```

In production, also review `/etc/postgresql/*/main/postgresql.conf` and `pg_hba.conf` so PostgreSQL listens only on localhost or a private interface. Do not allow public `5432/tcp`.

Apply migrations after dependencies are installed and `/etc/afrows/afrows.env` exists. Use the migrator role only for this shell, not for the long-running backend service:

```bash
set -a
. /etc/afrows/afrows.env
DATABASE_MIGRATION_URL='postgresql://afrows_migrator:replace-with-long-random-migration-password@127.0.0.1:5432/afrows'
set +a
cd /opt/afrows
npm --workspace @afrows/backend run db:migrate
sudo -u postgres psql -d afrows -f /opt/afrows/infra/postgres/least-privilege-roles.sql
sudo -u postgres psql -d afrows -f /opt/afrows/infra/postgres/verify-least-privilege.sql
```

The migrator role has database/schema `CREATE` for migrations and trusted extensions such as `pgcrypto`; the runtime `afrows_app` role does not. If your PostgreSQL extension policy blocks migrator-created extensions, install `pgcrypto` once as `postgres` before running migrations.

Back up the database before every migration once real data exists.

## Environment

Use `infra/ubuntu/afrows.env.sample` as a template for `/etc/afrows/afrows.env`.

Important production values:

- `HOST=127.0.0.1`
- `PORT=7000`
- `CORS_ORIGIN=https://your-domain.example`
- `DATABASE_URL=postgresql://afrows_app:...@127.0.0.1:5432/afrows`
- `DATABASE_MIGRATION_URL` should be set only for migration commands, or kept in a separate root-readable migration env file.
- `ADMIN_SESSION_SECRET` must be long and random.
- `AFROWS_SUPERADMIN_PASSWORD_HASH` is preferred over plaintext password.
- `AFROWS_SECRETS_KEY` must decode to exactly 32 bytes and must be backed up securely.
- `AFROWS_IDENTITY_HASH_KEY` should be set for paid-number HMAC hashes; if it is unset, the backend falls back to `AFROWS_SECRETS_KEY`.
- `AFROWS_ADMIN_USERS_STORE=database`
- `AFROWS_ADMIN_USERS_FILE=/var/lib/afrows/admin-users.json` only when importing legacy local users into an empty `admin_users` table
- `AFROWS_OUTBOUND_PROXY_URL=http://127.0.0.1:10809` only when a local control-plane egress proxy exists.

Generate random values on the target host:

```bash
openssl rand -base64 32
```

Keep the final env file private:

```bash
sudo chown root:afrows /etc/afrows/afrows.env
sudo chmod 0640 /etc/afrows/afrows.env
```

## Build

From the repository checkout:

```bash
cd /opt/afrows
npm ci
VITE_API_BASE_URL=/api npm run build --workspaces --if-present
```

The dashboard is a static Vite build at `apps/dashboard/dist`. It does not need a Node.js process in production.

## Backend systemd Service

Install the backend service sample:

```bash
sudo cp /opt/afrows/infra/ubuntu/afrows-backend.service.sample /etc/systemd/system/afrows-backend.service
sudo systemctl daemon-reload
sudo systemctl enable afrows-backend
sudo systemctl start afrows-backend
sudo systemctl status afrows-backend
```

Check logs:

```bash
journalctl -u afrows-backend -f
```

Local health check:

```bash
curl -fsS http://127.0.0.1:7000/api/health
```

## Nginx

Use `infra/ubuntu/nginx.conf.sample` as the starting site config. Replace `afrows.example.com` and TLS certificate paths.

```bash
sudo cp /opt/afrows/infra/ubuntu/nginx.conf.sample /etc/nginx/sites-available/afrows
sudo ln -s /etc/nginx/sites-available/afrows /etc/nginx/sites-enabled/afrows
sudo nginx -t
sudo systemctl reload nginx
```

For TLS, use your normal certificate automation, such as certbot. Keep HSTS enabled only after HTTPS is confirmed working for the domain.

Public health check:

```bash
curl -fsS https://your-domain.example/api/health
```

## Firewall

Review `infra/ubuntu/ufw-baseline.sh.sample` before running it. A wrong SSH CIDR can lock you out.

```bash
ADMIN_CIDR=203.0.113.10/32 WIREGUARD_PORTS=51820 sudo -E bash infra/ubuntu/ufw-baseline.sh.sample
```

Expected public exposure:

- `80/tcp`
- `443/tcp`
- WireGuard UDP ports only when that host actually terminates WireGuard.
- SSH only from trusted admin IP ranges.

## Optional Agent Service

On monitored nodes, use `infra/ubuntu/afrows-agent.service.sample` and `infra/ubuntu/agent.env.sample`.

Keep the final agent env file private:

```bash
sudo chown root:afrows-agent /etc/afrows/agent.env
sudo chmod 0640 /etc/afrows/agent.env
```

Agent rules:

- Use a token created through the admin agent registration API when available.
- Configure only synthetic probe targets you control or accept.
- Do not use user destinations or traffic-derived hosts as probe targets.
- Use `AFROWS_OUTBOUND_PROXY_URL` only for control-plane API pushes when the node cannot reach the backend directly.

## Update Flow

```bash
cd /opt/afrows
git pull --ff-only
npm ci
VITE_API_BASE_URL=/api npm run build --workspaces --if-present
set -a
. /etc/afrows/afrows.env
set +a
npm --workspace @afrows/backend run db:migrate
sudo systemctl restart afrows-backend
sudo nginx -t
sudo systemctl reload nginx
curl -fsS http://127.0.0.1:7000/api/health
```

For safer production updates, create a database backup first and keep the previous git revision available for rollback.

## Rollback

```bash
cd /opt/afrows
git checkout <previous-good-commit>
npm ci
VITE_API_BASE_URL=/api npm run build --workspaces --if-present
sudo systemctl restart afrows-backend
sudo systemctl reload nginx
```

If a migration already changed production data, restore from a tested backup rather than guessing manually.

## Production Readiness Gaps

This native deployment path is enough for the monitoring/control-plane MVP, but these items remain before a high-stakes production launch:

- PostgreSQL least-privilege roles and tested encrypted backups.
- API-layer rate limiting in addition to Nginx rate limits.
- MFA and stronger admin session controls.
- Agent token rotation.
- Production server-side protocol apply rollout audit for the target fleet.
- Docker Compose or artifact-based deployment if repeatability becomes more important than native simplicity.
