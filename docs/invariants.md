# Afrows Invariants (Tier-C, human-reviewed)

Short, near-machine-readable rules an agent can scan before acting. These are
**human-reviewed decisions**, not generated graph facts. On conflict, follow the
authority order in INV-1. Rationale and full context live in `docs/adr/**` and the
linked docs — this file does not restate them.

Legend: **MUST / MUST NOT / SHOULD**. Each rule cites its owning ADR + evidence.

---

## 1. Authority & provenance

- **INV-1** MUST resolve conflicts by: `migrations/ + apps/** + tests/ > schema.ts > bridges (provenance) > AST edges > communities/INFERRED > docs > agent memory`. → ADR 0001; `knowledge/_knowledge-status.md`.
- **INV-2** Migrations are authoritative for **DB shape** (columns, types, nullability, defaults, PK, indexes, FKs, CHECKs). → ADR 0001; `docs/schema-drift-audit.md`.
- **INV-3** Source (`apps/**`) is authoritative for **runtime behavior**. → ADR 0001.
- **INV-4** Tests (`tests/**`, `node --test`) are authoritative for **correctness**. → ADR 0001.
- **INV-5** Graphify output is **derived**: VERIFIED/EXTRACTED (AST + bridge edges with `source_location`) are trusted; INFERRED (semantic/community) edges are hints to verify. Evidence-backed > inferred, always. Graph has no git-SHA stamp — treat as a HINT that may predate HEAD. → ADR 0001, ADR 0006.

## 2. Schema drift & table modeling

- **INV-6** Schema-drift remediation is **COMPLETE** — no remaining unresolved drift. **47 of 51** migration tables are Drizzle entities; `customer_accounts` 26/26 and `outbounds` 28/28. → ADR 0002; `docs/schema-drift-audit.md`.
- **INV-7** The **4 Class-C tables are INTENTIONAL raw-SQL exceptions**, not drift, and MUST stay raw-SQL-only unless the architecture changes: `mikrotik_wg_samples`, `mikrotik_wg_rates`, `outbound_test_settings`, `egress_tier_prices`. → ADR 0002.
- **INV-8** Any **new** migration table MUST be either modeled as an entity or explicitly classified — silence counts as drift. → ADR 0002.

## 3. Runtime & typing

- **INV-9** Raw-SQL runtime MUST be preserved: MUST NOT convert raw SQL (`DatabaseService.query/transaction`) to the Drizzle query builder. Adding a `pgTable` changes nothing at runtime and must not. Never run `push`/`generate`/`migrate`. → ADR 0003.
- **INV-10** Query-shaped / partial / domain row types (e.g. `RouterRow` snake_case, `WireguardPeerRecord` 5-of-16) MUST NOT be force-replaced by `$inferSelect`/`InferSelectModel`. Replace only when structurally equivalent **and** tests prove it. → ADR 0003.

## 4. Data semantics

- **INV-11** Money and byte-quota columns use **`bigint({ mode: 'number' })`** where established (wallet/ledger amounts, `*_bytes` counters, gems, reward bytes). New such columns follow suit. → ADR 0004; `schema.ts`.
  - Related unit rule (owned by `.claude/memory.md`, kept consistent here): **quota unit = decimal GB = 1e9 bytes**, single source `quota-math.ts BYTES_PER_GB`; foreign-panel import (`current-panel-import.adapters.ts`) intentionally keeps binary 1024³.
- **INV-12** `telegram_users.telegram_id` is an **intentional natural text PK** and is **NOT** a foreign key to `customer_accounts`. The `telegram_id ↔ customer_accounts.telegram_id` join is a soft/ad-hoc lookup: no `.references()`, no `relations()`. Tools MUST NOT infer this FK from the name collision. → ADR 0005.

## 5. Knowledge vault hygiene

- **INV-13** `knowledge/**` and `graphify-out/**` are **GENERATED — MUST NOT be hand-edited**. Change the generator (`scripts/knowledge/build-mocs.mjs`) and regenerate. → ADR 0006.
- **INV-14** Human-reviewed decisions live in **`docs/adr/**` + `docs/invariants.md`** (this Tier-C layer), never in the regenerable vault. Do not treat generated graph facts as invariants. → ADR 0006.

## 6. Security exceptions

- **INV-15** `outbounds.subscription_key` (in `outbound-subscription-parser.ts`) is a **non-security identity / de-dup hash** — SHA-1, truncated to 16 hex. CodeQL `js/weak-cryptographic-algorithm` (**#8**) is **risk-accepted, not a defect**: the value is never a token/secret, never client-exposed, and nothing authenticates off it, so collision resistance is not a boundary here. It MUST NOT be swapped to another algorithm **in place** — the sync path deletes children whose key is not in the new set, so a naive swap churns every row (resets `enabled`, gaps the village-reserve pool). Any hardening MUST be a human-approved SHA-256 migration with recompute+backfill and atomic cutover. → ADR 0007; `docs/decisions.json` INV-15.

---

## ADR index

- [ADR 0001](adr/0001-knowledge-authority-hierarchy.md) — Knowledge / source-of-truth authority hierarchy
- [ADR 0002](adr/0002-schema-drift-complete-class-c-exceptions.md) — Schema-drift complete; Class-C exceptions stay raw
- [ADR 0003](adr/0003-raw-sql-runtime-and-query-shaped-types-preserved.md) — Raw-SQL runtime & query-shaped types preserved
- [ADR 0004](adr/0004-money-bigint-semantics.md) — Money/byte columns use bigint semantics
- [ADR 0005](adr/0005-telegram-users-natural-key-no-fk.md) — `telegram_users.telegram_id` natural key, no FK
- [ADR 0006](adr/0006-knowledge-vault-generated-decisions-in-adrs.md) — Vault is generated; decisions live in ADRs/invariants
- [ADR 0007](adr/0007-subscription-key-non-security-hashing-exception.md) — `subscription_key` SHA-1 is non-security hashing (CodeQL #8 risk-accepted)

## See also

- `docs/schema-drift-audit.md` — schema-drift program (COMPLETE)
- `knowledge/_knowledge-status.md` — graph stats, provenance rules, authority order
