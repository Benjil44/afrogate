> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-20T13:32:55.646Z

# Table: `route_quality_hourly`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[routeQualityHourly]]
- **Migration source:** [[0007_route_quality_hourly.sql]]
- **Raw table note:** [[route_quality_hourly]]
- **Change-risk (DERIVED from coupling):** Low — <3 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[OperationsService]]
- [[RouteQualityAggregationService]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/operations/operations.service.ts:5155  |  FROM route_quality_hourly q`  _(confidence 0.9)_
- `apps/backend/src/operations/route-quality-aggregation.service.ts:185  |  INSERT INTO route_quality_hourly (`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0007_route_quality_hourly.sql]] and [[routeQualityHourly]].

## Tests (deterministic — import → bridge, VERIFIED)
_No test imports a production file that this table's bridge marks as a consumer._

## Related tests (HEURISTIC — textual name reference, not import-verified)
_No test file references this table by name._

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
