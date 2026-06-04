# Local Development

Afrows uses fixed local ports so multiple dev servers do not quietly stack up:

- Dashboard: `http://127.0.0.1:4000`
- Backend API: `http://127.0.0.1:7000/api`

The dashboard Vite server uses `strictPort`, so it must fail when port `4000` is busy instead of moving to `4001`, `4002`, or later ports. Ports `3000` and `8080` can stay reserved for other local apps.

## Runtime Wiring

The direct local wiring is:

```text
dashboard 4000 -> VITE_API_BASE_URL -> backend 7000 /api
agent -> AFROWS_API_URL -> backend 7000 /api
backend CORS_ORIGIN -> dashboard 4000
```

Use `.env.example` as the source of truth for local variables:

```powershell
PORT=7000
HOST=127.0.0.1
CORS_ORIGIN=http://127.0.0.1:4000,http://localhost:4000
VITE_API_BASE_URL=http://127.0.0.1:7000/api
AFROWS_API_URL=http://127.0.0.1:7000/api
```

Database-backed endpoints such as agent registration, agent token rotation, heartbeat persistence, server inventory, and route history require `DATABASE_URL` plus PostgreSQL migrations. The migration runner uses `DATABASE_MIGRATION_URL` when set, then falls back to `DATABASE_URL` for local/dev simplicity. The dashboard can still load with fallback sample data when the API or database is unavailable.

Settings private-key storage also requires `AFROWS_SECRETS_KEY`. Use a unique 32-byte base64/base64url or 64-character hex value per environment and keep it in the git-ignored `.env` or a deployment secret store. If this key is lost, encrypted secret records cannot be decrypted later by the provisioning engine.

Customer paid-number storage is write-only. When a paid number is submitted through the admin API, the backend stores an HMAC hash only; set `AFROWS_IDENTITY_HASH_KEY` for a dedicated identity-hash key, or the backend falls back to `AFROWS_SECRETS_KEY`.

## Local PostgreSQL

Use PostgreSQL for development instead of SQLite. Afrows already depends on PostgreSQL behavior such as `jsonb`, UUIDs, and PostgreSQL migrations; using SQLite would create a second database path and hide production bugs.

On Windows, run the setup from an Administrator PowerShell when PostgreSQL is not installed yet:

```powershell
npm run db:setup:local -- -WriteEnv
```

The script installs PostgreSQL through Chocolatey when needed, creates the local `afrows` database plus three least-privilege roles, writes a git-ignored `.env` only when `-WriteEnv` is passed and `.env` does not already exist, and runs backend migrations. The generated runtime `DATABASE_URL` uses `afrows_app`; the generated migration `DATABASE_MIGRATION_URL` uses `afrows_migrator`; `afrows_owner` is a no-login owner role.

If PostgreSQL is already installed, the same script can prepare the database without reinstalling:

```powershell
npm run db:setup:local -- -SkipInstall -WriteEnv
```

## Direct Run

```powershell
npm run dev:backend
npm run dev:dashboard
python apps/agent/run.py --once
```

Agent tokens are issued once and stored only as hashes. After a server has been registered, admins can rotate its token through `POST /api/agents/:serverId/tokens/rotate`; the old active tokens for that server are revoked immediately, so update the agent environment before restarting it.

Agent ping/jitter/packet-loss probes are opt-in. Use synthetic targets you control or accept:

```powershell
$env:AFROWS_PING_TARGETS='127.0.0.1'
$env:AFROWS_PING_COUNT='3'
$env:AFROWS_PING_TIMEOUT_SECONDS='2'
python apps/agent/run.py --once
```

Protocol-aware route probes are also opt-in. They report compact TCP connect, UDP response, QUIC-labeled UDP response, and DNS lookup signals without inspecting user traffic. When the local `wg` command is available, the agent also turns existing WireGuard interface telemetry into `wireguard` route-probe rows so backend scoring can compare tunnel health with TCP/UDP/QUIC/DNS signals:

```powershell
$env:AFROWS_TCP_PROBE_TARGETS='127.0.0.1:7000'
$env:AFROWS_DNS_PROBE_TARGETS='localhost'
$env:AFROWS_ROUTE_PROBE_COUNT='2'
$env:AFROWS_ROUTE_PROBE_TIMEOUT_SECONDS='2'
python apps/agent/run.py --once
```

Use UDP and QUIC probe targets only when you control a responder that echoes or replies to the small Afrows probe payload; plain public UDP/443 hosts may not respond.

For local UI checks, use Playwright:

```powershell
npm run test:e2e
npm run test:e2e:headed
```

The current Playwright config targets the installed Microsoft Edge browser through the `msedge` channel, so it avoids downloading a bundled browser during normal local checks.
In CI, the same config switches to Playwright Chromium after the workflow installs it, so GitHub Actions does not depend on Edge being preinstalled on the runner.

## Optional Telegram Alerts

Telegram delivery is disabled by default for local development. Superadmin Settings can store real bot values encrypted/write-only after migrations are running. Environment values are still available as a bootstrap/fallback path; configure them only in a git-ignored `.env` or systemd environment file:

```powershell
AFROWS_TELEGRAM_ALERTS_ENABLED=true
AFROWS_TELEGRAM_BOT_TOKEN=...
AFROWS_TELEGRAM_ALERT_CHAT_ID=...
```

If Telegram is blocked from the backend host, expose a localhost HTTP proxy through sing-box/xray/VLESS or another gateway client and set `AFROWS_OUTBOUND_PROXY_URL=http://127.0.0.1:10809`.

## Optional Rewarded-Ad Webhooks

Rewarded-ad signed callbacks are disabled until a secret is configured and the admin reward verification mode is set to `signed_webhook` or `provider_signed_webhook`.

```powershell
AFROWS_REWARDED_AD_WEBHOOK_SECRET=change-me-long-random-secret
AFROWS_REWARDED_AD_WEBHOOK_TOLERANCE_SECONDS=300
```

The callback signature is `HMAC-SHA256(timestamp + "." + canonicalJson(payload))` sent as `x-afrows-ad-signature`, with the timestamp in `x-afrows-ad-timestamp`. Keep the secret in `.env` or deployment secret storage only.

## Outbound Health Checks

The backend health scheduler is enabled by default and is idle when no outbounds exist. For a local test outbound, use a non-secret config shape such as:

```json
{
  "healthUrl": "http://127.0.0.1:7000/api/health"
}
```

For TCP-only checks, use `healthHost` and `healthPort`. Do not put proxy credentials, private keys, or production endpoints in tracked files.

## Alert Engine

The backend alert engine is enabled by default and is safe with an empty local database. It creates or resolves alert rows from:

- stale server heartbeats and stale metrics.
- CPU, RAM, and disk-free thresholds.
- ping, jitter, and packet-loss thresholds.
- outbound health status from the outbound scheduler.

Thresholds live in `.env.example` under `AFROWS_ALERT_*`. Keep local tuning in the git-ignored `.env`.
