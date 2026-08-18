> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Table: `payment_order_allocations`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[paymentOrderAllocations]]
- **Migration source:** [[0019_payment_order_allocations.sql]]
- **Raw table note:** [[payment_order_allocations]]
- **Change-risk (DERIVED from coupling):** Low — <3 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[BillingService]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/billing/billing.service.ts:6722  |  LEFT JOIN payment_order_allocations poa ON poa.payment_order_id = po.id`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0019_payment_order_allocations.sql]] and [[paymentOrderAllocations]].

## Tests (deterministic — import → bridge, VERIFIED)
_No test imports a production file that this table's bridge marks as a consumer._

## Related tests (HEURISTIC — textual name reference, not import-verified)
- `apps/backend/test/fake-db-harness.test.ts`

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
