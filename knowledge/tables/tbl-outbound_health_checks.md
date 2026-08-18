> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Table: `outbound_health_checks`

- **Status:** **VERIFIED / MODELED** — Drizzle entity [[outboundHealthChecks]]
- **Migration source:** [[0002_server_access_outbounds.sql]]
- **Raw table note:** [[outbound_health_checks]]
- **Change-risk (DERIVED from coupling):** Medium — 4 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[OperationsService]]
- [[OutboundHealthService]]
- [[OutboundSpeedTestService]]
- [[outbound-scoring.ts]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/operations/operations.service.ts:1302  |  FROM outbound_health_checks oh`  _(confidence 0.9)_
- `apps/backend/src/outbound/outbound-health.service.ts:281  |  INSERT INTO outbound_health_checks (`  _(confidence 0.9)_
- `apps/backend/src/outbound/outbound-speed-test.service.ts:146  |  INSERT INTO outbound_health_checks (outbound_id, status, latency_ms, jitter_ms, packet_loss_percent, message, details)`  _(confidence 0.9)_
- `apps/backend/src/operations/outbound-scoring.ts:4  |  * No I/O — fed from outbound_health_checks + throughput metrics.`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0002_server_access_outbounds.sql]] and [[outboundHealthChecks]].

## Tests (deterministic — import → bridge, VERIFIED)
- `apps/backend/test/outbound-scoring.test.ts` _(imports a production file the bridge marks as a consumer of this table)_

## Related tests (HEURISTIC — textual name reference, not import-verified)
_No test file references this table by name._

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
