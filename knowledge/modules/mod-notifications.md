> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-09-11T23:01:53.278Z

# Module: `notifications`

- **Source path:** `apps/backend/src/notifications/`
- **Dominant graph community (hint, not authoritative):** TelegramAlertService
- **High-risk dependencies (DERIVED):** _none among heavily-coupled tables_

## Services / classes (VERIFIED)
- [[AlertNotificationService]] — `apps/backend/src/notifications/alert-notification.service.ts:L9`
- [[PhotoMultipart]] — `apps/backend/src/notifications/telegram-multipart.ts:L8`
- [[TelegramAlertSendResult]] — `apps/backend/src/notifications/telegram-alert.service.ts:L8`
- [[TelegramAlertService]] — `apps/backend/src/notifications/telegram-alert.service.ts:L73`
- [[TelegramApiResponse]] — `apps/backend/src/notifications/telegram-alert.service.ts:L18`
- [[TelegramEditMessageResult]] — `apps/backend/src/notifications/telegram-alert.service.ts:L35`
- [[TelegramInlineKeyboardButton]] — `apps/backend/src/notifications/telegram-alert.service.ts:L41`
- [[TelegramInlineKeyboardMarkup]] — `apps/backend/src/notifications/telegram-alert.service.ts:L47`
- [[TelegramMessageSendResult]] — `apps/backend/src/notifications/telegram-alert.service.ts:L13`
- [[TelegramReplyKeyboardButton]] — `apps/backend/src/notifications/telegram-alert.service.ts:L52`
- [[TelegramReplyKeyboardMarkup]] — `apps/backend/src/notifications/telegram-alert.service.ts:L57`
- [[TelegramReplyKeyboardRemove]] — `apps/backend/src/notifications/telegram-alert.service.ts:L63`
- [[TelegramReplyMarkup]] — `apps/backend/src/notifications/telegram-alert.service.ts:L67`
- [[TelegramSendMessageOptions]] — `apps/backend/src/notifications/telegram-alert.service.ts:L23`

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

## Service dependency injection (VERIFIED / EXTRACTED — NestJS constructor DI)
- **[[AlertNotificationService]]** — injects: [[AuditService]], [[OperationsService]], [[TelegramAlertService]]
  - injected by: _none_
- **[[TelegramAlertService]]** — injects: [[OutboundHttpService]], [[TelegramBotConfigService]]
  - injected by: [[AlertNotificationService]], [[BillingService]], [[TelegramBotService]], [[TelegramTopupAdminService]]

## Tests importing this module (VERIFIED / EXTRACTED)
- `apps/backend/test/telegram-multipart.test.ts`

## Tests by filename convention (CONVENTION — not verified coverage)
_none_

## Related tests (HEURISTIC — textual name reference)
_none by name reference_

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
