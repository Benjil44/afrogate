# Server Hardening — Tiers 2–5 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans / subagent-driven-development to work this task-by-task. Steps use checkbox (`- [ ]`) syntax. Much of this is **VPS ops** (SSH, xray/sing-box config, systemd) + some backend/app code. Several tasks are **gated on resources the operator must provide** (a relay VPS, a Cloudflare domain, a second VPS) — those are marked **[NEEDS: …]**.

**Goal:** Take Afrows from "works, but egress rides on 2 flaky third-party relays and a single filterable VPS" to **smart, multi-exit, redundant, observable** infrastructure with fantastic stability for customers.

**Context / current state (2026-06-17):**
- Single VPS in Iran (`94.74.145.199`) runs everything: backend + Postgres + `afrows-xray` (user inbounds: VLESS-WS, VLESS-TCP, WG) + `afrows-wg` (WG tproxy egress) + `xray.service` (the foreign-egress uplink) + nginx.
- **Egress** = `xray.service` socks:10808 → a **balancer+observatory pool** (`relay-N` outbounds) → foreign. Pool auto-refreshed by `afrows-uplink-pool-sync.py` from the `outbounds` DB (selects relays passing a real speed test). **Only ~2 working relays**, same AZ provider → thin/flaky. Pool-sync warns when <3.
- **Egress mode** = global `smart`/`full` via `egress_settings` + `afrows-egress-mode-sync.py`. `geoip:ir → direct` split + DoH-over-tunnel are live.
- **Inbound** = the raw VPS IP behind nginx (DPI-filtered intermittently); no CDN. Transports: VLESS-WS, VLESS-TCP, WG only.
- **Tier 1 done** (BBR/fq/MTU-probing/TFO/buffers + 15s failover probe + thin-pool warning). **Relay bootstrap built**: `scripts/afrows-relay-bootstrap.sh` (VLESS+Reality egress).
- The backend **`route-preference`** subsystem (auto/country/outbound, migration 0016) is **stored but NOT enforced** — nothing in provisioning/reconcile consumes it. Enforcing it is T2.3.

**Tech stack:** xray-core (Reality, routing, balancer/observatory), **sing-box** (for Hysteria2/TUIC), PostgreSQL, NestJS, Flutter, Cloudflare (fronting), deSEC (DNS), systemd reconcilers, Telegram bot (alerts).

---

## File / component map (what each task touches)

- **Relay box:** `scripts/afrows-relay-bootstrap.sh` (done — Reality), + a future `afrows-relay-hysteria.sh` (Hysteria2/TUIC).
- **Egress uplink:** `/usr/local/etc/xray/config.json` (ops) + `scripts/afrows-uplink-pool-sync.py`. For Hysteria2 uplink: a sing-box outbound (new `xray.service` companion or replacement).
- **Per-client routing:** `afrows-wg`/`afrows-xray` routing + the WG reconciler (`scripts/afrows-wg-reconcile.sh`) + `client_route_preferences` table + backend `billing.service` (wire preference → desired routing).
- **Inbound diversity:** `/usr/local/etc/afrows-xray/config.json` (Reality/gRPC inbounds) + sing-box (Hysteria2 inbound) + nginx + Cloudflare.
- **Subscription:** `apps/backend/src/billing` subscription builder + `apps/native-client` (entry selection) + dashboard.
- **Redundancy:** second VPS provisioning + `update-afrows.sh` + deSEC API.
- **Observability:** backend metrics endpoints + dashboard + Telegram bot + a multi-vantage probe.

---

## TIER 2 — Smart, multi-exit egress

### Task 2.1 — Fold a dedicated relay into the pool  **[NEEDS: a relay VPS]**
**Files:** `scripts/afrows-relay-bootstrap.sh` (done); DB insert into `outbounds`.
- [ ] Operator provisions a small VPS outside Iran, reachable from Iran (TR/UAE/AM/NL), clean IP, Ubuntu/Debian; gives root SSH.
- [ ] Run `afrows-relay-bootstrap.sh` on it → capture emitted params (address/port/uuid/publicKey/shortId/SNI).
- [ ] Insert it as an `outbounds` row (type `vless-local-proxy`, matching `route_group`, `config` jsonb = `{address,port,uuid,security:"reality",publicKey,shortId,serverName,fingerprint:"chrome",network:"tcp"}`) — via the dashboard **Outbounds → Add** or psql.
- [ ] Trigger a speed test (`update outbounds set speed_test_requested_at=now() where …`); confirm `latest_down_mbps` ≥ 3.
- [ ] Confirm `afrows-uplink-pool-sync.py` adds it as `relay-N`; verify failover: stop the AZ relays' selection (or just confirm) and check `curl -x socks5h://127.0.0.1:10808 https://icanhazip.com` exits via the new relay. Thin-pool warning clears.

### Task 2.2 — Hysteria2/TUIC for lossy-link stability  **[NEEDS: relay from 2.1]**
> xray can't speak Hysteria2/TUIC; use **sing-box**. Two layers, do A first.
**Files:** `scripts/afrows-relay-hysteria.sh` (new), a sing-box service on the relay + on Afrows (uplink), `apps/native-client` (optional client support).
- [ ] **A — uplink hop (Afrows → relay over Hysteria2):** install sing-box on the relay with a **Hysteria2 inbound** (UDP, obfs/password, self-signed or Reality-style); install sing-box on the Afrows VPS exposing a local socks that dials the relay's Hysteria2; add that socks as another pool member (a `relay-hy` outbound) so the balancer can prefer it on lossy days. Verify throughput/stability vs the TCP-Reality relay.
- [ ] **B — user hop (clients → Afrows over Hysteria2):** add a Hysteria2 **inbound** on the Afrows VPS (sing-box) → route into the same egress; deliver a `hysteria2://` link in the subscription for sing-box/v2rayNG-NG clients (the WG app stays WG). Document in dashboard.
- [ ] Tune Hysteria2 bandwidth caps to the relay's real up/down (Hysteria2 needs accurate bw hints).

### Task 2.3 — Enforce per-client routing (make `route-preference` real)  **[NEEDS: ≥2 distinct exits]**
**Files:** `scripts/afrows-wg-reconcile.sh` (or a sibling), `afrows-wg`/`afrows-xray` routing, `apps/backend/src/billing/billing.service.ts`, `apps/native-client` (route picker UI).
- [ ] Add per-exit outbounds in the egress config: one `proxy-<exitkey>` per selectable exit (country/relay), each routing to that exit (or its own mini-balancer of relays in that country).
- [ ] Reconciler reads `client_route_preferences` joined to each config's **WG tunnel IP** (`wireguard_peers.address`); generates xray routing rules `{ source:[<tunnel ip/32>], outboundTag:"proxy-<chosen>" }` placed before the default; `xray -test` + reload (idempotent, only on change). Default (auto) → the balancer.
- [ ] Backend: nothing new to store (preference table exists); ensure `upsertClientOwnedRoutePreference` triggers the reconciler.
- [ ] App: surface `GET /client/route-options` (countries/outbounds) + a picker that PATCHes `/client/route-preference`. Verify: changing country actually changes the client's exit IP.
- [ ] Sticky sessions: keep an established connection on its chosen exit (don't flap mid-session) — rely on conntrack + don't rebuild routing for active marks.

### Task 2.4 — Category routing (streaming/gaming profiles)
**Files:** `afrows-wg`/`afrows-xray` routing.
- [ ] Add `domain:[geosite:netflix,youtube,…]` / gaming geosite rules → lowest-latency exit; keep `geoip:ir → direct`. Optional per-profile (gaming = lowest jitter exit). Verify a streaming domain takes the intended exit.

---

## TIER 3 — Inbound resilience (users can always reach Afrows)

### Task 3.1 — Reality inbound on Afrows (block-resistant, no cert)
**Files:** `/usr/local/etc/afrows-xray/config.json` (new inbound), subscription builder.
- [ ] Add a VLESS+**Reality** inbound on a fresh port (dest = a real TLS1.3 site), generate keys; route it like the other user inbounds.
- [ ] Include the `vless+reality` link in `/client/subscription`; show in dashboard. Verify a known-good client connects from a filtered network.

### Task 3.2 — CDN-front the inbound (Cloudflare + WS/gRPC + ECH)  **[NEEDS: a domain on Cloudflare]**
**Files:** Cloudflare DNS/proxy, nginx/xray WS or gRPC inbound, subscription builder.
- [ ] Add a domain (or subdomain) to **Cloudflare free**, orange-cloud → origin = Afrows VPS; expose VLESS+**WS**(or gRPC)+TLS on a CF-supported port (443/2053/…); enable **ECH**.
- [ ] Add the CF-fronted entry to the subscription so users hit the **reachable CF edge** instead of the filterable VPS IP. Verify reachability from multiple Iran networks.

### Task 3.3 — Entry diversity + auto-updating subscription
**Files:** backend subscription builder, `outbounds`/inbound health, `apps/native-client`.
- [ ] Track per-**inbound** health (probe/last-seen); the subscription returns only currently-healthy entries (Reality, WS, CF, Hysteria2), multiple ports/domains.
- [ ] App refreshes the subscription periodically and re-picks a healthy entry on connect failure. Verify auto-recovery when one entry is blocked.

---

## TIER 4 — Redundancy (kill the single point of failure)  **[NEEDS: a second VPS]**

### Task 4.1 — Second VPS (different ASN/datacenter)
**Files:** `update-afrows.sh` (already idempotent), env, deSEC.
- [ ] Decide topology: **(a)** second box = inbound edge + its own egress pool, proxying the API/DB to the primary; or **(b)** full replica with Postgres streaming replication + read-only failover. Start with (a) (simpler): second box runs `afrows-xray` inbounds + `xray.service` egress pool, forwarding client traffic; customer DB stays on the primary (the second box's xray needs no DB).
- [ ] Provision; run the deploy; point a second set of entries/domains at it; add its relays to a shared pool view.

### Task 4.2 — DNS health-checked failover (deSEC)
**Files:** a monitor script + deSEC API token (secret, on-box).
- [ ] Multiple A records (primary + secondary) and/or a watcher that swaps `afrows.com`/entry records when a box fails reachability probes. Short TTL.

### Task 4.3 — Backups + reproducibility
**Files:** `scripts/afrows-backup.sh` (new) + cron; document/commit on-box ops configs.
- [ ] Nightly `pg_dump` (gzip, retained N days) + copy off-box (to the relay or Germany box). Test a restore.
- [ ] Capture the on-box-only ops bits (the gitignored `update-afrows.sh`, `/etc` service/nginx configs) into a documented bootstrap so a box is reproducible from the repo + secrets.

---

## TIER 5 — Observability & automation (self-managing)

### Task 5.1 — Metrics (relay + client)
**Files:** backend (`operations-overview`/a metrics service), dashboard.
- [ ] Persist per-relay history (latency/jitter/down/up from observatory + speed test) and per-client active/usage; chart on the Operations page (which exits are healthy, throughput, drops).

### Task 5.2 — Alerting (Telegram)
**Files:** the existing Telegram bot stack + a watcher.
- [ ] Alerts on: foreign egress down (curl via 10808 fails), **pool < 3 healthy** (the warning already logs — wire it to Telegram), inbound filtered (nginx HTTPS gap detection), relay flap, backend/service down, disk/cert expiry.

### Task 5.3 — Multi-vantage reachability probes
**Files:** a small probe (run on the operator's home/Starlink + other Iran networks) reporting to the backend.
- [ ] Periodically test each inbound entry from several Iran ISP vantages (filtering is per-network); surface a per-network reachability matrix so dead-from-some-networks entries are demoted in the subscription.

---

## Sequencing (recommended)
1. **T2.1** (relay into pool) — unblocks everything; clears the thin-pool warning. *(needs VPS)*
2. **T2.3** (enforce smart per-client routing) + **T2.4** (categories) — the "smart routing" the operator asked for.
3. **T3.1 + T3.2** (Reality + CF-front inbound) — fixes "can't connect" reachability. *(CF needs a domain)*
4. **T2.2** (Hysteria2/TUIC) — peak stability on lossy mobile.
5. **T4** (second VPS + DNS failover + backups) — durability.
6. **T5** (metrics + alerting + multi-vantage) — make it self-managing.

## Risks / notes
- **Don't touch the Germany hexogate panel/bot** (other services depend on it) — read-only.
- Relays/inbounds with **Reality** need a real, stable masquerade target (TLS1.3+h2); rotate if the target degrades.
- Hysteria2 needs **accurate bandwidth hints**; wrong values hurt more than help.
- Per-client routing rewrites + restarts briefly drop active sessions — batch changes; prefer source-IP marks over per-user restarts.
- Everything new gets **BBR** (run `scripts/afrows-net-tune.sh`) and joins the **pool-sync**/observatory so it's health-managed, not hardcoded.
