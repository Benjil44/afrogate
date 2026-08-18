> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Module: `database`

- **Source path:** `apps/backend/src/database/`
- **Dominant graph community (hint, not authoritative):** Test
- **High-risk dependencies (DERIVED):** _none among heavily-coupled tables_

## Services / classes (VERIFIED)
- [[AfrowsDatabase]] — `apps/backend/src/database/database.service.ts:L6`
- [[ClientDeviceSightingInsert]] — `apps/backend/src/database/schema.ts:L1325`
- [[ClientDeviceSightingSelect]] — `apps/backend/src/database/schema.ts:L1324`
- [[DatabaseModule]] — `apps/backend/src/database/database.module.ts:L8`
- [[DatabaseQueryExecutor]] — `apps/backend/src/database/database.service.ts:L8`
- [[DatabaseService]] — `apps/backend/src/database/database.service.ts:L16`
- [[GemsLedgerInsert]] — `apps/backend/src/database/schema.ts:L1210`
- [[GemsLedgerRow]] — `apps/backend/src/database/schema.ts:L1209`
- [[MikrotikGatewayUsageCursorInsert]] — `apps/backend/src/database/schema.ts:L1383`
- [[MikrotikGatewayUsageCursorRow]] — `apps/backend/src/database/schema.ts:L1382`
- [[MikrotikRouterInsert]] — `apps/backend/src/database/schema.ts:L1362`
- [[MikrotikRouterRow]] — `apps/backend/src/database/schema.ts:L1361`
- [[OutboundSubscriptionInsert]] — `apps/backend/src/database/schema.ts:L1270`
- [[OutboundSubscriptionSelect]] — `apps/backend/src/database/schema.ts:L1269`
- [[ResellerWalletTopupRequestInsert]] — `apps/backend/src/database/schema.ts:L1242`
- [[ResellerWalletTopupRequestRow]] — `apps/backend/src/database/schema.ts:L1241`
- [[TelegramTopupRequestInsert]] — `apps/backend/src/database/schema.ts:L1188`
- [[TelegramTopupRequestRow]] — `apps/backend/src/database/schema.ts:L1187`
- [[TelegramUserInsert]] — `apps/backend/src/database/schema.ts:L1401`
- [[TelegramUserSelect]] — `apps/backend/src/database/schema.ts:L1400`
- [[WireguardPeerInsert]] — `apps/backend/src/database/schema.ts:L1304`
- [[WireguardPeerRow]] — `apps/backend/src/database/schema.ts:L1303`

## Database tables touched (VERIFIED — evidence-backed)
_none via bridge provenance_

## Services sharing those tables (VERIFIED)
_none_

## Depends on — modules (VERIFIED: AST import/call edges)
_none_

## Depended on by — modules (VERIFIED: AST import/call edges)
- [[mod-agents]]
- [[mod-alerts]]
- [[mod-audit]]
- [[mod-auth]]
- [[mod-billing]]
- [[mod-branding]]
- [[mod-client]]
- [[mod-metrics]]
- [[mod-operations]]
- [[mod-outbound]]
- [[mod-routers]]
- [[mod-security]]
- [[mod-telegram]]

## Service dependency injection (VERIFIED / EXTRACTED — NestJS constructor DI)
- **[[DatabaseService]]** — injects: _none_
  - injected by: [[AdminTenantBrandingService]], [[AgentTokenGuard]], [[AgentsService]], [[AlertEngineService]], [[AuditService]], [[AuthService]], [[BillingService]], [[ConnectionsService]], [[GatewayBillingService]], [[OperationsOverviewService]], [[OperationsService]], [[OutboundHealthService]], [[OutboundSpeedTestService]], [[PostgresMetricsRepository]], [[RouteQualityAggregationService]], [[RoutersService]], [[TelegramBotConfigService]], [[TelegramBotService]], [[TelegramTopupAdminService]], [[WireguardMeteringService]], [[XrayAccessLogService]], [[XrayProvisioningService]], [[XrayUsageMeteringService]]

## Tests importing this module (VERIFIED / EXTRACTED)
- `apps/backend/test/reseller-ownership.test.ts`

## Tests by filename convention (CONVENTION — not verified coverage)
_none_

## Related tests (HEURISTIC — textual name reference)
- `apps/backend/test/reseller-ownership.test.ts`

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
