# Local Development

AfroGate uses fixed local ports so multiple dev servers do not quietly stack up:

- Dashboard: `http://127.0.0.1:4000`
- Backend API: `http://127.0.0.1:7000/api`

The dashboard Vite server uses `strictPort`, so it must fail when port `4000` is busy instead of moving to `4001`, `4002`, or later ports. Ports `3000` and `8080` can stay reserved for other local apps.

## Runtime Wiring

The direct local wiring is:

```text
dashboard 4000 -> VITE_API_BASE_URL -> backend 7000 /api
agent -> AFROGATE_API_URL -> backend 7000 /api
backend CORS_ORIGIN -> dashboard 4000
```

Use `.env.example` as the source of truth for local variables:

```powershell
PORT=7000
HOST=127.0.0.1
CORS_ORIGIN=http://127.0.0.1:4000,http://localhost:4000
VITE_API_BASE_URL=http://127.0.0.1:7000/api
AFROGATE_API_URL=http://127.0.0.1:7000/api
```

Database-backed endpoints such as agent registration, agent token rotation, heartbeat persistence, server inventory, and route history require `DATABASE_URL` plus PostgreSQL migrations. The dashboard can still load with fallback sample data when the API or database is unavailable.

Settings private-key storage also requires `AFROGATE_SECRETS_KEY`. Use a unique 32-byte base64/base64url or 64-character hex value per environment and keep it in the git-ignored `.env` or a deployment secret store. If this key is lost, encrypted secret records cannot be decrypted later by the provisioning engine.

Customer paid-number storage is write-only. When a paid number is submitted through the admin API, the backend stores an HMAC hash only; set `AFROGATE_IDENTITY_HASH_KEY` for a dedicated identity-hash key, or the backend falls back to `AFROGATE_SECRETS_KEY`.

## Local PostgreSQL

Use PostgreSQL for development instead of SQLite. AfroGate already depends on PostgreSQL behavior such as `jsonb`, UUIDs, and PostgreSQL migrations; using SQLite would create a second database path and hide production bugs.

On Windows, run the setup from an Administrator PowerShell when PostgreSQL is not installed yet:

```powershell
npm run db:setup:local -- -WriteEnv
```

The script installs PostgreSQL through Chocolatey when needed, creates the local `afrogate` role/database, writes a git-ignored `.env` only when `-WriteEnv` is passed and `.env` does not already exist, and runs backend migrations.

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
$env:AFROGATE_PING_TARGETS='127.0.0.1'
$env:AFROGATE_PING_COUNT='3'
$env:AFROGATE_PING_TIMEOUT_SECONDS='2'
python apps/agent/run.py --once
```

Protocol-aware route probes are also opt-in. They report compact TCP connect, UDP response, QUIC-labeled UDP response, and DNS lookup signals without inspecting user traffic. When the local `wg` command is available, the agent also turns existing WireGuard interface telemetry into `wireguard` route-probe rows so backend scoring can compare tunnel health with TCP/UDP/QUIC/DNS signals:

```powershell
$env:AFROGATE_TCP_PROBE_TARGETS='127.0.0.1:7000'
$env:AFROGATE_DNS_PROBE_TARGETS='localhost'
$env:AFROGATE_ROUTE_PROBE_COUNT='2'
$env:AFROGATE_ROUTE_PROBE_TIMEOUT_SECONDS='2'
python apps/agent/run.py --once
```

Use UDP and QUIC probe targets only when you control a responder that echoes or replies to the small AfroGate probe payload; plain public UDP/443 hosts may not respond.

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
AFROGATE_TELEGRAM_ALERTS_ENABLED=true
AFROGATE_TELEGRAM_BOT_TOKEN=...
AFROGATE_TELEGRAM_ALERT_CHAT_ID=...
```

If Telegram is blocked from the backend host, expose a localhost HTTP proxy through sing-box/xray/VLESS or another gateway client and set `AFROGATE_OUTBOUND_PROXY_URL=http://127.0.0.1:10809`.

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

Thresholds live in `.env.example` under `AFROGATE_ALERT_*`. Keep local tuning in the git-ignored `.env`.
