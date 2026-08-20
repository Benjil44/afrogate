> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-20T16:27:17.978Z

# Table: `outbounds`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[outbounds]]
- **Migration source:** [[0002_server_access_outbounds.sql]]
- **Raw table note:** [[outbounds]]
- **Change-risk (DERIVED from coupling):** High — 8 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[AlertEngineService]]
- [[BillingService]]
- [[OperationsController]]
- [[OperationsService]]
- [[OutboundHealthService]]
- [[OutboundSpeedTestService]]
- [[RouteQualityAggregationService]]
- [[subscription-sanitizers.ts]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/alerts/alert-engine.service.ts:134  |  FROM outbounds`  _(confidence 0.8)_
- `apps/backend/src/billing/billing.service.ts:5297  |  FROM outbounds o`  _(confidence 0.8)_
- `apps/backend/src/operations/operations.controller.ts:401  |  @Get('outbounds')`  _(confidence 0.8)_
- `apps/backend/src/operations/operations.service.ts:1298  |  FROM outbounds o`  _(confidence 0.8)_
- `apps/backend/src/outbound/outbound-health.service.ts:94  |  FROM outbounds`  _(confidence 0.8)_
- `apps/backend/src/outbound/outbound-speed-test.service.ts:87  |  UPDATE outbounds o`  _(confidence 0.8)_
- `apps/backend/src/operations/route-quality-aggregation.service.ts:86  |  LEFT JOIN outbounds probe_outbound`  _(confidence 0.8)_
- `apps/backend/src/billing/subscription-sanitizers.ts:11  |  type Outbound = ClientRouteOptionsResponse['outbounds'][number];`  _(confidence 0.8)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0002_server_access_outbounds.sql]] and [[outbounds]].

## Tests (deterministic — import → bridge, VERIFIED)
- `apps/backend/test/subscription-sanitizers.test.ts` _(imports a production file the bridge marks as a consumer of this table)_

## Related tests (HEURISTIC — textual name reference, not import-verified)
- `apps/backend/test/outbound-xray-config.test.ts`
- `tests/e2e/client-smoke.spec.ts`
- `tests/e2e/dashboard-visual.spec.ts`

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
