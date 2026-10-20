# Afrows VPS migration: مخابرات مشهد → زیرساخت مشهد

Status: PLANNED (2026-10-20). Old server `94.74.145.199` (VPS-Main, مخابرات مشهد);
new server = a fresh VPS from زیرساخت مشهد (NOT the Borjino box 185.252.30.127).

Why: on 2026-10-20 the old server lost all international traffic after a provider
reboot (domestic only), which took afrows.com down. Measured the same day from outside:
زیرساخت Mashhad = 3.5 ms from Shatel and 0% loss / 0.1 ms jitter from the USA;
مخابرات = 37-40 ms from Shatel and unreachable from abroad. A temporary bypass
(home ac3 `wg-afrows` → USA) keeps the site up until the move.

## 0. New VPS to buy

- Ubuntu 24.04 x86_64, static public IPv4, **≥ 2 vCPU / 4 GB RAM / 50 GB disk**
  (old box: 1 vCPU / 4 GB, 9.2 GB disk used, Postgres 392 MB, /opt/afrows 1.7 GB).
- UDP must be allowed inbound (WireGuard 51820-51903, IPsec 500/4500, L2TP 1701).
- Root SSH key login. Send the operator the IP; nothing else is needed from the panel.

## 1. What depends on the old IP (inventory, read 2026-10-20)

| Where | What | Change at cutover |
|---|---|---|
| `/etc/afrows/afrows.env` | `AFROWS_INBOUND_HOST`, `AFROWS_WG_ENDPOINT` (:51822), `AFROWS_L2TP_SERVER`, `AFROWS_ROUTER_WG_ENDPOINT` = raw IP | set to new IP |
| 45 customers | VLESS links + WireGuard `.conf` + L2TP (3 users) carry the raw IP | subscription users auto-refresh; WG/L2TP users re-import |
| Cloudflare DNS | `app.afrows.com` (and any DNS-only/grey records pointing at the IP) | repoint; proxied records unaffected |
| `/etc/coredns/db.afrows.com` | A records = old IP (service inactive) | update or drop |
| `/etc/netplan/99-virt-eth0.yaml` | old IP (provider-specific) | do not copy |
| Village ax3 | `wg-afrows` / `wg-afrows-de` endpoints, per-WAN pin routes, watchdog `dst-address~` | `scripts/mikrotik/village-ax3-rebuild.rsc` `afrSrvIp` |
| Home ac3 | `afrAfrowsIp` + the temporary `wg-afrows` bypass | update / remove bypass |
| Repo | `routers.service.ts:251` fallback, `network-map.tsx:97` label, `DEPLOY-STEPS.txt`, `infra/ubuntu/tls/README.md`, `deploy.env` / `~/.ssh/config` `afrows-vps-direct`, tests using the IP as a fixture | code + docs bump |
| USA box | nothing IP-bound (Afrows dials out to it); relay `authorized_keys` keys move with `/etc/afrows` | none |

Server keys are **copied, not regenerated** (WireGuard private keys, xray Reality key,
UUIDs, relay/mgmt SSH keys, us-chain UUID, TLS). So every client keeps working once
only the endpoint IP changes.

## 2. Phases

### Phase A: build the new box in parallel (no customer impact)
1. SSH key access; `afrows-vps-new` alias in `~/.ssh/config` + `deploy.env` (fallback target).
2. Base: ufw baseline (`infra/ubuntu/ufw-baseline.sh.sample`), sysctl (`sysctl-network.conf.sample`),
   time sync, unattended-upgrades; **public ports only** 22, 80, 443, 8080, 12345 tcp/udp,
   51820-51822, 51900-51903 udp, 500/4500/1701 udp, 52000 udp (echo).
3. Packages pinned to the old box: PostgreSQL 16, Node 22, nginx 1.24, Xray 26.3.27,
   wireguard-tools, strongswan + xl2tpd, cloudflared. The box may be offline for npm too:
   ship the npm cache like the 0.120.0 deploy (`/root/afrows-cache`).
4. Check the new box's international reachability first (curl 1.1.1.1, USA 93.127.140.50:22,
   Cloudflare 172.64.34.62:443). If it has none, keep the ac3 bypass pattern ready.

### Phase B: copy state (still no impact)
1. Encrypted transfer old → new, root-only, over SSH (never through Borjino):
   `/etc/afrows/` (env, keys, tls), `/usr/local/etc/afrows-xray/`, xray.service config,
   `/etc/wireguard/` (minus netplan-specific bits), `/etc/ipsec.*` + `/etc/ppp/chap-secrets`,
   `/etc/nginx/sites-available/afrows` + snippets, `/etc/letsencrypt/`,
   systemd units + timers (`afrows-*`), `/usr/local/{bin,lib,libexec,sbin}/afrows*`,
   `/etc/ssh/ssh_config.d/6*-afrows-*.conf`, `/etc/cloudflared/`.
2. Deploy the app from the committed tree: `afrows-deploy.sh` against `afrows-vps-new`.
3. Database rehearsal: `pg_dump -Fc` on the old box → restore on the new one → run the
   backend against it with **timers and xray user sync disabled** (no double billing,
   no Telegram double-send: keep the bot token unused on the new box until cutover).
4. Smoke on the new IP via `--resolve`: nginx 200, `/api/health`, VLESS via xray client,
   one test WireGuard peer, relay services up (web tunnel to USA works only after cutover:
   the USA `:18444` is held by the old box).

### Phase C: cutover (planned window, ~30 min, low-traffic hour)
1. Announce to customers in Telegram (bot broadcast) a short window + "refresh subscription".
2. Old box: stop `afrows-backend`, timers, `afrows-web-tunnel`, `afrows-tg-socks`,
   `afrows-de-relay`, cloudflared (xray stays up so customers stay connected until the switch).
3. Final `pg_dump` → restore on new (delta since rehearsal).
4. New box: env endpoints → new IP; start postgres, backend, xray, wg, relays, timers.
5. DNS: repoint grey records (`app.afrows.com` etc.) at the new IP, TTL 300 beforehand.
6. Routers: village ax3 + home ac3 endpoint → new IP (scripts updated in the repo first);
   confirm WG handshakes on wg-village, wg-village-de, wg-home.
7. Verify: afrows.com / app / api health 200, Telegram bot replies, usage recorder deltas,
   one customer of each type (VLESS, WireGuard, L2TP) connects.
8. Old box: stop xray + WireGuard (so stale clients fail fast, not half-work).

### Phase D: customers
- VLESS subscription users: refresh in the app; done.
- WireGuard and L2TP users (static configs): the bot/dashboard reissue new configs with
  the same keys; a broadcast with a "get new config" button.
- Keep the old box **powered but idle for 7 days** for rollback, then wipe it (DB dumps,
  keys, customer data) before cancelling. Do not leave customer data with the old provider.

### Phase E: cleanup
- Remove the home ac3 `wg-afrows` bypass and the `172.64.34.62` peer on Afrows `wg-home`
  (unless kept as a standing fallback, decision for the operator).
- Repo: update IP references (table above), `.claude/memory.md`, `progress.md`, CHANGELOG,
  version bump, `npm run version:check`.

## 3. Rollback
Until Phase D ends: point env/DNS/routers back at `94.74.145.199`, start the old services,
restore the newest dump if the new box took writes. Customers' configs still carry the old
IP until they refresh, so rollback is cheap early and expensive later; decide within 24 h.

## 4. Open decisions
- Raw IP vs a DNS-only hostname (e.g. `edge.afrows.com`) for client endpoints. A hostname makes
  the next move a DNS change, but during an international cut Iranian resolvers may not
  reach Cloudflare's nameservers. Keeping the raw IP is the safe default for Iran.
- Keep the ac3 → USA bypass as a permanent fallback for the web tunnel or remove it.
