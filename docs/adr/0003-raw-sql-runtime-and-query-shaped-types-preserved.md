# ADR 0003 — Raw-SQL runtime is preserved; query-shaped types are not force-replaced

**Status:** Accepted

## Context

The backend accesses Postgres almost entirely through **raw parameterized SQL** via
`DatabaseService.query()/transaction()` — **not** the Drizzle query builder. `schema.ts`
exists for typing/documentation and derived row types, not as a runtime query layer.
Alongside the ORM entities the codebase keeps hand-written **query-shaped / partial /
domain** row types (projections that match a specific `SELECT`, not the full table).
Examples: `RouterRow` (snake_case, hand-synced across ALTERs) and `WireguardPeerRecord`
(a 5-of-16-column partial). Modeling entities in `schema.ts` (ADR 0002) could tempt a
blanket replacement of these with `$inferSelect`/`InferSelectModel`; that would break
runtime shapes and lose intentional projections.

## Decision

- **Do NOT convert raw SQL to the Drizzle query builder.** Adding a `pgTable` changes nothing at runtime and must not; the app stays on raw SQL.
- **Do NOT force-replace query-shaped / partial / domain row types with `$inferSelect`.** Replace a manual type with a derived type only when it is **structurally equivalent** to the entity **and** tests prove the equivalence.
- Distinct abstractions (query-shaped projection vs. domain object vs. typed JSONB shape — e.g. `TelegramUserRow` / `TelegramUserRecord` / `TelegramUserState`) are retained on purpose.

## Consequences

- `schema.ts` entities are the declarative schema-of-record and an *optional* source of derived types — not a mandate to rewrite call sites.
- Partial/snake_case row types remain valid and must stay hand-synced to migrations (they are a known drift hazard; that is a maintenance cost, not a reason to auto-replace).
- Self-contained `node --test` modules keep type-only schema imports; never run `push`/`generate`/`migrate`.

## Affected paths

- `apps/backend/src/database/database.service.ts` (raw-SQL runtime)
- `apps/backend/src/routers/routers.service.ts:26` — `RouterRow`
- `apps/backend/src/billing/billing.service.ts:270` — `WireguardPeerRecord`
- `telegram-user-store.ts` — `TelegramUserRow` / `TelegramUserRecord` / `TelegramUserState`

## Source evidence

- `docs/schema-drift-audit.md` — "raw-SQL runtime is unchanged; and query-shaped / domain / partial manual row types are **retained** (never force-replaced by `$inferSelect`)."
