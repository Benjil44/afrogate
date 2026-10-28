# Afrows relay chain (Borjino-free since 2026-10-11)

Since 2026-10-20 the Afrows server is 185.252.30.123 (زیرساخت مشهد). Everything
foreign the server needs goes over SSH to the USA VPS. From this datacenter Iranian
DPI freezes REALITY tunnels to foreign IPs, and Cloudflare is blocked, so since
2026-10-27 the SSH rides a direct Shadowsocks-2022 chain to the USA xray :8447
(`afrows-reality-fw` on the USA lets only the Afrows server reach it):

```
Afrows ──nc──▶ xray loopback socks us-mgmt-socks 127.0.0.1:1083
       ──▶ via-usa (Shadowsocks-2022, 93.127.140.50:8447, user afrows-chain@afrows)
       ──▶ USA xray ──▶ USA sshd 127.0.0.1:22 (user afrows-relay)  ──▶  target
```

`afrows-exit-mss.service` (repo `scripts/systemd/`) must run on the Afrows server: the
USA → زیرساخت path drops packets over ~1480 bytes without ICMP, which stalls the
REALITY handshake unless the advertised MSS is 1400. The old server (94.74.145.199,
مخابرات مشهد) used the Cloudflare WS chain below; its env keeps those values as
`#pre-zirsakht#` lines.

The USA xray only lets the Afrows chain user reach 127.0.0.1:22 (see
`infra/usa/README.md`). **No Borjino.** Afrows must never depend on Borjino
(185.252.30.127) again — not as a hop, a fallback, a fail2ban allow-list entry or
an authorized_keys `from=`. Until 2026-10-11 these units hopped through it; it
went dark at 09:10 UTC that day and took afrows.com down.

## What rides the chain

| Purpose | Unit on Afrows | USA-side restriction (authorized_keys of `afrows-relay`) |
|---|---|---|
| Germany mgmt SSH (adu / rmu / read-usage) | `afrows-de-relay.service` (master, `ssh -F de_relay_ssh_config`) + `60-afrows-de-relay.conf` | `permitopen="162.19.253.235:22"` |
| Website reverse tunnel (**retired 2026-10-25**, see below) | `afrows-web-tunnel.service` (`-R 127.0.0.1:18444:127.0.0.1:443`) | `permitlisten="127.0.0.1:18444"` |
| Telegram Bot API (**until 2026-10-27**; now the backend uses `AFROWS_OUTBOUND_PROXY_URL=socks5://127.0.0.1:1083`, the xray us-mgmt-socks → via-usa, because DPI froze the long-lived SSH flow) | `afrows-tg-socks.service` (`-D 127.0.0.1:1081`) | `permitopen="api.telegram.org:443"` |

All three set `SHELL=/bin/sh`: ssh starts ProxyCommand through `$SHELL`, and the
`afrows` user has a nologin shell. The USA host key is pinned as
`afrows-us-mgmt` in `/etc/afrows/us_mgmt_known_hosts` (same key the backend's
`ssh afrows-us-mgmt` uses).

Website path (since 2026-10-25): visitor → Cloudflare → `afrows-cf.service` on the USA VPS
(`usa-afrows-cf.service`; its `ExecStartPre` adds an iptables nat OUTPUT redirect
`127.0.0.1:443 → 18444`, comment `afrows-cf-web`) → `afrows-web-origin.socket` on
`127.0.0.1:18444` (`usa-afrows-web-origin.{socket,service}`, `systemd-socket-proxyd`)
→ **directly** to the Afrows server `185.252.30.123:443` (nginx).

The `afrows-web-tunnel` reverse tunnel is **retired and disabled**: it rode the
Afrows → USA REALITY chain, which Iranian DPI freezes intermittently, and the site
went 502 every time (959 tunnel restarts by 2026-10-25). Plain HTTPS from the USA
to the Afrows server is not interfered with. Do not re-enable it; if the direct path
ever fails, `systemctl disable --now afrows-web-origin.socket` on the USA and
`systemctl enable --now afrows-web-tunnel` on Afrows restores the old path.

Germany mgmt falls back automatically to the village tunnel (`wg-village-de`)
when `afrows-de-relay-up` fails (it checks the authenticated master socket).

## Backup foreign transport `via-backup` (2026-10-28)

Customers ride `via-germany` (the Shadowsocks-2022 chain above). When it is down,
the catch-all now moves to a **second transport** before the relay pool or
`direct` (Iranian internet, where YouTube, Instagram and Telegram are blocked). DPI
tends to freeze one transport while another still passes: the two ~20 min SS
outages (2026-10-27 22:25-22:44, 2026-10-28 03:40-04:00 UTC) did not hit REALITY.

`scripts/afrows-egress-mode-sync.py` renders it from `/etc/afrows/afrows.env`, with the
same builder as the other chains (`reality`, `ss` or `ws`):

| Variable | Live value | Notes |
|---|---|---|
| `AFROWS_BACKUP_CHAIN_MODE` | `reality` | `reality`, `ss` or `ws`. Unset disables the backup |
| `AFROWS_BACKUP_CHAIN_ADDRESS` | `93.127.140.50` | Required |
| `AFROWS_BACKUP_CHAIN_PORT` | `443` | The USA NAT-redirects only the Afrows server's tcp/443 to `afrows-us-rv` :8446 |
| `AFROWS_BACKUP_CHAIN_UUID` | (secret) | Required for `reality` and `ws`. Same uuid as the `afrows-us-rv` client |
| `AFROWS_BACKUP_CHAIN_REALITY_PBK` / `_SID` / `_SNI` | (pbk/sid secret), `www.speedtest.net` | The `afrows-us-rv` values |
| `AFROWS_BACKUP_CHAIN_REALITY_FLOW` | `xtls-rprx-vision` | Must match the server client (`afrows-us-rv` requires Vision) |
| `AFROWS_BACKUP_CHAIN_REALITY_FP` | `ios` | Chosen by measurement (see below) |
| `AFROWS_BACKUP_CHAIN_SS_PASSWORD` / `_SS_METHOD` | | `ss` mode only |
| `AFROWS_BACKUP_CHAIN_HOST` / `_PATH` | | `ws` mode only |
| `AFROWS_BACKUP_PROBE_SOCKS` | default `127.0.0.1:10813` | Loopback probe socks |

What gets rendered when the backup is configured:
- the outbound `via-backup` on **both** engines (afrows-xray and afrows-wg), since either catch-all may point at it;
- on afrows-xray only, the loopback socks inbound `backup-probe` (127.0.0.1:10813) and the rule `backup-probe -> via-backup`.

The outbound set stays the same while the backup is configured, so a failover only
changes the catch-all rule. The reconciler still restarts the engines on any change,
exactly as it does today when the catch-all flips to `direct`.

Failover ladder (`decide_catchall`, the same hysteresis: 2 bad probes to leave a path, 3 good ones to come back):

`via-germany` up -> `via-germany`; else `via-backup` up -> `via-backup`; else relay pool up -> `proxy`; else `direct`.

The backup is probed only when `via-germany` is down, and the pool only when both
chains are down. The backup probe is bounded to 8 s per URL (12 s hard limit).
Probes are memoized per run, so with every path dead a run takes about 100 s,
well inside the unit's 240 s. `/var/lib/afrows/egress-health.json` has
`backupUp` (`null` when the backup is not configured). The gaming ladder and the
D2 fixed paths are unchanged. The bypass still activates only when the catch-all is `direct`.

Measured from this server before the deploy (2026-10-28, two rounds, standalone xray
clients on throwaway socks ports, interleaved with the live SS chain; ok = curl exit 0):

| Path | google 204 | youtube | bulk (10 MB, MB/s) |
|---|---|---|---|
| REALITY + Vision, fp=ios, :443 -> `afrows-us-rv` | 20/20, 19/20 | 10/10, 10/10 | 2.2, 2.9, 2.8, 2.4 |
| REALITY no Vision, fp=ios, :8443 `afrows-us-reality` | 20/20, 20/20 | 10/10, 9/10 | **0.002 (stalled)**, 2.6, 1.9, 2.1 |
| SS-2022 :8447 (live chain, reference) | 19/20, 20/20 | 10/10, 10/10 | 3.0, 3.1, 1.6, 2.6 |

Vision + ios on 443 was as good as SS and needs no USA change, so it is the backup.
No-Vision could only be tested on :8443 (the 443 redirect goes to the Vision-only
`afrows-us-rv`), and one of its bulk transfers stalled, which fits the non-443
blackhole. No 8448 inbound was added.

Verify (on the Afrows server, without forcing a failover):
```bash
ss -ltn | grep -E '127.0.0.1:(10812|10813) '
curl -s -o /dev/null -w '%{http_code} %{time_total}
' -m 10 --socks5-hostname 127.0.0.1:10812 https://www.google.com/generate_204   # primary
curl -s -o /dev/null -w '%{http_code} %{time_total}
' -m 10 --socks5-hostname 127.0.0.1:10813 https://www.google.com/generate_204   # backup
journalctl -u afrows-egress-mode-sync -n 5 --no-pager    # "failover: via-germany=up backup=n/a ..."
jq '.backupUp, .appliedCatchAll' /var/lib/afrows/egress-health.json
```

Rollback (backups `*.bak-20261028-backup`):
```bash
# disable only the backup (renderer stays): the next run removes via-backup, backup-probe and the rule
sed -i '/^AFROWS_BACKUP_CHAIN_/d' /etc/afrows/afrows.env
systemctl start afrows-egress-mode-sync.service
# full: the previous renderer + env
cp -a /usr/local/bin/afrows-egress-mode-sync.py.bak-20261028-backup /usr/local/bin/afrows-egress-mode-sync.py
cp -a /etc/afrows/afrows.env.bak-20261028-backup /etc/afrows/afrows.env
systemctl start afrows-egress-mode-sync.service
```
Use the env removal first. The old renderer does not know `via-backup` and would skip
an engine whose catch-all still points at it, so the new renderer must remove the
backup objects first. If the catch-all is on `via-backup` at that moment, the new
renderer re-decides at once rather than holding a missing tag.

## Files here (no keys)

- `afrows-de-relay.service`, `de_relay_ssh_config` (→ `/etc/afrows/`),
  `60-afrows-de-relay.conf` (→ `/etc/ssh/ssh_config.d/`), `afrows-de-relay-up`
  (→ `/usr/local/libexec/`), `tmpfiles-afrows-de-relay.conf`
  (→ `/etc/tmpfiles.d/afrows-de-relay.conf`)
- `afrows-web-tunnel.service`, `afrows-tg-socks.service`
- `usa-afrows-cf.service` (→ USA `/etc/systemd/system/afrows-cf.service`)
- `usa-afrows-web-origin.socket`, `usa-afrows-web-origin.service` (→ USA `/etc/systemd/system/afrows-web-origin.{socket,service}`)

Keys live only on the hosts: `/etc/afrows/{de_relay_key,web_tunnel_key,tg_socks_key}`
(owner `afrows`, 0600), the Cloudflare tunnel token in USA
`/etc/cloudflared/afrows.token` (root 0600).

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
# USA
userdel -r afrows-relay
```

## Health

```
systemctl is-active afrows-de-relay afrows-web-tunnel afrows-tg-socks   # Afrows
sudo -u afrows /usr/local/libexec/afrows-de-relay-up && echo relay-up      # Afrows
systemctl is-active afrows-cf                                            # USA
```

## USA sshd keepalive for relay sessions

`/etc/ssh/sshd_config.d/60-afrows-relay-keepalive.conf` on the USA VPS:

```
Match User afrows-relay
    ClientAliveInterval 15
    ClientAliveCountMax 3
```

Without it (`ClientAliveInterval 0`) a dead reverse tunnel kept `127.0.0.1:18444` bound on the USA for minutes, so the
reconnecting `afrows-web-tunnel` failed with "remote port forwarding failed" and afrows.com returned Cloudflare 502
(2026-10-15). Root and other logins are unaffected.

## Customer chain: XHTTP packet-up (since 2026-10-28)

`via-germany` = VLESS + XHTTP `packet-up`, VLESS Encryption (ML-KEM-768), no TLS, to USA inbound `afrows-us-xh` :8448 (firewalled to the Afrows server by `afrows-reality-fw`). The client password is in USA `config.json.afrows-us-xh.client` and the Afrows env (`AFROWS_DE_CHAIN_UUID/PATH/XHTTP_ENCRYPTION`). Every `xmux` field is set, with one request per TCP connection: Iranian DPI drops most upstream packets of any flow after its first ~40, so short flows are the fix (see the `iran-dpi-playbook` skill). `via-backup` = the Shadowsocks chain (:8447). `via-usa` (mgmt and Telegram) stays on Shadowsocks: the USA SSH relay only accepts `afrows-chain@afrows`.

Rollback (Afrows server): restore `/etc/afrows/afrows.env.bak-20261028-xhttp` (or uncomment the `#pre-xh-20261028#` lines and delete the block below them) and run `systemctl start afrows-egress-mode-sync.service`.
