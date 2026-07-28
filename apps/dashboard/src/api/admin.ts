import type {
  AdminAlertsResponse,
  AdminAuditLogsResponse,
  AdminBackupRestorePlanResponse,
  AdminBackupStatusResponse,
  AdminBillingCatalogResponse,
  AdminClientConfigsExportResponse,
  AdminClientConfigSummary,
  AdminClientRoutePreferenceResponse,
  AdminCustomerDevicesResponse,
  AdminNetworkOverviewResponse,
  AdminResellerAccountsResponse,
  AdminResellerAccountSummary,
  AdminResellerWalletLedgerResponse,
  AdminResellerWalletActionResponse,
  CreateResellerAccountRequest,
  UpdateResellerAccountRequest,
  TopUpResellerWalletRequest,
  AdminClientConfigEntryLinkResponse,
  CreateClientConfigRequest,
  AdminCurrentPanelImportPreviewResponse,
  AdminCurrentPanelImportConfigsResponse,
  AdminCurrentPanelUsageSyncResponse,
  AdminCurrentPanelVolumeChargeResponse,
  AdminCustomerAccountDetail,
  AdminCustomerAccountsResponse,
  CustomerAccountArchivedFilter,
  EgressTierPrice,
  AdminRoutersResponse,
  AdminRouterStatusResponse,
  AdminRouterMutationResponse,
  AdminRouterModemActionResponse,
  AdminRouterCredentialResponse,
  AdminRouterConnectConfigResponse,
  AdminRouterWgUsageResponse,
  AdminRouterUsageChartsResponse,
  SetMikroTikWgRateRequest,
  CreateMikroTikRouterRequest,
  UpdateMikroTikRouterRequest,
  MikroTikMode,
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
  AdminVolumePackageSummary,
  AdminVolumePackagesResponse,
  CreateVolumePackageRequest,
  UpdateVolumePackageRequest,
  AdminRewardedAdSettingsResponse,
  AdminResellerPackageSaleResponse,
  AdminResellerWorkspaceResponse,
  AdminGbPriceResponse,
  UpdateGbPriceRequest,
  AdminResellerGbQuoteResponse,
  AdminResellerGbChargeResponse,
  CreateResellerGbChargeRequest,
  AdminResellerTopupRequest,
  AdminResellerTopupRequestResponse,
  AdminResellerTopupRequestsResponse,
  ResellerTopupRequestStatus,
  AdminResellerImpersonationResponse,
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
  AdjustCustomerGemsRequest,
  AdminAdjustCustomerGemsResponse,
  AdminCustomerGemsLedgerResponse,
  AdminTelegramBotProfile,
  AdminTelegramBotSettingsResponse,
  AdminTelegramBotTestResponse,
  AdminTelegramTopupRequest,
  AdminTelegramTopupRequestResponse,
  AdminTelegramTopupRequestsResponse,
  TelegramTopupStatus,
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
  MergeCustomerAccountRequest,
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
  UpdateTelegramBotProfileRequest,
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
  constructor(
    readonly code: AdminAuthErrorCode,
    // Server-provided reason (e.g. a validation message), surfaced to the operator.
    readonly detail?: string,
  ) {
    super(detail || code);
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

export async function fetchAdminResellers(sessionToken: string, signal?: AbortSignal): Promise<AdminResellerAccountsResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/resellers`, { headers: createSessionHeaders(sessionToken), signal });
  return response.json() as Promise<AdminResellerAccountsResponse>;
}

export async function createAdminReseller(sessionToken: string, payload: CreateResellerAccountRequest): Promise<AdminResellerAccountSummary> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/resellers`, {
    method: 'POST',
    headers: createSessionHeaders(sessionToken),
    body: JSON.stringify(payload),
  });
  return response.json() as Promise<AdminResellerAccountSummary>;
}

export async function updateAdminReseller(sessionToken: string, id: string, payload: UpdateResellerAccountRequest): Promise<AdminResellerAccountSummary> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/resellers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: createSessionHeaders(sessionToken),
    body: JSON.stringify(payload),
  });
  return response.json() as Promise<AdminResellerAccountSummary>;
}

export async function fetchResellerWalletLedger(sessionToken: string, id: string, signal?: AbortSignal): Promise<AdminResellerWalletLedgerResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/resellers/${encodeURIComponent(id)}/wallet-ledger`, { headers: createSessionHeaders(sessionToken), signal });
  return response.json() as Promise<AdminResellerWalletLedgerResponse>;
}

export async function topUpResellerWallet(sessionToken: string, id: string, payload: TopUpResellerWalletRequest): Promise<AdminResellerWalletActionResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/resellers/${encodeURIComponent(id)}/wallet/topups`, {
    method: 'POST',
    headers: createSessionHeaders(sessionToken),
    body: JSON.stringify(payload),
  });
  return response.json() as Promise<AdminResellerWalletActionResponse>;
}

// --- Per-GB price (superadmin-settable; the platform's cost per decimal GB) ---

export async function fetchGbPrice(sessionToken: string, signal?: AbortSignal): Promise<AdminGbPriceResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/billing/gb-price`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });
  return response.json() as Promise<AdminGbPriceResponse>;
}

export async function updateGbPrice(sessionToken: string, payload: UpdateGbPriceRequest): Promise<AdminGbPriceResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/billing/gb-price`, {
    method: 'PATCH',
    headers: createSessionHeaders(sessionToken),
    body: JSON.stringify(payload),
  });
  return response.json() as Promise<AdminGbPriceResponse>;
}

// --- Seller oversight: a superadmin drill-down into a seller's customers + usage ---

export async function fetchResellerCustomers(
  sessionToken: string,
  resellerId: string,
  signal?: AbortSignal,
): Promise<AdminCustomerAccountsResponse> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/resellers/${encodeURIComponent(resellerId)}/customers`,
    { headers: createSessionHeaders(sessionToken), signal },
  );
  return response.json() as Promise<AdminCustomerAccountsResponse>;
}

/** Superadmin "Sign in as seller": returns a reseller-scoped session + the seller. */
export async function impersonateReseller(
  sessionToken: string,
  resellerId: string,
): Promise<AdminResellerImpersonationResponse> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/resellers/${encodeURIComponent(resellerId)}/impersonate`,
    { method: 'POST', headers: createSessionHeaders(sessionToken) },
  );
  return response.json() as Promise<AdminResellerImpersonationResponse>;
}

// --- Reseller wallet card-to-card top-up requests (admin approval queue) ---

export async function fetchAdminResellerTopups(
  sessionToken: string,
  status?: ResellerTopupRequestStatus,
): Promise<AdminResellerTopupRequest[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/reseller-topups${query}`, {
    headers: createSessionHeaders(sessionToken),
  });
  const body = (await response.json()) as AdminResellerTopupRequestsResponse;
  return body.requests;
}

export async function approveResellerTopup(sessionToken: string, id: string): Promise<AdminResellerTopupRequest> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/reseller-topups/${encodeURIComponent(id)}/approve`,
    { method: 'POST', headers: createSessionHeaders(sessionToken) },
  );
  const body = (await response.json()) as AdminResellerTopupRequestResponse;
  return body.request;
}

export async function rejectResellerTopup(
  sessionToken: string,
  id: string,
  reason: string,
): Promise<AdminResellerTopupRequest> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/reseller-topups/${encodeURIComponent(id)}/reject`,
    { method: 'POST', headers: createSessionHeaders(sessionToken), body: JSON.stringify({ reason }) },
  );
  const body = (await response.json()) as AdminResellerTopupRequestResponse;
  return body.request;
}

/** Fetch a reseller top-up receipt image bytes (admin-authenticated), as a Blob. */
export async function fetchResellerTopupReceipt(sessionToken: string, id: string): Promise<Blob> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/reseller-topups/${encodeURIComponent(id)}/receipt`,
    { headers: { Authorization: `Bearer ${sessionToken}` } },
  );
  return response.blob();
}

// --- Reseller-side: per-GB sale + wallet top-up request (reseller panel) ---

export async function fetchResellerGbQuote(
  sessionToken: string,
  gb: number,
  signal?: AbortSignal,
): Promise<AdminResellerGbQuoteResponse> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/reseller/gb-quote?gb=${encodeURIComponent(String(gb))}`,
    { headers: createSessionHeaders(sessionToken), signal },
  );
  return response.json() as Promise<AdminResellerGbQuoteResponse>;
}

export async function createResellerGbCharge(
  sessionToken: string,
  payload: CreateResellerGbChargeRequest,
): Promise<AdminResellerGbChargeResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/reseller/gb-charges`, {
    method: 'POST',
    headers: createSessionHeaders(sessionToken),
    body: JSON.stringify(payload),
  });
  return response.json() as Promise<AdminResellerGbChargeResponse>;
}

/** Reseller requests a card-to-card wallet top-up: amount + a receipt image upload. */
export async function createResellerTopupRequest(
  sessionToken: string,
  amount: number,
  receipt: Blob,
  note?: string,
): Promise<AdminResellerTopupRequest> {
  const form = new FormData();
  form.append('amount', String(amount));
  if (note) form.append('note', note);
  form.append('receipt', receipt);
  // FormData sets its own multipart Content-Type/boundary; only send Authorization.
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/reseller/wallet/topup-requests`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: form,
  });
  const body = (await response.json()) as AdminResellerTopupRequestResponse;
  return body.request;
}

export async function fetchResellerTopupRequests(
  sessionToken: string,
  signal?: AbortSignal,
): Promise<AdminResellerTopupRequest[]> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/reseller/wallet/topup-requests`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });
  const body = (await response.json()) as AdminResellerTopupRequestsResponse;
  return body.requests;
}

/** The current reseller's own receipt image bytes (owner-scoped), as a Blob. */
export async function fetchOwnResellerTopupReceipt(sessionToken: string, id: string): Promise<Blob> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/reseller/wallet/topup-requests/${encodeURIComponent(id)}/receipt`,
    { headers: { Authorization: `Bearer ${sessionToken}` } },
  );
  return response.blob();
}

export async function fetchAdminNetworkOverview(sessionToken: string, signal?: AbortSignal): Promise<AdminNetworkOverviewResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/network-overview`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });
  return response.json() as Promise<AdminNetworkOverviewResponse>;
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

/**
 * Lists volume packages (the GB bundles the Telegram bot sells). Pass
 * status='active' to mirror what the bot shows; omit for all packages.
 */
export async function fetchAdminVolumePackages(
  sessionToken: string,
  signal?: AbortSignal,
  status?: 'active' | 'archived',
): Promise<AdminVolumePackagesResponse> {
  const params = new URLSearchParams({ limit: '100' });
  if (status) params.set('status', status);
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/volume-packages?${params.toString()}`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<AdminVolumePackagesResponse>;
}

export async function createAdminVolumePackage(
  sessionToken: string,
  payload: CreateVolumePackageRequest,
): Promise<AdminVolumePackageSummary> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/volume-packages`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'POST',
  });

  return response.json() as Promise<AdminVolumePackageSummary>;
}

// Also used to archive/re-activate a package: PATCH { status: 'archived' | 'active' }.
// Archived packages disappear from the Telegram bot's Buy Data list.
export async function updateAdminVolumePackage(
  sessionToken: string,
  packageId: string,
  payload: UpdateVolumePackageRequest,
): Promise<AdminVolumePackageSummary> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/volume-packages/${encodeURIComponent(packageId)}`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'PATCH',
  });

  return response.json() as Promise<AdminVolumePackageSummary>;
}

/**
 * Lists customer accounts. `archived` controls visibility of soft-deleted
 * accounts: omitted/'active' = live only (default), 'only' = archived only,
 * 'all' = both. Archived rows carry `deletedAt`/`isArchived` so the UI can style
 * them and offer Restore.
 */
export async function fetchAdminCustomerAccounts(
  sessionToken: string,
  signal?: AbortSignal,
  archived?: CustomerAccountArchivedFilter,
): Promise<AdminCustomerAccountsResponse> {
  const params = new URLSearchParams({ limit: '100' });
  if (archived === 'only' || archived === 'all') params.set('archived', archived);
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/customer-accounts?${params.toString()}`, {
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

/** v2: admin manual gems adjustment (positive credits, negative debits). Returns the new balance. */
export async function adjustCustomerGems(
  sessionToken: string,
  customerAccountId: string,
  delta: number,
  reason: string,
): Promise<AdminAdjustCustomerGemsResponse> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/customer-accounts/${encodeURIComponent(customerAccountId)}/gems`,
    {
      body: JSON.stringify({ delta, reason } satisfies AdjustCustomerGemsRequest),
      headers: createSessionHeaders(sessionToken),
      method: 'POST',
    },
  );
  return response.json() as Promise<AdminAdjustCustomerGemsResponse>;
}

/** v2: the append-only gems ledger for one customer account (newest first). */
export async function fetchAdminCustomerGemsLedger(
  sessionToken: string,
  customerAccountId: string,
  signal?: AbortSignal,
): Promise<AdminCustomerGemsLedgerResponse> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/customer-accounts/${encodeURIComponent(customerAccountId)}/gems/ledger`,
    { headers: createSessionHeaders(sessionToken), signal },
  );
  return response.json() as Promise<AdminCustomerGemsLedgerResponse>;
}

export async function fetchEgressTierPrices(sessionToken: string, signal?: AbortSignal): Promise<EgressTierPrice[]> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/egress-tier-prices`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });
  return response.json() as Promise<EgressTierPrice[]>;
}

export async function setEgressTierPrice(
  sessionToken: string,
  tier: string,
  price: number,
  currency?: string,
): Promise<EgressTierPrice[]> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/egress-tier-prices`, {
    body: JSON.stringify({ tier, price, currency }),
    headers: createSessionHeaders(sessionToken),
    method: 'PATCH',
  });
  return response.json() as Promise<EgressTierPrice[]>;
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

export async function fetchAdminCustomerDevices(
  sessionToken: string,
  accountId: string,
  signal?: AbortSignal,
): Promise<AdminCustomerDevicesResponse> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/customer-accounts/${encodeURIComponent(accountId)}/devices`,
    { headers: createSessionHeaders(sessionToken), signal },
  );
  return response.json() as Promise<AdminCustomerDevicesResponse>;
}

export async function fetchAdminClientRoutePreference(
  sessionToken: string,
  configId: string,
  routeGroup = 'main',
  signal?: AbortSignal,
): Promise<AdminClientRoutePreferenceResponse> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/client-configs/${encodeURIComponent(configId)}/route-preference?routeGroup=${encodeURIComponent(routeGroup)}`,
    { headers: createSessionHeaders(sessionToken), signal },
  );
  return response.json() as Promise<AdminClientRoutePreferenceResponse>;
}

export async function updateAdminClientRoutePreference(
  sessionToken: string,
  configId: string,
  payload: { routeGroup?: string; mode?: 'auto' | 'country' | 'outbound'; preferredOutboundId?: string | null; preferredEgressPath?: 'germany' | 'village' | 'direct' | null },
): Promise<AdminClientRoutePreferenceResponse> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/client-configs/${encodeURIComponent(configId)}/route-preference`,
    {
      method: 'PATCH',
      headers: createSessionHeaders(sessionToken),
      body: JSON.stringify(payload),
    },
  );
  return response.json() as Promise<AdminClientRoutePreferenceResponse>;
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

/** Deletes a client config (WireGuard peers are removed from wg0 by the reconciler). */
export async function deleteAdminClientConfig(
  sessionToken: string,
  clientConfigId: string,
): Promise<{ deleted: boolean }> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/client-configs/${encodeURIComponent(clientConfigId)}`,
    { headers: createSessionHeaders(sessionToken), method: 'DELETE' },
  );
  return response.json() as Promise<{ deleted: boolean }>;
}

/**
 * Archives (soft-deletes) a customer account: it is disabled, hidden from the
 * Customers listing, and its WireGuard peers are removed from wg0 by the
 * reconciler. Client configs and all payment/accounting history are retained so
 * the archive stays recoverable.
 */
export async function deleteAdminCustomerAccount(
  sessionToken: string,
  customerAccountId: string,
): Promise<{ deleted: boolean }> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/customer-accounts/${encodeURIComponent(customerAccountId)}`,
    { headers: createSessionHeaders(sessionToken), method: 'DELETE' },
  );
  return response.json() as Promise<{ deleted: boolean }>;
}

/**
 * Restores (un-archives) a previously archived customer account: it is re-enabled
 * and its WireGuard peers are re-added to wg0 by the reconciler. Idempotent.
 */
export async function restoreAdminCustomerAccount(
  sessionToken: string,
  customerAccountId: string,
): Promise<{ restored: boolean }> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/customer-accounts/${encodeURIComponent(customerAccountId)}/restore`,
    { headers: createSessionHeaders(sessionToken), method: 'POST' },
  );
  return response.json() as Promise<{ restored: boolean }>;
}

/**
 * Merges a source (temporary/duplicate) customer account INTO a target real account:
 * the source's remaining GB, gems, client_configs, telegram link + phone and referrals
 * move to the target and the source is archived. Returns the updated TARGET detail.
 */
export async function mergeCustomerAccount(
  sessionToken: string,
  sourceAccountId: string,
  targetAccountId: string,
): Promise<AdminCustomerAccountDetail> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/customer-accounts/${encodeURIComponent(sourceAccountId)}/merge`,
    {
      body: JSON.stringify({ targetAccountId } satisfies MergeCustomerAccountRequest),
      headers: createSessionHeaders(sessionToken),
      method: 'POST',
    },
  );
  return response.json() as Promise<AdminCustomerAccountDetail>;
}

/** Renders (provisioning if needed) a WireGuard config's .conf text. */
export async function fetchAdminWireguardConfig(
  sessionToken: string,
  clientConfigId: string,
): Promise<{ configText: string; qrSvg: string }> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/client-configs/${encodeURIComponent(clientConfigId)}/wireguard-config`,
    { headers: createSessionHeaders(sessionToken) },
  );
  return response.json() as Promise<{ configText: string; qrSvg: string }>;
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

/**
 * Resolve the bot's live Telegram profile (name / about / description) via the
 * backend, which uses the server-stored bot token. The token never reaches the
 * browser. `tokenConfigured` is false when no token is saved yet.
 */
export async function fetchTelegramBotProfile(
  sessionToken: string,
  signal?: AbortSignal,
): Promise<AdminTelegramBotProfile> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/telegram/bot-profile`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<AdminTelegramBotProfile>;
}

/**
 * Publish changed profile fields to Telegram (only provided, non-empty, changed
 * fields are pushed server-side). Returns the refreshed profile.
 */
export async function publishTelegramBotProfile(
  sessionToken: string,
  payload: UpdateTelegramBotProfileRequest,
): Promise<AdminTelegramBotProfile> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/telegram/bot-profile`, {
    body: JSON.stringify(payload),
    headers: createSessionHeaders(sessionToken),
    method: 'POST',
  });

  return response.json() as Promise<AdminTelegramBotProfile>;
}

export async function fetchTelegramTopupRequests(
  sessionToken: string,
  status?: TelegramTopupStatus | 'all',
): Promise<AdminTelegramTopupRequest[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/telegram/topups${query}`, {
    headers: createSessionHeaders(sessionToken),
  });

  const body = (await response.json()) as AdminTelegramTopupRequestsResponse;
  return body.requests;
}

export async function approveTelegramTopupRequest(
  sessionToken: string,
  id: string,
): Promise<AdminTelegramTopupRequest> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/telegram/topups/${encodeURIComponent(id)}/approve`,
    {
      headers: createSessionHeaders(sessionToken),
      method: 'POST',
    },
  );

  const body = (await response.json()) as AdminTelegramTopupRequestResponse;
  return body.request;
}

export async function rejectTelegramTopupRequest(
  sessionToken: string,
  id: string,
  reason: string,
): Promise<AdminTelegramTopupRequest> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/telegram/topups/${encodeURIComponent(id)}/reject`,
    {
      body: JSON.stringify({ reason }),
      headers: createSessionHeaders(sessionToken),
      method: 'POST',
    },
  );

  const body = (await response.json()) as AdminTelegramTopupRequestResponse;
  return body.request;
}

/**
 * Fetch the proxied receipt image bytes (admin-authenticated). The bot token is
 * never exposed; the backend streams the image. Returns a Blob the UI can
 * objectURL into an <img>.
 */
export async function fetchTelegramTopupReceipt(sessionToken: string, id: string): Promise<Blob> {
  const response = await requestAdminAuth(
    `${getApiBaseUrl()}/admin/telegram/topups/${encodeURIComponent(id)}/receipt`,
    {
      headers: { Authorization: `Bearer ${sessionToken}` },
    },
  );

  return response.blob();
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
  throw new AdminAuthError('invalid', await readErrorDetail(response));
}

/** Best-effort extraction of a NestJS error body's `message` (string or array). */
async function readErrorDetail(response: Response): Promise<string | undefined> {
  try {
    const data = (await response.clone().json()) as { message?: unknown };
    const message = data?.message;
    if (Array.isArray(message)) {
      const joined = message.filter((item): item is string => typeof item === 'string').join('; ');
      return joined.trim() || undefined;
    }
    return typeof message === 'string' && message.trim() ? message.trim() : undefined;
  } catch {
    return undefined;
  }
}

export async function fetchRouters(sessionToken: string, signal?: AbortSignal): Promise<AdminRoutersResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/routers`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });
  return response.json() as Promise<AdminRoutersResponse>;
}

export async function fetchRouterStatus(
  sessionToken: string,
  id: string,
  signal?: AbortSignal,
): Promise<AdminRouterStatusResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/routers/${encodeURIComponent(id)}/status`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });
  return response.json() as Promise<AdminRouterStatusResponse>;
}

export async function createRouter(
  sessionToken: string,
  payload: CreateMikroTikRouterRequest,
): Promise<AdminRouterMutationResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/routers`, {
    method: 'POST',
    headers: createSessionHeaders(sessionToken),
    body: JSON.stringify(payload),
  });
  return response.json() as Promise<AdminRouterMutationResponse>;
}

export async function updateRouter(
  sessionToken: string,
  id: string,
  payload: UpdateMikroTikRouterRequest,
): Promise<AdminRouterMutationResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/routers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: createSessionHeaders(sessionToken),
    body: JSON.stringify(payload),
  });
  return response.json() as Promise<AdminRouterMutationResponse>;
}

export async function deleteRouter(sessionToken: string, id: string): Promise<void> {
  await requestAdminAuth(`${getApiBaseUrl()}/admin/routers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: createSessionHeaders(sessionToken),
  });
}

export async function setRouterMode(
  sessionToken: string,
  id: string,
  mode: MikroTikMode,
): Promise<AdminRouterMutationResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/routers/${encodeURIComponent(id)}/mode`, {
    method: 'POST',
    headers: createSessionHeaders(sessionToken),
    body: JSON.stringify({ mode }),
  });
  return response.json() as Promise<AdminRouterMutationResponse>;
}

export async function setRouterEgress(
  sessionToken: string,
  id: string,
  enabled: boolean,
): Promise<AdminRouterMutationResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/routers/${encodeURIComponent(id)}/egress`, {
    method: 'POST',
    headers: createSessionHeaders(sessionToken),
    body: JSON.stringify({ enabled }),
  });
  return response.json() as Promise<AdminRouterMutationResponse>;
}

export async function reconnectRouterModem(
  sessionToken: string,
  id: string,
  iface: string,
): Promise<AdminRouterModemActionResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/routers/${encodeURIComponent(id)}/modems/reconnect`, {
    method: 'POST',
    headers: createSessionHeaders(sessionToken),
    body: JSON.stringify({ interface: iface }),
  });
  return response.json() as Promise<AdminRouterModemActionResponse>;
}

export async function fetchRouterCredential(
  sessionToken: string,
  id: string,
): Promise<AdminRouterCredentialResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/routers/${encodeURIComponent(id)}/credential`, {
    headers: createSessionHeaders(sessionToken),
  });
  return response.json() as Promise<AdminRouterCredentialResponse>;
}

export async function rotateRouterPassword(
  sessionToken: string,
  id: string,
): Promise<AdminRouterCredentialResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/routers/${encodeURIComponent(id)}/rotate-password`, {
    method: 'POST',
    headers: createSessionHeaders(sessionToken),
  });
  return response.json() as Promise<AdminRouterCredentialResponse>;
}

export async function fetchRouterConnectConfig(
  sessionToken: string,
  id: string,
): Promise<AdminRouterConnectConfigResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/routers/${encodeURIComponent(id)}/connect-config`, {
    headers: createSessionHeaders(sessionToken),
  });
  return response.json() as Promise<AdminRouterConnectConfigResponse>;
}

export async function fetchRouterWgUsage(
  sessionToken: string,
  id: string,
  days = 30,
): Promise<AdminRouterWgUsageResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/routers/${encodeURIComponent(id)}/wg-usage?days=${encodeURIComponent(String(days))}`, {
    headers: createSessionHeaders(sessionToken),
  });
  return response.json() as Promise<AdminRouterWgUsageResponse>;
}

export async function fetchRouterUsageCharts(sessionToken: string): Promise<AdminRouterUsageChartsResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/routers/usage-charts`, {
    headers: createSessionHeaders(sessionToken),
  });
  return response.json() as Promise<AdminRouterUsageChartsResponse>;
}

export async function setRouterWgRate(
  sessionToken: string,
  id: string,
  payload: SetMikroTikWgRateRequest,
): Promise<AdminRouterWgUsageResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/routers/${encodeURIComponent(id)}/wg-rate`, {
    method: 'POST',
    headers: createSessionHeaders(sessionToken),
    body: JSON.stringify(payload),
  });
  return response.json() as Promise<AdminRouterWgUsageResponse>;
}
