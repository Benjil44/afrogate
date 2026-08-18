> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Module: `agents`

- **Source path:** `apps/backend/src/agents/`
- **Dominant graph community (hint, not authoritative):** Agents
- **High-risk dependencies (DERIVED):** [[tbl-servers]]

## Services / classes (VERIFIED)
- [[AgentHeartbeatController]] — `apps/backend/src/agents/agent-heartbeat.controller.ts:L9`
- [[AgentHeartbeatDto]] — `apps/backend/src/agents/dto/agent-heartbeat.dto.ts:L4`
- [[AgentsController]] — `apps/backend/src/agents/agents.controller.ts:L13`
- [[AgentsService]] — `apps/backend/src/agents/agents.service.ts:L34`
- [[CreatedTokenRow]] — `apps/backend/src/agents/agents.service.ts:L20`
- [[RegisterAgentDto]] — `apps/backend/src/agents/dto/register-agent.dto.ts:L4`
- [[RegisteredServerRow]] — `apps/backend/src/agents/agents.service.ts:L12`
- [[RevokedTokenRow]] — `apps/backend/src/agents/agents.service.ts:L27`
- [[RotateAgentTokenDto]] — `apps/backend/src/agents/dto/rotate-agent-token.dto.ts:L4`

## Database tables touched (VERIFIED — evidence-backed)
- [[tbl-agent_tokens]] ([[agent_tokens]])
- [[tbl-servers]] ([[servers]])

## Services sharing those tables (VERIFIED)
- [[AlertEngineService]]
- [[BillingService]]
- [[OperationsController]]
- [[OperationsService]]
- [[PostgresMetricsRepository]]
- [[agent-token.guard.ts]]

## Depends on — modules (VERIFIED: AST import/call edges)
- [[mod-audit]]
- [[mod-database]]
- [[mod-security]]

## Depended on by — modules (VERIFIED: AST import/call edges)
_none_

## Related tests (by reference)
- `apps/backend/test/rbac.test.ts`
- `tests/e2e/dashboard-visual.spec.ts`

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
