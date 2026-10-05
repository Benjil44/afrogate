# Afrows relay chain (live since 2026-10-04)

The Afrows server (94.74.145.199) sits in a Mashhad datacenter whose uplink drops
**every** packet to foreign IPs (both directions). Only Cloudflare and Iranian
addresses pass. So everything foreign the server needs goes over SSH through two
hops that *can* reach abroad:

```
Afrows (Mashhad)  ──SSH──▶  Borjino 185.252.30.127 (other Iranian DC, reaches USA)
                  ──SSH──▶  USA VPS 93.127.140.50 (open internet)  ──▶  target
```

WireGuard is **not** used on these hops: Irancell DPI blocks real WireGuard
handshakes to foreign IPs. Plain SSH/TCP passes.

## What rides the chain

| Purpose | Unit on Afrows | USA-side restriction (authorized_keys of `afrows-relay`) |
|---|---|---|
| Germany mgmt SSH (adu / rmu / read-usage) | `afrows-de-relay.service` (master) + `60-afrows-de-relay.conf` | `permitopen="162.19.253.235:22"` |
| Website reverse tunnel | `afrows-web-tunnel.service` (`-R 127.0.0.1:18444:127.0.0.1:443`) | `permitlisten="127.0.0.1:18444"` |
| Telegram Bot API | `afrows-tg-socks.service` (`-D 127.0.0.1:1081`; backend `AFROWS_OUTBOUND_PROXY_URL=socks5://127.0.0.1:1081`) | `permitopen="api.telegram.org:443"` |

Borjino's `afrows-relay` user (nologin, password locked) only allows
`permitopen="93.127.140.50:22"` (and, for USA→Afrows management,
`permitopen="94.74.145.199:22"`). Nothing else on Borjino is touched — it hosts a
separate app and must stay decoupled from Afrows (no shared domains).

Website path: visitor → Cloudflare → `afrows-cf.service` on the USA VPS
(`usa-afrows-cf.service`; its `ExecStartPre` adds an iptables nat OUTPUT redirect
`127.0.0.1:443 → 18444`) → reverse tunnel → Afrows nginx `:443`.

Germany mgmt falls back automatically to the village tunnel (`wg-village-de`)
when `afrows-de-relay-up` fails (it checks the authenticated master socket).

## Files here (no keys)

- `afrows-de-relay.service`, `de_relay_ssh_config`, `60-afrows-de-relay.conf`
  (→ `/etc/ssh/ssh_config.d/`), `afrows-de-relay-up` (→ `/usr/local/libexec/`),
  `tmpfiles-afrows-de-relay.conf` (→ `/etc/tmpfiles.d/afrows-de-relay.conf`)
- `afrows-web-tunnel.service`, `afrows-tg-socks.service`
- `usa-afrows-cf.service` (→ USA `/etc/systemd/system/afrows-cf.service`)

Keys live only on the hosts: `/etc/afrows/{de_relay_key,web_tunnel_key,tg_socks_key}`
(owner `afrows`, 0600), pinned host keys in `/etc/afrows/de_relay_known_hosts`,
the Cloudflare tunnel token in USA `/etc/cloudflared/afrows.token` (root 0600).

## Germany-side additions (Afrows-owned, additive)

- `/etc/fail2ban/jail.d/afrows-allow.conf` — never ban the Afrows control path.
- `/etc/ssh/sshd_config.d/afrows-maxstartups.conf` (`MaxStartups 100:30:200`) and
  `afrows-maxsessions.conf` (`MaxSessions 64`) — the backend opens ~30 parallel calls.
- XHTTP inbound `afrows-de-xhttp` (`/afrowsx`) beside the WS inbound; backups in
  `/root/afrows-xhttp-backup-20261004-210834/`.

## Rollback

```
# Afrows
systemctl disable --now afrows-de-relay afrows-web-tunnel afrows-tg-socks
rm /etc/ssh/ssh_config.d/60-afrows-de-relay.conf      # Germany mgmt → village path
sed -i 's|^AFROWS_OUTBOUND_PROXY_URL=.*|AFROWS_OUTBOUND_PROXY_URL=|' /etc/afrows/afrows.env
# Borjino / USA
userdel -r afrows-relay
```

## Health

```
systemctl is-active afrows-de-relay afrows-web-tunnel afrows-tg-socks   # Afrows
sudo -u afrows /usr/local/libexec/afrows-de-relay-up && echo relay-up      # Afrows
systemctl is-active afrows-cf                                            # USA
```
