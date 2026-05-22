# Dashboard Sidebar Pages Checklist

The sidebar must map to real operational pages, not placeholder anchors. Each page should work with fallback/sample data first, then connect to real backend APIs as each API lands.

## Page Foundation

- [ ] Replace decorative anchors with real dashboard view state or routing.
- [ ] Keep the NOC/wall display as the default `Dashboard` page.
- [ ] Preserve the second-LCD layout for passive monitoring.
- [ ] Keep page transitions instant and static-first.
- [ ] Add shared empty/loading/stale states.

## Dashboard Page

- [x] Summary cards.
- [x] Realtime health chart.
- [x] Server, tunnel, alert, outbound, capacity, and control-plane panels.
- [ ] Real alert rows from backend.
- [ ] Real outbound rows from backend.
- [ ] Fullscreen/kiosk display toggle.

## Servers Page

- [ ] Server inventory table/cards.
- [ ] Server edit action.
- [ ] Safe access/bootstrap tab.
- [ ] Monitoring tab with CPU/RAM/disk/network history.
- [ ] Interfaces tab for operators and linked tunnels.
- [ ] Audit tab.
- [ ] Real server CRUD API binding after admin guards are enforced.

## Routes Page

- [ ] Tunnel table with operator, ping, jitter, loss, health score.
- [ ] Outbound priority list with move up/down controls.
- [ ] Maintenance mode indicator.
- [ ] Failover history.
- [ ] Route lock and auto-route controls.
- [ ] Real route/outbound API binding after admin guards are enforced.

## Alerts Page

- [ ] Open alert list.
- [ ] Alert severity filters.
- [ ] Alert source filters.
- [ ] Resolved alert history.
- [ ] Telegram alert delivery status.
- [ ] Real alert API binding.

## Later Pages

- [ ] Users.
- [ ] Usage and billing.
- [ ] Telegram bot operations.
- [ ] Backups.
- [ ] Audit logs.
- [ ] Settings.
