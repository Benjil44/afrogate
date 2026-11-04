# Afrows USA exit (93.127.140.50)

The operator's USA VPS is the second Afrows exit and customer entry, built like the
Germany exit (`afrows-de-ws`). Afrows manages users on it remotely **without any Borjino
hop**. Management SSH travels inside the Afrows -> Cloudflare -> USA xray chain.

```
customer --VLESS-WS-TLS--> Cloudflare (us.afrows.com) --tunnel--> USA cloudflared
        --> 127.0.0.1:10085 afrows-us-ws (xray) --> freedom (exit IP 93.127.140.50)

Afrows backend (user afrows): ssh afrows-us-mgmt <verb>
  ProxyCommand nc -X 5 -x 127.0.0.1:1083  -> Afrows xray inbound us-mgmt-socks
  -> outbound via-usa (VLESS-WS-TLS, Cloudflare IP, SNI/Host us.afrows.com, /afrowsus,
     user afrows-chain@afrows, mux) -> USA afrows-us-ws -> 127.0.0.1:22 (USA sshd)
  -> authorized_keys forced command /usr/local/sbin/afrows-us-mgmt-cmd (from="127.0.0.1")
```

## What runs where

| Box | Object | Purpose |
|---|---|---|
| USA | `xray.service` (official Xray-core v26.3.27, `User=nobody`), `/usr/local/etc/xray/config.json` (root:nogroup 0640) | `afrows-us-ws` VLESS+WS `/afrowsus` on **127.0.0.1:10085** (no TLS; Cloudflare terminates it), sniffing on; API (Handler+Stats) on **127.0.0.1:10086**; per-user up/down stats. |
| USA | `/usr/local/sbin/afrows-us-mgmt-cmd` | Forced command: `read-usage`, `rmu <cc_..@afrows>`, `adu` (JSON on stdin). Same semantics as `scripts/afrows-de-mgmt-cmd`. Also mirrors adu/rmu into config.json under a lock, so customers survive an xray restart. |
| USA | `afrows-us-usage-recorder.service` running `/usr/local/lib/afrows/afrows-usage-recorder.py` | The **unchanged** Germany recorder (`scripts/afrows-de-usage-recorder.py`), pointed at `127.0.0.1:10086` and `/var/lib/afrows/us-usage.json`. Every 30 s it runs `statsquery -pattern user>>> -reset` and adds the `cc_<uuid>@afrows` deltas into a durable cumulative total. Afrows pulls it and computes its own delta. `afrows-chain@afrows` is never counted. |
| USA | `cloudflared-us.service`, its own locally-managed tunnel `afrows-us` | `us.afrows.com` -> `http://127.0.0.1:10085`. The existing token-managed tunnel (`/etc/cloudflared/afrows.token`) is not touched. |
| Afrows | `afrows-xray`: inbound `us-mgmt-socks` 127.0.0.1:1083, outbound `via-usa`, rule `us-mgmt-socks -> via-usa` | Rendered by `scripts/afrows-egress-mode-sync.py` only when `AFROWS_US_CHAIN_UUID` is set. No customer route uses `via-usa`, and `CATCHALL_ORDER` is unchanged. |
| Afrows | `/etc/afrows/us_mgmt_key` (+ `.pub`), `/etc/afrows/us_mgmt_known_hosts`, `/etc/afrows/us-chain-uuid`, `/etc/ssh/ssh_config.d/61-afrows-us-mgmt.conf` | Management SSH identity, pinned host key, chain credential, and the `Host afrows-us-mgmt` alias. |

### USA routing policy (`xray-config.template.json`)

`domainStrategy: IPIfNonMatch`, rules in this order:
1. `api` -> api.
2. user `afrows-chain@afrows` to `127.0.0.1/32` port 22 -> `direct`. This is the management path and the only private-address exception.
3. `bittorrent` -> block.
4. `geoip:private` -> block, for everyone, the chain user included. This protects the USA's loopback services (sshd reverse tunnels, cloudflared metrics) and the operator's `wg-home` 10.40.0.0/24.
5. Everything else falls to the first outbound, `direct`.

There is deliberately **no** explicit catch-all rule. With one in place, `IPIfNonMatch` never
resolves domains, so `localhost:22` or `127.0.0.1.nip.io` would slip past rule 4. This was
verified as a real leak during install and then fixed. Access log is `none` (privacy).

### Direct REALITY entry for the Afrows chain (2026-10-20)

After the move to the زیرساخت مشهد server (185.252.30.123) the chain no longer goes
through Cloudflare (throttled there) and must use port 443 (Iranian DPI blackholes
tunnels to foreign IPs on other ports):

- Inbound `afrows-us-reality` (VLESS+REALITY, tcp **8443**, SNI/dest `dl.google.com`,
  only the `afrows-chain@afrows` client), added live with `xray api adi` and persisted by
  `scripts/afrows-chain-reality-add.py` (run under `/run/afrows-us-mgmt.lock`). The public
  key is in `config.json.afrows-us-reality.pbk`; the private key only in `config.json`.
- `afrows-reality-fw.service`: tcp/8443 only from the Afrows servers (185.252.30.123,
  94.74.145.199) and loopback, and a NAT redirect of **their** tcp/443 to 8443 (xray runs as
  `nobody` and cannot bind 443). Everyone else's 443 is untouched.
- The live rule "chain user -> block" was removed, so the chain may browse (private IPs and
  bittorrent stay blocked): until Germany has its own 443, the Afrows customer catch-all
  `via-germany` is pointed at this USA entry (`AFROWS_DE_CHAIN_*` = the USA values on the
  Afrows server). Backup `config.json.bak-chain-egress-20261020-*`.
- 2026-10-27: the live chain is **Shadowsocks-2022** inbound `afrows-us-ss` on :8447 (tcp+udp,
  `2022-blake3-aes-128-gcm`, one client `afrows-chain@afrows`, the user the SSH-relay rule
  allows). Its client password (`serverPSK:userPSK`) is in `config.json.afrows-us-ss.client`
  and in the Afrows env as `AFROWS_{US,DE}_CHAIN_SS_PASSWORD`. `afrows-reality-fw` guards
  8443/8446/8447 (8447 also udp) with the `AFROWS-REALITY` chain. REALITY inbounds
  `afrows-us-reality` (:8443) and `afrows-us-rv` (:8446, Vision, user `afrows-chain-rv@afrows`,
  which can NOT reach the SSH relay) stay as fallbacks (since 2026-10-28 `afrows-us-rv` via :443 is the
  live target of the Afrows backup transport `via-backup`, see `infra/ubuntu/relay/README.md`): on the Afrows server re-enable them
  by restoring the `#pre-ss-20261027#` env lines and running the egress mode sync.
- Rollback: `systemctl disable --now afrows-reality-fw`, `xray api rmi afrows-us-reality`,
  restore the config backup under the lock.

## USA: apply / verify / rollback (already applied 2026-10-08)

Apply (idempotent; it never overwrites an existing config.json or chain UUID):
```bash
# from the repo root on a workstation
ssh root@93.127.140.50 'install -d -m 700 /root/afrows-usa-stage'
scp infra/usa/{xray-config.template.json,xray.service,afrows-us-mgmt-cmd,afrows-us-usage-recorder.service,install.sh} \
    scripts/afrows-de-usage-recorder.py root@93.127.140.50:/root/afrows-usa-stage/
ssh root@93.127.140.50 'sed -i "s/\r$//" /root/afrows-usa-stage/*; bash /root/afrows-usa-stage/install.sh /root/afrows-usa-stage'
```
Verify on the USA:
```bash
XRAY_LOCATION_ASSET=/usr/local/share/xray xray run -test -config /usr/local/etc/xray/config.json
systemctl is-active xray afrows-us-usage-recorder afrows-cf wg-quick@wg-home ssh
ss -ltnp | grep -E ':1008[56] '            # both on 127.0.0.1 only
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:10085/afrowsus   # 400 (ws inbound alive)
SSH_ORIGINAL_COMMAND=read-usage /usr/local/sbin/afrows-us-mgmt-cmd
SSH_ORIGINAL_COMMAND='ls' /usr/local/sbin/afrows-us-mgmt-cmd   # -> denied (rc 3)
```
Rollback on the USA (cloudflared, wg-home and sshd are not touched):
```bash
systemctl disable --now xray afrows-us-usage-recorder
rm -f /etc/systemd/system/xray.service /etc/systemd/system/afrows-us-usage-recorder.service \
      /usr/local/sbin/afrows-us-mgmt-cmd /usr/local/lib/afrows/afrows-usage-recorder.py
systemctl daemon-reload
# optional full removal (destroys the chain UUID + mirrored customers + usage buffer):
# rm -rf /usr/local/etc/xray /usr/local/share/xray /usr/local/bin/xray /var/lib/afrows/us-usage.json
sed -i '/afrows-us-mgmt-cmd/d' /root/.ssh/authorized_keys   # if the mgmt key was added
```

## Cloudflare step (done 2026-10-10, no Zero Trust needed)

Adding a hostname to the existing token-managed tunnel needs the Zero Trust dashboard, which
asks for a payment method. So the USA got its own **locally-managed** tunnel instead (the same
way `afrows-germany` is set up):

```bash
cloudflared tunnel login            # operator opens the URL, picks afrows.com, Authorize
                                    # (if the box never receives cert.pem, copy the browser's
                                    #  downloaded cert.pem to /root/.cloudflared/cert.pem)
cloudflared tunnel create afrows-us # id bfe49b0a-adb8-4dec-8b0d-4fad9e5b0e76
# /etc/cloudflared-us/<id>.json (0600) + /etc/cloudflared-us/config.yml:
#   ingress: us.afrows.com -> http://127.0.0.1:10085, then http_status:404
cloudflared tunnel route dns afrows-us us.afrows.com   # proxied CNAME
# /etc/systemd/system/cloudflared-us.service: cloudflared --no-autoupdate --edge-ip-version 4
#   --config /etc/cloudflared-us/config.yml tunnel run   (enabled, Restart=always)
rm /root/.cloudflared/cert.pem      # account-wide cert; not needed to run the tunnel
```

Do NOT point it at `https://localhost:443`: on this box 127.0.0.1:443 is iptables-redirected to
the Afrows reverse tunnel (18444). **WebSockets** must be on for the zone (already on, since
`de.afrows.com` WS works).

Check: `curl -s -o /dev/null -w '%{http_code}
' https://us.afrows.com/afrowsus` -> `400`
(xray ws answers a non-upgrade GET with 400; a 404 or 502 means the hostname or service is
wrong). Rollback: `systemctl disable --now cloudflared-us`, then delete the `us` CNAME and the
`afrows-us` tunnel in the Cloudflare dashboard.

## Afrows runbook (applied 2026-10-10; backups `*.bak-us-20261010-173813`)

Preconditions: the Cloudflare hostname above returns 400, and the updated
`scripts/afrows-egress-mode-sync.py` is deployed to `/usr/local/bin/afrows-egress-mode-sync.py`
(it ships with the normal deploy, or copy it in). Take backups first:
```bash
TS=$(date +%Y%m%d-%H%M%S)
cp -a /etc/afrows/afrows.env /etc/afrows/afrows.env.bak-us-$TS
cp -a /usr/local/etc/afrows-xray/config.json /usr/local/etc/afrows-xray/config.json.bak-us-$TS
cp -a /usr/local/bin/afrows-egress-mode-sync.py /usr/local/bin/afrows-egress-mode-sync.py.bak-us-$TS
```

1. **Chain UUID.** Copy it USA -> Afrows from the operator's workstation. It is piped, never printed or written to the repo:
   ```bash
   ssh root@93.127.140.50 "jq -r '.inbounds[]|select(.tag==\"afrows-us-ws\").settings.clients[]|select(.email==\"afrows-chain@afrows\").id' /usr/local/etc/xray/config.json" \
     | ssh root@185.252.30.123 'umask 077; cat > /etc/afrows/us-chain-uuid; chown root:root /etc/afrows/us-chain-uuid; wc -c /etc/afrows/us-chain-uuid'   # expect 37
   ```
2. **Management key** (on Afrows; the private key never leaves the box; owned by `afrows`, the backend's user):
   ```bash
   ssh-keygen -q -t ed25519 -N '' -C afrows-us-mgmt -f /etc/afrows/us_mgmt_key
   chown afrows:afrows /etc/afrows/us_mgmt_key /etc/afrows/us_mgmt_key.pub
   chmod 600 /etc/afrows/us_mgmt_key; chmod 644 /etc/afrows/us_mgmt_key.pub
   ```
3. **Authorize it on the USA** (from the workstation; the key is pinned to the forced command and to loopback):
   ```bash
   ssh root@185.252.30.123 'cat /etc/afrows/us_mgmt_key.pub' | ssh root@93.127.140.50 \
     'read -r k; grep -qF "$k" /root/.ssh/authorized_keys || { cp -a /root/.ssh/authorized_keys /root/.ssh/authorized_keys.bak-us-$(date +%s); echo "command=\"/usr/local/sbin/afrows-us-mgmt-cmd\",from=\"127.0.0.1\",no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding $k" >> /root/.ssh/authorized_keys; }; grep -c afrows-us-mgmt-cmd /root/.ssh/authorized_keys'
   ```
4. **Pin the USA host key** (on Afrows). Its fingerprint is `SHA256:eouBK8jUEWHod+SnCxLO/DOKl6sdbUgUgOhPI8Ic7Wg` (ED25519):
   ```bash
   ssh root@93.127.140.50 'cat /etc/ssh/ssh_host_ed25519_key.pub' | awk '{print "afrows-us-mgmt", $1, $2}' \
     | ssh root@185.252.30.123 'cat > /etc/afrows/us_mgmt_known_hosts; chown afrows:afrows /etc/afrows/us_mgmt_known_hosts; chmod 644 /etc/afrows/us_mgmt_known_hosts; ssh-keygen -lf /etc/afrows/us_mgmt_known_hosts'
   ```
5. **ssh alias** (on Afrows): install `infra/usa/61-afrows-us-mgmt.conf` as
   `/etc/ssh/ssh_config.d/61-afrows-us-mgmt.conf` (root 0644), then run `ssh -G afrows-us-mgmt | grep -E '^(hostname|proxycommand|identityfile) '`.
6. **Env** (on Afrows, `/etc/afrows/afrows.env`, root 0600). Append these lines only if they are not already there:
   ```bash
   U=$(cat /etc/afrows/us-chain-uuid)
   cat >> /etc/afrows/afrows.env <<EOF
   AFROWS_US_CHAIN_UUID=$U
   AFROWS_US_CHAIN_ADDRESS=172.64.34.62
   AFROWS_US_CHAIN_HOST=us.afrows.com
   AFROWS_US_MGMT_SSH=afrows-us-mgmt
   AFROWS_US_MGMT_KEY=/etc/afrows/us_mgmt_key
   EOF
   ```
   The backend's customer-link and usage vars (`AFROWS_US_ENTRY_ADDRESS`, and the USA usage
   enable flag) belong to the backend change. Use the names that the backend's `.env.example` defines.
7. **Render the chain**: `systemctl start afrows-egress-mode-sync.service; journalctl -u afrows-egress-mode-sync -n 20 --no-pager`.
   Expect `afrows-xray: routing -> ...`. The script runs `xray -test` first and backs the config up before restarting `afrows-xray`.
8. **Verify** (on Afrows):
   ```bash
   ss -ltnp | grep ':1083 '                                       # 127.0.0.1:1083 only
   jq -c '.routing.rules[] | select(.inboundTag==["us-mgmt-socks"])' /usr/local/etc/afrows-xray/config.json
   curl -s -m 20 -x socks5h://127.0.0.1:1083 https://api.ipify.org || echo blocked   # -> blocked (the chain user may only reach the USA's sshd)
   # afrows' login shell is nologin and ssh runs ProxyCommand via $SHELL (the backend sets SHELL=/bin/sh itself)
   sudo -u afrows env SHELL=/bin/sh ssh afrows-us-mgmt read-usage   # -> {"updated_at":...,"users":{...}}
   sudo -u afrows env SHELL=/bin/sh ssh afrows-us-mgmt id           # -> denied
   ```
   Then restart the backend once its USA env is in place: `systemctl restart afrows-backend`.

### Afrows rollback
```bash
sed -i '/^AFROWS_US_\(CHAIN_UUID\|CHAIN_ADDRESS\|CHAIN_HOST\|MGMT_SSH\|MGMT_KEY\)=/d' /etc/afrows/afrows.env
systemctl start afrows-egress-mode-sync.service   # unset UUID -> removes via-usa, us-mgmt-socks and the rule
rm -f /etc/ssh/ssh_config.d/61-afrows-us-mgmt.conf
# optional: rm -f /etc/afrows/us_mgmt_key* /etc/afrows/us_mgmt_known_hosts /etc/afrows/us-chain-uuid
# then on the USA: sed -i '/afrows-us-mgmt-cmd/d' /root/.ssh/authorized_keys
# last resort: restore the xray config backup + systemctl restart afrows-xray
```

## DNS resilience (2026-10-28)

The exit resolved through a single upstream (8.8.4.4, from netplan). Twice (2026-10-27 22:25 and 2026-10-28 03:40 UTC) it stopped answering for ~19 min; the Iran→USA chain stayed up, but every customer request by hostname failed (found by `scripts/observatory/`). `/etc/systemd/resolved.conf.d/afrows-dns-resilience.conf` adds global `DNS=1.1.1.1 8.8.8.8 9.9.9.9` and `FallbackDNS=1.0.0.1 8.8.4.4 149.112.112.112`; applying it only restarts systemd-resolved (xray keeps running). Rollback: delete the file and `systemctl restart systemd-resolved`.

## Provider outbound blocks (2026-10-29, supersedes the DNS diagnosis above)

The recurring ~20 min outages are not DNS. During them, the box's NEW outbound TCP to almost every destination (Google, Cloudflare, Telegram, GitHub, Fastly, AWS; ports 80 and 443) gets no SYN-ACK: SYNs leave enp21s0 and die inside the provider's network (TCP traceroute stops after hop 4). Only 1.1.1.1 and 8.8.8.8 stay reachable, and ICMP to the same hosts stays at 0% loss. Each episode lasts exactly ~20 min:
- 10-27: 16:10, 17:19, 22:25
- 10-28: 03:40
- 10-29: 04:17, 13:48, 14:27, 15:01

This looks like an automatic provider (Database Mart) abuse/DDoS filter on 93.127.140.50, and it happened even at very low outbound rates. `afrows-rate-logger.service` logs 10 s rates to `/var/log/afrows-observatory/usa-rates.jsonl` to catch the trigger. Fix options: ask the provider, and add a second exit for failover. The DNS upstream change stays (harmless).

## SSH login alerts (2026-10-31)

`afrows-login-alert` (→ `/usr/local/sbin/`, root 0700) runs from `/etc/pam.d/sshd` as `session optional pam_exec.so quiet /usr/local/sbin/afrows-login-alert`, so it can never block a login. It skips the Afrows tunnels (rhost 127.0.0.1, user `afrows-relay`), logs every other login to `/var/log/afrows-logins.log`, and sends the bot's alert chat a Telegram message, at most once per user+IP per 30 min. The token and chat id are in `/etc/afrows/login-alert.env` (root 0600, copied from the Afrows env; not in the repo). Audit on 2026-10-31: no password login ever; only Afrows keys and the operator's own sessions; 39,525 failed bot attempts, with 702 IPs banned by fail2ban. Rollback: remove the pam line (backup `/root/pam.d-sshd.bak-20261031`).

fail2ban (`/etc/fail2ban/jail.d/afrows-usa.conf`, operator 2026-10-31): maxretry 3, findtime 1h, bantime 24h, bantime.increment (factor 2, max 1w), nftables allports. The ignoreip list (loopback, 10/8, the Afrows servers, the operator's known IPs) is unchanged. Backup: `afrows-usa.conf.bak-20261031`.

## Outage watchdog (2026-11-02)

`afrows-watchdog` (→ `/usr/local/sbin/`, root 0700; `afrows-watchdog.timer` every minute) sends Telegram alerts using `/etc/afrows/login-alert.env`:
- the Iran server is unreachable for 3 minutes (provider freeze, shutdown);
- this box's outbound is blocked for 2 minutes (provider filter);
- each recovery, with its duration.

Messages Telegram cannot take yet are queued in `/var/lib/afrows-watch/queue`. The watchdog lives here because this box can see the Iran server from outside. The USA ws inbound keeps all customers on disk, so the USA/Germany Cloudflare links keep working while the Iran server is down.

## Direct customer entries (no Cloudflare), 2026-11-04

MCI throttles Cloudflare after the handshake, so customers also get links straight to this box:

| Tag | Port | Transport |
|---|---|---|
| `afrows-us-dr` | :443 → 8450 | VLESS + REALITY (SNI www.speedtest.net), fp ios, no flow |
| `afrows-us-dx` | 8080 | VLESS + XHTTP packet-up over REALITY (SNI dl.google.com) |
| `afrows-us-dh` | 2095 | VLESS + tcp `headerType=http` (decoy Host) + VLESS Encryption, no TLS |

- Install or refresh: `python3 -I /usr/local/sbin/afrows-us-direct.py > /etc/afrows/us-direct.env.out`. It is idempotent: it copies the customers from `afrows-us-ws`, reuses the REALITY key of `afrows-us-rv`, generates the VLESS Encryption pair once (client half in `/etc/afrows/us-direct-encryption`, root 600) and prints the public `AFROWS_US_DIRECT_*` values for the Iran server's env (plus `AFROWS_US_DIRECT_HOST=93.127.140.50`).
- `afrows-us-direct-fw.service` redirects public :443 to 8450, after `afrows-reality-fw` (the Iran server's :443 still goes to the chain inbound 8446).
- `afrows-us-mgmt-cmd` repeats every `adu`/`rmu` on the three direct tags and mirrors them into config.json, so a customer has the same uuid everywhere. Usage is per user, so it is billed 2x as before.
- Rollback: `systemctl disable --now afrows-us-direct-fw`, restore `config.json.bak-*-direct`, restart xray, and set `AFROWS_US_DIRECT_ENABLED=false` on the Iran server.
