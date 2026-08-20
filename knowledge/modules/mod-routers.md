> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Module: `routers`

- **Source path:** `apps/backend/src/routers/`
- **Dominant graph community (hint, not authoritative):** MikroTik Routers - .query()
- **High-risk dependencies (DERIVED):** [[tbl-customer_accounts]]

## Services / classes (VERIFIED)
- [[BlockReason]] — `apps/backend/src/routers/gateway-billing.util.ts:L19`
- [[Counter]] — `apps/backend/src/routers/gateway-billing.util.ts:L1`
- [[CreateMikroTikRouterDto]] — `apps/backend/src/routers/dto/router.dto.ts:L7`
- [[GatewayBillingRunnerService]] — `apps/backend/src/routers/gateway-billing.runner.ts:L10`
- [[GatewayBillingService]] — `apps/backend/src/routers/gateway-billing.service.ts:L10`
- [[MikroTikClientService]] — `apps/backend/src/routers/mikrotik-client.service.ts:L19`
- [[MikroTikTarget]] — `apps/backend/src/routers/mikrotik-client.service.ts:L4`
- [[ReconnectModemDto]] — `apps/backend/src/routers/dto/router.dto.ts:L135`
- [[RouterRow]] — `apps/backend/src/routers/routers.service.ts:L26`
- [[RouterUsageSamplerService]] — `apps/backend/src/routers/router-usage-sampler.service.ts:L11`
- [[RoutersController]] — `apps/backend/src/routers/routers.controller.ts:L27`
- [[RoutersService]] — `apps/backend/src/routers/routers.service.ts:L48`
- [[SetEgressDto]] — `apps/backend/src/routers/dto/router.dto.ts:L130`
- [[SetMikroTikModeDto]] — `apps/backend/src/routers/dto/router.dto.ts:L125`
- [[SetWgRateDto]] — `apps/backend/src/routers/dto/router.dto.ts:L142`
- [[UpdateMikroTikRouterDto]] — `apps/backend/src/routers/dto/router.dto.ts:L67`
- [[VillageFailoverService]] — `apps/backend/src/routers/village-failover.service.ts:L21`

## Database tables touched (VERIFIED — evidence-backed)
- [[tbl-alerts]] ([[alerts]])
- [[tbl-customer_accounts]] ([[customer_accounts]])
- [[tbl-mikrotik_gateway_usage_cursor]] ([[mikrotik_gateway_usage_cursor]])
- [[tbl-mikrotik_routers]] ([[mikrotik_routers]])
- [[tbl-mikrotik_wg_rates]] ([[mikrotik_wg_rates]])
- [[tbl-mikrotik_wg_samples]] ([[mikrotik_wg_samples]])

## Services sharing those tables (VERIFIED)
- [[AlertEngineService]]
- [[BillingService]]
- [[ConnectionsService]]
- [[GemsReason]]
- [[OperationsController]]
- [[OperationsService]]
- [[PostgresMetricsRepository]]
- [[TelegramTopupAdminService]]
- [[WireguardMeteringService]]
- [[XrayProvisioningService]]
- [[XrayUsageMeteringService]]
- [[customer-account-deletion.ts]]
- [[customer-account-merge.ts]]
- [[phone-identity.ts]]
- [[reseller-ownership.ts]]
- [[telegram-self-service.ts]]
- [[telegram-topup.ts]]

## Depends on — modules (VERIFIED: AST import/call edges)
- [[mod-database]]
- [[mod-operations]]
- [[mod-security]]

## Depended on by — modules (VERIFIED: AST import/call edges)
- [[mod-telegram]]

## Service dependency injection (VERIFIED / EXTRACTED — NestJS constructor DI)
- **[[GatewayBillingRunnerService]]** — injects: [[GatewayBillingService]]
  - injected by: _none_
- **[[GatewayBillingService]]** — injects: [[DatabaseService]], [[RoutersService]]
  - injected by: [[GatewayBillingRunnerService]]
- **[[MikroTikClientService]]** — injects: _none_
  - injected by: [[RoutersService]]
- **[[RouterUsageSamplerService]]** — injects: [[RoutersService]]
  - injected by: _none_
- **[[RoutersController]]** — injects: [[RoutersService]]
  - injected by: _none_
- **[[RoutersService]]** — injects: [[DatabaseService]], [[MikroTikClientService]], [[SecretVaultService]]
  - injected by: [[GatewayBillingService]], [[RouterUsageSamplerService]], [[RoutersController]], [[VillageFailoverService]]
- **[[VillageFailoverService]]** — injects: [[OperationsService]], [[RoutersService]]
  - injected by: _none_

## Tests importing this module (VERIFIED / EXTRACTED)
- `apps/backend/test/gateway-billing.test.ts`
- `apps/backend/test/router-customer-invariants.test.ts`

## Tests by filename convention (CONVENTION — not verified coverage)
_none_

## Related tests (HEURISTIC — textual name reference)
- `apps/backend/test/customer-account-deletion.test.ts`
- `apps/backend/test/customer-account-merge.test.ts`
- `apps/backend/test/fake-db-harness.test.ts`
- `apps/backend/test/gems.test.ts`
- `apps/backend/test/telegram-topup-commission.test.ts`
- `apps/backend/test/telegram-topup.test.ts`
- `tests/e2e/dashboard-visual.spec.ts`

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
