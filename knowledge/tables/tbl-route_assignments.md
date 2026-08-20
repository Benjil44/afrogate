> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-20T16:27:17.978Z

# Table: `route_assignments`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[routeAssignments]]
- **Migration source:** [[0009_route_decision_foundation.sql]]
- **Raw table note:** [[route_assignments]]
- **Change-risk (DERIVED from coupling):** Low — <3 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[BillingService]]
- [[OperationsService]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/billing/billing.service.ts:9130  |  INSERT INTO route_assignments (`  _(confidence 0.9)_
- `apps/backend/src/operations/operations.service.ts:2503  |  INSERT INTO route_assignments (`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0009_route_decision_foundation.sql]] and [[routeAssignments]].

## Tests (deterministic — import → bridge, VERIFIED)
_No test imports a production file that this table's bridge marks as a consumer._

## Related tests (HEURISTIC — textual name reference, not import-verified)
_No test file references this table by name._

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
