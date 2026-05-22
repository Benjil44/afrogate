import type { MetricsTimeRange, ServerMetricSnapshot, ServerMetricTimeseries } from '@afrogate/shared';

export const METRICS_REPOSITORY = Symbol('METRICS_REPOSITORY');

export interface MetricsTimeseriesQuery {
  range: MetricsTimeRange;
  serverId?: string;
}

export interface MetricsRepository {
  record(snapshot: ServerMetricSnapshot): Promise<ServerMetricSnapshot>;
  listLatest(): Promise<ServerMetricSnapshot[]>;
  listTimeseries(query: MetricsTimeseriesQuery): Promise<ServerMetricTimeseries[]>;
}
