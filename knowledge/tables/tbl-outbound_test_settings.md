> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Table: `outbound_test_settings`

- **Status:** **INTENTIONAL RAW-SQL EXCEPTION** (Class-C — not an ORM entity by design)
- **Migration source:** [[0029_outbound_throughput.sql]]
- **Raw table note:** [[outbound_test_settings]]
- **Change-risk (DERIVED from coupling):** Low — <3 consuming services

## Consuming services — VERIFIED (evidence-backed)
- [[OperationsService]]
- [[OutboundSpeedTestService]]

## Consuming files (evidence: file:line + SQL)
- `apps/backend/src/operations/operations.service.ts:5000  |  `SELECT auto_enabled, interval_seconds FROM outbound_test_settings WHERE id = true`,`  _(confidence 0.9)_
- `apps/backend/src/outbound/outbound-speed-test.service.ts:89  |  FROM outbound_test_settings s`  _(confidence 0.9)_

## Foreign keys / referencing tables
_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: [[0029_outbound_throughput.sql]].

## Tests (deterministic — import → bridge, VERIFIED)
_No test imports a production file that this table's bridge marks as a consumer._

## Related tests (HEURISTIC — textual name reference, not import-verified)
_No test file references this table by name._

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
