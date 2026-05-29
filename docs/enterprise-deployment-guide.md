# Enterprise Deployment Guide

This guide is the production operating checklist for deploying AfroGate as an enterprise control plane. It favors the native Ubuntu path because it is predictable on low-resource VPS machines, with Docker Compose kept as an optional packaging path.

AfroGate can be deployed for monitoring, billing, client subscription refresh, advisory routing, backups status, reports, Telegram operations, signed rewarded-ad provider callbacks, admin/client UX separation, and local/native per-app VPN profile selection. Live server-side protocol apply, live data-plane route mutation, packaged native-client distribution, and provider-specific automatic settlement beyond the existing PayPal and generic/manual payment adapters are still separate implementation gates.

## Production Topology

Recommended first deployment:

```text
Internet
  -> Nginx 80/443 with TLS, rate limits, security headers
  -> static dashboard from apps/dashboard/dist
  -> /api proxy to backend on 127.0.0.1:7000

Backend
  -> PostgreSQL on localhost/private network
  -> optional local outbound proxy for Telegram/provider API egress
  -> encrypted secret storage with AFROGATE_SECRETS_KEY

Agents
  -> HTTPS /api metrics ingest using per-agent tokens
```

Public exposure should be limited to:

- `80/tcp` and `443/tcp` through Nginx.
- WireGuard UDP ports only on hosts that actually terminate WireGuard.
- SSH only from trusted admin CIDRs.

Do not publish backend `7000/tcp`, dashboard dev `4000/tcp`, client dev `4100/tcp`, PostgreSQL `5432/tcp`, Redis `6379/tcp`, local proxy ports, or metrics internals.

## Preflight Gates

Before a production launch:

- Choose a domain and enable HTTPS before real users log in.
- Create separate PostgreSQL `afrogate_owner`, `afrogate_migrator`, and `afrogate_app` roles.
- Store runtime secrets only in `/etc/afrogate/afrogate.env` or a deployment secret manager.
- Use `AFROGATE_SUPERADMIN_PASSWORD_HASH`, not plaintext password, for production.
- Generate and back up `ADMIN_SESSION_SECRET`, `AFROGATE_SECRETS_KEY`, and `AFROGATE_IDENTITY_HASH_KEY`.
- Keep all route/protocol live-apply feature flags disabled until audited engines are implemented.
- Confirm `npm run version:check`, `npm run typecheck`, `npm run build --workspaces --if-present`, `npm run secrets:check`, and `npm audit --audit-level=moderate` pass for the deployed revision.
- Confirm the backup job writes sanitized backup status and restore tests are scheduled.

## Host Provisioning

Install the base packages:

```bash
sudo apt update
sudo apt install -y nginx postgresql postgresql-client python3 git ca-certificates
node --version
npm --version
```

Node.js must satisfy the root `package.json` engine (`>=22`).

Create service users and directories:

```bash
sudo adduser --system --group --home /opt/afrogate afrogate
sudo mkdir -p /opt/afrogate /etc/afrogate /var/lib/afrogate /var/log/afrogate
sudo chown -R afrogate:afrogate /opt/afrogate /var/lib/afrogate /var/log/afrogate
sudo chmod 0750 /etc/afrogate
```

Clone or deploy the repository to `/opt/afrogate`. Do not place `.env`, private keys, production config exports, Telegram tokens, PayPal credentials, server credentials, or raw customer data in the repository.

## PostgreSQL

Create the database roles:

```sql
CREATE ROLE afrogate_owner NOLOGIN;
CREATE ROLE afrogate_migrator WITH LOGIN PASSWORD 'replace-with-long-random-migration-password';
CREATE ROLE afrogate_app WITH LOGIN PASSWORD 'replace-with-long-random-runtime-password';
CREATE DATABASE afrogate OWNER afrogate_owner;
```

Apply least-privilege grants:

```bash
sudo -u postgres psql -d afrogate -f /opt/afrogate/infra/postgres/least-privilege-roles.sql
```

Run migrations with the migrator role, then reapply/verify grants:

```bash
cd /opt/afrogate
DATABASE_MIGRATION_URL='postgresql://afrogate_migrator:...@127.0.0.1:5432/afrogate' \
  npm --workspace @afrogate/backend run db:migrate
sudo -u postgres psql -d afrogate -f /opt/afrogate/infra/postgres/least-privilege-roles.sql
sudo -u postgres psql -d afrogate -f /opt/afrogate/infra/postgres/verify-least-privilege.sql
```

PostgreSQL must listen only on localhost or a private interface. Public `5432/tcp` is a deployment failure.

## Runtime Environment

Start from `infra/ubuntu/afrogate.env.sample` and write the real file to `/etc/afrogate/afrogate.env`.

Required production values:

- `HOST=127.0.0.1`
- `PORT=7000`
- `CORS_ORIGIN=https://your-domain.example`
- `DATABASE_URL=postgresql://afrogate_app:...@127.0.0.1:5432/afrogate`
- `ADMIN_SESSION_SECRET=<long random value>`
- `AFROGATE_SUPERADMIN_PASSWORD_HASH=<scrypt hash>`
- `AFROGATE_SECRETS_KEY=<32-byte base64 secret>`
- `AFROGATE_SECRETS_KEY_ID=production-v1`
- `AFROGATE_IDENTITY_HASH_KEY=<separate long random value>`
- `AFROGATE_ADMIN_USERS_FILE=/var/lib/afrogate/admin-users.json`
- `AFROGATE_BACKUP_STATUS_FILE=/var/lib/afrogate/backup-status.json`
- `AFROGATE_REWARDED_AD_WEBHOOK_SECRET=<long random value>` when signed rewarded-ad callbacks are enabled

Production safety flags must stay disabled until audited implementations exist:

```bash
AFROGATE_ROUTE_DATA_PLANE_APPLY_ENABLED=false
AFROGATE_PROTOCOL_SERVER_APPLY_ENABLED=false
AFROGATE_PROTOCOL_SERVER_APPLY_LIVE_EXECUTOR_ENABLED=false
AFROGATE_PROTOCOL_SERVER_APPLY_SECRET_DECRYPT_ENABLED=false
AFROGATE_PROTOCOL_SERVER_APPLY_CREDENTIAL_DECRYPT_ENABLED=false
```

Lock down the env file:

```bash
sudo chown root:afrogate /etc/afrogate/afrogate.env
sudo chmod 0640 /etc/afrogate/afrogate.env
```

## Build and Services

Install and build:

```bash
cd /opt/afrogate
npm ci
VITE_API_BASE_URL=/api npm run build --workspaces --if-present
```

Install the backend service:

```bash
sudo cp /opt/afrogate/infra/ubuntu/afrogate-backend.service.sample /etc/systemd/system/afrogate-backend.service
sudo systemctl daemon-reload
sudo systemctl enable afrogate-backend
sudo systemctl start afrogate-backend
curl -fsS http://127.0.0.1:7000/api/health
```

Install Nginx:

```bash
sudo cp /opt/afrogate/infra/ubuntu/nginx.conf.sample /etc/nginx/sites-available/afrogate
sudo ln -s /etc/nginx/sites-available/afrogate /etc/nginx/sites-enabled/afrogate
sudo nginx -t
sudo systemctl reload nginx
curl -fsS https://your-domain.example/api/health
```

Use the sample UFW script only after reviewing SSH CIDRs:

```bash
ADMIN_CIDR=203.0.113.10/32 WIREGUARD_PORTS=51820 sudo -E bash infra/ubuntu/ufw-baseline.sh.sample
```

## Admin Bootstrap

After first boot:

- Log in as the protected superadmin.
- Create managed owner/admin/supervisor/support/auditor accounts as needed.
- Review the Users page permission matrix.
- Rotate away any bootstrap plaintext password values.
- Configure Telegram bot settings from BotFather through the Settings page if Telegram alerts/commands are needed.
- Configure tenant branding in Settings with only public support metadata.
- Create per-agent tokens and retire any shared legacy agent token.

Do not share superadmin credentials for daily operations. Use named owner/admin accounts for accountability.

## Agents and Route Probes

Agents should run with scoped tokens and compact synthetic probes only.

Rules:

- Use token registration/rotation from guarded admin APIs.
- Configure synthetic TCP/UDP/QUIC/DNS targets you control or accept.
- Do not use user destinations, DNS history, packet captures, or traffic-derived hosts as probe targets.
- Keep route intelligence advisory until data-plane apply is audited.
- For restricted servers, use `AFROGATE_OUTBOUND_PROXY_URL` only for control-plane API pushes or provider calls.

## Backup and Restore

Backups must include:

- PostgreSQL dump.
- Backend runtime env and config files.
- Encrypted secret material and key-id documentation.
- Admin-user file if local file auth is still used.
- Nginx/systemd deployment config.

Operational rules:

- Encrypt backups before leaving the host.
- Keep retention tiers, for example daily 7, weekly 4, monthly 3.
- Write only sanitized status to `AFROGATE_BACKUP_STATUS_FILE`.
- Test restore into a separate environment before relying on a backup plan.
- Use the dashboard Backups page for readiness and runbook visibility only; restore execution is not automated yet.

## Monitoring and Reports

At minimum, monitor:

- `/api/health`
- backend systemd status and restart count
- PostgreSQL disk, connections, and backup freshness
- Nginx 4xx/5xx and rate-limit spikes
- open critical/warning alerts in AfroGate
- backup status and restore-test age
- route-quality synthetic probe freshness
- payment/webhook failures when billing is enabled

Use the Reports page for aggregate operational health only. It must not be treated as customer-behavior analytics.

## Update Flow

Use a controlled update window:

```bash
cd /opt/afrogate
git fetch --all --prune
git checkout <target-release>
npm ci
VITE_API_BASE_URL=/api npm run build --workspaces --if-present
DATABASE_MIGRATION_URL='postgresql://afrogate_migrator:...@127.0.0.1:5432/afrogate' \
  npm --workspace @afrogate/backend run db:migrate
sudo -u postgres psql -d afrogate -f /opt/afrogate/infra/postgres/least-privilege-roles.sql
sudo systemctl restart afrogate-backend
sudo nginx -t
sudo systemctl reload nginx
curl -fsS http://127.0.0.1:7000/api/health
curl -fsS https://your-domain.example/api/health
```

Before migrations, create a database backup. After migrations, verify the dashboard, client app, login, agent ingest, billing catalog, alerts, backups, and reports.

## Rollback

Rollback needs both application and data compatibility.

If no migration changed data:

```bash
cd /opt/afrogate
git checkout <previous-good-release>
npm ci
VITE_API_BASE_URL=/api npm run build --workspaces --if-present
sudo systemctl restart afrogate-backend
sudo systemctl reload nginx
```

If migrations changed schema or data, restore a tested backup to a compatible database state instead of editing production tables manually.

## Privacy and Human-Safety Rules

- Do not inspect user packet payloads, browsing history, user DNS history, or user destination lists.
- Do not store raw paid phone numbers.
- Do not put secrets in notes, branding fields, public provider config, payment metadata, or Telegram messages.
- Keep client route preferences coarse and client-scoped.
- Keep app selection for per-app VPN split tunneling local/native-client scoped; exported native profiles should contain only explicit selections.
- Keep public support copy clear enough for users but free of private operational instructions.

## Go/No-Go Checklist

Go:

- HTTPS works and backend is private.
- PostgreSQL least-privilege verification passes.
- Version, typecheck, build, secret scan, audit, and browser smoke tests pass.
- Backups are encrypted and restore-tested.
- Admin roles are reviewed and named accounts are used.
- Agent tokens are scoped and rotated.
- Live data-plane/protocol apply flags are disabled unless audited engines exist.

No-go:

- Public backend/PostgreSQL ports are reachable.
- Secrets are in git, dashboard-visible fields, logs, or public config.
- Backups are unencrypted or untested.
- Admins share a superadmin account for daily use.
- Route/protocol live-apply flags are enabled without audited implementation, rollback, and health verification.
- Provider credentials or webhook secrets are missing for enabled payment, rewarded-ad, or Telegram workflows.

## Optional Docker Compose Path

Use `infra/docker` only when repeatable containers are more important than native simplicity. Keep the same security boundaries:

- publish only a TLS reverse proxy or `127.0.0.1:8080` in development,
- keep PostgreSQL/backend private to the Compose network,
- run migrations before app startup,
- back up the PostgreSQL volume before updates,
- keep `compose.env` out of git.
