# Afrows "Germany Fast x2" exit (46.249.98.221)

A third Afrows exit + customer entry, built like the USA exit (`infra/usa/`) but as a **direct
VLESS+REALITY** inbound (no Cloudflare): customers dial `46.249.98.221:8443` straight. It appears
in every customer's subscription labelled **"Germany Fast x2"** and burns the customer's GB quota
at **2x** (ledger source `de-fast-xray`, baseline `client_usage_def_baseline`). The Afrows backend
manages users on it over a locked-down SSH forced command — **no Borjino hop, never the Hexogate
panel**.

```
customer --VLESS+REALITY (SNI www.speedtest.net, fp chrome)--> 46.249.98.221:8443
        afrows-def-reality (xray, User=nobody) --> freedom (exit IP 46.249.98.221)

Afrows backend (user afrows): ssh afrows-def-mgmt <verb>
  -> 46.249.98.221:22 (direct; this box is reachable, unlike the USA which rides the chain)
  -> authorized_keys forced command /usr/local/sbin/afrows-def-mgmt-cmd (from="<backend IP>")
```

REALITY params (already live on the box; the private key never leaves it):
`HOST=46.249.98.221 REALITY_PORT=8443 REALITY_SNI=www.speedtest.net FP=chrome
PBK=CcIXp3SwniLcFlxxSzY-5qUqB1TSSJIGee_xDohILGQ SID=6d9f7568c8a0d4c0`. **FP must be `chrome`**:
the box runs xray 26.11.9, where the `ios` uTLS fingerprint fails the REALITY handshake.

## What runs where

| Box | Object | Purpose |
|---|---|---|
| Germany-Fast | `xray.service` (official Xray-core, `User=nobody`), `/usr/local/etc/xray/config.json` (root:nogroup 0640) | `afrows-def-reality` VLESS+REALITY on **0.0.0.0:8443** (public); API (Handler+Stats) on **127.0.0.1:10086**; per-user up/down stats. |
| Germany-Fast | `/usr/local/sbin/afrows-def-mgmt-cmd` | Forced command: `read-usage`, `rmu <cc_..@afrows>`, `adu` (JSON on stdin). Maintains `afrows-def-reality`'s clients and mirrors adu/rmu into config.json under a lock, so customers survive an xray restart. Only `cc_<uuid>@afrows` clients are added/removed; any reserved client is left untouched. |
| Germany-Fast | `afrows-def-usage-recorder.service` running `/usr/local/lib/afrows/afrows-usage-recorder.py` | The **unchanged** recorder (`scripts/afrows-de-usage-recorder.py`), pointed at `127.0.0.1:10086` and `/var/lib/afrows/def-usage.json`. Every 30 s it runs `statsquery -pattern user>>> -reset` and adds the `cc_<uuid>@afrows` deltas into a durable cumulative total. Afrows pulls it and computes its own delta. |
| Afrows backend | `/etc/afrows/def_mgmt_key` (+ `.pub`), `/etc/afrows/def_mgmt_known_hosts`, `/etc/ssh/ssh_config.d/61-afrows-def-mgmt.conf` | Management SSH identity, pinned host key, and the `Host afrows-def-mgmt` alias. |

## Firewall (tcp/8443)

REALITY is the **customer** entry, so `tcp/8443` must be open to the world. Everything else on the
box stays as-is. Example (ufw / nftables inbound):

```bash
ufw allow 8443/tcp comment 'afrows-def-reality'
# or nft: add rule inet filter input tcp dport 8443 accept
```

The api/stats inbound (`127.0.0.1:10086`) is loopback-only and needs no rule.

## Billing-critical gating

`de-fast-xray` + `client_usage_def_baseline` are DISTINCT from the Cloudflare Germany meter
(`germany-xray` / `client_usage_de_baseline`). Reusing the Germany source/table would corrupt both
baselines. On the Afrows backend both gates default **off** and the deploy enables them together:

- `AFROWS_DEF_DIRECT_ENABLED=true` — advertise the "Germany Fast x2" link in subscriptions.
- `AFROWS_DEF_MGMT_ENABLED=true` — provision customers onto the box **and** meter it 2x.

**Never enable the entry link without the mgmt/meter, or Germany-Fast traffic is free.** Enforcement
latency: a quota cutoff is bounded by the recorder tick (30 s) + `AFROWS_DEF_USAGE_INTERVAL_SECONDS`
(default 60 s) + one `rmu` (≈95 s at defaults while the link is up).

## Apply / verify / rollback (on the Germany-Fast box)

Apply (idempotent; never overwrites an existing config.json or REALITY key):
```bash
# from the repo root on a workstation
ssh root@46.249.98.221 'install -d -m 700 /root/afrows-def-stage'
scp infra/germany-fast/{xray-config.template.json,xray.service,afrows-def-mgmt-cmd,afrows-def-usage-recorder.service,install.sh} \
    scripts/afrows-de-usage-recorder.py root@46.249.98.221:/root/afrows-def-stage/
ssh root@46.249.98.221 'sed -i "s/\r$//" /root/afrows-def-stage/*; bash /root/afrows-def-stage/install.sh /root/afrows-def-stage'
# copy the printed AFROWS_DEF_DIRECT_* values into the Afrows backend env.
```
Verify on the box:
```bash
XRAY_LOCATION_ASSET=/usr/local/share/xray xray run -test -config /usr/local/etc/xray/config.json
systemctl is-active xray afrows-def-usage-recorder
ss -ltnp | grep -E ':8443 |:10086 '
SSH_ORIGINAL_COMMAND=read-usage /usr/local/sbin/afrows-def-mgmt-cmd        # -> {"updated_at":...}
SSH_ORIGINAL_COMMAND='ls' /usr/local/sbin/afrows-def-mgmt-cmd              # -> denied (rc 3)
```
Rollback on the box:
```bash
systemctl disable --now xray afrows-def-usage-recorder
rm -f /etc/systemd/system/xray.service /etc/systemd/system/afrows-def-usage-recorder.service \
      /usr/local/sbin/afrows-def-mgmt-cmd /usr/local/lib/afrows/afrows-usage-recorder.py
systemctl daemon-reload
sed -i '/afrows-def-mgmt-cmd/d' /root/.ssh/authorized_keys   # if the mgmt key was added
```

## Afrows backend runbook

1. **Management key** (private key never leaves the backend; owned by `afrows`):
   ```bash
   ssh-keygen -q -t ed25519 -N '' -C afrows-def-mgmt -f /etc/afrows/def_mgmt_key
   chown afrows:afrows /etc/afrows/def_mgmt_key /etc/afrows/def_mgmt_key.pub
   chmod 600 /etc/afrows/def_mgmt_key; chmod 644 /etc/afrows/def_mgmt_key.pub
   ```
2. **Authorize it on the box** (pinned to the forced command and to this backend's IP):
   ```bash
   ssh root@<backend> 'cat /etc/afrows/def_mgmt_key.pub' | ssh root@46.249.98.221 \
     'read -r k; grep -qF "$k" /root/.ssh/authorized_keys || echo "command=\"/usr/local/sbin/afrows-def-mgmt-cmd\",from=\"<backend IP>\",no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding $k" >> /root/.ssh/authorized_keys'
   ```
3. **Pin the box host key** (on the backend) into `/etc/afrows/def_mgmt_known_hosts` (alias `afrows-def-mgmt`).
4. **ssh alias**: install `infra/germany-fast/61-afrows-def-mgmt.conf` as
   `/etc/ssh/ssh_config.d/61-afrows-def-mgmt.conf` (root 0644); check `ssh -G afrows-def-mgmt`.
5. **Env** (`/etc/afrows/afrows.env`, root 0600): the `AFROWS_DEF_DIRECT_*` printed by install.sh,
   plus `AFROWS_DEF_MGMT_ENABLED=true`, `AFROWS_DEF_MGMT_SSH=afrows-def-mgmt`,
   `AFROWS_DEF_MGMT_KEY=/etc/afrows/def_mgmt_key`. See `.env.example` for the full key list.
6. **Verify** the channel as the backend user, then restart the backend:
   ```bash
   sudo -u afrows env SHELL=/bin/sh ssh afrows-def-mgmt read-usage   # -> {"updated_at":...,"users":{...}}
   sudo -u afrows env SHELL=/bin/sh ssh afrows-def-mgmt id           # -> denied
   systemctl restart afrows-backend
   ```

### Afrows backend rollback
```bash
sed -i '/^AFROWS_DEF_\(DIRECT\|MGMT\|USAGE\)_/d' /etc/afrows/afrows.env
rm -f /etc/ssh/ssh_config.d/61-afrows-def-mgmt.conf
# optional: rm -f /etc/afrows/def_mgmt_key* /etc/afrows/def_mgmt_known_hosts
systemctl restart afrows-backend   # the link disappears from subscriptions; metering stops
```
