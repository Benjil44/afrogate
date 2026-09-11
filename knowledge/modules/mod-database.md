> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-09-11T23:01:53.278Z

# Module: `database`

- **Source path:** `apps/backend/src/database/`
- **Dominant graph community (hint, not authoritative):** database.service.ts
- **High-risk dependencies (DERIVED):** _none among heavily-coupled tables_

## Services / classes (VERIFIED)
- [[AfrowsDatabase]] — `apps/backend/src/database/database.service.ts:L6`
- [[ClientDeviceSightingInsert]] — `apps/backend/src/database/schema.ts:L1335`
- [[ClientDeviceSightingSelect]] — `apps/backend/src/database/schema.ts:L1334`
- [[DatabaseModule]] — `apps/backend/src/database/database.module.ts:L8`
- [[DatabaseQueryExecutor]] — `apps/backend/src/database/database.service.ts:L8`
- [[DatabaseService]] — `apps/backend/src/database/database.service.ts:L16`
- [[GemsLedgerInsert]] — `apps/backend/src/database/schema.ts:L1214`
- [[GemsLedgerRow]] — `apps/backend/src/database/schema.ts:L1213`
- [[MikrotikGatewayUsageCursorInsert]] — `apps/backend/src/database/schema.ts:L1393`
- [[MikrotikGatewayUsageCursorRow]] — `apps/backend/src/database/schema.ts:L1392`
- [[MikrotikRouterInsert]] — `apps/backend/src/database/schema.ts:L1372`
- [[MikrotikRouterRow]] — `apps/backend/src/database/schema.ts:L1371`
- [[OutboundSubscriptionInsert]] — `apps/backend/src/database/schema.ts:L1280`
- [[OutboundSubscriptionSelect]] — `apps/backend/src/database/schema.ts:L1279`
- [[ResellerWalletTopupRequestInsert]] — `apps/backend/src/database/schema.ts:L1246`
- [[ResellerWalletTopupRequestRow]] — `apps/backend/src/database/schema.ts:L1245`
- [[TelegramTopupRequestInsert]] — `apps/backend/src/database/schema.ts:L1192`
- [[TelegramTopupRequestRow]] — `apps/backend/src/database/schema.ts:L1191`
- [[TelegramUserInsert]] — `apps/backend/src/database/schema.ts:L1411`
- [[TelegramUserSelect]] — `apps/backend/src/database/schema.ts:L1410`
- [[WireguardPeerInsert]] — `apps/backend/src/database/schema.ts:L1314`
- [[WireguardPeerRow]] — `apps/backend/src/database/schema.ts:L1313`

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
- [[mod-edge]]
- [[mod-metrics]]
- [[mod-operations]]
- [[mod-outbound]]
- [[mod-routers]]
- [[mod-security]]
- [[mod-telegram]]

## Service dependency injection (VERIFIED / EXTRACTED — NestJS constructor DI)
- **[[DatabaseService]]** — injects: _none_
  - injected by: [[AdminTenantBrandingService]], [[AgentTokenGuard]], [[AgentsService]], [[AlertEngineService]], [[AuditService]], [[AuthService]], [[BillingService]], [[ConnectionsService]], [[DeviceLimitService]], [[EdgeService]], [[GatewayBillingService]], [[GermanyUsageMeteringService]], [[OperationsOverviewService]], [[OperationsService]], [[OutboundHealthService]], [[OutboundSpeedTestService]], [[PostgresMetricsRepository]], [[RouteQualityAggregationService]], [[RoutersService]], [[TelegramBotConfigService]], [[TelegramBotService]], [[TelegramTopupAdminService]], [[WireguardMeteringService]], [[XrayAccessLogService]], [[XrayProvisioningService]], [[XrayUsageMeteringService]]

## Tests importing this module (VERIFIED / EXTRACTED)
- `apps/backend/test/reseller-ownership.test.ts`

## Tests by filename convention (CONVENTION — not verified coverage)
_none_

## Related tests (HEURISTIC — textual name reference)
- `apps/backend/test/reseller-ownership.test.ts`

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
