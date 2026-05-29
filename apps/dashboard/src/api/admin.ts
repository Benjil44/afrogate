import type {
  AdminAlertsResponse,
  AdminAuditLogsResponse,
  AdminBackupStatusResponse,
  AdminBillingCatalogResponse,
  AdminCurrentPanelImportPreviewResponse,
  AdminCustomerAccountDetail,
  AdminCustomerAccountsResponse,
  ApplyRouteDecisionPreviewRequest,
  ApplyRouteDecisionPreviewResponse,
  AdminLoginRequest,
  AdminLoginResponse,
  AdminOutboundsResponse,
  AdminPaymentOrdersResponse,
  AdminPermissionsResponse,
  AdminRewardedAdSettingsResponse,
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
  AdminTunnelSummary,
  AdminTunnelsResponse,
  AdminUserSummary,
  AdminUsersResponse,
  CreateServerCredentialRequest,
  CreateCustomerAccountRequest,
  CurrentPanelImportPreviewRequest,
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
  UpdateTelegramBotSettingsRequest,
  UpdateCustomerAccountRequest,
  UpdateServerRequest,
  UpdateAdminUserPasswordRequest,
  UpdateAdminUserRequest,
} from '@afrogate/shared';
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
