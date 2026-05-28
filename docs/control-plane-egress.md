# Control-Plane Egress

Some Iran servers may not have direct access to Telegram or other external APIs. AfroGate treats this as a control-plane egress problem: admin, agent, bot, and API traffic can use a configured gateway without mixing that path with user data traffic.

## Goals

- Keep Telegram bot and external API calls working from restricted servers.
- Keep user traffic, routing decisions, and management traffic separate.
- Avoid exposing proxy ports publicly.
- Keep proxy credentials and VLESS configs out of git.
- Make the first version simple enough for low-resource VPS machines.

## Preferred Shape

```text
AfroGate service -> localhost HTTP proxy -> VLESS/WireGuard/egress client -> Germany gateway -> Internet API
```

AfroGate should not parse or own VLESS configs directly in the first MVP. A local egress client such as sing-box or xray can own the VLESS details and expose a local HTTP CONNECT proxy, for example:

```text
127.0.0.1:10809
```

AfroGate services then use:

```text
AFROGATE_OUTBOUND_PROXY_URL=http://127.0.0.1:10809
```

This keeps the app implementation stable even if the underlying egress method changes from VLESS to WireGuard, HTTP CONNECT, or another private gateway.

## Modes

### App-Level Proxy

Use this first. Only AfroGate services use the proxy. The rest of the server keeps its normal routing.

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

- More strict operations where every AfroGate control-plane request must leave through Germany.
- Reducing app-specific proxy handling.
- Adding a kill switch that blocks direct fallback.

Security rules:

- Prefer WireGuard or another authenticated private tunnel for gateway access.
- Use policy routing for the AfroGate service user instead of changing all server traffic.
- Keep database and private backend traffic on local/private routes.

## Implementation Notes

- The Python agent already supports `AFROGATE_OUTBOUND_PROXY_URL` for HTTP/HTTPS API pushes.
- The backend has a shared outbound HTTP client for Telegram, PayPal, and other external API calls. It uses direct HTTP/HTTPS by default and can route through `AFROGATE_OUTBOUND_PROXY_URL` when that value points to a localhost HTTP proxy.
- Telegram critical-alert delivery is controlled by `AFROGATE_TELEGRAM_ALERTS_ENABLED`, `AFROGATE_TELEGRAM_BOT_TOKEN`, and `AFROGATE_TELEGRAM_ALERT_CHAT_ID`. Leave it disabled until real bot settings are installed through environment or systemd config.
- SOCKS/VLESS should be handled by a local client that exposes an HTTP proxy. This avoids adding protocol-specific code to AfroGate.

## Monitoring

The egress path itself should become a monitored dependency:

- proxy process up/down.
- Telegram API reachability.
- outbound request latency through synthetic `healthUrl` or TCP health targets.
- outbound request failure rate stored in `outbound_health_checks`.
- gateway health score.

When egress fails, AfroGate should create a critical control-plane alert because user support, charging, and admin alerts may be delayed.
