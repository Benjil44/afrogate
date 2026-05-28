import type {
  ClaimRewardedAdRequest,
  ClientRewardedAdClaimResponse,
  ClientRewardedAdStatusResponse,
  ClientPortalProfileResponse,
  ClientRouteOptionsResponse,
  ClientRoutePreferenceResponse,
  UpdateClientRoutePreferenceRequest,
} from '@afrogate/shared';

export const DEFAULT_API_BASE_URL = 'http://127.0.0.1:7000/api';

export class ClientApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, '');
}

export async function getClientProfile(token: string): Promise<ClientPortalProfileResponse> {
  return requestClientApi<ClientPortalProfileResponse>('/client/me', token);
}

export async function getClientRewardedAdStatus(token: string): Promise<ClientRewardedAdStatusResponse> {
  return requestClientApi<ClientRewardedAdStatusResponse>('/client/rewarded-ads', token);
}

export async function claimClientRewardedAd(
  token: string,
  payload: ClaimRewardedAdRequest,
): Promise<ClientRewardedAdClaimResponse> {
  return requestClientApi<ClientRewardedAdClaimResponse>('/client/rewarded-ads/claim', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getClientRoutePreference(
  token: string,
  routeGroup?: string,
): Promise<ClientRoutePreferenceResponse> {
  const query = routeGroup ? `?routeGroup=${encodeURIComponent(routeGroup)}` : '';
  return requestClientApi<ClientRoutePreferenceResponse>(`/client/route-preference${query}`, token);
}

export async function getClientRouteOptions(
  token: string,
  routeGroup?: string,
): Promise<ClientRouteOptionsResponse> {
  const query = routeGroup ? `?routeGroup=${encodeURIComponent(routeGroup)}` : '';
  return requestClientApi<ClientRouteOptionsResponse>(`/client/route-options${query}`, token);
}

export async function updateClientRoutePreference(
  token: string,
  payload: UpdateClientRoutePreferenceRequest,
): Promise<ClientRoutePreferenceResponse> {
  return requestClientApi<ClientRoutePreferenceResponse>('/client/route-preference', token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

async function requestClientApi<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new ClientApiError(await responseMessage(response), response.status);
  }

  return response.json() as Promise<T>;
}

async function responseMessage(response: Response): Promise<string> {
  try {
    const body = await response.json() as { message?: unknown; error?: unknown };
    if (typeof body.message === 'string') return body.message;
    if (Array.isArray(body.message) && body.message.every((item) => typeof item === 'string')) {
      return body.message.join(', ');
    }
    if (typeof body.error === 'string') return body.error;
  } catch {
    // Plain status text is enough when the API did not send JSON.
  }

  return response.statusText || 'Request failed';
}
