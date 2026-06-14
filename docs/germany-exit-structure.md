# Germany exit box — structure & reachability (reference, parked 2026-06-15)

> Captured read-only while investigating a separate Afrows→Germany egress. The
> egress work is **parked**; this documents how the box works for future use.
> Do **not** change the hexogate panel/bot — other servers depend on it.

## Host
- IP: `162.19.253.235` (this is the confirmed **exit IP** for Afrows traffic today)
- IPv6: `2001:41d0:701:1100::c4b`, iface `ens3`, gw `162.19.252.1`
- OS: Ubuntu 22.04.5, hostname `vps-d92c8992`, ~11 Gbps, disk ~81% used
- Access: our key `afrows_germany` (`~/.ssh/afrows_germany`) is in root's authorized_keys
  (comment `afrows-germany-deploy`). **Rotate the root password** (shared in chat);
  remove the key when done: `sed -i '/afrows-germany-deploy/d' ~/.ssh/authorized_keys`.

## Role
Foreign **exit** + commercial **VPN panel** host (hexogate / raminyazdanparast).

## Services (Docker + host)
- **PasarGuard panel** (Marzban fork) in Docker: `pasarguard-pasarguard-1`,
  `pasarguard-mysql-1`, and `pasarguard-caddy-1` (Caddy on **80/443**). This panel
  issues the VLESS/Reality/TLS subscription configs the Iran side actually uses.
- **hexogate-bot** stack: `hexogate-bot-frontend-1` (3000), `-bot-1`, `-worker-1`,
  `-web-1` (127.0.0.1:8000), `-postgres-1`, `-redis-1`, `-db-1` (mariadb). Telegram
  bot + web app for hexogate.
- **Caddy vhosts** (`/etc/caddy/Caddyfile` in the caddy container):
  - `panel.hexogate.com`, `hexogate.com`, `app/www.hexogate.com` → hexogate-bot web/frontend
  - `panel.raminyazdanparast.com`, `main.raminyazdanparast.com` → pasarguard unix socket
- `named` (bind9) on :53, `apache2` on :8010 (host).

## WireGuard tunnels (Germany side — links to a relay/mgmt cluster, NOT the Iran bypass)
- `wg0` (UDP **51820**): peer endpoint roams `216.147.121.32` (configured Endpoint
  `216.147.121.68:22096`), AllowedIPs `10.9.0.2/32` + `192.168.8/9/12.1/32`.
  **ACTIVE & high-traffic** (~183 GiB sent / 34 GiB recv, fresh handshake) — the main
  link to the `216.147.121.x` relay/management cluster.
- `wg-lb-e1/e2/e5` (UDP **52001/52002/52005**): peers from `216.147.121.54`, AllowedIPs
  `10.80.{1,2,5}.2/32`. **STALE** (~23 days) — idle load-balancer links.
- `wg-access-test` (UDP **51990**): peers `85.234.69.185`, `91.107.247.166`
  (AllowedIPs `10.90.90.{2,6}/32`) — active test/access tunnels.

## How the Iran side reaches Germany (the important part)
- **NOT directly.** Iran fully blocks the Germany IP from our Afrows box — verified:
  - Afrows→Germany TCP 80/443 → blocked (SYN dropped)
  - Afrows→Germany WireGuard UDP (tested 52003 and 443) → Germany received **nothing**
  - Afrows has **no IPv6** (so no v6 bypass)
- The working path **fronts through a reachable intermediary IP** (e.g. `46.245.95.155`)
  using **VLESS/TLS on 443** (the panel's protocol), which slips through the filter.
  The Germany IP is the *exit*, not the *entry*.

## Afrows egress today (the "old way", kept)
- `/usr/local/etc/xray/config.json` on Afrows: a VLESS outbound →
  **`46.245.95.155:11278`** → exits `162.19.253.235`. That xray listens on
  `socks 127.0.0.1:10808`, which is the `proxy` outbound used by both
  `afrows-xray` (VLESS users) and `afrows-wg` (WireGuard tproxy egress).

## If we revisit a separate, self-owned path (future)
A separate Afrows→Germany path **must** front through something reachable from Iran:
1. **Cloudflare-fronted VLESS+WS+TLS** (recommended): a domain on Cloudflare (orange-
   cloud) → origin Germany, with a **new isolated xray inbound** on Germany (separate
   port/service, not touching hexogate/Caddy). Afrows egresses to the Cloudflare edge.
2. A **separate relay VPS** that is reachable from Iran, forwarding to Germany.
3. (Not possible) direct to the Germany IP — permanently blocked from Iran.
