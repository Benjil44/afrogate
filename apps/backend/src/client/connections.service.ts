import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import type { AdminConnectionSummary } from '@afrows/shared';
import { DatabaseService } from '../database/database.service';

const execFileAsync = promisify(execFile);

interface ClientConfigRow {
  id: string;
  usedBytes: number;
  status: string;
  customerName: string | null;
}

/**
 * Unified "Connections" view: every live client across all xray inbounds — the
 * VLESS customer devices (joined to their customer account + usage) and the
 * WireGuard peers (e.g. the MikroTik gateway) — each tagged with its protocol,
 * traffic, and online status. Box-coupled; available:false in dev.
 */
@Injectable()
export class ConnectionsService {
  private readonly logger = new Logger(ConnectionsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
  ) {}

  async listConnections(): Promise<{ connections: AdminConnectionSummary[]; available: boolean }> {
    const cfg = await this.readConfig();
    if (!cfg || !Array.isArray(cfg.inbounds)) return { connections: [], available: false };

    const [online, clientMap, inboundTraffic] = await Promise.all([
      this.onlineEmails(),
      this.clientConfigMap(),
      this.inboundTraffic(),
    ]);

    const connections: AdminConnectionSummary[] = [];

    for (const ib of cfg.inbounds as Array<Record<string, unknown>>) {
      const protocol = String(ib.protocol ?? '');
      if (protocol === 'dokodemo-door') continue;
      const tag = String(ib.tag ?? '');
      const ss = (ib.streamSettings as Record<string, unknown>) ?? {};
      const network = typeof ss.network === 'string' ? ss.network : 'tcp';
      const settings = (ib.settings as Record<string, unknown>) ?? {};

      if (protocol === 'wireguard') {
        const peers = Array.isArray(settings.peers) ? (settings.peers as Array<Record<string, unknown>>) : [];
        const t = inboundTraffic.get(tag) ?? { up: 0, down: 0 };
        for (const peer of peers) {
          const allowed = Array.isArray(peer.allowedIPs) ? peer.allowedIPs.join(', ') : '';
          const pub = String(peer.publicKey ?? '');
          connections.push({
            id: pub || `${tag}-peer`,
            label: allowed ? `WireGuard • ${allowed}` : 'WireGuard peer',
            protocol: 'wireguard',
            transport: 'wireguard',
            inboundTag: tag,
            customerName: null,
            status: null,
            online: t.up + t.down > 0, // proxy: tunnel has carried traffic
            usedBytes: t.up + t.down,
          });
        }
        continue;
      }

      // VLESS / other client-based inbounds
      const clients = Array.isArray(settings.clients) ? (settings.clients as Array<Record<string, unknown>>) : [];
      for (const client of clients) {
        const email = typeof client.email === 'string' ? client.email : '';
        const ccId = this.clientConfigId(email);
        const row = ccId ? clientMap.get(ccId) : undefined;
        connections.push({
          id: email || String(client.id ?? ''),
          label: row?.customerName || email || String(client.id ?? '').slice(0, 8),
          protocol: protocol || 'vless',
          transport: network,
          inboundTag: tag,
          customerName: row?.customerName ?? null,
          status: row?.status ?? null,
          online: email ? online.has(email) : false,
          usedBytes: row?.usedBytes ?? 0,
        });
      }
    }

    return { connections, available: true };
  }

  private clientConfigId(email: string): string | null {
    const m = email.match(/^cc_(.+?)@afrows$/);
    return m ? m[1] : null;
  }

  private async clientConfigMap(): Promise<Map<string, ClientConfigRow>> {
    const map = new Map<string, ClientConfigRow>();
    try {
      const res = await this.database.query<{
        id: string;
        usedBytes: string | number;
        status: string;
        customerName: string | null;
      }>(
        `
          SELECT cc.id, cc.used_bytes AS "usedBytes", cc.status,
                 ca.display_name AS "customerName"
          FROM client_configs cc
          JOIN customer_accounts ca ON ca.id = cc.customer_account_id
        `,
      );
      for (const r of res.rows) {
        map.set(r.id, {
          id: r.id,
          usedBytes: Number(r.usedBytes ?? 0),
          status: r.status,
          customerName: r.customerName,
        });
      }
    } catch {
      /* DB unavailable */
    }
    return map;
  }

  private async onlineEmails(): Promise<Set<string>> {
    try {
      const res = await execFileAsync(
        this.bin(),
        ['api', 'statsgetallonlineusers', `--server=${this.apiServer()}`],
        { timeout: 15000, maxBuffer: 8 * 1024 * 1024 },
      );
      const data = JSON.parse(res.stdout) as Record<string, unknown>;
      const users = (data.users ?? data) as Record<string, unknown>;
      return new Set(users && typeof users === 'object' ? Object.keys(users) : []);
    } catch {
      return new Set();
    }
  }

  private async inboundTraffic(): Promise<Map<string, { up: number; down: number }>> {
    const map = new Map<string, { up: number; down: number }>();
    try {
      const res = await execFileAsync(
        this.bin(),
        ['api', 'statsquery', `--server=${this.apiServer()}`, '-pattern', 'inbound>>>'],
        { timeout: 15000, maxBuffer: 8 * 1024 * 1024 },
      );
      const data = JSON.parse(res.stdout) as { stat?: Array<{ name?: string; value?: string }> };
      for (const entry of data.stat ?? []) {
        const name = typeof entry.name === 'string' ? entry.name : '';
        const m = name.match(/^inbound>>>(.+?)>>>traffic>>>(uplink|downlink)$/);
        if (!m) continue;
        const value = Number(entry.value ?? 0);
        if (!Number.isFinite(value)) continue;
        const cur = map.get(m[1]) ?? { up: 0, down: 0 };
        if (m[2] === 'uplink') cur.up += value;
        else cur.down += value;
        map.set(m[1], cur);
      }
    } catch {
      /* xray unavailable */
    }
    return map;
  }

  private async readConfig(): Promise<{ inbounds?: unknown[] } | null> {
    const path =
      this.config.get<string>('AFROWS_XRAY_CONFIG_PATH')?.trim() || '/usr/local/etc/afrows-xray/config.json';
    try {
      return JSON.parse(await readFile(path, 'utf8'));
    } catch {
      return null;
    }
  }

  private bin(): string {
    return this.config.get<string>('AFROWS_XRAY_BIN')?.trim() || 'xray';
  }
  private apiServer(): string {
    return this.config.get<string>('AFROWS_XRAY_API_SERVER')?.trim() || '127.0.0.1:10085';
  }
}
