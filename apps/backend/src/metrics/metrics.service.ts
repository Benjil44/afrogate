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

    if (typeof metric.pingMs === 'number' && metric.pingMs > 50) score -= Math.min(25, (metric.pingMs - 50) / 4);
    if (typeof metric.jitterMs === 'number' && metric.jitterMs > 10) score -= Math.min(20, (metric.jitterMs - 10) / 3);
    if (typeof metric.packetLossPercent === 'number') score -= Math.min(35, metric.packetLossPercent * 10);
    if (typeof metric.cpuPercent === 'number' && metric.cpuPercent > 80) score -= Math.min(10, metric.cpuPercent - 80);
    if (typeof metric.ramPercent === 'number' && metric.ramPercent > 85) score -= Math.min(10, metric.ramPercent - 85);
    if (typeof metric.diskFreePercent === 'number' && metric.diskFreePercent < 10) score -= 30;
    score -= this.calculateWireGuardPenalty(metric);
    score -= this.calculateRouteProbePenalty(metric);

    return Math.max(0, Math.round(score));
  }

  private calculateWireGuardPenalty(metric: MetricsIngestDto): number {
    const interfaces = metric.wireGuardInterfaces ?? [];
    const monitored = interfaces.filter((item) => item.peerCount > 0 || item.status !== 'unknown');

    if (monitored.length === 0) return 0;

    const downCount = monitored.filter((item) => item.status === 'down' || item.activePeerCount === 0).length;
    const degradedCount = monitored.filter((item) => item.status === 'degraded').length;

    if (downCount === monitored.length) return 20;
    if (downCount > 0 || degradedCount > 0) return 10;

    return 0;
  }

  private calculateRouteProbePenalty(metric: MetricsIngestDto): number {
    const probes = metric.routeProbes ?? [];
    if (probes.length === 0) return 0;

    const criticalCount = probes.filter((probe) => probe.status === 'critical').length;
    const degradedCount = probes.filter((probe) => probe.status === 'degraded').length;
    const worstLoss = probes.reduce((max, probe) => (
      typeof probe.packetLossPercent === 'number' ? Math.max(max, probe.packetLossPercent) : max
    ), 0);
    const worstLatency = probes.reduce((max, probe) => (
      typeof probe.latencyMs === 'number' ? Math.max(max, probe.latencyMs) : max
    ), 0);
    const worstLoadedLatencyDelta = probes.reduce((max, probe) => {
      if (typeof probe.loadedLatencyDeltaMs === 'number') return Math.max(max, probe.loadedLatencyDeltaMs);
      if (typeof probe.loadedLatencyMs === 'number' && typeof probe.latencyMs === 'number') {
        return Math.max(max, probe.loadedLatencyMs - probe.latencyMs);
      }

      return max;
    }, 0);
    const lossPenalty = Math.min(12, worstLoss / 4);
    const latencyPenalty = worstLatency > 250 ? Math.min(8, (worstLatency - 250) / 50) : 0;
    const loadedLatencyPenalty = worstLoadedLatencyDelta > 30 ? Math.min(10, (worstLoadedLatencyDelta - 30) / 12) : 0;

    return Math.min(30, criticalCount * 8 + degradedCount * 4 + lossPenalty + latencyPenalty + loadedLatencyPenalty);
  }

  private normalizeRange(rangeInput?: string): MetricsTimeRange {
    if (rangeInput && rangeInput in MetricsService.rangeMinutes) {
      return rangeInput as MetricsTimeRange;
    }

    return '1h';
  }
}
