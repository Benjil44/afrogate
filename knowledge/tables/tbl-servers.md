> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Table: `servers`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[servers]]
- **Migration source:** [[0001_core_monitoring.sql]]
- **Raw table note:** [[servers]]
- **Change-risk (DERIVED from coupling):** High — 7 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[AgentsService]]
- [[AlertEngineService]]
- [[BillingService]]
- [[OperationsController]]
- [[OperationsService]]
- [[PostgresMetricsRepository]]
- [[agent-token.guard.ts]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/agents/agents.service.ts:183  |  INSERT INTO servers (external_id, hostname, platform, status)`  _(confidence 0.8)_
- `apps/backend/src/alerts/alert-engine.service.ts:106  |  FROM servers s`  _(confidence 0.8)_
- `apps/backend/src/billing/billing.service.ts:5298  |  LEFT JOIN servers s ON s.id = o.server_id`  _(confidence 0.8)_
- `apps/backend/src/operations/operations.controller.ts:136  |  @Get('servers')`  _(confidence 0.8)_
- `apps/backend/src/operations/operations.service.ts:658  |  INSERT INTO servers (`  _(confidence 0.8)_
- `apps/backend/src/metrics/postgres-metrics.repository.ts:97  |  FROM servers s`  _(confidence 0.8)_
- `apps/backend/src/security/agent-token.guard.ts:73  |  FROM servers s`  _(confidence 0.8)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0001_core_monitoring.sql]] and [[servers]].

## Tests (deterministic — import → bridge, VERIFIED)
_No test imports a production file that this table's bridge marks as a consumer._

## Related tests (HEURISTIC — textual name reference, not import-verified)
- `apps/backend/test/rbac.test.ts`
- `tests/e2e/dashboard-visual.spec.ts`

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
