import type {
  AdminAlertsResponse,
  ApplyRouteDecisionPreviewRequest,
  ApplyRouteDecisionPreviewResponse,
  AdminLoginRequest,
  AdminLoginResponse,
  AdminOutboundsResponse,
  AdminServersResponse,
  AdminSessionResponse,
  AdminProtocolSetupSummary,
  AdminRouteAssignmentSummary,
  AdminRouteDecisionEventDetailResponse,
  AdminRouteDecisionEventsResponse,
  AdminRouteDecisionPreviewResponse,
  AdminRouteSettingsSummary,
  AdminRouteQualityAnalyticsResponse,
  AdminSecretRefSummary,
  AdminSettingsResponse,
  AdminUserSummary,
  AdminUsersResponse,
  CreateProtocolSetupRequest,
  CreateSettingsSecretRequest,
  CreateAdminUserRequest,
  ProvisionProtocolSetupResponse,
  RecordProtocolServerApplyRequest,
  RecordProtocolServerApplyResponse,
  RecordRouteDecisionPreviewRequest,
  RecordRouteDecisionPreviewResponse,
  RouteFailoverEventsResponse,
  UpsertRouteAssignmentRequest,
  UpsertRouteSettingsRequest,
  UpdateAdminUserPasswordRequest,
  UpdateAdminUserRequest,
} from '@afrogate/shared';
import { getApiBaseUrl } from './base';

export type AdminAuthErrorCode = 'invalid' | 'unavailable' | 'network';

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

export async function fetchAdminAlerts(sessionToken: string, signal?: AbortSignal): Promise<AdminAlertsResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/alerts?status=open&limit=100`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<AdminAlertsResponse>;
}

export async function fetchAdminServers(sessionToken: string, signal?: AbortSignal): Promise<AdminServersResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/servers`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<AdminServersResponse>;
}

export async function fetchAdminOutbounds(sessionToken: string, signal?: AbortSignal): Promise<AdminOutboundsResponse> {
  const response = await requestAdminAuth(`${getApiBaseUrl()}/admin/outbounds?limit=200`, {
    headers: createSessionHeaders(sessionToken),
    signal,
  });

  return response.json() as Promise<AdminOutboundsResponse>;
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
