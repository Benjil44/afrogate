import { Injectable, NotFoundException } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import type {
  AdminRouterConnectConfigResponse,
  AdminRouterCredentialResponse,
  AdminRouterModemActionResponse,
  AdminRouterMutationResponse,
  AdminRouterStatusResponse,
  AdminRouterUsageChartsResponse,
  AdminRouterWgUsageResponse,
  AdminRoutersResponse,
  MikroTikMode,
  MikroTikWgUsage,
  MikroTikRouterStatus,
  MikroTikRouterSummary,
  MikroTikWan,
  MikroTikWgPeer,
} from '@afrows/shared';
import { DatabaseService } from '../database/database.service';
import { SecretVaultService } from '../security/secret-vault.service';
import { MikroTikClientService, type MikroTikTarget } from './mikrotik-client.service';
import type { CreateMikroTikRouterDto, UpdateMikroTikRouterDto } from './dto/router.dto';

interface RouterRow {
  id: string;
  label: string;
  kind: string;
  host: string;
  rest_port: number;
  rest_user: string;
  rest_password_enc: string | null;
  webfig_url: string | null;
  gaming_source_ip: string | null;
  gaming_enabled: boolean;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class RoutersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly vault: SecretVaultService,
    private readonly client: MikroTikClientService,
  ) {}

  async listRouters(): Promise<AdminRoutersResponse> {
    const rows = await this.allRows();
    const routers = await Promise.all(
      rows.map(async (row) => {
        const probe = await this.probe(row);
        return this.toSummary(row, probe);
      }),
    );
    return { routers };
  }

  async getStatus(id: string): Promise<AdminRouterStatusResponse> {
    const row = await this.requireRow(id);
    const status = await this.buildStatus(row);
    return { status };
  }

  async create(dto: CreateMikroTikRouterDto): Promise<AdminRouterMutationResponse> {
    const enc = dto.password ? this.encrypt(dto.id, dto.password) : null;
    const result = await this.database.query<RouterRow>(
      `INSERT INTO mikrotik_routers
         (id, label, kind, host, rest_port, rest_user, rest_password_enc, webfig_url, gaming_source_ip, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        dto.id,
        dto.label,
        dto.kind ?? 'other',
        dto.host,
        dto.restPort ?? 80,
        dto.restUser ?? 'claude',
        enc,
        dto.webfigUrl ?? null,
        dto.gamingSourceIp ?? null,
        dto.notes ?? null,
      ],
    );
    return { router: this.toSummary(result.rows[0], { online: false, mode: this.modeOf(result.rows[0]) }) };
  }

  async update(id: string, dto: UpdateMikroTikRouterDto): Promise<AdminRouterMutationResponse> {
    const existing = await this.requireRow(id);
    const sets: string[] = [];
    const values: unknown[] = [];
    const set = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };

    if (dto.label !== undefined) set('label', dto.label);
    if (dto.kind !== undefined) set('kind', dto.kind);
    if (dto.host !== undefined) set('host', dto.host);
    if (dto.restPort !== undefined) set('rest_port', dto.restPort);
    if (dto.restUser !== undefined) set('rest_user', dto.restUser);
    if (dto.webfigUrl !== undefined) set('webfig_url', dto.webfigUrl);
    if (dto.gamingSourceIp !== undefined) set('gaming_source_ip', dto.gamingSourceIp);
    if (dto.notes !== undefined) set('notes', dto.notes);
    if (dto.password !== undefined) {
      set('rest_password_enc', dto.password ? this.encrypt(id, dto.password) : null);
    }

    if (sets.length === 0) {
      return { router: this.toSummary(existing, { online: false, mode: this.modeOf(existing) }) };
    }

    values.push(id);
    const result = await this.database.query<RouterRow>(
      `UPDATE mikrotik_routers SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
      values,
    );
    return { router: this.toSummary(result.rows[0], { online: false, mode: this.modeOf(result.rows[0]) }) };
  }

  async remove(id: string): Promise<{ removed: boolean }> {
    const result = await this.database.query(`DELETE FROM mikrotik_routers WHERE id = $1`, [id]);
    if (!result.rowCount) throw new NotFoundException(`Router ${id} not found`);
    return { removed: true };
  }

  async setMode(id: string, mode: MikroTikMode): Promise<AdminRouterMutationResponse> {
    const row = await this.requireRow(id);
    const result = await this.database.query<RouterRow>(
      `UPDATE mikrotik_routers SET gaming_enabled = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [mode === 'game', row.id],
    );
    this.triggerEgressModeSync();
    return { router: this.toSummary(result.rows[0], { online: false, mode }) };
  }

  async revealCredential(id: string): Promise<AdminRouterCredentialResponse> {
    const row = await this.requireRow(id);
    return { password: this.decrypt(row) || null };
  }

  /** Generate a strong password, push it to the router's REST user, and store it. */
  async rotatePassword(id: string): Promise<AdminRouterCredentialResponse> {
    const row = await this.requireRow(id);
    const password = RoutersService.strongPassword();
    const target = this.target(row);

    const users = await this.client
      .call<Record<string, unknown>[]>(target, 'GET', '/user')
      .catch(() => [] as Record<string, unknown>[]);
    const user = users.find((u) => this.str(u['name']) === row.rest_user);
    const userId = user ? this.str(user['.id']) : null;
    if (!userId) {
      throw new NotFoundException(`REST user ${row.rest_user} not found on ${row.label}`);
    }
    await this.client.call(target, 'POST', '/user/set', { '.id': userId, password });

    await this.database.query(
      `UPDATE mikrotik_routers SET rest_password_enc = $1, updated_at = now() WHERE id = $2`,
      [this.encrypt(row.id, password), row.id],
    );
    return { password };
  }

  async connectConfig(id: string): Promise<AdminRouterConnectConfigResponse> {
    const row = await this.requireRow(id);
    const endpoint = (process.env.AFROWS_ROUTER_WG_ENDPOINT || '94.74.145.199').trim();
    const port = (process.env.AFROWS_ROUTER_WG_PORT || '51902').trim();
    const subnet = (process.env.AFROWS_ROUTER_WG_SUBNET || '10.22.0.0/24').trim();
    const pubkey = (process.env.AFROWS_ROUTER_WG_PUBKEY || '<set AFROWS_ROUTER_WG_PUBKEY>').trim();
    const mask = subnet.includes('/') ? subnet.split('/')[1] : '24';
    const password = this.decrypt(row) || RoutersService.strongPassword();

    const script = [
      `# === Afrows onboarding for ${row.label} (${row.id}) ===`,
      `# Paste this whole block into the MikroTik terminal (New Terminal in WebFig/Winbox).`,
      `/interface/wireguard/add name=wg-afrows listen-port=${port} comment="Afrows management"`,
      `/interface/wireguard/peers/add interface=wg-afrows public-key="${pubkey}" endpoint-address=${endpoint} endpoint-port=${port} allowed-address=${subnet} persistent-keepalive=25s`,
      `/ip/address/add address=${row.host}/${mask} interface=wg-afrows`,
      `/user/add name=${row.rest_user} password="${password}" group=full comment="Afrows panel"`,
      `/ip/service/set www disabled=no`,
      `/interface/list/member/add list=LAN interface=wg-afrows`,
      `/ip/firewall/filter/add chain=input in-interface=wg-afrows action=accept comment="Afrows management" place-before=0`,
      `:delay 2s`,
      `:put ("Afrows: send this MikroTik public key back to the panel -> " . [/interface/wireguard get [find name=wg-afrows] public-key])`,
    ].join('\n');

    return {
      script,
      endpoint: `${endpoint}:${port}`,
      note: 'Paste into the MikroTik terminal. Then copy the printed public key into the panel so Afrows can add the peer.',
    };
  }

  async reconnectModem(id: string, iface: string): Promise<AdminRouterModemActionResponse> {
    const row = await this.requireRow(id);
    const target = this.target(row);

    const ethernet = await this.client
      .call<Record<string, unknown>[]>(target, 'GET', '/interface/ethernet?.proplist=name')
      .catch(() => [] as Record<string, unknown>[]);
    if (!ethernet.some((e) => this.str(e['name']) === iface)) {
      return { ok: false, message: `Interface ${iface} not found on ${row.label}` };
    }

    const clients = await this.client
      .call<Record<string, unknown>[]>(target, 'GET', '/ip/dhcp-client')
      .catch(() => [] as Record<string, unknown>[]);
    const dhcp = clients.find((c) => this.str(c['interface']) === iface);
    const dhcpId = dhcp ? this.str(dhcp['.id']) : null;
    if (!dhcpId) {
      return { ok: false, message: `No DHCP client on ${iface} to renew` };
    }

    try {
      await this.client.call(target, 'POST', '/ip/dhcp-client/renew', { '.id': dhcpId });
      return { ok: true, message: `Renewed WAN on ${iface}` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Reconnect failed' };
    }
  }

  /** Snapshot every router's WireGuard peer byte counters into mikrotik_wg_samples. */
  async sampleUsage(): Promise<void> {
    const rows = await this.allRows();
    for (const row of rows) {
      try {
        const peers = await this.client.call<Record<string, unknown>[]>(
          this.target(row),
          'GET',
          '/interface/wireguard/peers',
          undefined,
          6000,
        );
        for (const p of peers) {
          const key = this.str(p['public-key']) ?? this.str(p['interface']);
          if (!key) continue;
          await this.database.query(
            `INSERT INTO mikrotik_wg_samples (router_id, peer_key, iface, comment, rx_bytes, tx_bytes)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [row.id, key, this.str(p['interface']), this.str(p['comment']), this.num(p['rx']) ?? 0, this.num(p['tx']) ?? 0],
          );
        }
      } catch {
        /* router unreachable this tick; skip */
      }
    }
  }

  async getWgUsage(id: string, days: number): Promise<AdminRouterWgUsageResponse> {
    await this.requireRow(id);
    const windowDays = Math.min(Math.max(days || 30, 1), 365);
    const result = await this.database.query<{
      peer_key: string;
      iface: string | null;
      comment: string | null;
      rx_bytes: string;
      tx_bytes: string;
    }>(
      `SELECT peer_key, iface, comment, rx_bytes, tx_bytes
         FROM mikrotik_wg_samples
        WHERE router_id = $1 AND sampled_at >= now() - ($2 || ' days')::interval
        ORDER BY peer_key, sampled_at ASC`,
      [id, String(windowDays)],
    );

    const byPeer = new Map<string, MikroTikWgUsage>();
    const prev = new Map<string, { rx: number; tx: number }>();
    for (const r of result.rows) {
      const rx = Number(r.rx_bytes);
      const tx = Number(r.tx_bytes);
      let usage = byPeer.get(r.peer_key);
      if (!usage) {
        usage = {
          peerKey: r.peer_key,
          iface: r.iface,
          comment: r.comment,
          rxBytes: 0,
          txBytes: 0,
          totalBytes: 0,
          latestRxBytes: 0,
          latestTxBytes: 0,
          samples: 0,
        };
        byPeer.set(r.peer_key, usage);
      }
      const last = prev.get(r.peer_key);
      if (last) {
        usage.rxBytes += rx >= last.rx ? rx - last.rx : rx; // reset-aware
        usage.txBytes += tx >= last.tx ? tx - last.tx : tx;
      }
      usage.latestRxBytes = rx;
      usage.latestTxBytes = tx;
      usage.iface = r.iface ?? usage.iface;
      usage.comment = r.comment ?? usage.comment;
      usage.samples += 1;
      prev.set(r.peer_key, { rx, tx });
    }

    const rates = await this.database.query<{
      peer_key: string;
      label: string | null;
      price_per_gb: string;
      currency: string;
    }>(`SELECT peer_key, label, price_per_gb, currency FROM mikrotik_wg_rates WHERE router_id = $1`, [id]);
    const rateByPeer = new Map(rates.rows.map((r) => [r.peer_key, r]));

    const usage = [...byPeer.values()].map((u) => {
      const total = u.rxBytes + u.txBytes;
      const rate = rateByPeer.get(u.peerKey);
      const pricePerGb = rate ? Number(rate.price_per_gb) : null;
      return {
        ...u,
        totalBytes: total,
        label: rate?.label ?? u.comment ?? null,
        pricePerGb,
        currency: rate?.currency ?? null,
        cost: pricePerGb != null ? (total / 1e9) * pricePerGb : null,
      };
    });
    usage.sort((a, b) => b.totalBytes - a.totalBytes);
    return { windowDays, usage };
  }

  /** Aggregate usage (all routers/tunnels) into daily (15d) + hourly (24h) buckets, Tehran time. */
  async getUsageCharts(): Promise<AdminRouterUsageChartsResponse> {
    const result = await this.database.query<{
      router_id: string;
      peer_key: string;
      rx_bytes: string;
      tx_bytes: string;
      sampled_at: Date;
    }>(
      `SELECT router_id, peer_key, rx_bytes, tx_bytes, sampled_at
         FROM mikrotik_wg_samples
        WHERE sampled_at >= now() - interval '15 days'
        ORDER BY router_id, peer_key, sampled_at ASC`,
    );

    const TZ = 210 * 60000; // Asia/Tehran +03:30 (no DST)
    const dayKey = (ms: number) => new Date(ms + TZ).toISOString().slice(0, 10); // YYYY-MM-DD
    const hourKey = (ms: number) => new Date(ms + TZ).toISOString().slice(0, 13); // YYYY-MM-DDTHH
    const dailyMap = new Map<string, number>();
    const hourlyMap = new Map<string, number>();
    const now = Date.now();
    const dayAgo = now - 24 * 3600 * 1000;

    let prevKey = '';
    let prevRx = 0;
    let prevTx = 0;
    for (const r of result.rows) {
      const key = `${r.router_id}|${r.peer_key}`;
      const rx = Number(r.rx_bytes);
      const tx = Number(r.tx_bytes);
      const ts = new Date(r.sampled_at as unknown as string).getTime();
      if (key === prevKey) {
        const delta = (rx >= prevRx ? rx - prevRx : rx) + (tx >= prevTx ? tx - prevTx : tx);
        if (delta > 0) {
          dailyMap.set(dayKey(ts), (dailyMap.get(dayKey(ts)) ?? 0) + delta);
          if (ts >= dayAgo) hourlyMap.set(hourKey(ts), (hourlyMap.get(hourKey(ts)) ?? 0) + delta);
        }
      }
      prevKey = key;
      prevRx = rx;
      prevTx = tx;
    }

    const daily: AdminRouterUsageChartsResponse['daily'] = [];
    for (let i = 14; i >= 0; i--) {
      const k = dayKey(now - i * 86400000);
      daily.push({ label: k.slice(5), bytes: dailyMap.get(k) ?? 0 });
    }
    const hourly: AdminRouterUsageChartsResponse['hourly'] = [];
    for (let i = 23; i >= 0; i--) {
      const k = hourKey(now - i * 3600000);
      hourly.push({ label: `${k.slice(11)}:00`, bytes: hourlyMap.get(k) ?? 0 });
    }
    return { daily, hourly };
  }

  async setWgRate(
    id: string,
    peerKey: string,
    pricePerGb: number,
    label: string | null,
    currency: string | null,
  ): Promise<AdminRouterWgUsageResponse> {
    await this.requireRow(id);
    await this.database.query(
      `INSERT INTO mikrotik_wg_rates (router_id, peer_key, label, price_per_gb, currency)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (router_id, peer_key)
       DO UPDATE SET label = EXCLUDED.label, price_per_gb = EXCLUDED.price_per_gb, currency = EXCLUDED.currency, updated_at = now()`,
      [id, peerKey, label, pricePerGb, currency ?? 'IRT'],
    );
    return this.getWgUsage(id, 30);
  }

  // --- internals ---

  private async allRows(): Promise<RouterRow[]> {
    const result = await this.database.query<RouterRow>(`SELECT * FROM mikrotik_routers ORDER BY label ASC`);
    return result.rows;
  }

  private async requireRow(id: string): Promise<RouterRow> {
    const result = await this.database.query<RouterRow>(`SELECT * FROM mikrotik_routers WHERE id = $1`, [id]);
    const row = result.rows[0];
    if (!row) throw new NotFoundException(`Router ${id} not found`);
    return row;
  }

  private target(row: RouterRow): MikroTikTarget {
    return { host: row.host, port: row.rest_port, user: row.rest_user, password: this.decrypt(row) };
  }

  private modeOf(row: RouterRow): MikroTikMode {
    return row.gaming_enabled ? 'game' : 'normal';
  }

  private async probe(row: RouterRow): Promise<{ online: boolean; mode: MikroTikMode; resource?: Record<string, unknown> }> {
    try {
      const resource = await this.client.call<Record<string, unknown>>(this.target(row), 'GET', '/system/resource', undefined, 5000);
      return { online: true, mode: this.modeOf(row), resource };
    } catch {
      return { online: false, mode: this.modeOf(row) };
    }
  }

  private toSummary(
    row: RouterRow,
    probe: { online: boolean; mode: MikroTikMode; resource?: Record<string, unknown> },
  ): MikroTikRouterSummary {
    const resource = probe.resource ?? {};
    return {
      id: row.id,
      label: row.label,
      kind: (row.kind as MikroTikRouterSummary['kind']) ?? 'other',
      host: row.host,
      restPort: row.rest_port,
      restUser: row.rest_user,
      webfigUrl: row.webfig_url,
      gamingSourceIp: row.gaming_source_ip,
      notes: row.notes,
      hasPassword: Boolean(row.rest_password_enc),
      online: probe.online,
      mode: probe.mode,
      board: this.str(resource['board-name']),
      version: this.str(resource['version']),
      uptime: this.str(resource['uptime']),
      createdAt: row.created_at?.toISOString?.() ?? null,
      updatedAt: row.updated_at?.toISOString?.() ?? null,
    };
  }

  private async buildStatus(row: RouterRow): Promise<MikroTikRouterStatus> {
    const base: MikroTikRouterStatus = {
      id: row.id,
      label: row.label,
      online: false,
      mode: this.modeOf(row),
      wans: [],
      wgPeers: [],
      webfigUrl: row.webfig_url,
      fetchedAt: new Date().toISOString(),
    };

    const target = this.target(row);
    try {
      const [resource, identity, ethernet, addresses, peers] = await Promise.all([
        this.client.call<Record<string, unknown>>(target, 'GET', '/system/resource'),
        this.client.call<Record<string, unknown>>(target, 'GET', '/system/identity').catch(() => ({}) as Record<string, unknown>),
        this.client
          .call<Record<string, unknown>[]>(target, 'GET', '/interface/ethernet?.proplist=name,running,comment')
          .catch(() => [] as Record<string, unknown>[]),
        this.client.call<Record<string, unknown>[]>(target, 'GET', '/ip/address').catch(() => []),
        this.client.call<Record<string, unknown>[]>(target, 'GET', '/interface/wireguard/peers').catch(() => []),
      ]);

      const addrByIface = new Map<string, string>();
      for (const a of addresses) {
        const iface = this.str(a['interface']);
        const addr = this.str(a['address']);
        if (iface && addr && !addrByIface.has(iface)) addrByIface.set(iface, addr);
      }

      const wans: MikroTikWan[] = ethernet.map((e) => {
        const name = this.str(e['name']) ?? '';
        const comment = this.str(e['comment']);
        const simMatch = comment ? comment.match(/(\d{7,})/) : null;
        return {
          name,
          comment,
          sim: simMatch ? simMatch[1] : null,
          running: this.str(e['running']) === 'true',
          address: addrByIface.get(name) ?? null,
        };
      });

      const wgPeers: MikroTikWgPeer[] = peers.map((p) => ({
        interfaceName: this.str(p['interface']) ?? '',
        comment: this.str(p['comment']),
        endpoint: this.joinEndpoint(this.str(p['current-endpoint-address']) ?? this.str(p['endpoint-address']), this.str(p['current-endpoint-port']) ?? this.str(p['endpoint-port'])),
        lastHandshakeSeconds: this.parseDuration(this.str(p['last-handshake'])),
        rxBytes: this.num(p['rx']),
        txBytes: this.num(p['tx']),
      }));

      return {
        ...base,
        online: true,
        identity: this.str(identity['name']),
        board: this.str(resource['board-name']),
        version: this.str(resource['version']),
        uptime: this.str(resource['uptime']),
        cpuLoad: this.num(resource['cpu-load']),
        wans,
        wgPeers,
      };
    } catch (error) {
      return { ...base, error: error instanceof Error ? error.message : 'Router unreachable' };
    }
  }

  private encrypt(id: string, password: string): string {
    return this.vault.encryptJson({ password }, `mikrotik:${id}`).payload;
  }

  private decrypt(row: RouterRow): string {
    if (!row.rest_password_enc) return '';
    try {
      const payload = this.vault.decryptJson(row.rest_password_enc, `mikrotik:${row.id}`);
      return typeof payload.password === 'string' ? payload.password : '';
    } catch {
      return '';
    }
  }

  static strongPassword(): string {
    return randomBytes(40).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 28);
  }

  private triggerEgressModeSync(): void {
    execFile('sudo', ['-n', 'systemctl', 'start', 'afrows-egress-mode-sync.service'], () => {
      /* best-effort; the systemd timer applies the mode regardless */
    });
  }

  private str(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private num(value: unknown): number | null {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value);
    return null;
  }

  private joinEndpoint(address: string | null, port: string | null): string | null {
    if (!address) return null;
    return port ? `${address}:${port}` : address;
  }

  private parseDuration(value: string | null): number | null {
    if (!value) return null;
    const units: Record<string, number> = { d: 86400, h: 3600, m: 60, s: 1 };
    let total = 0;
    let matched = false;
    const regex = /(\d+)([dhms])/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(value)) !== null) {
      total += Number(match[1]) * (units[match[2]] ?? 0);
      matched = true;
    }
    return matched ? total : null;
  }
}
