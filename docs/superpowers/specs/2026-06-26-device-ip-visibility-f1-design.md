# Device / IP visibility — F1 — design

**Date:** 2026-06-26
**Status:** Approved (brainstorm) → ready for implementation plan
**Part of:** the customer-control thread. F1 = **visibility only** (see who's sharing). F2 (auto-limit over device cap) is a later, separate sub-project.

## Problem

A VLESS account is just a UUID; multiple people can share one. The operator needs to **see**, per customer, how many devices are active and from which **source IPs**, to spot sharing. Today nothing surfaces this.

## Hard technical limits (decided in brainstorm)

- VLESS is a proxy: only **source IP** + **UUID** are knowable. **Device name / model / MAC are impossible** for third-party clients (MAC never leaves the LAN). Only the Afrows app could self-report device info — out of scope for F1.
- **The main VLESS-WS path hides the real IP**: `afrows-in` is behind nginx (→127.0.0.1:8447), so xray's access log shows `from 127.0.0.1`. Real client IPs require **PROXY protocol** between nginx and xray. (VLESS direct-TCP `afrows-in-tcp:8080` and WireGuard already expose real IPs.)

## Goal (F1)

Per customer: **active device count** (≈ distinct source IPs in a rolling window) + the **IP list** (raw IP + last-seen + hit count), surfaced in the customer detail view. **No enforcement.** Honest UI caveat: IPs ≈ devices (mobile/CGNAT rotates IPs).

Decisions baked in: raw IP only (no external geo lookups — VPS is on a filtered network); active window = **10 min**; retention = **7 days**.

## Design (phased for safe execution)

### F1.0 — logrotate (safe; do first)
`access.log` is 93 MB and `error.log` 314 MB with no rotation. Add `/etc/logrotate.d/afrows-xray` (daily, rotate 7, compress, **copytruncate** so xray keeps writing the same path). This also bounds what the parser reads and defines rotation behaviour the parser must tolerate. No service restart.

### F1.1 — PROXY protocol nginx ↔ xray (the risky infra step)
Make xray see the real client IP on the WS path:
- nginx `location /afrowsws`: add `proxy_protocol on;` on the upstream connection to `127.0.0.1:8447`.
- xray `afrows-in` inbound: set `streamSettings.sockopt.acceptProxyProtocol: true` (verify exact field for xray 26.3.x at build time).
- **They must change together** — a mismatch drops every VLESS-WS connection.

**Mandatory test-and-revert procedure (in the plan):**
1. Back up `/etc/nginx/sites-enabled/afrows` and `/usr/local/etc/afrows-xray/config.json`.
2. Apply both changes; `nginx -t`; reload nginx + restart afrows-xray.
3. **Immediately** validate a real WS connection through 443 (temp xray client → `app.afrows.com:443` TLS+WS+a known UUID → curl google `204`) AND confirm the access log now shows a **real** client IP (not 127.0.0.1).
4. If validation fails → **restore both backups, reload/restart, confirm WS works** before doing anything else.

### F1.2 — sightings table + parser service
- **Migration 0047** `client_device_sightings`: `(id, client_config_id fk, source_ip inet/text, first_seen_at, last_seen_at, hits int)`, unique `(client_config_id, source_ip)`; index on `last_seen_at` for pruning.
- **New backend service** `xray-access-log.service.ts` (mirrors the metering services; gated by a flag, no-op in dev):
  - Tail `access.log` from a tracked byte offset; on size-shrink (rotation/copytruncate) reset offset to 0.
  - Parse lines matching `from <ip>:<port> accepted .* email: cc_<configId>@afrows`; **skip `127.0.0.1`/`::1`** (pre-F1.1 noise + internal).
  - Batch **upsert** into `client_device_sightings` (`last_seen_at=now()`, `hits=hits+1`) every tick.
  - Prune `last_seen_at < now() - 7 days` periodically.
- **WireGuard coverage (included if cheap):** also record peer endpoint IPs (the wg reconcile already reads `wg show wg0 dump`, which has `endpoint`) into the same table, keyed by the peer's client_config. If it complicates F1, defer WG to a follow-up — VLESS via the access log is the F1 core.

### F1.3 — API + dashboard
- **API:** per customer (or per client-config), return device sightings: active = `last_seen_at` within 10 min, plus the full list (ip, last_seen, hits). Extend the customer detail endpoint or add `GET /admin/customer-accounts/:id/devices`.
- **Dashboard:** in the customer **detail/edit** view (next to the D1 gateway/Exit sections), a "Devices" section: active count + a table of IP · last-seen · hits. Optionally a small "N devices" indicator on the Connections page. Caveat text: "IP ≈ device; mobile networks rotate IPs."

## Non-goals
- Enforcement / auto-limit → **F2** (uses the existing `deviceLimit`).
- Device name/model/MAC (impossible over VLESS; Afrows-app self-report is a separate idea).
- Geo/ISP enrichment (no external calls on the filtered network).

## Testing
- **Unit (`node --test`):** the access-log line parser (pure fn): extracts `{configId, ip}` from a real line; ignores 127.0.0.1/::1 and non-matching lines; handles the timestamped format.
- **Gates:** backend build + tests; dashboard `tsc` + build.
- **Manual:** after F1.1, a customer browsing shows a real IP in their Devices list; a customer on two devices shows two IPs; counts age out after 10 min; rotation doesn't double-count or stall the parser.

## Rollout
F1.0 + F1.1 are box/infra changes (logrotate is safe; PROXY protocol is the risk, gated by the test-and-revert). F1.2/F1.3 ship via the normal deploy (migration 0047 runs idempotently). Reversible: disable the parser flag + revert the proxy-protocol pair.
