import { Injectable, NotFoundException } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import type {
  AdminRouterConnectConfigResponse,
  AdminRouterCredentialResponse,
  AdminRouterModemActionResponse,
  AdminRouterMutationResponse,
  AdminRouterStatusResponse,
  AdminRoutersResponse,
  MikroTikMode,
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
      `/ip/firewall/filter/add chain=input in-interface=wg-afrows action=accept comment="Afrows management"`,
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
      .call<Record<string, unknown>[]>(target, 'GET', '/interface/ethernet')
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
        this.client.call<Record<string, unknown>[]>(target, 'GET', '/interface/ethernet').catch(() => []),
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
