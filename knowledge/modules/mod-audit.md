> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-20T13:32:55.646Z

# Module: `audit`

- **Source path:** `apps/backend/src/audit/`
- **Dominant graph community (hint, not authoritative):** DatabaseService
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

## Service dependency injection (VERIFIED / EXTRACTED — NestJS constructor DI)
- **[[AuditService]]** — injects: [[DatabaseService]]
  - injected by: [[AdminTenantBrandingService]], [[AgentsService]], [[AlertNotificationService]], [[AuthService]], [[BillingService]], [[OperationsController]], [[OperationsService]], [[TelegramBotConfigService]], [[TelegramProfileService]], [[TelegramTopupAdminService]]

## Tests importing this module (VERIFIED / EXTRACTED)
_none — no test imports a file in this module directly_

## Tests by filename convention (CONVENTION — not verified coverage)
_none_

## Related tests (HEURISTIC — textual name reference)
_none by name reference_

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
