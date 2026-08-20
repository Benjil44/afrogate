> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-20T13:32:55.646Z

# Table: `audit_logs`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[auditLogs]]
- **Migration source:** [[0001_core_monitoring.sql]]
- **Raw table note:** [[audit_logs]]
- **Change-risk (DERIVED from coupling):** Low — <3 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[AuditService]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/audit/audit.service.ts:51  |  INSERT INTO audit_logs (actor_type, actor_id, action, target_type, target_id, metadata)`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0001_core_monitoring.sql]] and [[auditLogs]].

## Tests (deterministic — import → bridge, VERIFIED)
_No test imports a production file that this table's bridge marks as a consumer._

## Related tests (HEURISTIC — textual name reference, not import-verified)
_No test file references this table by name._

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
