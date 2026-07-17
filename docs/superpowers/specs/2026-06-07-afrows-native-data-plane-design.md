# Afrows Native VPN Data Plane + Smart Routing — Design

**Date:** 2026-06-07
**Status:** Direction approved (native, self-contained — NO external panel/Marzban). Pre-implementation.

## Goal

Afrows is a **standalone VPN engine**. After a user logs in, the system automatically gives them a working config and connects them; their traffic is routed **smartly** through the outbound pool and **metered** against their GB quota. No dependency on Marzban/X-UI — Afrows owns the inbound, provisioning, routing, and metering itself.

```
Seller creates user → User logs in → App auto-receives config → Connect
                                          ↓
                         Afrows inbound → smart route → best outbound → internet
                                          ↓ (metered → quota)
```

## What already exists (reuse, do NOT rebuild)

- **Outbounds pool** + health/speed engine (`operations` + `outbound-speed-test.service`).
- **Route scoring + route-quality history** by server/outbound/operator/profile/time-bucket (`route-quality-aggregation.service`, route scoring) — the brain for smart routing.
- **Subscription renderer** `renderVlessClientUri` + `/client/subscription` (`configLinks[].uri`).
- **Auth**: customer accounts + email/password login + `client_access_tokens` (just built).
- **Protocol provisioning engine** (control-plane drafts for VLESS/WG/etc.).
- **xray 26.3.27** on the box; `client_configs` / `customer_accounts` schema.

## The gap to build

1. **Live user-facing inbound** — a dedicated Afrows-managed xray instance with a VLESS inbound users actually dial (today xray runs only as a *client* uplink).
2. **Live per-user provisioning** — register/remove a user's UUID in the running inbound when a client_config is created/disabled.
3. **Routing inbound → outbound pool**, driven by the smart router.
4. **Usage metering** — per-user traffic from xray → `used_bytes` → quota enforcement.
5. **Config delivery** wired to the real inbound (renderer points at it).

## Architecture

- **Afrows-managed xray** (`afrows-xray`, separate from the uplink-client xray) with:
  - **Inbound:** VLESS — **Reality recommended** (no domain/cert, best Ireland anti-filtering) on the reachable host. WS+TLS as an alternative if fronted.
  - **Clients:** the active `client_configs` UUIDs.
  - **Routing:** rules sending each user (by routing tag) to a chosen **outbound** from the pool.
  - **Stats + API** enabled (gRPC `StatsService` + `HandlerService`).
- **Provisioning service** (backend): on client_config create/enable/disable, call xray **gRPC `HandlerService` AddUser/RemoveUser** for live changes (no restart). Fallback: regenerate config + reload. Source of truth stays Postgres; xray is reconciled from it.
- **Smart router** (Phase 10 made real): a decision pass picks each user's/route-group's best outbound from **route-quality history (1h/1d/1w/1mo)** with hysteresis + cooldown (reuse the existing route engine), and writes the choice into the xray routing config; auto-failover when an outbound goes unhealthy (drop unreachable ones like `benjil`).
- **Metering service**: poll xray **StatsService** per-user up/down on an interval → write usage events → update `used_bytes` → when over quota, RemoveUser (or mark limited) + set client_config `limited`/`expired`.
- **Config delivery**: `renderVlessClientUri` emits the user's `vless://` pointing at the Afrows inbound (host/port/Reality public-key/shortId) + their UUID; `/client/subscription` returns it; the app connects.

## Reachability (companion track — required)

The inbound host must be reachable from users' networks. This is the same problem as the panel: front it / put it on the **Germany VPS** (Phase 11). The Germany VPS can host the reachable inbound **and** be (or reach) the egress — solving data-plane + reachability together. Reality on a clean foreign IP is strong against filtering.

## Phasing (each independently testable)

1. **Stand up the Afrows inbound** (Reality) + stats/API on a reachable host; one manual test user connects with v2rayNG → browses.
2. **Live provisioning** — create/disable a `client_config` ↔ AddUser/RemoveUser in xray (reconcile from Postgres).
3. **Config delivery + app** — renderer points at the inbound; mobile **login → auto config → Connect** works end-to-end.
4. **Metering + quota** — per-user usage from StatsService → `used_bytes` → enforce; app shows real GB remaining decreasing.
5. **Smart routing** — wire route-quality history → per-user outbound selection + hysteresis/cooldown + auto-failover.

## Open decisions (recommendations)
- **Protocol:** VLESS+**Reality** (no cert/domain, Ireland-resilient). [recommended]
- **Provisioning:** xray **gRPC API** live (AddUser/RemoveUser), Postgres as source of truth. [recommended]
- **Topology:** one inbound, per-user routing tag → outbound (simpler) vs per-outbound inbounds. Start with one inbound + per-user routing. [recommended]
- **Host:** Germany VPS for global reach (+ optionally the Ireland box for domestic users later).

## Security
- Reality private key + user UUIDs are secrets — stored via the existing secret path, never in git/.codex.
- xray gRPC API bound to localhost only.
- Quota enforcement must be authoritative (over-quota = removed/limited).

## Testing
- Pure/unit: xray config generation (inbound + per-user clients + routing) — table-tested like `outbound-xray-config`; usage-delta math; routing-decision selection from history.
- Integration on a real host: connect a provisioned user via v2rayNG, then via the Afrows app; verify metering decrements and over-quota disconnects.

## Acceptance
Seller creates a user → user logs into the app → app auto-receives config and **connects** → traffic egresses via a smartly-chosen outbound → **GB remaining decreases** → over quota disconnects. No external panel involved.

## Out of scope (later)
- Multi-protocol user inbounds (WG/L2TP/IKEv2) — VLESS/Reality first.
- Multi-region inbound mesh; per-user multi-config.
