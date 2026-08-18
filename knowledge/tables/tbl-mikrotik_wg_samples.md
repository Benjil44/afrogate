> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Table: `mikrotik_wg_samples`

- **Status:** **INTENTIONAL RAW-SQL EXCEPTION** (Class-C — not an ORM entity by design)
- **Migration source:** [[0039_mikrotik_wg_samples.sql]]
- **Raw table note:** [[mikrotik_wg_samples]]
- **Change-risk (DERIVED from coupling):** Low — <3 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[GatewayBillingService]]
- [[RouterUsageSamplerService]]
- [[RoutersService]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/routers/gateway-billing.service.ts:54  |  FROM mikrotik_wg_samples`  _(confidence 0.9)_
- `apps/backend/src/routers/router-usage-sampler.service.ts:6  |  * into mikrotik_wg_samples, so per-tunnel data usage (e.g. the friends' usage on`  _(confidence 0.9)_
- `apps/backend/src/routers/routers.service.ts:319  |  /** Snapshot every router's WireGuard peer byte counters into mikrotik_wg_samples. */`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0039_mikrotik_wg_samples.sql]].

## Related tests (by reference)
_No test file references this table by name._

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
