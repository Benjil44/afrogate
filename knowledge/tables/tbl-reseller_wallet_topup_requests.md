> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Table: `reseller_wallet_topup_requests`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[resellerWalletTopupRequests]]
- **Migration source:** [[0054_reseller_wallet_topups.sql]]
- **Raw table note:** [[reseller_wallet_topup_requests]]
- **Change-risk (DERIVED from coupling):** Low — <3 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[BillingService]]
- [[reseller-topup.ts]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/billing/billing.service.ts:2440  |  INSERT INTO reseller_wallet_topup_requests (`  _(confidence 0.9)_
- `apps/backend/src/billing/reseller-topup.ts:56  |  FROM reseller_wallet_topup_requests`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0054_reseller_wallet_topups.sql]] and [[resellerWalletTopupRequests]].

## Tests (deterministic — import → bridge, VERIFIED)
- `apps/backend/test/reseller-topup.test.ts` _(imports a production file the bridge marks as a consumer of this table)_

## Related tests (HEURISTIC — textual name reference, not import-verified)
- `apps/backend/test/reseller-topup.test.ts`

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
