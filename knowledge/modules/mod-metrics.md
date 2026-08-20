> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-20T13:32:55.646Z

# Module: `metrics`

- **Source path:** `apps/backend/src/metrics/`
- **Dominant graph community (hint, not authoritative):** servers
- **High-risk dependencies (DERIVED):** [[tbl-servers]]

## Services / classes (VERIFIED)
- [[LatestMetricRow]] — `apps/backend/src/metrics/postgres-metrics.repository.ts:L8`
- [[MetricsController]] — `apps/backend/src/metrics/metrics.controller.ts:L8`
- [[MetricsIngestDto]] — `apps/backend/src/metrics/dto/metrics-ingest.dto.ts:L274`
- [[MetricsRepository]] — `apps/backend/src/metrics/metrics.repository.ts:L10`
- [[MetricsService]] — `apps/backend/src/metrics/metrics.service.ts:L9`
- [[MetricsTimeseriesQuery]] — `apps/backend/src/metrics/metrics.repository.ts:L5`
- [[NetworkInterfaceMetricDto]] — `apps/backend/src/metrics/dto/metrics-ingest.dto.ts:L47`
- [[PostgresMetricsRepository]] — `apps/backend/src/metrics/postgres-metrics.repository.ts:L28`
- [[RouteProbeMetricDto]] — `apps/backend/src/metrics/dto/metrics-ingest.dto.ts:L171`
- [[StorageVolumeMetricDto]] — `apps/backend/src/metrics/dto/metrics-ingest.dto.ts:L12`
- [[TimeseriesMetricRow]] — `apps/backend/src/metrics/postgres-metrics.repository.ts:L25`
- [[WireGuardInterfaceMetricDto]] — `apps/backend/src/metrics/dto/metrics-ingest.dto.ts:L114`
- [[WireGuardPeerMetricDto]] — `apps/backend/src/metrics/dto/metrics-ingest.dto.ts:L72`

## Database tables touched (VERIFIED — evidence-backed)
- [[tbl-alerts]] ([[alerts]])
- [[tbl-server_metrics]] ([[server_metrics]])
- [[tbl-servers]] ([[servers]])

## Services sharing those tables (VERIFIED)
- [[AgentsService]]
- [[AlertEngineService]]
- [[BillingService]]
- [[GatewayBillingService]]
- [[OperationsController]]
- [[OperationsService]]
- [[RouteQualityAggregationService]]
- [[agent-token.guard.ts]]

## Depends on — modules (VERIFIED: AST import/call edges)
- [[mod-database]]
- [[mod-security]]

## Depended on by — modules (VERIFIED: AST import/call edges)
_none_

## Service dependency injection (VERIFIED / EXTRACTED — NestJS constructor DI)
- **[[MetricsController]]** — injects: [[MetricsService]]
  - injected by: _none_
- **[[MetricsService]]** — injects: [[PostgresMetricsRepository]] _(token DI)_
  - injected by: [[MetricsController]]
- **[[PostgresMetricsRepository]]** — injects: [[DatabaseService]]
  - injected by: [[MetricsService]] _(token DI)_

## Tests importing this module (VERIFIED / EXTRACTED)
_none — no test imports a file in this module directly_

## Tests by filename convention (CONVENTION — not verified coverage)
_none_

## Related tests (HEURISTIC — textual name reference)
- `apps/backend/test/rbac.test.ts`
- `tests/e2e/dashboard-visual.spec.ts`

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
