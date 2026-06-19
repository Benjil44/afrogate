# Village CPE modems (Brovi/Huawei LTE) — inventory & access

> The Irancell/Mobinnet WANs on the village MikroTik are external **Brovi (Huawei)**
> LTE CPEs. This documents each unit, its village IP, role, and how to reach/manage it.
> **Secrets (admin + Wi-Fi passwords) are NOT in this repo** — they're on each unit's
> physical label (photographed) and in the operator's secure store. Shown here as `<label>`.

## Units

| MikroTik port | Brand/Model | Village IP | Factory IP (label) | Admin login | Role |
|---|---|---|---|---|---|
| ether1 (mobinnet) | Brovi **H155-381** | `192.168.8.1` | 192.168.8.1 (kept) | `admin` / `<label>` | wg-afrows transport **BACKUP** (dist 2) |
| ether2 (irancell-228) | Brovi **H155-381** | `192.168.9.1` | 192.168.8.1 (changed) | `admin` / `<label>` | wg-afrows transport **PRIMARY** (dist 1) + netwatch failover |
| ether5 (irancell-227 "Pro") | Brovi **H158-381** | `192.168.12.1` | 192.168.70.1 (changed) | `user` / `<label>` | wg-afrows transport **BACKUP-2** (dist 3) |

(ether3 = free port for physical diagnosis. ether4 = Starlink dish — not a CPE.)

### Hardware IDs (for warranty/support/inventory)
- **ether1 mobinnet** — IMEI `866815071…00335`, S/N `6MQ7S24118000078`, Wi-Fi SSID `H155-381_B7B7` (+`_5G`).
- **ether2 irancell-228** — IMEI `866815071139251`, S/N `6MQ7S24116002966`, Wi-Fi SSID `H155-381_8FEB` (+`_5G`).
- **ether5 irancell-227** — IMEI `867173066275139`, S/N `KCS7S25228002961`, MAC `10E84098CA45`, Wi-Fi SSID `H158-381_CA45` (+`_5G`).

> **IMPORTANT — admin login = the Wi-Fi password.** The friend set each modem's web-admin
> password to that unit's **Wi-Fi password** (the `Wi-Fi Password` on the label), NOT the printed
> `Password:` field (which is stale/changed). Confirmed on 228 (`192.168.9.1`, `admin` / its Wi-Fi
> pass). H155 logs in as `admin`; H158 ("Pro", 227) as `user`. The default LAN IPs on the labels
> are also stale — the village units were re-IP'd (228→.9.1, 227→.12.1).
>
> One-click panel reboot via the Huawei API was NOT pursued: rotating `__RequestVerificationToken`
> + reversed-SCRAM + a lockout counter, on the live primary transport, is too fragile/risky. Use the
> web UI (below) for reboot/config, or a smart plug on the modem power for effortless remote reboot.

## How to reach them

**On the village LAN** (e.g., plugged into ether3): open `http://192.168.8.1`, `http://192.168.9.1`, `http://192.168.12.1`.

**Remotely from anywhere** — SSH-tunnel through Afrows (which reaches the CPEs over `wg-village`):
```
ssh -i ~/.ssh/afrogate_deploy \
  -L 9128:192.168.8.1:80 -L 9129:192.168.9.1:80 -L 9132:192.168.12.1:80 \
  root@94.74.145.199
```
then browse `http://localhost:9128` (mobinnet), `:9129` (irancell-228), `:9132` (irancell-227).
The modem web UI has the **Restart/Reboot** button (a real power-cycle, unlike the panel's
"Reconnect" which only renews DHCP).

Afrows→CPE path (already in place): kernel routes `192.168.9.0/24` + `192.168.12.0/24` dev `wg-village`
+ village srcnat masquerade `out=ether2/ether5 src=10.20.0.1`. (mobinnet `192.168.8.0/24` is NOT
routed from Afrows yet — add a route + masquerade if remote mobinnet access is needed.)

## Huawei API (for a future one-click reboot / status in the panel)

Brovi/Huawei HiLink API over HTTP, SCRAM auth (no-login endpoints now return `125002` = needs session):
- `GET /api/webserver/SesTokInfo` → SessionID cookie + RequestVerificationToken.
- `POST /api/user/challenge_login` (username, firstnonce, mode=1) → salt, servernonce, iterations.
- `POST /api/user/authentication_login` (clientproof, finalnonce). **Huawei's SCRAM HMAC uses
  key=`"Client Key"` / msg=saltedPassword and key=authMsg / msg=storedKey** (reversed vs textbook SCRAM —
  this is the likely cause of the `108006` in the first test; verify the password before retrying,
  and beware the lockout counter `remaincount`).
- `POST /api/device/control` body `<request><Control>1</Control></request>` → reboot.
- Status (after login): `/api/monitoring/status`, `/api/monitoring/traffic-statistics`, `/api/net/current-plmn`, `/api/device/signal`.
- H158 ("Pro", 227) 307-redirects API calls to a hostname (different firmware) — needs its own handling.

## Notes
- A real reboot fixes a "SIM data session died" state (link up but no internet) that DHCP-renew can't.
- Rebooting the **PRIMARY** (irancell-228) drops the active `wg-afrows` tunnel until it fails over —
  prefer rebooting a backup, or expect a brief outage + auto-failover.
