# Control-Plane Egress

Some Iran servers may not have direct access to Telegram or other external APIs. Afrows treats this as a control-plane egress problem: admin, agent, bot, and API traffic can use a configured gateway without mixing that path with user data traffic.

## Goals

- Keep Telegram bot and external API calls working from restricted servers.
- Keep user traffic, routing decisions, and management traffic separate.
- Avoid exposing proxy ports publicly.
- Keep proxy credentials and VLESS configs out of git.
- Make the first version simple enough for low-resource VPS machines.

## Preferred Shape

```text
Afrows service -> localhost HTTP proxy -> VLESS/WireGuard/egress client -> Germany gateway -> Internet API
```

Afrows should not parse or own VLESS configs directly in the first MVP. A local egress client such as sing-box or xray can own the VLESS details and expose a local HTTP CONNECT proxy, for example:

```text
127.0.0.1:10809
```

Afrows services then use:

```text
AFROWS_OUTBOUND_PROXY_URL=http://127.0.0.1:10809
```

This keeps the app implementation stable even if the underlying egress method changes from VLESS to WireGuard, HTTP CONNECT, or another private gateway.

## Modes

### App-Level Proxy

Use this first. Only Afrows services use the proxy. The rest of the server keeps its normal routing.

Good for:

- Telegram bot API calls.
- Agent push calls.
- Payment/API provider calls.
- Lightweight deployments.

Security rules:

- Bind the local proxy to `127.0.0.1` only.
- Do not expose proxy ports through UFW/Nginx.
- Put credentials in `.env` or systemd environment files, not in git.
- Log health and failures, not message content or user traffic.

### Gateway Routing

Use this later when a whole service user or server namespace needs controlled outbound access.

Good for:

- More strict operations where every Afrows control-plane request must leave through Germany.
- Reducing app-specific proxy handling.
- Adding a kill switch that blocks direct fallback.

Security rules:

- Prefer WireGuard or another authenticated private tunnel for gateway access.
- Use policy routing for the Afrows service user instead of changing all server traffic.
- Keep database and private backend traffic on local/private routes.

## Implementation Notes

- The Python agent already supports `AFROWS_OUTBOUND_PROXY_URL` for HTTP/HTTPS API pushes.
- The backend has a shared outbound HTTP client for Telegram, PayPal, and other external API calls. It uses direct HTTP/HTTPS by default and can route through `AFROWS_OUTBOUND_PROXY_URL` when that value points to a localhost HTTP proxy.
- Telegram critical-alert delivery can now be configured through the superadmin Settings Telegram bot setup. Environment variables such as `AFROWS_TELEGRAM_ALERTS_ENABLED`, `AFROWS_TELEGRAM_BOT_TOKEN`, `AFROWS_TELEGRAM_ALERT_CHAT_ID`, `AFROWS_TELEGRAM_BOT_COMMANDS_ENABLED`, and `AFROWS_TELEGRAM_WEBHOOK_SECRET` remain bootstrap/fallback values for existing deployments.
- Telegram bots must be created in Telegram through BotFather. Afrows accepts the BotFather token once in superadmin Settings, stores it encrypted/write-only, captures allowed chat/admin IDs and the webhook secret, and tests Telegram API reachability through this shared outbound egress path.
- Setup and rotation notes live in [`telegram-bot-setup.md`](telegram-bot-setup.md).
- SOCKS/VLESS should be handled by a local client that exposes an HTTP proxy. This avoids adding protocol-specific code to Afrows.

## Monitoring

The egress path itself should become a monitored dependency:

- proxy process up/down.
- Telegram API reachability.
- outbound request latency through synthetic `healthUrl` or TCP health targets.
- outbound request failure rate stored in `outbound_health_checks`.
- gateway health score.

When egress fails, Afrows should create a critical control-plane alert because user support, charging, and admin alerts may be delayed.
