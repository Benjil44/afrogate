> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Table: `egress_tier_prices`

- **Status:** **INTENTIONAL RAW-SQL EXCEPTION** (Class-C — not an ORM entity by design)
- **Migration source:** [[0037_egress_tier_prices.sql]]
- **Raw table note:** [[egress_tier_prices]]
- **Change-risk (DERIVED from coupling):** Low — <3 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[BillingService]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/billing/billing.service.ts:5713  |  `SELECT tier, price::text AS price, currency, updated_at AS "updatedAt" FROM egress_tier_prices ORDER BY tier`,`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0037_egress_tier_prices.sql]].

## Related tests (by reference)
_No test file references this table by name._

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
