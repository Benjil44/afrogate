> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-09-11T23:01:53.278Z

# Module: `billing`

- **Source path:** `apps/backend/src/billing/`
- **Dominant graph community (hint, not authoritative):** customer-account-deletion.ts
- **High-risk dependencies (DERIVED):** [[tbl-client_configs]], [[tbl-customer_accounts]], [[tbl-outbounds]], [[tbl-servers]], [[tbl-wireguard_peers]]

## Services / classes (VERIFIED)
- [[AccountClientConfigRow]] — `apps/backend/src/billing/customer-account-deletion.ts:L34`
- [[AdjustCustomerGemsDto]] — `apps/backend/src/billing/dto/customer-account.dto.ts:L260`
- [[AllocatePaymentOrderDto]] — `apps/backend/src/billing/dto/billing.dto.ts:L397`
- [[ApproveResellerTopupOutcome]] — `apps/backend/src/billing/reseller-topup.ts:L59`
- [[BillingController]] — `apps/backend/src/billing/billing.controller.ts:L131`
- [[BillingService]] — `apps/backend/src/billing/billing.service.ts:L795`
- [[BillingSettingsRow]] — `apps/backend/src/billing/billing.service.ts:L534`
- [[CapturePayPalOrderInput]] — `apps/backend/src/billing/paypal-payment.service.ts:L27`
- [[CapturePayPalPaymentOrderDto]] — `apps/backend/src/billing/dto/billing.dto.ts:L442`
- [[ClientAccessTokenAuthRow]] — `apps/backend/src/billing/billing.service.ts:L388`
- [[ClientAccessTokenRow]] — `apps/backend/src/billing/billing.service.ts:L377`
- [[ClientConfigRow]] — `apps/backend/src/billing/billing.service.ts:L294`
- [[ClientPortalRow]] — `apps/backend/src/billing/billing.service.ts:L414`
- [[ClientRouteOptionOutboundRow]] — `apps/backend/src/billing/billing.service.ts:L513`
- [[ClientRoutePreferencePatch]] — `apps/backend/src/billing/billing.service.ts:L362`
- [[ClientRoutePreferenceRow]] — `apps/backend/src/billing/billing.service.ts:L337`
- [[ClientSubscriptionCredentialRenderResult]] — `apps/backend/src/billing/subscription-sanitizers.ts:L3`
- [[ClientSubscriptionCredentialRow]] — `apps/backend/src/billing/billing.service.ts:L394`
- [[ClientUsageEventFilters]] — `apps/backend/src/billing/billing.service.ts:L761`
- [[ClientUsageEventRow]] — `apps/backend/src/billing/billing.service.ts:L433`
- [[CreateClientConfigDto]] — `apps/backend/src/billing/dto/customer-account.dto.ts:L361`
- [[CreateClientUsageEventDto]] — `apps/backend/src/billing/dto/customer-account.dto.ts:L530`
- [[CreateCustomerAccountDto]] — `apps/backend/src/billing/dto/customer-account.dto.ts:L61`
- [[CreatePayPalCheckoutDto]] — `apps/backend/src/billing/dto/billing.dto.ts:L408`
- [[CreatePayPalCheckoutInput]] — `apps/backend/src/billing/paypal-payment.service.ts:L11`
- [[CreatePaymentMethodDto]] — `apps/backend/src/billing/dto/billing.dto.ts:L202`
- [[CreatePaymentOrderDto]] — `apps/backend/src/billing/dto/billing.dto.ts:L329`
- [[CreatePaymentProviderCheckoutDto]] — `apps/backend/src/billing/dto/billing.dto.ts:L425`
- [[CreateResellerAccountDto]] — `apps/backend/src/billing/dto/reseller.dto.ts:L12`
- [[CreateResellerGbChargeDto]] — `apps/backend/src/billing/dto/reseller.dto.ts:L230`
- [[CreateResellerPackageSaleDto]] — `apps/backend/src/billing/dto/reseller.dto.ts:L281`
- [[CreateResellerTopupRequestDto]] — `apps/backend/src/billing/dto/reseller.dto.ts:L261`
- [[CreateVolumePackageDto]] — `apps/backend/src/billing/dto/billing.dto.ts:L82`
- [[CurrentPanelImportConfigsDto]] — `apps/backend/src/billing/dto/customer-account.dto.ts:L316`
- [[CurrentPanelImportPreviewDto]] — `apps/backend/src/billing/dto/customer-account.dto.ts:L295`
- [[CurrentPanelUsageSyncDto]] — `apps/backend/src/billing/dto/customer-account.dto.ts:L321`
- [[CurrentPanelVolumeChargeClientQuotaChange]] — `apps/backend/src/billing/billing.service.ts:L715`
- [[CurrentPanelVolumeChargeDto]] — `apps/backend/src/billing/dto/customer-account.dto.ts:L326`
- [[CurrentPanelVolumeChargeEventRow]] — `apps/backend/src/billing/billing.service.ts:L698`
- [[CustomerAccountArchiveOutcome]] — `apps/backend/src/billing/customer-account-deletion.ts:L39`
- [[CustomerAccountArchivedFilter]] — `apps/backend/src/billing/customer-account-deletion.ts:L50`
- [[CustomerAccountFilters]] — `apps/backend/src/billing/billing.service.ts:L721`
- [[CustomerAccountMergeOutcome]] — `apps/backend/src/billing/customer-account-merge.ts:L93`
- [[CustomerAccountPhoneMatch]] — `apps/backend/src/billing/billing.service.ts:L275`
- [[CustomerAccountRestoreOutcome]] — `apps/backend/src/billing/customer-account-deletion.ts:L128`
- [[CustomerAccountRow]] — `apps/backend/src/billing/billing.service.ts:L239`
- [[DebitResellerWalletForPackageDto]] — `apps/backend/src/billing/dto/reseller.dto.ts:L198`
- [[ExistingAllocationDecision]] — `apps/backend/src/billing/allocation-idempotency.ts:L9`
- [[ExtractedPanelRow]] — `apps/backend/src/billing/current-panel-import.adapters.ts:L74`
- [[ExtractionResult]] — `apps/backend/src/billing/current-panel-import.adapters.ts:L81`
- [[GemsReason]] — `apps/backend/src/billing/gems.ts:L49`
- [[IssueClientAccessTokenDto]] — `apps/backend/src/billing/dto/client-access-token.dto.ts:L3`
- [[MergeAccountRow]] — `apps/backend/src/billing/customer-account-merge.ts:L82`
- [[MergeCustomerAccountDto]] — `apps/backend/src/billing/dto/customer-account.dto.ts:L274`
- [[NormalizedClientUsageEventInput]] — `apps/backend/src/billing/billing.service.ts:L488`
- [[Outbound]] — `apps/backend/src/billing/subscription-sanitizers.ts:L11`
- [[PayPalAccessTokenResponse]] — `apps/backend/src/billing/paypal-payment.service.ts:L63`
- [[PayPalCaptureResult]] — `apps/backend/src/billing/paypal-payment.service.ts:L33`
- [[PayPalCheckoutResult]] — `apps/backend/src/billing/paypal-payment.service.ts:L21`
- [[PayPalOrderLink]] — `apps/backend/src/billing/paypal-payment.service.ts:L69`
- [[PayPalOrderResponse]] — `apps/backend/src/billing/paypal-payment.service.ts:L74`
- [[PayPalPaymentService]] — `apps/backend/src/billing/paypal-payment.service.ts:L86`
- [[PayPalRuntimeConfig]] — `apps/backend/src/billing/paypal-payment.service.ts:L53`
- [[PayPalWebhookController]] — `apps/backend/src/billing/paypal-webhook.controller.ts:L8`
- [[PayPalWebhookSignatureHeaders]] — `apps/backend/src/billing/paypal-payment.service.ts:L40`
- [[PayPalWebhookSignatureHeaders]] — `apps/backend/src/billing/paypal-webhook-verify.ts:L3`
- [[PayPalWebhookVerificationResponse]] — `apps/backend/src/billing/paypal-payment.service.ts:L81`
- [[PaymentMethodFilters]] — `apps/backend/src/billing/billing.service.ts:L745`
- [[PaymentMethodRow]] — `apps/backend/src/billing/billing.service.ts:L627`
- [[PaymentOrderAllocationRow]] — `apps/backend/src/billing/billing.service.ts:L684`
- [[PaymentOrderFilters]] — `apps/backend/src/billing/billing.service.ts:L751`
- [[PaymentOrderRow]] — `apps/backend/src/billing/billing.service.ts:L646`
- [[PaymentProviderAdapterMethodInput]] — `apps/backend/src/billing/payment-provider-adapters.ts:L21`
- [[PaymentProviderAdapterOrderInput]] — `apps/backend/src/billing/payment-provider-adapters.ts:L11`
- [[PreferredOutboundRow]] — `apps/backend/src/billing/billing.service.ts:L528`
- [[PreparePaymentProviderCheckoutInput]] — `apps/backend/src/billing/payment-provider-adapters.ts:L31`
- [[PreparedPaymentProviderCheckout]] — `apps/backend/src/billing/payment-provider-adapters.ts:L39`
- [[RatedOutboundRow]] — `apps/backend/src/billing/billing.service.ts:L507`
- [[RedeemGemsResult]] — `apps/backend/src/billing/gems.ts:L105`
- [[ReferralMilestoneCredit]] — `apps/backend/src/billing/gems.ts:L284`
- [[ReferralRewardConfig]] — `apps/backend/src/billing/gems.ts:L298`
- [[ReferralSignupCredit]] — `apps/backend/src/billing/gems.ts:L290`
- [[RejectResellerTelegramLinkDto]] — `apps/backend/src/billing/dto/reseller.dto.ts:L164`
- [[RejectResellerTopupDto]] — `apps/backend/src/billing/dto/reseller.dto.ts:L274`
- [[RejectResellerTopupOutcome]] — `apps/backend/src/billing/reseller-topup.ts:L173`
- [[RequestResellerTelegramLinkDto]] — `apps/backend/src/billing/dto/reseller.dto.ts:L144`
- [[ResellerAccountFilters]] — `apps/backend/src/billing/billing.service.ts:L730`
- [[ResellerAccountRow]] — `apps/backend/src/billing/billing.service.ts:L560`
- [[ResellerRow]] — `apps/backend/src/billing/reseller-topup.ts:L42`
- [[ResellerSaleAmounts]] — `apps/backend/src/billing/reseller-wallet-math.ts:L24`
- [[ResellerTopupRequestRow]] — `apps/backend/src/billing/billing.service.ts:L589`
- [[ResellerTopupRequestStatus]] — `apps/backend/src/billing/reseller-topup.ts:L20`
- [[ResellerWalletLedgerRow]] — `apps/backend/src/billing/billing.service.ts:L604`
- [[RewardedAdGrantCreateState]] — `apps/backend/src/billing/billing.service.ts:L766`
- [[RewardedAdGrantRow]] — `apps/backend/src/billing/billing.service.ts:L469`
- [[RewardedAdProviderWebhookDto]] — `apps/backend/src/billing/dto/rewarded-ad-webhook.dto.ts:L4`
- [[RewardedAdSettingsRow]] — `apps/backend/src/billing/billing.service.ts:L457`
- [[RewardedAdWebhookController]] — `apps/backend/src/billing/rewarded-ad-webhook.controller.ts:L9`
- [[RewardedAdWebhookService]] — `apps/backend/src/billing/rewarded-ad-webhook.service.ts:L27`
- [[RewardedAdWebhookSignatureHeaders]] — `apps/backend/src/billing/rewarded-ad-webhook.service.ts:L13`
- [[SetCustomerAccountPasswordDto]] — `apps/backend/src/billing/dto/customer-account.dto.ts:L52`
- [[SetEgressTierPriceDto]] — `apps/backend/src/billing/dto/customer-account.dto.ts:L280`
- [[TelegramFulfillmentClientRow]] — `apps/backend/src/billing/billing.service.ts:L328`
- [[TopUpResellerWalletDto]] — `apps/backend/src/billing/dto/reseller.dto.ts:L171`
- [[TopupRequestRow]] — `apps/backend/src/billing/reseller-topup.ts:L34`
- [[UpdateBillingSettingsDto]] — `apps/backend/src/billing/dto/billing.dto.ts:L28`
- [[UpdateClientConfigDto]] — `apps/backend/src/billing/dto/customer-account.dto.ts:L420`
- [[UpdateCustomerAccountDto]] — `apps/backend/src/billing/dto/customer-account.dto.ts:L167`
- [[UpdateGbPriceDto]] — `apps/backend/src/billing/dto/billing.dto.ts:L42`
- [[UpdatePaymentMethodDto]] — `apps/backend/src/billing/dto/billing.dto.ts:L265`
- [[UpdatePaymentOrderStatusDto]] — `apps/backend/src/billing/dto/billing.dto.ts:L368`
- [[UpdateResellerAccountDto]] — `apps/backend/src/billing/dto/reseller.dto.ts:L86`
- [[UpdateRewardedAdSettingsDto]] — `apps/backend/src/billing/dto/billing.dto.ts:L52`
- [[UpdateVolumePackageDto]] — `apps/backend/src/billing/dto/billing.dto.ts:L141`
- [[UploadedReceiptFile]] — `apps/backend/src/billing/billing.controller.ts:L122`
- [[UpsertClientRoutePreferenceDto]] — `apps/backend/src/billing/dto/customer-account.dto.ts:L477`
- [[UpsertClientSubscriptionCredentialDto]] — `apps/backend/src/billing/dto/customer-account.dto.ts:L596`
- [[VerifiedPayPalWebhook]] — `apps/backend/src/billing/paypal-payment.service.ts:L48`
- [[VerifiedPayPalWebhook]] — `apps/backend/src/billing/paypal-webhook-verify.ts:L11`
- [[VerifiedRewardedAdWebhook]] — `apps/backend/src/billing/rewarded-ad-webhook.service.ts:L18`
- [[VolumePackageFilters]] — `apps/backend/src/billing/billing.service.ts:L740`
- [[VolumePackageRow]] — `apps/backend/src/billing/billing.service.ts:L543`
- [[WireguardPeerRecord]] — `apps/backend/src/billing/billing.service.ts:L286`
- [[payPalWebhookPaymentUpdate]] — `apps/backend/src/billing/paypal-webhook.ts:L21`

## Database tables touched (VERIFIED — evidence-backed)
- [[tbl-billing_settings]] ([[billing_settings]])
- [[tbl-client_access_tokens]] ([[client_access_tokens]])
- [[tbl-client_configs]] ([[client_configs]])
- [[tbl-client_device_sightings]] ([[client_device_sightings]])
- [[tbl-client_route_preferences]] ([[client_route_preferences]])
- [[tbl-client_subscription_credentials]] ([[client_subscription_credentials]])
- [[tbl-client_usage_events]] ([[client_usage_events]])
- [[tbl-customer_accounts]] ([[customer_accounts]])
- [[tbl-egress_tier_prices]] ([[egress_tier_prices]])
- [[tbl-gems_ledger]] ([[gems_ledger]])
- [[tbl-mikrotik_routers]] ([[mikrotik_routers]])
- [[tbl-outbounds]] ([[outbounds]])
- [[tbl-payment_methods]] ([[payment_methods]])
- [[tbl-payment_order_allocations]] ([[payment_order_allocations]])
- [[tbl-payment_orders]] ([[payment_orders]])
- [[tbl-quota_charge_events]] ([[quota_charge_events]])
- [[tbl-reseller_accounts]] ([[reseller_accounts]])
- [[tbl-reseller_wallet_ledger]] ([[reseller_wallet_ledger]])
- [[tbl-reseller_wallet_topup_requests]] ([[reseller_wallet_topup_requests]])
- [[tbl-rewarded_ad_grants]] ([[rewarded_ad_grants]])
- [[tbl-rewarded_ad_settings]] ([[rewarded_ad_settings]])
- [[tbl-route_assignments]] ([[route_assignments]])
- [[tbl-servers]] ([[servers]])
- [[tbl-telegram_users]] ([[telegram_users]])
- [[tbl-volume_packages]] ([[volume_packages]])
- [[tbl-wireguard_peers]] ([[wireguard_peers]])

## Services sharing those tables (VERIFIED)
- [[AgentsService]]
- [[AlertEngineService]]
- [[ConnectionsService]]
- [[GatewayBillingService]]
- [[OperationsController]]
- [[OperationsOverviewService]]
- [[OperationsService]]
- [[OutboundHealthService]]
- [[OutboundSpeedTestService]]
- [[PostgresMetricsRepository]]
- [[RouteQualityAggregationService]]
- [[RoutersService]]
- [[TelegramBotService]]
- [[TelegramTopupAdminService]]
- [[WireguardMeteringService]]
- [[XrayAccessLogService]]
- [[XrayProvisioningService]]
- [[XrayUsageMeteringService]]
- [[agent-token.guard.ts]]
- [[telegram-self-service.ts]]
- [[telegram-topup.ts]]
- [[telegram-user-store.ts]]

## Depends on — modules (VERIFIED: AST import/call edges)
- [[mod-audit]]
- [[mod-auth]]
- [[mod-client]]
- [[mod-database]]
- [[mod-notifications]]
- [[mod-outbound]]
- [[mod-security]]
- [[mod-telegram]]

## Depended on by — modules (VERIFIED: AST import/call edges)
- [[mod-client]]
- [[mod-security]]
- [[mod-telegram]]

## Service dependency injection (VERIFIED / EXTRACTED — NestJS constructor DI)
- **[[BillingController]]** — injects: [[AuthService]], [[BillingService]]
  - injected by: _none_
- **[[BillingService]]** — injects: [[AuditService]], [[DatabaseService]], [[PayPalPaymentService]], [[RewardedAdWebhookService]], [[SecretVaultService]], [[TelegramAlertService]], [[TelegramBotConfigService]], [[XrayProvisioningService]], [[XrayUsageMeteringService]]
  - injected by: [[BillingController]], [[ClientAuthController]], [[ClientController]], [[ClientTokenGuard]], [[PayPalWebhookController]], [[RewardedAdWebhookController]], [[TelegramBotService]]
- **[[PayPalPaymentService]]** — injects: [[OutboundHttpService]]
  - injected by: [[BillingService]]
- **[[PayPalWebhookController]]** — injects: [[BillingService]]
  - injected by: _none_
- **[[RewardedAdWebhookController]]** — injects: [[BillingService]]
  - injected by: _none_
- **[[RewardedAdWebhookService]]** — injects: _none_
  - injected by: [[BillingService]]

## Tests importing this module (VERIFIED / EXTRACTED)
- `apps/backend/test/allocation-idempotency.test.ts`
- `apps/backend/test/billing-math.test.ts`
- `apps/backend/test/billing-normalizers.test.ts`
- `apps/backend/test/client-route-mapping.test.ts`
- `apps/backend/test/customer-account-deletion.test.ts`
- `apps/backend/test/customer-account-merge.test.ts`
- `apps/backend/test/date-utils.test.ts`
- `apps/backend/test/device-sharing.test.ts`
- `apps/backend/test/display-name.test.ts`
- `apps/backend/test/fake-db-harness.test.ts`
- `apps/backend/test/gems.test.ts`
- `apps/backend/test/payment-validators.test.ts`
- `apps/backend/test/paypal-webhook-verify.test.ts`
- `apps/backend/test/paypal-webhook.test.ts`
- `apps/backend/test/phone-identity.test.ts`
- `apps/backend/test/quota-math.test.ts`
- `apps/backend/test/record-utils.test.ts`
- `apps/backend/test/reseller-customer-guard.test.ts`
- `apps/backend/test/reseller-ownership.test.ts`
- `apps/backend/test/reseller-topup.test.ts`
- `apps/backend/test/reseller-wallet-math.test.ts`
- `apps/backend/test/rewarded-ad-webhook.crypto.test.ts`
- `apps/backend/test/rewarded-ad.test.ts`
- `apps/backend/test/subscription-sanitizers.test.ts`
- `apps/backend/test/usage-normalizers.test.ts`

## Tests by filename convention (CONVENTION — not verified coverage)
_none_

## Related tests (HEURISTIC — textual name reference)
- `apps/backend/test/customer-account-deletion.test.ts`
- `apps/backend/test/customer-account-merge.test.ts`
- `apps/backend/test/fake-db-harness.test.ts`
- `apps/backend/test/gems.test.ts`
- `apps/backend/test/germany-usage-db.test.ts`
- `apps/backend/test/outbound-xray-config.test.ts`
- `apps/backend/test/paypal-webhook.test.ts`
- `apps/backend/test/rbac.test.ts`
- `apps/backend/test/reseller-topup.test.ts`
- `apps/backend/test/telegram-topup-commission.test.ts`
- `apps/backend/test/telegram-topup.test.ts`
- `apps/backend/test/usage-accounting.test.ts`
- `tests/e2e/client-smoke.spec.ts`
- `tests/e2e/dashboard-visual.spec.ts`

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
