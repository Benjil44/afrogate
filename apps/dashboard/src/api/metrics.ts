import type { LatestMetricsResponse, MetricsTimeRange, MetricsTimeseriesResponse } from '@afrogate/shared';

const DEFAULT_API_BASE_URL = 'http://localhost:4000/api';

export async function fetchLatestMetrics(signal?: AbortSignal): Promise<LatestMetricsResponse> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL;
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/metrics/latest`, { signal });

  if (!response.ok) {
    throw new Error(`Metrics request failed with ${response.status}`);
  }

  return response.json() as Promise<LatestMetricsResponse>;
}

export async function fetchMetricsTimeseries(
  range: MetricsTimeRange,
  signal?: AbortSignal,
): Promise<MetricsTimeseriesResponse> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL;
  const searchParams = new URLSearchParams({ range });
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/metrics/timeseries?${searchParams}`, { signal });

  if (!response.ok) {
    throw new Error(`Metrics time-series request failed with ${response.status}`);
  }

  return response.json() as Promise<MetricsTimeseriesResponse>;
}
