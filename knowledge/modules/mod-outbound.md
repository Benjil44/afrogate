> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Module: `outbound`

- **Source path:** `apps/backend/src/outbound/`
- **Dominant graph community (hint, not authoritative):** Outbound Health - outbound-health.service.ts
- **High-risk dependencies (DERIVED):** [[tbl-outbounds]]

## Services / classes (VERIFIED)
- [[DueOutboundRow]] — `apps/backend/src/outbound/outbound-health.service.ts:L10`
- [[LatencySample]] — `apps/backend/src/outbound/outbound-speed-test.service.ts:L22`
- [[NormalizedOutboundRequest]] — `apps/backend/src/outbound/outbound-http.service.ts:L37`
- [[OutboundBinaryResponse]] — `apps/backend/src/outbound/outbound-http.service.ts:L29`
- [[OutboundCheckStatus]] — `apps/backend/src/outbound/outbound-health.service.ts:L7`
- [[OutboundHealthCheckResult]] — `apps/backend/src/outbound/outbound-health.service.ts:L25`
- [[OutboundHealthService]] — `apps/backend/src/outbound/outbound-health.service.ts:L41`
- [[OutboundHttpMethod]] — `apps/backend/src/outbound/outbound-http.service.ts:L10`
- [[OutboundHttpRequestOptions]] — `apps/backend/src/outbound/outbound-http.service.ts:L12`
- [[OutboundHttpResponse]] — `apps/backend/src/outbound/outbound-http.service.ts:L21`
- [[OutboundHttpService]] — `apps/backend/src/outbound/outbound-http.service.ts:L46`
- [[OutboundSpeedTestService]] — `apps/backend/src/outbound/outbound-speed-test.service.ts:L44`
- [[ProbeKind]] — `apps/backend/src/outbound/outbound-health.service.ts:L8`
- [[ProbeTarget]] — `apps/backend/src/outbound/outbound-health.service.ts:L32`
- [[RecentHealthCheckRow]] — `apps/backend/src/outbound/outbound-health.service.ts:L21`
- [[RequestedOutboundRow]] — `apps/backend/src/outbound/outbound-speed-test.service.ts:L15`
- [[ThroughputResult]] — `apps/backend/src/outbound/outbound-speed-test.service.ts:L29`

## Database tables touched (VERIFIED — evidence-backed)
- [[tbl-outbound_health_checks]] ([[outbound_health_checks]])
- [[tbl-outbound_test_settings]] ([[outbound_test_settings]])
- [[tbl-outbounds]] ([[outbounds]])

## Services sharing those tables (VERIFIED)
- [[AlertEngineService]]
- [[BillingService]]
- [[OperationsController]]
- [[OperationsService]]
- [[RouteQualityAggregationService]]
- [[outbound-scoring.ts]]
- [[subscription-sanitizers.ts]]

## Depends on — modules (VERIFIED: AST import/call edges)
- [[mod-database]]

## Depended on by — modules (VERIFIED: AST import/call edges)
- [[mod-billing]]
- [[mod-notifications]]
- [[mod-telegram]]

## Service dependency injection (VERIFIED / EXTRACTED — NestJS constructor DI)
- **[[OutboundHealthService]]** — injects: [[DatabaseService]], [[OutboundHttpService]]
  - injected by: _none_
- **[[OutboundHttpService]]** — injects: _none_
  - injected by: [[OutboundHealthService]], [[PayPalPaymentService]], [[TelegramAlertService]], [[TelegramBotConfigService]], [[TelegramPollingService]], [[TelegramProfileService]], [[TelegramTopupAdminService]]
- **[[OutboundSpeedTestService]]** — injects: [[DatabaseService]]
  - injected by: _none_

## Tests importing this module (VERIFIED / EXTRACTED)
- `apps/backend/test/outbound-url-policy.test.ts`
- `apps/backend/test/outbound-xray-config.test.ts`

## Tests by filename convention (CONVENTION — not verified coverage)
_none_

## Related tests (HEURISTIC — textual name reference)
- `apps/backend/test/outbound-xray-config.test.ts`
- `tests/e2e/client-smoke.spec.ts`
- `tests/e2e/dashboard-visual.spec.ts`

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
