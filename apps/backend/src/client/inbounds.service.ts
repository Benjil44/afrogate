import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import type { AdminEgressHealth, AdminInboundSummary, AdminNetworkOverviewResponse } from '@afrows/shared';

const execFileAsync = promisify(execFile);

interface InboundTraffic {
  up: number;
  down: number;
}

/**
 * Reads the box's native xray inbounds (the entry "doors" users connect to:
 * afrows-in WS+TLS, afrows-in-tcp telewebion, etc.) from the afrows-xray config
 * file, enriched with per-inbound traffic from the xray stats API. Box-coupled;
 * returns an empty/unavailable result in dev (no config file / no xray).
 */
@Injectable()
export class InboundsService {
  private readonly logger = new Logger(InboundsService.name);

  constructor(private readonly config: ConfigService) {}

  async listInbounds(): Promise<{ inbounds: AdminInboundSummary[]; available: boolean }> {
    const cfg = await this.readConfig();
    if (!cfg || !Array.isArray(cfg.inbounds)) return { inbounds: [], available: false };

    const traffic = await this.inboundTraffic();
    const inbounds: AdminInboundSummary[] = [];

    for (const ib of cfg.inbounds as Array<Record<string, unknown>>) {
      const protocol = String(ib.protocol ?? '');
      if (protocol === 'dokodemo-door') continue; // the internal xray api inbound
      const tag = String(ib.tag ?? '');
      const ss = (ib.streamSettings as Record<string, unknown>) ?? {};
      const t = traffic.get(tag) ?? { up: 0, down: 0 };
      const clients = (ib.settings as { clients?: unknown[] } | undefined)?.clients;
      inbounds.push({
        tag,
        protocol,
        listen: typeof ib.listen === 'string' ? ib.listen : '0.0.0.0',
        port: Number(ib.port ?? 0),
        network: this.str(ss.network) || 'tcp',
        security: this.str(ss.security) || 'none',
        host: this.extractHost(ss),
        path: this.extractPath(ss),
        sni: this.extractSni(ss),
        clientCount: Array.isArray(clients) ? clients.length : 0,
        uplinkBytes: t.up,
        downlinkBytes: t.down,
      });
    }

    return { inbounds, available: true };
  }

  private extractHost(ss: Record<string, unknown>): string | null {
    const ws = ss.wsSettings as { headers?: { Host?: string }; host?: string } | undefined;
    if (ws?.headers?.Host) return ws.headers.Host;
    if (ws?.host) return ws.host;
    const tcp = ss.tcpSettings as
      | { header?: { request?: { headers?: { Host?: string[] | string } } } }
      | undefined;
    const h = tcp?.header?.request?.headers?.Host;
    if (Array.isArray(h)) return h[0] ?? null;
    if (typeof h === 'string') return h;
    return null;
  }

  private extractPath(ss: Record<string, unknown>): string | null {
    const ws = ss.wsSettings as { path?: string } | undefined;
    const http = ss.httpSettings as { path?: string } | undefined;
    return ws?.path ?? http?.path ?? null;
  }

  private extractSni(ss: Record<string, unknown>): string | null {
    const reality = ss.realitySettings as { serverNames?: string[] } | undefined;
    if (reality?.serverNames?.length) return reality.serverNames[0];
    const tls = ss.tlsSettings as { serverName?: string } | undefined;
    return tls?.serverName ?? null;
  }

  private str(v: unknown): string {
    return typeof v === 'string' ? v : '';
  }

  /** G1: the outbound tag the client catch-all routing rule currently targets. */
  async networkOverview(): Promise<AdminNetworkOverviewResponse> {
    const cfg = (await this.readConfig()) as
      | { routing?: { rules?: Array<{ inboundTag?: string[]; outboundTag?: string }> } }
      | null;
    const rules = cfg?.routing?.rules ?? [];
    const rule = rules.find(
      (r) => Array.isArray(r.inboundTag) && r.inboundTag.includes('afrows-in') && Boolean(r.outboundTag),
    );
    return { appliedCatchAll: rule?.outboundTag ?? null, egressHealth: await this.egressHealth() };
  }

  /** Read the reconciler's egress-health snapshot (which uplinks are up). */
  async egressHealth(): Promise<AdminEgressHealth | null> {
    const path =
      this.config.get<string>('AFROWS_EGRESS_HEALTH_PATH')?.trim() || '/var/lib/afrows/egress-health.json';
    try {
      const raw = JSON.parse(await readFile(path, 'utf8')) as Partial<AdminEgressHealth>;
      return {
        starlinkUp: Boolean(raw.starlinkUp),
        germanyUp: Boolean(raw.germanyUp),
        appliedCatchAll: typeof raw.appliedCatchAll === 'string' ? raw.appliedCatchAll : null,
        gamingOutbound: typeof raw.gamingOutbound === 'string' ? raw.gamingOutbound : null,
        mode: typeof raw.mode === 'string' ? raw.mode : null,
        updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
      };
    } catch {
      return null;
    }
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

  private async inboundTraffic(): Promise<Map<string, InboundTraffic>> {
    const map = new Map<string, InboundTraffic>();
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
      /* xray/api unavailable (dev) — traffic stays 0 */
    }
    return map;
  }

  private bin(): string {
    return this.config.get<string>('AFROWS_XRAY_BIN')?.trim() || 'xray';
  }
  private apiServer(): string {
    return this.config.get<string>('AFROWS_XRAY_API_SERVER')?.trim() || '127.0.0.1:10085';
  }
}
