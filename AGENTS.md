# Afrows Agent Instructions

Before changing code or architecture in this repository, read these files first:

1. `.codex/memory.md`
2. `.codex/progress.md`
3. `.codex/checklist.md`
4. `.codex/agent.md`
5. `docs/mvp-monitoring-prd-fa.md`
6. `docs/technical-architecture-fa.md`
7. `docs/roadmap-fa.md`
8. `docs/enhancement-approaches-fa.md`
9. `docs/implementation-start-plan-fa.md`
10. `docs/control-plane-egress.md`
11. `docs/server-access-and-outbound-management.md`
12. `docs/dashboard-sidebar-pages-checklist.md`
13. `docs/multilingual-ui.md`
14. `docs/versioning-policy.md`
15. `docs/repository-structure.md`
16. `docs/security-performance-policy.md`
17. `SECURITY.md`

After each meaningful implementation session:

- Update `.codex/progress.md` with what changed, what was verified, and what remains.
- Update `.codex/memory.md` when a stable product or technical decision is made.
- Update `.codex/checklist.md` when tasks move from pending to done.
- Bump the Afrows version, update `CHANGELOG.md`, and run `npm run version:check` for each meaningful implementation section.
- Keep dashboard user-facing labels in the typed multilingual layer instead of hardcoding English-only UI copy.
- Keep privacy, safety, and human-rights requirements visible in every design decision.
- Keep code clean, typed, and deduplicated.
- Optimize for low-resource VPS machines: low CPU, low RAM, compact metrics, no unnecessary services.
- Treat every public port and unauthenticated endpoint as a security risk until proven otherwise.

Do not commit secrets, server credentials, Telegram tokens, user personal data, or production config.

## Engineering Knowledge Layer — Operating Contract

The `knowledge/` MOCs and `graphify-out/` graph are a *derived map* of the codebase. They accelerate context-loading and impact analysis; they never replace reading the source. This contract governs how much to trust them.

### 1. Source-of-truth hierarchy (highest → lowest authority)

1. **`migrations/**` + `apps/**` + `tests/**`** — AUTHORITATIVE. Real DB shape, real behavior, real expectations.
2. **`schema.ts`** — aligned mirror of the migrated DB (trust only while it matches migrations).
3. **`graphify-out/bridges.json`, `test_links.json`, `service_links.json`** — DERIVED-with-provenance (each edge carries a `source_location`).
4. **AST edges** in `graphify-out/graph.json` — extracted structure.
5. **Communities / INFERRED relationships** — semantic clustering, hints only.
6. **`docs/**`** — intent and narrative, may lag code.
7. **Agent memory** (`.codex/memory.md`, `~/.claude/.../MEMORY.md`) — lowest; context, not ground truth.

### 2. Graph authority rule

The graph NEVER outranks source code, migrations, or tests. When the graph and the source disagree, the source is right and the graph is stale or wrong.

### 3. Fact-type semantics

- **VERIFIED / EXTRACTED** — AST edges and bridge edges that carry a `source_location`. Trust them, but they reflect the revision they were built from.
- **INFERRED** — semantic / community relationships. Treat as *hints*; verify against source before acting.
- **DERIVED** — computed signals (e.g. coupling-based risk in `_hotspots.md`). Useful for prioritization, not proof.
- **AMBIGUOUS** — anything flagged uncertain; verify against source before relying on it.

### 4. Context-loading protocol (before editing any code)

1. Read the **target source file** and its **imports**.
2. Query **`graphify-out/bridges.json`** for the tables the target touches and the other services that share those tables.
3. Read the owning **module MOC**: `knowledge/modules/mod-<x>.md`.
4. Read relevant **ADRs / invariants** where present: `docs/adr/`, `docs/invariants.md`.
5. Read any **task-typed docs** relevant to the change.
6. Get the **VERIFIED tests to run before/after** from `graphify-out/test_links.json`, and the **DI dependents** from `graphify-out/service_links.json`.

### 5. Graph staleness rule

The knowledge manifest carries the source SHA it was built from. If the artifacts describe an older source revision than `HEAD`, treat *all* knowledge output as HINTS ONLY and re-verify against source before acting.

### 6. Conflict recovery

- **DB shape** conflict → migrations win.
- **Behavior** conflict → source wins.
- **Correctness** conflict → tests win.
- **Intent / "why"** conflict → ADRs / invariants / memory win.
- The graph is a derived map: on any conflict, re-derive from source and **surface the contradiction** (don't silently pick a side).

### 7. How to use the knowledge layer

- `knowledge/_INDEX.md` — entry point.
- **Module MOCs** (`knowledge/modules/mod-<x>.md`) — dependencies, tables, tests, DI for a module.
- **Table MOCs** (`knowledge/tables/`) — consumers, owning migration, entity.
- `knowledge/_hotspots.md` — risk ranking + recommended tests + DI fan-in/fan-out.
- `graphify-out/test_links.json` — tests → code.
- `graphify-out/service_links.json` — service → service DI.

### 8. Generated MOCs are not hand-editable

Files under `knowledge/` are generated. Do NOT hand-edit them; change the generators in `scripts/knowledge/` (`build-mocs.mjs`, `build-service-links.mjs`, `build-test-links.mjs`) and regenerate.

### 9. Inferred relationships must be verified

Any inferred / community relationship must be verified against source before it informs an architectural decision.

### 10. Required pre/post test inspection for high-risk areas

Before changing high-risk areas — `BillingService`, `OperationsService`, `customer_accounts`, auth / RBAC, financial tables, MikroTik / Telegram integrations — inspect the linked tests via `test_links.json`, run them **before** the change to capture the baseline and **after** to confirm no regression.

### 11. Impact-analysis workflow

`source → bridges.json → test_links.json → service_links.json (DI) → ADR / invariants → implement → run the linked tests`.

> The knowledge layer does **not** guarantee complete test coverage or complete semantic-dependency knowledge. Absence of a link is not proof of no dependency — when in doubt, read the source.
