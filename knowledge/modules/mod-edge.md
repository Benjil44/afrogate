> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-09-11T23:01:53.278Z

# Module: `edge`

- **Source path:** `apps/backend/src/edge/`
- **Dominant graph community (hint, not authoritative):** xray-usage-metering.service.ts
- **High-risk dependencies (DERIVED):** _none among heavily-coupled tables_

## Services / classes (VERIFIED)
- [[ActiveDeClientRow]] — `apps/backend/src/edge/edge-usage.ts:L28`
- [[EdgeController]] — `apps/backend/src/edge/edge.controller.ts:L15`
- [[EdgeModule]] — `apps/backend/src/edge/edge.module.ts:L16`
- [[EdgeService]] — `apps/backend/src/edge/edge.service.ts:L16`
- [[EdgeUsageReportDto]] — `apps/backend/src/edge/dto/edge-usage.dto.ts:L12`

## Database tables touched (VERIFIED — evidence-backed)
_none via bridge provenance_

## Services sharing those tables (VERIFIED)
_none_

## Depends on — modules (VERIFIED: AST import/call edges)
- [[mod-client]]
- [[mod-database]]
- [[mod-security]]

## Depended on by — modules (VERIFIED: AST import/call edges)
_none_

## Service dependency injection (VERIFIED / EXTRACTED — NestJS constructor DI)
- **[[EdgeController]]** — injects: [[EdgeService]]
  - injected by: _none_
- **[[EdgeService]]** — injects: [[DatabaseService]]
  - injected by: [[EdgeController]]

## Tests importing this module (VERIFIED / EXTRACTED)
- `apps/backend/test/edge-service.test.ts`

## Tests by filename convention (CONVENTION — not verified coverage)
_none_

## Related tests (HEURISTIC — textual name reference)
_none by name reference_

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
