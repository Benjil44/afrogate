import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { DatabaseService } from '../database/database.service';
import { buildXraySpeedTestConfig } from './outbound-xray-config';

const execFileAsync = promisify(execFile);

interface RequestedOutboundRow {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown> | null;
}

interface LatencySample {
  latencyMs: number | null;
  jitterMs: number | null;
  packetLossPercent: number;
  status: 'healthy' | 'degraded' | 'critical';
}

interface ThroughputResult {
  downMbps: number | null;
  upMbps: number | null;
  message: string;
}

/**
 * Backend-on-box speed-test engine. Because backend, Postgres and the xray
 * binary all run on the same host, this picks up outbounds flagged with
 * `speed_test_requested_at` (set on-demand by the dashboard or by the auto
 * scheduler), measures TCP latency/jitter to the outbound endpoint, and
 * measures download/upload throughput by spinning up a throwaway xray SOCKS
 * proxy bound to the outbound and transferring a fixed payload through it.
 */
@Injectable()
export class OutboundSpeedTestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboundSpeedTestService.name);
  private timer: NodeJS.Timeout | undefined;
  private isRunning = false;

  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
  ) {}

  onModuleInit(): void {
    if (!process.env.DATABASE_URL) return;
    if (!this.configFlag('AFROWS_OUTBOUND_SPEEDTEST_ENABLED', true)) return;

    this.timer = setInterval(() => void this.tick(), this.scanIntervalMs());
    this.timer.unref?.();
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      await this.autoRequestDueTests();
      const requested = await this.listRequested(this.maxPerTick());
      for (const outbound of requested) {
        await this.runSpeedTest(outbound);
      }
    } catch (error) {
      this.logger.warn(error instanceof Error ? error.message : 'Speed-test tick failed');
    } finally {
      this.isRunning = false;
    }
  }

  /** T7: when Auto is on, flag enabled outbounds whose interval has elapsed. */
  private async autoRequestDueTests(): Promise<void> {
    await this.database.query(
      `
        UPDATE outbounds o
        SET speed_test_requested_at = now()
        FROM outbound_test_settings s
        WHERE s.id = true
          AND s.auto_enabled = true
          AND o.enabled = true
          AND o.maintenance_mode = false
          AND o.speed_test_requested_at IS NULL
          AND (
            o.last_speed_test_at IS NULL
            OR o.last_speed_test_at <= now() - (s.interval_seconds * interval '1 second')
          )
      `,
    );
  }

  private async listRequested(limit: number): Promise<RequestedOutboundRow[]> {
    const result = await this.database.query<RequestedOutboundRow>(
      `
        SELECT id, name, type, config
        FROM outbounds
        WHERE speed_test_requested_at IS NOT NULL
        ORDER BY speed_test_requested_at ASC, priority ASC
        LIMIT $1
      `,
      [limit],
    );
    return result.rows;
  }

  private async runSpeedTest(outbound: RequestedOutboundRow): Promise<void> {
    const config = this.asRecord(outbound.config);
    let latency: LatencySample = { latencyMs: null, jitterMs: null, packetLossPercent: 100, status: 'critical' };
    let throughput: ThroughputResult = { downMbps: null, upMbps: null, message: 'not run' };

    try {
      latency = await this.measureLatency(config);
      if (outbound.type === 'vless-local-proxy' && latency.status !== 'critical') {
        throughput = await this.measureThroughput(outbound.name, config);
      } else if (outbound.type !== 'vless-local-proxy') {
        throughput = { downMbps: null, upMbps: null, message: `throughput not supported for ${outbound.type}` };
      } else {
        throughput = { downMbps: null, upMbps: null, message: 'endpoint unreachable; skipped throughput' };
      }
    } catch (error) {
      this.logger.warn(`Speed test for ${outbound.name} failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      await this.persist(outbound.id, latency, throughput);
    }

    this.logger.log(
      `Speed test ${outbound.name}: ${latency.status} ping=${latency.latencyMs ?? '—'}ms ` +
        `jitter=${latency.jitterMs ?? '—'}ms down=${throughput.downMbps ?? '—'}Mbps up=${throughput.upMbps ?? '—'}Mbps`,
    );
  }

  private async persist(id: string, latency: LatencySample, throughput: ThroughputResult): Promise<void> {
    await this.database.query(
      `
        INSERT INTO outbound_health_checks (outbound_id, status, latency_ms, jitter_ms, packet_loss_percent, message, details)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      `,
      [
        id,
        latency.status,
        latency.latencyMs,
        latency.jitterMs,
        latency.packetLossPercent,
        throughput.message,
        JSON.stringify({ probeKind: 'speed_test', downMbps: throughput.downMbps, upMbps: throughput.upMbps }),
      ],
    );

    await this.database.query(
      `
        UPDATE outbounds
        SET latest_down_mbps = $2,
            latest_up_mbps = $3,
            last_speed_test_at = now(),
            speed_test_requested_at = NULL,
            last_checked_at = now(),
            health_status = $4,
            last_healthy_at = CASE WHEN $4 = 'healthy' THEN now() ELSE last_healthy_at END,
            updated_at = now()
        WHERE id = $1
      `,
      [id, throughput.downMbps, throughput.upMbps, latency.status],
    );
  }

  // ---- latency / jitter (direct TCP connect to the outbound endpoint) ----

  private async measureLatency(config: Record<string, unknown>): Promise<LatencySample> {
    const host = this.firstString(config.address, config.host);
    const port = this.toPort(config.port);
    if (!host || !port) {
      return { latencyMs: null, jitterMs: null, packetLossPercent: 100, status: 'critical' };
    }

    const count = this.configInteger('AFROWS_OUTBOUND_SPEEDTEST_PING_COUNT', 4, 1, 10);
    const timeoutMs = this.configInteger('AFROWS_OUTBOUND_SPEEDTEST_PING_TIMEOUT_MS', 4000, 500, 20000);
    const samples: number[] = [];

    for (let i = 0; i < count; i += 1) {
      const ms = await this.tcpConnectMs(host, port, timeoutMs);
      if (ms !== null) samples.push(ms);
    }

    const loss = Math.round(((count - samples.length) / count) * 100);
    if (samples.length === 0) {
      return { latencyMs: null, jitterMs: null, packetLossPercent: 100, status: 'critical' };
    }

    const latencyMs = Math.round((samples.reduce((a, b) => a + b, 0) / samples.length) * 100) / 100;
    const jitterMs = this.jitter(samples);
    const status: LatencySample['status'] = loss === 0 ? 'healthy' : loss < 50 ? 'degraded' : 'critical';
    return { latencyMs, jitterMs, packetLossPercent: loss, status };
  }

  private tcpConnectMs(host: string, port: number, timeoutMs: number): Promise<number | null> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      const socket = net.createConnection({ host, port });
      let settled = false;
      const done = (value: number | null) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(value);
      };
      socket.setTimeout(timeoutMs);
      socket.once('connect', () => done(Number(process.hrtime.bigint() - start) / 1e6));
      socket.once('timeout', () => done(null));
      socket.once('error', () => done(null));
    });
  }

  private jitter(samples: number[]): number {
    if (samples.length < 2) return 0;
    const deltas = samples.slice(1).map((v, i) => Math.abs(v - samples[i]));
    return Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 100) / 100;
  }

  // ---- throughput (download/upload through a throwaway xray SOCKS proxy) ----

  private async measureThroughput(name: string, config: Record<string, unknown>): Promise<ThroughputResult> {
    const xrayBin = this.config.get<string>('AFROWS_OUTBOUND_XRAY_BIN')?.trim() || 'xray';
    const socksPort = await this.freePort();
    const xrayConfig = buildXraySpeedTestConfig(config, socksPort);
    const tmpFile = path.join(os.tmpdir(), `afrows-xray-${socksPort}.json`);
    await fs.writeFile(tmpFile, JSON.stringify(xrayConfig), 'utf8');

    const child = spawn(xrayBin, ['run', '-config', tmpFile], { stdio: 'ignore' });
    let spawnError: Error | null = null;
    child.once('error', (err) => {
      spawnError = err;
    });

    try {
      const ready = await this.waitForPort('127.0.0.1', socksPort, 6000);
      if (spawnError) return { downMbps: null, upMbps: null, message: `xray failed to start: ${(spawnError as Error).message}` };
      if (!ready) return { downMbps: null, upMbps: null, message: 'xray SOCKS port did not open' };

      const downMbps = await this.curlSpeed('download', socksPort);
      const upMbps = await this.curlSpeed('upload', socksPort);
      const parts: string[] = [];
      if (downMbps === null) parts.push('download unreachable through outbound');
      if (upMbps === null) parts.push('upload unreachable through outbound');
      return { downMbps, upMbps, message: parts.length ? parts.join('; ') : 'ok' };
    } finally {
      child.kill('SIGKILL');
      await fs.rm(tmpFile, { force: true }).catch(() => undefined);
    }
  }

  private async curlSpeed(kind: 'download' | 'upload', socksPort: number): Promise<number | null> {
    const proxy = `socks5h://127.0.0.1:${socksPort}`;
    const maxTime = this.configInteger('AFROWS_OUTBOUND_SPEEDTEST_MAX_SECONDS', 25, 5, 120);
    const downUrl =
      this.config.get<string>('AFROWS_OUTBOUND_SPEEDTEST_DOWN_URL')?.trim() ||
      'https://speed.cloudflare.com/__down?bytes=10000000';
    const upUrl =
      this.config.get<string>('AFROWS_OUTBOUND_SPEEDTEST_UP_URL')?.trim() ||
      'https://speed.cloudflare.com/__up';
    const upBytes = this.configInteger('AFROWS_OUTBOUND_SPEEDTEST_UP_BYTES', 5_000_000, 100_000, 50_000_000);

    const baseArgs = ['-s', '-o', '/dev/null', '--max-time', String(maxTime), '-x', proxy];
    let args: string[];
    let cleanup: (() => Promise<void>) | undefined;

    if (kind === 'download') {
      args = [...baseArgs, '-w', '%{speed_download}', downUrl];
    } else {
      const upFile = path.join(os.tmpdir(), `afrows-up-${socksPort}.bin`);
      await fs.writeFile(upFile, Buffer.alloc(upBytes));
      cleanup = () => fs.rm(upFile, { force: true }).catch(() => undefined);
      args = [...baseArgs, '-X', 'POST', '--data-binary', `@${upFile}`, '-w', '%{speed_upload}', upUrl];
    }

    try {
      const { stdout } = await execFileAsync('curl', args, {
        timeout: (maxTime + 5) * 1000,
        env: { ...process.env, LC_ALL: 'C' },
      });
      const bytesPerSec = Number(String(stdout).trim());
      if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return null;
      return Math.round(((bytesPerSec * 8) / 1_000_000) * 100) / 100;
    } catch {
      return null;
    } finally {
      if (cleanup) await cleanup();
    }
  }

  private waitForPort(host: string, port: number, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    const attempt = (): Promise<boolean> =>
      new Promise((resolve) => {
        const socket = net.createConnection({ host, port });
        socket.setTimeout(500);
        socket.once('connect', () => {
          socket.destroy();
          resolve(true);
        });
        const fail = () => {
          socket.destroy();
          resolve(false);
        };
        socket.once('timeout', fail);
        socket.once('error', fail);
      });

    const loop = async (): Promise<boolean> => {
      while (Date.now() < deadline) {
        if (await attempt()) return true;
        await new Promise((r) => setTimeout(r, 250));
      }
      return false;
    };
    return loop();
  }

  private freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.unref();
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        server.close(() => resolve(port));
      });
    });
  }

  // ---- helpers ----

  private scanIntervalMs(): number {
    return this.configInteger('AFROWS_OUTBOUND_SPEEDTEST_SCAN_INTERVAL_SECONDS', 20, 5, 3600) * 1000;
  }

  private maxPerTick(): number {
    return this.configInteger('AFROWS_OUTBOUND_SPEEDTEST_MAX_PER_TICK', 2, 1, 10);
  }

  private toPort(value: unknown): number | undefined {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isInteger(n) && n > 0 && n <= 65535 ? n : undefined;
  }

  private firstString(...values: unknown[]): string | undefined {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return undefined;
  }

  private configInteger(name: string, fallback: number, minimum: number, maximum: number): number {
    const raw = this.config.get<string>(name);
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isInteger(parsed)) return fallback;
    return Math.min(Math.max(parsed, minimum), maximum);
  }

  private configFlag(name: string, fallback: boolean): boolean {
    const value = this.config.get<string>(name)?.trim().toLowerCase();
    if (!value) return fallback;
    return ['1', 'true', 'yes', 'on'].includes(value);
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
