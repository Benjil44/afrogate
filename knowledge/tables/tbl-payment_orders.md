> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Table: `payment_orders`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[paymentOrders]]
- **Migration source:** [[0015_payment_orders.sql]]
- **Raw table note:** [[payment_orders]]
- **Change-risk (DERIVED from coupling):** Low — <3 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[BillingService]]
- [[customer-account-deletion.ts]]
- [[customer-account-merge.ts]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/billing/billing.service.ts:1258  |  INSERT INTO payment_orders (`  _(confidence 0.9)_
- `apps/backend/src/billing/customer-account-deletion.ts:19  |  * Nothing is hard-deleted, so the `rewarded_ad_grants` / `payment_orders``  _(confidence 0.9)_
- `apps/backend/src/billing/customer-account-merge.ts:13  |  * accounting history (payment_orders, quota_charge_events, rewarded_ad_grants)`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0015_payment_orders.sql]] and [[paymentOrders]].

## Related tests (by reference)
_No test file references this table by name._

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
