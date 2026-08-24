# ADR-0012 — Egress speed: the real bottleneck, the target architecture, and the uplink

- **Status:** accepted (diagnosis + direction); implementation staged
- **Date:** 2026-08-22
- **Relates to:** the egress-speed investigation; ADR-0009/0010/0011; the
  `network-performance-engineer` / `xray-routing-engineer` / `anti-censorship-transport-engineer` agents.

## Context — measured live on VPS-Main (94.74.145.199)

The same VLESS exits get **84–118 Mbps used directly** from an Iran phone but **~9–12 Mbps
through Afrows**. Root cause, confirmed on the box:

- **`eth0` is filtered** — the VPS cannot reach the free internet directly (Cloudflare = timeout).
- **The only working egress is the village Starlink WireGuard tunnel**, and it is both **slow
  (~11 Mbps)** and **unreliable (fluctuates 0 ↔ 11 Mbps)**. Every foreign route (via-germany
  **and** the relay pool) funnels through it.
- The **entry is throttled** — a raw datacenter IP on :443 (nginx→WS) that Iran DPI throttles by
  sniffed SNI (~2841 ms), while the direct exits ride Cloudflare domains and are fast.

**Conclusion: no config change on this VPS reaches direct speed** — the village Starlink is a hard,
flaky physical ceiling, and the VPS sits in a worse network position than the client's own phone.

## Fixes already applied (real, but capped by the above)
- **Clock**: was 14 h off (broke fresh TLS) → corrected. Live.
- **Dead relay pool**: relays exited the filtered `eth0` (0 throughput) → bound to the village
  tunnel via `sockopt.interface`; measured **0 → 10.8 Mbps**. Live + committed (also fixed the
  reconciler `identity()` so a binding change is detected).
- **Provisioner per-inbound flow**: `AFROWS_XRAY_INBOUND_TAGS` now accepts `tag:port:flow` so
  `xtls-rprx-vision` applies only to a REALITY inbound — the code prerequisite for the entry fix.

## Decision — the target "clean high-speed" architecture

**A fast, unfiltered VPS + a Cloudflare-fronted / REALITY entry + direct egress.** This removes the
village and the relay-pool detour entirely: client → (CDN/Reality entry, un-throttled) → VPS
(fast unfiltered uplink) → internet directly. It is simpler *and* faster than the current
Iran-VPS → village-Starlink → bought-VLESS-pool chain, which exists only because this VPS cannot
reach the internet itself.

### Uplink criteria (the real fix — a hosting decision)
1. **Unfiltered outbound** — a FOREIGN datacenter (Germany/Netherlands/etc.), not an Iran DC (Iran
   DCs have filtered international transit, exactly today's `eth0` problem).
2. **Good routing FROM Iran** — low-latency/high-throughput path from Iranian ISPs. This is
   route-specific; **test before committing** (buy the cheapest month, run a SpeedTest through it
   from an Iran phone, keep only if it beats the current setup).
3. **≥ 100 Mbps / 1 Gbps port**, decent monthly transit.
4. **Front the entry behind Cloudflare (WS/xhttp) or use REALITY** so the client→VPS leg isn't
   throttled regardless of the VPS's raw IP — this is what makes the direct exits fast and is
   applied identically here (ADR-0011-style entry, provisioner flow fix above).
5. **Sanctions/payment** — many providers block Iranian customers/cards; use crypto or a reseller.

### Alternative — (B) direct-to-exit
Afrows selects the best exit and hands the *client* a direct config (Afrows = selection/quota/
billing, not a relay). Matches how the phone-direct hits 84 Mbps, but metering must be rethought
(traffic no longer traverses the VPS). Prefer **(A)** unless re-hosting is impossible.

## Consequences
- On the current VPS, expect at best the village ceiling (~11 Mbps, flaky). Real speed = a new fast
  uplink (A). The pool/clock/provisioner fixes make the system correct and un-break TLS/the reserve
  in the meantime, and carry over to the new VPS.

## Conditions that invalidate this decision
- If the current VPS gains a genuinely fast unfiltered uplink, the village/pool detour becomes
  unnecessary and the relay egress can be unbound (`AFROWS_RELAY_EGRESS_IFACE=""`).
