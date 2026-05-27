import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';

type AlertSeverity = 'warning' | 'critical';

interface ServerAlertSignalRow {
  serverId: string;
  externalId: string;
  hostname: string | null;
  status: string;
  lastSeenAt: Date;
  metricObservedAt: Date | null;
  cpuPercent: number | null;
  ramPercent: number | null;
  diskFreePercent: number | null;
  pingMs: number | null;
  jitterMs: number | null;
  packetLossPercent: number | null;
  healthScore: number | null;
}

interface OutboundAlertSignalRow {
  id: string;
  name: string;
  routeGroup: string;
  enabled: boolean;
  maintenanceMode: boolean;
  healthStatus: string;
  lastCheckedAt: Date | null;
}

interface AlertCondition {
  sourceType: string;
  sourceId: string;
  title: string;
  active: boolean;
  severity: AlertSeverity;
  message: string;
}

@Injectable()
export class AlertEngineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertEngineService.name);
  private timer: NodeJS.Timeout | undefined;
  private isRunning = false;

  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
  ) {}

  onModuleInit(): void {
    if (!process.env.DATABASE_URL) return;
    if (!this.configFlag('AFROGATE_ALERT_ENGINE_ENABLED', true)) return;

    this.timer = setInterval(() => void this.evaluateAlerts(), this.intervalMs());
    this.timer.unref?.();
    void this.evaluateAlerts();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async evaluateAlerts(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    try {
      const serverSignals = await this.listServerSignals();
      for (const signal of serverSignals) {
        for (const condition of this.serverConditions(signal)) {
          await this.syncAlert(condition);
        }
      }

      const outboundSignals = await this.listOutboundSignals();
      for (const signal of outboundSignals) {
        await this.syncAlert(this.outboundCondition(signal));
      }
    } catch (error) {
      this.logger.warn(error instanceof Error ? error.message : 'Alert engine evaluation failed');
    } finally {
      this.isRunning = false;
    }
  }

  private async listServerSignals(): Promise<ServerAlertSignalRow[]> {
    const result = await this.database.query<ServerAlertSignalRow>(
      `
        SELECT
          s.id AS "serverId",
          s.external_id AS "externalId",
          s.hostname,
          s.status,
          s.last_seen_at AS "lastSeenAt",
          m.observed_at AS "metricObservedAt",
          m.cpu_percent AS "cpuPercent",
          m.ram_percent AS "ramPercent",
          m.disk_free_percent AS "diskFreePercent",
          m.ping_ms AS "pingMs",
          m.jitter_ms AS "jitterMs",
          m.packet_loss_percent AS "packetLossPercent",
          m.health_score AS "healthScore"
        FROM servers s
        LEFT JOIN LATERAL (
          SELECT *
          FROM server_metrics sm
          WHERE sm.server_id = s.id
          ORDER BY sm.observed_at DESC
          LIMIT 1
        ) m ON true
        ORDER BY s.last_seen_at ASC
        LIMIT $1
      `,
      [this.batchSize()],
    );

    return result.rows;
  }

  private async listOutboundSignals(): Promise<OutboundAlertSignalRow[]> {
    const result = await this.database.query<OutboundAlertSignalRow>(
      `
        SELECT
          id,
          name,
          route_group AS "routeGroup",
          enabled,
          maintenance_mode AS "maintenanceMode",
          health_status AS "healthStatus",
          last_checked_at AS "lastCheckedAt"
        FROM outbounds
        ORDER BY updated_at DESC
        LIMIT $1
      `,
      [this.batchSize()],
    );

    return result.rows;
  }

  private serverConditions(signal: ServerAlertSignalRow): AlertCondition[] {
    const label = signal.hostname || signal.externalId;
    const now = Date.now();
    const lastSeenAgeSeconds = Math.floor((now - signal.lastSeenAt.getTime()) / 1000);
    const latestMetricAgeSeconds = signal.metricObservedAt
      ? Math.floor((now - signal.metricObservedAt.getTime()) / 1000)
      : Number.POSITIVE_INFINITY;

    return [
      {
        sourceType: 'server',
        sourceId: signal.externalId,
        title: 'Server heartbeat stale',
        active: lastSeenAgeSeconds >= this.configInteger('AFROGATE_ALERT_STALE_SERVER_SECONDS', 90, 30, 86400),
        severity: 'critical',
        message: `Server ${label} has not checked in for ${lastSeenAgeSeconds} seconds.`,
      },
      {
        sourceType: 'server',
        sourceId: signal.externalId,
        title: 'Server metrics stale',
        active: latestMetricAgeSeconds >= this.configInteger('AFROGATE_ALERT_STALE_METRICS_SECONDS', 120, 30, 86400),
        severity: 'warning',
        message: signal.metricObservedAt
          ? `Server ${label} has no fresh metrics for ${latestMetricAgeSeconds} seconds.`
          : `Server ${label} has no metrics yet.`,
      },
      this.thresholdCondition({
        sourceType: 'server_metric',
        sourceId: signal.externalId,
        title: 'CPU usage high',
        label,
        metricLabel: 'CPU',
        value: signal.cpuPercent,
        unit: '%',
        warningThreshold: this.configInteger('AFROGATE_ALERT_CPU_WARNING_PERCENT', 85, 1, 100),
        criticalThreshold: this.configInteger('AFROGATE_ALERT_CPU_CRITICAL_PERCENT', 95, 1, 100),
      }),
      this.thresholdCondition({
        sourceType: 'server_metric',
        sourceId: signal.externalId,
        title: 'RAM usage high',
        label,
        metricLabel: 'RAM',
        value: signal.ramPercent,
        unit: '%',
        warningThreshold: this.configInteger('AFROGATE_ALERT_RAM_WARNING_PERCENT', 85, 1, 100),
        criticalThreshold: this.configInteger('AFROGATE_ALERT_RAM_CRITICAL_PERCENT', 95, 1, 100),
      }),
      this.lowThresholdCondition({
        sourceType: 'server_disk',
        sourceId: signal.externalId,
        title: 'Storage below safe threshold',
        label,
        metricLabel: 'disk free',
        value: signal.diskFreePercent,
        unit: '%',
        warningThreshold: this.configInteger('AFROGATE_ALERT_DISK_WARNING_FREE_PERCENT', 15, 1, 100),
        criticalThreshold: this.configInteger('AFROGATE_ALERT_DISK_CRITICAL_FREE_PERCENT', 10, 1, 100),
      }),
      this.thresholdCondition({
        sourceType: 'route_metric',
        sourceId: signal.externalId,
        title: 'Ping above threshold',
        label,
        metricLabel: 'ping',
        value: signal.pingMs,
        unit: ' ms',
        warningThreshold: this.configInteger('AFROGATE_ALERT_PING_WARNING_MS', 100, 1, 60000),
        criticalThreshold: this.configInteger('AFROGATE_ALERT_PING_CRITICAL_MS', 150, 1, 60000),
      }),
      this.thresholdCondition({
        sourceType: 'route_metric',
        sourceId: signal.externalId,
        title: 'Jitter above threshold',
        label,
        metricLabel: 'jitter',
        value: signal.jitterMs,
        unit: ' ms',
        warningThreshold: this.configInteger('AFROGATE_ALERT_JITTER_WARNING_MS', 40, 1, 60000),
        criticalThreshold: this.configInteger('AFROGATE_ALERT_JITTER_CRITICAL_MS', 80, 1, 60000),
      }),
      this.thresholdCondition({
        sourceType: 'route_metric',
        sourceId: signal.externalId,
        title: 'Packet loss above threshold',
        label,
        metricLabel: 'packet loss',
        value: signal.packetLossPercent,
        unit: '%',
        warningThreshold: this.configNumber('AFROGATE_ALERT_PACKET_LOSS_WARNING_PERCENT', 1, 0.1, 100),
        criticalThreshold: this.configNumber('AFROGATE_ALERT_PACKET_LOSS_CRITICAL_PERCENT', 5, 0.1, 100),
      }),
    ];
  }

  private thresholdCondition(input: {
    sourceType: string;
    sourceId: string;
    title: string;
    label: string;
    metricLabel: string;
    value: number | null;
    unit: string;
    warningThreshold: number;
    criticalThreshold: number;
  }): AlertCondition {
    const value = input.value;
    const active = value !== null && value >= input.warningThreshold;
    const severity: AlertSeverity =
      value !== null && value >= input.criticalThreshold ? 'critical' : 'warning';

    return {
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      title: input.title,
      active,
      severity,
      message:
        value === null
          ? `${input.label} has no ${input.metricLabel} value.`
          : `${input.label} ${input.metricLabel} is ${this.formatNumber(value)}${input.unit}.`,
    };
  }

  private lowThresholdCondition(input: {
    sourceType: string;
    sourceId: string;
    title: string;
    label: string;
    metricLabel: string;
    value: number | null;
    unit: string;
    warningThreshold: number;
    criticalThreshold: number;
  }): AlertCondition {
    const value = input.value;
    const active = value !== null && value <= input.warningThreshold;
    const severity: AlertSeverity =
      value !== null && value <= input.criticalThreshold ? 'critical' : 'warning';

    return {
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      title: input.title,
      active,
      severity,
      message:
        value === null
          ? `${input.label} has no ${input.metricLabel} value.`
          : `${input.label} ${input.metricLabel} is ${this.formatNumber(value)}${input.unit}.`,
    };
  }

  private outboundCondition(signal: OutboundAlertSignalRow): AlertCondition {
    const active =
      signal.enabled &&
      !signal.maintenanceMode &&
      (signal.healthStatus === 'critical' || signal.healthStatus === 'degraded');

    return {
      sourceType: 'outbound',
      sourceId: signal.id,
      title: 'Outbound health unhealthy',
      active,
      severity: signal.healthStatus === 'critical' ? 'critical' : 'warning',
      message: `Outbound ${signal.name} in route group ${signal.routeGroup} is ${signal.healthStatus}.`,
    };
  }

  private async syncAlert(condition: AlertCondition): Promise<void> {
    if (condition.active) {
      await this.database.query(
        `
          INSERT INTO alerts (severity, status, source_type, source_id, title, message)
          VALUES ($1, 'open', $2, $3, $4, $5)
          ON CONFLICT (source_type, source_id, title) WHERE status = 'open'
          DO UPDATE SET
            severity = excluded.severity,
            message = excluded.message,
            last_seen_at = now()
        `,
        [
          condition.severity,
          condition.sourceType,
          condition.sourceId,
          condition.title,
          condition.message,
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
        WHERE source_type = $1
          AND source_id = $2
          AND title = $3
          AND status = 'open'
      `,
      [condition.sourceType, condition.sourceId, condition.title],
    );
  }

  private intervalMs(): number {
    return this.configInteger('AFROGATE_ALERT_ENGINE_INTERVAL_SECONDS', 10, 5, 3600) * 1000;
  }

  private batchSize(): number {
    return this.configInteger('AFROGATE_ALERT_ENGINE_BATCH_SIZE', 100, 1, 1000);
  }

  private configInteger(name: string, fallback: number, minimum: number, maximum: number): number {
    return Math.round(this.configNumber(name, fallback, minimum, maximum));
  }

  private configNumber(name: string, fallback: number, minimum: number, maximum: number): number {
    const configured = Number(this.config.get<string>(name));
    if (!Number.isFinite(configured)) return fallback;
    return Math.min(Math.max(configured, minimum), maximum);
  }

  private configFlag(name: string, fallback: boolean): boolean {
    const value = this.config.get<string>(name)?.trim().toLowerCase();
    if (!value) return fallback;
    return ['1', 'true', 'yes', 'on'].includes(value);
  }

  private formatNumber(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
}
