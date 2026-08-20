> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-20T13:32:55.646Z

# Table: `gems_ledger`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[gemsLedger]]
- **Migration source:** [[0053_telegram_bot_v2_gems_referrals.sql]]
- **Raw table note:** [[gems_ledger]]
- **Change-risk (DERIVED from coupling):** Medium — 4 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[BillingService]]
- [[GemsReason]]
- [[customer-account-merge.ts]]
- [[telegram-topup.ts]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/billing/billing.service.ts:3694  |  FROM gems_ledger`  _(confidence 0.9)_
- `apps/backend/src/billing/gems.ts:32  |  * balance math, the append-only `gems_ledger` audit trail, and referral`  _(confidence 0.9)_
- `apps/backend/src/billing/customer-account-merge.ts:22  |  *     each as a signed `merge` gems_ledger row (mirrors gems.ts earnGems).`  _(confidence 0.9)_
- `apps/backend/src/telegram/telegram-topup.ts:255  |  `INSERT INTO gems_ledger (customer_account_id, delta, reason, ref) VALUES ($1, $2, 'referral_commission', $3)`,`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0053_telegram_bot_v2_gems_referrals.sql]] and [[gemsLedger]].

## Tests (deterministic — import → bridge, VERIFIED)
- `apps/backend/test/customer-account-merge.test.ts` _(imports a production file the bridge marks as a consumer of this table)_
- `apps/backend/test/gems.test.ts` _(imports a production file the bridge marks as a consumer of this table)_
- `apps/backend/test/telegram-topup-commission.test.ts` _(imports a production file the bridge marks as a consumer of this table)_
- `apps/backend/test/telegram-topup.test.ts` _(imports a production file the bridge marks as a consumer of this table)_

## Related tests (HEURISTIC — textual name reference, not import-verified)
- `apps/backend/test/customer-account-merge.test.ts`
- `apps/backend/test/gems.test.ts`
- `apps/backend/test/telegram-topup-commission.test.ts`

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
