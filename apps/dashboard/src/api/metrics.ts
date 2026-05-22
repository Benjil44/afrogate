import type { LatestMetricsResponse } from '@afrogate/shared';

const DEFAULT_API_BASE_URL = 'http://localhost:4000/api';

export async function fetchLatestMetrics(signal?: AbortSignal): Promise<LatestMetricsResponse> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL;
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/metrics/latest`, { signal });

  if (!response.ok) {
    throw new Error(`Metrics request failed with ${response.status}`);
  }

  return response.json() as Promise<LatestMetricsResponse>;
}
