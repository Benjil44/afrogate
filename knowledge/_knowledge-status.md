> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Knowledge-Layer Status

## Knowledge freshness
_Deterministic given (current HEAD, knowledge-manifest). Source: `graphify-out/knowledge-manifest.json` (written by `scripts/knowledge/build-manifest.mjs`; regenerable / gitignored). No wall-clock enters this section — the SHA + state are stable for a given HEAD + manifest._
- **Source revision (from manifest):** `7a9748174add`
- **Current HEAD:** `cbe979f675fc`
- **State:** **STALE**
- **Rule:** If STALE, knowledge artifacts describe an older source revision than HEAD — treat as HINTS ONLY and re-verify against source.

- **Graph artifact time (graph.json mtime):** 2026-08-18T21:12:01.002Z
- **Nodes:** 5642
- **Edges:** 14442
- **Config-leaf nodes (build/tooling manifest keys — graph noise, not gaps):** 339 total, 224 weakly-connected — deterministically classified (path+basename), excluded from documentation-gap accounting.
- **Bridge edges:** 249 (entity↔table 47, table↔service 202)
- **Test→code links:** 68 import (VERIFIED), 1 convention, 7 fixture, 0 unresolved, 10 black-box specs — source `graphify-out/test_links.json`
- **Service→service DI links:** 98 (direct 97, token 1, forwardRef 0); 0 DI cycles; 0 unresolved — source `graphify-out/service_links.json`
- **Migration-backed tables:** 51
- **Modeled Drizzle entities:** 47
- **Intentional raw-SQL exceptions:** 4 — [[tbl-egress_tier_prices]], [[tbl-mikrotik_wg_rates]], [[tbl-mikrotik_wg_samples]], [[tbl-outbound_test_settings]]

## Provenance rules
- **VERIFIED / EXTRACTED:** AST edges (`_origin: ast`) and bridge edges (schema↔code) with a `source_location`/evidence line — trust as fact.
- **INFERRED:** LLM/semantic edges and community membership — hints; verify against source.
- **INTENTIONAL EXCEPTION:** the 4 Class-C raw-SQL tables — documented in `docs/schema-drift-audit.md`.

## Weakly-connected node accounting (noise vs gaps)
_The Graphify report flags nodes with ≤1 neighbour as "isolated / possible documentation gaps". The classifier in `build-mocs.mjs` (deterministic — path + basename + config-key label, no LLM) separates true config noise from genuine leaves so the raw count is explained, not mistaken for gaps._
- **Weakly-connected nodes (≤1 neighbour):** 1881
- **→ Config-leaf noise (SUPPRESSED — not gaps):** 224 — keys of build/tooling manifests (tsconfig / package.json / nest-cli / pyproject). 339 config-leaf nodes exist across all degrees.
- **→ Genuine source/doc leaves (NOT config noise):** 1657 — barrel-exported types, DTOs, mobile-app screens, and ADR/design concept nodes; reachable via the module / table / domain MOCs, so they are navigation leaves rather than documentation gaps.
- **Examples of suppressed config-leaf noise:** `$schema (nest-cli.json)`, `allowImportingTsExtensions (tsconfig.json)`, `baseUrl (tsconfig.base.json)`, `baseUrl (tsconfig.json)`, `collection (nest-cli.json)`, `declaration (tsconfig.json)`, `description (package.json)`, `emitDecoratorMetadata (tsconfig.json)`.
- _Supersedes the earlier hand-estimated "~1,445 config leaves". The classifier is conservative: it never touches application source (`apps/**`, `packages/**`), docs, tests, or migrations — only structured config/manifest files._

## Known limitations
- Service→service edges are VERIFIED constructor-DI (`service_links.json`); foreign-key edges are still NOT in the artifacts (FKs live in migrations/`schema.ts`).
- Weakly-connected nodes are accounted for above: 224 are config-leaf noise (not gaps); the remaining 1657 are genuine source/doc leaves reachable via the MOCs.
- Test→code links are import-verified where possible (`test_links.json`); textual "Related tests (HEURISTIC)" remain a fallback and are NOT coverage proof. Black-box e2e specs have no direct edges.
- Staleness is auto-detected via `knowledge-manifest.json` (source SHA vs HEAD) — see **Knowledge freshness** above; current state: **STALE**. If the manifest is absent the state is UNKNOWN.

## Authority order (never overridden by the graph)
migrations/ + apps/** + tests/  >  schema.ts  >  bridges (provenance)  >  AST edges  >  communities/INFERRED  >  docs  >  agent memory

---
_[[_INDEX]]_
