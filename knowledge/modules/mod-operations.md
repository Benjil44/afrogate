> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: `node scripts/knowledge/build-mocs.mjs`
> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).
> Graph artifact time: 2026-09-11T23:01:53.278Z

# Module: `operations`

- **Source path:** `apps/backend/src/operations/`
- **Dominant graph community (hint, not authoritative):** operations.service.ts
- **High-risk dependencies (DERIVED):** [[tbl-outbounds]], [[tbl-servers]]

## Services / classes (VERIFIED)
- [[AlertRow]] — `apps/backend/src/operations/operations.service.ts:L288`
- [[ApplyRouteDecisionPreviewDto]] — `apps/backend/src/operations/dto/settings.dto.ts:L264`
- [[ClientRouteDecisionPreferenceRow]] — `apps/backend/src/operations/operations.service.ts:L472`
- [[CreateOutboundDto]] — `apps/backend/src/operations/dto/outbound.dto.ts:L28`
- [[CreateOutboundSubscriptionDto]] — `apps/backend/src/operations/dto/outbound.dto.ts:L217`
- [[CreateProtocolSetupDto]] — `apps/backend/src/operations/dto/settings.dto.ts:L136`
- [[CreateServerCredentialDto]] — `apps/backend/src/operations/dto/server.dto.ts:L165`
- [[CreateServerDto]] — `apps/backend/src/operations/dto/server.dto.ts:L68`
- [[CreateServerInterfaceDto]] — `apps/backend/src/operations/dto/tunnel.dto.ts:L7`
- [[CreateSettingsSecretDto]] — `apps/backend/src/operations/dto/settings.dto.ts:L30`
- [[CreateTunnelDto]] — `apps/backend/src/operations/dto/tunnel.dto.ts:L85`
- [[CurrentChild]] — `apps/backend/src/operations/subscription-refresh-safety.ts:L22`
- [[MoveOutboundDto]] — `apps/backend/src/operations/dto/outbound.dto.ts:L212`
- [[OperationsController]] — `apps/backend/src/operations/operations.controller.ts:L106`
- [[OperationsService]] — `apps/backend/src/operations/operations.service.ts:L632`
- [[OutboundCandidate]] — `apps/backend/src/operations/outbound-scoring.ts:L7`
- [[OutboundOrderRow]] — `apps/backend/src/operations/operations.service.ts:L575`
- [[OutboundRow]] — `apps/backend/src/operations/operations.service.ts:L162`
- [[OutboundSubscriptionRefreshService]] — `apps/backend/src/operations/outbound-subscription-refresh.service.ts:L16`
- [[OutboundSubscriptionRow]] — `apps/backend/src/operations/operations.service.ts:L196`
- [[ParsedSubscription]] — `apps/backend/src/operations/outbound-subscription-parser.ts:L26`
- [[ParsedSubscriptionConfig]] — `apps/backend/src/operations/outbound-subscription-parser.ts:L18`
- [[ParsedVless]] — `apps/backend/src/operations/outbound-vless-parser.ts:L1`
- [[ProtocolApplyEventRow]] — `apps/backend/src/operations/operations.service.ts:L360`
- [[ProtocolServerApplyCredentialMaterialRow]] — `apps/backend/src/operations/operations.service.ts:L516`
- [[ProtocolServerApplyExecutionCommandResult]] — `apps/backend/src/operations/operations.service.ts:L549`
- [[ProtocolServerApplyExecutionSummary]] — `apps/backend/src/operations/operations.service.ts:L559`
- [[ProtocolServerApplyRemoteAccess]] — `apps/backend/src/operations/operations.service.ts:L535`
- [[ProtocolServerApplySecretMaterial]] — `apps/backend/src/operations/operations.service.ts:L544`
- [[ProtocolServerApplySecretMaterialRow]] — `apps/backend/src/operations/operations.service.ts:L525`
- [[ProtocolServerApplySource]] — `apps/backend/src/operations/operations.service.ts:L335`
- [[ProtocolSetupRow]] — `apps/backend/src/operations/operations.service.ts:L302`
- [[RankedOutbound]] — `apps/backend/src/operations/outbound-scoring.ts:L16`
- [[RecordProtocolServerApplyDto]] — `apps/backend/src/operations/dto/settings.dto.ts:L270`
- [[RecordRouteDecisionPreviewDto]] — `apps/backend/src/operations/dto/settings.dto.ts:L252`
- [[RefreshChildQuery]] — `apps/backend/src/operations/subscription-refresh-safety.ts:L158`
- [[RefreshSafetyCode]] — `apps/backend/src/operations/subscription-refresh-safety.ts:L35`
- [[RefreshSafetyConfig]] — `apps/backend/src/operations/subscription-refresh-safety.ts:L28`
- [[RefreshSafetyResult]] — `apps/backend/src/operations/subscription-refresh-safety.ts:L44`
- [[RequestProtocolServerApplyDto]] — `apps/backend/src/operations/dto/settings.dto.ts:L276`
- [[RouteAssignmentRow]] — `apps/backend/src/operations/operations.service.ts:L396`
- [[RouteBufferbloatAssessment]] — `apps/backend/src/operations/route-bufferbloat.ts:L3`
- [[RouteDecisionEventRow]] — `apps/backend/src/operations/operations.service.ts:L416`
- [[RouteDecisionTimelineRow]] — `apps/backend/src/operations/timeline-severity.ts:L6`
- [[RouteFailoverEventRow]] — `apps/backend/src/operations/operations.service.ts:L253`
- [[RouteHealthHistoryRow]] — `apps/backend/src/operations/operations.service.ts:L283`
- [[RouteMtuAssessment]] — `apps/backend/src/operations/operations.service.ts:L609`
- [[RouteQualityAggregationResult]] — `apps/backend/src/operations/route-quality-aggregation.service.ts:L4`
- [[RouteQualityAggregationService]] — `apps/backend/src/operations/route-quality-aggregation.service.ts:L12`
- [[RouteQualityWindowRow]] — `apps/backend/src/operations/operations.service.ts:L263`
- [[RouteScoreResult]] — `apps/backend/src/operations/operations.service.ts:L586`
- [[RouteScoreSignals]] — `apps/backend/src/operations/operations.service.ts:L593`
- [[RouteScoringContext]] — `apps/backend/src/operations/operations.service.ts:L580`
- [[RouteSettingsRow]] — `apps/backend/src/operations/operations.service.ts:L384`
- [[SecretRecordRow]] — `apps/backend/src/operations/operations.service.ts:L489`
- [[ServerCredentialRow]] — `apps/backend/src/operations/operations.service.ts:L503`
- [[ServerInterfaceRow]] — `apps/backend/src/operations/operations.service.ts:L215`
- [[ServerInventoryRow]] — `apps/backend/src/operations/operations.service.ts:L118`
- [[SubscriptionAlertLevel]] — `apps/backend/src/operations/subscription-refresh-reason.ts:L67`
- [[SubscriptionMeta]] — `apps/backend/src/operations/outbound-subscription-parser.ts:L12`
- [[SubscriptionRefreshReason]] — `apps/backend/src/operations/subscription-refresh-reason.ts:L34`
- [[SubscriptionUserInfo]] — `apps/backend/src/operations/outbound-subscription-parser.ts:L5`
- [[TimelineSeverity]] — `apps/backend/src/operations/timeline-severity.ts:L3`
- [[TunnelRow]] — `apps/backend/src/operations/operations.service.ts:L233`
- [[UpdateOutboundDto]] — `apps/backend/src/operations/dto/outbound.dto.ts:L119`
- [[UpdateServerDto]] — `apps/backend/src/operations/dto/server.dto.ts:L116`
- [[UpdateServerInterfaceDto]] — `apps/backend/src/operations/dto/tunnel.dto.ts:L45`
- [[UpdateTelegramBotSettingsDto]] — `apps/backend/src/operations/dto/settings.dto.ts:L53`
- [[UpdateTunnelDto]] — `apps/backend/src/operations/dto/tunnel.dto.ts:L130`
- [[UpsertRouteAssignmentDto]] — `apps/backend/src/operations/dto/settings.dto.ts:L197`
- [[UpsertRouteSettingsDto]] — `apps/backend/src/operations/dto/settings.dto.ts:L172`
- [[UpsertServerAccessProfileDto]] — `apps/backend/src/operations/dto/server.dto.ts:L27`
- [[WireGuardCandidateRow]] — `apps/backend/src/operations/operations.service.ts:L441`
- [[WireGuardScoreInput]] — `apps/backend/src/operations/route-metrics.ts:L132`
- [[WireGuardTelemetryRow]] — `apps/backend/src/operations/operations.service.ts:L462`
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
- [[mod-outbound]]
- [[mod-reports]]
- [[mod-security]]
- [[mod-telegram]]

## Depended on by — modules (VERIFIED: AST import/call edges)
- [[mod-alerts]]
- [[mod-notifications]]
- [[mod-reports]]
- [[mod-routers]]
- [[mod-telegram]]

## Service dependency injection (VERIFIED / EXTRACTED — NestJS constructor DI)
- **[[OperationsController]]** — injects: [[AdminReportsService]], [[AuditService]], [[AuthService]], [[BackupStatusService]], [[ConnectionsService]], [[InboundsService]], [[OperationsOverviewService]], [[OperationsService]], [[TelegramBotConfigService]]
  - injected by: _none_
- **[[OperationsService]]** — injects: [[AuditService]], [[DatabaseService]], [[OutboundHttpService]], [[RouteQualityAggregationService]], [[SecretVaultService]]
  - injected by: [[AdminReportsService]], [[AlertNotificationService]], [[OperationsController]], [[OutboundSubscriptionRefreshService]], [[VillageFailoverService]]
- **[[OutboundSubscriptionRefreshService]]** — injects: [[OperationsService]]
  - injected by: _none_
- **[[RouteQualityAggregationService]]** — injects: [[DatabaseService]]
  - injected by: [[OperationsService]]

## Tests importing this module (VERIFIED / EXTRACTED)
- `apps/backend/test/command-safety.test.ts`
- `apps/backend/test/outbound-scoring.test.ts`
- `apps/backend/test/outbound-vless-parser.test.ts`
- `apps/backend/test/request-normalizers.test.ts`
- `apps/backend/test/route-bufferbloat.test.ts`
- `apps/backend/test/route-metrics.test.ts`
- `apps/backend/test/route-quality.test.ts`
- `apps/backend/test/route-scoring.test.ts`
- `apps/backend/test/subscription-refresh-reason.test.ts`
- `apps/backend/test/subscription-refresh-safety.test.ts`
- `apps/backend/test/timeline-severity.test.ts`

## Tests by filename convention (CONVENTION — not verified coverage)
_none_

## Related tests (HEURISTIC — textual name reference)
- `apps/backend/test/outbound-xray-config.test.ts`
- `apps/backend/test/rbac.test.ts`
- `apps/backend/test/subscription-fetch-ssrf.test.ts`
- `apps/backend/test/subscription-refresh-reason.test.ts`
- `apps/backend/test/subscription-refresh-safety.test.ts`
- `apps/backend/test/timeline-severity.test.ts`
- `tests/e2e/client-smoke.spec.ts`
- `tests/e2e/dashboard-visual.spec.ts`

---
_Back to [[_INDEX]] · [[_hotspots]] · [[_domains]]_
