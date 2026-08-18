> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Module: `client`

- **Source path:** `apps/backend/src/client/`
- **Dominant graph community (hint, not authoritative):** Client Provisioning
- **High-risk dependencies (DERIVED):** [[tbl-client_configs]], [[tbl-customer_accounts]], [[tbl-wireguard_peers]]

## Services / classes (VERIFIED)
- [[ActiveClientRow]] — `apps/backend/src/client/xray-provisioning.service.ts:L13`
- [[AddUserInput]] — `apps/backend/src/client/xray-provisioning.ts:L6`
- [[AfrowsInboundParams]] — `apps/backend/src/client/afrows-entry-link.ts:L7`
- [[AfrowsWireguardServer]] — `apps/backend/src/client/afrows-wireguard.ts:L11`
- [[ClaimRewardedAdDto]] — `apps/backend/src/client/dto/rewarded-ad.dto.ts:L3`
- [[ClientAuthController]] — `apps/backend/src/client/client-auth.controller.ts:L11`
- [[ClientConfigRow]] — `apps/backend/src/client/connections.service.ts:L11`
- [[ClientController]] — `apps/backend/src/client/client.controller.ts:L22`
- [[ClientLoginDto]] — `apps/backend/src/client/dto/client-login.dto.ts:L3`
- [[ConnectionsService]] — `apps/backend/src/client/connections.service.ts:L25`
- [[InboundTraffic]] — `apps/backend/src/client/inbounds.service.ts:L10`
- [[InboundsService]] — `apps/backend/src/client/inbounds.service.ts:L22`
- [[OperationsOverviewService]] — `apps/backend/src/client/operations-overview.service.ts:L19`
- [[OverQuotaRow]] — `apps/backend/src/client/xray-usage-metering.service.ts:L11`
- [[SetEgressModeDto]] — `apps/backend/src/client/dto/egress-mode.dto.ts:L4`
- [[SetGamingModeDto]] — `apps/backend/src/client/dto/gaming-mode.dto.ts:L3`
- [[UpdateOwnClientRoutePreferenceDto]] — `apps/backend/src/client/dto/client-route-preference.dto.ts:L8`
- [[UsageDelta]] — `apps/backend/src/client/xray-usage.ts:L7`
- [[WireguardMeteringService]] — `apps/backend/src/client/wireguard-metering.service.ts:L16`
- [[XrayAccessLogService]] — `apps/backend/src/client/xray-access-log.service.ts:L15`
- [[XrayProvisioningService]] — `apps/backend/src/client/xray-provisioning.service.ts:L25`
- [[XrayUsageMeteringService]] — `apps/backend/src/client/xray-usage-metering.service.ts:L23`

## Database tables touched (VERIFIED — evidence-backed)
- [[tbl-client_configs]] ([[client_configs]])
- [[tbl-client_device_sightings]] ([[client_device_sightings]])
- [[tbl-customer_accounts]] ([[customer_accounts]])
- [[tbl-wireguard_peers]] ([[wireguard_peers]])

## Services sharing those tables (VERIFIED)
- [[BillingController]]
- [[BillingService]]
- [[GatewayBillingService]]
- [[GemsReason]]
- [[RoutersService]]
- [[TelegramBotService]]
- [[TelegramTopupAdminService]]
- [[customer-account-deletion.ts]]
- [[customer-account-merge.ts]]
- [[phone-identity.ts]]
- [[reseller-ownership.ts]]
- [[telegram-self-service.ts]]
- [[telegram-topup.ts]]

## Depends on — modules (VERIFIED: AST import/call edges)
- [[mod-billing]]
- [[mod-database]]
- [[mod-security]]

## Depended on by — modules (VERIFIED: AST import/call edges)
- [[mod-billing]]
- [[mod-operations]]

## Related tests (by reference)
- `apps/backend/test/customer-account-deletion.test.ts`
- `apps/backend/test/customer-account-merge.test.ts`
- `apps/backend/test/fake-db-harness.test.ts`
- `apps/backend/test/gems.test.ts`
- `apps/backend/test/telegram-topup-commission.test.ts`
- `apps/backend/test/telegram-topup.test.ts`

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
