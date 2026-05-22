import type { ServerMetricSnapshot } from '@afrogate/shared';

export const METRICS_REPOSITORY = Symbol('METRICS_REPOSITORY');

export interface MetricsRepository {
  record(snapshot: ServerMetricSnapshot): Promise<ServerMetricSnapshot>;
  listLatest(): Promise<ServerMetricSnapshot[]>;
}
