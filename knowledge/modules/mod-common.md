> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-09-11T23:01:53.278Z

# Module: `common`

- **Source path:** `apps/backend/src/common/`
- **Dominant graph community (hint, not authoritative):** outbound-speed-test.service.ts
- **High-risk dependencies (DERIVED):** _none among heavily-coupled tables_

## Services / classes (VERIFIED)
- [[SecureTempFile]] — `apps/backend/src/common/secure-temp-file.ts:L5`

## Database tables touched (VERIFIED — evidence-backed)
_none via bridge provenance_

## Services sharing those tables (VERIFIED)
_none_

## Depends on — modules (VERIFIED: AST import/call edges)
_none_

## Depended on by — modules (VERIFIED: AST import/call edges)
- [[mod-client]]
- [[mod-outbound]]

## Service dependency injection (VERIFIED / EXTRACTED — NestJS constructor DI)
_No injectable services with DI edges in this module._

## Tests importing this module (VERIFIED / EXTRACTED)
- `apps/backend/test/secure-temp-file.test.ts`

## Tests by filename convention (CONVENTION — not verified coverage)
_none_

## Related tests (HEURISTIC — textual name reference)
_none by name reference_

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
