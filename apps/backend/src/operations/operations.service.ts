import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminOutboundSummary,
  AdminServerDetail,
  AdminServerSummary,
  RouteFailoverEventSummary,
  ServerMetricSnapshot,
} from '@afrogate/shared';
import { AuditService } from '../audit/audit.service';
import { DatabaseService, type DatabaseQueryExecutor } from '../database/database.service';
import type { AuthActor } from '../security/auth-request';
import { CreateOutboundDto, UpdateOutboundDto } from './dto/outbound.dto';
import { CreateServerDto, UpdateServerDto, UpsertServerAccessProfileDto } from './dto/server.dto';

interface ServerInventoryRow {
  id: string;
  externalId: string;
  hostname: string | null;
  platform: string | null;
  country: string | null;
  region: string | null;
  role: string | null;
  tags: unknown;
  status: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
  metricObservedAt: Date | null;
  cpuPercent: number | null;
  ramPercent: number | null;
  diskFreePercent: number | null;
  inboundBps: number | null;
  outboundBps: number | null;
  pingMs: number | null;
  jitterMs: number | null;
  packetLossPercent: number | null;
  healthScore: number | null;
  metricRaw: Partial<ServerMetricSnapshot> | null;
  accessProfileId: string | null;
  accessAddress: string | null;
  sshPort: number | null;
  username: string | null;
  accessMethod: string | null;
  credentialRef: string | null;
  bootstrapState: string | null;
  lastTestedAt: Date | null;
  lastTestStatus: string | null;
  accessNotes: string | null;
  accessCreatedAt: Date | null;
  accessUpdatedAt: Date | null;
  outboundCount: number;
  openAlertCount: number;
}

interface OutboundRow {
  id: string;
  serverId: string | null;
  serverExternalId: string | null;
  serverHostname: string | null;
  name: string;
  type: string;
  routeGroup: string;
  priority: number;
  enabled: boolean;
  maintenanceMode: boolean;
  config: Record<string, unknown> | null;
  secretRef: string | null;
  healthStatus: string;
  healthIntervalSeconds: number;
  failThreshold: number;
  recoveryThreshold: number;
  cooldownSeconds: number;
  weight: number;
  maxUsers: number | null;
  lastCheckedAt: Date | null;
  lastHealthyAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface RouteFailoverEventRow {
  id: string;
  routeGroup: string;
  fromOutboundId: string | null;
  toOutboundId: string | null;
  reason: string;
  triggerMetric: Record<string, unknown> | null;
  createdAt: Date;
}

interface OutboundOrderRow {
  id: string;
  routeGroup: string;
}

const SENSITIVE_CONFIG_KEY_FRAGMENTS = [
  'token',
  'password',
  'secret',
  'privatekey',
  'apikey',
  'accesskey',
  'authorization',
  'bearer',
  'credential',
];

@Injectable()
export class OperationsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async listServers(): Promise<AdminServerSummary[]> {
    const result = await this.database.query<ServerInventoryRow>(
      `${this.serverInventorySql()} ORDER BY s.created_at DESC`,
    );

    return result.rows.map((row) => this.mapServer(row));
  }

  async getServer(id: string): Promise<AdminServerDetail> {
    const result = await this.database.query<ServerInventoryRow>(`${this.serverInventorySql()} WHERE s.id = $1`, [id]);
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Server not found');

    return {
      ...this.mapServer(row),
      outbounds: await this.listOutbounds({ serverId: id }),
    };
  }

  async createServer(dto: CreateServerDto, actor: AuthActor | undefined): Promise<AdminServerDetail> {
    try {
      const serverId = await this.database.transaction(async (executor) => {
        const result = await executor.query<{ id: string }>(
          `
            INSERT INTO servers (
              external_id, hostname, platform, country, region, role, tags, status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
            RETURNING id
          `,
          [
            dto.externalId,
            dto.hostname ?? null,
            dto.platform ?? null,
            dto.country ?? null,
            dto.region ?? null,
            dto.role ?? null,
            JSON.stringify(this.normalizeTags(dto.tags)),
            dto.status ?? 'unknown',
          ],
        );

        const id = result.rows[0].id;

        if (dto.accessProfile) {
          await this.upsertAccessProfile(executor, id, dto.accessProfile);
        }

        await this.audit.record(
          actor,
          'server.create',
          'server',
          id,
          {
            externalId: dto.externalId,
            hasAccessProfile: Boolean(dto.accessProfile),
          },
          executor,
        );

        return id;
      });

      return this.getServer(serverId);
    } catch (error) {
      this.throwConflictIfUniqueViolation(error, 'Server external id already exists');
      throw error;
    }
  }

  async updateServer(id: string, dto: UpdateServerDto, actor: AuthActor | undefined): Promise<AdminServerDetail> {
    try {
      await this.database.transaction(async (executor) => {
        await this.ensureServerExists(executor, id);
        const changedFields = await this.updateServerFields(executor, id, dto);

        if (dto.accessProfile) {
          await this.upsertAccessProfile(executor, id, dto.accessProfile);
          changedFields.push('accessProfile');
        }

        await this.audit.record(
          actor,
          'server.update',
          'server',
          id,
          {
            changedFields,
            hasAccessProfile: Boolean(dto.accessProfile),
          },
          executor,
        );
      });

      return this.getServer(id);
    } catch (error) {
      this.throwConflictIfUniqueViolation(error, 'Server external id already exists');
      throw error;
    }
  }

  async deleteServer(id: string, actor: AuthActor | undefined): Promise<void> {
    await this.database.transaction(async (executor) => {
      const result = await executor.query<{ externalId: string }>(
        'DELETE FROM servers WHERE id = $1 RETURNING external_id AS "externalId"',
        [id],
      );
      const row = result.rows[0];

      if (!row) throw new NotFoundException('Server not found');

      await this.audit.record(
        actor,
        'server.delete',
        'server',
        id,
        {
          externalId: row.externalId,
        },
        executor,
      );
    });
  }

  async listOutbounds(
    filters: { serverId?: string; routeGroup?: string; limit?: number } = {},
  ): Promise<AdminOutboundSummary[]> {
    const result = await this.database.query<OutboundRow>(
      `
        SELECT
          o.id,
          o.server_id AS "serverId",
          s.external_id AS "serverExternalId",
          s.hostname AS "serverHostname",
          o.name,
          o.type,
          o.route_group AS "routeGroup",
          o.priority,
          o.enabled,
          o.maintenance_mode AS "maintenanceMode",
          o.config,
          o.secret_ref AS "secretRef",
          o.health_status AS "healthStatus",
          o.health_interval_seconds AS "healthIntervalSeconds",
          o.fail_threshold AS "failThreshold",
          o.recovery_threshold AS "recoveryThreshold",
          o.cooldown_seconds AS "cooldownSeconds",
          o.weight,
          o.max_users AS "maxUsers",
          o.last_checked_at AS "lastCheckedAt",
          o.last_healthy_at AS "lastHealthyAt",
          o.created_at AS "createdAt",
          o.updated_at AS "updatedAt"
        FROM outbounds o
        LEFT JOIN servers s ON s.id = o.server_id
        WHERE ($1::uuid IS NULL OR o.server_id = $1)
          AND ($2::text IS NULL OR o.route_group = $2)
        ORDER BY o.route_group ASC, o.priority ASC, o.created_at ASC, o.name ASC
        LIMIT $3
      `,
      [filters.serverId ?? null, filters.routeGroup ?? null, filters.limit ?? 200],
    );

    return result.rows.map((row) => this.mapOutbound(row));
  }

  async getOutbound(id: string): Promise<AdminOutboundSummary> {
    const result = await this.database.query<OutboundRow>(
      `
        SELECT
          o.id,
          o.server_id AS "serverId",
          s.external_id AS "serverExternalId",
          s.hostname AS "serverHostname",
          o.name,
          o.type,
          o.route_group AS "routeGroup",
          o.priority,
          o.enabled,
          o.maintenance_mode AS "maintenanceMode",
          o.config,
          o.secret_ref AS "secretRef",
          o.health_status AS "healthStatus",
          o.health_interval_seconds AS "healthIntervalSeconds",
          o.fail_threshold AS "failThreshold",
          o.recovery_threshold AS "recoveryThreshold",
          o.cooldown_seconds AS "cooldownSeconds",
          o.weight,
          o.max_users AS "maxUsers",
          o.last_checked_at AS "lastCheckedAt",
          o.last_healthy_at AS "lastHealthyAt",
          o.created_at AS "createdAt",
          o.updated_at AS "updatedAt"
        FROM outbounds o
        LEFT JOIN servers s ON s.id = o.server_id
        WHERE o.id = $1
      `,
      [id],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Outbound not found');

    return this.mapOutbound(row);
  }

  async createOutbound(dto: CreateOutboundDto, actor: AuthActor | undefined): Promise<AdminOutboundSummary> {
    this.assertSafeConfig(dto.config);

    const outboundId = await this.database.transaction(async (executor) => {
      if (dto.serverId) await this.ensureServerExists(executor, dto.serverId);

      const routeGroup = dto.routeGroup ?? 'default';
      const priority = dto.priority ?? (await this.nextOutboundPriority(executor, routeGroup));
      const result = await executor.query<{ id: string }>(
        `
          INSERT INTO outbounds (
            server_id, name, type, route_group, priority, enabled, maintenance_mode,
            config, secret_ref, health_interval_seconds, fail_threshold,
            recovery_threshold, cooldown_seconds, weight, max_users
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15)
          RETURNING id
        `,
        [
          dto.serverId ?? null,
          dto.name,
          dto.type,
          routeGroup,
          priority,
          dto.enabled ?? true,
          dto.maintenanceMode ?? false,
          JSON.stringify(dto.config ?? {}),
          dto.secretRef ?? null,
          dto.healthIntervalSeconds ?? 60,
          dto.failThreshold ?? 3,
          dto.recoveryThreshold ?? 3,
          dto.cooldownSeconds ?? 120,
          dto.weight ?? 100,
          dto.maxUsers ?? null,
        ],
      );

      const id = result.rows[0].id;

      await this.audit.record(
        actor,
        'outbound.create',
        'outbound',
        id,
        {
          routeGroup,
          type: dto.type,
          serverId: dto.serverId ?? null,
          hasSecretRef: Boolean(dto.secretRef),
        },
        executor,
      );

      return id;
    });

    return this.getOutbound(outboundId);
  }

  async updateOutbound(id: string, dto: UpdateOutboundDto, actor: AuthActor | undefined): Promise<AdminOutboundSummary> {
    this.assertSafeConfig(dto.config);

    await this.database.transaction(async (executor) => {
      await this.ensureOutboundExists(executor, id);
      if (dto.serverId) await this.ensureServerExists(executor, dto.serverId);

      const changedFields = await this.updateOutboundFields(executor, id, dto);

      await this.audit.record(
        actor,
        'outbound.update',
        'outbound',
        id,
        {
          changedFields,
          hasSecretRef: dto.secretRef === undefined ? undefined : Boolean(dto.secretRef),
        },
        executor,
      );
    });

    return this.getOutbound(id);
  }

  async deleteOutbound(id: string, actor: AuthActor | undefined): Promise<void> {
    await this.database.transaction(async (executor) => {
      const result = await executor.query<{ routeGroup: string; type: string }>(
        'DELETE FROM outbounds WHERE id = $1 RETURNING route_group AS "routeGroup", type',
        [id],
      );
      const row = result.rows[0];

      if (!row) throw new NotFoundException('Outbound not found');

      await this.audit.record(
        actor,
        'outbound.delete',
        'outbound',
        id,
        {
          routeGroup: row.routeGroup,
          type: row.type,
        },
        executor,
      );
    });
  }

  async moveOutbound(id: string, direction: string, actor: AuthActor | undefined): Promise<AdminOutboundSummary> {
    await this.database.transaction(async (executor) => {
      const current = await executor.query<OutboundOrderRow>(
        'SELECT id, route_group AS "routeGroup" FROM outbounds WHERE id = $1',
        [id],
      );
      const routeGroup = current.rows[0]?.routeGroup;

      if (!routeGroup) throw new NotFoundException('Outbound not found');

      const ordered = await executor.query<OutboundOrderRow>(
        `
          SELECT id, route_group AS "routeGroup"
          FROM outbounds
          WHERE route_group = $1
          ORDER BY priority ASC, created_at ASC, id ASC
          FOR UPDATE
        `,
        [routeGroup],
      );
      const rows = [...ordered.rows];
      const currentIndex = rows.findIndex((row) => row.id === id);
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      if (currentIndex !== -1 && targetIndex >= 0 && targetIndex < rows.length) {
        [rows[currentIndex], rows[targetIndex]] = [rows[targetIndex], rows[currentIndex]];

        for (const [index, row] of rows.entries()) {
          await executor.query(
            'UPDATE outbounds SET priority = $1, updated_at = now() WHERE id = $2',
            [(index + 1) * 100, row.id],
          );
        }
      }

      await this.audit.record(
        actor,
        'outbound.move',
        'outbound',
        id,
        {
          routeGroup,
          direction,
          moved: currentIndex !== -1 && targetIndex >= 0 && targetIndex < rows.length,
        },
        executor,
      );
    });

    return this.getOutbound(id);
  }

  async listRouteFailoverEvents(
    filters: { routeGroup?: string; limit?: number } = {},
  ): Promise<RouteFailoverEventSummary[]> {
    const result = await this.database.query<RouteFailoverEventRow>(
      `
        SELECT
          id,
          route_group AS "routeGroup",
          from_outbound_id AS "fromOutboundId",
          to_outbound_id AS "toOutboundId",
          reason,
          trigger_metric AS "triggerMetric",
          created_at AS "createdAt"
        FROM route_failover_events
        WHERE ($1::text IS NULL OR route_group = $1)
        ORDER BY created_at DESC
        LIMIT $2
      `,
      [filters.routeGroup ?? null, filters.limit ?? 100],
    );

    return result.rows.map((row) => ({
      id: row.id,
      routeGroup: row.routeGroup,
      fromOutboundId: row.fromOutboundId,
      toOutboundId: row.toOutboundId,
      reason: row.reason,
      triggerMetric: this.asRecord(row.triggerMetric),
      createdAt: row.createdAt.toISOString(),
    }));
  }

  normalizeLimit(input: string | undefined, fallback: number, max: number): number {
    if (!input) return fallback;

    const value = Number(input);
    if (!Number.isInteger(value) || value < 1) {
      throw new BadRequestException('Limit must be a positive integer');
    }

    return Math.min(value, max);
  }

  normalizeUuidQuery(input: string | undefined, name: string): string | undefined {
    if (!input) return undefined;

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input)) {
      throw new BadRequestException(`${name} must be a UUID`);
    }

    return input;
  }

  private serverInventorySql(): string {
    return `
      SELECT
        s.id,
        s.external_id AS "externalId",
        s.hostname,
        s.platform,
        s.country,
        s.region,
        s.role,
        s.tags,
        s.status,
        s.first_seen_at AS "firstSeenAt",
        s.last_seen_at AS "lastSeenAt",
        s.created_at AS "createdAt",
        s.updated_at AS "updatedAt",
        m.observed_at AS "metricObservedAt",
        m.cpu_percent AS "cpuPercent",
        m.ram_percent AS "ramPercent",
        m.disk_free_percent AS "diskFreePercent",
        m.inbound_bps AS "inboundBps",
        m.outbound_bps AS "outboundBps",
        m.ping_ms AS "pingMs",
        m.jitter_ms AS "jitterMs",
        m.packet_loss_percent AS "packetLossPercent",
        m.health_score AS "healthScore",
        m.raw AS "metricRaw",
        ap.id AS "accessProfileId",
        ap.address AS "accessAddress",
        ap.ssh_port AS "sshPort",
        ap.username,
        ap.access_method AS "accessMethod",
        ap.credential_ref AS "credentialRef",
        ap.bootstrap_state AS "bootstrapState",
        ap.last_tested_at AS "lastTestedAt",
        ap.last_test_status AS "lastTestStatus",
        ap.notes AS "accessNotes",
        ap.created_at AS "accessCreatedAt",
        ap.updated_at AS "accessUpdatedAt",
        COALESCE(oc.outbound_count, 0) AS "outboundCount",
        COALESCE(ac.open_alert_count, 0) AS "openAlertCount"
      FROM servers s
      LEFT JOIN LATERAL (
        SELECT *
        FROM server_metrics sm
        WHERE sm.server_id = s.id
        ORDER BY sm.observed_at DESC
        LIMIT 1
      ) m ON true
      LEFT JOIN server_access_profiles ap ON ap.server_id = s.id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS outbound_count
        FROM outbounds o
        WHERE o.server_id = s.id
      ) oc ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS open_alert_count
        FROM alerts a
        WHERE a.status = 'open'
          AND a.source_id = s.external_id
      ) ac ON true
    `;
  }

  private mapServer(row: ServerInventoryRow): AdminServerSummary {
    return {
      id: row.id,
      externalId: row.externalId,
      hostname: row.hostname,
      platform: row.platform,
      country: row.country,
      region: row.region,
      role: row.role,
      tags: this.normalizeTags(row.tags),
      status: row.status,
      firstSeenAt: row.firstSeenAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      latestMetric: this.mapLatestMetric(row),
      accessProfile: this.mapAccessProfile(row),
      outboundCount: row.outboundCount,
      openAlertCount: row.openAlertCount,
    };
  }

  private mapLatestMetric(row: ServerInventoryRow): ServerMetricSnapshot | undefined {
    if (!row.metricObservedAt || row.healthScore === null) return undefined;

    return {
      serverId: row.externalId,
      hostname: row.hostname ?? undefined,
      platform: row.platform ?? undefined,
      observedAt: row.metricObservedAt.toISOString(),
      cpuPercent: row.cpuPercent,
      ramPercent: row.ramPercent,
      diskFreePercent: row.diskFreePercent,
      storages: row.metricRaw?.storages,
      networkInterfaces: row.metricRaw?.networkInterfaces,
      inboundBps: row.inboundBps,
      outboundBps: row.outboundBps,
      pingMs: row.pingMs,
      jitterMs: row.jitterMs,
      packetLossPercent: row.packetLossPercent,
      healthScore: row.healthScore,
    };
  }

  private mapAccessProfile(row: ServerInventoryRow): AdminServerSummary['accessProfile'] {
    if (
      !row.accessProfileId ||
      !row.accessAddress ||
      !row.sshPort ||
      !row.username ||
      !row.accessMethod ||
      !row.bootstrapState
    ) {
      return undefined;
    }

    return {
      id: row.accessProfileId,
      address: row.accessAddress,
      sshPort: row.sshPort,
      username: row.username,
      accessMethod: row.accessMethod,
      bootstrapState: row.bootstrapState,
      hasCredentialRef: Boolean(row.credentialRef),
      lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
      lastTestStatus: row.lastTestStatus,
      notes: row.accessNotes,
      createdAt: (row.accessCreatedAt ?? row.createdAt).toISOString(),
      updatedAt: (row.accessUpdatedAt ?? row.updatedAt).toISOString(),
    };
  }

  private mapOutbound(row: OutboundRow): AdminOutboundSummary {
    return {
      id: row.id,
      serverId: row.serverId,
      serverExternalId: row.serverExternalId,
      serverHostname: row.serverHostname,
      name: row.name,
      type: row.type,
      routeGroup: row.routeGroup,
      priority: row.priority,
      enabled: row.enabled,
      maintenanceMode: row.maintenanceMode,
      config: this.redactConfig(this.asRecord(row.config)),
      hasSecretRef: Boolean(row.secretRef),
      healthStatus: row.healthStatus,
      healthIntervalSeconds: row.healthIntervalSeconds,
      failThreshold: row.failThreshold,
      recoveryThreshold: row.recoveryThreshold,
      cooldownSeconds: row.cooldownSeconds,
      weight: row.weight,
      maxUsers: row.maxUsers,
      lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
      lastHealthyAt: row.lastHealthyAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async ensureServerExists(executor: DatabaseQueryExecutor, id: string): Promise<void> {
    const result = await executor.query<{ id: string }>('SELECT id FROM servers WHERE id = $1', [id]);
    if (!result.rows[0]) throw new NotFoundException('Server not found');
  }

  private async ensureOutboundExists(executor: DatabaseQueryExecutor, id: string): Promise<void> {
    const result = await executor.query<{ id: string }>('SELECT id FROM outbounds WHERE id = $1', [id]);
    if (!result.rows[0]) throw new NotFoundException('Outbound not found');
  }

  private async updateServerFields(
    executor: DatabaseQueryExecutor,
    id: string,
    dto: UpdateServerDto,
  ): Promise<string[]> {
    const fields: string[] = [];
    const values: unknown[] = [];
    const setClauses: string[] = [];

    const add = (field: string, column: string, value: unknown) => {
      fields.push(field);
      values.push(value);
      setClauses.push(`${column} = $${values.length}`);
    };

    if (dto.externalId !== undefined) add('externalId', 'external_id', dto.externalId);
    if (dto.hostname !== undefined) add('hostname', 'hostname', dto.hostname);
    if (dto.platform !== undefined) add('platform', 'platform', dto.platform);
    if (dto.country !== undefined) add('country', 'country', dto.country);
    if (dto.region !== undefined) add('region', 'region', dto.region);
    if (dto.role !== undefined) add('role', 'role', dto.role);
    if (dto.tags !== undefined) add('tags', 'tags', JSON.stringify(this.normalizeTags(dto.tags)));
    if (dto.status !== undefined) add('status', 'status', dto.status);

    if (!setClauses.length) return fields;

    values.push(id);
    await executor.query(
      `
        UPDATE servers
        SET ${setClauses.join(', ')},
            updated_at = now()
        WHERE id = $${values.length}
      `,
      values,
    );

    return fields;
  }

  private async upsertAccessProfile(
    executor: DatabaseQueryExecutor,
    serverId: string,
    profile: UpsertServerAccessProfileDto,
  ): Promise<void> {
    await executor.query(
      `
        INSERT INTO server_access_profiles (
          server_id, address, ssh_port, username, access_method,
          credential_ref, bootstrap_state, last_test_status, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (server_id)
        DO UPDATE SET
          address = excluded.address,
          ssh_port = excluded.ssh_port,
          username = excluded.username,
          access_method = excluded.access_method,
          credential_ref = excluded.credential_ref,
          bootstrap_state = excluded.bootstrap_state,
          last_test_status = excluded.last_test_status,
          notes = excluded.notes,
          updated_at = now()
      `,
      [
        serverId,
        profile.address,
        profile.sshPort ?? 22,
        profile.username ?? 'afrogate',
        profile.accessMethod ?? 'ssh_key',
        profile.credentialRef ?? null,
        profile.bootstrapState ?? 'not_started',
        profile.lastTestStatus ?? null,
        profile.notes ?? null,
      ],
    );
  }

  private async nextOutboundPriority(executor: DatabaseQueryExecutor, routeGroup: string): Promise<number> {
    const result = await executor.query<{ priority: number }>(
      'SELECT COALESCE(MAX(priority), 0)::int + 100 AS priority FROM outbounds WHERE route_group = $1',
      [routeGroup],
    );

    return result.rows[0]?.priority ?? 100;
  }

  private async updateOutboundFields(
    executor: DatabaseQueryExecutor,
    id: string,
    dto: UpdateOutboundDto,
  ): Promise<string[]> {
    const fields: string[] = [];
    const values: unknown[] = [];
    const setClauses: string[] = [];

    const add = (field: string, column: string, value: unknown) => {
      fields.push(field);
      values.push(value);
      setClauses.push(`${column} = $${values.length}`);
    };

    if (dto.serverId !== undefined) add('serverId', 'server_id', dto.serverId);
    if (dto.name !== undefined) add('name', 'name', dto.name);
    if (dto.type !== undefined) add('type', 'type', dto.type);
    if (dto.routeGroup !== undefined) add('routeGroup', 'route_group', dto.routeGroup);
    if (dto.priority !== undefined) add('priority', 'priority', dto.priority);
    if (dto.enabled !== undefined) add('enabled', 'enabled', dto.enabled);
    if (dto.maintenanceMode !== undefined) add('maintenanceMode', 'maintenance_mode', dto.maintenanceMode);
    if (dto.config !== undefined) add('config', 'config', JSON.stringify(dto.config));
    if (dto.secretRef !== undefined) add('secretRef', 'secret_ref', dto.secretRef);
    if (dto.healthIntervalSeconds !== undefined) {
      add('healthIntervalSeconds', 'health_interval_seconds', dto.healthIntervalSeconds);
    }
    if (dto.failThreshold !== undefined) add('failThreshold', 'fail_threshold', dto.failThreshold);
    if (dto.recoveryThreshold !== undefined) add('recoveryThreshold', 'recovery_threshold', dto.recoveryThreshold);
    if (dto.cooldownSeconds !== undefined) add('cooldownSeconds', 'cooldown_seconds', dto.cooldownSeconds);
    if (dto.weight !== undefined) add('weight', 'weight', dto.weight);
    if (dto.maxUsers !== undefined) add('maxUsers', 'max_users', dto.maxUsers);

    if (!setClauses.length) return fields;

    values.push(id);
    await executor.query(
      `
        UPDATE outbounds
        SET ${setClauses.join(', ')},
            updated_at = now()
        WHERE id = $${values.length}
      `,
      values,
    );

    return fields;
  }

  private normalizeTags(value: unknown): string[] {
    if (!Array.isArray(value)) return [];

    return [...new Set(value.map((tag) => (typeof tag === 'string' ? tag.trim() : '')).filter(Boolean))];
  }

  private assertSafeConfig(config: Record<string, unknown> | undefined): void {
    if (!config) return;

    const paths = this.collectSensitiveConfigPaths(config);
    if (!paths.length) return;

    throw new BadRequestException(
      `Outbound config contains secret-like keys (${paths.slice(0, 5).join(
        ', ',
      )}). Store secret material by reference instead.`,
    );
  }

  private collectSensitiveConfigPaths(value: unknown, path = ''): string[] {
    if (Array.isArray(value)) {
      return value.flatMap((item, index) => this.collectSensitiveConfigPaths(item, `${path}[${index}]`));
    }

    if (!this.isRecord(value)) return [];

    const paths: string[] = [];

    for (const [key, nestedValue] of Object.entries(value)) {
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      const nextPath = path ? `${path}.${key}` : key;

      if (SENSITIVE_CONFIG_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment))) {
        paths.push(nextPath);
        continue;
      }

      paths.push(...this.collectSensitiveConfigPaths(nestedValue, nextPath));
    }

    return paths;
  }

  private redactConfig(config: Record<string, unknown>): Record<string, unknown> {
    const redacted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(config)) {
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');

      if (SENSITIVE_CONFIG_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment))) {
        redacted[key] = '[redacted]';
        continue;
      }

      if (Array.isArray(value)) {
        redacted[key] = value.map((item) => (this.isRecord(item) ? this.redactConfig(item) : item));
        continue;
      }

      redacted[key] = this.isRecord(value) ? this.redactConfig(value) : value;
    }

    return redacted;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return this.isRecord(value) ? value : {};
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private throwConflictIfUniqueViolation(error: unknown, message: string): void {
    if (this.isErrorWithCode(error) && error.code === '23505') {
      throw new ConflictException(message);
    }
  }

  private isErrorWithCode(error: unknown): error is { code: string } {
    return typeof error === 'object' && error !== null && 'code' in error;
  }
}
