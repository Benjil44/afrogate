import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { MetricTimeseriesPoint, ServerMetricSnapshot, ServerMetricTimeseries } from '@afrogate/shared';
import { DatabaseService } from '../database/database.service';
import { serverMetrics, servers } from '../database/schema';
import { MetricsRepository, MetricsTimeseriesQuery } from './metrics.repository';

interface LatestMetricRow {
  serverId: string;
  hostname: string | null;
  platform: string | null;
  observedAt: Date;
  cpuPercent: number | null;
  ramPercent: number | null;
  diskFreePercent: number | null;
  inboundBps: number | null;
  outboundBps: number | null;
  pingMs: number | null;
  jitterMs: number | null;
  packetLossPercent: number | null;
  healthScore: number;
  raw: Partial<ServerMetricSnapshot> | null;
}

interface TimeseriesMetricRow extends LatestMetricRow {}

@Injectable()
export class PostgresMetricsRepository implements MetricsRepository {
  private static readonly rangeMinutes = {
    '15m': 15,
    '1h': 60,
    '6h': 360,
    '24h': 1440,
  } as const;

  constructor(private readonly database: DatabaseService) {}

  async record(snapshot: ServerMetricSnapshot): Promise<ServerMetricSnapshot> {
    const [server] = await this.database.db
      .insert(servers)
      .values({
        externalId: snapshot.serverId,
        hostname: snapshot.hostname ?? null,
        platform: snapshot.platform ?? null,
        status: 'healthy',
      })
      .onConflictDoUpdate({
        target: servers.externalId,
        set: {
          hostname: snapshot.hostname ?? null,
          platform: snapshot.platform ?? null,
          lastSeenAt: sql`now()`,
          status: 'healthy',
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: servers.id });

    await this.database.db.insert(serverMetrics).values({
      serverId: server.id,
      observedAt: new Date(snapshot.observedAt),
      cpuPercent: snapshot.cpuPercent ?? null,
      ramPercent: snapshot.ramPercent ?? null,
      diskFreePercent: snapshot.diskFreePercent ?? null,
      inboundBps: snapshot.inboundBps ?? null,
      outboundBps: snapshot.outboundBps ?? null,
      pingMs: snapshot.pingMs ?? null,
      jitterMs: snapshot.jitterMs ?? null,
      packetLossPercent: snapshot.packetLossPercent ?? null,
      healthScore: snapshot.healthScore,
      raw: snapshot,
    });

    await this.syncDiskAlert(snapshot);

    return snapshot;
  }

  async listLatest(): Promise<ServerMetricSnapshot[]> {
    const result = await this.database.query<LatestMetricRow>(
      `
        SELECT DISTINCT ON (s.external_id)
          s.external_id AS "serverId",
          s.hostname AS "hostname",
          s.platform AS "platform",
          m.observed_at AS "observedAt",
          m.cpu_percent AS "cpuPercent",
          m.ram_percent AS "ramPercent",
          m.disk_free_percent AS "diskFreePercent",
          m.inbound_bps AS "inboundBps",
          m.outbound_bps AS "outboundBps",
          m.ping_ms AS "pingMs",
          m.jitter_ms AS "jitterMs",
          m.packet_loss_percent AS "packetLossPercent",
          m.health_score AS "healthScore",
          m.raw AS "raw"
        FROM servers s
        JOIN server_metrics m ON m.server_id = s.id
        ORDER BY s.external_id, m.observed_at DESC
      `,
    );

    return result.rows.map((row) => ({
      serverId: row.serverId,
      hostname: row.hostname ?? undefined,
      platform: row.platform ?? undefined,
      observedAt: row.observedAt.toISOString(),
      cpuPercent: row.cpuPercent,
      ramPercent: row.ramPercent,
      diskFreePercent: row.diskFreePercent,
      storages: row.raw?.storages,
      networkInterfaces: row.raw?.networkInterfaces,
      inboundBps: row.inboundBps,
      outboundBps: row.outboundBps,
      pingMs: row.pingMs,
      jitterMs: row.jitterMs,
      packetLossPercent: row.packetLossPercent,
      healthScore: row.healthScore,
    }));
  }

  async listTimeseries(query: MetricsTimeseriesQuery): Promise<ServerMetricTimeseries[]> {
    const result = await this.database.query<TimeseriesMetricRow>(
      `
        SELECT
          s.external_id AS "serverId",
          s.hostname AS "hostname",
          s.platform AS "platform",
          m.observed_at AS "observedAt",
          m.cpu_percent AS "cpuPercent",
          m.ram_percent AS "ramPercent",
          m.disk_free_percent AS "diskFreePercent",
          m.inbound_bps AS "inboundBps",
          m.outbound_bps AS "outboundBps",
          m.ping_ms AS "pingMs",
          m.jitter_ms AS "jitterMs",
          m.packet_loss_percent AS "packetLossPercent",
          m.health_score AS "healthScore",
          m.raw AS "raw"
        FROM servers s
        JOIN server_metrics m ON m.server_id = s.id
        WHERE m.observed_at >= now() - ($1::int * interval '1 minute')
          AND ($2::text IS NULL OR s.external_id = $2)
        ORDER BY s.external_id, m.observed_at ASC
      `,
      [PostgresMetricsRepository.rangeMinutes[query.range], query.serverId ?? null],
    );

    const seriesByServer = new Map<string, ServerMetricTimeseries>();

    for (const row of result.rows) {
      const existing = seriesByServer.get(row.serverId);
      const point: MetricTimeseriesPoint = {
        observedAt: row.observedAt.toISOString(),
        cpuPercent: row.cpuPercent,
        ramPercent: row.ramPercent,
        diskFreePercent: row.diskFreePercent,
        inboundBps: row.inboundBps,
        outboundBps: row.outboundBps,
        pingMs: row.pingMs,
        jitterMs: row.jitterMs,
        packetLossPercent: row.packetLossPercent,
        healthScore: row.healthScore,
      };

      if (existing) {
        existing.points.push(point);
        continue;
      }

      seriesByServer.set(row.serverId, {
        serverId: row.serverId,
        hostname: row.hostname ?? undefined,
        platform: row.platform ?? undefined,
        points: [point],
      });
    }

    return [...seriesByServer.values()];
  }

  private async syncDiskAlert(snapshot: ServerMetricSnapshot): Promise<void> {
    const diskFreePercent = snapshot.diskFreePercent;

    if (diskFreePercent !== undefined && diskFreePercent !== null && diskFreePercent < 10) {
      await this.database.query(
        `
          INSERT INTO alerts (severity, status, source_type, source_id, title, message)
          VALUES ('critical', 'open', 'server_disk', $1, 'Storage below 10%', $2)
          ON CONFLICT (source_type, source_id, title) WHERE status = 'open'
          DO UPDATE SET
            severity = excluded.severity,
            message = excluded.message,
            last_seen_at = now()
        `,
        [
          snapshot.serverId,
          `Server ${snapshot.serverId} has ${diskFreePercent}% disk free.`,
        ],
      );
      return;
    }

    await this.database.query(
      `
        UPDATE alerts
        SET status = 'resolved',
            resolved_at = now(),
            last_seen_at = now()
        WHERE source_type = 'server_disk'
          AND source_id = $1
          AND title = 'Storage below 10%'
          AND status = 'open'
      `,
      [snapshot.serverId],
    );
  }
}
