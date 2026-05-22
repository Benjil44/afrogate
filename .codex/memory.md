# AfroGate Memory

## Stable Product Facts

- Product name: AfroGate / Afrogate.
- First milestone: monitoring MVP.
- Long-term goal: branded enterprise panel that can be sold and improved beyond current third-party panels.
- Current users connect through Telegram bot.
- User-facing channels: Telegram first, app later.
- Admin wants dashboard first, with Telegram alerts.
- Product must be safe for people and human-rights conscious.
- Product should support Persian and English.
- Admin needs remote-friendly management while traveling.
- Backups are required, especially for monitoring and configuration data.

## Current Scale and Capacity

- Initial target: about 150 users.
- Future target: about 10000 users.
- Current total user outbound download is around 20 MB/s.
- Each user should have at least 1 MB/s when capacity allows.
- If the server is quiet, users should be able to use maximum available speed.
- Billing/usage model is volume-based: each GB costs configurable `X` toman.

## Infrastructure Facts

- Current Iran servers: 3.
- Server count should be unlimited in design.
- Iran server examples:
  - 6 cores / 6 GB RAM.
  - 4 cores / 4 GB RAM.
- Germany server:
  - 4 cores / 8 GB RAM.
  - 1 Gbps internet.
- Iran servers have 1 Gbps internet.
- Starlink observed speed test over wireless router:
  - download around 250 Mbps.
  - upload around 67 Mbps.
  - ping around 50 ms.

## Operator and Tunnel Facts

- `ether1`: Mobinnet.
- `ether2`: Irancell.
- `ether5`: Irancell.
- `ether1` connected to `wg1`.
- `ether2` connected to `wireguard2`.
- `ether5` connected to `wireguard3`.

## Quality Rules

- Packet loss should be very low.
- Ping best case is under 10 ms.
- Ping worst case is above 150 ms.
- High ping and jitter cause stuck requests, delayed volume allocation, and laggy speed.
- Alerting should happen within seconds.
- Auto route is desired, but route lock must be available for users/configs that should not move.

## Current Tooling Context

- Current production/operations use Marzban and panel Sanayi/X-UI style tooling.
- AfroGate should not simply depend on another app forever; integration can be used first, then replaced gradually.

## Durable Technical Preferences

- Separate control plane, monitoring plane, and data plane integration.
- Keep server agent lightweight.
- Store minimal personal data:
  - Telegram user id or username.
  - paid number only when needed.
- Avoid storing traffic content.
- Keep audit logs for sensitive admin actions.
- Encrypt secrets and backups.
- Enhancement work should be progressive: visibility first, reliability second, manual control third, automation fourth, enterprise readiness last.
- Current GitHub remote is `https://github.com/Benjil44/afrogate.git`.
- Repository has been pushed to GitHub and local `main` tracks `origin/main`.
- Repository can still be developed local-first; push when useful.
- Initial implementation direction: NestJS/TypeScript backend, React with Next.js dashboard, PostgreSQL database, Python agent.
- Docker should not block the first local MVP. For Ubuntu, start with native services plus systemd/Nginx; Docker Compose can be added later.
