> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Module: `alerts`

- **Source path:** `apps/backend/src/alerts/`
- **Dominant graph community (hint, not authoritative):** Test
- **High-risk dependencies (DERIVED):** [[tbl-outbounds]], [[tbl-servers]]

## Services / classes (VERIFIED)
- [[AlertCondition]] — `apps/backend/src/alerts/alert-engine.service.ts:L33`
- [[AlertEngineService]] — `apps/backend/src/alerts/alert-engine.service.ts:L43`
- [[AlertSeverity]] — `apps/backend/src/alerts/alert-engine.service.ts:L5`
- [[OutboundAlertSignalRow]] — `apps/backend/src/alerts/alert-engine.service.ts:L23`
- [[ServerAlertSignalRow]] — `apps/backend/src/alerts/alert-engine.service.ts:L7`

## Database tables touched (VERIFIED — evidence-backed)
- [[tbl-alerts]] ([[alerts]])
- [[tbl-outbounds]] ([[outbounds]])
- [[tbl-server_metrics]] ([[server_metrics]])
- [[tbl-servers]] ([[servers]])

## Services sharing those tables (VERIFIED)
- [[AgentsService]]
- [[BillingService]]
- [[GatewayBillingService]]
- [[OperationsController]]
- [[OperationsService]]
- [[OutboundHealthService]]
- [[OutboundSpeedTestService]]
- [[PostgresMetricsRepository]]
- [[RouteQualityAggregationService]]
- [[agent-token.guard.ts]]
- [[subscription-sanitizers.ts]]

## Depends on — modules (VERIFIED: AST import/call edges)
- [[mod-database]]

## Depended on by — modules (VERIFIED: AST import/call edges)
_none_

## Related tests (by reference)
- `apps/backend/test/outbound-xray-config.test.ts`
- `apps/backend/test/rbac.test.ts`
- `tests/e2e/client-smoke.spec.ts`
- `tests/e2e/dashboard-visual.spec.ts`

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
