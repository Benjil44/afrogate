> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-20T13:32:55.646Z

# Table: `telegram_users`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[telegramUsers]]
- **Migration source:** [[0052_telegram_topup_requests.sql]]
- **Raw table note:** [[telegram_users]]
- **Change-risk (DERIVED from coupling):** Medium — 5 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[BillingService]]
- [[TelegramBotService]]
- [[TelegramTopupAdminService]]
- [[telegram-topup.ts]]
- [[telegram-user-store.ts]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/billing/billing.service.ts:3967  |  LEFT JOIN telegram_users tu ON tu.telegram_id = ca.telegram_id`  _(confidence 0.9)_
- `apps/backend/src/telegram/telegram-bot.service.ts:64  |  * telegram_users.state. Menu/error screens edit the originating message in place;`  _(confidence 0.9)_
- `apps/backend/src/telegram/telegram-topup-admin.service.ts:268  |  `SELECT language FROM telegram_users WHERE telegram_id = $1`,`  _(confidence 0.9)_
- `apps/backend/src/telegram/telegram-topup.ts:117  |  * (telegram_users); when the receipt photo arrives the row is created here in one`  _(confidence 0.9)_
- `apps/backend/src/telegram/telegram-user-store.ts:67  |  FROM telegram_users`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0052_telegram_topup_requests.sql]] and [[telegramUsers]].

## Tests (deterministic — import → bridge, VERIFIED)
- `apps/backend/test/telegram-topup-commission.test.ts` _(imports a production file the bridge marks as a consumer of this table)_
- `apps/backend/test/telegram-topup.test.ts` _(imports a production file the bridge marks as a consumer of this table)_

## Related tests (HEURISTIC — textual name reference, not import-verified)
_No test file references this table by name._

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
