> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Table: `telegram_topup_requests`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[telegramTopupRequests]]
- **Migration source:** [[0052_telegram_topup_requests.sql]]
- **Raw table note:** [[telegram_topup_requests]]
- **Change-risk (DERIVED from coupling):** Medium — 3 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[TelegramBotService]]
- [[TelegramTopupAdminService]]
- [[telegram-topup.ts]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/telegram/telegram-bot.service.ts:1298  |  SELECT id FROM telegram_topup_requests`  _(confidence 0.9)_
- `apps/backend/src/telegram/telegram-topup-admin.service.ts:59  |  FROM telegram_topup_requests t`  _(confidence 0.9)_
- `apps/backend/src/telegram/telegram-topup.ts:111  |  FROM telegram_topup_requests`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0052_telegram_topup_requests.sql]] and [[telegramTopupRequests]].

## Related tests (by reference)
- `apps/backend/test/telegram-topup-commission.test.ts`
- `apps/backend/test/telegram-topup.test.ts`

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
