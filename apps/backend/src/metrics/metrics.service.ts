import { Injectable } from '@nestjs/common';
import { MetricsIngestDto } from './dto/metrics-ingest.dto';

export interface ServerMetricSnapshot extends MetricsIngestDto {
  observedAt: string;
  healthScore: number;
}

@Injectable()
export class MetricsService {
  private readonly latestByServer = new Map<string, ServerMetricSnapshot>();

  record(payload: MetricsIngestDto): ServerMetricSnapshot {
    const snapshot: ServerMetricSnapshot = {
      ...payload,
      observedAt: new Date().toISOString(),
      healthScore: this.calculateHealthScore(payload),
    };

    this.latestByServer.set(payload.serverId, snapshot);
    return snapshot;
  }

  listLatest(): ServerMetricSnapshot[] {
    return [...this.latestByServer.values()].sort((a, b) =>
      a.serverId.localeCompare(b.serverId),
    );
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
}

