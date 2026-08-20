> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Module: `security`

- **Source path:** `apps/backend/src/security/`
- **Dominant graph community (hint, not authoritative):** Auth & Accounts
- **High-risk dependencies (DERIVED):** [[tbl-servers]]

## Services / classes (VERIFIED)
- [[AdminSessionPayload]] — `apps/backend/src/security/session-token.ts:L6`
- [[AdminTokenGuard]] — `apps/backend/src/security/admin-token.guard.ts:L7`
- [[AgentTokenGuard]] — `apps/backend/src/security/agent-token.guard.ts:L21`
- [[AuditActor]] — `apps/backend/src/security/auth-request.ts:L3`
- [[AuthActor]] — `apps/backend/src/security/auth-request.ts:L10`
- [[ClientAuthActor]] — `apps/backend/src/security/auth-request.ts:L18`
- [[ClientTokenGuard]] — `apps/backend/src/security/client-token.guard.ts:L13`
- [[HttpRequestLike]] — `apps/backend/src/security/rate-limit.guard.ts:L6`
- [[HttpResponseLike]] — `apps/backend/src/security/rate-limit.guard.ts:L14`
- [[RateLimitDecision]] — `apps/backend/src/security/rate-limit-window.ts:L11`
- [[RateLimitEntry]] — `apps/backend/src/security/rate-limit-window.ts:L1`
- [[RateLimitGuard]] — `apps/backend/src/security/rate-limit.guard.ts:L19`
- [[RateLimitOptions]] — `apps/backend/src/security/rate-limit.decorator.ts:L5`
- [[RateLimitService]] — `apps/backend/src/security/rate-limit.service.ts:L14`
- [[RateLimitWindowOptions]] — `apps/backend/src/security/rate-limit-window.ts:L6`
- [[RegisteredAgentTokenRow]] — `apps/backend/src/security/agent-token.guard.ts:L13`
- [[RequestWithAuth]] — `apps/backend/src/security/auth-request.ts:L28`
- [[RequestWithClientAuth]] — `apps/backend/src/security/auth-request.ts:L35`
- [[RolesGuard]] — `apps/backend/src/security/roles.guard.ts:L8`
- [[SecretEnvelope]] — `apps/backend/src/security/secret-vault.service.ts:L4`
- [[SecretVaultService]] — `apps/backend/src/security/secret-vault.service.ts:L10`

## Database tables touched (VERIFIED — evidence-backed)
- [[tbl-agent_tokens]] ([[agent_tokens]])
- [[tbl-servers]] ([[servers]])

## Services sharing those tables (VERIFIED)
- [[AgentsService]]
- [[AlertEngineService]]
- [[BillingService]]
- [[OperationsController]]
- [[OperationsService]]
- [[PostgresMetricsRepository]]

## Depends on — modules (VERIFIED: AST import/call edges)
- [[mod-auth]]
- [[mod-billing]]
- [[mod-database]]

## Depended on by — modules (VERIFIED: AST import/call edges)
- [[mod-agents]]
- [[mod-audit]]
- [[mod-auth]]
- [[mod-billing]]
- [[mod-branding]]
- [[mod-client]]
- [[mod-metrics]]
- [[mod-operations]]
- [[mod-routers]]
- [[mod-telegram]]

## Service dependency injection (VERIFIED / EXTRACTED — NestJS constructor DI)
- **[[AdminTokenGuard]]** — injects: [[AuthService]]
  - injected by: _none_
- **[[AgentTokenGuard]]** — injects: [[DatabaseService]]
  - injected by: _none_
- **[[ClientTokenGuard]]** — injects: [[BillingService]]
  - injected by: _none_
- **[[RateLimitGuard]]** — injects: [[RateLimitService]]
  - injected by: _none_
- **[[RateLimitService]]** — injects: _none_
  - injected by: [[RateLimitGuard]]
- **[[SecretVaultService]]** — injects: _none_
  - injected by: [[BillingService]], [[OperationsService]], [[RoutersService]], [[TelegramBotConfigService]]

## Tests importing this module (VERIFIED / EXTRACTED)
- `apps/backend/test/agent-token.test.ts`
- `apps/backend/test/bearer-token.test.ts`
- `apps/backend/test/client-token.test.ts`
- `apps/backend/test/generate-password.test.ts`
- `apps/backend/test/password.test.ts`
- `apps/backend/test/rate-limit-window.test.ts`
- `apps/backend/test/reseller-impersonation.test.ts`
- `apps/backend/test/session-token.test.ts`

## Tests by filename convention (CONVENTION — not verified coverage)
_none_

## Related tests (HEURISTIC — textual name reference)
- `apps/backend/test/client-token.test.ts`
- `apps/backend/test/rate-limit-window.test.ts`
- `apps/backend/test/rbac.test.ts`
- `apps/backend/test/reseller-impersonation.test.ts`
- `apps/backend/test/session-token.test.ts`
- `tests/e2e/dashboard-visual.spec.ts`

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
