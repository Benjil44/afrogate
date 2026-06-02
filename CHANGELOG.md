# Changelog

## 0.114.16 - 2026-06-02

- Began the OperationsService split: peeled 13 pure route-metric/normalizer helpers (`averageMetric`, `minimumMetric`, `maximumMetric`, `calculateHandshakePenalty`, `mapWireGuardTelemetryStatus`, `numberFromConfig`, `extractEndpoint`, `extractLoadPercent`, `normalizeRouteDecisionCountryCode`, `clientConfigIdFromRouteAssignmentKey`, `normalizeRouteGroup`, `normalizeAssignmentKey`, `defaultSpeedProfileForProtocol`) into `operations/route-metrics.ts`; rewrote 54 callsites. Added 16 tests; backend suite now 320 tests. `operations.service.ts` down to ~9.25k.

## 0.114.15 - 2026-06-02

- Peeled the usage/charge-scope normalizers (`normalizeClientUsageSource`, `normalizeClientUsageDirection`, `normalizeCurrentPanelVolumeChargeScope`, `normalizeCurrentPanelChargeClientIds`) and their three allow-list `Set` constants out of BillingService into `billing/usage-normalizers.ts`; rewrote 5 callsites. Added 7 tests (allow-list enforcement, defaulting, dedup/sort); backend suite now 304 tests.

## 0.114.14 - 2026-06-02

- Peeled the zero-dependency client-route mapping helpers (`clientRouteHealthRank`, `mapClientScoreProfileToProtocol`, `mapClientScoreProfileToSpeed`, `clientRouteAssignmentKey`) out of BillingService into `billing/client-route-mapping.ts`; rewrote 8 callsites. Added 5 tests; backend suite now 297 tests.

## 0.114.13 - 2026-06-02

- Peeled the subscription config renderers (`renderVlessClientUri`, `renderWireGuardClientConfig`, `renderL2tpClientProfile`, `renderIkev2ClientProfile`, `subscriptionConfigFormat`, `subscriptionSecretMissingFields`, `subscriptionPublicProfile`, `invalidSubscriptionCredential`, `isUuidValue`) and the `ClientSubscriptionCredentialRenderResult` type out of BillingService, co-locating them with their sanitizer dependencies in `billing/subscription-sanitizers.ts`; rewrote 10 callsites. The impure `renderClientSubscriptionCredential` (secret-vault decrypt) stays in the service and now calls the extracted renderers. Added 14 tests covering VLESS URI/IPv6 bracketing, WireGuard/L2TP/IKEv2 profiles, missing-field handling, and CRLF-injection rejection through the renderers; backend suite now 292 tests.

## 0.114.12 - 2026-06-02

- Peeled the rewarded-ad helpers (`normalizeRewardedAdProvider`, `assertRewardedAdSettingsLimits`) and their bounds constants (`DEFAULT_REWARDED_AD_PROVIDER`, `MAX_REWARDED_AD_REWARD_BYTES`, `MAX_REWARDED_AD_DAILY_LIMIT`) out of BillingService into `billing/rewarded-ad.ts`; the shared default-provider constant is re-imported by the service. Added 7 tests (provider slugification/fallback/length, reward/daily-limit bounds); backend suite now 278 tests.

## 0.114.11 - 2026-06-02

- Peeled the subscription-config sanitizers (`sanitizeSubscriptionConfigValue`, `scalarCredentialValue`, `firstCredentialString`, `firstCredentialList`, `endpointHostPort`, `firstSafeEndpointNumber`, `parseSubscriptionAddress`, `subscriptionEndpointTarget`) out of BillingService into `billing/subscription-sanitizers.ts`; rewrote 27 callsites. Added 18 tests, including explicit CR/LF/NUL injection-rejection coverage for the credential/endpoint guards and IPv6/scheme address parsing; backend suite now 271 tests. (`firstSafeEndpointString` stays in the service as it depends on `normalizePublicEndpointValue`.)

## 0.114.10 - 2026-06-02

- Peeled the PayPal webhook helpers (`payPalWebhookPaymentUpdate` status machine, `assertPayPalPaymentOrder`, `extractPayPalWebhookOrderId`, `extractPayPalWebhookCaptureId`, `mergePayPalMetadata`) out of BillingService into a self-contained `billing/paypal-webhook.ts`; rewrote 8 callsites. Added 15 tests covering the full capture/refund state machine (incl. idempotent already-paid and ignored non-pending paths) and id extraction; backend suite now 253 tests.

## 0.114.9 - 2026-06-02

- Peeled the payment-order/metadata validators (`assertPaymentOrderStatusTransition`, `assertAmountRange`, `assertNoSecretLikeKeys`, `stringifyPublicRecord`) out of BillingService into `billing/payment-validators.ts`; rewrote 20 callsites. Added 10 tests covering the status machine, amount bounds, and recursive secret-like-key rejection; backend suite now 238 tests.

## 0.114.8 - 2026-06-02

- Peeled the date/day helpers (`currentUtcDay`, `nextUtcResetAt`, `formatGrantDay`, `parseOptionalDate` — now with an injectable `now` for testability) into `billing/date-utils.ts` and the record accessors (`asRecord`, `stringFromRecord`) into `billing/record-utils.ts`; rewrote 24 callsites. Added 12 tests; backend suite now 228 tests.

## 0.114.7 - 2026-06-02

- Peeled the pure money/byte math helpers out of BillingService into `billing/billing-math.ts` (`calculateTotalPrice`, `defaultCheckoutMode`, `remainingBytes`, `numberFromBigInt`, `minNullableBytes`, `isErrorWithCode`, `throwConflictIfUniqueViolation`) and co-located the usage-multiplier helpers (`bytesAtMultiplier`, `usageMultiplierLabel`) with `normalizeUsageMultiplier` in `billing-normalizers.ts`; rewrote 134 callsites. Added 16 tests; backend suite now 216 tests.

## 0.114.6 - 2026-06-02

- Set up a reusable DB-integration test harness (`test/helpers/fake-db.ts`: scripted in-memory `DatabaseQueryExecutor` recording every SQL + bound params, a fake `transaction()` runner, and a `uniqueViolation()` thrower) and extracted the allocation idempotency decision (`billing/allocation-idempotency.ts`: `resolveAllocationIdempotencyKey` + `resolveExistingAllocation` — guarantees no double-credit and rejects a key reused across orders). Wired it into `allocatePaymentOrder` and covered it plus harness-driven IDOR/ownership flows with 13 tests; backend suite now 200 tests.

## 0.114.5 - 2026-06-02

- Covered PayPal and Telegram webhook verification: extracted the PayPal verify-request/response logic (`billing/paypal-webhook-verify.ts`) and Telegram secret-token constant-time match (`telegram/telegram-webhook-secret.ts`) and added 11 tests. All three webhook verifiers (rewarded-ad/PayPal/Telegram) are now tested; backend suite now 187 tests.

## 0.114.4 - 2026-06-02

- Extracted rewarded-ad/subscription/public-endpoint normalizers and the gb-to-bytes helper from BillingService into billing-normalizers.ts / quota-math.ts; backend suite now 176 tests.

## 0.114.3 - 2026-06-02

- Extracted more pure helpers (route/country/detection/JSON-array normalizers, usage-byte validators) from BillingService into billing-normalizers.ts / quota-math.ts with 12 new tests; backend suite now 171 tests.

## 0.114.2 - 2026-06-02

- Extracted 11 pure billing validators/normalizers from BillingService into `billing/billing-normalizers.ts` with 16 unit tests; backend suite now 159 tests.

## 0.114.1 - 2026-06-02

- Extracted the pure route probe-scoring engine (probe/MTU scoring + scoring utilities) from OperationsService into `operations/route-scoring.ts` and covered it with 15 unit tests; backend test suite now 143 tests.

## 0.114.0 - 2026-06-02

- Split the 14,862-line `apps/dashboard/src/DashboardApp.tsx` monolith into ~30 focused modules (`pages/`, `components/`, and shared type/formatter/mapper/label/tone helpers); the root file is now ~1,294 lines. Pure structural refactor with the dashboard e2e suite unchanged (20/20).
- Added the first backend automated test suite using Node's built-in `node:test` runner (no new dependencies), wired into CI: 74 tests across bearer-token parsing/constant-time compare, the RBAC role x permission matrix, scrypt password hashing, session-token sign/parse/tamper-rejection, reseller own-scope IDOR guards, reseller wallet/margin math, and client-token hashing/scope enforcement.
- Extracted previously-untestable, security-critical logic into focused modules: `security/password.ts`, `security/session-token.ts`, `security/client-token.ts` (scope helpers), `billing/reseller-ownership.ts`, and `billing/reseller-wallet-math.ts` (behavior-preserving).
- Hardened web security: backend CORS now fails closed (explicit `CORS_ORIGIN` allowlist, otherwise same-origin only) instead of reflecting any origin, and the Nginx samples add a Content-Security-Policy header.
- Recorded the 2026-06-01 backend/frontend/security/firewall audit in `.codex` and opened a "Phase 6: Release Readiness & Security Hardening" checklist (including injection-testing tasks).

## 0.113.6 - 2026-05-30

- Finished the screenshot-driven UI/UX checklist by capping duplicated Dashboard alert rows, tightening shared badges/pills, and adding a content-shell overflow guard.
- Added a Playwright all-page horizontal-overflow audit across every dashboard sidebar page and major workflow tab at mobile and desktop widths.
- Updated `.codex/uiuxchecklist.md` and the focused UI/UX refactor track to 100.0% complete.

## 0.113.5 - 2026-05-30

- Converted the Backups page into Monitor, Readiness, and Restore runbook workflow tabs to reduce long scrolling and keep restore planning separate from status monitoring.
- Added compact Reports donut chart cards for server health, outbound health, alert severity, and backup issues so the analysis page has scan-first visual summaries.
- Updated the UI/UX checklist to show Backups and Reports review complete at 90.0% overall completion.

## 0.113.4 - 2026-05-30

- Migrated the remaining dashboard page tables to the shared `DataTable` primitive, including permissions, Audit Logs, Alerts, tunnels, billing catalog/adapters, current-panel preview, reseller sold users, and reseller wallet ledger.
- Extended the shared table primitive with center alignment and selectable row styling so dense operational tables keep consistent spacing, truncation, and selected-row behavior.
- Updated the UI/UX checklist to show the shared-table migration at 85.0% overall completion.

## 0.113.3 - 2026-05-30

- Added reusable dashboard tabs and a shared table primitive for dense admin UX surfaces.
- Added dashboard donut/circle ECharts support plus an operational-mix panel for server health, alert severity, and route quality.
- Converted Users, Routes, Billing, and Settings into workflow tabs to reduce long scrolling and separate high-density admin tasks.
- Migrated admin users, billing customer accounts, and payment orders to the shared table primitive.
- Added `.codex/uiuxchecklist.md` to track the screenshot-driven UI/UX refactor.

## 0.113.2 - 2026-05-30

- Changed the seller Users page so the sold-users table remains its own section with an Add user action in the table header.
- Moved the seller Add user package-sale form into a focused dialog that opens above the table and closes after a successful wallet-gated sale.

## 0.113.1 - 2026-05-30

- Added the missing seller Users-page Add user action so reseller sessions can create or renew wallet-gated customer package sales without leaving Users.
- Kept the Users action scoped to the representative workspace and the existing `/api/admin/reseller/package-sales` wallet debit flow.

## 0.113.0 - 2026-05-30

- Expanded reseller sessions into a scoped seller workspace with Dashboard, Users, and Billing sidebar pages.
- Added seller Dashboard ECharts for sales trend and customer quota/service experience, plus seller summary cards and recent-customer visibility.
- Added a reseller Users table and Billing sales summary while keeping seller sessions scoped to their own customers, orders, and wallet data.

## 0.112.0 - 2026-05-30

- Added opt-in synthetic DF/path-MTU probes for route diagnostics.
- Backend route scoring now treats MTU/fragmentation risk as an advisory route-quality signal and returns safe tunnel-MTU recommendations.
- Dashboard route-decision reviews now show MTU keep/reduce/review guidance without applying mid-session MTU changes.

## 0.111.0 - 2026-05-30

- Added wallet-gated reseller package sales from the representative workspace.
- Reseller sales now create or renew owned customers, credit package quota, record a paid `reseller_wallet` order/allocation, and atomically debit AfroGate's share from the reseller wallet.
- Added a Billing-page sale panel and Playwright coverage for reseller package sales.

## 0.110.0 - 2026-05-30

- Added reseller-scoped workspace APIs so each representative can load only their own reseller account, wallet ledger, customer accounts, and payment orders.
- Added reseller customer create/update endpoints that force ownership to the current representative and block paid-number changes from the reseller workflow.
- Updated the dashboard so reseller sessions start on Billing, see a wallet/customer workspace, and hide superadmin/admin-only billing operations.
- Added Playwright coverage for the reseller-only Billing workspace and customer creation flow.

## 0.109.0 - 2026-05-30

- Added the reseller/representative foundation for mobile-shop sellers, including the managed `reseller` role, RBAC permissions, PostgreSQL reseller accounts, customer ownership links, and signed wallet ledger rows.
- Added guarded admin APIs to list/create/update reseller accounts, quote package wallet debits, top up reseller wallets, and record idempotent package sale debits with audit logging.
- Documented reseller wallet security rules and added future backlog items for reseller-scoped panels, automatic wallet-gated sales, and adaptive MTU/fragmentation diagnostics.

## 0.108.1 - 2026-05-30

- Added local SVG favicons for the dashboard and client apps.
- Linked both Vite app shells to the favicon asset so live browser QA no longer reports the default missing `/favicon.ico` request.

## 0.108.0 - 2026-05-29

- Added PostgreSQL-backed `admin_users` persistence for managed dashboard admin users, with unique normalized usernames, protected non-superadmin roles, and database-source summaries.
- The auth service now defaults managed admin-user storage to PostgreSQL when `DATABASE_URL` is configured, while keeping the local JSON file as an explicit fallback and one-time legacy import source.
- Updated deployment samples, RBAC docs, and dashboard tests for database-backed admin-user management, completing the dashboard/sidebar checklist.

## 0.107.0 - 2026-05-29

- Added Billing-page Telegram operations visibility for bot readiness, command/API/proxy state, linked accounts, delivery candidates, allocated linked orders, and pending paid allocations.
- The Billing page now loads superadmin Telegram bot settings as a non-blocking operations signal while keeping tokens, webhook secrets, Telegram chat IDs, VLESS configs, and provider secrets out of the dashboard surface.
- Updated the dashboard backlog so Telegram bot operations and purchase-fulfillment visibility are complete, leaving PostgreSQL-backed admin-user persistence as the remaining unchecked dashboard item.

## 0.106.0 - 2026-05-29

- Added the disabled-by-default production protocol server apply runner for guarded live config staging, install, service reload, health verification, and rollback metadata.
- Live apply now records accepted and final execution audit snapshots while keeping decrypted protocol/server secrets, rendered configs, stdout, and stderr out of API responses and stored snapshots.
- Settings now distinguishes blocked, accepted, and executed protocol apply events and shows secret-free execution counts in English and Persian.

## 0.105.0 - 2026-05-29

- Added client-side per-app VPN selection with all-apps and selected-apps modes for native split-tunnel handoff.
- Added a shared native split-tunnel profile contract plus Android `VpnService` include-only enforcement reference and iOS managed-profile boundary notes.
- Kept app selection local/privacy-safe: exported profiles include only explicit selections and no installed-app inventory, non-selected apps, traffic destinations, or admin secrets.

## 0.104.0 - 2026-05-29

- Added Telegram purchase fulfillment after verified payment-order quota allocation.
- Allocation responses now include a secret-free `telegramFulfillment` summary with delivery status, reason codes, selected client id, and usage-link availability.
- The bot now sends one rendered client-scoped VLESS URI plus a private Telegram usage/status deep link only for linked accounts with exactly one enabled renderable VLESS client, without exposing client tokens or admin/server/provider secrets.

## 0.103.3 - 2026-05-29

- Added the Telegram purchase-fulfillment backlog item for verified bot purchases.
- Documented that fulfillment should send one client-scoped VLESS config plus a private usage/status link after quota allocation.
- Recorded the secret-safe boundary: Telegram delivery must reuse client-scoped subscription rendering and must not expose admin data, server credentials, provider secrets, paid numbers, or other clients' usage.

## 0.103.2 - 2026-05-29

- Verified and marked dashboard foundation checklist items for default NOC display, second-LCD passive layout, static client-side page switches, and backend-backed outbound rows.
- Added Playwright coverage that confirms the dashboard opens on the NOC view, renders backend outbounds, and switches pages without route/navigation reload.

## 0.103.1 - 2026-05-29

- Added a dashboard kiosk display toggle with localized icon-only controls.
- Kiosk mode hides the sidebar, expands the NOC dashboard to the full viewport, persists locally, and exits cleanly without changing backend or routing behavior.
- Added Playwright coverage for entering and exiting kiosk display mode.

## 0.103.0 - 2026-05-29

- Added a signed rewarded-ad provider webhook at `POST /api/rewarded-ads/webhook`.
- Verified rewarded-ad callbacks with HMAC-SHA256 signatures, timestamp freshness, and admin-enabled `signed_webhook` or `provider_signed_webhook` verification mode before quota crediting.
- Reused the existing rewarded-ad grant ledger for idempotency, daily caps, client/account checks, audit logging, and quota updates.

## 0.102.0 - 2026-05-29

- Added payment-provider adapter readiness to the billing catalog for PayPal, card, local gateway, bank transfer, and crypto.
- Added guarded non-PayPal checkout preparation for hosted card/local gateway URLs and bank-transfer/crypto payment references.
- Kept generic non-PayPal adapters settlement-safe: they leave orders pending until audited admin verification or a future provider-specific verified callback marks payment complete.

## 0.101.1 - 2026-05-29

- Added the enterprise deployment guide for native Ubuntu/Nginx/systemd/PostgreSQL production control-plane rollout.
- Documented deployment preflight, secret handling, least-privilege database roles, backup/restore expectations, update/rollback flow, monitoring, and go/no-go checks.
- Linked the guide from README, repository structure, security policy, and the implementation checklist.

## 0.101.0 - 2026-05-29

- Added default-tenant branding settings backed by `tenant_brand_settings` and guarded `GET/PATCH /api/admin/tenant-branding`.
- Added explicit `tenantBranding:read` and `tenantBranding:write` permissions with audit logging for branding updates.
- Added a Settings-page branding form and preview for public names, support contacts, logo URL, colors, and client support copy while keeping secrets and customer data out of the surface.

## 0.100.0 - 2026-05-29

- Added guarded `GET /api/admin/reports/summary` for read-only operational reports across server/outbound health, open alerts, backup readiness, and synthetic route-quality recommendations.
- Added a Reports dashboard page with bilingual labels, operational risk score, risk reasons, health mix summaries, and route-quality analysis.
- Kept reports privacy-safe and aggregate-only: no customer identities, user destinations, traffic contents, client IP history, raw backups, exports, or secrets are returned.

## 0.99.0 - 2026-05-29

- Added guarded `GET /api/admin/backups/restore-plan` for read-only restore readiness derived from sanitized backup status.
- Added the Backups page restore-readiness and restore-runbook panels with bilingual labels, evidence checks, blockers/warnings, safety notes, and non-executable restore steps.
- Kept restore execution disabled and explicit: no raw dumps, local backup paths, decrypted secrets, object-store credentials, or restore controls are returned.

## 0.98.0 - 2026-05-29

- Added guarded `POST /api/admin/current-panels/charge-volume` for audited local AfroGate quota top-ups from the current-panel migration workflow.
- Added the `quota_charge_events` ledger with optional idempotency, non-secret metadata, account quota deltas, selected-client quota change metadata, and explicit external-panel write status.
- Added Billing page controls to charge selected-customer GB locally with bilingual labels while keeping live external-panel quota writes disabled and explicit.

## 0.97.0 - 2026-05-29

- Added guarded `GET /api/admin/customer-accounts/:id/client-configs/export` for sanitized account-scoped AfroGate client config export.
- Added Billing page controls to export selected-customer configs as read-only JSON and show exported counts with bilingual labels.
- Kept export secret-safe: no subscription credentials, secret-bearing config material, raw panel payloads, paid numbers, client tokens, or external-panel API calls.

## 0.96.0 - 2026-05-29

- Added guarded `POST /api/admin/current-panels/sync-usage` to reconcile later current-panel exports against existing imported client configs.
- Recorded only positive panel-counter deltas as idempotent `panel_sync` usage events, skipping missing, ambiguous, cross-account, duplicate, or non-advancing candidates.
- Added Billing page controls to sync current-panel usage, show synced/skipped counts, and keep the controlled flow bilingual, raw-payload-free, and external-panel-call-free.

## 0.95.0 - 2026-05-29

- Added guarded `POST /api/admin/current-panels/import-configs` to import sanitized, non-duplicate current-panel candidates into AfroGate client configs.
- Recorded panel-reported used bytes as idempotent `panel_sync` baseline usage events so imported account/client counters stay ledger-backed.
- Added Billing page controls to select a customer, import previewed configs, show import results, and keep the flow bilingual and raw-payload-free.

## 0.94.0 - 2026-05-29

- Added guarded `POST /api/admin/current-panels/import-preview` for read-only Marzban, X-UI, Sanayi, and generic current-panel export previews.
- Added the Billing page Current Panel Import panel with bilingual labels, JSON preview workflow, normalized candidate status/quota/usage rows, warnings, and rejected-row counts.
- Kept panel migration adapter-scoped and privacy-safe: no raw payload storage, no external panel calls, no user/config writes, and no subscription URL/token exposure.

## 0.93.0 - 2026-05-29

- Added guarded `GET /api/admin/route-canary/status` for read-only route canary rollout visibility from the existing route decision preview engine.
- Added the Routes page Route Canary Rollout panel with bilingual labels, current/recommended candidate context, guard status, rollout thresholds, orchestration next action, and session-safety state.
- Kept canary rollout advisory and assignment-only while the data-plane adapter is disabled or missing, with no hidden OS route mutation or active-session movement.

## 0.92.0 - 2026-05-29

- Added guarded `GET /api/admin/incidents/timeline` for compact incident events from alert open/resolve rows and route decision/assignment records.
- Added the Alerts page Incident Timeline panel with bilingual labels, loading/empty states, and route-decision context.
- Kept the timeline read-only and privacy-safe: no secrets, user destinations, traffic contents, client IP history, or hidden route mutation.

## 0.91.0 - 2026-05-29

- Added guarded `GET /api/admin/route-health/history` for compact hourly route score, latency, jitter, loss, outbound, operator, protocol, and profile history.
- Added the Routes page Route Health History panel with bilingual labels, localized formatting, and synthetic-probe-only metadata.
- Kept route health history read-only and privacy-safe: no user destinations, traffic contents, client IP history, secrets, or data-plane route changes.

## 0.90.0 - 2026-05-29

- Added a shared fine-grained admin permission catalog and permission-aware backend guard metadata.
- Added guarded `GET /api/admin/permissions` for the current role, effective permissions, and role permission matrix.
- Added a bilingual Role Permissions matrix to the Users page and documented the production RBAC policy.

## 0.89.0 - 2026-05-29

- Added PostgreSQL least-privilege role templates for no-login ownership, migration-only DDL, and runtime app access.
- Updated the migration runner and local PostgreSQL setup to support `DATABASE_MIGRATION_URL` while keeping `DATABASE_URL` for the runtime app role.
- Updated Ubuntu/local deployment docs and verification SQL for the separate owner, migrator, and app role workflow.

## 0.88.0 - 2026-05-29

- Added guarded per-server agent token rotation with audit logging and one-time plaintext token issuance.
- Rotation revokes existing active agent tokens for the server and stores only the SHA-256 hash of the replacement token.
- Added an active-token lookup index and updated security/deployment docs for the rotation workflow.

## 0.87.0 - 2026-05-29

- Added superadmin Telegram bot setup in Settings with encrypted write-only BotFather token and webhook-secret storage.
- Added guarded Telegram settings APIs, API reachability testing through the shared outbound HTTP client, and runtime use of database settings with environment fallback.
- Documented Telegram bot setup/rotation and recorded native client per-app VPN split tunneling as a future client requirement.

## 0.86.0 - 2026-05-29

- Added encrypted per-client subscription credential storage with guarded admin list/store/revoke APIs and metadata-only responses.
- Enabled `/api/client/subscription` to render authenticated client-owned WireGuard, VLESS, L2TP, and IKEv2 configs when explicit public endpoint metadata and active encrypted credentials exist.
- Added private-config copy readiness in the VPN client app while keeping raw outbound config JSON, server/admin secrets, and other clients' credentials out of client responses.
- Recorded the future superadmin Telegram bot setup wizard for BotFather token entry, encrypted token storage, allowed chat/admin IDs, webhook secret, and Telegram API connection tests.

## 0.85.0 - 2026-05-29

- Added protocol-specific subscription config readiness descriptors for WireGuard, VLESS, L2TP, and IKEv2 under `GET /api/client/subscription`.
- Surfaced config readiness in the VPN client app with bilingual labels for missing public endpoint material and required client secret material.
- Kept connectable secret-bearing config generation blocked until an encrypted per-client renderer exists.

## 0.84.0 - 2026-05-29

- Added outbound usage multipliers so expensive routes can charge quota at `2x`, `10x`, or higher while preserving raw and charged bytes in usage events.
- Added client subscription refresh metadata through `GET /api/client/subscription` for safe public endpoint updates after VPS address changes.
- Surfaced route charge multipliers and subscription server availability in the VPN client app without exposing secret-bearing config links.

## 0.83.0 - 2026-05-29

- Added guarded read-only backup status monitoring through `GET /api/admin/backups/status`.
- Added the dashboard Backups page and NOC backup badge for encrypted, fresh, restore-tested backup readiness.
- Added environment/status-file configuration for external backup jobs without exposing backup file paths or enabling restore execution.

## 0.82.0 - 2026-05-29

- Added guarded `GET /api/admin/audit-logs` for compact recent audit event review by admin, supervisor, and auditor roles.
- Added the dashboard Audit Logs page with filters, summary metrics, English/Persian labels, and browser coverage.
- Redacted secret-like audit metadata keys before returning audit rows to the dashboard while keeping stored audit rows append-only.

## 0.81.1 - 2026-05-29

- Added repository-scoped security and privacy threat models for AfroGate's backend, dashboard, client app, agent, provider integrations, and route/data-plane boundaries.
- Documented privacy invariants around no traffic-content storage, no user destination history, write-only paid-number handling, and client/admin API separation.
- Linked the threat models from the security policy and repository structure docs for future implementation review.

## 0.81.0 - 2026-05-29

- Added a backend API rate-limit guard for sensitive public endpoints with bounded in-memory counters.
- Applied default rate limits to admin login, PayPal webhook, and Telegram webhook routes.
- Added deployment settings for enabling/disabling API rate limiting, proxy-header trust, and maximum counter keys.

## 0.80.0 - 2026-05-29

- Added a disabled-by-default Telegram user-command webhook for `/start`, `/help`, `/status`, and `/quota`.
- Added secret-header verification and safe linked-account lookup by Telegram id or username before sending quota/status replies.
- Reused the shared outbound HTTP client for Telegram bot messages so restricted servers can keep using the configured control-plane proxy.

## 0.79.0 - 2026-05-28

- Added a guarded customer limit manager to the dashboard Usage/Billing page for creating and updating customer accounts.
- Added admin controls for shared account GB quota, per-client GB caps, quota scope, account status, display name, Telegram username, and notes.
- Added dashboard API helpers, bilingual labels, and browser coverage for the customer account creation flow while keeping paid-number handling out of the dashboard workflow.

## 0.78.0 - 2026-05-28

- Added a dashboard Usage/Billing page for guarded admin billing catalog, customer quota, payment order, and allocation visibility.
- Added admin UI controls for non-secret rewarded-ad reward size, enabled state, daily cap, provider key, and verification mode.
- Added browser coverage for the billing page and bilingual dashboard labels for the new seller/admin billing surface.

## 0.77.0 - 2026-05-28

- Added guarded admin rewarded-ad settings APIs for reading and updating reward amount, daily cap, enabled state, provider key, and verification mode.
- Added shared admin rewarded-ad settings contracts with bounded backend validation and audit logging.
- Documented rewarded-ad settings as non-secret policy while keeping verified ad-network callbacks as future hardening.

## 0.76.0 - 2026-05-28

- Added rewarded-ad settings and `rewarded_ad_grants` as a daily-capped, idempotent quota-credit ledger.
- Added client-scoped rewarded-ad status and claim APIs that credit account quota and per-client quota when per-client caps apply.
- Added a mobile client rewarded-data card with English/Persian labels for the 100 MB reward and 20-ads-per-day cap.

## 0.75.0 - 2026-05-28

- Added `payment_order_allocations` as the idempotent ledger that consumes each paid payment order at most once.
- Added a guarded admin allocation API that credits purchased package volume to customer account quota and returns duplicate-safe repeat responses.
- Exposed payment-order allocation status, allocation timestamp, allocated volume, and delay seconds so paid-but-unallocated orders can be monitored.

## 0.74.0 - 2026-05-28

- Added a PayPal provider adapter for hosted checkout creation, approved-order capture, and verified webhooks.
- Added guarded admin PayPal checkout/capture APIs plus a public webhook endpoint that verifies PayPal signature headers before payment state changes.
- Kept PayPal credentials in `AFROGATE_PAYPAL_*` deployment settings and routed PayPal API calls through the shared outbound HTTP client.

## 0.73.0 - 2026-05-28

- Added `client_usage_events` as an idempotent usage ledger for client volume accounting.
- Added guarded admin APIs to record and list client usage events without double-counting duplicate source keys.
- Updated account/client used-byte counters atomically so remaining-volume reads stay cheap for the client app and admin APIs.

## 0.72.0 - 2026-05-28

- Added the separate `@afrogate/client` mobile-first VPN client app on local port `4100`.
- Added client token login, remaining-volume display, route mode controls, country/server selection, and score profile selection.
- Kept client app labels bilingual and separate from the admin dashboard UX.

## 0.71.0 - 2026-05-28

- Added client-scoped mobile API auth with admin-issued one-time access tokens stored only as hashes.
- Added `/api/client/me`, `/api/client/route-preference`, and `/api/client/route-options` for the authenticated VPN client only.
- Kept admin/seller and VPN-client UX separate while allowing safe client-owned route preference updates.

## 0.70.0 - 2026-05-28

- Applied per-client route preferences inside the read-only route decision preview for preferred exit-country and exact outbound/server contexts.
- Added candidate country/region metadata plus preference availability, match, mismatch, and reason-code details to route decision API contracts.
- Surfaced client route preference context in the Settings decision preview without inspecting client traffic or changing data-plane routes.

## 0.69.0 - 2026-05-28

- Added `client_route_preferences` for per-client automatic, country-preferred, or explicit outbound/server routing preferences.
- Added guarded admin APIs to read and update a client config route preference, with audit logging and per-client route assignment keys.
- Documented the separated seller/admin and VPN-client UX boundary, including coarse country-only detection without client IP history.

## 0.68.0 - 2026-05-28

- Added payment orders with package/price/volume snapshots and pending, paid, failed, and refunded lifecycle states.
- Added guarded admin APIs to list, create, inspect, and update payment order status with audit logging and idempotency/provider-order uniqueness.
- Kept payment-order metadata non-secret and separated paid-order tracking from future quota allocation.

## 0.67.0 - 2026-05-28

- Added billing settings, volume packages, and guarded admin APIs for package/pricing management.
- Added an extensible payment-method catalog with PayPal as a first-class provider plus manual/card/crypto/bank/local gateway support.
- Added shared billing/payment contracts and documented that payment provider secrets must stay out of public payment config.

## 0.66.0 - 2026-05-28

- Added the customer-account and client-config PostgreSQL foundation for Phase 2 billing.
- Added guarded admin APIs to manage customer accounts, multi-client configs, shared GB quota, and optional per-client caps.
- Added write-only paid-number HMAC storage with deployment guidance for `AFROGATE_IDENTITY_HASH_KEY`.

## 0.65.0 - 2026-05-28

- Added a generated-command policy gate to protocol server apply plans and audit snapshots.
- Surfaced command allowlist and timeout readiness in the Settings protocol apply UI.
- Recorded the billing design requirement that one customer account may own multiple client configs/devices with shared GB quota and optional per-client caps.

## 0.64.0 - 2026-05-28

- Added protocol server apply config-material readiness to plans, preflight gates, and stored audit snapshots.
- Surfaced config completeness separately from secret and credential readiness in the Settings apply UI.
- Kept the production protocol executor blocked until config material, decrypt gates, server access, credentials, and audited adapter readiness all pass.

## 0.63.2 - 2026-05-28

- Added a disabled-by-default protocol-secret decrypt readiness gate for protocol server apply planning.
- Required an implemented/audited adapter before protocol-secret or server-credential decrypt readiness can pass.
- Surfaced protocol secret reference and decrypt readiness separately in the Settings apply plan and audit snapshot, and documented the new safety flag.

## 0.63.1 - 2026-05-28

- Added a disabled-by-default credential-decrypt readiness gate for protocol server apply planning.
- Documented protocol apply live executor and credential-decrypt flags in env samples, deployment notes, and security policy.
- Kept live server mutation blocked until the audited production protocol apply executor exists.

## 0.63.0 - 2026-05-28

- Added Alerts page status, severity, and source filters while keeping dashboard/sidebar open-alert counts unfiltered.
- Added resolved alert history loading from the guarded admin alerts API.
- Added Playwright coverage for open/resolved alert filtering and updated sidebar page tracking.

## 0.62.5 - 2026-05-28

- Added signed-in dense dashboard visual capture tests for mobile, tablet, desktop, and second-LCD viewports.
- Mocked admin and metrics APIs in Playwright so visual captures exercise the real dashboard layout instead of the login screen.
- Kept horizontal-overflow checks active for the captured dense layouts and documented the test coverage.

## 0.62.4 - 2026-05-28

- Added a dashboard contrast check for warning and critical alert states in dark sidebar and light status-badge contexts.
- Wired the contrast check into root scripts and CI so future color changes keep AA text contrast for alert indicators.
- Marked the warning/critical contrast UI audit item complete.

## 0.62.3 - 2026-05-28

- Added hover title and accessible label coverage for dense dashboard monitoring metrics, badges, detail rows, chart range controls, and table cells.
- Reused existing localized dashboard labels and formatted values so tooltip text stays multilingual.
- Marked the dense monitoring tooltip UI audit item complete.

## 0.62.2 - 2026-05-28

- Compacted the dashboard system resource strip for mobile and tablet layouts.
- Added earlier responsive columns, tighter resource cards, truncation, and hover titles for dense metric values.
- Changed the storage volume strip to an internal one-row scroller on small screens to reduce dashboard vertical pressure.

## 0.62.1 - 2026-05-28

- Added a shared dashboard panel-state surface for empty, loading, stale, fallback, and error states.
- Wired localized state messaging through dashboard, server, route, alert, user, and settings-adjacent panels so stale or sample data is clearly labeled.
- Replaced one-off empty/error messages with typed English/Persian copy from the dashboard multilingual layer.

## 0.62.0 - 2026-05-28

- Completed protocol-aware agent route-probe coverage for configured TCP, UDP, QUIC-labeled UDP, DNS, and derived WireGuard health signals.
- Added protocol-specific degraded/critical probe thresholds so latency, jitter, and loss affect route scoring more accurately by traffic profile.
- Added privacy-safe WireGuard route-probe rows from interface status, active peers, and handshake freshness without exposing raw keys or user destinations.

## 0.61.2 - 2026-05-28

- Added optional Docker Compose deployment samples for private PostgreSQL, private backend, and a static dashboard/Nginx web edge.
- Added Docker build files, a container Nginx proxy config, a local Compose env template, and `.dockerignore` rules for reproducible builds without local secrets.
- Kept Docker secondary to the native Ubuntu path, with backend and database ports private and the sample web port bound to localhost by default.

## 0.61.1 - 2026-05-28

- Expanded native Ubuntu deployment notes for systemd, Nginx, local/private PostgreSQL, firewall posture, update flow, and rollback.
- Added production-oriented backend and optional agent environment samples without real secrets.
- Hardened the Nginx and systemd samples while keeping backend, database, and local control-plane egress ports private.

## 0.61.0 - 2026-05-28

- Added GitHub Actions CI for version consistency, repository-file secret scanning, workspace typecheck/build, dashboard Playwright smoke tests, and dependency audit.
- Added a local `npm run secrets:check` script for high-confidence token/private-key and sensitive filename checks without relying on a third-party CI action.
- Updated Playwright to use installed Edge locally and Chromium in CI after the workflow installs the browser.

## 0.60.0 - 2026-05-28

- Added a selected Tunnel Detail surface on the Routes page with guarded tunnel detail loading.
- Surfaced tunnel server, interface/operator, route group, lockability, endpoint, health score, and route-quality context with English/Persian labels.
- Kept tunnel detail read-only and non-mutating, with no service reload, OS route mutation, credential decrypt, or traffic switching.

## 0.59.0 - 2026-05-28

- Added an API-bound Server Detail surface that loads guarded server detail when a node is selected.
- Bound the detail view to server-scoped interface and tunnel inventory alongside access readiness, monitoring telemetry, and audit context.
- Kept the server detail workflow non-mutating: no credential decrypt, SSH connection, command execution, service reload, or OS route change.

## 0.58.0 - 2026-05-28

- Added Routes page controls for the default route assignment: auto-route, route lock, current/locked managed outbound, hysteresis, and cooldown.
- Bound the Routes page policy panel to guarded route-assignment APIs with admin-only writes and read-role visibility.
- Kept route policy changes control-plane-only, with no server OS route mutation, tunnel service reload, or live user traffic switching.

## 0.57.0 - 2026-05-28

- Added PostgreSQL and Drizzle inventory tables for managed server interfaces and tunnels.
- Added guarded admin CRUD APIs for server interfaces and tunnels with audit logging and server/interface ownership checks.
- Bound the dashboard tunnel panel to guarded `/api/admin/tunnels` rows with localized empty states while keeping sample data as an API-unavailable fallback.

## 0.56.0 - 2026-05-27

- Added guarded write-only server credential storage that encrypts submitted credentials, stores only metadata in API responses, links the active credential to the server access profile, and revokes the previously linked active credential.
- Added Servers page Access-tab forms for access-profile metadata and encrypted credential replacement with English and Persian labels.
- Preserved existing credential links when access profiles are updated without a credential field, while keeping credential decrypt, SSH execution, service reloads, OS route changes, and outbound enablement blocked.

## 0.55.0 - 2026-05-27

- Added protocol server apply adapter metadata to plans and stored snapshots, including supported protocols, dry-run support, command-runner mode, and data-plane readiness.
- Added a server-access credential boundary that verifies installed access profiles and active `server_credentials` records without decrypting credentials or executing commands.
- Surfaced the protocol apply adapter, dry-run-only runner, and credential boundary in Settings with English and Persian labels while keeping live server mutation blocked.

## 0.54.0 - 2026-05-27

- Added a superadmin-only live protocol apply request endpoint that records blocked audit events without executing SSH, shell commands, service reloads, OS route changes, secret decrypts, or outbound enablement.
- Extended protocol apply contracts and snapshots with `live` request mode plus blocked reason codes so stored event detail can explain why live mutation did not run.
- Surfaced a Settings live-apply request action and mode labels in English and Persian while keeping the production server-side apply engine disabled.

## 0.53.0 - 2026-05-27

- Added explicit protocol server apply preflight gates for feature flag, audited adapter, dry-run safety, provisioned outbound, outbound health, default disabled/maintenance posture, secret reference, server access, rollback, audit, and health verification.
- Persisted the preflight summary in protocol apply dry-run snapshots and audit payloads so stored event detail can explain why live server mutation is blocked or ready.
- Surfaced the preflight gate summary in Settings protocol apply plans and stored snapshot inspection with English and Persian labels while keeping live server mutation disabled until every data-plane gate passes.

## 0.52.0 - 2026-05-27

- Added read-role admin APIs for listing compact protocol server apply dry-run events and fetching stored snapshot detail on demand.
- Surfaced a Settings protocol apply audit panel with recent event cards, per-setup last-event linkage, and secret-safe snapshot inspection in English and Persian.
- Kept recent event payloads lightweight while preserving full dry-run command/config snapshots only in detail responses, with no SSH, shell, secret decrypt, service reload, OS route, or outbound enablement.

## 0.51.0 - 2026-05-27

- Added `protocol_apply_events` storage and a guarded admin API for recording secret-safe protocol server apply dry-run snapshots.
- Persisted protocol apply plan status, blocker reason codes, command/config counts, target server, and audit metadata without executing SSH, shell, or data-plane mutations.
- Surfaced a Settings action to record provisioned protocol apply dry-runs for audit in English and Persian while keeping the production server-side apply engine disabled.

## 0.50.0 - 2026-05-27

- Added target-server selection to Settings protocol drafts so WireGuard, VLESS, L2TP, and IKEv2 provisioning can bind generated managed outbounds to a real managed server.
- Added PostgreSQL/API support for `protocol_setups.target_server_id` and surfaced target labels plus server-access readiness in protocol setup responses.
- Updated protocol server apply plans to distinguish missing target servers from missing access profiles while still keeping all server OS/service mutation disabled until the audited adapter exists.

## 0.49.0 - 2026-05-27

- Added secret-safe protocol server apply plan summaries for saved WireGuard, VLESS, L2TP, and IKEv2 setup drafts, including readiness status, future command previews, config-change counts, and blocker reason codes.
- Returned protocol apply readiness from Settings provisioning responses while keeping server OS/service mutation disabled until a real audited adapter and server access target exist.
- Surfaced the protocol apply plan in Settings with English/Persian labels so admins can see planning, dry-run, blocked, and apply-ready state without exposing secrets.

## 0.48.0 - 2026-05-27

- Added a session-safe switch orchestration summary to route decision previews, combining route locks, cooldown, preflight, rollout, canary guard, sticky sessions, and rollback state into one next-action model.
- Persisted orchestration context in route decision event detail for audit.
- Surfaced the switch orchestrator in Settings with English/Persian labels so admins can see whether the safe next step is assignment-only, hold, canary, expand, rollback, or manual review.

## 0.47.0 - 2026-05-27

- Added advisory switch-rollout health evaluation to route decision previews, comparing canary candidates against packet-loss, jitter, latency, and score guards.
- Persisted rollout evaluation context in route decision event detail for audit.
- Surfaced the canary guard in Settings with English/Persian labels while keeping route movement planning-only until an audited adapter exists.

## 0.46.0 - 2026-05-27

- Added advisory switch-rollout/canary plans to route decision previews, including new-session canary percentages, route-consistency holds, rollback thresholds, and rollout steps.
- Persisted rollout context in route decision event detail for audit.
- Surfaced the rollout plan in Settings with English/Persian labels while keeping all data-plane movement planning-only until an audited adapter exists.

## 0.45.0 - 2026-05-27

- Added switch-preflight readiness summaries to route decision previews, covering feature flag, adapter, dry-run, guard, session-safety, rollback, cooldown, audit, and health-verification gates.
- Persisted switch-preflight context in route decision event detail so admins can audit why data-plane switching is still planning-only or blocked.
- Surfaced the preflight checklist in Settings with English/Persian labels while keeping live server OS/data-plane mutation disabled.

## 0.44.0 - 2026-05-26

- Added switch-execution summaries for assignment-only route apply events, including sticky-session, drain, cooldown, and future data-plane step state.
- Persisted switch-execution context in route decision event detail so admins can audit what was armed after an apply action.
- Surfaced the switch-execution result in Settings with English/Persian labels while keeping server OS/data-plane mutation disabled.

## 0.43.0 - 2026-05-26

- Added transparent switch-engine planning summaries to route decision previews with guard, session-pin, new-session route, drain, active switch, verify, and rollback phases.
- Surfaced switch-engine planning in Settings with English/Persian labels for status, mode, session impact, step readiness, and reason codes.
- Kept data-plane steps planning-only while the WireGuard apply adapter remains disabled or missing.

## 0.42.0 - 2026-05-26

- Added gaming-safe session-safety summaries to route decision previews, distinguishing safe switches, sticky holds, new-session-only drains, and emergency switches.
- Surfaced session-safety guidance in Settings with sticky TTL, drain wait, new-session-only, emergency, and disconnect-risk labels in English/Persian.
- Wired session-safety drain estimates into apply plans while keeping all real data-plane movement disabled.

## 0.41.0 - 2026-05-26

- Added advisory smart-load-balancing summaries to route decision previews with primary, secondary, standby, weight, adjusted-score, and risk guidance.
- Weighted managed route candidates by selected profile, health, packet loss, jitter, latency, throughput/load, loaded-latency, and high-security/route-consistency constraints.
- Surfaced smart-load-balancing guidance in Settings with English/Persian labels while keeping data-plane routing disabled.

## 0.40.0 - 2026-05-26

- Added explicit health-based switch reasons to route decision previews when the current managed route is unhealthy and a healthy managed candidate exists.
- Allowed assignment-only apply and apply-plan guards to bypass score-delta hysteresis for health-based switches while still respecting route lock, manual mode, cooldown, and managed-candidate gates.
- Surfaced current-route-unhealthy and health-based-switch reasons in Settings with English/Persian labels.

## 0.39.0 - 2026-05-26

- Added advisory smart-route profile recommendations to route decision previews.
- Compared usable managed candidates across balanced, stability, throughput, gaming, TCP, UDP, QUIC, DNS, and WireGuard profile scores.
- Surfaced the best candidate, profile score, and score delta from the selected profile in the Settings decision preview.
- Kept profile guidance privacy-safe and advisory-only; it uses synthetic route scores and does not inspect user traffic.

## 0.38.0 - 2026-05-26

- Added optional loaded-latency fields to route-probe contracts and backend ingest validation.
- Added backend bufferbloat assessment for route candidates, including loaded-latency delta, severity, SQM/AQM guidance, and avoid-under-load recommendations.
- Penalized health and route scores when loaded latency rises, with stronger impact for stability and gaming profiles.
- Surfaced loaded-latency guidance in Settings route candidate and decision review panels.

## 0.37.0 - 2026-05-26

- Added guarded route decision event detail reads at `/api/admin/route-decisions/events/:id` for read-role admins.
- Surfaced an on-demand Settings inspector for stored decision context and normalized dry-run snapshots.
- Kept the recent decision-events list compact while exposing secret-safe command/config snapshot details only when inspected.

## 0.36.0 - 2026-05-26

- Persisted normalized dry-run apply snapshots in `route_decision_events.decision_context` for both advisory preview records and assignment-only apply events.
- Included adapter state, command/config counts, command/config previews, and aggregate secret-safety status in the stored dry-run snapshot.
- Added dry-run command/config counts to route decision audit payloads.

## 0.35.0 - 2026-05-26

- Added dry-run-only WireGuard apply command previews to the route decision apply adapter metadata.
- Added secret-safe config-change previews for the future policy-routing adapter without exposing tunnel secrets or decrypted key material.
- Surfaced dry-run commands and config-change targets in the Settings apply plan while keeping all OS/data-plane execution disabled.

## 0.34.0 - 2026-05-26

- Added route apply adapter readiness metadata to decision preview apply plans for the future WireGuard policy-routing adapter.
- Added disabled-by-default `AFROGATE_ROUTE_DATA_PLANE_APPLY_ENABLED=false` configuration and surfaced the feature-flag state in Settings.
- Kept the adapter implementation marked missing and `dataPlaneReady = false` until a real audited server-side apply adapter exists.

## 0.33.0 - 2026-05-26

- Added a structured route apply plan to decision preview responses, including guard, assignment, drain, switch, verify, and rollback steps.
- Surfaced the apply plan in Settings with English/Persian labels and explicit control-plane versus future data-plane step badges.
- Kept real data-plane switching disabled by marking preview plans `dataPlaneReady = false` until audited server apply adapters exist.

## 0.32.0 - 2026-05-26

- Added a guarded assignment-only route decision apply API at `/api/admin/route-decisions/apply-preview`.
- Enforced route lock, cooldown, managed-candidate, and `switchRecommended` preview checks before updating the saved current outbound.
- Added a Settings Decision Preview action to apply the recommended route to control-plane assignment state while explicitly keeping server/data-plane routing disabled with `dataPlaneApplied = false`.

## 0.31.0 - 2026-05-26

- Added candidate-review details to the advisory route decision preview, including route disposition, score delta from the current route, rejection/recommendation reasons, and compact score-penalty reasons.
- Surfaced candidate recommendation and rejection explanations in the Settings Decision Preview panel with English/Persian labels.
- Kept the feature advisory-only: preview recording can store non-secret candidate context, but `applied_at` remains empty and live route switching is still future audited work.

## 0.30.0 - 2026-05-26

- Added guarded route decision event APIs for listing recent decisions and recording the current preview as an advisory audit row.
- Stored preview action, score profile, current/recommended outbounds, score delta, cooldown/lock state, and reason codes in `route_decision_events` with `applied_at` left empty.
- Added Settings UI support for recording advisory decision events and reviewing recent decision history.

## 0.29.0 - 2026-05-26

- Added guarded admin route assignment read/update APIs for the default assignment.
- Persisted auto-route, route lock, current managed outbound, locked managed outbound, hysteresis, and cooldown policy without applying live route changes.
- Added Settings controls for route assignment policy and refreshed the read-only decision preview after saving.

## 0.28.0 - 2026-05-26

- Added the route decision foundation with `route_assignments` and `route_decision_events` schema for future audited routing.
- Added a read-only admin route decision preview API that compares current and recommended routes with route lock, cooldown, hysteresis, score profile, and reason-code checks.
- Surfaced the advisory decision preview in Settings with English/Persian labels, while keeping live route switching disabled until audited apply logic exists.

## 0.27.0 - 2026-05-26

- Added a first-class advisory `gaming` route score profile for latency-sensitive users who need stable latency, low jitter, very low packet loss, and route consistency more than raw throughput.
- Exposed the gaming profile in Settings with English/Persian labels and route-settings persistence.
- Included gaming scores in route-quality hourly/profile analytics so future recommendations can reason about latency-sensitive windows without inspecting user traffic.
- Kept the new profile recommendation-only; automatic route switching still waits for audited route locks, cooldown, hysteresis, and drain-safe apply behavior.

## 0.26.0 - 2026-05-26

- Added route-quality dimension migration `0008_route_quality_dimensions.sql` for outbound, operator, score-profile, day-of-week, and time-window analytics.
- Added optional non-secret route-probe metadata in the agent/backend contract for route group, outbound, operator, and score profile.
- Added read-only predictive route recommendations for upcoming historically degraded windows in the Settings Route Intelligence panel.
- Recorded latency-sensitive/gaming routing direction: prioritize low jitter/loss and route consistency over raw throughput, without GPU dependency for the MVP.

## 0.25.0 - 2026-05-26

- Added PostgreSQL migration `0007_route_quality_hourly.sql` for compact hourly route-quality summaries.
- Added a backend route-quality aggregation scheduler that compacts recent synthetic route probes by route group, server, protocol, hour, and day-of-week.
- Updated route-quality analytics to prefer hourly summary rows and fall back to raw metrics when summaries are unavailable.
- Documented route-quality aggregation environment controls for low-resource VPS deployments.

## 0.24.0 - 2026-05-26

- Added a guarded read-only route-quality analytics endpoint that groups historical synthetic route probes by server, protocol, and hour-of-day.
- Added shared route-quality analytics contracts and advisory best/degraded time-window recommendations for future smart routing.
- Surfaced the first Route Intelligence panel in Settings, using typed English/Persian labels and keeping route changes manual until the audited apply engine exists.

## 0.23.0 - 2026-05-26

- Added backend advisory route scoring for Settings WireGuard candidates across balanced, stability, throughput, TCP, UDP, QUIC, DNS, and WireGuard profiles.
- Kept the existing candidate `score` field strategy-aware while exposing optional per-profile scores and compact reason codes for future explainable route decisions.
- Allowed route settings to carry protocol-specific traffic profiles such as TCP, UDP, QUIC, DNS, and WireGuard without inspecting user traffic or applying route changes automatically.

## 0.22.0 - 2026-05-26

- Added an opt-in protocol-aware route-probe foundation to the Python agent for TCP connect, UDP response, QUIC-labeled UDP response, and DNS lookup targets.
- Added shared/backend `routeProbes` metric contracts, ingest validation, latest-metrics mapping, and health-score penalties for degraded protocol probe status.
- Surfaced configured protocol-probe health in the dashboard Server Monitoring tab with typed English/Persian labels.
- Documented the new route-probe environment variables and kept all probes disabled unless synthetic targets are explicitly configured.

## 0.21.0 - 2026-05-25

- Added opt-in Python agent ping/jitter/packet-loss probes driven by configured synthetic targets in `AFROGATE_PING_TARGETS`.
- Kept route-quality probing privacy-safe: empty target configuration sends null route-quality metrics and never probes user destinations.
- Wired the probe values through the existing metrics ingest, health scoring, alert engine thresholds, and dashboard route-quality displays.

## 0.20.0 - 2026-05-25

- Merged live agent WireGuard telemetry into Settings route candidates alongside managed outbound health rows.
- Added backend scoring for agent-sourced WireGuard candidates based on tunnel state, active peers, handshake freshness, and server health.
- Extended Settings WireGuard health cards with candidate source, active peer count, latest handshake age, and tunnel throughput.
- Marked real per-tunnel WireGuard health checks for admin route selection complete while leaving ping/jitter/packet-loss and protocol-aware probes for the next step.

## 0.19.0 - 2026-05-25

- Added privacy-safe WireGuard interface and peer telemetry to the Python agent using `wg show all dump` when available.
- Added shared/backend `wireGuardInterfaces` contracts, ingest validation, latest-metrics/admin-server response mapping, and health-score penalties for down/degraded tunnel state.
- Surfaced WireGuard tunnel status, active peer counts, handshake freshness, and traffic rates in the dashboard Server Monitoring and Interfaces tabs.
- Documented that WireGuard telemetry reports peer fingerprints only and never sends raw private keys, preshared keys, or full public keys.

## 0.18.0 - 2026-05-25

- Added an initial superadmin protocol provisioning endpoint that converts saved Settings drafts into managed outbound rows.
- Linked protocol setup drafts to their provisioned outbound records while preserving encrypted `secretRef` references.
- Kept provisioned outbounds disabled and in maintenance mode by default so real server apply and health validation remain explicit later steps.
- Added a Settings UI action for provisioning saved protocol drafts and showing managed-outbound status.

## 0.17.0 - 2026-05-25

- Added an encrypted Settings secret-record store for write-only WireGuard/private-key material.
- Added a guarded superadmin Settings secret API that stores encrypted secret payloads and returns only `secretRef` metadata.
- Linked protocol setup draft creation to active matching `secretRef` values so raw private keys stay out of protocol config rows.
- Updated the dashboard Settings WireGuard flow to save private keys through the encrypted backend path, clear the field, and show encrypted-storage readiness.

## 0.16.0 - 2026-05-24

- Added PostgreSQL-backed Settings persistence tables for protocol setup drafts and route selection settings.
- Added guarded admin Settings APIs for reading setup state, saving automatic/manual route settings, and creating superadmin-only protocol drafts without storing raw secrets.
- Bound the dashboard Settings page to the guarded backend API while keeping sample WireGuard health data as a fallback when no real WireGuard outbounds exist.
- Added real WireGuard candidate shaping from `wireguard` outbounds and their latest outbound health samples.

## 0.15.0 - 2026-05-24

- Added a dashboard Settings page for guided WireGuard and system setup.
- Added write-only private-key handling in the Settings draft flow, clearing the secret from the form after validation and never echoing it in the preview.
- Added initial automatic/manual route controls, WireGuard health comparison, and smart load-balance strategy selection in Settings.
- Added a superadmin-only protocol draft factory for WireGuard, VLESS, L2TP, and IKEv2 setup planning.
- Added typed English/Persian Settings labels and sidebar navigation for the setup workflow.

## 0.14.0 - 2026-05-24

- Added a backend alert engine scheduler for stale servers, stale metrics, CPU/RAM/disk thresholds, route-quality thresholds, and unhealthy outbounds.
- Added configurable alert thresholds through environment variables while reusing the existing guarded alert API and alerts table.
- Recorded the guided, secret-safe WireGuard/system Settings page as the next important UI/UX setup workflow.

## 0.13.0 - 2026-05-24

- Added a lightweight backend outbound health-check scheduler for enabled, non-maintenance outbounds.
- Added synthetic HTTP and TCP outbound probes using non-secret `healthUrl` or `healthHost`/`healthPort` config targets.
- Persisted outbound health samples and updated outbound health status with fail and recovery threshold handling.

## 0.12.0 - 2026-05-24

- Added a shared backend outbound HTTP client for Telegram/API calls, including optional localhost HTTP proxy routing through `AFROGATE_OUTBOUND_PROXY_URL`.
- Added disabled-by-default Telegram critical-alert delivery for open critical backend alerts when bot token and alert chat environment values are configured.
- Added best-effort audit rows for Telegram alert send/failure outcomes without committing or exposing Telegram secrets.

## 0.11.0 - 2026-05-24

- Bound the dashboard Servers page to guarded `/api/admin/servers` rows after admin login, including real latest metrics, access-profile state, alert counts, and outbound counts when available.
- Bound the dashboard Routes page and dashboard outbound panel to guarded `/api/admin/outbounds` and `/api/admin/route-failover-events` rows, with sample data used only as an API-unavailable fallback.
- Added localized empty states for real server, outbound, and route-failover API lists.

## 0.10.2 - 2026-05-24

- Fixed local dashboard login CORS by using `127.0.0.1` for the local API URL and allowing both `127.0.0.1:4000` and `localhost:4000` as development origins.
- Trimmed comma-separated backend CORS origins so local environment lists are more forgiving.
- Added an accessible show/hide password icon button to the dashboard admin login form.

## 0.10.1 - 2026-05-24

- Moved direct local development to dashboard port `4000` and backend port `7000`.
- Updated dashboard API defaults, CORS examples, local PostgreSQL `.env` generation, Playwright smoke-test wiring, and local development documentation for the new ports.
- Updated Ubuntu deployment samples so the backend internal port is `7000` and the dashboard dev/preview port is `4000`.
- Made the backend load the repository root `.env` as well as a workspace `.env` so root workspace dev commands pick up local database and login settings.

## 0.10.0 - 2026-05-24

- Added a guarded `/api/admin/alerts` read endpoint for open/resolved alert rows.
- Added shared alert response contracts and dashboard polling through the signed admin session.
- Bound the dashboard Alerts page, dashboard alert panel, summary critical count, and sidebar alert badge to real backend alert rows when available.
- Fixed the local PostgreSQL setup script so missing role/database checks handle empty `psql` scalar output correctly.

## 0.9.2 - 2026-05-24

- Added a Windows local PostgreSQL setup script that creates the `afrogate` role/database and runs migrations.
- Documented why development should use PostgreSQL instead of SQLite for AfroGate.
- Added a root `db:setup:local` script for repeatable local database setup.

## 0.9.1 - 2026-05-24

- Standardized direct local development ports to dashboard `3000` and backend `8000`.
- Made the dashboard Vite server use strict ports so duplicate frontends fail fast instead of drifting to `3001+`.
- Added Playwright browser smoke-test wiring and local development documentation for frontend/backend/agent API wiring.

## 0.9.0 - 2026-05-24

- Added protected server agent heartbeat ingestion at `POST /api/agents/heartbeat`.
- Updated heartbeats to refresh server `last_seen_at`, hostname/platform, and status without noisy audit rows.
- Updated the Python agent to send heartbeat metadata before each metrics push through the same token and outbound proxy path.

## 0.8.0 - 2026-05-24

- Added an admin-guarded agent registration endpoint at `POST /api/agents/register`.
- Agent registration now upserts the server inventory row and returns a one-time plaintext agent token while storing only its SHA-256 hash.
- Metrics ingest now accepts non-revoked database-issued agent tokens with `metrics:write` scope, while keeping `AFROGATE_AGENT_TOKEN` as a legacy fallback.

## 0.7.0 - 2026-05-24

- Added the first Servers page edit workflow with selectable server cards and a dedicated edit panel.
- Added server edit tabs for overview, safe access/bootstrap, monitoring, interfaces, and audit state.
- Kept the access/bootstrap edit surface read-only and secret-safe until credential mutation/storage is implemented.

## 0.6.3 - 2026-05-24

- Documented protocol-aware smart routing responsibilities across agent, backend, and repository structure.
- Added privacy-safe TCP, UDP, QUIC/HTTP3, DNS, and WireGuard probe guidance for route health detection.
- Added smart-route scoring guidance for low-speed stability, high-speed throughput, and protocol-specific traffic profiles.

## 0.6.2 - 2026-05-24

- Restored the Users page title while keeping server resource details off management pages.
- Replaced the Add user modal with a separate inline create-user section above the Users table.
- Kept server card country/location metadata inline with the server name.

## 0.6.1 - 2026-05-24

- Limited the global dashboard server/resource strip to the main Dashboard view.
- Simplified the Users page to focus on the admin-user history table.
- Moved admin-user creation into an Add user modal and inserted successful creates directly into the table.

## 0.6.0 - 2026-05-23

- Added a `Users` sidebar page for superadmin-focused admin account management.
- Added guarded admin-user management APIs under `/api/admin/users` for listing, creating, disabling/enabling, deleting, and changing passwords for managed admin users.
- Preserved the bootstrap `superadmin` account as protected and immutable from normal user-management actions.
- Added `supervisor` as a managed admin-user role with read-oriented dashboard access.
- Added a local ignored admin-user store at `AFROGATE_ADMIN_USERS_FILE` so managed admin accounts persist without committing secrets.

## 0.5.1 - 2026-05-23

- Prefilled the dashboard login username with `superadmin` so the visible bootstrap username is an actual submitted value rather than placeholder-only text.
- Added required browser validation and password autofocus to reduce failed local login attempts.

## 0.5.0 - 2026-05-23

- Replaced the human-facing admin token login with username/password admin login through `/api/auth/login`.
- Added signed admin session tokens for dashboard sessions while keeping the legacy admin bearer token as a fallback for direct API bootstrap use.
- Added a permanent `superadmin` role concept, optional configured admin login, MFA-ready session metadata, and server-side role handling that always lets superadmin pass admin guards.
- Updated the dashboard login form, English/Persian auth copy, environment example, and security policy for the superadmin/admin login model.

## 0.4.1 - 2026-05-23

- Switched Persian dashboard typography from IRANSans to the local YekanBakh FaNum variable font.
- Updated DOM and ECharts Persian font-family wiring so canvas chart labels match the app typography.
- Updated multilingual UI documentation and project memory to point at the local YekanBakh asset path.

## 0.4.0 - 2026-05-23

- Added guarded `/api/admin` server management APIs for inventory, detail, create, update, and delete operations.
- Added guarded outbound management APIs for listing, detail, create, update, delete, priority moves, and route failover history reads.
- Added shared admin management response contracts and audit log writes for server and outbound mutations.
- Kept outbound management secret-safe by rejecting secret-like config keys and returning only `hasSecretRef` with redacted config values.

## 0.3.11 - 2026-05-23

- Compacted shared panel headers so metadata such as `3 nodes`, `3 links`, and `3 visible` renders inline with the title.
- Reduced panel padding, body gaps, and table row padding for denser network-operations monitoring sections.
- Kept server-row CPU/RAM/disk indicators on one desktop line to reduce wasted row height.

## 0.3.10 - 2026-05-23

- Repositioned the desktop sidebar collapse control as a professional icon-only handle on the sidebar/content divider.
- Mirrored the collapse handle placement and icon direction for Persian/RTL layouts.

## 0.3.9 - 2026-05-23

- Added a desktop sidebar collapse/expand control that turns the sidebar into an 80px icon rail.
- Persisted the sidebar width preference in local storage so monitoring displays reopen in the chosen layout.
- Added English and Persian accessible labels/tooltips for the sidebar collapse control.

## 0.3.8 - 2026-05-23

- Added a UI/UX audit checklist for the dense monitoring dashboard and remaining layout hardening work.
- Reworked dashboard server rows into compact icon-based CPU/RAM/disk/download/upload indicators with accessible labels and tooltips.
- Simplified the ECharts health timeline density by removing the visible slider, tightening chart spacing, and keeping inside zoom support.
- Verified the 1920x1080 second-LCD Dashboard view has zero main-content overflow and no measured text overflow in English or Persian.

## 0.3.7 - 2026-05-23

- Added sidebar alert severity state so the Alerts navigation item shows an amber warning badge or a red critical badge with localized counts.
- Improved Alerts navigation accessibility by including the current warning/critical count in the item label.

## 0.3.6 - 2026-05-23

- Strengthened Persian dashboard typography so the app subtree, controls, bold text, and ECharts use the local IRANSans family.
- Added Persian-aware dashboard formatting for clock, percentages, throughput units, latency, packet loss, thresholds, counts, and chart labels.
- Localized known fallback monitoring sample labels in Persian mode, including server names, operators, outbounds, and CPU/RAM labels.

## 0.3.5 - 2026-05-23

- Fixed dashboard packet-loss translations so English uses `Packet loss` / `Loss` and Persian uses `افت بسته`.

## 0.3.4 - 2026-05-23

- Compacted the dashboard information density with smaller panels, cards, rows, charts, and resource strips.
- Reworked the dashboard grid so the second-LCD 1920x1080 monitoring view fits without main-content overflow.
- Added truncation and fixed row sizing to reduce Persian/English label wrapping in dense operational panels.

## 0.3.3 - 2026-05-23

- Changed the desktop dashboard shell so the sidebar remains fixed in place and only the main content pane scrolls.
- Verified English/LTR desktop and second-LCD layouts keep the sidebar flush left with no document-level scrolling.

## 0.3.2 - 2026-05-23

- Fixed the dashboard sidebar so navigation wraps instead of horizontally scrolling on mobile and remains sticky on desktop.
- Hardened dashboard responsive layouts across Dashboard, Servers, Routes, and Alerts pages for English and Persian.
- Added stable navigation data attributes for browser-level responsive checks.

## 0.3.1 - 2026-05-23

- Added local IRANSans/Iranian Sans font-face wiring for Persian dashboard mode without using a CDN.
- Added the dashboard font asset folder, copied the local `Iranian Sans.ttf` asset into it, and documented license-safe font handling.

## 0.3.0 - 2026-05-23

- Added English/Persian dashboard translations with persisted language selection and page direction updates.
- Added a language icon toggle at the bottom of the sidebar beside the version display.
- Added multilingual UI policy documentation and extended version checks to cover local plugin manifests.

## 0.2.1 - 2026-05-23

- Split dashboard traffic monitoring into separate download and upload values in the resource strip, summary cards, capacity panel, and server rows.
- Removed the hardcoded single outbound throughput card from the dashboard.

## 0.2.0 - 2026-05-23

- Added AfroGate versioning workflow with SemVer scripts, changelog policy, version consistency checks, and a local Codex plugin/skill.
- Added the dashboard sidebar version footer sourced from root `package.json`.
- Captured current MVP foundation state after monitoring storage, ECharts dashboard, system resources, sidebar pages, admin guard foundation, control-plane egress, and outbound-management planning.
