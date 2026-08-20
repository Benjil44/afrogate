> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-20T13:32:55.646Z

# Table: `rewarded_ad_settings`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[rewardedAdSettings]]
- **Migration source:** [[0020_rewarded_ad_grants.sql]]
- **Raw table note:** [[rewarded_ad_settings]]
- **Change-risk (DERIVED from coupling):** Low — <3 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[BillingService]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/billing/billing.service.ts:855  |  UPDATE rewarded_ad_settings`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0020_rewarded_ad_grants.sql]] and [[rewardedAdSettings]].

## Tests (deterministic — import → bridge, VERIFIED)
_No test imports a production file that this table's bridge marks as a consumer._

## Related tests (HEURISTIC — textual name reference, not import-verified)
_No test file references this table by name._

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
