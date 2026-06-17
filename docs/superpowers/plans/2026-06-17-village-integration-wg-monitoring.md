# Village Integration + Unified WG Usage Monitoring — Plan

> **For agentic workers:** Use superpowers:executing-plans. Mostly VPS + MikroTik ops + backend/dashboard. The foundation (Phase 1) touches WireGuard on TWO production routers — additive/reversible, but confirm before applying.

**Goal:** Integrate the operator's **village MikroTik** (hAP ax³ — Starlink on ether4 + 3 Iran-ISP modems + 6 WG tunnels) with Afrows for: **(1)** unified per-WireGuard usage monitoring/billing (village tunnels + Afrows customers in one view), and **(2)** using the village's **Starlink as an owned, unfiltered foreign egress** for Afrows.

## Network reality (measured 2026-06-17)
| From → To | Result |
|---|---|
| Afrows VPS → village (10.9.0.2) | ✗ unreachable |
| Afrows VPS → Germany (direct + via egress proxy) | ✗ unreachable |
| Germany box → village (10.9.0.2) | ✓ HTTP 200 |
| Germany box → afrows.com API | ✗ unreachable |

→ Afrows and the village/Germany have **no usable channel today**. Everything below depends on creating one.

## Village map (read-only, via Germany box `ssh→162.19.253.235→http://10.9.0.2/rest`, user `claude`)
- WANs: ether1 Mobinnet (main), ether2/ether5 Irancell, **ether4 Starlink (192.168.1.140)**, ether3 LAN (192.168.88.1).
- WG tunnels (peer rx/tx counters available): `wg-germany`→162.19.253.235 (main exit, 0.0.0.0/0), `wg-foreign-2`→85.234.69.185 (Frankfurt), `wg-foreign-hz`→91.107.172.47 (Hetzner, idle), `wg-iran/-2/-5`→Iran nodes.
- Policy-routing tables: `main`(→wg-germany), `via-ether2`, `via-ether5`, `wg0-ether1`, `to-foreign-2`, `to-foreign-hz`.

---

## Phase 1 — Foundation: village → Afrows WG management tunnel  **(touches both routers)**
> Outcome: a stable private link so Afrows can reach the village (10.x) for monitoring + later route egress into it. Village initiates (CGNAT); Afrows accepts (public IP 94.74.145.199).
- [ ] On **Afrows**: add a WG peer for the village on a management interface (reuse `wg0`/`afrows-wg` or a dedicated `wg-village`), assign a mgmt /32 (e.g. `10.20.0.2` for the village, `10.20.0.1` Afrows), AllowedIPs = the village mgmt IP (+ its LAN if monitoring LAN). Open the WG UDP port. Generate keys.
- [ ] On **village** (REST): add a `wg-afrows` interface → Afrows `94.74.145.199:<port>`, the keypair, AllowedIPs = Afrows mgmt /32, persistent-keepalive=25 (CGNAT). Additive — don't touch existing tunnels.
- [ ] Verify: from Afrows, `curl -u claude:… http://<village-mgmt-ip>/rest/system/identity` returns 200. (Reversible: delete the peer/interface if anything regresses.)

## Phase 2 — Unified WG usage monitor (the stated pain: cost/billing)  **[depends on P1]**
> Outcome: per-tunnel + per-WAN usage over time for the village, combined with Afrows customer WG usage, in the Afrows dashboard.
- [ ] DB migration: `wg_usage_samples` (source, tunnel/peer key, ts, rx, tx, delta_rx, delta_tx) + `wg_monitored_sources` (the village: how to reach it + creds ref). Reset-safe delta metering (cumulative counters can reset on reboot).
- [ ] Backend poller (in-process, like the existing WG metering): every N min, over the P1 tunnel read the village `/interface/wireguard/peers` (rx/tx) + `/interface/ethernet` (WAN bytes); compute deltas; store. No-op if the tunnel is down (cumulative counters mean no lost totals, just granularity).
- [ ] Fold in Afrows customer WG usage (already in `client_configs`/`wireguard_peers`) → one usage model.
- [ ] Dashboard: a "WireGuard usage" view — per tunnel/customer + per WAN/ISP, totals + time range, for cost/billing. Secrets (the village `claude` pw) via SecretVault/env, never committed.

## Phase 3 — Starlink as an Afrows foreign egress  **[depends on P1]**
> Outcome: Afrows can route foreign traffic out the village's Starlink (owned, unfiltered) as a pool option.
- [ ] On the **village**: a routing rule that sends traffic arriving from the Afrows tunnel out the desired exit (Starlink→Germany, or direct Starlink), with NAT.
- [ ] On **Afrows**: add the village tunnel as a pool egress option (a `proxy`/relay route) so the balancer/smart-selection can use it; meter it.
- [ ] Decide exit shape (Starlink→Germany for a clean foreign IP vs direct Starlink). Verify exit IP + measure bandwidth (Starlink/village uplink is the cap).
- [ ] Tradeoffs: extra hops; village uplink bandwidth; only as reliable as the village's Starlink.

## Risks / notes
- **CGNAT** → the village must initiate (persistent-keepalive); Afrows can't dial in.
- WG changes on both routers are **additive + reversible** — snapshot/confirm first; never disrupt the existing tunnels.
- **Don't touch the Germany hexogate panel/bot.**
- Starlink is sensitive (hidden under Germany) — keep that masking; don't expose it.
- Sequence: **P1 → P2 (monitoring, the stated pain) → P3 (Starlink egress).**
