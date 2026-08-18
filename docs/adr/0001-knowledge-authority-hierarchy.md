# ADR 0001 — Knowledge / source-of-truth authority hierarchy

**Status:** Accepted

## Context

Afrows carries several overlapping descriptions of the same system: hand-written SQL
migrations, runtime code, tests, a hand-maintained Drizzle `schema.ts`, the Graphify
knowledge graph (bridges, AST edges, communities), the generated `knowledge/` vault,
`docs/`, and `.codex/memory.md`. These can disagree — the schema-drift audit
(`docs/schema-drift-audit.md`) documented `schema.ts` drifting from migrations, and the
graph carries a mix of VERIFIED and INFERRED edges with no git-SHA stamp. Agents and
humans need one fixed rule for which source wins when two disagree.

## Decision

Resolve any conflict by this strict order (higher wins):

```
migrations/ + apps/** (code) + tests/  >  schema.ts  >  bridges (provenance)
  >  AST edges  >  communities / INFERRED  >  docs  >  agent memory
```

Refined by concern:

- **DB shape** (columns, types, nullability, defaults, PK, indexes, FKs, CHECKs) — **migrations are authoritative.**
- **Runtime behavior** — **source (`apps/**`) is authoritative.**
- **Correctness** — **tests are authoritative.**
- `schema.ts` is a declarative schema-of-record and derived-type source; it must track migrations, never lead them.
- Graph edges are authority-ranked by provenance: VERIFIED/EXTRACTED (AST + bridge edges with a `source_location`) are trusted; INFERRED (semantic/community) edges are hints to verify against source.
- The graph has **no git-SHA stamp**; treat it as a HINT that may predate HEAD — regenerate if source may have changed.

## Consequences

- A doc or memory note never overrides code, tests, or migrations; it is context, not a ruling.
- Evidence-backed (VERIFIED) edges outrank inferred edges everywhere.
- Human decisions that must outrank the regenerable vault live in this ADR set + `docs/invariants.md` (Tier-C), not inside `knowledge/`.

## Affected paths

- `infra/postgres/migrations/**` (authoritative DB shape)
- `apps/backend/src/database/schema.ts`
- `apps/**`, `tests/**`
- `graphify-out/**`, `knowledge/**` (derived, lower authority)
- `docs/**`, `.codex/memory.md`

## Source evidence

- `knowledge/_knowledge-status.md` — "Authority order (never overridden by the graph)" + provenance rules; no git-SHA stamp.
- `docs/schema-drift-audit.md` — "Migrations are the authoritative source of truth throughout this audit."
