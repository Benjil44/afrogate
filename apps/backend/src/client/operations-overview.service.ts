import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { statfs } from 'node:fs/promises';
import * as os from 'node:os';
import { promisify } from 'node:util';
import type { AdminOperationsOverview } from '@afrows/shared';

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

  constructor(private readonly config: ConfigService) {}

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

  private async inboundTrafficTotals(): Promise<{ up: number; down: number } | null> {
    try {
      const res = await execFileAsync(
        this.bin(),
        ['api', 'statsquery', `--server=${this.apiServer()}`, '-pattern', 'inbound>>>'],
        { timeout: 15000, maxBuffer: 8 * 1024 * 1024 },
      );
      const data = JSON.parse(res.stdout) as { stat?: Array<{ name?: string; value?: string }> };
      let up = 0;
      let down = 0;
      for (const entry of data.stat ?? []) {
        const name = typeof entry.name === 'string' ? entry.name : '';
        const m = name.match(/^inbound>>>(.+?)>>>traffic>>>(uplink|downlink)$/);
        if (!m || m[1] === 'api') continue; // exclude the internal api inbound
        const value = Number(entry.value ?? 0);
        if (!Number.isFinite(value)) continue;
        if (m[2] === 'uplink') up += value;
        else down += value;
      }
      return { up, down };
    } catch {
      return null;
    }
  }

  private async onlineUsers(): Promise<number> {
    try {
      const res = await execFileAsync(
        this.bin(),
        ['api', 'statsgetallonlineusers', `--server=${this.apiServer()}`],
        { timeout: 15000, maxBuffer: 8 * 1024 * 1024 },
      );
      const data = JSON.parse(res.stdout) as Record<string, unknown>;
      const users = (data.users ?? data) as Record<string, unknown>;
      return users && typeof users === 'object' ? Object.keys(users).length : 0;
    } catch {
      return 0;
    }
  }

  private bin(): string {
    return this.config.get<string>('AFROWS_XRAY_BIN')?.trim() || 'xray';
  }
  private apiServer(): string {
    return this.config.get<string>('AFROWS_XRAY_API_SERVER')?.trim() || '127.0.0.1:10085';
  }
}
