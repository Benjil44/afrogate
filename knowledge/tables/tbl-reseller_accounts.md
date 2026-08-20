> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-20T16:27:17.978Z

# Table: `reseller_accounts`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[resellerAccounts]]
- **Migration source:** [[0028_reseller_wallets.sql]]
- **Raw table note:** [[reseller_accounts]]
- **Change-risk (DERIVED from coupling):** Low — <3 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[BillingService]]
- [[reseller-topup.ts]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/billing/billing.service.ts:1924  |  INSERT INTO reseller_accounts (`  _(confidence 0.9)_
- `apps/backend/src/billing/reseller-topup.ts:16  |  * a `topup` row to `reseller_wallet_ledger` and moves `reseller_accounts.balance_amount``  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0028_reseller_wallets.sql]] and [[resellerAccounts]].

## Tests (deterministic — import → bridge, VERIFIED)
- `apps/backend/test/reseller-topup.test.ts` _(imports a production file the bridge marks as a consumer of this table)_

## Related tests (HEURISTIC — textual name reference, not import-verified)
- `apps/backend/test/reseller-topup.test.ts`

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
