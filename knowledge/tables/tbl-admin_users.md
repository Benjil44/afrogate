> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-20T16:27:17.978Z

# Table: `admin_users`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[adminUsers]]
- **Migration source:** [[0027_admin_users.sql]]
- **Raw table note:** [[admin_users]]
- **Change-risk (DERIVED from coupling):** Low — <3 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[AuthService]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/auth/auth.service.ts:616  |  await this.database.query('DELETE FROM admin_users WHERE id = $1', [id]);`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0027_admin_users.sql]] and [[adminUsers]].

## Tests (deterministic — import → bridge, VERIFIED)
_No test imports a production file that this table's bridge marks as a consumer._

## Related tests (HEURISTIC — textual name reference, not import-verified)
_No test file references this table by name._

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
