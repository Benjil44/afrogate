# ADR 0004 — Money and byte-quota columns use bigint semantics

**Status:** Accepted

## Context

Wallet balances, ledger amounts, and byte-based quota/usage counters can exceed 32-bit
range and must not lose precision to floating point. The established pattern in
`schema.ts` models these as Postgres `bigint` with the JS `number` mode
(`bigint({ mode: 'number' })`).

## Decision

- Money and byte-quota columns use **`bigint({ mode: 'number' })`** where this pattern is already established (wallet/ledger amounts, `*_bytes` quota/usage counters, gems balances, reward bytes).
- New money/byte columns follow the same pattern; do not introduce `numeric`/`float`/`integer` for these roles.
- This is a modeling/typing decision. The **quota UNIT** (decimal GB = 1e9 bytes, single source `quota-math.ts BYTES_PER_GB`) is a separate rule owned by `docs/invariants.md` and `.codex/memory.md`; the two must stay consistent.

## Consequences

- Values stay integers end-to-end (define → enforce → display); no 7.4% GiB-vs-GB style inflation from unit or float drift.
- `mode: 'number'` assumes values stay within `Number.MAX_SAFE_INTEGER` (~9.007e15 bytes ≈ 9 PB) — safe for per-account byte counters; revisit only if aggregate columns could exceed that.

## Affected paths

- `apps/backend/src/database/schema.ts` (e.g. `balance_amount`, `credit_limit_amount`, `quota_limit_bytes`, `per_client_limit_bytes`, `used_bytes`, `gems_balance`, `reward_bytes`)
- `apps/backend/src/**/quota-math.ts` (unit constant — see invariants)

## Source evidence

- `schema.ts:503-504,586-592` etc. — `bigint('…', { mode: 'number' })` for balances and `*_bytes` columns.
- `.codex/memory.md` — "Quota unit = DECIMAL GB (1 GB = 1,000,000,000 bytes) … `quota-math.ts BYTES_PER_GB` is the single source of truth."
