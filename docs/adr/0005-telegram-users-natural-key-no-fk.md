# ADR 0005 — `telegram_users.telegram_id` is a natural text PK, not a foreign key

**Status:** Accepted

## Context

`telegram_users` stores per-Telegram-user session/preference state. Its PK is the
Telegram id as **text**. `customer_accounts` also carries a `telegram_id`. A naive
reading would add a surrogate uuid PK and/or an FK `telegram_users.telegram_id →
customer_accounts.telegram_id`. Both would be wrong: a `telegram_users` row exists for a
Telegram id **before** any customer account (language is chosen at first `/start`), and
the id↔account relationship is a soft lookup, not referential integrity.

## Decision

- `telegram_users` is modeled intentionally as a real entity (not a raw-SQL idiom).
- Its **natural text PK `telegram_id` is intentional** and stays — no surrogate key.
- There is **no FK to `customer_accounts`**. The `telegram_id ↔ customer_accounts.telegram_id` join is a **soft/ad-hoc lookup**, so the entity has **no `.references()` and no `relations()`**.
- `state` is modeled as plain `jsonb`; its typed shape lives in `telegram-user-store.ts`, not in `schema.ts`.

## Consequences

- No cascade/relation is expected or enforced between Telegram session rows and customer accounts; a `telegram_users` row may have no matching account and that is valid.
- Tools that infer FKs from name collisions must not add this edge; reviewers should reject such a "fix."

## Affected paths

- `apps/backend/src/database/schema.ts` — `telegram_users` entity
- `telegram-user-store.ts` — `TelegramUserRow` / `TelegramUserRecord` / `TelegramUserState`

## Source evidence

- `docs/schema-drift-audit.md` — "Natural text PK (`telegram_id`) is intentional … No FK to `customer_accounts` is intentional … hence no `.references()` and no `relations()`."
