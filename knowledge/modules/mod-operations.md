> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-08-18T21:12:01.002Z

# Module: `operations`

- **Source path:** `apps/backend/src/operations/`
- **Dominant graph community (hint, not authoritative):** Operations & Outbounds - operations.service.ts
- **High-risk dependencies (DERIVED):** [[tbl-outbounds]], [[tbl-servers]]

## Services / classes (VERIFIED)
- [[AlertRow]] — `apps/backend/src/operations/operations.service.ts:L281`
- [[ApplyRouteDecisionPreviewDto]] — `apps/backend/src/operations/dto/settings.dto.ts:L270`
- [[ClientRouteDecisionPreferenceRow]] — `apps/backend/src/operations/operations.service.ts:L465`
- [[CreateOutboundDto]] — `apps/backend/src/operations/dto/outbound.dto.ts:L28`
- [[CreateOutboundSubscriptionDto]] — `apps/backend/src/operations/dto/outbound.dto.ts:L217`
- [[CreateProtocolSetupDto]] — `apps/backend/src/operations/dto/settings.dto.ts:L142`
- [[CreateServerCredentialDto]] — `apps/backend/src/operations/dto/server.dto.ts:L165`
- [[CreateServerDto]] — `apps/backend/src/operations/dto/server.dto.ts:L68`
- [[CreateServerInterfaceDto]] — `apps/backend/src/operations/dto/tunnel.dto.ts:L7`
- [[CreateSettingsSecretDto]] — `apps/backend/src/operations/dto/settings.dto.ts:L30`
- [[CreateTunnelDto]] — `apps/backend/src/operations/dto/tunnel.dto.ts:L85`
- [[MoveOutboundDto]] — `apps/backend/src/operations/dto/outbound.dto.ts:L212`
- [[OperationsController]] — `apps/backend/src/operations/operations.controller.ts:L105`
- [[OperationsService]] — `apps/backend/src/operations/operations.service.ts:L625`
- [[OutboundCandidate]] — `apps/backend/src/operations/outbound-scoring.ts:L7`
- [[OutboundOrderRow]] — `apps/backend/src/operations/operations.service.ts:L568`
- [[OutboundRow]] — `apps/backend/src/operations/operations.service.ts:L158`
- [[OutboundSubscriptionRefreshService]] — `apps/backend/src/operations/outbound-subscription-refresh.service.ts:L16`
- [[OutboundSubscriptionRow]] — `apps/backend/src/operations/operations.service.ts:L192`
- [[ParsedSubscription]] — `apps/backend/src/operations/outbound-subscription-parser.ts:L26`
- [[ParsedSubscriptionConfig]] — `apps/backend/src/operations/outbound-subscription-parser.ts:L18`
- [[ParsedVless]] — `apps/backend/src/operations/outbound-vless-parser.ts:L1`
- [[ProtocolApplyEventRow]] — `apps/backend/src/operations/operations.service.ts:L353`
- [[ProtocolServerApplyCredentialMaterialRow]] — `apps/backend/src/operations/operations.service.ts:L509`
- [[ProtocolServerApplyExecutionCommandResult]] — `apps/backend/src/operations/operations.service.ts:L542`
- [[ProtocolServerApplyExecutionSummary]] — `apps/backend/src/operations/operations.service.ts:L552`
- [[ProtocolServerApplyRemoteAccess]] — `apps/backend/src/operations/operations.service.ts:L528`
- [[ProtocolServerApplySecretMaterial]] — `apps/backend/src/operations/operations.service.ts:L537`
- [[ProtocolServerApplySecretMaterialRow]] — `apps/backend/src/operations/operations.service.ts:L518`
- [[ProtocolServerApplySource]] — `apps/backend/src/operations/operations.service.ts:L328`
- [[ProtocolSetupRow]] — `apps/backend/src/operations/operations.service.ts:L295`
- [[RankedOutbound]] — `apps/backend/src/operations/outbound-scoring.ts:L16`
- [[RecordProtocolServerApplyDto]] — `apps/backend/src/operations/dto/settings.dto.ts:L276`
- [[RecordRouteDecisionPreviewDto]] — `apps/backend/src/operations/dto/settings.dto.ts:L258`
- [[RequestProtocolServerApplyDto]] — `apps/backend/src/operations/dto/settings.dto.ts:L282`
- [[RouteAssignmentRow]] — `apps/backend/src/operations/operations.service.ts:L389`
- [[RouteBufferbloatAssessment]] — `apps/backend/src/operations/route-bufferbloat.ts:L3`
- [[RouteDecisionEventRow]] — `apps/backend/src/operations/operations.service.ts:L409`
- [[RouteDecisionTimelineRow]] — `apps/backend/src/operations/timeline-severity.ts:L6`
- [[RouteFailoverEventRow]] — `apps/backend/src/operations/operations.service.ts:L246`
- [[RouteHealthHistoryRow]] — `apps/backend/src/operations/operations.service.ts:L276`
- [[RouteMtuAssessment]] — `apps/backend/src/operations/operations.service.ts:L602`
- [[RouteQualityAggregationResult]] — `apps/backend/src/operations/route-quality-aggregation.service.ts:L4`
- [[RouteQualityAggregationService]] — `apps/backend/src/operations/route-quality-aggregation.service.ts:L12`
- [[RouteQualityWindowRow]] — `apps/backend/src/operations/operations.service.ts:L256`
- [[RouteScoreResult]] — `apps/backend/src/operations/operations.service.ts:L579`
- [[RouteScoreSignals]] — `apps/backend/src/operations/operations.service.ts:L586`
- [[RouteScoringContext]] — `apps/backend/src/operations/operations.service.ts:L573`
- [[RouteSettingsRow]] — `apps/backend/src/operations/operations.service.ts:L377`
- [[SecretRecordRow]] — `apps/backend/src/operations/operations.service.ts:L482`
- [[ServerCredentialRow]] — `apps/backend/src/operations/operations.service.ts:L496`
- [[ServerInterfaceRow]] — `apps/backend/src/operations/operations.service.ts:L208`
- [[ServerInventoryRow]] — `apps/backend/src/operations/operations.service.ts:L114`
- [[SubscriptionMeta]] — `apps/backend/src/operations/outbound-subscription-parser.ts:L12`
- [[SubscriptionUserInfo]] — `apps/backend/src/operations/outbound-subscription-parser.ts:L5`
- [[TimelineSeverity]] — `apps/backend/src/operations/timeline-severity.ts:L3`
- [[TunnelRow]] — `apps/backend/src/operations/operations.service.ts:L226`
- [[UpdateOutboundDto]] — `apps/backend/src/operations/dto/outbound.dto.ts:L119`
- [[UpdateServerDto]] — `apps/backend/src/operations/dto/server.dto.ts:L116`
- [[UpdateServerInterfaceDto]] — `apps/backend/src/operations/dto/tunnel.dto.ts:L45`
- [[UpdateTelegramBotSettingsDto]] — `apps/backend/src/operations/dto/settings.dto.ts:L53`
- [[UpdateTunnelDto]] — `apps/backend/src/operations/dto/tunnel.dto.ts:L130`
- [[UpsertRouteAssignmentDto]] — `apps/backend/src/operations/dto/settings.dto.ts:L203`
- [[UpsertRouteSettingsDto]] — `apps/backend/src/operations/dto/settings.dto.ts:L178`
- [[UpsertServerAccessProfileDto]] — `apps/backend/src/operations/dto/server.dto.ts:L27`
- [[WireGuardCandidateRow]] — `apps/backend/src/operations/operations.service.ts:L434`
- [[WireGuardScoreInput]] — `apps/backend/src/operations/route-metrics.ts:L132`
- [[WireGuardTelemetryRow]] — `apps/backend/src/operations/operations.service.ts:L455`
- [[WireGuardTelemetryScoreInput]] — `apps/backend/src/operations/route-metrics.ts:L141`

## Database tables touched (VERIFIED — evidence-backed)
- [[tbl-alerts]] ([[alerts]])
- [[tbl-client_route_preferences]] ([[client_route_preferences]])
- [[tbl-outbound_health_checks]] ([[outbound_health_checks]])
- [[tbl-outbound_subscriptions]] ([[outbound_subscriptions]])
- [[tbl-outbound_test_settings]] ([[outbound_test_settings]])
- [[tbl-outbounds]] ([[outbounds]])
- [[tbl-protocol_apply_events]] ([[protocol_apply_events]])
- [[tbl-protocol_setups]] ([[protocol_setups]])
- [[tbl-route_assignments]] ([[route_assignments]])
- [[tbl-route_decision_events]] ([[route_decision_events]])
- [[tbl-route_failover_events]] ([[route_failover_events]])
- [[tbl-route_quality_hourly]] ([[route_quality_hourly]])
- [[tbl-route_settings]] ([[route_settings]])
- [[tbl-secret_records]] ([[secret_records]])
- [[tbl-server_access_profiles]] ([[server_access_profiles]])
- [[tbl-server_credentials]] ([[server_credentials]])
- [[tbl-server_interfaces]] ([[server_interfaces]])
- [[tbl-server_metrics]] ([[server_metrics]])
- [[tbl-servers]] ([[servers]])
- [[tbl-tunnels]] ([[tunnels]])

## Services sharing those tables (VERIFIED)
- [[AgentsService]]
- [[AlertEngineService]]
- [[BillingService]]
- [[GatewayBillingService]]
- [[OutboundHealthService]]
- [[OutboundSpeedTestService]]
- [[PostgresMetricsRepository]]
- [[TelegramBotConfigService]]
- [[agent-token.guard.ts]]
- [[subscription-sanitizers.ts]]

## Depends on — modules (VERIFIED: AST import/call edges)
- [[mod-audit]]
- [[mod-auth]]
- [[mod-backups]]
- [[mod-client]]
- [[mod-database]]
- [[mod-reports]]
- [[mod-security]]
- [[mod-telegram]]

## Depended on by — modules (VERIFIED: AST import/call edges)
- [[mod-notifications]]
- [[mod-reports]]
- [[mod-routers]]
- [[mod-telegram]]

## Related tests (by reference)
- `apps/backend/test/outbound-xray-config.test.ts`
- `apps/backend/test/rbac.test.ts`
- `apps/backend/test/timeline-severity.test.ts`
- `tests/e2e/client-smoke.spec.ts`
- `tests/e2e/dashboard-visual.spec.ts`

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
