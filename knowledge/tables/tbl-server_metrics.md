> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Table: `server_metrics`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[serverMetrics]]
- **Migration source:** [[0001_core_monitoring.sql]]
- **Raw table note:** [[server_metrics]]
- **Change-risk (DERIVED from coupling):** Medium — 4 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[AlertEngineService]]
- [[OperationsService]]
- [[PostgresMetricsRepository]]
- [[RouteQualityAggregationService]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/alerts/alert-engine.service.ts:109  |  FROM server_metrics sm`  _(confidence 0.9)_
- `apps/backend/src/operations/operations.service.ts:4608  |  FROM server_metrics server_metric`  _(confidence 0.9)_
- `apps/backend/src/metrics/postgres-metrics.repository.ts:98  |  JOIN server_metrics m ON m.server_id = s.id`  _(confidence 0.9)_
- `apps/backend/src/operations/route-quality-aggregation.service.ts:79  |  FROM server_metrics sm`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0001_core_monitoring.sql]] and [[serverMetrics]].

## Related tests (by reference)
_No test file references this table by name._

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
