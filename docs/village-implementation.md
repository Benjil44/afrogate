# Village Integration — Implemented Structure (as-built)

> Living reference of what is actually configured on the **village MikroTik** and on **Afrois** for the village link. No secrets here (creds live only on-box / in the operator's records). Last updated: 2026-06-18.

## 1. Hardware & WANs (village)

- **Village router:** MikroTik hAP ax³, RouterOS 7.22.3. LAN = `ether3` (`192.168.88.1/24`).
- **WAN uplinks** (each an external CPE/modem on its own subnet):

| Port | Link | Router IP | CPE gateway | Notes |
|------|------|-----------|-------------|-------|
| `ether1-mobinnet-cpe5` | Mobinnet LTE (main) | 192.168.8.2 | 192.168.8.1 | current tunnel transport |
| `ether2-IRANCELL` | Irancell SIM **09412902228** | 192.168.9.4 | 192.168.9.1 | Huawei CPE (200 GB topped up 2026-06-18) |
| `ether5-IRANCELL` | Irancell SIM **09412902227** | 192.168.12.102 | 192.168.12.1 | different CPE (307-redirect UI) |
| `ether4` | **Starlink** | 192.168.1.140 | 192.168.1.1 | owned unfiltered foreign egress |

## 2. Friends' tunnels — DO NOT TOUCH

The village is shared with friends who set up these WireGuard tunnels. **Never disable, edit, or reroute them** — only add scoped/additive config:
`wg-germany`→162.19.253.235 (their main exit, 0.0.0.0/0), `wg-foreign-2`→85.234.69.185 (Frankfurt), `wg-foreign-hz`→91.107.172.47 (Hetzner), `wg-iran`/`-2`/`-5`→Iran nodes.

## 3. Afrois ↔ village tunnel (ours)

- **`wg-village`** on Afrois (`10.20.0.1`, ListenPort 51900) ↔ **`wg-afrows`** on village (`10.20.0.2`, MTU 1420). Village **initiates** (CGNAT) with persistent-keepalive ~25 s; self-heals on Mobinnet CGNAT re-NAT.
- **Transport pinning:** `/ip route 94.74.145.199/32` on village — `via 192.168.8.1 (mobinnet) dist=1 active`, `via 192.168.9.1 (irancell-228) dist=2 backup`. (Loop-guard so the handshake never routes into a tunnel.)
- Afrois `wg-village` peer `allowed-ips = 0.0.0.0/0`; village `wg-afrows` peer allows `10.20.0.1/32`.

## 4. Egress paths from the tunnel

- **Starlink egress (gaming):** village routing-table `afrows-starlink` (default → `192.168.1.1`); mangle `prerouting in=wg-afrows dst-address-list=!afrows-private → mark-routing afrows-starlink` (foreign → Starlink; private/mgmt stays local). `afrows-private` = RFC1918 + `100.64/10`. Masquerade out `ether4`. Proven exit: Starlink ground station (e.g. `216.147.121.0`, BG).
- **Germany egress:** reuses the friends' `any→wg-germany` + masquerade-out-wg-germany (exit `162.19.253.235`).

## 5. CPE remote management (added 2026-06-18, additive/friend-safe)

So the modems can be managed remotely from Afrois (mirrors the friends' existing "VPS→modem" rules):
- **Afrois:** kernel routes `192.168.9.0/24` and `192.168.12.0/24` `dev wg-village`.
- **Village `/ip/firewall/filter` (forward):** accept `in=wg-afrows dst=192.168.9.1` and `dst=192.168.12.1` (comments `afrows->cpe2/cpe5 mgmt`).
- **Village `/ip/firewall/nat` (srcnat):** masquerade `out=ether2 src=10.20.0.1 dst=192.168.9.1` and `out=ether5 src=10.20.0.1 dst=192.168.12.1` (comments `afrows->cpe2/cpe5 masq`). **The masquerade is the key piece** — without it the CPE replies to `10.20.0.1`, which it can't route.
- Reach from Afrois: `http://192.168.9.1` (Huawei API, `/api/monitoring/*` readable without login; admin/admin rejected = newer SCRAM auth), `http://192.168.12.1` (307 UI).

## 6. Measured state (2026-06-18)

- **All 3 modems pass data.** Verified per modem with a temporary `/32` route + ping (the RouterOS `/ping interface=etherX` test is unreliable for these CPEs — use a route).
- **Transport latency to the village (RTT to `10.20.0.2`):** Mobinnet **80 ms / 21 ms jitter**; Irancell-228 **46 ms / 12 ms**; Irancell-227 **51 ms / 9 ms**. → **Irancell is better for ping/jitter; 228 best.**
- Single-modem via-village throughput is LTE-class (~10–15 Mbps, varies); the Iran-ISP transport leg — not Starlink — is the bottleneck for the via-village path.

## 7. RouterOS REST gotchas (this box)

- **Writes:** `POST /rest/{path}/add` (→ `{"ret":"*id"}`), `POST /rest/{path}/set` (body `{".id":..., field:val}`), `POST /rest/{path}/remove` (body `{".id":...}`) **work**. `PATCH /{id}` and `DELETE /{id}` (even `%2A`-encoded) are **silently ignored / 400** — do not use.
- `device-mode = home`: `fetch`/`bandwidth-test`/`traffic-gen` disabled (no router-side speed test without a physical reset).
- "Safe mode" for risky route changes = `/system backup save` + a `/system/scheduler` (interval `00:0X:00`) whose `on-event` restores the route and self-deletes; manual revert + remove scheduler when done. Backup recovery path if `wg-afrows` drops: reach the village via Germany at `10.9.0.2`.

## 8. Next: using all 3 modems for more speed (recommendation)

See "3-modem aggregation" — per-connection load-balancing across 3 modem-pinned WireGuard tunnels (both ends), gaming pinned to the lowest-latency modem; no L2 bonding. Detailed in the plan doc.
