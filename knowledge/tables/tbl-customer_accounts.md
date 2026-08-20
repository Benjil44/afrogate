> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-20T16:27:17.978Z

# Table: `customer_accounts`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[customerAccounts]]
- **Migration source:** [[0013_customer_accounts.sql]]
- **Raw table note:** [[customer_accounts]]
- **Change-risk (DERIVED from coupling):** Critical — 15 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[BillingService]]
- [[ConnectionsService]]
- [[GatewayBillingService]]
- [[GemsReason]]
- [[RoutersService]]
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

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/billing/billing.service.ts:1366  |  UPDATE customer_accounts`  _(confidence 0.9)_
- `apps/backend/src/client/connections.service.ts:115  |  JOIN customer_accounts ca ON ca.id = cc.customer_account_id`  _(confidence 0.9)_
- `apps/backend/src/routers/gateway-billing.service.ts:35  |  `UPDATE customer_accounts SET used_bytes = used_bytes + $1, updated_at = now() WHERE id = $2`,`  _(confidence 0.9)_
- `apps/backend/src/billing/gems.ts:39  |  *    row (+ earn, − spend) before/with the cached `customer_accounts.gems_balance``  _(confidence 0.9)_
- `apps/backend/src/routers/routers.service.ts:74  |  `SELECT id, display_name FROM customer_accounts WHERE id = ANY($1::uuid[])`,`  _(confidence 0.9)_
- `apps/backend/src/telegram/telegram-topup-admin.service.ts:60  |  LEFT JOIN customer_accounts ca ON ca.id = t.customer_account_id`  _(confidence 0.9)_
- `apps/backend/src/client/wireguard-metering.service.ts:98  |  UPDATE customer_accounts ca`  _(confidence 0.9)_
- `apps/backend/src/client/xray-provisioning.service.ts:89  |  JOIN customer_accounts ca ON ca.id = cc.customer_account_id`  _(confidence 0.9)_
- `apps/backend/src/client/xray-usage-metering.service.ts:84  |  UPDATE customer_accounts ca`  _(confidence 0.9)_
- `apps/backend/src/billing/customer-account-deletion.ts:14  |  *     `customer_accounts.status = 'active'`, e.g. xray provisioning) stop serving`  _(confidence 0.9)_
- `apps/backend/src/billing/customer-account-merge.ts:140  |  FROM customer_accounts`  _(confidence 0.9)_
- `apps/backend/src/billing/phone-identity.ts:5  |  * '+') in customer_accounts.phone. A dashboard-created account, however, may hold`  _(confidence 0.9)_
- `apps/backend/src/billing/reseller-ownership.ts:15  |  'SELECT reseller_account_id AS "resellerAccountId" FROM customer_accounts WHERE id = $1 FOR SHARE',`  _(confidence 0.9)_
- `apps/backend/src/telegram/telegram-self-service.ts:15  |  * unique index on customer_accounts.telegram_id) is caught and resolved by`  _(confidence 0.9)_
- `apps/backend/src/telegram/telegram-topup.ts:32  |  * is written to `customer_accounts.quota_limit_bytes`. A top-up grants exactly`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0013_customer_accounts.sql]] and [[customerAccounts]].

## Tests (deterministic — import → bridge, VERIFIED)
- `apps/backend/test/customer-account-deletion.test.ts` _(imports a production file the bridge marks as a consumer of this table)_
- `apps/backend/test/customer-account-merge.test.ts` _(imports a production file the bridge marks as a consumer of this table)_
- `apps/backend/test/fake-db-harness.test.ts` _(imports a production file the bridge marks as a consumer of this table)_
- `apps/backend/test/gems.test.ts` _(imports a production file the bridge marks as a consumer of this table)_
- `apps/backend/test/phone-identity.test.ts` _(imports a production file the bridge marks as a consumer of this table)_
- `apps/backend/test/reseller-ownership.test.ts` _(imports a production file the bridge marks as a consumer of this table)_
- `apps/backend/test/telegram-connect.test.ts` _(imports a production file the bridge marks as a consumer of this table)_
- `apps/backend/test/telegram-self-service.test.ts` _(imports a production file the bridge marks as a consumer of this table)_
- `apps/backend/test/telegram-topup-commission.test.ts` _(imports a production file the bridge marks as a consumer of this table)_
- `apps/backend/test/telegram-topup.test.ts` _(imports a production file the bridge marks as a consumer of this table)_

## Related tests (HEURISTIC — textual name reference, not import-verified)
- `apps/backend/test/customer-account-deletion.test.ts`
- `apps/backend/test/customer-account-merge.test.ts`
- `apps/backend/test/fake-db-harness.test.ts`
- `apps/backend/test/gems.test.ts`
- `apps/backend/test/telegram-topup-commission.test.ts`
- `apps/backend/test/telegram-topup.test.ts`

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
