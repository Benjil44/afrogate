# ADR 0006 — The `knowledge/` vault is generated; human decisions live in ADRs/invariants

**Status:** Accepted

## Context

`knowledge/` (the MOC vault: `_INDEX.md`, `_domains.md`, `_hotspots.md`,
`_knowledge-status.md`, `mod-*.md`, `tbl-*.md`) and `graphify-out/**` are **derived
artifacts** produced from the Graphify graph by `scripts/knowledge/build-mocs.mjs`. Every
generated file carries an `AUTO-GENERATED — DO NOT EDIT` banner. If a human writes a
decision or correction into these files, the next regeneration silently erases it.
There must be a durable, human-owned place for engineering decisions that outrank the
regenerable graph.

## Decision

- `knowledge/**` and `graphify-out/**` are **GENERATED and MUST NOT be hand-edited.** To change their content, change the generator/source and regenerate (`node scripts/knowledge/build-mocs.mjs`).
- **Human-reviewed decisions and invariants live in this Tier-C layer** — `docs/adr/**` and `docs/invariants.md` — never inside the vault.
- Tier-C outranks the vault: per ADR 0001, docs sit above agent memory but the graph never overrides code/tests/migrations, and these ADRs record *human* rulings the graph cannot make.

## Consequences

- A reviewer who spots a wrong/inferred fact in `knowledge/` fixes the generator or records the correct decision in an ADR/invariant — not by editing the MOC.
- ADRs are stable and human-authored; they are not regenerated and do not carry the DO-NOT-EDIT banner.

## Affected paths

- `knowledge/**`, `graphify-out/**` (generated — read-only for humans)
- `scripts/knowledge/build-mocs.mjs` (generator — the edit point)
- `docs/adr/**`, `docs/invariants.md` (human-owned decisions)

## Source evidence

- `knowledge/_INDEX.md`, `knowledge/_knowledge-status.md` — "AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`" and "Do not edit generated files; edit the generator."
