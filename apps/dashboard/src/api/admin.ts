import type {
  AdminAlertsResponse,
  AdminAuditLogsResponse,
  AdminBackupRestorePlanResponse,
  AdminBackupStatusResponse,
  AdminBillingCatalogResponse,
  AdminClientConfigsExportResponse,
  AdminClientConfigSummary,
  AdminClientConfigEntryLinkResponse,
  CreateClientConfigRequest,
  AdminCurrentPanelImportPreviewResponse,
  AdminCurrentPanelImportConfigsResponse,
  AdminCurrentPanelUsageSyncResponse,
  AdminCurrentPanelVolumeChargeResponse,
  AdminCustomerAccountDetail,
  AdminCustomerAccountsResponse,
  ApplyRouteDecisionPreviewRequest,
  ApplyRouteDecisionPreviewResponse,
  AdminLoginRequest,
  AdminLoginResponse,
  AdminOutboundsResponse,
  AdminInboundsResponse,
  AdminConnectionsResponse,
  AdminOperationsOverview,
  AdminOutboundSummary,
  AdminOutboundSubscriptionSummary,
  AdminOutboundTestResult,
  AdminOutboundsAutoTestState,
  AdminPaymentOrdersResponse,
  AdminPermissionsResponse,
  AdminRewardedAdSettingsResponse,
  AdminResellerPackageSaleResponse,
  AdminResellerWorkspaceResponse,
  AdminReportsSummaryResponse,
  AdminIncidentTimelineResponse,
  AdminServerInterfacesResponse,
  AdminServersResponse,
  AdminProtocolServerApplyEventDetailResponse,
  AdminProtocolServerApplyEventsResponse,
  AdminSessionResponse,
  AdminProtocolSetupSummary,
  AdminRouteAssignmentSummary,
  AdminRouteCanaryStatusResponse,
  AdminRouteDecisionEventDetailResponse,
  AdminRouteDecisionEventsResponse,
  AdminRouteDecisionPreviewResponse,
  AdminRouteSettingsSummary,
  AdminRouteHealthHistoryResponse,
  AdminRouteQualityAnalyticsResponse,
  AdminSecretRefSummary,
  AdminSettingsResponse,
  AdminServerDetail,
  AdminTelegramBotSettingsResponse,
  AdminTelegramBotTestResponse,
  AdminTenantBrandSettingsResponse,
  AdminTunnelSummary,
  AdminTunnelsResponse,
  AdminUserSummary,
  AdminUsersResponse,
  CreateServerCredentialRequest,
  CreateCustomerAccountRequest,
  CreateResellerPackageSaleRequest,
  CurrentPanelImportConfigsRequest,
  CurrentPanelImportPreviewRequest,
  CurrentPanelUsageSyncRequest,
  CurrentPanelVolumeChargeRequest,
  CreateProtocolSetupRequest,
  CreateSettingsSecretRequest,
  CreateAdminUserRequest,
  ProvisionProtocolSetupResponse,
  RecordProtocolServerApplyRequest,
  RecordProtocolServerApplyResponse,
  RecordRouteDecisionPreviewRequest,
  RecordRouteDecisionPreviewResponse,
  RequestProtocolServerApplyRequest,
  RequestProtocolServerApplyResponse,
  RouteFailoverEventsResponse,
  StoreServerCredentialResponse,
  UpsertRouteAssignmentRequest,
  UpsertRouteSettingsRequest,
  UpdateRewardedAdSettingsRequest,
  UpdateTenantBrandSettingsRequest,
  UpdateTelegramBotSettingsRequest,
  UpdateCustomerAccountRequest,
  UpdateServerRequest,
  UpdateAdminUserPasswordRequest,
  UpdateAdminUserRequest,
} from '@afrows/shared';
import { getApiBaseUrl } from './base';

export type AdminAuthErrorCode = 'invalid' | 'unavailable' | 'network';

export interface AdminAlertFilters {
  limit?: number;
  severity?: string;
  sourceType?: string;
  status?: 'open' | 'resolved';
}

export interface AdminAuditLogFilters {
  action?: string;
  actorId?: string;
  actorType?: string;
  limit?: number;
  targetId?: string;
  targetType?: string;
}

export class AdminAuthError extends Error {
  constructor(readonly code: AdminAuthErrorCode) {
    super(code);
  }
}

export async function loginAdmin(credentials: AdminLoginRequest, signal?: AbortSignal): Promise<AdminLoginResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/auth/login`, {
    body: JSON.stringify(credentials),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    signal,
  });

  return response.json() as Promise<AdminLoginResponse>;
}

export async function fetchAdminSession(sessionToken: string, signal?: AbortSignal): Promise<AdminSessionResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/session`, {
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
    signal,
  });

  return response.json() as Promise<AdminSessionResponse>;
}

export async function fetchAdminUsers(sessionToken: string, signal?: AbortSignal): Promise<AdminUsersResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/users`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<AdminUsersResponse>;
}

export async function fetchAdminPermissions(
  sessionToken: string,
  signal?: AbortSignal,
): Promise<AdminPermissionsResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/permissions`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<AdminPermissionsResponse>;
}

export async function fetchAdminAlerts(
  sessionToken: string,
  filters: AdminAlertFilters = {},
  signal?: AbortSignal,
): Promise<AdminAlertsResponse> {
  const searchParams = new URLSearchParams({
    limit: String(filters.limit ?? 100),
    status: filters.status ?? 'open',
  });
  if (filters.severity) searchParams.set('severity', filters.severity);
  if (filters.sourceType) searchParams.set('sourceType', filters.sourceType);

  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/alerts?${searchParams.toString()}`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<AdminAlertsResponse>;
}

export async function fetchIncidentTimeline(
  sessionToken: string,
  rangeHours = 24,
  limit = 100,
  signal?: AbortSignal,
): Promise<AdminIncidentTimelineResponse> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/incidents/timeline?rangeHours=${encodeURIComponent(String(rangeHours))}&limit=${encodeURIComponent(String(limit))}`,
    {
      headers: createSessionHeaders(sessionToken),
      signal,
    },
  );

  return response.json() as Promise<AdminIncidentTimelineResponse>;
}

export async function fetchAdminAuditLogs(
  sessionToken: string,
  filters: AdminAuditLogFilters = {},
  signal?: AbortSignal,
): Promise<AdminAuditLogsResponse> {
  const searchParams = new URLSearchParams({ limit: String(filters.limit ?? 100) });
  if (filters.action) searchParams.set('action', filters.action);
  if (filters.actorType) searchParams.set('actorType', filters.actorType);
  if (filters.actorId) searchParams.set('actorId', filters.actorId);
  if (filters.targetType) searchParams.set('targetType', filters.targetType);
  if (filters.targetId) searchParams.set('targetId', filters.targetId);

  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/audit-logs?${searchParams.toString()}`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<AdminAuditLogsResponse>;
}

export async function fetchAdminBackupStatus(
  sessionToken: string,
  signal?: AbortSignal,
): Promise<AdminBackupStatusResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/backups/status`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<AdminBackupStatusResponse>;
}

export async function fetchAdminBackupRestorePlan(
  sessionToken: string,
  signal?: AbortSignal,
): Promise<AdminBackupRestorePlanResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/backups/restore-plan`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<AdminBackupRestorePlanResponse>;
}

export async function fetchAdminReportsSummary(
  sessionToken: string,
  rangeHours = 168,
  signal?: AbortSignal,
): Promise<AdminReportsSummaryResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/reports/summary?rangeHours=${encodeURIComponent(String(rangeHours))}`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<AdminReportsSummaryResponse>;
}

export async function fetchAdminTenantBranding(
  sessionToken: string,
  signal?: AbortSignal,
): Promise<AdminTenantBrandSettingsResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/tenant-branding`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<AdminTenantBrandSettingsResponse>;
}

export async function updateAdminTenantBranding(
  sessionToken: string,
  payload: UpdateTenantBrandSettingsRequest,
): Promise<AdminTenantBrandSettingsResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/tenant-branding`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'PATCH',
  });

  return response.json() as Promise<AdminTenantBrandSettingsResponse>;
}

export async function fetchAdminServers(sessionToken: string, signal?: AbortSignal): Promise<AdminServersResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/servers`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<AdminServersResponse>;
}

export async function fetchAdminServer(
  sessionToken: string,
  serverId: string,
  signal?: AbortSignal,
): Promise<AdminServerDetail> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/servers/${encodeURIComponent(serverId)}`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<AdminServerDetail>;
}

export async function updateAdminServer(
  sessionToken: string,
  serverId: string,
  payload: UpdateServerRequest,
): Promise<AdminServerDetail> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/servers/${encodeURIComponent(serverId)}`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'PATCH',
  });

  return response.json() as Promise<AdminServerDetail>;
}

export async function storeAdminServerCredential(
  sessionToken: string,
  serverId: string,
  payload: CreateServerCredentialRequest,
): Promise<StoreServerCredentialResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/servers/${encodeURIComponent(serverId)}/credentials`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'POST',
  });

  return response.json() as Promise<StoreServerCredentialResponse>;
}

export async function fetchAdminOutbounds(sessionToken: string, signal?: AbortSignal): Promise<AdminOutboundsResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/outbounds?limit=200`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<AdminOutboundsResponse>;
}

export interface CreateOutboundPayload {
  type: string;
  name?: string;
  routeGroup?: string;
  serverId?: string | null;
  config?: Record<string, unknown>;
  enabled?: boolean;
}

export interface UpdateOutboundPayload {
  name?: string;
  enabled?: boolean;
  routeGroup?: string;
  maintenanceMode?: boolean;
  config?: Record<string, unknown>;
}

export async function createAdminOutbound(
  sessionToken: string,
  payload: CreateOutboundPayload,
): Promise<AdminOutboundSummary> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/outbounds`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'POST',
  });
  return response.json() as Promise<AdminOutboundSummary>;
}

export async function updateAdminOutbound(
  sessionToken: string,
  outboundId: string,
  payload: UpdateOutboundPayload,
): Promise<AdminOutboundSummary> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/outbounds/${encodeURIComponent(outboundId)}`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'PATCH',
  });
  return response.json() as Promise<AdminOutboundSummary>;
}

export async function deleteAdminOutbound(sessionToken: string, outboundId: string): Promise<void> {
  await requestAdminAuth(`${getApiBaseUrl()}/admin/outbounds/${encodeURIComponent(outboundId)}`, {
    headers: createSessionHeaders(sessionToken),
    method: 'DELETE',
  });
}

export async function fetchAdminInbounds(sessionToken: string, signal?: AbortSignal): Promise<AdminInboundsResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/inbounds`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });
  return response.json() as Promise<AdminInboundsResponse>;
}

export async function fetchAdminOperationsOverview(
  sessionToken: string,
  signal?: AbortSignal,
): Promise<AdminOperationsOverview> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/operations-overview`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });
  return response.json() as Promise<AdminOperationsOverview>;
}

export async function fetchAdminConnections(
  sessionToken: string,
  signal?: AbortSignal,
): Promise<AdminConnectionsResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/connections`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });
  return response.json() as Promise<AdminConnectionsResponse>;
}

export interface CreateOutboundSubscriptionPayload {
  url: string;
  name?: string;
  routeGroup?: string;
  enabled?: boolean;
}

export async function fetchAdminOutboundSubscriptions(
  sessionToken: string,
  signal?: AbortSignal,
): Promise<{ subscriptions: AdminOutboundSubscriptionSummary[] }> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/outbound-subscriptions`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });
  return response.json() as Promise<{ subscriptions: AdminOutboundSubscriptionSummary[] }>;
}

export async function createAdminOutboundSubscription(
  sessionToken: string,
  payload: CreateOutboundSubscriptionPayload,
): Promise<AdminOutboundSubscriptionSummary> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/outbound-subscriptions`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'POST',
  });
  return response.json() as Promise<AdminOutboundSubscriptionSummary>;
}

export async function refreshAdminOutboundSubscription(
  sessionToken: string,
  subscriptionId: string,
): Promise<AdminOutboundSubscriptionSummary> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/outbound-subscriptions/${encodeURIComponent(subscriptionId)}/refresh`,
    {
      headers: createSessionHeaders(sessionToken),
      method: 'POST',
    },
  );
  return response.json() as Promise<AdminOutboundSubscriptionSummary>;
}

export async function deleteAdminOutboundSubscription(sessionToken: string, subscriptionId: string): Promise<void> {
  await requestAdminAuth(`${getApiBaseUrl()}/admin/outbound-subscriptions/${encodeURIComponent(subscriptionId)}`, {
    headers: createSessionHeaders(sessionToken),
    method: 'DELETE',
  });
}

export async function testAdminOutbound(sessionToken: string, outboundId: string): Promise<AdminOutboundTestResult> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/outbounds/${encodeURIComponent(outboundId)}/test`, {
    headers: createSessionHeaders(sessionToken),
    method: 'POST',
  });
  return response.json() as Promise<AdminOutboundTestResult>;
}

export async function testAllAdminOutbounds(sessionToken: string): Promise<{ requested: number }> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/outbounds/test-all`, {
    headers: createSessionHeaders(sessionToken),
    method: 'POST',
  });
  return response.json() as Promise<{ requested: number }>;
}

export async function fetchAdminOutboundTestSettings(
  sessionToken: string,
  signal?: AbortSignal,
): Promise<AdminOutboundsAutoTestState> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/outbound-test-settings`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });
  return response.json() as Promise<AdminOutboundsAutoTestState>;
}

export async function setAdminOutboundTestSettings(
  sessionToken: string,
  enabled: boolean,
): Promise<AdminOutboundsAutoTestState> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/outbound-test-settings`, {
    body: JSON.stringify({ enabled }),
    headers: createSessionHeaders(sessionToken),
    method: 'PATCH',
  });
  return response.json() as Promise<AdminOutboundsAutoTestState>;
}

export async function fetchAdminServerInterfaces(
  sessionToken: string,
  serverId?: string,
  signal?: AbortSignal,
): Promise<AdminServerInterfacesResponse> {
  const params = new URLSearchParams({ limit: '200' });
  if (serverId) params.set('serverId', serverId);

  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/server-interfaces?${params.toString()}`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<AdminServerInterfacesResponse>;
}

export async function fetchAdminTunnels(
  sessionToken: string,
  serverId?: string,
  routeGroup?: string,
  limit = 200,
  signal?: AbortSignal,
): Promise<AdminTunnelsResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (serverId) params.set('serverId', serverId);
  if (routeGroup) params.set('routeGroup', routeGroup);

  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/tunnels?${params.toString()}`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<AdminTunnelsResponse>;
}

export async function fetchAdminTunnel(
  sessionToken: string,
  tunnelId: string,
  signal?: AbortSignal,
): Promise<AdminTunnelSummary> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/tunnels/${encodeURIComponent(tunnelId)}`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<AdminTunnelSummary>;
}

export async function fetchRouteFailoverEvents(
  sessionToken: string,
  signal?: AbortSignal,
): Promise<RouteFailoverEventsResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/route-failover-events?limit=100`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<RouteFailoverEventsResponse>;
}

export async function fetchAdminBillingCatalog(
  sessionToken: string,
  signal?: AbortSignal,
): Promise<AdminBillingCatalogResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/billing/catalog`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<AdminBillingCatalogResponse>;
}

export async function fetchAdminCustomerAccounts(
  sessionToken: string,
  signal?: AbortSignal,
): Promise<AdminCustomerAccountsResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/customer-accounts?limit=100`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<AdminCustomerAccountsResponse>;
}

export async function fetchAdminResellerWorkspace(
  sessionToken: string,
  signal?: AbortSignal,
): Promise<AdminResellerWorkspaceResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/reseller/workspace`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<AdminResellerWorkspaceResponse>;
}

export async function createAdminResellerCustomerAccount(
  sessionToken: string,
  payload: CreateCustomerAccountRequest,
): Promise<AdminCustomerAccountDetail> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/reseller/customer-accounts`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'POST',
  });

  return response.json() as Promise<AdminCustomerAccountDetail>;
}

export async function createAdminResellerPackageSale(
  sessionToken: string,
  payload: CreateResellerPackageSaleRequest,
): Promise<AdminResellerPackageSaleResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/reseller/package-sales`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'POST',
  });

  return response.json() as Promise<AdminResellerPackageSaleResponse>;
}

export async function updateAdminResellerCustomerAccount(
  sessionToken: string,
  accountId: string,
  payload: UpdateCustomerAccountRequest,
): Promise<AdminCustomerAccountDetail> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/reseller/customer-accounts/${encodeURIComponent(accountId)}`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'PATCH',
  });

  return response.json() as Promise<AdminCustomerAccountDetail>;
}

export async function createAdminCustomerAccount(
  sessionToken: string,
  payload: CreateCustomerAccountRequest,
): Promise<AdminCustomerAccountDetail> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/customer-accounts`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'POST',
  });

  return response.json() as Promise<AdminCustomerAccountDetail>;
}

export async function updateAdminCustomerAccount(
  sessionToken: string,
  accountId: string,
  payload: UpdateCustomerAccountRequest,
): Promise<AdminCustomerAccountDetail> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/customer-accounts/${encodeURIComponent(accountId)}`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'PATCH',
  });

  return response.json() as Promise<AdminCustomerAccountDetail>;
}

export async function createAdminClientConfig(
  sessionToken: string,
  accountId: string,
  payload: CreateClientConfigRequest,
): Promise<AdminClientConfigSummary> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/customer-accounts/${encodeURIComponent(accountId)}/client-configs`,
    {
      body: JSON.stringify(payload),
      headers: createSessionHeaders(sessionToken),
      method: 'POST',
    },
  );
  return response.json() as Promise<AdminClientConfigSummary>;
}

/**
 * Sets a customer's login password; returns the password ONCE. Pass `password`
 * to set a custom one, or omit it to auto-generate a strong password.
 */
export async function resetCustomerAccountPassword(
  sessionToken: string,
  accountId: string,
  password?: string,
): Promise<{ generatedPassword: string }> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/customer-accounts/${encodeURIComponent(accountId)}/reset-password`,
    {
      body: JSON.stringify(password && password.trim() ? { password: password.trim() } : {}),
      headers: createSessionHeaders(sessionToken),
      method: 'POST',
    },
  );
  return response.json() as Promise<{ generatedPassword: string }>;
}

export async function fetchAdminClientConfigEntryLink(
  sessionToken: string,
  clientConfigId: string,
): Promise<AdminClientConfigEntryLinkResponse> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/client-configs/${encodeURIComponent(clientConfigId)}/entry-link`,
    { headers: createSessionHeaders(sessionToken) },
  );
  return response.json() as Promise<AdminClientConfigEntryLinkResponse>;
}

/** Renders (provisioning if needed) a WireGuard config's .conf text. */
export async function fetchAdminWireguardConfig(
  sessionToken: string,
  clientConfigId: string,
): Promise<{ configText: string }> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/client-configs/${encodeURIComponent(clientConfigId)}/wireguard-config`,
    { headers: createSessionHeaders(sessionToken) },
  );
  return response.json() as Promise<{ configText: string }>;
}

export async function exportAdminCustomerClientConfigs(
  sessionToken: string,
  accountId: string,
): Promise<AdminClientConfigsExportResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/customer-accounts/${encodeURIComponent(accountId)}/client-configs/export`, {
    headers: createSessionHeaders(sessionToken),
    method: 'GET',
  });

  return response.json() as Promise<AdminClientConfigsExportResponse>;
}

export async function previewAdminCurrentPanelImport(
  sessionToken: string,
  payload: CurrentPanelImportPreviewRequest,
): Promise<AdminCurrentPanelImportPreviewResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/current-panels/import-preview`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'POST',
  });

  return response.json() as Promise<AdminCurrentPanelImportPreviewResponse>;
}

export async function importAdminCurrentPanelConfigs(
  sessionToken: string,
  payload: CurrentPanelImportConfigsRequest,
): Promise<AdminCurrentPanelImportConfigsResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/current-panels/import-configs`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'POST',
  });

  return response.json() as Promise<AdminCurrentPanelImportConfigsResponse>;
}

export async function syncAdminCurrentPanelUsage(
  sessionToken: string,
  payload: CurrentPanelUsageSyncRequest,
): Promise<AdminCurrentPanelUsageSyncResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/current-panels/sync-usage`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'POST',
  });

  return response.json() as Promise<AdminCurrentPanelUsageSyncResponse>;
}

export async function chargeAdminCurrentPanelVolume(
  sessionToken: string,
  payload: CurrentPanelVolumeChargeRequest,
): Promise<AdminCurrentPanelVolumeChargeResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/current-panels/charge-volume`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'POST',
  });

  return response.json() as Promise<AdminCurrentPanelVolumeChargeResponse>;
}

export async function fetchAdminPaymentOrders(
  sessionToken: string,
  signal?: AbortSignal,
): Promise<AdminPaymentOrdersResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/payment-orders?limit=100`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<AdminPaymentOrdersResponse>;
}

export async function fetchAdminRewardedAdSettings(
  sessionToken: string,
  signal?: AbortSignal,
): Promise<AdminRewardedAdSettingsResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/rewarded-ads/settings`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<AdminRewardedAdSettingsResponse>;
}

export async function updateAdminRewardedAdSettings(
  sessionToken: string,
  payload: UpdateRewardedAdSettingsRequest,
): Promise<AdminRewardedAdSettingsResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/rewarded-ads/settings`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'PATCH',
  });

  return response.json() as Promise<AdminRewardedAdSettingsResponse>;
}

export async function fetchAdminSettings(
  sessionToken: string,
  routeGroup = 'main',
  signal?: AbortSignal,
): Promise<AdminSettingsResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/settings?routeGroup=${encodeURIComponent(routeGroup)}`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<AdminSettingsResponse>;
}

export async function fetchAdminTelegramBotSettings(
  sessionToken: string,
  signal?: AbortSignal,
): Promise<AdminTelegramBotSettingsResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/settings/telegram-bot`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<AdminTelegramBotSettingsResponse>;
}

export async function updateAdminTelegramBotSettings(
  sessionToken: string,
  payload: UpdateTelegramBotSettingsRequest,
): Promise<AdminTelegramBotSettingsResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/settings/telegram-bot`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'PATCH',
  });

  return response.json() as Promise<AdminTelegramBotSettingsResponse>;
}

export async function testAdminTelegramBotConnection(
  sessionToken: string,
): Promise<AdminTelegramBotTestResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/settings/telegram-bot/test`, {
    headers: createSessionHeaders(sessionToken),
    method: 'POST',
  });

  return response.json() as Promise<AdminTelegramBotTestResponse>;
}

export async function fetchRouteQualityAnalytics(
  sessionToken: string,
  routeGroup = 'main',
  rangeHours = 168,
  signal?: AbortSignal,
): Promise<AdminRouteQualityAnalyticsResponse> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/route-quality/analytics?routeGroup=${encodeURIComponent(routeGroup)}&rangeHours=${encodeURIComponent(String(rangeHours))}`,
    {
      headers: createSessionHeaders(sessionToken),
      signal,
    },
  );

  return response.json() as Promise<AdminRouteQualityAnalyticsResponse>;
}

export async function fetchRouteHealthHistory(
  sessionToken: string,
  routeGroup = 'main',
  rangeHours = 168,
  limit = 48,
  signal?: AbortSignal,
): Promise<AdminRouteHealthHistoryResponse> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/route-health/history?routeGroup=${encodeURIComponent(routeGroup)}&rangeHours=${encodeURIComponent(String(rangeHours))}&limit=${encodeURIComponent(String(limit))}`,
    {
      headers: createSessionHeaders(sessionToken),
      signal,
    },
  );

  return response.json() as Promise<AdminRouteHealthHistoryResponse>;
}

export async function fetchRouteCanaryStatus(
  sessionToken: string,
  routeGroup = 'main',
  assignmentKey = 'default',
  signal?: AbortSignal,
): Promise<AdminRouteCanaryStatusResponse> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/route-canary/status?routeGroup=${encodeURIComponent(routeGroup)}&assignmentKey=${encodeURIComponent(assignmentKey)}`,
    {
      headers: createSessionHeaders(sessionToken),
      signal,
    },
  );

  return response.json() as Promise<AdminRouteCanaryStatusResponse>;
}

export async function fetchRouteDecisionPreview(
  sessionToken: string,
  routeGroup = 'main',
  assignmentKey = 'default',
  signal?: AbortSignal,
): Promise<AdminRouteDecisionPreviewResponse> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/route-decisions/preview?routeGroup=${encodeURIComponent(routeGroup)}&assignmentKey=${encodeURIComponent(assignmentKey)}`,
    {
      headers: createSessionHeaders(sessionToken),
      signal,
    },
  );

  return response.json() as Promise<AdminRouteDecisionPreviewResponse>;
}

export async function fetchRouteDecisionEvents(
  sessionToken: string,
  routeGroup = 'main',
  assignmentKey = 'default',
  limit = 10,
  signal?: AbortSignal,
): Promise<AdminRouteDecisionEventsResponse> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/route-decisions/events?routeGroup=${encodeURIComponent(routeGroup)}&assignmentKey=${encodeURIComponent(assignmentKey)}&limit=${encodeURIComponent(String(limit))}`,
    {
      headers: createSessionHeaders(sessionToken),
      signal,
    },
  );

  return response.json() as Promise<AdminRouteDecisionEventsResponse>;
}

export async function fetchRouteDecisionEvent(
  sessionToken: string,
  eventId: string,
  signal?: AbortSignal,
): Promise<AdminRouteDecisionEventDetailResponse> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/route-decisions/events/${encodeURIComponent(eventId)}`,
    {
      headers: createSessionHeaders(sessionToken),
      signal,
    },
  );

  return response.json() as Promise<AdminRouteDecisionEventDetailResponse>;
}

export async function recordRouteDecisionPreview(
  sessionToken: string,
  payload: RecordRouteDecisionPreviewRequest,
): Promise<RecordRouteDecisionPreviewResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/route-decisions/preview-events`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'POST',
  });

  return response.json() as Promise<RecordRouteDecisionPreviewResponse>;
}

export async function applyRouteDecisionPreview(
  sessionToken: string,
  payload: ApplyRouteDecisionPreviewRequest,
): Promise<ApplyRouteDecisionPreviewResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/route-decisions/apply-preview`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'POST',
  });

  return response.json() as Promise<ApplyRouteDecisionPreviewResponse>;
}

export async function fetchRouteAssignment(
  sessionToken: string,
  routeGroup = 'main',
  assignmentKey = 'default',
  signal?: AbortSignal,
): Promise<AdminRouteAssignmentSummary> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/route-assignments/current?routeGroup=${encodeURIComponent(routeGroup)}&assignmentKey=${encodeURIComponent(assignmentKey)}`,
    {
      headers: createSessionHeaders(sessionToken),
      signal,
    },
  );

  return response.json() as Promise<AdminRouteAssignmentSummary>;
}

export async function createAdminProtocolSetup(
  sessionToken: string,
  payload: CreateProtocolSetupRequest,
): Promise<AdminProtocolSetupSummary> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/settings/protocol-setups`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'POST',
  });

  return response.json() as Promise<AdminProtocolSetupSummary>;
}

export async function createAdminSettingsSecret(
  sessionToken: string,
  payload: CreateSettingsSecretRequest,
): Promise<AdminSecretRefSummary> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/settings/secrets`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'POST',
  });

  return response.json() as Promise<AdminSecretRefSummary>;
}

export async function provisionAdminProtocolSetup(
  sessionToken: string,
  protocolSetupId: string,
): Promise<ProvisionProtocolSetupResponse> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/settings/protocol-setups/${encodeURIComponent(protocolSetupId)}/provision`,
    {
      headers: createSessionHeaders(sessionToken),
      method: 'POST',
    },
  );

  return response.json() as Promise<ProvisionProtocolSetupResponse>;
}

export async function fetchProtocolServerApplyEvents(
  sessionToken: string,
  protocolSetupId?: string,
  routeGroup = 'main',
  limit = 10,
  signal?: AbortSignal,
): Promise<AdminProtocolServerApplyEventsResponse> {
  const params = new URLSearchParams({
    routeGroup,
    limit: String(limit),
  });
  if (protocolSetupId) params.set('protocolSetupId', protocolSetupId);

  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/settings/protocol-apply-events?${params.toString()}`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<AdminProtocolServerApplyEventsResponse>;
}

export async function fetchProtocolServerApplyEvent(
  sessionToken: string,
  eventId: string,
  signal?: AbortSignal,
): Promise<AdminProtocolServerApplyEventDetailResponse> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/settings/protocol-apply-events/${encodeURIComponent(eventId)}`,
    {
      headers: createSessionHeaders(sessionToken),
      signal,
    },
  );

  return response.json() as Promise<AdminProtocolServerApplyEventDetailResponse>;
}

export async function recordAdminProtocolServerApplyDryRun(
  sessionToken: string,
  protocolSetupId: string,
  payload: RecordProtocolServerApplyRequest = { applyMode: 'dryRun' },
): Promise<RecordProtocolServerApplyResponse> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/settings/protocol-setups/${encodeURIComponent(protocolSetupId)}/server-apply/dry-run`,
    {
      body: JSON.stringify(payload),
      headers: createSessionHeaders(sessionToken),
      method: 'POST',
    },
  );

  return response.json() as Promise<RecordProtocolServerApplyResponse>;
}

export async function requestAdminProtocolServerApply(
  sessionToken: string,
  protocolSetupId: string,
  payload: RequestProtocolServerApplyRequest = { applyMode: 'live' },
): Promise<RequestProtocolServerApplyResponse> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/settings/protocol-setups/${encodeURIComponent(protocolSetupId)}/server-apply/live-request`,
    {
      body: JSON.stringify(payload),
      headers: createSessionHeaders(sessionToken),
      method: 'POST',
    },
  );

  return response.json() as Promise<RequestProtocolServerApplyResponse>;
}

export async function updateAdminRouteSettings(
  sessionToken: string,
  payload: UpsertRouteSettingsRequest,
): Promise<AdminRouteSettingsSummary> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/settings/route`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'PATCH',
  });

  return response.json() as Promise<AdminRouteSettingsSummary>;
}

export async function updateAdminRouteAssignment(
  sessionToken: string,
  payload: UpsertRouteAssignmentRequest,
): Promise<AdminRouteAssignmentSummary> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/route-assignments/current`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'PATCH',
  });

  return response.json() as Promise<AdminRouteAssignmentSummary>;
}

export async function createAdminUser(
  sessionToken: string,
  payload: CreateAdminUserRequest,
): Promise<AdminUserSummary> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/users`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'POST',
  });

  return response.json() as Promise<AdminUserSummary>;
}

export async function updateAdminUser(
  sessionToken: string,
  userId: string,
  payload: UpdateAdminUserRequest,
): Promise<AdminUserSummary> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/users/${encodeURIComponent(userId)}`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'PATCH',
  });

  return response.json() as Promise<AdminUserSummary>;
}

export async function updateAdminUserPassword(
  sessionToken: string,
  userId: string,
  payload: UpdateAdminUserPasswordRequest,
): Promise<AdminUserSummary> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/users/${encodeURIComponent(userId)}/password`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'PATCH',
  });

  return response.json() as Promise<AdminUserSummary>;
}

export async function deleteAdminUser(sessionToken: string, userId: string): Promise<void> {
  await requestAdminAuth(`${getApiBaseUrl()}/admin/users/${encodeURIComponent(userId)}`, {
    headers: createSessionHeaders(sessionToken),
    method: 'DELETE',
  });
}

function createSessionHeaders(sessionToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${sessionToken}`,
    'Content-Type': 'application/json',
  };
}

async function requestAdminAuth(url: string, init: RequestInit): Promise<Response> {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new AdminAuthError('network');
  }

  if (response.ok) return response;

  if (response.status === 503) throw new AdminAuthError('unavailable');
  throw new AdminAuthError('invalid');
}
