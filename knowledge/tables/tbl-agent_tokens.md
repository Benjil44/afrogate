> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Table: `agent_tokens`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[agentTokens]]
- **Migration source:** [[0001_core_monitoring.sql]]
- **Raw table note:** [[agent_tokens]]
- **Change-risk (DERIVED from coupling):** Low — <3 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[AgentsService]]
- [[agent-token.guard.ts]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/agents/agents.service.ts:51  |  UPDATE agent_tokens`  _(confidence 0.9)_
- `apps/backend/src/security/agent-token.guard.ts:71  |  UPDATE agent_tokens agt`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0001_core_monitoring.sql]] and [[agentTokens]].

## Tests (deterministic — import → bridge, VERIFIED)
_No test imports a production file that this table's bridge marks as a consumer._

## Related tests (HEURISTIC — textual name reference, not import-verified)
_No test file references this table by name._

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
