# Ubuntu Deployment Notes

This is the first production-style deployment path for AfroGate. Keep it native and boring for the MVP:

```text
Internet -> Nginx 80/443 -> static dashboard
Internet -> Nginx 80/443 -> 127.0.0.1:7000 /api
AfroGate backend -> local/private PostgreSQL
Agents -> https://your-domain.example/api
```

Docker Compose can be added later for reproducible deployments. The native path keeps CPU, RAM, and operational moving parts low on small VPS machines.

## Security Model

- Expose only `80/tcp` and `443/tcp` publicly through Nginx.
- Keep backend `7000/tcp`, dashboard dev `4000/tcp`, PostgreSQL `5432/tcp`, Redis `6379/tcp`, and any local egress proxy bound to localhost or private networks.
- Store production secrets only in `/etc/afrogate/*.env` or a deployment secret store, never in git.
- Use a dedicated `afrogate` service user for the backend.
- Keep `AFROGATE_ROUTE_DATA_PLANE_APPLY_ENABLED=false` until audited server-side route apply exists.
- Prefer database-issued agent tokens from `POST /api/agents/register`; use `AFROGATE_AGENT_TOKEN` only as a temporary legacy fallback.
- Use Nginx rate limits for API/login paths and keep the backend behind Nginx.

## Host Layout

Recommended paths:

```text
/opt/afrogate                  repository checkout
/etc/afrogate/afrogate.env     backend runtime environment, mode 0640
/etc/afrogate/agent.env        optional agent runtime environment, mode 0640
/var/lib/afrogate              backend state such as managed admin-user file
/var/log/afrogate              backend logs if file logging is added later
/var/lib/afrogate-agent        optional agent state
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
sudo adduser --system --group --home /opt/afrogate afrogate
sudo mkdir -p /opt/afrogate /etc/afrogate /var/lib/afrogate /var/log/afrogate
sudo chown -R afrogate:afrogate /opt/afrogate /var/lib/afrogate /var/log/afrogate
sudo chmod 0750 /etc/afrogate
```

If the monitoring agent runs on the same host:

```bash
sudo adduser --system --group --home /var/lib/afrogate-agent afrogate-agent
sudo mkdir -p /var/lib/afrogate-agent
sudo chown -R afrogate-agent:afrogate-agent /var/lib/afrogate-agent
```

## PostgreSQL

Keep PostgreSQL local or private. Example local setup:

```bash
sudo -u postgres psql
```

```sql
CREATE ROLE afrogate_app WITH LOGIN PASSWORD 'replace-with-long-random-password';
CREATE DATABASE afrogate OWNER afrogate_app;
\q
```

In production, also review `/etc/postgresql/*/main/postgresql.conf` and `pg_hba.conf` so PostgreSQL listens only on localhost or a private interface. Do not allow public `5432/tcp`.

Apply migrations after dependencies are installed and `/etc/afrogate/afrogate.env` exists:

```bash
set -a
. /etc/afrogate/afrogate.env
set +a
cd /opt/afrogate
npm --workspace @afrogate/backend run db:migrate
```

Back up the database before every migration once real data exists.

## Environment

Use `infra/ubuntu/afrogate.env.sample` as a template for `/etc/afrogate/afrogate.env`.

Important production values:

- `HOST=127.0.0.1`
- `PORT=7000`
- `CORS_ORIGIN=https://your-domain.example`
- `DATABASE_URL=postgresql://...@127.0.0.1:5432/afrogate`
- `ADMIN_SESSION_SECRET` must be long and random.
- `AFROGATE_SUPERADMIN_PASSWORD_HASH` is preferred over plaintext password.
- `AFROGATE_SECRETS_KEY` must decode to exactly 32 bytes and must be backed up securely.
- `AFROGATE_ADMIN_USERS_FILE=/var/lib/afrogate/admin-users.json`
- `AFROGATE_OUTBOUND_PROXY_URL=http://127.0.0.1:10809` only when a local control-plane egress proxy exists.

Generate random values on the target host:

```bash
openssl rand -base64 32
```

Keep the final env file private:

```bash
sudo chown root:afrogate /etc/afrogate/afrogate.env
sudo chmod 0640 /etc/afrogate/afrogate.env
```

## Build

From the repository checkout:

```bash
cd /opt/afrogate
npm ci
VITE_API_BASE_URL=/api npm run build --workspaces --if-present
```

The dashboard is a static Vite build at `apps/dashboard/dist`. It does not need a Node.js process in production.

## Backend systemd Service

Install the backend service sample:

```bash
sudo cp /opt/afrogate/infra/ubuntu/afrogate-backend.service.sample /etc/systemd/system/afrogate-backend.service
sudo systemctl daemon-reload
sudo systemctl enable afrogate-backend
sudo systemctl start afrogate-backend
sudo systemctl status afrogate-backend
```

Check logs:

```bash
journalctl -u afrogate-backend -f
```

Local health check:

```bash
curl -fsS http://127.0.0.1:7000/api/health
```

## Nginx

Use `infra/ubuntu/nginx.conf.sample` as the starting site config. Replace `afrogate.example.com` and TLS certificate paths.

```bash
sudo cp /opt/afrogate/infra/ubuntu/nginx.conf.sample /etc/nginx/sites-available/afrogate
sudo ln -s /etc/nginx/sites-available/afrogate /etc/nginx/sites-enabled/afrogate
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

On monitored nodes, use `infra/ubuntu/afrogate-agent.service.sample` and `infra/ubuntu/agent.env.sample`.

Keep the final agent env file private:

```bash
sudo chown root:afrogate-agent /etc/afrogate/agent.env
sudo chmod 0640 /etc/afrogate/agent.env
```

Agent rules:

- Use a token created through the admin agent registration API when available.
- Configure only synthetic probe targets you control or accept.
- Do not use user destinations or traffic-derived hosts as probe targets.
- Use `AFROGATE_OUTBOUND_PROXY_URL` only for control-plane API pushes when the node cannot reach the backend directly.

## Update Flow

```bash
cd /opt/afrogate
git pull --ff-only
npm ci
VITE_API_BASE_URL=/api npm run build --workspaces --if-present
set -a
. /etc/afrogate/afrogate.env
set +a
npm --workspace @afrogate/backend run db:migrate
sudo systemctl restart afrogate-backend
sudo nginx -t
sudo systemctl reload nginx
curl -fsS http://127.0.0.1:7000/api/health
```

For safer production updates, create a database backup first and keep the previous git revision available for rollback.

## Rollback

```bash
cd /opt/afrogate
git checkout <previous-good-commit>
npm ci
VITE_API_BASE_URL=/api npm run build --workspaces --if-present
sudo systemctl restart afrogate-backend
sudo systemctl reload nginx
```

If a migration already changed production data, restore from a tested backup rather than guessing manually.

## Production Readiness Gaps

This native deployment path is enough for the monitoring/control-plane MVP, but these items remain before a high-stakes production launch:

- PostgreSQL least-privilege roles and tested encrypted backups.
- API-layer rate limiting in addition to Nginx rate limits.
- MFA and stronger admin session controls.
- Agent token rotation.
- Production server-side protocol apply engine audit.
- Docker Compose or artifact-based deployment if repeatability becomes more important than native simplicity.
