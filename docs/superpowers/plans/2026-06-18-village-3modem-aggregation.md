# Village 3-Modem Aggregation Plan

> **For agentic workers:** Mostly RouterOS (village) + Afrows kernel/WireGuard ops. Touches WireGuard on a **shared production router** — every step is additive/reversible and must NOT disable the friends' tunnels. Use the safe-mode pattern (backup + auto-revert scheduler + Germany recovery path at `10.9.0.2`). RouterOS writes via `POST /rest/{path}/{add|set|remove}` (PATCH/DELETE-by-id are silently ignored).

**Goal:** Use the village's three Ireland-ISP modems (Mobinnet, Irelandcell-228, Irelandcell-227) together for the Afrows↔village transport, to (a) multiply aggregate throughput for parallel connections, and (b) survive any single SIM dying — while keeping latency-sensitive gaming pinned to the single best modem.

**Architecture:** Three **modem-pinned WireGuard tunnels** between Afrows and the village (tunnel-k transported over modem-k). **Per-connection load-balancing (PCC/ECMP)** spreads *different* connections across the three tunnels — each end balances its own outbound direction. This aggregates bandwidth for many parallel flows (~up to 3×) and gives failover; it does **not** speed up a single stream. Gaming traffic bypasses the LB and pins to the lowest-latency modem (currently Irelandcell-228, 46 ms).

**Why not bonding:** RouterOS L2 bonding needs links to the same peer; independent LTE-to-different-ISP modems can't be bonded without a packet-level bonding server (out of scope).

**Current baseline (2026-06-18):** one tunnel `wg-village`↔`wg-afrows`, now pinned to Irelandcell-228 (dist=1) with Mobinnet backup (dist=2) + netwatch auto-failback. See `docs/village-implementation.md`.

---

## Naming

| k | Modem | Village WAN / gw | Afrows iface (ListenPort) | Village iface | Subnet |
|---|-------|------------------|---------------------------|---------------|--------|
| 1 | Mobinnet | ether1 / 192.168.8.1 | `wg-vil1` (51900) | `wg-afr1` | 10.20.1.0/30 |
| 2 | Irelandcell-228 | ether2 / 192.168.9.1 | `wg-vil2` (51902) | `wg-afr2` | 10.20.2.0/30 |
| 3 | Irelandcell-227 | ether5 / 192.168.12.1 | `wg-vil3` (51903) | `wg-afr3` | 10.20.3.0/30 |

> Reuse the existing `wg-village`/`wg-afrows` as tunnel-1 if convenient (re-pin to Mobinnet), or build all three fresh and retire the old one at the end.

---

## Phase 0 — Prereqs & baseline

- [ ] Confirm all 3 modems pass data (per-modem `/32` route + ping; the `/ping interface=` test is unreliable here).
- [ ] Record per-modem RTT to Afrows and a real throughput number per modem (use a large file / multi-stream; small files understate due to TCP slow-start). This sets the expected aggregate ceiling.
- [ ] `POST /rest/system/backup/save` on the village. Note the Germany recovery path (`ssh→Germany→http://10.9.0.2/rest`).

## Phase 1 — Stand up 3 modem-pinned tunnels

- [ ] **Afrows:** create `wg-vil1/2/3` (`/etc/wireguard/`, distinct keys, ListenPort 51900/51902/51903), each with one peer = the village's matching iface pubkey, `AllowedIPs = 10.20.k.2/32` + (later) the LB target ranges. `wg-quick up` + enable.
- [ ] **Village:** create `wg-afr1/2/3` (`POST /rest/interface/wireguard/add`), addresses `10.20.k.2/30`, each peer = Afrows pubkey, endpoint `94.74.145.199:<port-k>`, `persistent-keepalive=25` (village initiates; CGNAT).
- [ ] **Pin each village tunnel to its modem (the key step).** Because all three handshakes go to the *same* Afrows IP, pin by the WireGuard UDP **source/dest port** in the `output` chain:
  - 3 routing tables: `to-m1`→default gw 192.168.8.1, `to-m2`→192.168.9.1, `to-m3`→192.168.12.1.
  - `/ip/firewall/mangle` chain=`output`, `protocol=udp dst-port=51900 → mark-routing to-m1`; `51902 → to-m2`; `51903 → to-m3`.
  - Loop-guard `/32` to `94.74.145.199` is unnecessary per-table since each table's default already points at a modem gw (not a tunnel).
- [ ] Verify each tunnel handshakes and the Afrows-side endpoint shows the expected modem public IP (Mobinnet `178.131.x`, Irelandcell `5.126.x`). `ping -I wg-vilK 10.20.k.2`.

## Phase 2 — Per-connection load-balancing (bulk/egress)

- [ ] **Village → Afrows (download-heavy direction): PCC.** `/ip/firewall/mangle` prerouting on the egress-return traffic: `action=mark-connection per-connection-classifier=both-addresses-and-ports:3/0|1|2 → conn-mark cN`, then `mark-routing` cN → table `via-tunN` (default via `wg-afrK`). This spreads return connections across the 3 tunnels.
- [ ] **Afrows → village (upload direction): ECMP.** Replace the single `sockopt interface=wg-village` binding with an ECMP route on Afrows: `ip route add <village-egress-target> nexthop dev wg-vil1 nexthop dev wg-vil2 nexthop dev wg-vil3` (per-flow hashing), or 3 freedom outbounds behind an xray balancer. Drop the single-interface sockopt for balanced flows.
- [ ] Ensure `AllowedIPs` on every peer (both ends) covers the egress target ranges so WireGuard doesn't drop balanced packets (the earlier CPE-mgmt bug was exactly an allowed-ips/masq gap).
- [ ] **Verify aggregation:** run 3–6 parallel downloads through the village egress and confirm combined throughput exceeds a single modem (sum approaches the 3-modem total); confirm each modem's counters climb.

## Phase 3 — Gaming pin + resilience

- [ ] **Gaming bypasses the LB:** mark gaming source IPs (the `egress_tier='gaming'` set + home) to a routing mark that pins to the single lowest-latency tunnel (Irelandcell-228); do not PCC them (LB adds jitter/reordering).
- [ ] **Per-tunnel netwatch failover:** one netwatch per modem (probe a foreign IP routed via that modem); on down, pull that tunnel out of the PCC set (raise its route distance / set conn-mark weights to skip it); on up, restore. Reuse the Phase-0/current `Irelandcell-228 health probe` pattern.
- [ ] **Safety:** wrap each disruptive route/mangle change in the safe-mode scheduler (auto-revert in N min) until verified; never edit the friends' tunnels.

## Phase 4 — Cutover & docs

- [ ] Point the customer/home egress (`via-village`) at the balanced path; keep the single-tunnel config as a documented fallback.
- [ ] Update `docs/village-implementation.md` (as-built) + memory `[[village-integration]]` with the final interfaces, tables, mangle marks, and failover behaviour.

---

## Risks & rollback

- **Lockout:** management runs over these tunnels — a bad change can cut access. Mitigations: safe-mode auto-revert scheduler on the village; second path via Germany (`10.9.0.2`); keep Mobinnet tunnel/route as an always-on fallback.
- **Asymmetric routing:** up/down may take different modems — acceptable (still aggregates); only pin symmetric for gaming.
- **SIM depletion:** netwatch per modem removes a dead SIM from the pool automatically.
- **Single-stream expectation:** be clear with the operator — this raises *aggregate/parallel* speed and resilience, not a single download's speed.
- **Friends' tunnels:** every rule is additive and scoped; never disable `wg-germany`/`wg-foreign-*`/`wg-Ireland*`.
