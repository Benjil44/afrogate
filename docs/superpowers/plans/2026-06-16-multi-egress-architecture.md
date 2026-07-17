# Multi-Egress Architecture — Design & Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans / subagent-driven-development to implement task-by-task. Steps use checkbox (`- [ ]`) syntax. Most of Phase 0–2 is **VPS ops** (SSH, xray config) + backend; Phase 3 is the Flutter app; Phase 4 (Starlink) is future hardware-dependent.

**Goal:** Replace the single, fragile foreign-egress hop with **multiple independent egress paths + automatic failover + a user-facing mode toggle**, so foreign access survives any one path dying and can use better paths (Starlink) when available.

**Architecture:** The Afrows VPS sits *inside Ireland* and **cannot reach foreign IPs directly** (Ireland filtering — verified: a direct `curl` to any foreign host returns nothing). Today **all** foreign traffic (VLESS app users + WireGuard home gateway + mobile) funnels through **one** uplink: `xray.service` (`socks 127.0.0.1:10808`) → a single hardcoded VLESS relay (`46.245.95.155:11278`) → Germany exit (`162.19.253.235`). When that relay/upstream dies — which has happened repeatedly (2026-06-06, -12, -16) — **everything loses foreign access at once, with no fallback**. This plan turns that single hop into a **health-checked pool with auto-failover**, adds **direct (domestic) split-routing**, a **selectable "filtering bypass" mode in the app**, and a **future Starlink egress**.

**Tech Stack:** xray-core (outbound `balancer` + `observatory` health checks), the existing `outbounds` DB table + subscription importer, NestJS backend, Flutter app, (future) a Starlink-homed relay node.

---

## Why `127.0.0.1:10808` exists (the thing we're fixing)

`xray.service` on the VPS runs as a **client** that dials a foreign VLESS relay and exposes a local `socks 10808` / `http 10809`. Because Ireland blocks the VPS's direct foreign access, **this proxy is the only door to the global internet**. Both `afrows-xray` (VLESS users) and `afrows-wg` (WireGuard tproxy egress, `:12345`) route their `proxy` outbound into `socks 10808`. So `10808` is literally the "Ireland is filtering the foreign internet" path — and right now it's the *only* one. See [[outbounds-and-box-uplink]].

---

## Current break (2026-06-16, diagnosed, NOT yet fixed — by request)

- WG tunnel MikroTik→VPS is healthy (fresh handshake, GBs through it). Germany box `162.19.253.235` is healthy (panel + caddy up, own egress works).
- The break is the **VPS→relay handshake**: relay `46.245.95.155:11278` is reachable (TCP open, 14 ms) but **returns no data**. Probe shows the relay now answers plain HTTP with `400` and **speaks TLS with a valid cert** → it expects **VLESS+TLS/Reality**, while the Afrows uplink config is `security:none` + HTTP-camo (`Host: telewebion.ir`). Config is stale/mismatched for that relay.
- **Quick restore (if needed before this plan lands):** repoint `/usr/local/etc/xray/config.json` to a *currently working* outbound from the `outbounds` DB table (same procedure as 2026-06-12), `xray -test`, `systemctl restart xray`, verify `curl -x socks5h://127.0.0.1:10808 https://icanhazip.com` exits Germany. That is the band-aid; the plan below is the durable fix.

---

## Egress paths (target state)

| Path | Route | Used for |
|---|---|---|
| **direct** (freedom) | VPS local Ireland internet | Irelandian/domestic destinations — fast, no foreign hop |
| **germany-pool** | VPS → *health-checked pool of relays* → Germany exit | Foreign/blocked destinations (the "bypass" path), auto-failover across relays |
| **starlink** (future) | Egress via a Starlink-connected node (unfiltered) | Best foreign path; survives even a national foreign-internet shutdown |

App **mode toggle** ("Filtering bypass"):
- **OFF (split)** → Irelandian traffic goes `direct` (fast); only blocked/foreign goes through the pool.
- **ON (full bypass)** → everything foreign-routed through germany-pool / starlink (for heavy filtering days / national throttling).

---

## Phase 0 — Make the foreign egress self-healing (VPS) — HIGHEST VALUE

> Outcome: the single hardcoded relay becomes a **pool with automatic failover**, so one dead relay no longer takes down all foreign access. This is the fix that ends the recurring "uplink died again" outages.
>
> **STATUS 2026-06-16: Task 0.1 + 0.2 DONE (live).** Inventory (via the box speed-test) found the configured relay `46.245.95.155` dead; only the 3 **Azerbaijan VIP-TUN Reality** relays passed real download (`185.252.28.28`/`185.252.28.17` ~26–28 Mbps, `185.126.9.185` intermittent — all `:5051`, same Reality params: SNI `digg.com`, fp `firefox`, one shared uuid/pubkey/shortId). Repointed + then built the balancer pool in `/usr/local/etc/xray/config.json` (backup `config.json.bak-<ts>`). **Egress restored — exit is now `92.223.62.134` (Azerbaijan), not Germany** (functionally equivalent: unfiltered foreign). Task 0.3 (dynamic pool refresh) still TODO.

### Task 0.1: Inventory live relays — DONE
**Files:** none (read-only ops).
- [x] Used the on-box **speed-test engine** (set `outbounds.speed_test_requested_at=now()` for all, backend curls Cloudflare *through* each proxy → real foreign-egress + Mbps). 22 relays; only the 3 AZ Reality relays pass download. Key lesson: `health_status='healthy'` only means TCP-reachable — the **download-Mbps** column is the real egress proof (`46.245.95.155` showed "healthy" but 0 down).

### Task 0.2: xray balancer + observatory on the uplink — DONE
**Files:** Modified `/usr/local/etc/xray/config.json` (ops-only, gitignored; backup `config.json.bak-<ts>`).
- [x] Defined `relay-1/2/3` (the 3 AZ Reality relays) + `direct`/`block`.
- [x] `observatory` `{subjectSelector:["relay-"], probeURL: cloudflare trace, probeInterval:"30s"}`.
- [x] `balancer` `relay-balancer` (`strategy: leastPing`, selector `["relay-"]`); routing rule `inboundTag:[socks-in,http-in] → balancerTag:relay-balancer`.
- [x] `xray run -test -config <file>.json` (NOTE: xray infers format from extension — test file MUST end `.json`), restart, verified egress stable across hits, no errors. afrows-wg/afrows-xray/afrows-backend all active.

### Task 0.3: Keep the relay pool fresh — DONE (2026-06-17)
**Files:** `scripts/afrows-uplink-pool-sync.py`, `scripts/systemd/afrows-uplink-pool-sync.{service,timer}` (in repo); installed to `/usr/local/bin/` + `/etc/systemd/system/` on the box.
- [x] Reconciler reads relays from `outbounds` that **recently passed a real speed test** (`latest_down_mbps >= POOL_MIN_MBPS=3` AND `last_speed_test_at` within `POOL_MAX_AGE_MIN=90`, top `POOL_MAX_RELAYS=5`), renders each to a vless outbound (handles reality / tls / none × tcp/ws/xhttp/http-header), and rebuilds the `relay-N` block in `config.json` — preserving observatory + balancer + inbounds. **Idempotent** (compares relay identity set; no-op when unchanged — verified). **HARD SAFETY:** if 0 working relays found, leaves the pool untouched (never empties egress). `xray -test` (proper `.json` temp) before applying; backup `config.json.bak-<ts>`.
- [x] Enabled **auto speed-testing** (`outbound_test_settings.auto_enabled=true, interval_seconds=900`) so the reconciler always has fresh health data.
- [x] `afrows-uplink-pool-sync.timer` enabled (OnUnitActiveSec=10min). First run rebuilt the pool to the 2 proven relays (`185.252.28.28`, `185.252.28.17`), dropping the intermittent `.185` (0 down). Egress stable (AZ), second run = no-op.

> **Phase 0 fully complete (0.1–0.3).** Foreign egress is now self-healing end to end: health auto-measured every 15 min, pool auto-rebuilt every 10 min to only proven-working relays, observatory+balancer failover within the pool, and a hard guard against emptying egress.

---

## Phase 1 — Direct (domestic) split-routing on the VPS + DNS-over-tunnel — DONE (2026-06-17)

> Outcome: Irelandian destinations skip the foreign hop (faster, survive a foreign outage), and VPN clients get clean (un-poisoned) DNS.

### Task 1.1: geoip/geosite split in the egress xray — DONE
**Files:** Modified `/usr/local/etc/afrows-wg/config.json` + `/usr/local/etc/afrows-xray/config.json` routing (backups `*.bak-<ts>`).
- [x] `geoip.dat`/`geosite.dat` already on box (`/usr/local/share/xray/`). Set `domainStrategy:"IPIfNonMatch"` and routing rules (ordered, before the catch-all): `ip:[geoip:private,geoip:ir] → direct`, `domain:[geosite:category-ir] → direct`, then `inboundTag client-inbounds → proxy` (the balancer pool). Sniffing already on (http/tls/quic) so domain rules work. `xray -test` OK, both services restarted active, foreign egress still exits AZ.

### Task 1.2: DNS-over-tunnel — DONE (verified)
**Files:** MikroTik `/ip/dns` (was already set, now effective since WG is primary).
- [x] `use-doh-server=https://1.1.1.1/dns-query` (IP literal → no bootstrap DNS), `verify-doh-cert=false`. DoH rides the WG default route → AZ → Cloudflare = clean/encrypted; `servers=192.168.254.1,8.8.8.8` are fallback only (used if the tunnel is down). **Verified:** youtube/instagram/twitter resolve to REAL IPs (142.250.75.142 / 157.240.234.174 / 151.101.2.146), NOT the `10.10.34.36` Ireland sinkhole. (Test trick: `/ping <blocked-host>` resolves via DoH even though ICMP can't traverse egress.)

---

## Phase 2 — "Filtering bypass" mode (backend + selection) — DECISION: Option A (global smart/full)

> Chosen approach (2026-06-17): a **global** Smart/Full mode (small + real), NOT per-client.
> Per-client enforced exits (Option B, wiring the existing but stored-only route-preference
> subsystem) is deferred. The existing `route-preference` API is stored-but-NOT-enforced
> (nothing in provisioning/reconcile consumes `preferredOutboundId`) — don't rely on it for routing.

### Task 2.1: Egress-mode setting — Slice 1 (engine) DONE; Slice 2 (backend/app) TODO (deploy-gated)
**Files:** `infra/postgres/migrations/0035_egress_mode.sql`, `scripts/afrows-egress-mode-sync.py`, `scripts/systemd/afrows-egress-mode-sync.{service,timer}`.
- [x] **Slice 1 (engine, live + tested):** `egress_settings` singleton table (`mode smart|full`, default smart). Reconciler `afrows-egress-mode-sync.py` reads it and rewrites `afrows-wg` + `afrows-xray` routing: smart = `geoip:ir/private + geosite:category-ir → direct`, rest → proxy pool; full = all client inbounds → proxy. Preserves the client inbound-tag set from each config. Idempotent + `xray -test` guard + backup. systemd timer every 1min (installed, active). Verified smart⇄full flip works on box. (Table created on box owned by `afrows_migrator`, granted to `afrows_app`; real deploy creates it via migrate + least-privilege grants.)
- [x] **Slice 2 (backend + app, BUILT — needs deploy to go live):** `GET`/`PATCH /client/egress-mode` (`billing.service` getEgressMode/setEgressMode reading/writing `egress_settings`; `setEgressMode` calls `triggerEgressModeSync()` = `sudo systemctl start afrows-egress-mode-sync.service` for instant apply, timer is fallback; sudoers `scripts/systemd/afrows-egress-mode-sync.sudoers`). Shared `EgressMode`/`EGRESS_MODES`/`ClientEgressModeResponse`. DTO `SetEgressModeDto`. Flutter: `api.dart` fetch/setEgressMode + a `_BypassToggle` switch in `connect_screen` (account mode), app `v2.3.0`. `update-afrows.sh` `[5c]` installs the pool-sync + egress-mode reconcilers + sudoers on deploy. Backend `nest build` clean; `flutter analyze` clean. NOTE: **global** switch (any client flips everyone) — acceptable for the operator's use; gate PATCH to admin when going multi-tenant.

## Phase 3 — App toggle (Flutter) — DONE (built, ships with Slice 2)
- [x] `_BypassToggle` in `connect_screen.dart` (Smart ⇄ Full), loads current mode on login, PATCHes on change, snackbar on failure. Goes live when the app is rebuilt + the backend is deployed.

### Task 2.2: Egress health on the dashboard
**Files:** `apps/dashboard/...`, backend overview service.
- [ ] Surface per-relay health (from observatory) + active egress path on the Operations overview, so the operator sees which relays are alive.

---

## Phase 3 — App toggle (Flutter)

> Outcome: a user-facing "Filtering bypass" switch.

### Task 3.1: Bypass toggle in the app
**Files:** `apps/native-client/lib/connect_screen.dart`, `api.dart`.
- [ ] Add a toggle that sets the egress mode (calls the backend), with copy explaining "turn on when Ireland is filtering the global internet."
- [ ] Reflect current mode + egress health (Germany/Starlink/down) in the UI.

---

## Phase 4 — Starlink egress (FUTURE — hardware-dependent)

> Outcome: an unfiltered egress that bypasses Ireland's filtering at the physical layer; the most resilient foreign path.

**Architecture options (pick when hardware is in place):**
1. **Starlink-homed relay node** — a small box on the Starlink LAN runs a VLESS/WG inbound; the Afrows VPS adds it to the Phase-0 balancer as another `relay-N`. Needs a reachable endpoint for the VPS to dial (Starlink is CGNAT → use a Cloudflare-fronted inbound or a reverse tunnel from the Starlink node out to the VPS).
2. **Home-direct via Starlink** — the home MikroTik egresses *foreign* traffic straight out Starlink (home → Starlink → world), bypassing the VPS entirely for that site. Mirrors the existing MikroTik split-routing (`direct` table), just pointed at the Starlink WAN instead of the ONU. See [[mikrotik-split-routing]].

### Task 4.x (when hardware ready)
- [ ] Decide reverse-tunnel vs Cloudflare-fronted inbound for the Starlink node (CGNAT reachability).
- [ ] Stand up the Starlink-side inbound; add it to the balancer (Phase 0) and/or as a home WAN route (MikroTik).
- [ ] Health-check + prefer Starlink when alive (lowest filtering risk).

---

## Risks & notes
- **Relay params drift** (TLS/Reality/UUID rotate) → Task 0.3 pool-sync from the DB/panel keeps configs current; balancer drops dead tags automatically.
- **All foreign paths down** (national shutdown) → `direct` split (Phase 1) keeps Irelandian internet working; app messaging explains the bypass needs an upstream.
- **Starlink CGNAT** → can't be dialed inbound directly; needs reverse tunnel or CF-front (Phase 4).
- **Don't touch the Germany hexogate panel/bot** — other services depend on it (read-only; pull configs, don't change). See [[germany-exit-structure]].
