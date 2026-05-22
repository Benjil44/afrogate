import { Inject, Injectable } from '@nestjs/common';
import type { MetricsTimeRange, MetricsTimeseriesResponse, ServerMetricSnapshot } from '@afrogate/shared';
import { MetricsIngestDto } from './dto/metrics-ingest.dto';
import { METRICS_REPOSITORY, MetricsRepository } from './metrics.repository';

export type { ServerMetricSnapshot };

@Injectable()
export class MetricsService {
  private static readonly rangeMinutes: Record<MetricsTimeRange, number> = {
    '15m': 15,
    '1h': 60,
    '6h': 360,
    '24h': 1440,
  };

  constructor(
    @Inject(METRICS_REPOSITORY)
    private readonly metricsRepository: MetricsRepository,
  ) {}

  record(payload: MetricsIngestDto): Promise<ServerMetricSnapshot> {
    const snapshot: ServerMetricSnapshot = {
      ...payload,
      observedAt: new Date().toISOString(),
      healthScore: this.calculateHealthScore(payload),
    };

    return this.metricsRepository.record(snapshot);
  }

  listLatest(): Promise<ServerMetricSnapshot[]> {
    return this.metricsRepository.listLatest();
  }

  async listTimeseries(rangeInput?: string, serverId?: string): Promise<MetricsTimeseriesResponse> {
    const range = this.normalizeRange(rangeInput);
    const series = await this.metricsRepository.listTimeseries({ range, serverId });

    return {
      range,
      bucketSeconds: 10,
      series,
    };
  }

  private calculateHealthScore(metric: MetricsIngestDto): number {
    let score = 100;

    if (metric.pingMs && metric.pingMs > 50) score -= Math.min(25, (metric.pingMs - 50) / 4);
    if (metric.jitterMs && metric.jitterMs > 10) score -= Math.min(20, (metric.jitterMs - 10) / 3);
    if (metric.packetLossPercent) score -= Math.min(35, metric.packetLossPercent * 10);
    if (metric.cpuPercent && metric.cpuPercent > 80) score -= Math.min(10, metric.cpuPercent - 80);
    if (metric.ramPercent && metric.ramPercent > 85) score -= Math.min(10, metric.ramPercent - 85);
    if (metric.diskFreePercent !== undefined && metric.diskFreePercent < 10) score -= 30;

    return Math.max(0, Math.round(score));
  }

  private normalizeRange(rangeInput?: string): MetricsTimeRange {
    if (rangeInput && rangeInput in MetricsService.rangeMinutes) {
      return rangeInput as MetricsTimeRange;
    }

    return '1h';
  }
}
