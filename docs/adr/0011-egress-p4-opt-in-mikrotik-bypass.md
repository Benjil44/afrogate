# ADR-0011 — Egress P4: opt-in MikroTik-direct bypass (per-customer)

- **Status:** accepted (Part A live; Part B flag-gated, activation pending the reachability probe)
- **Date:** 2026-08-22
- **Relates to:** Egress redesign Phase P4; builds on P2 (ADR-0009); machine layer
  `docs/decisions.json` (`INV-19`).
- **Scope note:** the failover priority ORDER is unchanged (INV-17); this adds a per-customer
  *conditional override*, not a reordering.

## Context

Operator requirement: **VLESS is the primary egress for everyone; when VLESS/foreign egress
is down, only opt-in customers may fall over to the MikroTik-direct internet** — not all
users, so the MikroTik's own bandwidth isn't flooded by every customer at once.

## Decision

A per-customer allow-list, in two parts:

- **Part A — control plane (live).** `customer_accounts.egress_bypass_enabled` (migration 0056,
  default false); a "Bypass" checkbox in the Customers table (mirrors the gaming/Starlink
  toggle); the update path + a change kicks `triggerEgressModeSync`. Stores + surfaces the flag;
  routes nothing.
- **Part B — routing (flag-gated, default OFF).** In `afrows-egress-mode-sync.py`, when the
  master flag is on **and** the catch-all has fallen to `direct` (foreign egress fully down),
  the bypass-listed customers' source IPs (afrows-wg) / VLESS emails (afrows-xray) are routed to
  a configurable outbound via the existing D2 fixed-rule mechanism — emitted before the catch-all
  so it overrides the dead-VLESS path. Everyone else waits for VLESS.

## Configuration (Part B)

| Env var | Default | Purpose |
|---|---|---|
| `AFROWS_BYPASS_ENABLED` | `false` | Master flag. OFF = no bypass rule at all (byte-for-byte prior behaviour). |
| `AFROWS_BYPASS_OUTBOUND` | `direct` | The outbound tag bypass customers use when VLESS is down. **Must be set to the real MikroTik-direct outbound** once it exists; `direct` on the current Ireland topology is the censored uplink, not MikroTik. |

## Activation prerequisites (before flipping `AFROWS_BYPASS_ENABLED=true`)

1. Run the reachability probe (`scripts/drills/egress-reachability-probe.sh`) and confirm
   **Q3 ≥ 1** — the MikroTik-direct path actually carries traffic. If Q3 == 0 it is an
   infrastructure gap (needs a second non-village uplink), not a config flip.
2. Ensure `AFROWS_BYPASS_OUTBOUND` names a real outbound in the client Xray configs. Note
   `xray -test` does **not** validate `outboundTag` references (tags resolve lazily at
   dispatch), so the applier itself guards this: `partition_known_outbound_rules` **drops +
   logs** any fixed/bypass rule whose outbound doesn't exist, rather than shipping a dead
   route that would strand those users. So a typo'd tag = bypass silently no-ops (logged),
   not a broken engine — but the operator must still create the real MikroTik-direct outbound.
3. A `cto-architect` adversarial review of the activation (this is topology-adjacent).

## Consequences

- With the flag OFF (default) nothing changes; the feature ships dormant and is activated by
  configuration once the path is proven — no code change to turn it on.
- The bypass rule rides the tested, deterministic D2 fixed-rule path (sorted → no config churn).

## Conditions that invalidate this decision

- If the site topology changes so VLESS is reachable independently of the village, the activation
  condition (`catch == 'direct'`) may need revisiting.
- If a dedicated MikroTik-direct outbound is added, `AFROWS_BYPASS_OUTBOUND` points at it.
