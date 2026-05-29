import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface RouteQualityAggregationResult {
  routeGroup: string;
  rangeHours: number;
  upsertedBuckets: number;
  aggregatedAt: string;
}

@Injectable()
export class RouteQualityAggregationService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private isRunning = false;

  constructor(private readonly database: DatabaseService) {}

  onModuleInit(): void {
    if (!process.env.DATABASE_URL) return;
    if (!this.configFlag('AFROGATE_ROUTE_QUALITY_AGGREGATION_ENABLED', true)) return;

    this.timer = setInterval(() => void this.aggregateRecent(), this.intervalMs());
    this.timer.unref?.();
    void this.aggregateRecent();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async aggregateRecent(
    routeGroup = 'main',
    rangeHours = this.lookbackHours(),
  ): Promise<RouteQualityAggregationResult> {
    if (this.isRunning) {
      return {
        routeGroup,
        rangeHours,
        upsertedBuckets: 0,
        aggregatedAt: new Date().toISOString(),
      };
    }

    this.isRunning = true;

    try {
      const result = await this.database.query<{ id: number }>(
        `
          WITH probe_rows AS (
            SELECT
              sm.server_id AS "serverId",
              sm.observed_at AS "observedAt",
              lower(probe.value->>'protocol') AS protocol,
              COALESCE(probe_outbound.id, matched_outbound.id) AS "outboundId",
              COALESCE(
                NULLIF(probe.value->>'outboundKey', ''),
                probe_outbound.id::text,
                matched_outbound.id::text,
                NULLIF(probe.value->>'outboundName', ''),
                probe_outbound.name,
                matched_outbound.name,
                'unassigned'
              ) AS "outboundKey",
              COALESCE(NULLIF(probe.value->>'outboundName', ''), probe_outbound.name, matched_outbound.name) AS "outboundName",
              COALESCE(
                NULLIF(probe.value->>'operator', ''),
                NULLIF(probe_outbound.config->>'operator', ''),
                NULLIF(probe_outbound.config->>'interfaceOperator', ''),
                NULLIF(probe_outbound.config->>'isp', ''),
                NULLIF(matched_outbound.config->>'operator', ''),
                NULLIF(matched_outbound.config->>'interfaceOperator', ''),
                NULLIF(matched_outbound.config->>'isp', ''),
                'unknown'
              ) AS operator,
              probe.value->>'status' AS status,
              (probe.value->>'latencyMs')::double precision AS "latencyMs",
              (probe.value->>'jitterMs')::double precision AS "jitterMs",
              (probe.value->>'packetLossPercent')::double precision AS "packetLossPercent"
            FROM server_metrics sm
            CROSS JOIN LATERAL jsonb_array_elements(
              CASE
                WHEN jsonb_typeof(sm.raw->'routeProbes') = 'array' THEN sm.raw->'routeProbes'
                ELSE '[]'::jsonb
              END
            ) AS probe(value)
            LEFT JOIN outbounds probe_outbound
              ON probe_outbound.id::text = probe.value->>'outboundId'
              AND probe_outbound.server_id = sm.server_id
              AND probe_outbound.route_group = $1
            LEFT JOIN LATERAL (
              SELECT o.id, o.name, o.type, o.config
              FROM outbounds o
              WHERE o.server_id = sm.server_id
                AND o.route_group = $1
                AND (
                  lower(o.type) = lower(probe.value->>'protocol')
                  OR (lower(probe.value->>'protocol') IN ('udp', 'quic', 'wireguard') AND lower(o.type) = 'wireguard')
                  OR lower(o.type) = 'direct'
                )
              ORDER BY
                CASE
                  WHEN lower(o.type) = lower(probe.value->>'protocol') THEN 0
                  WHEN lower(probe.value->>'protocol') IN ('udp', 'quic', 'wireguard') AND lower(o.type) = 'wireguard' THEN 1
                  ELSE 2
                END,
                o.priority ASC,
                o.created_at ASC
              LIMIT 1
            ) AS matched_outbound ON true
            WHERE sm.observed_at >= now() - ($2::int * interval '1 hour')
              AND COALESCE(NULLIF(probe.value->>'routeGroup', ''), $1::text) = $1::text
          ),
          scored AS (
            SELECT
              *,
              GREATEST(0, LEAST(100,
                CASE status
                  WHEN 'healthy' THEN 100
                  WHEN 'degraded' THEN 72
                  WHEN 'critical' THEN 20
                  ELSE 55
                END
                - GREATEST(0, COALESCE("latencyMs", 0) - CASE protocol WHEN 'dns' THEN 80 WHEN 'tcp' THEN 100 ELSE 70 END) * 0.09
                - GREATEST(0, COALESCE("jitterMs", 0) - CASE protocol WHEN 'tcp' THEN 25 WHEN 'dns' THEN 25 ELSE 10 END)
                - GREATEST(0, COALESCE("packetLossPercent", 0)) * CASE protocol WHEN 'tcp' THEN 16 WHEN 'dns' THEN 16 ELSE 24 END
              )) AS "sampleScore"
            FROM probe_rows
            WHERE protocol IN ('tcp', 'udp', 'quic', 'dns', 'wireguard', 'mtu')
          ),
          profile_rows AS (
            SELECT
              scored.*,
              profile.score_profile AS "scoreProfile",
              GREATEST(0, LEAST(100, profile.profile_score)) AS "profileScore"
            FROM scored
            CROSS JOIN LATERAL (
              VALUES
                ('balanced', "sampleScore"),
                ('stability', CASE WHEN protocol IN ('udp', 'quic', 'wireguard', 'mtu') THEN "sampleScore" ELSE "sampleScore" - 6 END),
                ('throughput', CASE WHEN status = 'healthy' THEN "sampleScore" + 3 ELSE "sampleScore" - 4 END),
                ('gaming', CASE WHEN protocol IN ('udp', 'quic', 'wireguard', 'tcp', 'mtu') THEN "sampleScore" - GREATEST(0, COALESCE("latencyMs", 0) - 85) * 0.05 - GREATEST(0, COALESCE("jitterMs", 0) - 6) * 0.9 - GREATEST(0, COALESCE("packetLossPercent", 0) - 0.1) * 20 END),
                ('tcp', CASE WHEN protocol = 'tcp' THEN "sampleScore" END),
                ('udp', CASE WHEN protocol IN ('udp', 'wireguard') THEN "sampleScore" END),
                ('quic', CASE WHEN protocol IN ('quic', 'udp') THEN "sampleScore" END),
                ('dns', CASE WHEN protocol = 'dns' THEN "sampleScore" END),
                ('wireguard', CASE WHEN protocol IN ('wireguard', 'udp', 'mtu') THEN "sampleScore" END)
            ) AS profile(score_profile, profile_score)
            WHERE profile.profile_score IS NOT NULL
          ),
          hourly AS (
            SELECT
              $1::text AS "routeGroup",
              "serverId",
              "outboundId",
              "outboundKey",
              "outboundName",
              operator,
              protocol,
              "scoreProfile",
              date_trunc('hour', "observedAt") AS "bucketStart",
              EXTRACT(HOUR FROM "observedAt")::int AS "hourOfDay",
              EXTRACT(DOW FROM "observedAt")::int AS "dayOfWeek",
              COUNT(*)::int AS "sampleCount",
              ROUND(AVG("profileScore")::numeric, 1)::float AS "averageScore",
              ROUND(AVG("latencyMs")::numeric, 1)::float AS "averageLatencyMs",
              ROUND(AVG("jitterMs")::numeric, 1)::float AS "averageJitterMs",
              ROUND(AVG("packetLossPercent")::numeric, 2)::float AS "averagePacketLossPercent",
              ROUND((COUNT(*) FILTER (WHERE status IN ('degraded', 'critical'))::numeric * 100 / COUNT(*)), 1)::float AS "degradedSamplePercent",
              ROUND((COUNT(*) FILTER (WHERE status = 'critical')::numeric * 100 / COUNT(*)), 1)::float AS "criticalSamplePercent",
              MIN("observedAt") AS "firstObservedAt",
              MAX("observedAt") AS "lastObservedAt"
            FROM profile_rows
            GROUP BY
              "serverId",
              "outboundId",
              "outboundKey",
              "outboundName",
              operator,
              protocol,
              "scoreProfile",
              date_trunc('hour', "observedAt"),
              EXTRACT(HOUR FROM "observedAt"),
              EXTRACT(DOW FROM "observedAt")
          )
          INSERT INTO route_quality_hourly (
            route_group, server_id, outbound_id, outbound_key, outbound_name, operator,
            protocol, score_profile, bucket_start, hour_of_day, day_of_week,
            sample_count, average_score, average_latency_ms, average_jitter_ms,
            average_packet_loss_percent, degraded_sample_percent, critical_sample_percent,
            first_observed_at, last_observed_at, updated_at
          )
          SELECT
            "routeGroup", "serverId", "outboundId", "outboundKey", "outboundName", operator,
            protocol, "scoreProfile", "bucketStart", "hourOfDay", "dayOfWeek",
            "sampleCount", "averageScore", "averageLatencyMs", "averageJitterMs",
            "averagePacketLossPercent", "degradedSamplePercent", "criticalSamplePercent",
            "firstObservedAt", "lastObservedAt", now()
          FROM hourly
          ON CONFLICT (route_group, server_id, outbound_key, operator, protocol, score_profile, bucket_start)
          DO UPDATE SET
            outbound_id = excluded.outbound_id,
            outbound_name = excluded.outbound_name,
            sample_count = excluded.sample_count,
            average_score = excluded.average_score,
            average_latency_ms = excluded.average_latency_ms,
            average_jitter_ms = excluded.average_jitter_ms,
            average_packet_loss_percent = excluded.average_packet_loss_percent,
            degraded_sample_percent = excluded.degraded_sample_percent,
            critical_sample_percent = excluded.critical_sample_percent,
            first_observed_at = excluded.first_observed_at,
            last_observed_at = excluded.last_observed_at,
            updated_at = now()
          RETURNING id
        `,
        [routeGroup, rangeHours],
      );

      return {
        routeGroup,
        rangeHours,
        upsertedBuckets: result.rowCount ?? result.rows.length,
        aggregatedAt: new Date().toISOString(),
      };
    } finally {
      this.isRunning = false;
    }
  }

  private intervalMs(): number {
    return this.configInteger('AFROGATE_ROUTE_QUALITY_AGGREGATION_INTERVAL_SECONDS', 300, 60, 86400) * 1000;
  }

  private lookbackHours(): number {
    return this.configInteger('AFROGATE_ROUTE_QUALITY_AGGREGATION_LOOKBACK_HOURS', 48, 1, 2160);
  }

  private configFlag(name: string, fallback: boolean): boolean {
    const value = process.env[name];
    if (value === undefined || value === '') return fallback;

    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }

  private configInteger(name: string, fallback: number, min: number, max: number): number {
    const value = Number(process.env[name] ?? fallback);
    if (!Number.isInteger(value)) return fallback;

    return Math.min(max, Math.max(min, value));
  }
}
