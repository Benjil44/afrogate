> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Module: `audit`

- **Source path:** `apps/backend/src/audit/`
- **Dominant graph community (hint, not authoritative):** Audit
- **High-risk dependencies (DERIVED):** _none among heavily-coupled tables_

## Services / classes (VERIFIED)
- [[AuditLogFilters]] — `apps/backend/src/audit/audit.service.ts:L6`
- [[AuditLogRow]] — `apps/backend/src/audit/audit.service.ts:L15`
- [[AuditService]] — `apps/backend/src/audit/audit.service.ts:L38`

## Database tables touched (VERIFIED — evidence-backed)
- [[tbl-audit_logs]] ([[audit_logs]])

## Services sharing those tables (VERIFIED)
_none_

## Depends on — modules (VERIFIED: AST import/call edges)
- [[mod-database]]
- [[mod-security]]

## Depended on by — modules (VERIFIED: AST import/call edges)
- [[mod-agents]]
- [[mod-auth]]
- [[mod-billing]]
- [[mod-branding]]
- [[mod-notifications]]
- [[mod-operations]]
- [[mod-telegram]]

## Related tests (by reference)
_none by name reference_

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
