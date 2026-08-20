> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-20T13:32:55.646Z

# Table: `server_credentials`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[serverCredentials]]
- **Migration source:** [[0002_server_access_outbounds.sql]]
- **Raw table note:** [[server_credentials]]
- **Change-risk (DERIVED from coupling):** Low — <3 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[OperationsService]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/operations/operations.service.ts:802  |  INSERT INTO server_credentials (`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0002_server_access_outbounds.sql]] and [[serverCredentials]].

## Tests (deterministic — import → bridge, VERIFIED)
_No test imports a production file that this table's bridge marks as a consumer._

## Related tests (HEURISTIC — textual name reference, not import-verified)
_No test file references this table by name._

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
