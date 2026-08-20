> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-20T13:32:55.646Z

# Table: `volume_packages`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[volumePackages]]
- **Migration source:** [[0014_billing_packages_settings.sql]]
- **Raw table note:** [[volume_packages]]
- **Change-risk (DERIVED from coupling):** Medium — 3 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[BillingService]]
- [[TelegramTopupAdminService]]
- [[telegram-topup.ts]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/billing/billing.service.ts:958  |  INSERT INTO volume_packages (`  _(confidence 0.9)_
- `apps/backend/src/telegram/telegram-topup-admin.service.ts:61  |  LEFT JOIN volume_packages vp ON vp.id = t.volume_package_id`  _(confidence 0.9)_
- `apps/backend/src/telegram/telegram-topup.ts:210  |  `SELECT name, volume_bytes AS "volumeBytes" FROM volume_packages WHERE id = $1 FOR UPDATE`,`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0014_billing_packages_settings.sql]] and [[volumePackages]].

## Tests (deterministic — import → bridge, VERIFIED)
- `apps/backend/test/telegram-topup-commission.test.ts` _(imports a production file the bridge marks as a consumer of this table)_
- `apps/backend/test/telegram-topup.test.ts` _(imports a production file the bridge marks as a consumer of this table)_

## Related tests (HEURISTIC — textual name reference, not import-verified)
_No test file references this table by name._

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
