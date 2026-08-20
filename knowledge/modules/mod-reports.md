> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-20T13:32:55.646Z

# Module: `reports`

- **Source path:** `apps/backend/src/reports/`
- **Dominant graph community (hint, not authoritative):** BackupStatusService
- **High-risk dependencies (DERIVED):** _none among heavily-coupled tables_

## Services / classes (VERIFIED)
- [[AdminReportsService]] — `apps/backend/src/reports/admin-reports.service.ts:L18`

## Database tables touched (VERIFIED — evidence-backed)
_none via bridge provenance_

## Services sharing those tables (VERIFIED)
_none_

## Depends on — modules (VERIFIED: AST import/call edges)
- [[mod-backups]]
- [[mod-operations]]

## Depended on by — modules (VERIFIED: AST import/call edges)
- [[mod-operations]]

## Service dependency injection (VERIFIED / EXTRACTED — NestJS constructor DI)
- **[[AdminReportsService]]** — injects: [[BackupStatusService]], [[OperationsService]]
  - injected by: [[OperationsController]]

## Tests importing this module (VERIFIED / EXTRACTED)
_none — no test imports a file in this module directly_

## Tests by filename convention (CONVENTION — not verified coverage)
_none_

## Related tests (HEURISTIC — textual name reference)
_none by name reference_

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
