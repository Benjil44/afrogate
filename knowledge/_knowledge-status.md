> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Knowledge-Layer Status

- **Graph artifact time (graph.json mtime):** 2026-08-18T21:12:01.002Z
- **Source git SHA:** _not stamped in Graphify artifacts — UNKNOWN_ (treat graph as a HINT if it may predate current HEAD).
- **Nodes:** 5642
- **Edges:** 14442
- **Bridge edges:** 249 (entity↔table 47, table↔service 202)
- **Test→code links:** 68 import (VERIFIED), 1 convention, 7 fixture, 0 unresolved, 10 black-box specs — source `graphify-out/test_links.json`
- **Migration-backed tables:** 51
- **Modeled Drizzle entities:** 47
- **Intentional raw-SQL exceptions:** 4 — [[tbl-egress_tier_prices]], [[tbl-mikrotik_wg_rates]], [[tbl-mikrotik_wg_samples]], [[tbl-outbound_test_settings]]

## Provenance rules
- **VERIFIED / EXTRACTED:** AST edges (`_origin: ast`) and bridge edges (schema↔code) with a `source_location`/evidence line — trust as fact.
- **INFERRED:** LLM/semantic edges and community membership — hints; verify against source.
- **INTENTIONAL EXCEPTION:** the 4 Class-C raw-SQL tables — documented in `docs/schema-drift-audit.md`.

## Known limitations
- Foreign-key and service→service edges are NOT in the current artifacts; FKs live in migrations/`schema.ts`.
- ~1,445 weakly-connected nodes are config leaves (tsconfig/package keys), not documentation gaps.
- Test→code links are import-verified where possible (`test_links.json`); textual "Related tests (HEURISTIC)" remain a fallback and are NOT coverage proof. Black-box e2e specs have no direct edges.
- No git-SHA stamp: staleness cannot be auto-detected — regenerate the graph if source may have changed.

## Authority order (never overridden by the graph)
migrations/ + apps/** + tests/  >  schema.ts  >  bridges (provenance)  >  AST edges  >  communities/INFERRED  >  docs  >  agent memory

---
_[[_INDEX]]_
