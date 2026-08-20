> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Table: `mikrotik_routers`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[mikrotikRouters]]
- **Migration source:** [[0038_mikrotik_routers.sql]]
- **Raw table note:** [[mikrotik_routers]]
- **Change-risk (DERIVED from coupling):** Low — <3 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[BillingService]]
- [[GatewayBillingService]]
- [[RoutersService]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/billing/billing.service.ts:2872  |  `SELECT customer_account_id, id, label FROM mikrotik_routers`  _(confidence 0.9)_
- `apps/backend/src/routers/gateway-billing.service.ts:26  |  FROM mikrotik_routers`  _(confidence 0.9)_
- `apps/backend/src/routers/routers.service.ts:94  |  `INSERT INTO mikrotik_routers`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0038_mikrotik_routers.sql]] and [[mikrotikRouters]].

## Tests (deterministic — import → bridge, VERIFIED)
_No test imports a production file that this table's bridge marks as a consumer._

## Related tests (HEURISTIC — textual name reference, not import-verified)
_No test file references this table by name._

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
