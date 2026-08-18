> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Module: `notifications`

- **Source path:** `apps/backend/src/notifications/`
- **Dominant graph community (hint, not authoritative):** Notifications - AlertNotificationService
- **High-risk dependencies (DERIVED):** _none among heavily-coupled tables_

## Services / classes (VERIFIED)
- [[AlertNotificationService]] — `apps/backend/src/notifications/alert-notification.service.ts:L9`
- [[TelegramAlertSendResult]] — `apps/backend/src/notifications/telegram-alert.service.ts:L7`
- [[TelegramAlertService]] — `apps/backend/src/notifications/telegram-alert.service.ts:L72`
- [[TelegramApiResponse]] — `apps/backend/src/notifications/telegram-alert.service.ts:L17`
- [[TelegramEditMessageResult]] — `apps/backend/src/notifications/telegram-alert.service.ts:L34`
- [[TelegramInlineKeyboardButton]] — `apps/backend/src/notifications/telegram-alert.service.ts:L40`
- [[TelegramInlineKeyboardMarkup]] — `apps/backend/src/notifications/telegram-alert.service.ts:L46`
- [[TelegramMessageSendResult]] — `apps/backend/src/notifications/telegram-alert.service.ts:L12`
- [[TelegramReplyKeyboardButton]] — `apps/backend/src/notifications/telegram-alert.service.ts:L51`
- [[TelegramReplyKeyboardMarkup]] — `apps/backend/src/notifications/telegram-alert.service.ts:L56`
- [[TelegramReplyKeyboardRemove]] — `apps/backend/src/notifications/telegram-alert.service.ts:L62`
- [[TelegramReplyMarkup]] — `apps/backend/src/notifications/telegram-alert.service.ts:L66`
- [[TelegramSendMessageOptions]] — `apps/backend/src/notifications/telegram-alert.service.ts:L22`

## Database tables touched (VERIFIED — evidence-backed)
_none via bridge provenance_

## Services sharing those tables (VERIFIED)
_none_

## Depends on — modules (VERIFIED: AST import/call edges)
- [[mod-audit]]
- [[mod-operations]]
- [[mod-outbound]]
- [[mod-telegram]]

## Depended on by — modules (VERIFIED: AST import/call edges)
- [[mod-billing]]
- [[mod-telegram]]

## Tests importing this module (VERIFIED / EXTRACTED)
_none — no test imports a file in this module directly_

## Tests by filename convention (CONVENTION — not verified coverage)
_none_

## Related tests (HEURISTIC — textual name reference)
_none by name reference_

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
