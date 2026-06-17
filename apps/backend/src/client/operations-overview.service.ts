import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { statfs } from 'node:fs/promises';
import * as os from 'node:os';
import { promisify } from 'node:util';
import type { AdminOperationsOverview } from '@afrows/shared';
import { DatabaseService } from '../database/database.service';

const execFileAsync = promisify(execFile);

/**
 * Single-box operations metrics for the dashboard: the box's own CPU/RAM/disk
 * (this backend runs on the box, no agent fleet needed) plus active users and
 * traffic (totals + live rate) from the xray stats API. Degrades gracefully in
 * dev (returns available:false with nulls/zeros).
 */
@Injectable()
export class OperationsOverviewService {
  private readonly logger = new Logger(OperationsOverviewService.name);
  private lastSample: { ts: number; up: number; down: number } | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
  ) {}

  async getOverview(): Promise<AdminOperationsOverview> {
    const [cpu, mem, disk, traffic, activeUsers] = await Promise.all([
      this.cpuPercent(),
      Promise.resolve(this.memPercent()),
      this.diskFreePercent(),
      this.inboundTrafficTotals(),
      this.onlineUsers(),
    ]);

    let downloadBps = 0;
    let uploadBps = 0;
    if (traffic) {
      const now = Date.now();
      if (this.lastSample) {
        const elapsed = (now - this.lastSample.ts) / 1000;
        if (elapsed > 0) {
          downloadBps = Math.max(0, (traffic.down - this.lastSample.down) / elapsed);
          uploadBps = Math.max(0, (traffic.up - this.lastSample.up) / elapsed);
        }
      }
      this.lastSample = { ts: now, up: traffic.up, down: traffic.down };
    }

    return {
      available: traffic !== null || disk !== null,
      cpuPercent: cpu,
      memPercent: mem,
      diskFreePercent: disk,
      activeUsers,
      downloadBps,
      uploadBps,
      downloadTotalBytes: traffic?.down ?? 0,
      uploadTotalBytes: traffic?.up ?? 0,
    };
  }

  private memPercent(): number {
    const total = os.totalmem();
    if (!total) return 0;
    return ((total - os.freemem()) / total) * 100;
  }

  /** CPU busy % sampled over a short window from /proc via os.cpus(). */
  private async cpuPercent(): Promise<number | null> {
    const a = this.cpuTimes();
    await new Promise((r) => setTimeout(r, 200));
    const b = this.cpuTimes();
    const idle = b.idle - a.idle;
    const total = b.total - a.total;
    if (total <= 0) return null;
    return Math.min(100, Math.max(0, (1 - idle / total) * 100));
  }

  private cpuTimes(): { idle: number; total: number } {
    let idle = 0;
    let total = 0;
    for (const cpu of os.cpus()) {
      for (const t of Object.values(cpu.times)) total += t;
      idle += cpu.times.idle;
    }
    return { idle, total };
  }

  private async diskFreePercent(): Promise<number | null> {
    try {
      const fsRoot = this.config.get<string>('AFROWS_DISK_PATH')?.trim() || '/';
      const s = await statfs(fsRoot);
      if (!s.blocks) return null;
      return (Number(s.bavail) / Number(s.blocks)) * 100;
    } catch {
      return null;
    }
  }

  /** Sum inbound traffic across all xray instances (afrows-xray VLESS + afrows-wg
   * WireGuard), so WireGuard traffic shows on the dashboard too. */
  private async inboundTrafficTotals(): Promise<{ up: number; down: number } | null> {
    let up = 0;
    let down = 0;
    let any = false;
    for (const server of this.apiServers()) {
      try {
        const res = await execFileAsync(
          this.bin(),
          ['api', 'statsquery', `--server=${server}`, '-pattern', 'inbound>>>'],
          { timeout: 15000, maxBuffer: 8 * 1024 * 1024 },
        );
        const data = JSON.parse(res.stdout) as { stat?: Array<{ name?: string; value?: string }> };
        for (const entry of data.stat ?? []) {
          const m = (entry.name ?? '').match(/^inbound>>>(.+?)>>>traffic>>>(uplink|downlink)$/);
          if (!m || m[1] === 'api') continue; // exclude the internal api inbound
          const value = Number(entry.value ?? 0);
          if (!Number.isFinite(value)) continue;
          if (m[2] === 'uplink') up += value;
          else down += value;
        }
        any = true;
      } catch {
        /* this xray instance unavailable */
      }
    }
    return any ? { up, down } : null;
  }

  /** All xray api endpoints to aggregate: the VLESS service + the WireGuard service. */
  private apiServers(): string[] {
    const main = this.apiServer();
    const wg = this.config.get<string>('AFROWS_WG_API_SERVER')?.trim() || '127.0.0.1:10086';
    return wg && wg !== main ? [main, wg] : [main];
  }

  /**
   * Active users = distinct users currently using a protocol: anyone with an
   * open connection (statsgetallonlineusers) OR with traffic in the current
   * metering window (user>>> counters, reset ~every 60s). The union makes the
   * count reflect real usage even when online-IP tracking hasn't registered.
   */
  private async onlineUsers(): Promise<number> {
    const active = new Set<string>();

    // 1) open connections
    try {
      const res = await execFileAsync(
        this.bin(),
        ['api', 'statsgetallonlineusers', `--server=${this.apiServer()}`],
        { timeout: 15000, maxBuffer: 8 * 1024 * 1024 },
      );
      const data = JSON.parse(res.stdout) as { users?: unknown };
      const users = data.users ?? data;
      if (Array.isArray(users)) {
        for (const name of users) {
          const m = String(name).match(/^user>>>(.+?)>>>online$/);
          if (m) active.add(m[1]);
        }
      } else if (users && typeof users === 'object') {
        for (const key of Object.keys(users as Record<string, unknown>)) active.add(key);
      }
    } catch {
      /* xray/api unavailable */
    }

    // 2) users with traffic in the current window (used the protocol recently)
    try {
      const res = await execFileAsync(
        this.bin(),
        ['api', 'statsquery', `--server=${this.apiServer()}`, '-pattern', 'user>>>'],
        { timeout: 15000, maxBuffer: 8 * 1024 * 1024 },
      );
      const data = JSON.parse(res.stdout) as { stat?: Array<{ name?: string; value?: string }> };
      for (const entry of data.stat ?? []) {
        const m = (entry.name ?? '').match(/^user>>>(.+?)>>>traffic>>>(?:uplink|downlink)$/);
        if (!m) continue;
        if (Number(entry.value ?? 0) > 0) active.add(m[1]);
      }
    } catch {
      /* xray/api unavailable */
    }

    // 3) active WireGuard peers (kernel wg0 isn't in xray stats): a peer with a
    // handshake in the last ~3 min = an active user. Keyed by account so a
    // customer isn't double-counted across their WG peers.
    try {
      const res = await this.database.query<{ accountId: string }>(
        `
          SELECT DISTINCT cc.customer_account_id AS "accountId"
          FROM wireguard_peers wp
          JOIN client_configs cc ON cc.id = wp.client_config_id
          WHERE wp.desired_state = 'present'
            AND wp.last_handshake_at IS NOT NULL
            AND wp.last_handshake_at > now() - interval '180 seconds'
        `,
      );
      for (const row of res.rows) active.add(`wg:${row.accountId}`);
    } catch {
      /* DB unavailable (dev) */
    }

    return active.size;
  }

  private bin(): string {
    return this.config.get<string>('AFROWS_XRAY_BIN')?.trim() || 'xray';
  }
  private apiServer(): string {
    return this.config.get<string>('AFROWS_XRAY_API_SERVER')?.trim() || '127.0.0.1:10085';
  }
}
