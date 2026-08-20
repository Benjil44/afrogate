> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-20T16:27:17.978Z

# Module: `auth`

- **Source path:** `apps/backend/src/auth/`
- **Dominant graph community (hint, not authoritative):** auth.service.ts
- **High-risk dependencies (DERIVED):** _none among heavily-coupled tables_

## Services / classes (VERIFIED)
- [[AdminAccountConfig]] — `apps/backend/src/auth/auth.service.ts:L55`
- [[AdminLoginDto]] — `apps/backend/src/auth/dto/admin-login.dto.ts:L3`
- [[AdminUserRow]] — `apps/backend/src/auth/auth.service.ts:L85`
- [[AuthController]] — `apps/backend/src/auth/auth.controller.ts:L9`
- [[AuthService]] — `apps/backend/src/auth/auth.service.ts:L98`
- [[CreateAdminUserDto]] — `apps/backend/src/auth/dto/admin-user.dto.ts:L7`
- [[ImpersonationCaller]] — `apps/backend/src/auth/impersonation.ts:L13`
- [[ImpersonationTargetAccount]] — `apps/backend/src/auth/impersonation.ts:L19`
- [[StoredAdminUser]] — `apps/backend/src/auth/auth.service.ts:L69`
- [[StoredAdminUsersFile]] — `apps/backend/src/auth/auth.service.ts:L81`
- [[UpdateAdminUserDto]] — `apps/backend/src/auth/dto/admin-user.dto.ts:L26`
- [[UpdateAdminUserPasswordDto]] — `apps/backend/src/auth/dto/admin-user.dto.ts:L36`

## Database tables touched (VERIFIED — evidence-backed)
- [[tbl-admin_users]] ([[admin_users]])

## Services sharing those tables (VERIFIED)
_none_

## Depends on — modules (VERIFIED: AST import/call edges)
- [[mod-audit]]
- [[mod-database]]
- [[mod-security]]

## Depended on by — modules (VERIFIED: AST import/call edges)
- [[mod-billing]]
- [[mod-operations]]
- [[mod-security]]

## Service dependency injection (VERIFIED / EXTRACTED — NestJS constructor DI)
- **[[AuthController]]** — injects: [[AuthService]]
  - injected by: _none_
- **[[AuthService]]** — injects: [[AuditService]], [[DatabaseService]]
  - injected by: [[AdminTokenGuard]], [[AuthController]], [[BillingController]], [[OperationsController]]

## Tests importing this module (VERIFIED / EXTRACTED)
- `apps/backend/test/reseller-impersonation.test.ts`

## Tests by filename convention (CONVENTION — not verified coverage)
_none_

## Related tests (HEURISTIC — textual name reference)
- `apps/backend/test/reseller-impersonation.test.ts`

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
