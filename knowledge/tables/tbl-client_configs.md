> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Table: `client_configs`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[clientConfigs]]
- **Migration source:** [[0013_customer_accounts.sql]]
- **Raw table note:** [[client_configs]]
- **Change-risk (DERIVED from coupling):** Critical — 11 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[BillingController]]
- [[BillingService]]
- [[ConnectionsService]]
- [[OperationsOverviewService]]
- [[TelegramBotService]]
- [[WireguardMeteringService]]
- [[XrayProvisioningService]]
- [[XrayUsageMeteringService]]
- [[customer-account-deletion.ts]]
- [[customer-account-merge.ts]]
- [[reseller-ownership.ts]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/billing/billing.controller.ts:792  |  * remaining GB, gems, client_configs, telegram link + phone and referrals over,`  _(confidence 0.9)_
- `apps/backend/src/billing/billing.service.ts:2925  |  INSERT INTO client_configs (`  _(confidence 0.9)_
- `apps/backend/src/client/connections.service.ts:114  |  FROM client_configs cc`  _(confidence 0.9)_
- `apps/backend/src/client/operations-overview.service.ts:194  |  JOIN client_configs cc ON cc.id = wp.client_config_id`  _(confidence 0.9)_
- `apps/backend/src/telegram/telegram-bot.service.ts:1200  |  await this.database.query(`UPDATE client_configs SET label = $1, updated_at = now() WHERE id = $2`, [label, config.id]);`  _(confidence 0.9)_
- `apps/backend/src/client/wireguard-metering.service.ts:83  |  UPDATE client_configs cc`  _(confidence 0.9)_
- `apps/backend/src/client/xray-provisioning.service.ts:20  |  * active client_configs get a user (their entry_uuid) provisioned via the xray`  _(confidence 0.9)_
- `apps/backend/src/client/xray-usage-metering.service.ts:77  |  UPDATE client_configs`  _(confidence 0.9)_
- `apps/backend/src/billing/customer-account-deletion.ts:8  |  * payment/accounting history and the account's client_configs are RETAINED so`  _(confidence 0.9)_
- `apps/backend/src/billing/customer-account-merge.ts:23  |  *   - Configs: source's client_configs are reassigned to the target so the user's`  _(confidence 0.9)_
- `apps/backend/src/billing/reseller-ownership.ts:41  |  FROM client_configs cc`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0013_customer_accounts.sql]] and [[clientConfigs]].

## Tests (deterministic — import → bridge, VERIFIED)
- `apps/backend/test/customer-account-deletion.test.ts` _(imports a production file the bridge marks as a consumer of this table)_
- `apps/backend/test/customer-account-merge.test.ts` _(imports a production file the bridge marks as a consumer of this table)_
- `apps/backend/test/fake-db-harness.test.ts` _(imports a production file the bridge marks as a consumer of this table)_
- `apps/backend/test/reseller-ownership.test.ts` _(imports a production file the bridge marks as a consumer of this table)_

## Related tests (HEURISTIC — textual name reference, not import-verified)
- `apps/backend/test/customer-account-deletion.test.ts`
- `apps/backend/test/customer-account-merge.test.ts`

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
