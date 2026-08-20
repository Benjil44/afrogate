> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-20T16:27:17.978Z

# Architectural Hotspots (ranked)

_Metric = node degree (AST + bridge edges). Risk is **DERIVED** from degree/coupling — not a source-authored score._

## Service / code hubs

### [[BillingService]] — degree 291 — risk Critical (DERIVED)
- **Module:** [[mod-billing]] · source `apps/backend/src/billing/billing.service.ts:L747`
- **Tables (via this class):** [[tbl-billing_settings]], [[tbl-client_access_tokens]], [[tbl-client_configs]], [[tbl-client_device_sightings]], [[tbl-client_route_preferences]], [[tbl-client_subscription_credentials]], [[tbl-client_usage_events]], [[tbl-customer_accounts]], [[tbl-egress_tier_prices]], [[tbl-gems_ledger]], [[tbl-mikrotik_routers]], [[tbl-outbounds]], [[tbl-payment_methods]], [[tbl-payment_order_allocations]], [[tbl-payment_orders]], [[tbl-quota_charge_events]], [[tbl-reseller_accounts]], [[tbl-reseller_wallet_ledger]], [[tbl-reseller_wallet_topup_requests]], [[tbl-rewarded_ad_grants]], [[tbl-rewarded_ad_settings]], [[tbl-route_assignments]], [[tbl-servers]], [[tbl-telegram_users]], [[tbl-volume_packages]], [[tbl-wireguard_peers]]
- **Tables (via module):** [[tbl-billing_settings]], [[tbl-client_access_tokens]], [[tbl-client_configs]], [[tbl-client_device_sightings]], [[tbl-client_route_preferences]], [[tbl-client_subscription_credentials]], [[tbl-client_usage_events]], [[tbl-customer_accounts]], [[tbl-egress_tier_prices]], [[tbl-gems_ledger]], [[tbl-mikrotik_routers]], [[tbl-outbounds]], [[tbl-payment_methods]], [[tbl-payment_order_allocations]], [[tbl-payment_orders]], [[tbl-quota_charge_events]], [[tbl-reseller_accounts]], [[tbl-reseller_wallet_ledger]], [[tbl-reseller_wallet_topup_requests]], [[tbl-rewarded_ad_grants]], [[tbl-rewarded_ad_settings]], [[tbl-route_assignments]], [[tbl-servers]], [[tbl-telegram_users]], [[tbl-volume_packages]], [[tbl-wireguard_peers]]
- **DI fan-out (9) — depends on (VERIFIED):** [[AuditService]], [[DatabaseService]], [[PayPalPaymentService]], [[RewardedAdWebhookService]], [[SecretVaultService]], [[TelegramAlertService]], [[TelegramBotConfigService]], [[XrayProvisioningService]], [[XrayUsageMeteringService]]
- **DI fan-in (7) — depended on by (VERIFIED):** [[BillingController]], [[ClientAuthController]], [[ClientController]], [[ClientTokenGuard]], [[PayPalWebhookController]], [[RewardedAdWebhookController]], [[TelegramBotService]]
- **Recommended tests (VERIFIED / EXTRACTED):** `apps/backend/test/allocation-idempotency.test.ts`, `apps/backend/test/billing-math.test.ts`, `apps/backend/test/billing-normalizers.test.ts`, `apps/backend/test/client-route-mapping.test.ts`, `apps/backend/test/customer-account-deletion.test.ts`, `apps/backend/test/customer-account-merge.test.ts`, `apps/backend/test/date-utils.test.ts`, `apps/backend/test/device-sharing.test.ts`, `apps/backend/test/fake-db-harness.test.ts`, `apps/backend/test/gems.test.ts`, `apps/backend/test/payment-validators.test.ts`, `apps/backend/test/paypal-webhook-verify.test.ts`, `apps/backend/test/paypal-webhook.test.ts`, `apps/backend/test/phone-identity.test.ts`, `apps/backend/test/quota-math.test.ts`, `apps/backend/test/record-utils.test.ts`, `apps/backend/test/reseller-ownership.test.ts`, `apps/backend/test/reseller-topup.test.ts`, `apps/backend/test/reseller-wallet-math.test.ts`, `apps/backend/test/rewarded-ad-webhook.crypto.test.ts`, `apps/backend/test/rewarded-ad.test.ts`, `apps/backend/test/subscription-sanitizers.test.ts`, `apps/backend/test/telegram-connect.test.ts`, `apps/backend/test/telegram-self-service.test.ts`, `apps/backend/test/telegram-topup-commission.test.ts`, `apps/backend/test/telegram-topup.test.ts`, `apps/backend/test/usage-normalizers.test.ts`
- **Also referenced (HEURISTIC — not import-verified):** `apps/backend/test/customer-account-deletion.test.ts`, `apps/backend/test/customer-account-merge.test.ts`, `apps/backend/test/fake-db-harness.test.ts`, `apps/backend/test/gems.test.ts`, `apps/backend/test/outbound-xray-config.test.ts`, `apps/backend/test/rbac.test.ts`, `apps/backend/test/reseller-topup.test.ts`, `apps/backend/test/telegram-topup-commission.test.ts`, `apps/backend/test/telegram-topup.test.ts`, `tests/e2e/client-smoke.spec.ts`, `tests/e2e/dashboard-visual.spec.ts`

### [[OperationsService]] — degree 272 — risk Critical (DERIVED)
- **Module:** [[mod-operations]] · source `apps/backend/src/operations/operations.service.ts:L625`
- **Tables (via this class):** [[tbl-alerts]], [[tbl-client_route_preferences]], [[tbl-outbound_health_checks]], [[tbl-outbound_subscriptions]], [[tbl-outbound_test_settings]], [[tbl-outbounds]], [[tbl-protocol_apply_events]], [[tbl-protocol_setups]], [[tbl-route_assignments]], [[tbl-route_decision_events]], [[tbl-route_failover_events]], [[tbl-route_quality_hourly]], [[tbl-route_settings]], [[tbl-secret_records]], [[tbl-server_access_profiles]], [[tbl-server_credentials]], [[tbl-server_interfaces]], [[tbl-server_metrics]], [[tbl-servers]], [[tbl-tunnels]]
- **Tables (via module):** [[tbl-alerts]], [[tbl-client_route_preferences]], [[tbl-outbound_health_checks]], [[tbl-outbound_subscriptions]], [[tbl-outbound_test_settings]], [[tbl-outbounds]], [[tbl-protocol_apply_events]], [[tbl-protocol_setups]], [[tbl-route_assignments]], [[tbl-route_decision_events]], [[tbl-route_failover_events]], [[tbl-route_quality_hourly]], [[tbl-route_settings]], [[tbl-secret_records]], [[tbl-server_access_profiles]], [[tbl-server_credentials]], [[tbl-server_interfaces]], [[tbl-server_metrics]], [[tbl-servers]], [[tbl-tunnels]]
- **DI fan-out (4) — depends on (VERIFIED):** [[AuditService]], [[DatabaseService]], [[RouteQualityAggregationService]], [[SecretVaultService]]
- **DI fan-in (5) — depended on by (VERIFIED):** [[AdminReportsService]], [[AlertNotificationService]], [[OperationsController]], [[OutboundSubscriptionRefreshService]], [[VillageFailoverService]]
- **Recommended tests (VERIFIED / EXTRACTED):** `apps/backend/test/command-safety.test.ts`, `apps/backend/test/outbound-scoring.test.ts`, `apps/backend/test/outbound-vless-parser.test.ts`, `apps/backend/test/request-normalizers.test.ts`, `apps/backend/test/route-bufferbloat.test.ts`, `apps/backend/test/route-metrics.test.ts`, `apps/backend/test/route-quality.test.ts`, `apps/backend/test/route-scoring.test.ts`, `apps/backend/test/subscription-sanitizers.test.ts`, `apps/backend/test/timeline-severity.test.ts`
- **Also referenced (HEURISTIC — not import-verified):** `apps/backend/test/outbound-xray-config.test.ts`, `apps/backend/test/rbac.test.ts`, `tests/e2e/client-smoke.spec.ts`, `tests/e2e/dashboard-visual.spec.ts`

### [[Roles()]] — degree 181 — risk High (DERIVED)
- **Module:** [[mod-security]] · source `apps/backend/src/security/roles.decorator.ts:L7`
- **Tables (via module):** [[tbl-agent_tokens]], [[tbl-servers]]
- **Recommended tests (VERIFIED / EXTRACTED):** `apps/backend/test/agent-token.test.ts`, `apps/backend/test/bearer-token.test.ts`, `apps/backend/test/client-token.test.ts`, `apps/backend/test/generate-password.test.ts`, `apps/backend/test/password.test.ts`, `apps/backend/test/rate-limit-window.test.ts`, `apps/backend/test/reseller-impersonation.test.ts`, `apps/backend/test/session-token.test.ts`

### [[requestAdminAuth()]] — degree 136 — risk High (DERIVED)
- **Module:** _n/a_ · source `apps/dashboard/src/api/admin.ts:L1786`

### [[AuthActor]] — degree 130 — risk High (DERIVED)
- **Module:** [[mod-security]] · source `apps/backend/src/security/auth-request.ts:L10`
- **Tables (via module):** [[tbl-agent_tokens]], [[tbl-servers]]
- **Recommended tests (VERIFIED / EXTRACTED):** `apps/backend/test/agent-token.test.ts`, `apps/backend/test/bearer-token.test.ts`, `apps/backend/test/client-token.test.ts`, `apps/backend/test/generate-password.test.ts`, `apps/backend/test/password.test.ts`, `apps/backend/test/rate-limit-window.test.ts`, `apps/backend/test/reseller-impersonation.test.ts`, `apps/backend/test/session-token.test.ts`

### [[TelegramBotService]] — degree 99 — risk Medium (DERIVED)
- **Module:** [[mod-telegram]] · source `apps/backend/src/telegram/telegram-bot.service.ts:L104`
- **Tables (via this class):** [[tbl-client_configs]], [[tbl-telegram_topup_requests]], [[tbl-telegram_users]]
- **Tables (via module):** [[tbl-client_configs]], [[tbl-customer_accounts]], [[tbl-gems_ledger]], [[tbl-secret_records]], [[tbl-telegram_bot_settings]], [[tbl-telegram_topup_requests]], [[tbl-telegram_users]], [[tbl-volume_packages]]
- **DI fan-out (4) — depends on (VERIFIED):** [[BillingService]], [[DatabaseService]], [[TelegramAlertService]], [[TelegramBotConfigService]]
- **DI fan-in (2) — depended on by (VERIFIED):** [[TelegramBotController]], [[TelegramPollingService]]
- **Recommended tests (VERIFIED / EXTRACTED):** `apps/backend/test/customer-account-deletion.test.ts`, `apps/backend/test/customer-account-merge.test.ts`, `apps/backend/test/fake-db-harness.test.ts`, `apps/backend/test/reseller-ownership.test.ts`, `apps/backend/test/telegram-connect.test.ts`, `apps/backend/test/telegram-format.test.ts`, `apps/backend/test/telegram-i18n.test.ts`, `apps/backend/test/telegram-profile.test.ts`, `apps/backend/test/telegram-self-service.test.ts`, `apps/backend/test/telegram-topup-commission.test.ts`, `apps/backend/test/telegram-topup.test.ts`, `apps/backend/test/telegram-webhook-secret.test.ts`
- **Also referenced (HEURISTIC — not import-verified):** `apps/backend/test/customer-account-deletion.test.ts`, `apps/backend/test/customer-account-merge.test.ts`, `apps/backend/test/telegram-topup-commission.test.ts`, `apps/backend/test/telegram-topup.test.ts`

### [[BillingController]] — degree 86 — risk Medium (DERIVED)
- **Module:** [[mod-billing]] · source `apps/backend/src/billing/billing.controller.ts:L125`
- **Tables (via this class):** [[tbl-client_configs]]
- **Tables (via module):** [[tbl-billing_settings]], [[tbl-client_access_tokens]], [[tbl-client_configs]], [[tbl-client_device_sightings]], [[tbl-client_route_preferences]], [[tbl-client_subscription_credentials]], [[tbl-client_usage_events]], [[tbl-customer_accounts]], [[tbl-egress_tier_prices]], [[tbl-gems_ledger]], [[tbl-mikrotik_routers]], [[tbl-outbounds]], [[tbl-payment_methods]], [[tbl-payment_order_allocations]], [[tbl-payment_orders]], [[tbl-quota_charge_events]], [[tbl-reseller_accounts]], [[tbl-reseller_wallet_ledger]], [[tbl-reseller_wallet_topup_requests]], [[tbl-rewarded_ad_grants]], [[tbl-rewarded_ad_settings]], [[tbl-route_assignments]], [[tbl-servers]], [[tbl-telegram_users]], [[tbl-volume_packages]], [[tbl-wireguard_peers]]
- **DI fan-out (2) — depends on (VERIFIED):** [[AuthService]], [[BillingService]]
- **DI fan-in (0) — depended on by (VERIFIED):** _none_
- **Recommended tests (VERIFIED / EXTRACTED):** `apps/backend/test/allocation-idempotency.test.ts`, `apps/backend/test/billing-math.test.ts`, `apps/backend/test/billing-normalizers.test.ts`, `apps/backend/test/client-route-mapping.test.ts`, `apps/backend/test/customer-account-deletion.test.ts`, `apps/backend/test/customer-account-merge.test.ts`, `apps/backend/test/date-utils.test.ts`, `apps/backend/test/device-sharing.test.ts`, `apps/backend/test/fake-db-harness.test.ts`, `apps/backend/test/gems.test.ts`, `apps/backend/test/payment-validators.test.ts`, `apps/backend/test/paypal-webhook-verify.test.ts`, `apps/backend/test/paypal-webhook.test.ts`, `apps/backend/test/phone-identity.test.ts`, `apps/backend/test/quota-math.test.ts`, `apps/backend/test/record-utils.test.ts`, `apps/backend/test/reseller-ownership.test.ts`, `apps/backend/test/reseller-topup.test.ts`, `apps/backend/test/reseller-wallet-math.test.ts`, `apps/backend/test/rewarded-ad-webhook.crypto.test.ts`, `apps/backend/test/rewarded-ad.test.ts`, `apps/backend/test/subscription-sanitizers.test.ts`, `apps/backend/test/usage-normalizers.test.ts`
- **Also referenced (HEURISTIC — not import-verified):** `apps/backend/test/customer-account-deletion.test.ts`, `apps/backend/test/customer-account-merge.test.ts`

### [[AuthService]] — degree 58 — risk Medium (DERIVED)
- **Module:** [[mod-auth]] · source `apps/backend/src/auth/auth.service.ts:L98`
- **Tables (via this class):** [[tbl-admin_users]]
- **Tables (via module):** [[tbl-admin_users]]
- **DI fan-out (2) — depends on (VERIFIED):** [[AuditService]], [[DatabaseService]]
- **DI fan-in (4) — depended on by (VERIFIED):** [[AdminTokenGuard]], [[AuthController]], [[BillingController]], [[OperationsController]]
- **Recommended tests (VERIFIED / EXTRACTED):** `apps/backend/test/reseller-impersonation.test.ts`
- **Also referenced (HEURISTIC — not import-verified):** `apps/backend/test/reseller-impersonation.test.ts`

## Data hotspots (heavily-coupled tables)
- [[tbl-customer_accounts]] — 15 services — risk Critical (DERIVED)
- [[tbl-outbounds]] — 8 services — risk High (DERIVED)
- [[tbl-gems_ledger]] — 4 services — risk Medium (DERIVED)
- [[tbl-reseller_wallet_ledger]] — <3 services — risk Low (DERIVED)
- [[tbl-payment_orders]] — <3 services — risk Low (DERIVED)
- [[tbl-mikrotik_routers]] — <3 services — risk Low (DERIVED)
- [[tbl-telegram_users]] — 5 services — risk Medium (DERIVED)
- [[tbl-wireguard_peers]] — 6 services — risk High (DERIVED)

---
_[[_INDEX]]_
