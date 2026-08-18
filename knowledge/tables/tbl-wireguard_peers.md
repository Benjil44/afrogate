> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Table: `wireguard_peers`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[wireguardPeers]]
- **Migration source:** [[0033_wireguard_peers.sql]]
- **Raw table note:** [[wireguard_peers]]
- **Change-risk (DERIVED from coupling):** High — 6 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[BillingService]]
- [[OperationsOverviewService]]
- [[WireguardMeteringService]]
- [[XrayAccessLogService]]
- [[customer-account-deletion.ts]]
- [[customer-account-merge.ts]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/billing/billing.service.ts:4126  |  * wireguard_peers row cascades). The reconciler's orphan sweep cleans up if`  _(confidence 0.9)_
- `apps/backend/src/client/operations-overview.service.ts:193  |  FROM wireguard_peers wp`  _(confidence 0.9)_
- `apps/backend/src/client/wireguard-metering.service.ts:10  |  *   2) flips `wireguard_peers.desired_state` to 'absent' for over-quota accounts`  _(confidence 0.9)_
- `apps/backend/src/client/xray-access-log.service.ts:76  |  FROM wireguard_peers`  _(confidence 0.9)_
- `apps/backend/src/billing/customer-account-deletion.ts:107  |  `UPDATE wireguard_peers`  _(confidence 0.9)_
- `apps/backend/src/billing/customer-account-merge.ts:24  |  *     working VLESS/WG keeps working. wireguard_peers follow via client_config_id.`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0033_wireguard_peers.sql]] and [[wireguardPeers]].

## Related tests (by reference)
- `apps/backend/test/customer-account-deletion.test.ts`
- `apps/backend/test/customer-account-merge.test.ts`

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
