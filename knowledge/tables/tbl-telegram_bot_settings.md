> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-20T13:32:55.646Z

# Table: `telegram_bot_settings`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[telegramBotSettings]]
- **Migration source:** [[0023_telegram_bot_settings.sql]]
- **Raw table note:** [[telegram_bot_settings]]
- **Change-risk (DERIVED from coupling):** Low — <3 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[TelegramBotConfigService]]
- [[TelegramProfileService]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/telegram/telegram-bot-config.service.ts:189  |  INSERT INTO telegram_bot_settings (`  _(confidence 0.9)_
- `apps/backend/src/telegram/telegram-profile.service.ts:80  |  await this.audit.record(actor, 'telegram.bot_profile.update', 'telegram_bot_settings', 'default', {`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0023_telegram_bot_settings.sql]] and [[telegramBotSettings]].

## Tests (deterministic — import → bridge, VERIFIED)
_No test imports a production file that this table's bridge marks as a consumer._

## Related tests (HEURISTIC — textual name reference, not import-verified)
_No test file references this table by name._

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
