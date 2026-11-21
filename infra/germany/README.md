# Germany edge agent install kit

Keeps the Germany xray VLESS allow-list in sync with the backend, durably.

## Why

Customers are entitled to Germany in the backend (`client_configs.entry_uuid`,
`access_germany`). Historically they were pushed to the Germany box via the
backend's SSH mgmt channel (`afrows-de-mgmt-cmd`, runtime `xray api adu`). That
path is **runtime-only** (a reboot wipes it) and depends on the direct/village
route, which the Germany/Hexogate box firewalls off from the backend
(`:22 connection refused`). On 2026-11-14 a reboot dropped every post-Oct-5
customer ("connects, zero internet") because the only thing left was a stale
hand-edited `config.json`.

## Fix

Run the **edge agent** (`scripts/afrows-de-edge-agent.py`) on the Germany box. It:

- pulls `GET /api/edge/de/clients` from the backend **over Cloudflare**
  (`https://app.afrows.com`), which works even when the direct route is filtered;
- reconciles the local `afrows-de-ws` **and** `afrows-de-xhttp` inbounds
  (`xray api adu`/`rmu`), touching only `cc_<id>@afrows` customer users and
  **preserving** every other client (e.g. `afrows-chain@afrows`);
- **mirrors the set into `config.json`** atomically, so a reboot/restart keeps
  everyone;
- pushes per-customer usage deltas to `POST /api/edge/de/usage`.

Self-heals within one interval (~60s) after any reboot or customer change.

## Install (on the Germany box, as root)

```bash
bash infra/germany/install.sh
# then set the token (same value as the backend's AFROWS_EDGE_TOKEN):
#   edit /etc/afrows/afrows-de-agent.env
systemctl restart afrows-de-edge-agent
journalctl -u afrows-de-edge-agent -f
```

Afrows-scoped only: installs `/usr/local/bin/afrows-de-edge-agent.py`,
`/etc/systemd/system/afrows-de-edge-agent.service`, and
`/etc/afrows/afrows-de-agent.env`. It does **not** touch any Hexogate service,
container, port, firewall, or file.

## Backend side

Already live: `AFROWS_EDGE_TOKEN` is set in the backend env and the
`EdgeController` (`/api/edge/de/*`, `EdgeTokenGuard`) serves the entitled set.
No backend change is needed; the agent reuses that token.
