> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Table: `client_subscription_credentials`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[clientSubscriptionCredentials]]
- **Migration source:** [[0022_client_subscription_credentials.sql]]
- **Raw table note:** [[client_subscription_credentials]]
- **Change-risk (DERIVED from coupling):** Low — <3 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[BillingService]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/billing/billing.service.ts:4480  |  FROM client_subscription_credentials`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0022_client_subscription_credentials.sql]] and [[clientSubscriptionCredentials]].

## Related tests (by reference)
_No test file references this table by name._

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
