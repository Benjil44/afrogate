> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Module: `telegram`

- **Source path:** `apps/backend/src/telegram/`
- **Dominant graph community (hint, not authoritative):** Telegram Bot - telegramTopupRequests
- **High-risk dependencies (DERIVED):** [[tbl-client_configs]], [[tbl-customer_accounts]]

## Services / classes (VERIFIED)
- [[AccountRow]] — `apps/backend/src/telegram/telegram-topup.ts:L75`
- [[ApproveTopupOutcome]] — `apps/backend/src/telegram/telegram-topup.ts:L155`
- [[BotApiAccess]] — `apps/backend/src/telegram/telegram-profile.service.ts:L18`
- [[ComputeQuotaAfter]] — `apps/backend/src/telegram/telegram-topup.ts:L50`
- [[ConnectDecision]] — `apps/backend/src/telegram/telegram-connect.ts:L32`
- [[ConnectDeps]] — `apps/backend/src/telegram/telegram-connect.ts:L94`
- [[ConnectInput]] — `apps/backend/src/telegram/telegram-connect.ts:L83`
- [[ConnectOutcome]] — `apps/backend/src/telegram/telegram-connect.ts:L76`
- [[CopyEntry]] — `apps/backend/src/telegram/telegram-i18n.ts:L142`
- [[Ctx]] — `apps/backend/src/telegram/telegram-bot.service.ts:L95`
- [[InviterRow]] — `apps/backend/src/telegram/telegram-topup.ts:L81`
- [[LinkAccountByPhoneInput]] — `apps/backend/src/telegram/telegram-self-service.ts:L75`
- [[PhoneMatchAccount]] — `apps/backend/src/telegram/telegram-self-service.ts:L28`
- [[PhoneRegistrationEvent]] — `apps/backend/src/telegram/telegram-self-service.ts:L38`
- [[ReferralAttribution]] — `apps/backend/src/telegram/telegram-self-service.ts:L41`
- [[RegisterInput]] — `apps/backend/src/telegram/telegram-self-service.ts:L52`
- [[RegisterResult]] — `apps/backend/src/telegram/telegram-self-service.ts:L64`
- [[RejectTelegramTopupDto]] — `apps/backend/src/telegram/dto/telegram-topup.dto.ts:L3`
- [[RejectTopupOutcome]] — `apps/backend/src/telegram/telegram-topup.ts:L307`
- [[SelfServiceAccount]] — `apps/backend/src/telegram/telegram-self-service.ts:L19`
- [[TelegramApiError]] — `apps/backend/src/telegram/telegram-profile.ts:L156`
- [[TelegramBotConfigService]] — `apps/backend/src/telegram/telegram-bot-config.service.ts:L94`
- [[TelegramBotController]] — `apps/backend/src/telegram/telegram-bot.controller.ts:L18`
- [[TelegramBotProfile]] — `apps/backend/src/telegram/telegram-profile.ts:L23`
- [[TelegramBotProfileState]] — `apps/backend/src/telegram/telegram-profile.ts:L37`
- [[TelegramBotProfileUpdate]] — `apps/backend/src/telegram/telegram-profile.ts:L30`
- [[TelegramBotRuntimeConfig]] — `apps/backend/src/telegram/telegram-bot-config.service.ts:L69`
- [[TelegramBotService]] — `apps/backend/src/telegram/telegram-bot.service.ts:L104`
- [[TelegramBotSettingsRow]] — `apps/backend/src/telegram/telegram-bot-config.service.ts:L19`
- [[TelegramCallbackQuery]] — `apps/backend/src/telegram/telegram-bot.service.ts:L85`
- [[TelegramConnectResolver]] — `apps/backend/src/telegram/telegram-connect.ts:L110`
- [[TelegramCopyId]] — `apps/backend/src/telegram/telegram-i18n.ts:L33`
- [[TelegramEnvelope]] — `apps/backend/src/telegram/telegram-profile.ts:L193`
- [[TelegramGemEconomy]] — `apps/backend/src/telegram/telegram-bot-config.service.ts:L54`
- [[TelegramGetMeResponse]] — `apps/backend/src/telegram/telegram-bot-config.service.ts:L83`
- [[TelegramGetterMethod]] — `apps/backend/src/telegram/telegram-profile.ts:L57`
- [[TelegramLanguage]] — `apps/backend/src/telegram/telegram-i18n.ts:L15`
- [[TelegramPollingService]] — `apps/backend/src/telegram/telegram-polling.service.ts:L23`
- [[TelegramProfileFieldKey]] — `apps/backend/src/telegram/telegram-profile.ts:L20`
- [[TelegramProfileFieldSpec]] — `apps/backend/src/telegram/telegram-profile.ts:L62`
- [[TelegramProfileService]] — `apps/backend/src/telegram/telegram-profile.service.ts:L33`
- [[TelegramProfileSetterCall]] — `apps/backend/src/telegram/telegram-profile.ts:L91`
- [[TelegramResultField]] — `apps/backend/src/telegram/telegram-profile.ts:L60`
- [[TelegramSecretKind]] — `apps/backend/src/telegram/telegram-bot-config.service.ts:L17`
- [[TelegramSecretRow]] — `apps/backend/src/telegram/telegram-bot-config.service.ts:L62`
- [[TelegramSelfServiceDeps]] — `apps/backend/src/telegram/telegram-self-service.ts:L84`
- [[TelegramSelfServiceProvisioner]] — `apps/backend/src/telegram/telegram-self-service.ts:L137`
- [[TelegramSetterMethod]] — `apps/backend/src/telegram/telegram-profile.ts:L59`
- [[TelegramTopupAdminController]] — `apps/backend/src/telegram/telegram-topup-admin.controller.ts:L32`
- [[TelegramTopupAdminService]] — `apps/backend/src/telegram/telegram-topup-admin.service.ts:L65`
- [[TelegramTopupListStatus]] — `apps/backend/src/telegram/telegram-topup-admin.service.ts:L18`
- [[TelegramTopupStatus]] — `apps/backend/src/telegram/telegram-topup.ts:L40`
- [[TelegramUserRecord]] — `apps/backend/src/telegram/telegram-user-store.ts:L40`
- [[TelegramUserRow]] — `apps/backend/src/telegram/telegram-user-store.ts:L48`
- [[TelegramUserState]] — `apps/backend/src/telegram/telegram-user-store.ts:L16`
- [[TelegramWebhookMessage]] — `apps/backend/src/telegram/telegram-bot.service.ts:L75`
- [[TopupGemEconomy]] — `apps/backend/src/telegram/telegram-topup.ts:L172`
- [[TopupListRow]] — `apps/backend/src/telegram/telegram-topup-admin.service.ts:L20`
- [[TopupReferralCommission]] — `apps/backend/src/telegram/telegram-topup.ts:L87`
- [[TopupRequestRow]] — `apps/backend/src/telegram/telegram-topup.ts:L64`
- [[UpdateTelegramBotProfileDto]] — `apps/backend/src/telegram/dto/telegram-bot-profile.dto.ts:L10`
- [[VolumePackageRow]] — `apps/backend/src/telegram/telegram-topup.ts:L96`

## Database tables touched (VERIFIED — evidence-backed)
- [[tbl-client_configs]] ([[client_configs]])
- [[tbl-customer_accounts]] ([[customer_accounts]])
- [[tbl-gems_ledger]] ([[gems_ledger]])
- [[tbl-secret_records]] ([[secret_records]])
- [[tbl-telegram_bot_settings]] ([[telegram_bot_settings]])
- [[tbl-telegram_topup_requests]] ([[telegram_topup_requests]])
- [[tbl-telegram_users]] ([[telegram_users]])
- [[tbl-volume_packages]] ([[volume_packages]])

## Services sharing those tables (VERIFIED)
- [[BillingController]]
- [[BillingService]]
- [[ConnectionsService]]
- [[GatewayBillingService]]
- [[GemsReason]]
- [[OperationsOverviewService]]
- [[OperationsService]]
- [[RoutersService]]
- [[WireguardMeteringService]]
- [[XrayProvisioningService]]
- [[XrayUsageMeteringService]]
- [[customer-account-deletion.ts]]
- [[customer-account-merge.ts]]
- [[phone-identity.ts]]
- [[reseller-ownership.ts]]

## Depends on — modules (VERIFIED: AST import/call edges)
- [[mod-audit]]
- [[mod-billing]]
- [[mod-database]]
- [[mod-notifications]]
- [[mod-operations]]
- [[mod-outbound]]
- [[mod-routers]]
- [[mod-security]]

## Depended on by — modules (VERIFIED: AST import/call edges)
- [[mod-billing]]
- [[mod-notifications]]
- [[mod-operations]]

## Related tests (by reference)
- `apps/backend/test/customer-account-deletion.test.ts`
- `apps/backend/test/customer-account-merge.test.ts`
- `apps/backend/test/fake-db-harness.test.ts`
- `apps/backend/test/gems.test.ts`
- `apps/backend/test/telegram-connect.test.ts`
- `apps/backend/test/telegram-profile.test.ts`
- `apps/backend/test/telegram-self-service.test.ts`
- `apps/backend/test/telegram-topup-commission.test.ts`
- `apps/backend/test/telegram-topup.test.ts`

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
