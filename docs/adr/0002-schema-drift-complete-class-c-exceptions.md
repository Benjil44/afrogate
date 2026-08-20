# ADR 0002 — Schema-drift remediation is complete; 4 Class-C tables stay raw-SQL

**Status:** Accepted

## Context

`schema.ts` had drifted from the authoritative migrations: 13 migration tables had no
`pgTable` entity, and two mapped entities (`customer_accounts`, `outbounds`) were missing
columns. The full audit and phased remediation are recorded in
`docs/schema-drift-audit.md` (program marked **COMPLETE**). This ADR ratifies that
program's end-state as a human decision so it is not re-opened or re-derived.

## Decision

- The schema-drift program is **CLOSED**. There is no remaining unresolved drift.
- **47 of 51** migration-backed tables are modeled as Drizzle entities. Mapped-entity drift is closed (`customer_accounts` 26/26, `outbounds` 28/28 migration columns).
- The remaining **4 tables are INTENTIONAL Class-C raw-SQL exceptions**, not drift, and **stay raw-SQL-only unless the architecture changes**:
  - `mikrotik_wg_samples` — append-only telemetry (bigserial PK, no FK, high-frequency inserts).
  - `mikrotik_wg_rates` — composite-key rate config, UPSERT (no FK).
  - `outbound_test_settings` — boolean singleton settings row.
  - `egress_tier_prices` — text-PK 2-row lookup/reference data.
- DB-level CHECK constraints are intentionally left DB-enforced (file convention), not mirrored into `schema.ts`.

## Consequences

- Adding a `pgTable` for a Class-C table is a rejected change absent an architectural reason (they gain no type-safety or FK-visibility benefit; ORM modeling only adds ceremony).
- Any new migration table must be either modeled or explicitly classified — silence is drift.
- The 47/51 + 4 tallies are load-bearing; changing them requires updating this ADR and the audit.

## Affected paths

- `infra/postgres/migrations/**`
- `apps/backend/src/database/schema.ts`
- Raw-SQL access via `apps/backend/src/database/database.service.ts` for the 4 Class-C tables.

## Source evidence

- `docs/schema-drift-audit.md` — "Program status: COMPLETE … 47 of 51 modeled … 4 documented intentional Class-C raw-SQL exceptions."
- `knowledge/_knowledge-status.md` — "Migration-backed tables: 51 · Modeled Drizzle entities: 47 · Intentional raw-SQL exceptions: 4".
