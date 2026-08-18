> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Module: `branding`

- **Source path:** `apps/backend/src/branding/`
- **Dominant graph community (hint, not authoritative):** Branding
- **High-risk dependencies (DERIVED):** _none among heavily-coupled tables_

## Services / classes (VERIFIED)
- [[AdminTenantBrandingController]] — `apps/backend/src/branding/admin-tenant-branding.controller.ts:L12`
- [[AdminTenantBrandingService]] — `apps/backend/src/branding/admin-tenant-branding.service.ts:L29`
- [[TenantBrandSettingsRow]] — `apps/backend/src/branding/admin-tenant-branding.service.ts:L8`
- [[UpdateTenantBrandingDto]] — `apps/backend/src/branding/dto/tenant-branding.dto.ts:L4`

## Database tables touched (VERIFIED — evidence-backed)
- [[tbl-tenant_brand_settings]] ([[tenant_brand_settings]])

## Services sharing those tables (VERIFIED)
_none_

## Depends on — modules (VERIFIED: AST import/call edges)
- [[mod-audit]]
- [[mod-database]]
- [[mod-security]]

## Depended on by — modules (VERIFIED: AST import/call edges)
_none_

## Related tests (by reference)
_none by name reference_

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
