> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Table: `client_route_preferences`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[clientRoutePreferences]]
- **Migration source:** [[0016_client_route_preferences.sql]]
- **Raw table note:** [[client_route_preferences]]
- **Change-risk (DERIVED from coupling):** Low — <3 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[BillingService]]
- [[OperationsService]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/billing/billing.service.ts:5942  |  INSERT INTO client_route_preferences (`  _(confidence 0.9)_
- `apps/backend/src/operations/operations.service.ts:2261  |  FROM client_route_preferences preference`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0016_client_route_preferences.sql]] and [[clientRoutePreferences]].

## Tests (deterministic — import → bridge, VERIFIED)
_No test imports a production file that this table's bridge marks as a consumer._

## Related tests (HEURISTIC — textual name reference, not import-verified)
_No test file references this table by name._

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
