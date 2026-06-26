import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import { DatabaseService } from '../database/database.service';
import { parseAccessLogLine } from './access-log-parse';

/**
 * F1 device/IP visibility: tails the xray access log and folds in WireGuard peer
 * endpoints, upserting per-(config, source IP) sightings. Flag-gated; no-ops in
 * dev (no DB / no log file). The WS path is behind nginx and logs 127.0.0.1, so
 * VLESS coverage here is direct-TCP only until a stream/proxy-protocol redesign.
 */
@Injectable()
export class XrayAccessLogService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(XrayAccessLogService.name);
  private timer: NodeJS.Timeout | undefined;
  private offset = 0;
  private running = false;

  constructor(private readonly config: ConfigService, private readonly database: DatabaseService) {}

  onModuleInit(): void {
    if (!process.env.DATABASE_URL) return;
    if (!this.flag('AFROWS_ACCESS_LOG_PARSER_ENABLED', true)) return;
    this.timer = setInterval(() => void this.tick(), this.intervalMs());
    this.timer.unref?.();
  }
  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); }

  private path(): string { return this.config.get<string>('AFROWS_XRAY_ACCESS_LOG')?.trim() || '/var/log/afrows-xray/access.log'; }
  private intervalMs(): number { const n = Number(this.config.get('AFROWS_ACCESS_LOG_INTERVAL_SECONDS')); return (Number.isInteger(n) ? Math.min(Math.max(n, 15), 600) : 30) * 1000; }
  private retentionDays(): number { const n = Number(this.config.get('AFROWS_DEVICE_SIGHTING_RETENTION_DAYS')); return Number.isInteger(n) ? Math.min(Math.max(n, 1), 90) : 7; }
  private flag(name: string, fb: boolean): boolean { const v = this.config.get<string>(name)?.trim().toLowerCase(); return v ? ['1', 'true', 'yes', 'on'].includes(v) : fb; }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.ingestAccessLog();
      await this.ingestWireguard();
      await this.prune();
    } catch (e) {
      this.logger.warn(`Access-log tick failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      this.running = false;
    }
  }

  private async ingestAccessLog(): Promise<void> {
    const file = this.path();
    let size: number;
    try { size = (await fsp.stat(file)).size; } catch { return; }
    if (size < this.offset) this.offset = 0; // rotation / copytruncate
    if (size === this.offset) return;
    const chunk = await this.readFrom(file, this.offset, size);
    this.offset = size;
    const seen = new Map<string, { configId: string; ip: string }>();
    for (const line of chunk.split('\n')) {
      const r = parseAccessLogLine(line);
      if (r) seen.set(`${r.configId}|${r.ip}`, r);
    }
    let upserts = 0;
    for (const { configId, ip } of seen.values()) {
      upserts += await this.upsert(configId, ip);
    }
    if (upserts) this.logger.log(`Device sightings (access log): upserted ${upserts}`);
  }

  private async ingestWireguard(): Promise<void> {
    // WG peers that handshook recently carry a real endpoint IP captured by the
    // root reconciler — fold them into the same sightings table.
    const res = await this.database
      .query<{ clientConfigId: string; endpointIp: string }>(
        `SELECT client_config_id AS "clientConfigId", endpoint_ip AS "endpointIp"
           FROM wireguard_peers
          WHERE endpoint_ip IS NOT NULL
            AND last_handshake_at IS NOT NULL
            AND last_handshake_at > now() - interval '10 minutes'`,
      )
      .catch(() => ({ rows: [] as Array<{ clientConfigId: string; endpointIp: string }> }));
    let upserts = 0;
    for (const row of res.rows) {
      if (row.endpointIp) upserts += await this.upsert(row.clientConfigId, row.endpointIp);
    }
    if (upserts) this.logger.log(`Device sightings (wireguard): upserted ${upserts}`);
  }

  private async upsert(configId: string, ip: string): Promise<number> {
    try {
      await this.database.query(
        `INSERT INTO client_device_sightings (client_config_id, source_ip)
           VALUES ($1, $2)
         ON CONFLICT (client_config_id, source_ip)
           DO UPDATE SET last_seen_at = now(), hits = client_device_sightings.hits + 1`,
        [configId, ip],
      );
      return 1;
    } catch {
      return 0; // unknown config id (FK) — ignore
    }
  }

  private async prune(): Promise<void> {
    await this.database
      .query(`DELETE FROM client_device_sightings WHERE last_seen_at < now() - ($1 || ' days')::interval`, [String(this.retentionDays())])
      .catch(() => undefined);
  }

  private readFrom(file: string, start: number, end: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      fs.createReadStream(file, { start, end: end - 1 })
        .on('data', (d) => chunks.push(d as Buffer))
        .on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
        .on('error', reject);
    });
  }
}
