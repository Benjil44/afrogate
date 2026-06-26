# Customers table polish — D-table P1 — design

**Date:** 2026-06-26
**Status:** Approved (checklist) → building P1 (frontend) now
**Part of:** dashboard UX overhaul. Follows D1 (Customers reorg). Source: the Customers-table UI checklist agreed 2026-06-26.

## Problem

The Customers table is wide and sparse: ~6 columns are all `—` (Expires, Last connected, Cost, Tags, Seller, and Login email for most), `Used`/`Quota` are two separate columns with mismatched units and no at-a-glance "how close to limit," and an over-quota/limited customer (e.g. Erfan 13/10 GB, configs `limited`) still just shows "active" with no warning.

## Goal (P1, frontend-only)

Three pure-frontend fixes (data already on `AdminCustomerAccountSummary`):

1. **Hide empty optional columns.** Render an optional column only if ≥1 visible (`filtered`) row has data for it. Optional set: `email, expiry, lastSeen, cost, tags, seller`. Always-on: `customer, status, usage, clients, protocols, actions`. Auto-reappears when data shows up (e.g. once P1b populates `lastConnectedAt`).
2. **Merge Used + Quota into one `usage` column** with a small progress bar + right-aligned `used / quota` text. Colour by ratio: normal (<80%), amber (≥80%), red (≥100% / over). Unlimited quota (null) → "used · ∞", no bar.
3. **Over-quota badge** in the status cell: when `quotaLimitBytes != null && usedBytes >= quotaLimitBytes`, show a red "over quota" pill next to the status (computed client-side; explains the Erfan case at a glance).

## Non-goals / follow-ups

- **P1b — "Last connected" (data gap, backend):** `lastConnectedAt = MAX(client_usage_events.observed_at)`, but normal xray metering only updates `used_bytes` and doesn't write usage events, so it's always null. Needs the metering tick to record a last-seen (carefully, to avoid table bloat — likely an `UPDATE ... last_connected_at` rather than a row per tick). **Separate task, next.**
- P2/P3 checklist items (search/sort already partially exist via `filtered`; count/pagination; quick actions; muted dashes) — later.

## Implementation shape

All in `apps/dashboard/src/pages/CustomersPage.tsx`:
- Replace the `used` + `quota` column defs with one `usage` column (bar + `format.bytes` text, `alignRight`).
- Add the over-quota pill to the `status` column render.
- After building the `columns` array, compute `visibleColumns` by filtering the optional keys against per-key "has data" predicates over `filtered`, and pass `visibleColumns` to `<DataTable>`.
- One new i18n string `overQuota` (en + fa) in `customersPage`.

## Testing
`tsc --noEmit` + `vite build`; manual: empty columns gone, usage bar renders + colours (Erfan red/over badge, Ben green far-from-limit), columns reappear when a row has data, FA renders.

## Rollout
Dashboard-only, reversible. Ships with next deploy.
