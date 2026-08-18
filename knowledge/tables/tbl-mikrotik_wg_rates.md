> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Table: `mikrotik_wg_rates`

- **Status:** **INTENTIONAL RAW-SQL EXCEPTION** (Class-C — not an ORM entity by design)
- **Migration source:** [[0040_mikrotik_wg_rates.sql]]
- **Raw table note:** [[mikrotik_wg_rates]]
- **Change-risk (DERIVED from coupling):** Low — <3 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[RoutersService]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/routers/routers.service.ts:401  |  }>(`SELECT peer_key, label, price_per_gb, currency FROM mikrotik_wg_rates WHERE router_id = $1`, [id]);`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0040_mikrotik_wg_rates.sql]].

## Tests (deterministic — import → bridge, VERIFIED)
_No test imports a production file that this table's bridge marks as a consumer._

## Related tests (HEURISTIC — textual name reference, not import-verified)
_No test file references this table by name._

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
