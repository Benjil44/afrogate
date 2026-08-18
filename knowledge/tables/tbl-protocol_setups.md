> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Table: `protocol_setups`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[protocolSetups]]
- **Migration source:** [[0004_settings_protocols.sql]]
- **Raw table note:** [[protocol_setups]]
- **Change-risk (DERIVED from coupling):** Low — <3 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[OperationsService]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/operations/operations.service.ts:3032  |  INSERT INTO protocol_setups (`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0004_settings_protocols.sql]] and [[protocolSetups]].

## Related tests (by reference)
_No test file references this table by name._

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
