> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Table: `alerts`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[alerts]]
- **Migration source:** [[0001_core_monitoring.sql]]
- **Raw table note:** [[alerts]]
- **Change-risk (DERIVED from coupling):** Medium — 5 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[AlertEngineService]]
- [[GatewayBillingService]]
- [[OperationsController]]
- [[OperationsService]]
- [[PostgresMetricsRepository]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/alerts/alert-engine.service.ts:322  |  INSERT INTO alerts (severity, status, source_type, source_id, title, message)`  _(confidence 0.8)_
- `apps/backend/src/routers/gateway-billing.service.ts:117  |  `INSERT INTO alerts (severity, status, source_type, source_id, title, message)`  _(confidence 0.8)_
- `apps/backend/src/operations/operations.controller.ts:423  |  @Get('alerts')`  _(confidence 0.8)_
- `apps/backend/src/operations/operations.service.ts:1799  |  FROM alerts a`  _(confidence 0.8)_
- `apps/backend/src/metrics/postgres-metrics.repository.ts:190  |  INSERT INTO alerts (severity, status, source_type, source_id, title, message)`  _(confidence 0.8)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0001_core_monitoring.sql]] and [[alerts]].

## Related tests (by reference)
- `tests/e2e/dashboard-visual.spec.ts`

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
