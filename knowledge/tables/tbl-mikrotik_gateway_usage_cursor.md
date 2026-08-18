> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Table: `mikrotik_gateway_usage_cursor`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[mikrotikGatewayUsageCursor]]
- **Migration source:** [[0045_mikrotik_router_customer.sql]]
- **Raw table note:** [[mikrotik_gateway_usage_cursor]]
- **Change-risk (DERIVED from coupling):** Low — <3 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[GatewayBillingService]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/routers/gateway-billing.service.ts:62  |  `SELECT peer_key, last_rx, last_tx FROM mikrotik_gateway_usage_cursor WHERE router_id = $1`,`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0045_mikrotik_router_customer.sql]] and [[mikrotikGatewayUsageCursor]].

## Tests (deterministic — import → bridge, VERIFIED)
_No test imports a production file that this table's bridge marks as a consumer._

## Related tests (HEURISTIC — textual name reference, not import-verified)
_No test file references this table by name._

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
