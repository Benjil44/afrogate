> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-20T16:27:17.978Z

# Table: `tunnels`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[tunnels]]
- **Migration source:** [[0012_tunnels_interfaces.sql]]
- **Raw table note:** [[tunnels]]
- **Change-risk (DERIVED from coupling):** Low — <3 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[OperationsController]]
- [[OperationsService]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/operations/operations.controller.ts:348  |  @Get('tunnels')`  _(confidence 0.8)_
- `apps/backend/src/operations/operations.service.ts:896  |  FROM tunnels`  _(confidence 0.8)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0012_tunnels_interfaces.sql]] and [[tunnels]].

## Tests (deterministic — import → bridge, VERIFIED)
_No test imports a production file that this table's bridge marks as a consumer._

## Related tests (HEURISTIC — textual name reference, not import-verified)
- `tests/e2e/dashboard-visual.spec.ts`

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
