import type { LatestMetricsResponse, MetricsTimeRange, MetricsTimeseriesResponse } from '@afrows/shared';
import { getApiBaseUrl } from './base';

export async function fetchLatestMetrics(signal?: AbortSignal): Promise<LatestMetricsResponse> {
  const response = await fetch(`${getApiBaseUrl()}/metrics/latest`, { signal });

  if (!response.ok) {
    throw new Error(`Metrics request failed with ${response.status}`);
  }

  return response.json() as Promise<LatestMetricsResponse>;
}

export async function fetchMetricsTimeseries(
  range: MetricsTimeRange,
  signal?: AbortSignal,
): Promise<MetricsTimeseriesResponse> {
  const searchParams = new URLSearchParams({ range });
  const response = await fetch(`${getApiBaseUrl()}/metrics/timeseries?${searchParams}`, { signal });

  if (!response.ok) {
    throw new Error(`Metrics time-series request failed with ${response.status}`);
  }

  return response.json() as Promise<MetricsTimeseriesResponse>;
}
