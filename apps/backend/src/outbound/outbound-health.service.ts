import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as net from 'node:net';
import { DatabaseService } from '../database/database.service';
import { OutboundHttpService } from './outbound-http.service';

type OutboundCheckStatus = 'healthy' | 'degraded' | 'critical' | 'unknown';
type ProbeKind = 'http' | 'tcp' | 'not_configured';

interface DueOutboundRow {
  id: string;
  name: string;
  type: string;
  routeGroup: string;
  config: Record<string, unknown> | null;
  healthStatus: string;
  failThreshold: number;
  recoveryThreshold: number;
}

interface RecentHealthCheckRow {
  status: string;
}

interface OutboundHealthCheckResult {
  status: OutboundCheckStatus;
  latencyMs: number | null;
  message: string;
  details: Record<string, unknown>;
}

interface ProbeTarget {
  kind: ProbeKind;
  url?: string;
  host?: string;
  port?: number;
  timeoutMs: number;
}

@Injectable()
export class OutboundHealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboundHealthService.name);
  private timer: NodeJS.Timeout | undefined;
  private isRunning = false;

  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
    private readonly outboundHttp: OutboundHttpService,
  ) {}

  onModuleInit(): void {
    if (!process.env.DATABASE_URL) return;
    if (!this.configFlag('AFROWS_OUTBOUND_HEALTH_SCHEDULER_ENABLED', true)) return;

    this.timer = setInterval(() => void this.checkDueOutbounds(), this.scanIntervalMs());
    this.timer.unref?.();
    void this.checkDueOutbounds();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async checkDueOutbounds(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    try {
      const outbounds = await this.listDueOutbounds();

      for (const outbound of outbounds) {
        await this.checkOutbound(outbound);
      }
    } catch (error) {
      this.logger.warn(error instanceof Error ? error.message : 'Outbound health scheduler failed');
    } finally {
      this.isRunning = false;
    }
  }

  private async listDueOutbounds(): Promise<DueOutboundRow[]> {
    const result = await this.database.query<DueOutboundRow>(
      `
        SELECT
          id,
          name,
          type,
          route_group AS "routeGroup",
          config,
          health_status AS "healthStatus",
          fail_threshold AS "failThreshold",
          recovery_threshold AS "recoveryThreshold"
        FROM outbounds
        WHERE enabled = true
          AND maintenance_mode = false
          AND (
            last_checked_at IS NULL
            OR last_checked_at <= now() - (health_interval_seconds * interval '1 second')
          )
        ORDER BY COALESCE(last_checked_at, '1970-01-01'::timestamptz) ASC, priority ASC, created_at ASC
        LIMIT $1
      `,
      [this.batchSize()],
    );

    return result.rows;
  }

  private async checkOutbound(outbound: DueOutboundRow): Promise<void> {
    const result = await this.runProbe(outbound);
    const checkId = await this.insertHealthCheck(outbound.id, result);
    const effectiveStatus = await this.resolveEffectiveStatus(outbound, result.status);

    await this.database.query(
      `
        UPDATE outbounds
        SET health_status = $2,
            last_checked_at = now(),
            last_healthy_at = CASE WHEN $3 = 'healthy' THEN now() ELSE last_healthy_at END,
            updated_at = now()
        WHERE id = $1
      `,
      [outbound.id, effectiveStatus, result.status],
    );

    if (result.status !== 'healthy' && result.status !== 'unknown') {
      this.logger.warn(`Outbound ${outbound.name} health check ${checkId} reported ${result.status}: ${result.message}`);
    }
  }

  private async runProbe(outbound: DueOutboundRow): Promise<OutboundHealthCheckResult> {
    const target = this.resolveProbeTarget(outbound);

    if (target.kind === 'http' && target.url) {
      return this.runHttpProbe(target);
    }

    if (target.kind === 'tcp' && target.host && target.port) {
      return this.runTcpProbe(target);
    }

    return {
      status: 'unknown',
      latencyMs: null,
      message: 'No health target configured',
      details: {
        type: outbound.type,
        probeKind: target.kind,
      },
    };
  }

  private async runHttpProbe(target: ProbeTarget): Promise<OutboundHealthCheckResult> {
    const startedAt = Date.now();

    try {
      const response = await this.outboundHttp.request(target.url!, {
        method: 'GET',
        timeoutMs: target.timeoutMs,
        headers: {
          Accept: '*/*',
        },
      });

      return {
        status: response.ok ? 'healthy' : 'critical',
        latencyMs: response.durationMs,
        message: response.ok ? 'HTTP health target responded successfully' : `HTTP status ${response.statusCode}`,
        details: {
          probeKind: 'http',
          statusCode: response.statusCode,
        },
      };
    } catch (error) {
      return {
        status: 'critical',
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? this.truncate(error.message, 180) : 'HTTP health target failed',
        details: {
          probeKind: 'http',
        },
      };
    }
  }

  private runTcpProbe(target: ProbeTarget): Promise<OutboundHealthCheckResult> {
    const startedAt = Date.now();
    const host = target.host!;
    const port = target.port!;

    return new Promise((resolve) => {
      const socket = net.createConnection({
        host,
        port,
      });

      socket.setTimeout(target.timeoutMs);
      socket.once('connect', () => {
        socket.destroy();
        resolve({
          status: 'healthy',
          latencyMs: Date.now() - startedAt,
          message: 'TCP health target accepted a connection',
          details: {
            probeKind: 'tcp',
            host,
            port,
          },
        });
      });
      socket.once('timeout', () => {
        socket.destroy();
        resolve({
          status: 'critical',
          latencyMs: Date.now() - startedAt,
          message: 'TCP health target timed out',
          details: {
            probeKind: 'tcp',
            host,
            port,
          },
        });
      });
      socket.once('error', (error) => {
        resolve({
          status: 'critical',
          latencyMs: Date.now() - startedAt,
          message: this.truncate(error.message, 180),
          details: {
            probeKind: 'tcp',
            host,
            port,
          },
        });
      });
    });
  }

  private resolveProbeTarget(outbound: DueOutboundRow): ProbeTarget {
    const config = this.asRecord(outbound.config);
    const timeoutMs = this.configIntegerFromValue(
      config.timeoutMs ?? config.healthTimeoutMs,
      this.configInteger('AFROWS_OUTBOUND_HEALTH_TIMEOUT_MS', 5000, 500, 30000),
      500,
      30000,
    );
    const healthUrl = this.firstString(config.healthUrl, config.url, config.targetUrl);

    if (healthUrl && this.isHttpUrl(healthUrl)) {
      return {
        kind: 'http',
        url: healthUrl,
        timeoutMs,
      };
    }

    // Prefer the real dial endpoint (address) over `host`, which for VLESS/proxy
    // configs is the HTTP/SNI obfuscation hostname, not the TCP target.
    const host = this.firstString(config.healthHost, config.address, config.host, config.targetHost);
    const port = this.configIntegerFromValue(config.healthPort ?? config.port ?? config.targetPort, 0, 1, 65535);

    if (host && port > 0) {
      return {
        kind: 'tcp',
        host,
        port,
        timeoutMs,
      };
    }

    return {
      kind: 'not_configured',
      timeoutMs,
    };
  }

  private async insertHealthCheck(outboundId: string, result: OutboundHealthCheckResult): Promise<number> {
    const queryResult = await this.database.query<{ id: number }>(
      `
        INSERT INTO outbound_health_checks (
          outbound_id, status, latency_ms, jitter_ms, packet_loss_percent, message, details
        )
        VALUES ($1, $2, $3, NULL, NULL, $4, $5::jsonb)
        RETURNING id
      `,
      [
        outboundId,
        result.status,
        result.latencyMs,
        result.message,
        JSON.stringify(result.details),
      ],
    );

    return queryResult.rows[0].id;
  }

  private async resolveEffectiveStatus(
    outbound: DueOutboundRow,
    latestStatus: OutboundCheckStatus,
  ): Promise<OutboundCheckStatus> {
    if (latestStatus === 'unknown') return 'unknown';
    if (latestStatus === 'degraded') return 'degraded';

    if (latestStatus === 'healthy') {
      if (outbound.healthStatus === 'critical' || outbound.healthStatus === 'degraded') {
        const healthyChecks = await this.countConsecutiveStatuses(outbound.id, ['healthy'], outbound.recoveryThreshold);
        return healthyChecks >= outbound.recoveryThreshold ? 'healthy' : 'degraded';
      }

      return 'healthy';
    }

    const failedChecks = await this.countConsecutiveStatuses(outbound.id, ['critical', 'degraded'], outbound.failThreshold);
    return failedChecks >= outbound.failThreshold ? 'critical' : 'degraded';
  }

  private async countConsecutiveStatuses(outboundId: string, statuses: string[], limit: number): Promise<number> {
    const result = await this.database.query<RecentHealthCheckRow>(
      `
        SELECT status
        FROM outbound_health_checks
        WHERE outbound_id = $1
        ORDER BY checked_at DESC, id DESC
        LIMIT $2
      `,
      [outboundId, limit],
    );

    let count = 0;
    for (const row of result.rows) {
      if (!statuses.includes(row.status)) break;
      count += 1;
    }

    return count;
  }

  private scanIntervalMs(): number {
    return this.configInteger('AFROWS_OUTBOUND_HEALTH_SCAN_INTERVAL_SECONDS', 10, 5, 3600) * 1000;
  }

  private batchSize(): number {
    return this.configInteger('AFROWS_OUTBOUND_HEALTH_BATCH_SIZE', 20, 1, 100);
  }

  private configInteger(name: string, fallback: number, minimum: number, maximum: number): number {
    return this.configIntegerFromValue(this.config.get<string>(name), fallback, minimum, maximum);
  }

  private configIntegerFromValue(value: unknown, fallback: number, minimum: number, maximum: number): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(parsed)) return fallback;
    return Math.min(Math.max(parsed, minimum), maximum);
  }

  private configFlag(name: string, fallback: boolean): boolean {
    const value = this.config.get<string>(name)?.trim().toLowerCase();
    if (!value) return fallback;
    return ['1', 'true', 'yes', 'on'].includes(value);
  }

  private firstString(...values: unknown[]): string | undefined {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) return value.trim();
    }

    return undefined;
  }

  private isHttpUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
  }
}
