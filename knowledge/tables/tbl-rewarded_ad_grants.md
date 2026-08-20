> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-20T13:32:55.646Z

# Table: `rewarded_ad_grants`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[rewardedAdGrants]]
- **Migration source:** [[0020_rewarded_ad_grants.sql]]
- **Raw table note:** [[rewarded_ad_grants]]
- **Change-risk (DERIVED from coupling):** Low — <3 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[BillingService]]
- [[customer-account-deletion.ts]]
- [[customer-account-merge.ts]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/billing/billing.service.ts:3615  |  * quota_charge_events, rewarded_ad_grants) stays on the archived source for audit`  _(confidence 0.9)_
- `apps/backend/src/billing/customer-account-deletion.ts:19  |  * Nothing is hard-deleted, so the `rewarded_ad_grants` / `payment_orders``  _(confidence 0.9)_
- `apps/backend/src/billing/customer-account-merge.ts:13  |  * accounting history (payment_orders, quota_charge_events, rewarded_ad_grants)`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0020_rewarded_ad_grants.sql]] and [[rewardedAdGrants]].

## Tests (deterministic — import → bridge, VERIFIED)
- `apps/backend/test/customer-account-deletion.test.ts` _(imports a production file the bridge marks as a consumer of this table)_
- `apps/backend/test/customer-account-merge.test.ts` _(imports a production file the bridge marks as a consumer of this table)_

## Related tests (HEURISTIC — textual name reference, not import-verified)
_No test file references this table by name._

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
