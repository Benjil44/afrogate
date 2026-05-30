# AfroGate UI/UX Implementation Checklist

Progress: 36 / 40 complete (90.0%), 4 remaining.

## Baseline

- [x] Review current screenshots for Dashboard, Servers, Users, Audit Logs, Backups, Billing, Reports, Routes, Alerts, and Settings.
- [x] Choose default heavy-page pattern: tabs.
- [x] Choose checklist location: `.codex/uiuxchecklist.md`.
- [x] Run browser review after each slice at desktop and mobile widths.
- [x] Keep English/Persian labels in the typed dashboard translation layer.
- [ ] Keep every operational page free of horizontal overflow.
- [x] Keep repeated tables on the shared table primitive.

## Shared UI Primitives

- [x] Add reusable dashboard tabs.
- [x] Add reusable table primitive with stable cell spacing and right-side row actions.
- [x] Add donut/circle ECharts support for operational overview charts.
- [x] Add shared compact chart panels for scan-first NOC data.

## Dashboard

- [x] Add donut/circle charts for server health, alert severity, and outbound route quality.
- [ ] Reduce duplicated Dashboard lists where the same data is already available on Servers/Routes/Alerts.
- [x] Keep the health timeline for history, but avoid making it the only visual chart.
- [ ] Reduce blank space at desktop widths.
- [x] Preserve the second-LCD NOC target.

## Settings

- [x] Convert Settings into tabs: Route, WireGuard, Protocols, Branding, Telegram.
- [x] Keep Route decision and route intelligence beside route controls.
- [x] Keep WireGuard setup, health, readiness, and safe preview together.
- [x] Keep Protocol Factory and protocol apply status together.
- [x] Keep Telegram setup isolated from route/protocol controls.
- [ ] Remove badge/pill overlap in decision and load-balancing panels.

## Billing

- [x] Convert Billing into tabs: Catalog, Customers, Panel Import, Telegram, Orders.
- [x] Keep reward settings with catalog/provider readiness.
- [x] Keep customer editor and account table together.
- [x] Keep current-panel import/export/charge tools in their own tab.
- [x] Keep Telegram operations separate from payment orders.

## Routes

- [x] Convert Routes into tabs: Overview, Policy, Canary, History.
- [x] Keep tunnel list and tunnel detail together.
- [x] Keep route policy beside outbounds.
- [x] Keep canary rollout separate from historical route-health/failover data.

## Users

- [x] Convert Users into tabs: Admin users and Permissions.
- [x] Keep Add user at the users table level.
- [x] Move the admin users table to the shared table primitive.
- [x] Move row action controls to the final table column.

## Follow-Up Pages

- [x] Apply shared table primitive to Audit Logs.
- [x] Apply shared table primitive to Billing tables.
- [x] Apply shared table primitive to reseller sold-users and wallet tables.
- [x] Review Backups page for tabs or section grouping.
- [x] Review Reports page for richer chart usage and better empty-state density.
