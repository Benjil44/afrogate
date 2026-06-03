import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { randomUUID } from 'crypto';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  AdminAlertSummary,
  ApplyRouteDecisionPreviewResponse,
  AdminOutboundSummary,
  AdminProtocolServerApplyAdapterSummary,
  AdminProtocolServerApplyDryRunSnapshot,
  AdminProtocolServerApplyEventDetail,
  AdminProtocolServerApplyEventSummary,
  AdminProtocolSetupSummary,
  AdminProtocolServerApplyPlanSummary,
  AdminProtocolServerApplyPreflightSummary,
  AdminRouteAssignmentSummary,
  AdminRouteCanaryStatusResponse,
  AdminRouteDecisionApplyAdapterSummary,
  AdminRouteDecisionApplyDryRunCommand,
  AdminRouteDecisionApplyDryRunConfigChange,
  AdminRouteDecisionApplyDryRunSnapshot,
  AdminRouteDecisionApplyPlanSummary,
  AdminRouteDecisionEventDetail,
  AdminRouteDecisionEventSummary,
  AdminRouteDecisionCandidateReviewSummary,
  AdminRouteDecisionClientPreferenceSummary,
  AdminRouteDecisionLoadBalancingSummary,
  AdminRouteDecisionProfileRecommendation,
  AdminRouteDecisionSessionSafetySummary,
  AdminRouteDecisionSwitchExecutionSummary,
  AdminRouteDecisionSwitchEngineSummary,
  AdminRouteDecisionSwitchOrchestrationSummary,
  AdminRouteDecisionSwitchPreflightSummary,
  AdminRouteDecisionSwitchRolloutEvaluationSummary,
  AdminRouteDecisionSwitchRolloutSummary,
  AdminRouteSettingsSummary,
  AdminRouteDecisionCandidateSummary,
  AdminRouteDecisionPreviewResponse,
  AdminIncidentTimelineEvent,
  AdminIncidentTimelineResponse,
  AdminSecretRefSummary,
  AdminRouteHealthHistoryResponse,
  AdminRouteQualityAnalyticsResponse,
  AdminServerCredentialSummary,
  AdminServerDetail,
  AdminServerInterfaceSummary,
  AdminServerSummary,
  AdminSettingsResponse,
  AdminTunnelSummary,
  AdminWireGuardCandidate,
  LoadBalanceStrategy,
  ProvisionProtocolSetupResponse,
  ProtocolServerApplyMode,
  ProtocolServerApplyReason,
  RecordProtocolServerApplyResponse,
  RecordRouteDecisionPreviewResponse,
  RequestProtocolServerApplyResponse,
  RouteFailoverEventSummary,
  RouteDecisionAction,
  RouteBufferbloatRecommendation,
  RouteBufferbloatSeverity,
  RouteMtuRecommendation,
  RouteMtuStatus,
  RouteHealthHistoryPoint,
  RouteQualityRecommendation,
  RouteQualityWindowSummary,
  RouteProbeMetric,
  RouteProfileScores,
  RouteScoreProfile,
  RouteScoreReason,
  ServerMetricSnapshot,
  StoreServerCredentialResponse,
  WireGuardInterfaceMetric,
  HealthState,
} from '@afrogate/shared';
import { AuditService } from '../audit/audit.service';
import { DatabaseService, type DatabaseQueryExecutor } from '../database/database.service';
import { routeMarkHex, safeConfigFileName, safePathSegment, safeRouteTableName, safeWireGuardInterfaceName, shellToken } from './command-safety';
import { calculateMtuProbeScore, calculateProtocolProbeScore, calculateSingleProbeScore, clamp, loadedLatencyDeltaFromProbe, roundMetric, thresholdPenalty } from './route-scoring';
import { averageMetric, calculateHandshakePenalty, calculateWireGuardScore, calculateWireGuardTelemetryScore, clientConfigIdFromRouteAssignmentKey, createUniformRouteScores, defaultSpeedProfileForProtocol, extractEndpoint, extractLoadPercent, isProtocolSpecificScoreProfile, mapWireGuardTelemetryStatus, maximumMetric, minimumMetric, normalizeAssignmentKey, normalizeRouteDecisionCountryCode, normalizeRouteGroup, numberFromConfig, protocolsForScoreProfile, roundRouteScore, roundRouteScores } from './route-metrics';
import { isBestRouteQualityWindow, isDegradedRouteQualityWindow, minimumRouteAnalyticsSamples, nextRouteQualityWindowStart, routeQualityConfidence, routeQualityPredictionLookaheadHours } from './route-quality';
import { assessRouteBufferbloat, routeBufferbloatRecommendation, routeBufferbloatSeverity, type RouteBufferbloatAssessment } from './route-bufferbloat';
import { normalizeAlertStatusParam, normalizeLimitParam, normalizeRangeHoursParam, normalizeSimpleTextParam, normalizeUuidParam } from './request-normalizers';
import { describeRouteDecisionTimelineDetail, incidentSeverityFromAlert, routeDecisionTimelineSeverity } from './timeline-severity';
import type { AuthActor } from '../security/auth-request';
import { SecretVaultService } from '../security/secret-vault.service';
import { CreateOutboundDto, UpdateOutboundDto } from './dto/outbound.dto';
import { CreateServerCredentialDto, CreateServerDto, UpdateServerDto, UpsertServerAccessProfileDto } from './dto/server.dto';
import {
  CreateServerInterfaceDto,
  CreateTunnelDto,
  UpdateServerInterfaceDto,
  UpdateTunnelDto,
} from './dto/tunnel.dto';
import {
  ApplyRouteDecisionPreviewDto,
  CreateProtocolSetupDto,
  CreateSettingsSecretDto,
  RecordProtocolServerApplyDto,
  RecordRouteDecisionPreviewDto,
  RequestProtocolServerApplyDto,
  UpsertRouteAssignmentDto,
  UpsertRouteSettingsDto,
} from './dto/settings.dto';
import { RouteQualityAggregationService } from './route-quality-aggregation.service';

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
  credentialName: string | null;
  credentialKind: string | null;
  credentialStatus: string | null;
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
  usageMultiplier: number;
  maxUsers: number | null;
  lastCheckedAt: Date | null;
  lastHealthyAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ServerInterfaceRow {
  id: string;
  serverId: string;
  serverExternalId: string | null;
  serverHostname: string | null;
  name: string;
  operator: string | null;
  kind: string;
  status: string;
  macAddress: string | null;
  addressCidr: string | null;
  linkedTunnelId: string | null;
  linkedTunnelName: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface TunnelRow {
  id: string;
  serverId: string;
  serverExternalId: string | null;
  serverHostname: string | null;
  name: string;
  type: string;
  remoteEndpoint: string | null;
  interfaceName: string | null;
  localInterfaceId: string | null;
  localInterfaceName: string | null;
  interfaceOperator: string | null;
  routeGroup: string;
  status: string;
  lockable: boolean;
  notes: string | null;
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

interface RouteQualityWindowRow {
  serverExternalId: string;
  serverHostname: string | null;
  outboundId: string | null;
  outboundKey: string | null;
  outboundName: string | null;
  operator: string | null;
  protocol: string;
  scoreProfile: string | null;
  hourOfDay: number;
  dayOfWeek: number | null;
  sampleCount: number;
  averageScore: number;
  averageLatencyMs: number | null;
  averageJitterMs: number | null;
  averagePacketLossPercent: number | null;
  degradedSamplePercent: number;
  criticalSamplePercent: number;
}

interface RouteHealthHistoryRow extends RouteQualityWindowRow {
  routeGroup: string;
  bucketStart: Date;
}

interface AlertRow {
  id: string;
  severity: string;
  status: string;
  sourceType: string;
  sourceId: string;
  sourceLabel: string | null;
  title: string;
  message: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  resolvedAt: Date | null;
}

interface ProtocolSetupRow {
  id: string;
  name: string;
  protocol: string;
  profile: string;
  routeGroup: string;
  port: number;
  status: string;
  config: Record<string, unknown> | null;
  secretRef: string | null;
  targetServerId: string | null;
  targetServerLabel: string | null;
  targetServerAccessReady: boolean;
  targetServerAccessProfileId: string | null;
  targetServerAccessAddress: string | null;
  targetServerSshPort: number | null;
  targetServerUsername: string | null;
  targetServerAccessMethod: string | null;
  targetServerCredentialRef: string | null;
  targetServerCredentialKind: string | null;
  targetServerCredentialReady: boolean;
  provisionedOutboundId: string | null;
  provisionedOutboundEnabled: boolean | null;
  provisionedOutboundMaintenanceMode: boolean | null;
  provisionedOutboundHealthStatus: string | null;
  provisionedOutboundLastCheckedAt: Date | null;
  provisionedOutboundLastHealthyAt: Date | null;
  provisionedAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type ProtocolServerApplySource = Pick<
  ProtocolSetupRow,
  'id' | 'name' | 'protocol' | 'profile' | 'routeGroup' | 'port' | 'status' | 'config'
> & {
  hasSecretRef?: boolean;
  provisionedOutboundId?: string | null;
  provisionedOutboundEnabled?: boolean | null;
  provisionedOutboundMaintenanceMode?: boolean | null;
  provisionedOutboundHealthStatus?: string | null;
  provisionedOutboundLastCheckedAt?: Date | string | null;
  provisionedOutboundLastHealthyAt?: Date | string | null;
  secretRef?: string | null;
  targetServerId?: string | null;
  targetServerLabel?: string | null;
  targetServerAccessReady?: boolean;
  targetServerAccessProfileId?: string | null;
  targetServerAccessAddress?: string | null;
  targetServerSshPort?: number | null;
  targetServerUsername?: string | null;
  targetServerAccessMethod?: string | null;
  targetServerCredentialRef?: string | null;
  targetServerCredentialKind?: string | null;
  targetServerCredentialReady?: boolean;
};

interface ProtocolApplyEventRow {
  id: string;
  protocolSetupId: string;
  protocolSetupName: string | null;
  protocol: string | null;
  profile: string | null;
  routeGroup: string | null;
  outboundId: string | null;
  targetServerId: string | null;
  targetServerLabel: string | null;
  applyMode: string;
  applyStatus: string;
  featureFlagEnabled: boolean;
  adapterImplemented: boolean;
  canExecute: boolean;
  commandCount: number;
  configChangeCount: number;
  secretSafe: boolean;
  reasonCodes: unknown;
  dryRunSnapshot?: unknown;
  createdBy: string | null;
  createdAt: Date;
}

interface RouteSettingsRow {
  routeGroup: string;
  mode: string;
  selectedOutboundId: string | null;
  selectedOutboundName: string | null;
  loadBalanceStrategy: string;
  protocolProfile: string;
  speedProfile: string;
  updatedBy: string | null;
  updatedAt: Date | null;
}

interface RouteAssignmentRow {
  routeGroup: string;
  assignmentKey: string;
  assignmentLabel: string | null;
  currentOutboundId: string | null;
  currentOutboundName: string | null;
  lockedOutboundId: string | null;
  lockedOutboundName: string | null;
  autoRouteEnabled: boolean;
  routeLocked: boolean;
  protocolProfile: string;
  speedProfile: string;
  hysteresisScoreDelta: number;
  cooldownSeconds: number;
  cooldownUntil: Date | null;
  lastDecisionAt: Date | null;
  decisionState: string;
  updatedAt: Date | null;
}

interface RouteDecisionEventRow {
  id: string;
  routeGroup: string;
  assignmentKey: string;
  decisionKind: string;
  decisionState: string;
  scoreProfile: string | null;
  fromOutboundId: string | null;
  fromOutboundName: string | null;
  toOutboundId: string | null;
  toOutboundName: string | null;
  fromScore: number | null;
  toScore: number | null;
  scoreDelta: number | null;
  hysteresisScoreDelta: number | null;
  cooldownUntil: Date | null;
  routeLocked: boolean;
  autoRouteEnabled: boolean;
  reasonCodes: unknown;
  decisionContext?: unknown;
  appliedAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
}

interface WireGuardCandidateRow {
  id: string;
  name: string;
  serverExternalId: string | null;
  serverHostname: string | null;
  serverCountry: string | null;
  serverRegion: string | null;
  routeGroup: string;
  config: Record<string, unknown> | null;
  healthStatus: string;
  latencyMs: number | null;
  jitterMs: number | null;
  packetLossPercent: number | null;
  checkedAt: Date | null;
  weight: number;
  enabled: boolean;
  maintenanceMode: boolean;
  serverHealthScore: number | null;
  serverMetricRaw: Partial<ServerMetricSnapshot> | null;
}

interface WireGuardTelemetryRow {
  serverExternalId: string;
  serverHostname: string | null;
  serverCountry: string | null;
  serverRegion: string | null;
  observedAt: Date;
  healthScore: number | null;
  metricRaw: Partial<ServerMetricSnapshot> | null;
}

interface ClientRouteDecisionPreferenceRow {
  id: string;
  clientConfigId: string;
  routeGroup: string;
  mode: string;
  detectedCountryCode: string | null;
  detectedCountrySource: string | null;
  preferredExitCountryCode: string | null;
  preferredOutboundId: string | null;
  preferredOutboundName: string | null;
  scoreProfile: string | null;
  autoDetectCountry: boolean;
  allowClientOverride: boolean;
  routeLocked: boolean;
  stickySessionProtection: boolean;
}

interface SecretRecordRow {
  secretRef: string;
  name: string;
  kind: string;
  routeGroup: string | null;
  protocol: string | null;
  fingerprint: string | null;
  status: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastRotatedAt: Date | null;
}

interface ServerCredentialRow {
  id: string;
  serverId: string;
  name: string;
  kind: string;
  status: string;
  lastUsedAt: Date | null;
  lastRotatedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ProtocolServerApplyCredentialMaterialRow {
  id: string;
  serverId: string;
  kind: string;
  encryptedPayload: string;
  status: string;
  revokedAt: Date | null;
}

interface ProtocolServerApplySecretMaterialRow {
  secretRef: string;
  kind: string;
  routeGroup: string | null;
  protocol: string | null;
  encryptedPayload: string;
  status: string;
  revokedAt: Date | null;
}

interface ProtocolServerApplyRemoteAccess {
  address: string;
  sshPort: number;
  username: string;
  credentialRef: string;
  credentialKind: string;
  privateKey: string;
}

interface ProtocolServerApplySecretMaterial {
  kind: string;
  value: string;
}

interface ProtocolServerApplyExecutionCommandResult {
  id: string;
  kind: string;
  status: 'succeeded' | 'failed' | 'skipped';
  exitCode: number | null;
  durationMs: number;
  dataPlaneMutation: boolean;
  timedOut: boolean;
}

interface ProtocolServerApplyExecutionSummary {
  status: 'accepted' | 'succeeded' | 'failed' | 'rolledBack';
  executor: 'openssh';
  startedAt: string;
  finishedAt: string;
  stagedConfigPath: string;
  configPath: string;
  commandCount: number;
  successfulCommandCount: number;
  failedCommandId: string | null;
  rollbackAttempted: boolean;
  rollbackSucceeded: boolean | null;
  dataPlaneMutationExecuted: boolean;
  steps: ProtocolServerApplyExecutionCommandResult[];
}

interface OutboundOrderRow {
  id: string;
  routeGroup: string;
}

interface RouteScoringContext {
  loadBalanceStrategy: LoadBalanceStrategy | string;
  protocolProfile: string;
  speedProfile: string;
}

interface RouteScoreResult {
  selectedProfile: RouteScoreProfile;
  selectedScore: number;
  profileScores: RouteProfileScores;
  reasons: RouteScoreReason[];
}

interface RouteScoreSignals {
  baseScore: number;
  healthStatus: string;
  latencyMs: number | null;
  jitterMs: number | null;
  packetLossPercent: number | null;
  loadedLatencyMs?: number | null;
  loadedLatencyDeltaMs?: number | null;
  loadPercent: number | null;
  routeProbes: RouteProbeMetric[];
  serverHealthScore?: number | null;
  latestHandshakeAgeSeconds?: number | null;
  enabled?: boolean;
  maintenanceMode?: boolean;
}

interface RouteMtuAssessment {
  pathMtuBytes: number | null;
  recommendedTunnelMtuBytes: number | null;
  configuredMtuBytes: number | null;
  status: RouteMtuStatus;
  recommendation: RouteMtuRecommendation;
  sessionSafe: boolean;
  reasonCodes: string[];
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
    private readonly secretVault: SecretVaultService,
    private readonly routeQualityAggregation: RouteQualityAggregationService,
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

  async storeServerCredential(
    serverId: string,
    dto: CreateServerCredentialDto,
    actor: AuthActor | undefined,
  ): Promise<StoreServerCredentialResponse> {
    const name = dto.name.trim();
    const secret = dto.secret;

    if (!name || !secret.trim()) {
      throw new BadRequestException('Credential name and secret are required');
    }

    const credentialId = randomUUID();

    await this.database.transaction(async (executor) => {
      await this.ensureServerExists(executor, serverId);

      const accessResult = await executor.query<{ id: string; credentialRef: string | null }>(
        `
          SELECT id, credential_ref AS "credentialRef"
          FROM server_access_profiles
          WHERE server_id = $1
          FOR UPDATE
        `,
        [serverId],
      );
      const accessProfile = accessResult.rows[0];

      if (!accessProfile) {
        throw new ConflictException('Server access profile must be configured before storing credentials');
      }

      const previousCredentialRef = accessProfile.credentialRef?.trim() || null;
      const encrypted = this.secretVault.encryptJson(
        {
          kind: dto.kind,
          value: secret,
        },
        this.serverCredentialEncryptionContext(serverId, credentialId, dto.kind),
      );
      const fingerprint = this.secretVault.fingerprint(secret);

      await executor.query(
        `
          INSERT INTO server_credentials (
            id, server_id, name, kind, encrypted_payload, key_id,
            fingerprint, status, last_rotated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', now())
        `,
        [
          credentialId,
          serverId,
          name,
          dto.kind,
          encrypted.payload,
          encrypted.keyId,
          fingerprint,
        ],
      );

      await executor.query(
        `
          UPDATE server_access_profiles
          SET credential_ref = $2,
              updated_at = now()
          WHERE server_id = $1
        `,
        [serverId, credentialId],
      );

      if (previousCredentialRef && previousCredentialRef !== credentialId) {
        await executor.query(
          `
            UPDATE server_credentials
            SET status = 'revoked',
                revoked_at = COALESCE(revoked_at, now()),
                updated_at = now()
            WHERE server_id = $1
              AND id::text = $2
              AND status = 'active'
          `,
          [serverId, previousCredentialRef],
        );
      }

      await this.audit.record(
        actor,
        'server.credential.store',
        'server',
        serverId,
        {
          credentialId,
          credentialKind: dto.kind,
          credentialName: name,
          replacedCredentialRef: previousCredentialRef,
          keyId: encrypted.keyId,
        },
        executor,
      );
    });

    const [server, credential] = await Promise.all([
      this.getServer(serverId),
      this.getServerCredential(credentialId),
    ]);

    return {
      server,
      credential,
    };
  }

  async listServerInterfaces(
    filters: { serverId?: string; operator?: string; status?: string; limit?: number } = {},
  ): Promise<AdminServerInterfaceSummary[]> {
    const result = await this.database.query<ServerInterfaceRow>(
      `
        SELECT
          si.id,
          si.server_id AS "serverId",
          s.external_id AS "serverExternalId",
          s.hostname AS "serverHostname",
          si.name,
          si.operator,
          si.kind,
          si.status,
          si.mac_address AS "macAddress",
          si.address_cidr AS "addressCidr",
          linked_tunnel.id AS "linkedTunnelId",
          linked_tunnel.name AS "linkedTunnelName",
          si.notes,
          si.created_at AS "createdAt",
          si.updated_at AS "updatedAt"
        FROM server_interfaces si
        JOIN servers s ON s.id = si.server_id
        LEFT JOIN LATERAL (
          SELECT id, name
          FROM tunnels
          WHERE local_interface_id = si.id
          ORDER BY created_at DESC, name ASC
          LIMIT 1
        ) linked_tunnel ON true
        WHERE ($1::uuid IS NULL OR si.server_id = $1)
          AND ($2::text IS NULL OR si.operator = $2)
          AND ($3::text IS NULL OR si.status = $3)
        ORDER BY s.external_id ASC, si.name ASC
        LIMIT $4
      `,
      [filters.serverId ?? null, filters.operator ?? null, filters.status ?? null, filters.limit ?? 200],
    );

    return result.rows.map((row) => this.mapServerInterface(row));
  }

  async getServerInterface(id: string): Promise<AdminServerInterfaceSummary> {
    const result = await this.database.query<ServerInterfaceRow>(
      `
        SELECT
          si.id,
          si.server_id AS "serverId",
          s.external_id AS "serverExternalId",
          s.hostname AS "serverHostname",
          si.name,
          si.operator,
          si.kind,
          si.status,
          si.mac_address AS "macAddress",
          si.address_cidr AS "addressCidr",
          linked_tunnel.id AS "linkedTunnelId",
          linked_tunnel.name AS "linkedTunnelName",
          si.notes,
          si.created_at AS "createdAt",
          si.updated_at AS "updatedAt"
        FROM server_interfaces si
        JOIN servers s ON s.id = si.server_id
        LEFT JOIN LATERAL (
          SELECT id, name
          FROM tunnels
          WHERE local_interface_id = si.id
          ORDER BY created_at DESC, name ASC
          LIMIT 1
        ) linked_tunnel ON true
        WHERE si.id = $1
      `,
      [id],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Server interface not found');

    return this.mapServerInterface(row);
  }

  async createServerInterface(
    dto: CreateServerInterfaceDto,
    actor: AuthActor | undefined,
  ): Promise<AdminServerInterfaceSummary> {
    try {
      const interfaceId = await this.database.transaction(async (executor) => {
        await this.ensureServerExists(executor, dto.serverId);

        const result = await executor.query<{ id: string }>(
          `
            INSERT INTO server_interfaces (
              server_id, name, operator, kind, status, mac_address, address_cidr, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
          `,
          [
            dto.serverId,
            dto.name,
            dto.operator ?? null,
            dto.kind ?? 'ethernet',
            dto.status ?? 'unknown',
            dto.macAddress ?? null,
            dto.addressCidr ?? null,
            dto.notes ?? null,
          ],
        );

        const id = result.rows[0].id;

        await this.audit.record(
          actor,
          'server_interface.create',
          'server_interface',
          id,
          {
            serverId: dto.serverId,
            name: dto.name,
            operator: dto.operator ?? null,
            status: dto.status ?? 'unknown',
          },
          executor,
        );

        return id;
      });

      return this.getServerInterface(interfaceId);
    } catch (error) {
      this.throwConflictIfUniqueViolation(error, 'Server interface name already exists for this server');
      throw error;
    }
  }

  async updateServerInterface(
    id: string,
    dto: UpdateServerInterfaceDto,
    actor: AuthActor | undefined,
  ): Promise<AdminServerInterfaceSummary> {
    try {
      await this.database.transaction(async (executor) => {
        const current = await this.ensureServerInterfaceExists(executor, id);

        if (dto.serverId) {
          await this.ensureServerExists(executor, dto.serverId);
          if (dto.serverId !== current.serverId) {
            const linked = await executor.query<{ id: string }>(
              'SELECT id FROM tunnels WHERE local_interface_id = $1 LIMIT 1',
              [id],
            );
            if (linked.rows[0]) {
              throw new BadRequestException('Linked server interfaces cannot move to another server');
            }
          }
        }

        const changedFields = await this.updateServerInterfaceFields(executor, id, dto);

        await this.audit.record(
          actor,
          'server_interface.update',
          'server_interface',
          id,
          {
            changedFields,
            serverId: dto.serverId ?? current.serverId,
          },
          executor,
        );
      });

      return this.getServerInterface(id);
    } catch (error) {
      this.throwConflictIfUniqueViolation(error, 'Server interface name already exists for this server');
      throw error;
    }
  }

  async deleteServerInterface(id: string, actor: AuthActor | undefined): Promise<void> {
    await this.database.transaction(async (executor) => {
      const result = await executor.query<{ serverId: string; name: string }>(
        'DELETE FROM server_interfaces WHERE id = $1 RETURNING server_id AS "serverId", name',
        [id],
      );
      const row = result.rows[0];

      if (!row) throw new NotFoundException('Server interface not found');

      await this.audit.record(
        actor,
        'server_interface.delete',
        'server_interface',
        id,
        {
          serverId: row.serverId,
          name: row.name,
        },
        executor,
      );
    });
  }

  async listTunnels(
    filters: { serverId?: string; routeGroup?: string; status?: string; limit?: number } = {},
  ): Promise<AdminTunnelSummary[]> {
    const result = await this.database.query<TunnelRow>(
      `
        SELECT
          t.id,
          t.server_id AS "serverId",
          s.external_id AS "serverExternalId",
          s.hostname AS "serverHostname",
          t.name,
          t.type,
          t.remote_endpoint AS "remoteEndpoint",
          t.interface_name AS "interfaceName",
          t.local_interface_id AS "localInterfaceId",
          si.name AS "localInterfaceName",
          si.operator AS "interfaceOperator",
          t.route_group AS "routeGroup",
          t.status,
          t.lockable,
          t.notes,
          t.created_at AS "createdAt",
          t.updated_at AS "updatedAt"
        FROM tunnels t
        JOIN servers s ON s.id = t.server_id
        LEFT JOIN server_interfaces si ON si.id = t.local_interface_id
        WHERE ($1::uuid IS NULL OR t.server_id = $1)
          AND ($2::text IS NULL OR t.route_group = $2)
          AND ($3::text IS NULL OR t.status = $3)
        ORDER BY t.route_group ASC, s.external_id ASC, t.name ASC
        LIMIT $4
      `,
      [filters.serverId ?? null, filters.routeGroup ?? null, filters.status ?? null, filters.limit ?? 200],
    );

    return result.rows.map((row) => this.mapTunnel(row));
  }

  async getTunnel(id: string): Promise<AdminTunnelSummary> {
    const result = await this.database.query<TunnelRow>(
      `
        SELECT
          t.id,
          t.server_id AS "serverId",
          s.external_id AS "serverExternalId",
          s.hostname AS "serverHostname",
          t.name,
          t.type,
          t.remote_endpoint AS "remoteEndpoint",
          t.interface_name AS "interfaceName",
          t.local_interface_id AS "localInterfaceId",
          si.name AS "localInterfaceName",
          si.operator AS "interfaceOperator",
          t.route_group AS "routeGroup",
          t.status,
          t.lockable,
          t.notes,
          t.created_at AS "createdAt",
          t.updated_at AS "updatedAt"
        FROM tunnels t
        JOIN servers s ON s.id = t.server_id
        LEFT JOIN server_interfaces si ON si.id = t.local_interface_id
        WHERE t.id = $1
      `,
      [id],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Tunnel not found');

    return this.mapTunnel(row);
  }

  async createTunnel(dto: CreateTunnelDto, actor: AuthActor | undefined): Promise<AdminTunnelSummary> {
    try {
      const tunnelId = await this.database.transaction(async (executor) => {
        await this.ensureServerExists(executor, dto.serverId);
        if (dto.localInterfaceId) await this.ensureServerInterfaceExists(executor, dto.localInterfaceId, dto.serverId);

        const result = await executor.query<{ id: string }>(
          `
            INSERT INTO tunnels (
              server_id, name, type, remote_endpoint, interface_name,
              local_interface_id, route_group, status, lockable, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
          `,
          [
            dto.serverId,
            dto.name,
            dto.type ?? 'wireguard',
            dto.remoteEndpoint ?? null,
            dto.interfaceName ?? null,
            dto.localInterfaceId ?? null,
            dto.routeGroup ?? 'main',
            dto.status ?? 'unknown',
            dto.lockable ?? true,
            dto.notes ?? null,
          ],
        );

        const id = result.rows[0].id;

        await this.audit.record(
          actor,
          'tunnel.create',
          'tunnel',
          id,
          {
            serverId: dto.serverId,
            routeGroup: dto.routeGroup ?? 'main',
            type: dto.type ?? 'wireguard',
            localInterfaceId: dto.localInterfaceId ?? null,
          },
          executor,
        );

        return id;
      });

      return this.getTunnel(tunnelId);
    } catch (error) {
      this.throwConflictIfUniqueViolation(error, 'Tunnel name already exists for this server');
      throw error;
    }
  }

  async updateTunnel(id: string, dto: UpdateTunnelDto, actor: AuthActor | undefined): Promise<AdminTunnelSummary> {
    try {
      await this.database.transaction(async (executor) => {
        const current = await this.ensureTunnelExists(executor, id);
        const nextServerId = dto.serverId ?? current.serverId;

        if (dto.serverId) await this.ensureServerExists(executor, dto.serverId);
        if (dto.localInterfaceId) await this.ensureServerInterfaceExists(executor, dto.localInterfaceId, nextServerId);
        if (dto.serverId && dto.serverId !== current.serverId && dto.localInterfaceId === undefined && current.localInterfaceId) {
          throw new BadRequestException('Moving a tunnel with a linked interface requires localInterfaceId to be updated or cleared');
        }

        const changedFields = await this.updateTunnelFields(executor, id, dto);

        await this.audit.record(
          actor,
          'tunnel.update',
          'tunnel',
          id,
          {
            changedFields,
            serverId: nextServerId,
          },
          executor,
        );
      });

      return this.getTunnel(id);
    } catch (error) {
      this.throwConflictIfUniqueViolation(error, 'Tunnel name already exists for this server');
      throw error;
    }
  }

  async deleteTunnel(id: string, actor: AuthActor | undefined): Promise<void> {
    await this.database.transaction(async (executor) => {
      const result = await executor.query<{ serverId: string; routeGroup: string; type: string }>(
        'DELETE FROM tunnels WHERE id = $1 RETURNING server_id AS "serverId", route_group AS "routeGroup", type',
        [id],
      );
      const row = result.rows[0];

      if (!row) throw new NotFoundException('Tunnel not found');

      await this.audit.record(
        actor,
        'tunnel.delete',
        'tunnel',
        id,
        {
          serverId: row.serverId,
          routeGroup: row.routeGroup,
          type: row.type,
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
          o.usage_multiplier AS "usageMultiplier",
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
          o.usage_multiplier AS "usageMultiplier",
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
            recovery_threshold, cooldown_seconds, weight, usage_multiplier, max_users
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15, $16)
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
          dto.usageMultiplier ?? 1,
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
          usageMultiplier: dto.usageMultiplier ?? 1,
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

  async listAlerts(
    filters: { status?: string; severity?: string; sourceType?: string; limit?: number } = {},
  ): Promise<AdminAlertSummary[]> {
    const status = this.normalizeAlertStatus(filters.status);
    const severity = this.normalizeSimpleText(filters.severity, 'severity');
    const sourceType = this.normalizeSimpleText(filters.sourceType, 'sourceType');
    const result = await this.database.query<AlertRow>(
      `
        SELECT
          a.id,
          a.severity,
          a.status,
          a.source_type AS "sourceType",
          a.source_id AS "sourceId",
          COALESCE(s.hostname, s.external_id) AS "sourceLabel",
          a.title,
          a.message,
          a.first_seen_at AS "firstSeenAt",
          a.last_seen_at AS "lastSeenAt",
          a.resolved_at AS "resolvedAt"
        FROM alerts a
        LEFT JOIN servers s
          ON a.source_type = 'server'
          AND (s.external_id = a.source_id OR s.id::text = a.source_id)
        WHERE ($1::text IS NULL OR a.status = $1::text)
          AND ($2::text IS NULL OR a.severity = $2::text)
          AND ($3::text IS NULL OR a.source_type = $3::text)
        ORDER BY
          CASE a.severity
            WHEN 'critical' THEN 0
            WHEN 'warning' THEN 1
            ELSE 2
          END,
          a.last_seen_at DESC
        LIMIT $4
      `,
      [status ?? null, severity ?? null, sourceType ?? null, filters.limit ?? 100],
    );

    return result.rows.map((row) => ({
      id: row.id,
      severity: row.severity,
      status: row.status,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      sourceLabel: row.sourceLabel,
      title: row.title,
      message: row.message,
      firstSeenAt: row.firstSeenAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
    }));
  }

  async getIncidentTimeline(rangeHours = 24, limit = 100): Promise<AdminIncidentTimelineResponse> {
    const boundedLimit = Math.max(1, Math.min(limit, 200));
    const queryLimit = Math.min(boundedLimit * 2, 500);
    const rangeStart = new Date(Date.now() - rangeHours * 60 * 60 * 1000);
    const [alertResult, routeDecisionResult] = await Promise.all([
      this.database.query<AlertRow>(
        `
          SELECT
            a.id,
            a.severity,
            a.status,
            a.source_type AS "sourceType",
            a.source_id AS "sourceId",
            COALESCE(s.hostname, s.external_id) AS "sourceLabel",
            a.title,
            a.message,
            a.first_seen_at AS "firstSeenAt",
            a.last_seen_at AS "lastSeenAt",
            a.resolved_at AS "resolvedAt"
          FROM alerts a
          LEFT JOIN servers s
            ON a.source_type = 'server'
            AND (s.external_id = a.source_id OR s.id::text = a.source_id)
          WHERE a.first_seen_at >= now() - ($1::int * interval '1 hour')
            OR a.resolved_at >= now() - ($1::int * interval '1 hour')
          ORDER BY GREATEST(a.first_seen_at, a.last_seen_at, COALESCE(a.resolved_at, a.last_seen_at)) DESC
          LIMIT $2
        `,
        [rangeHours, queryLimit],
      ),
      this.database.query<RouteDecisionEventRow>(
        `
          SELECT
            event.id,
            event.route_group AS "routeGroup",
            event.assignment_key AS "assignmentKey",
            event.decision_kind AS "decisionKind",
            event.decision_state AS "decisionState",
            event.score_profile AS "scoreProfile",
            event.from_outbound_id AS "fromOutboundId",
            from_outbound.name AS "fromOutboundName",
            event.to_outbound_id AS "toOutboundId",
            to_outbound.name AS "toOutboundName",
            event.from_score AS "fromScore",
            event.to_score AS "toScore",
            event.score_delta AS "scoreDelta",
            event.hysteresis_score_delta AS "hysteresisScoreDelta",
            event.cooldown_until AS "cooldownUntil",
            event.route_locked AS "routeLocked",
            event.auto_route_enabled AS "autoRouteEnabled",
            event.reason_codes AS "reasonCodes",
            event.applied_at AS "appliedAt",
            event.created_by AS "createdBy",
            event.created_at AS "createdAt"
          FROM route_decision_events event
          LEFT JOIN outbounds from_outbound ON from_outbound.id = event.from_outbound_id
          LEFT JOIN outbounds to_outbound ON to_outbound.id = event.to_outbound_id
          WHERE event.created_at >= now() - ($1::int * interval '1 hour')
          ORDER BY event.created_at DESC
          LIMIT $2
        `,
        [rangeHours, queryLimit],
      ),
    ]);

    const events = [
      ...alertResult.rows.flatMap((row) => this.mapAlertTimelineEvents(row, rangeStart)),
      ...routeDecisionResult.rows.map((row) => this.mapRouteDecisionTimelineEvent(row)),
    ]
      .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt) || left.id.localeCompare(right.id))
      .slice(0, boundedLimit);

    return {
      generatedAt: new Date().toISOString(),
      rangeHours,
      events,
    };
  }

  async getSettings(routeGroupInput?: string): Promise<AdminSettingsResponse> {
    const routeGroup = normalizeRouteGroup(routeGroupInput);
    const routeSettings = await this.getRouteSettings(routeGroup);

    return {
      routeSettings,
      protocolSetups: await this.listProtocolSetups(routeGroup),
      wireGuardCandidates: await this.listWireGuardCandidates(routeGroup, routeSettings),
    };
  }

  async getRouteQualityAnalytics(
    routeGroupInput?: string,
    rangeHours = 168,
  ): Promise<AdminRouteQualityAnalyticsResponse> {
    const routeGroup = normalizeRouteGroup(routeGroupInput);
    const minimumSamples = minimumRouteAnalyticsSamples(rangeHours);
    const windows = await this.listRouteQualityWindows(routeGroup, rangeHours);

    return {
      routeGroup,
      rangeHours,
      generatedAt: new Date().toISOString(),
      minimumSamples,
      windows,
      recommendations: this.buildRouteQualityRecommendations(routeGroup, windows, minimumSamples, rangeHours),
    };
  }

  async getRouteHealthHistory(
    routeGroupInput?: string,
    rangeHours = 168,
    limit = 48,
  ): Promise<AdminRouteHealthHistoryResponse> {
    const routeGroup = normalizeRouteGroup(routeGroupInput);
    let points: RouteHealthHistoryPoint[] = [];

    try {
      await this.routeQualityAggregation.aggregateRecent(routeGroup, Math.min(rangeHours, 168));
      points = (await this.queryRouteHealthHistoryPoints(routeGroup, rangeHours, limit)).map((row) =>
        this.mapRouteHealthHistoryPoint(row),
      );
    } catch (error) {
      if (!this.isUndefinedTableError(error)) throw error;
    }

    return {
      routeGroup,
      rangeHours,
      generatedAt: new Date().toISOString(),
      points,
    };
  }

  async getRouteDecisionPreview(
    routeGroupInput?: string,
    assignmentKeyInput?: string,
  ): Promise<AdminRouteDecisionPreviewResponse> {
    const routeGroup = normalizeRouteGroup(routeGroupInput);
    const assignmentKey = normalizeAssignmentKey(assignmentKeyInput);
    const [routeSettings, assignment, clientPreferenceRow] = await Promise.all([
      this.getRouteSettings(routeGroup),
      this.getRouteAssignment(routeGroup, assignmentKey),
      this.getRouteDecisionClientPreference(routeGroup, assignmentKey),
    ]);
    const scoringContext = this.applyClientRoutePreferenceScoring({
      loadBalanceStrategy: routeSettings.loadBalanceStrategy,
      protocolProfile: assignment?.protocolProfile ?? routeSettings.protocolProfile,
      speedProfile: assignment?.speedProfile ?? routeSettings.speedProfile,
    }, clientPreferenceRow);
    const candidates = await this.listWireGuardCandidates(routeGroup, scoringContext);
    const now = new Date();
    const selectedScoreProfile = this.selectRouteScoreProfile(scoringContext);
    const currentOutboundId =
      assignment?.currentOutboundId ??
      (clientPreferenceRow?.mode === 'outbound' ? clientPreferenceRow.preferredOutboundId : null) ??
      routeSettings.selectedOutboundId ??
      null;
    const lockedOutboundId =
      assignment?.lockedOutboundId ??
      (clientPreferenceRow?.routeLocked ? clientPreferenceRow.preferredOutboundId : null) ??
      (routeSettings.mode === 'manual' ? routeSettings.selectedOutboundId : null);
    const routeLocked = assignment?.routeLocked ?? clientPreferenceRow?.routeLocked ?? Boolean(routeSettings.mode === 'manual' && lockedOutboundId);
    const autoRouteEnabled = assignment?.autoRouteEnabled ?? (clientPreferenceRow ? clientPreferenceRow.mode !== 'outbound' : routeSettings.mode === 'automatic');
    const hysteresisScoreDelta = assignment?.hysteresisScoreDelta ?? 15;
    const cooldownSeconds = assignment?.cooldownSeconds ?? 180;
    const cooldownUntil = assignment?.cooldownUntil ?? null;
    const cooldownActive = Boolean(cooldownUntil && cooldownUntil.getTime() > now.getTime());
    const sortedCandidates = [...candidates].sort((left, right) => right.score - left.score);
    const healthyCandidates = sortedCandidates.filter((candidate) => this.isRouteDecisionCandidateHealthy(candidate));
    const managedHealthyCandidates = healthyCandidates.filter((candidate) => candidate.source === 'outbound');
    const preferenceSelection = this.selectClientPreferredRouteDecisionCandidate(clientPreferenceRow, {
      managedHealthyCandidates,
    });
    const recommendedCandidate =
      preferenceSelection.recommendedCandidate ??
      managedHealthyCandidates[0] ??
      healthyCandidates[0] ??
      sortedCandidates[0] ??
      null;
    const currentCandidate =
      (routeLocked && lockedOutboundId ? candidates.find((candidate) => candidate.id === lockedOutboundId) : null) ??
      (currentOutboundId ? candidates.find((candidate) => candidate.id === currentOutboundId) : null) ??
      null;
    const clientRoutePreference = clientPreferenceRow
      ? this.buildRouteDecisionClientPreferenceSummary(clientPreferenceRow, assignmentKey, {
          preferredCountryCandidateCount: preferenceSelection.preferredCountryCandidateCount,
          preferredCountryAvailable: preferenceSelection.preferredCountryAvailable,
          preferredOutboundAvailable: preferenceSelection.preferredOutboundAvailable,
          reasonCodes: preferenceSelection.reasonCodes,
        })
      : null;
    const scoreDelta = recommendedCandidate && currentCandidate
      ? Math.round(recommendedCandidate.score - currentCandidate.score)
      : recommendedCandidate ? Math.round(recommendedCandidate.score) : null;
    const currentCandidateHealthy = currentCandidate ? this.isRouteDecisionCandidateHealthy(currentCandidate) : true;
    const healthBasedSwitch = Boolean(
      currentCandidate &&
        !currentCandidateHealthy &&
        recommendedCandidate &&
        recommendedCandidate.source === 'outbound' &&
        recommendedCandidate.id !== currentCandidate.id &&
        this.isRouteDecisionCandidateHealthy(recommendedCandidate),
    );
    const reasonCodes: string[] = [...preferenceSelection.reasonCodes];
    let action: RouteDecisionAction = 'keepCurrent';

    if (candidates.length === 0) {
      action = 'insufficientCandidates';
      reasonCodes.push('no_candidates');
    } else if (!recommendedCandidate || healthyCandidates.length === 0) {
      action = 'noHealthyCandidate';
      reasonCodes.push('no_healthy_candidate');
    } else if (recommendedCandidate.source !== 'outbound') {
      action = 'noManagedCandidate';
      reasonCodes.push('agent_candidate_not_applicable');
    } else if (routeLocked) {
      action = 'routeLocked';
      reasonCodes.push('route_locked');
    } else if (!autoRouteEnabled || routeSettings.mode !== 'automatic') {
      action = 'manualMode';
      reasonCodes.push('manual_mode');
    } else if (cooldownActive) {
      action = 'cooldownActive';
      reasonCodes.push('cooldown_active');
    } else if (!currentCandidate) {
      action = 'switchRecommended';
      reasonCodes.push('no_current_candidate');
    } else if (recommendedCandidate.id === currentCandidate.id) {
      action = 'keepCurrent';
      reasonCodes.push('best_candidate_current');
    } else if (healthBasedSwitch) {
      action = 'switchRecommended';
      reasonCodes.push('current_candidate_unhealthy', 'health_based_switch');
    } else if ((scoreDelta ?? 0) >= hysteresisScoreDelta) {
      action = 'switchRecommended';
      reasonCodes.push('score_delta_meets_hysteresis');
    } else {
      action = 'keepCurrent';
      reasonCodes.push('score_delta_below_hysteresis');
    }

    if (autoRouteEnabled) reasonCodes.push('auto_route_enabled');
    if (assignment?.lastDecisionAt) reasonCodes.push('has_previous_decision_state');

    const sessionSafety = this.buildRouteDecisionSessionSafetySummary({
      action,
      selectedProfile: selectedScoreProfile,
      routeMode: routeSettings.mode,
      routeLocked,
      autoRouteEnabled,
      cooldownActive,
      currentCandidate,
      recommendedCandidate,
      healthBasedSwitch,
      scoreDelta,
      hysteresisScoreDelta,
    });
    const applyPlan = this.buildRouteDecisionApplyPlan({
      action,
      currentCandidate,
      recommendedCandidate,
      routeLocked,
      autoRouteEnabled,
      cooldownActive,
      hysteresisScoreDelta,
      healthBasedSwitch,
      sessionSafety,
      scoreDelta,
    });
    const switchEngine = this.buildRouteDecisionSwitchEngineSummary({
      action,
      currentCandidate,
      recommendedCandidate,
      routeLocked,
      autoRouteEnabled,
      routeMode: routeSettings.mode,
      cooldownActive,
      sessionSafety,
      applyPlan,
    });
    const switchPreflight = this.buildRouteDecisionSwitchPreflightSummary({
      action,
      switchEngine,
      applyPlan,
      sessionSafety,
    });
    const switchRollout = this.buildRouteDecisionSwitchRolloutSummary({
      action,
      selectedProfile: selectedScoreProfile,
      sessionSafety,
      switchEngine,
      switchPreflight,
      applyPlan,
    });
    const switchRolloutEvaluation = this.buildRouteDecisionSwitchRolloutEvaluationSummary({
      action,
      selectedProfile: selectedScoreProfile,
      evaluatedAt: now,
      recommendedCandidate,
      switchPreflight,
      switchRollout,
    });
    const switchOrchestration = this.buildRouteDecisionSwitchOrchestrationSummary({
      action,
      generatedAt: now,
      currentCandidate,
      recommendedCandidate,
      routeLocked,
      autoRouteEnabled,
      routeMode: routeSettings.mode,
      cooldownActive,
      sessionSafety,
      switchEngine,
      switchPreflight,
      switchRollout,
      switchRolloutEvaluation,
      applyPlan,
    });

    return {
      routeGroup,
      assignmentKey,
      generatedAt: now.toISOString(),
      mode: routeSettings.mode,
      autoRouteEnabled,
      routeLocked,
      selectedScoreProfile,
      hysteresisScoreDelta,
      cooldownSeconds,
      cooldownUntil: cooldownUntil?.toISOString() ?? null,
      clientRoutePreference,
      currentCandidate: this.toRouteDecisionCandidateSummary(currentCandidate),
      recommendedCandidate: this.toRouteDecisionCandidateSummary(recommendedCandidate),
      candidateReviews: this.buildRouteDecisionCandidateReviews(sortedCandidates, {
        currentCandidate,
        recommendedCandidate,
        clientRoutePreference,
        routeLocked,
        autoRouteEnabled,
        routeMode: routeSettings.mode,
        cooldownActive,
        hysteresisScoreDelta,
      }),
      profileRecommendations: this.buildRouteDecisionProfileRecommendations(sortedCandidates, selectedScoreProfile),
      loadBalancing: this.buildRouteDecisionLoadBalancingSummary(sortedCandidates, {
        ...scoringContext,
        selectedProfile: selectedScoreProfile,
      }),
      sessionSafety,
      switchEngine,
      switchPreflight,
      switchRollout,
      switchRolloutEvaluation,
      switchOrchestration,
      applyPlan,
      scoreDelta,
      action,
      reasonCodes: [...new Set(reasonCodes)],
      candidateCount: candidates.length,
      healthyCandidateCount: healthyCandidates.length,
      managedCandidateCount: sortedCandidates.filter((candidate) => candidate.source === 'outbound').length,
    };
  }

  async getRouteCanaryStatus(
    routeGroupInput?: string,
    assignmentKeyInput?: string,
  ): Promise<AdminRouteCanaryStatusResponse> {
    const preview = await this.getRouteDecisionPreview(routeGroupInput, assignmentKeyInput);
    const canaryReady =
      preview.switchOrchestration.recommendedAction === 'startCanary' ||
      preview.switchOrchestration.recommendedAction === 'expandCanary';

    return {
      routeGroup: preview.routeGroup,
      assignmentKey: preview.assignmentKey,
      generatedAt: preview.generatedAt,
      mode: preview.mode,
      autoRouteEnabled: preview.autoRouteEnabled,
      routeLocked: preview.routeLocked,
      cooldownActive: preview.switchOrchestration.cooldownActive,
      cooldownUntil: preview.cooldownUntil ?? null,
      selectedScoreProfile: preview.selectedScoreProfile,
      action: preview.action,
      recommendedAction: preview.switchOrchestration.recommendedAction,
      dataPlaneReady: preview.switchOrchestration.dataPlaneReady,
      canExecuteDataPlane: preview.switchOrchestration.canExecuteDataPlane,
      assignmentOnly: preview.switchOrchestration.assignmentOnly,
      guardReady: preview.switchRolloutEvaluation.guardPassed,
      canaryReady,
      currentCandidate: preview.currentCandidate ?? null,
      recommendedCandidate: preview.recommendedCandidate ?? null,
      switchRollout: preview.switchRollout,
      switchRolloutEvaluation: preview.switchRolloutEvaluation,
      switchOrchestration: preview.switchOrchestration,
      reasonCodes: [...new Set([
        ...preview.reasonCodes,
        ...preview.switchRollout.reasonCodes,
        ...preview.switchRolloutEvaluation.reasonCodes,
        ...preview.switchOrchestration.reasonCodes,
      ])],
    };
  }

  private async getRouteDecisionClientPreference(
    routeGroup: string,
    assignmentKey: string,
  ): Promise<ClientRouteDecisionPreferenceRow | null> {
    const clientConfigId = clientConfigIdFromRouteAssignmentKey(assignmentKey);
    if (!clientConfigId) return null;

    const result = await this.database.query<ClientRouteDecisionPreferenceRow>(
      `
        SELECT
          preference.id,
          preference.client_config_id AS "clientConfigId",
          preference.route_group AS "routeGroup",
          preference.mode,
          preference.detected_country_code AS "detectedCountryCode",
          preference.detected_country_source AS "detectedCountrySource",
          preference.preferred_exit_country_code AS "preferredExitCountryCode",
          preference.preferred_outbound_id AS "preferredOutboundId",
          preferred_outbound.name AS "preferredOutboundName",
          preference.score_profile AS "scoreProfile",
          preference.auto_detect_country AS "autoDetectCountry",
          preference.allow_client_override AS "allowClientOverride",
          preference.route_locked AS "routeLocked",
          preference.sticky_session_protection AS "stickySessionProtection"
        FROM client_route_preferences preference
        LEFT JOIN outbounds preferred_outbound ON preferred_outbound.id = preference.preferred_outbound_id
        WHERE preference.client_config_id = $1
          AND preference.route_group = $2
        LIMIT 1
      `,
      [clientConfigId, routeGroup],
    );

    return result.rows[0] ?? null;
  }

  private applyClientRoutePreferenceScoring(
    scoringContext: RouteScoringContext,
    preference: ClientRouteDecisionPreferenceRow | null,
  ): RouteScoringContext {
    const scoreProfile = this.normalizeRouteScoreProfile(preference?.scoreProfile);
    if (!scoreProfile) return scoringContext;

    if (scoreProfile === 'throughput') {
      return {
        loadBalanceStrategy: 'throughput',
        protocolProfile: 'highSpeed',
        speedProfile: 'highSpeed',
      };
    }
    if (scoreProfile === 'stability') {
      return {
        loadBalanceStrategy: 'stability',
        protocolProfile: 'balanced',
        speedProfile: 'balanced',
      };
    }
    if (scoreProfile === 'gaming') {
      return {
        ...scoringContext,
        protocolProfile: 'gaming',
        speedProfile: 'gaming',
      };
    }
    if (isProtocolSpecificScoreProfile(scoreProfile)) {
      return {
        ...scoringContext,
        protocolProfile: scoreProfile,
        speedProfile: 'balanced',
      };
    }

    return scoringContext;
  }

  private selectClientPreferredRouteDecisionCandidate(
    preference: ClientRouteDecisionPreferenceRow | null,
    candidates: {
      managedHealthyCandidates: AdminWireGuardCandidate[];
    },
  ): {
    recommendedCandidate: AdminWireGuardCandidate | null;
    preferredCountryCandidateCount: number;
    preferredCountryAvailable: boolean;
    preferredOutboundAvailable: boolean;
    reasonCodes: string[];
  } {
    if (!preference) {
      return {
        recommendedCandidate: null,
        preferredCountryCandidateCount: 0,
        preferredCountryAvailable: false,
        preferredOutboundAvailable: false,
        reasonCodes: [],
      };
    }

    const reasonCodes = new Set<string>(['client_route_preference']);
    const preferredCountry = normalizeRouteDecisionCountryCode(preference.preferredExitCountryCode);
    const detectedCountry = normalizeRouteDecisionCountryCode(preference.detectedCountryCode);
    const preferredCountryCandidates = preferredCountry
      ? candidates.managedHealthyCandidates.filter((candidate) => this.routeDecisionCandidateCountry(candidate) === preferredCountry)
      : [];
    const preferredOutboundCandidate = preference.preferredOutboundId
      ? candidates.managedHealthyCandidates.find((candidate) => candidate.id === preference.preferredOutboundId) ?? null
      : null;

    if (detectedCountry) reasonCodes.add('detected_country_context');
    if (this.normalizeRouteScoreProfile(preference.scoreProfile)) reasonCodes.add('client_score_profile_context');

    if (preference.mode === 'outbound' && preference.preferredOutboundId) {
      if (preferredOutboundCandidate) {
        reasonCodes.add('preferred_outbound_applied');

        return {
          recommendedCandidate: preferredOutboundCandidate,
          preferredCountryCandidateCount: preferredCountryCandidates.length,
          preferredCountryAvailable: preferredCountryCandidates.length > 0,
          preferredOutboundAvailable: true,
          reasonCodes: [...reasonCodes],
        };
      }

      reasonCodes.add('preferred_outbound_unavailable');
    }

    if (preference.mode === 'country' && preferredCountry) {
      if (preferredCountryCandidates.length > 0) {
        reasonCodes.add('preferred_country_applied');

        return {
          recommendedCandidate: preferredCountryCandidates[0],
          preferredCountryCandidateCount: preferredCountryCandidates.length,
          preferredCountryAvailable: true,
          preferredOutboundAvailable: Boolean(preferredOutboundCandidate),
          reasonCodes: [...reasonCodes],
        };
      }

      reasonCodes.add('preferred_country_unavailable');
    }

    return {
      recommendedCandidate: null,
      preferredCountryCandidateCount: preferredCountryCandidates.length,
      preferredCountryAvailable: preferredCountryCandidates.length > 0,
      preferredOutboundAvailable: Boolean(preferredOutboundCandidate),
      reasonCodes: [...reasonCodes],
    };
  }

  private buildRouteDecisionClientPreferenceSummary(
    preference: ClientRouteDecisionPreferenceRow,
    assignmentKey: string,
    availability: {
      preferredCountryCandidateCount: number;
      preferredCountryAvailable: boolean;
      preferredOutboundAvailable: boolean;
      reasonCodes: string[];
    },
  ): AdminRouteDecisionClientPreferenceSummary {
    return {
      source: 'clientRoutePreference',
      clientConfigId: preference.clientConfigId,
      routeGroup: preference.routeGroup,
      assignmentKey,
      mode: preference.mode,
      detectedCountryCode: normalizeRouteDecisionCountryCode(preference.detectedCountryCode),
      detectedCountrySource: preference.detectedCountrySource,
      preferredExitCountryCode: normalizeRouteDecisionCountryCode(preference.preferredExitCountryCode),
      preferredOutboundId: preference.preferredOutboundId,
      preferredOutboundName: preference.preferredOutboundName,
      scoreProfile: this.normalizeRouteScoreProfile(preference.scoreProfile) ?? 'balanced',
      autoDetectCountry: preference.autoDetectCountry,
      allowClientOverride: preference.allowClientOverride,
      routeLocked: preference.routeLocked,
      stickySessionProtection: preference.stickySessionProtection,
      preferredCountryCandidateCount: availability.preferredCountryCandidateCount,
      preferredCountryAvailable: availability.preferredCountryAvailable,
      preferredOutboundAvailable: availability.preferredOutboundAvailable,
      reasonCodes: availability.reasonCodes,
    };
  }

  private routeDecisionPreferenceReasonCodes(
    candidate: AdminWireGuardCandidate,
    preference: AdminRouteDecisionClientPreferenceSummary | null,
  ): string[] {
    if (!preference) return [];

    const reasonCodes = new Set<string>();

    if (preference.mode === 'country' && preference.preferredExitCountryCode && candidate.source === 'outbound') {
      reasonCodes.add(
        this.routeDecisionCandidateCountry(candidate) === preference.preferredExitCountryCode
          ? 'preferred_country_match'
          : 'preferred_country_mismatch',
      );
    }
    if (preference.mode === 'outbound' && preference.preferredOutboundId && candidate.source === 'outbound') {
      reasonCodes.add(
        candidate.id === preference.preferredOutboundId
          ? 'preferred_outbound_match'
          : 'preferred_outbound_mismatch',
      );
    }

    return [...reasonCodes];
  }

  private isRouteDecisionPreferenceMismatch(
    candidate: AdminWireGuardCandidate,
    preference: AdminRouteDecisionClientPreferenceSummary | null,
  ): boolean {
    if (!preference || candidate.source !== 'outbound') return false;

    if (preference.mode === 'country' && preference.preferredExitCountryCode && preference.preferredCountryAvailable) {
      return this.routeDecisionCandidateCountry(candidate) !== preference.preferredExitCountryCode;
    }
    if (preference.mode === 'outbound' && preference.preferredOutboundId && preference.preferredOutboundAvailable) {
      return candidate.id !== preference.preferredOutboundId;
    }

    return false;
  }

  async getRouteAssignmentSummary(
    routeGroupInput?: string,
    assignmentKeyInput?: string,
  ): Promise<AdminRouteAssignmentSummary> {
    const routeGroup = normalizeRouteGroup(routeGroupInput);
    const assignmentKey = normalizeAssignmentKey(assignmentKeyInput);
    const routeSettings = await this.getRouteSettings(routeGroup);
    const assignment = await this.getRouteAssignment(routeGroup, assignmentKey);

    return this.mapRouteAssignmentSummary(routeGroup, assignmentKey, routeSettings, assignment);
  }

  async upsertRouteAssignment(
    dto: UpsertRouteAssignmentDto,
    actor: AuthActor | undefined,
  ): Promise<AdminRouteAssignmentSummary> {
    const routeGroup = normalizeRouteGroup(dto.routeGroup);
    const assignmentKey = normalizeAssignmentKey(dto.assignmentKey);
    const assignmentLabel = dto.assignmentLabel?.trim() || null;
    const currentOutboundId = dto.currentOutboundId ?? null;
    let lockedOutboundId = dto.lockedOutboundId ?? null;
    const routeLocked = dto.routeLocked ?? false;
    const protocolProfile = dto.protocolProfile ?? 'balanced';
    const speedProfile = dto.speedProfile ?? defaultSpeedProfileForProtocol(protocolProfile);
    const hysteresisScoreDelta = dto.hysteresisScoreDelta ?? 15;
    const cooldownSeconds = dto.cooldownSeconds ?? 180;

    if (routeLocked && !lockedOutboundId) {
      lockedOutboundId = currentOutboundId;
    }
    if (routeLocked && !lockedOutboundId) {
      throw new BadRequestException('lockedOutboundId is required when routeLocked is true');
    }

    await this.database.transaction(async (executor) => {
      if (currentOutboundId) await this.ensureRouteOutboundCandidate(executor, currentOutboundId, routeGroup);
      if (lockedOutboundId) await this.ensureRouteOutboundCandidate(executor, lockedOutboundId, routeGroup);

      await executor.query(
        `
          INSERT INTO route_assignments (
            route_group, assignment_key, assignment_label, current_outbound_id,
            locked_outbound_id, auto_route_enabled, route_locked, protocol_profile,
            speed_profile, hysteresis_score_delta, cooldown_seconds, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
          ON CONFLICT (route_group, assignment_key)
          DO UPDATE SET
            assignment_label = excluded.assignment_label,
            current_outbound_id = excluded.current_outbound_id,
            locked_outbound_id = excluded.locked_outbound_id,
            auto_route_enabled = excluded.auto_route_enabled,
            route_locked = excluded.route_locked,
            protocol_profile = excluded.protocol_profile,
            speed_profile = excluded.speed_profile,
            hysteresis_score_delta = excluded.hysteresis_score_delta,
            cooldown_seconds = excluded.cooldown_seconds,
            updated_at = now()
        `,
        [
          routeGroup,
          assignmentKey,
          assignmentLabel,
          currentOutboundId,
          lockedOutboundId,
          dto.autoRouteEnabled ?? true,
          routeLocked,
          protocolProfile,
          speedProfile,
          hysteresisScoreDelta,
          cooldownSeconds,
        ],
      );

      await this.audit.record(
        actor,
        'route.assignment.update',
        'route_assignment',
        `${routeGroup}:${assignmentKey}`,
        {
          routeGroup,
          assignmentKey,
          currentOutboundId,
          lockedOutboundId,
          autoRouteEnabled: dto.autoRouteEnabled ?? true,
          routeLocked,
          protocolProfile,
          speedProfile,
          hysteresisScoreDelta,
          cooldownSeconds,
          liveApply: false,
        },
        executor,
      );
    });

    return this.getRouteAssignmentSummary(routeGroup, assignmentKey);
  }

  async recordRouteDecisionPreview(
    dto: RecordRouteDecisionPreviewDto,
    actor: AuthActor | undefined,
  ): Promise<RecordRouteDecisionPreviewResponse> {
    const routeGroup = normalizeRouteGroup(dto.routeGroup);
    const assignmentKey = normalizeAssignmentKey(dto.assignmentKey);
    const preview = await this.getRouteDecisionPreview(routeGroup, assignmentKey);
    const eventId = randomUUID();
    const fromOutboundId = preview.currentCandidate?.source === 'outbound' ? preview.currentCandidate.id : null;
    const toOutboundId = preview.recommendedCandidate?.source === 'outbound' ? preview.recommendedCandidate.id : null;
    const decisionContext = {
      advisory: true,
      liveApply: false,
      generatedAt: preview.generatedAt,
      mode: preview.mode,
      cooldownSeconds: preview.cooldownSeconds,
      candidateCount: preview.candidateCount,
      healthyCandidateCount: preview.healthyCandidateCount,
      managedCandidateCount: preview.managedCandidateCount,
      clientRoutePreference: preview.clientRoutePreference,
      currentCandidate: preview.currentCandidate,
      recommendedCandidate: preview.recommendedCandidate,
      candidateReviews: preview.candidateReviews,
      profileRecommendations: preview.profileRecommendations,
      loadBalancing: preview.loadBalancing,
      sessionSafety: preview.sessionSafety,
      switchEngine: preview.switchEngine,
      switchPreflight: preview.switchPreflight,
      switchRollout: preview.switchRollout,
      switchRolloutEvaluation: preview.switchRolloutEvaluation,
      switchOrchestration: preview.switchOrchestration,
      applyPlan: preview.applyPlan,
      dryRunSnapshot: this.buildRouteDecisionDryRunSnapshot(preview),
    };

    await this.database.transaction(async (executor) => {
      await executor.query(
        `
          INSERT INTO route_decision_events (
            id, route_group, assignment_key, decision_kind, decision_state,
            score_profile, from_outbound_id, to_outbound_id, from_score,
            to_score, score_delta, hysteresis_score_delta, cooldown_until,
            route_locked, auto_route_enabled, reason_codes, decision_context,
            created_by
          )
          VALUES (
            $1, $2, $3, 'preview', $4,
            $5, $6, $7, $8,
            $9, $10, $11, $12,
            $13, $14, $15::jsonb, $16::jsonb,
            $17
          )
        `,
        [
          eventId,
          routeGroup,
          assignmentKey,
          preview.action,
          preview.selectedScoreProfile ?? null,
          fromOutboundId,
          toOutboundId,
          preview.currentCandidate?.score ?? null,
          preview.recommendedCandidate?.score ?? null,
          preview.scoreDelta ?? null,
          preview.hysteresisScoreDelta,
          preview.cooldownUntil ? new Date(preview.cooldownUntil) : null,
          preview.routeLocked,
          preview.autoRouteEnabled,
          JSON.stringify(preview.reasonCodes),
          JSON.stringify(decisionContext),
          actor?.username ?? actor?.id ?? null,
        ],
      );

      await executor.query(
        `
          INSERT INTO route_assignments (
            route_group, assignment_key, current_outbound_id, locked_outbound_id,
            auto_route_enabled, route_locked, protocol_profile, speed_profile,
            hysteresis_score_delta, cooldown_seconds, last_decision_event_id,
            last_decision_at, decision_state, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'balanced', $8, $9, $10, now(), $11, now())
          ON CONFLICT (route_group, assignment_key)
          DO UPDATE SET
            last_decision_event_id = excluded.last_decision_event_id,
            last_decision_at = excluded.last_decision_at,
            decision_state = excluded.decision_state,
            updated_at = now()
        `,
        [
          routeGroup,
          assignmentKey,
          fromOutboundId,
          preview.routeLocked ? fromOutboundId : null,
          preview.autoRouteEnabled,
          preview.routeLocked,
          preview.selectedScoreProfile ?? 'balanced',
          preview.hysteresisScoreDelta,
          preview.cooldownSeconds,
          eventId,
          preview.action,
        ],
      );

      await this.audit.record(
        actor,
        'route.decision.preview.record',
        'route_decision_event',
        eventId,
        {
          routeGroup,
          assignmentKey,
          action: preview.action,
          fromOutboundId,
          toOutboundId,
          scoreDelta: preview.scoreDelta ?? null,
          reasonCodes: preview.reasonCodes,
          dryRunCommandCount: preview.applyPlan.adapter.dryRunCommands.length,
          dryRunConfigChangeCount: preview.applyPlan.adapter.dryRunConfigChanges.length,
          liveApply: false,
        },
        executor,
      );
    });

    return {
      event: await this.getRouteDecisionEvent(eventId),
      preview: await this.getRouteDecisionPreview(routeGroup, assignmentKey),
    };
  }

  async applyRouteDecisionPreview(
    dto: ApplyRouteDecisionPreviewDto,
    actor: AuthActor | undefined,
  ): Promise<ApplyRouteDecisionPreviewResponse> {
    const applyMode = (dto.applyMode ?? 'assignmentOnly') as 'assignmentOnly';
    if (applyMode !== 'assignmentOnly') {
      throw new BadRequestException('Only assignmentOnly route decision apply mode is currently supported');
    }

    const routeGroup = normalizeRouteGroup(dto.routeGroup);
    const assignmentKey = normalizeAssignmentKey(dto.assignmentKey);
    const preview = await this.getRouteDecisionPreview(routeGroup, assignmentKey);
    const toOutboundId = preview.recommendedCandidate?.source === 'outbound' ? preview.recommendedCandidate.id : null;
    const fromOutboundId = preview.currentCandidate?.source === 'outbound' ? preview.currentCandidate.id : null;

    const blockReasons = this.routeDecisionApplyBlockReasons(preview);
    if (blockReasons.length > 0 || !toOutboundId) {
      throw new ConflictException(`Route decision is not ready to apply: ${[...blockReasons, ...(toOutboundId ? [] : ['no_managed_candidate'])].join(', ')}`);
    }

    const eventId = randomUUID();
    const appliedAt = new Date();
    const cooldownUntil = new Date(appliedAt.getTime() + preview.cooldownSeconds * 1000);
    const reasonCodes = [...new Set([...preview.reasonCodes, 'assignment_apply_requested', 'assignment_only_apply', 'data_plane_not_applied'])];
    const selectedScoreProfile = preview.selectedScoreProfile ?? 'balanced';
    const switchExecution = this.buildRouteDecisionSwitchExecutionSummary({
      preview,
      appliedAt,
      cooldownUntil,
      assignmentApplied: true,
      dataPlaneApplied: false,
    });
    const decisionContext = {
      advisory: false,
      applyMode,
      assignmentApplied: true,
      dataPlaneApplied: false,
      liveApply: false,
      generatedAt: preview.generatedAt,
      appliedAt: appliedAt.toISOString(),
      cooldownSeconds: preview.cooldownSeconds,
      candidateCount: preview.candidateCount,
      healthyCandidateCount: preview.healthyCandidateCount,
      managedCandidateCount: preview.managedCandidateCount,
      clientRoutePreference: preview.clientRoutePreference,
      currentCandidate: preview.currentCandidate,
      recommendedCandidate: preview.recommendedCandidate,
      candidateReviews: preview.candidateReviews,
      profileRecommendations: preview.profileRecommendations,
      loadBalancing: preview.loadBalancing,
      sessionSafety: preview.sessionSafety,
      switchEngine: preview.switchEngine,
      switchPreflight: preview.switchPreflight,
      switchRollout: preview.switchRollout,
      switchRolloutEvaluation: preview.switchRolloutEvaluation,
      switchOrchestration: preview.switchOrchestration,
      switchExecution,
      applyPlan: preview.applyPlan,
      dryRunSnapshot: this.buildRouteDecisionDryRunSnapshot(preview),
    };

    await this.database.transaction(async (executor) => {
      await this.ensureRouteOutboundCandidate(executor, toOutboundId, routeGroup);

      await executor.query(
        `
          INSERT INTO route_decision_events (
            id, route_group, assignment_key, decision_kind, decision_state,
            score_profile, from_outbound_id, to_outbound_id, from_score,
            to_score, score_delta, hysteresis_score_delta, cooldown_until,
            route_locked, auto_route_enabled, reason_codes, decision_context,
            applied_at, created_by
          )
          VALUES (
            $1, $2, $3, 'assignment_apply', $4,
            $5, $6, $7, $8,
            $9, $10, $11, $12,
            $13, $14, $15::jsonb, $16::jsonb,
            $17, $18
          )
        `,
        [
          eventId,
          routeGroup,
          assignmentKey,
          preview.action,
          selectedScoreProfile,
          fromOutboundId,
          toOutboundId,
          preview.currentCandidate?.score ?? null,
          preview.recommendedCandidate?.score ?? null,
          preview.scoreDelta ?? null,
          preview.hysteresisScoreDelta,
          cooldownUntil,
          preview.routeLocked,
          preview.autoRouteEnabled,
          JSON.stringify(reasonCodes),
          JSON.stringify(decisionContext),
          appliedAt,
          actor?.username ?? actor?.id ?? null,
        ],
      );

      await executor.query(
        `
          INSERT INTO route_assignments (
            route_group, assignment_key, current_outbound_id,
            auto_route_enabled, route_locked, protocol_profile, speed_profile,
            hysteresis_score_delta, cooldown_seconds, cooldown_until,
            last_decision_event_id, last_decision_at, decision_state, updated_at
          )
          VALUES ($1, $2, $3, $4, false, $5, $6, $7, $8, $9, $10, now(), $11, now())
          ON CONFLICT (route_group, assignment_key)
          DO UPDATE SET
            current_outbound_id = excluded.current_outbound_id,
            cooldown_until = excluded.cooldown_until,
            last_decision_event_id = excluded.last_decision_event_id,
            last_decision_at = excluded.last_decision_at,
            decision_state = excluded.decision_state,
            updated_at = now()
        `,
        [
          routeGroup,
          assignmentKey,
          toOutboundId,
          preview.autoRouteEnabled,
          selectedScoreProfile,
          defaultSpeedProfileForProtocol(selectedScoreProfile),
          preview.hysteresisScoreDelta,
          preview.cooldownSeconds,
          cooldownUntil,
          eventId,
          preview.action,
        ],
      );

      await this.audit.record(
        actor,
        'route.decision.assignment.apply',
        'route_decision_event',
        eventId,
        {
          routeGroup,
          assignmentKey,
          action: preview.action,
          fromOutboundId,
          toOutboundId,
          scoreDelta: preview.scoreDelta ?? null,
          reasonCodes,
          applyMode,
          assignmentApplied: true,
          dataPlaneApplied: false,
          switchExecutionStatus: switchExecution.status,
          switchExecutionPhase: switchExecution.phase,
          switchExecutionFutureStepCount: switchExecution.futureStepIds.length,
          dryRunCommandCount: preview.applyPlan.adapter.dryRunCommands.length,
          dryRunConfigChangeCount: preview.applyPlan.adapter.dryRunConfigChanges.length,
          liveApply: false,
        },
        executor,
      );
    });

    return {
      event: await this.getRouteDecisionEvent(eventId),
      preview: await this.getRouteDecisionPreview(routeGroup, assignmentKey),
      assignment: await this.getRouteAssignmentSummary(routeGroup, assignmentKey),
      applyMode,
      assignmentApplied: true,
      dataPlaneApplied: false,
      switchExecution,
      reasonCodes,
    };
  }

  async listRouteDecisionEvents(
    filters: { routeGroup?: string; assignmentKey?: string; limit?: number } = {},
  ): Promise<AdminRouteDecisionEventSummary[]> {
    const routeGroup = filters.routeGroup ? normalizeRouteGroup(filters.routeGroup) : undefined;
    const assignmentKey = filters.assignmentKey ? normalizeAssignmentKey(filters.assignmentKey) : undefined;
    const result = await this.database.query<RouteDecisionEventRow>(
      `
        SELECT
          event.id,
          event.route_group AS "routeGroup",
          event.assignment_key AS "assignmentKey",
          event.decision_kind AS "decisionKind",
          event.decision_state AS "decisionState",
          event.score_profile AS "scoreProfile",
          event.from_outbound_id AS "fromOutboundId",
          from_outbound.name AS "fromOutboundName",
          event.to_outbound_id AS "toOutboundId",
          to_outbound.name AS "toOutboundName",
          event.from_score AS "fromScore",
          event.to_score AS "toScore",
          event.score_delta AS "scoreDelta",
          event.hysteresis_score_delta AS "hysteresisScoreDelta",
          event.cooldown_until AS "cooldownUntil",
          event.route_locked AS "routeLocked",
          event.auto_route_enabled AS "autoRouteEnabled",
          event.reason_codes AS "reasonCodes",
          event.applied_at AS "appliedAt",
          event.created_by AS "createdBy",
          event.created_at AS "createdAt"
        FROM route_decision_events event
        LEFT JOIN outbounds from_outbound ON from_outbound.id = event.from_outbound_id
        LEFT JOIN outbounds to_outbound ON to_outbound.id = event.to_outbound_id
        WHERE ($1::text IS NULL OR event.route_group = $1)
          AND ($2::text IS NULL OR event.assignment_key = $2)
        ORDER BY event.created_at DESC
        LIMIT $3
      `,
      [routeGroup ?? null, assignmentKey ?? null, filters.limit ?? 50],
    );

    return result.rows.map((row) => this.mapRouteDecisionEvent(row));
  }

  async getRouteDecisionEventDetail(id: string): Promise<AdminRouteDecisionEventDetail> {
    const result = await this.database.query<RouteDecisionEventRow>(
      `
        SELECT
          event.id,
          event.route_group AS "routeGroup",
          event.assignment_key AS "assignmentKey",
          event.decision_kind AS "decisionKind",
          event.decision_state AS "decisionState",
          event.score_profile AS "scoreProfile",
          event.from_outbound_id AS "fromOutboundId",
          from_outbound.name AS "fromOutboundName",
          event.to_outbound_id AS "toOutboundId",
          to_outbound.name AS "toOutboundName",
          event.from_score AS "fromScore",
          event.to_score AS "toScore",
          event.score_delta AS "scoreDelta",
          event.hysteresis_score_delta AS "hysteresisScoreDelta",
          event.cooldown_until AS "cooldownUntil",
          event.route_locked AS "routeLocked",
          event.auto_route_enabled AS "autoRouteEnabled",
          event.reason_codes AS "reasonCodes",
          event.decision_context AS "decisionContext",
          event.applied_at AS "appliedAt",
          event.created_by AS "createdBy",
          event.created_at AS "createdAt"
        FROM route_decision_events event
        LEFT JOIN outbounds from_outbound ON from_outbound.id = event.from_outbound_id
        LEFT JOIN outbounds to_outbound ON to_outbound.id = event.to_outbound_id
        WHERE event.id = $1
      `,
      [id],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Route decision event not found');

    return this.mapRouteDecisionEventDetail(row);
  }

  async createSettingsSecret(
    dto: CreateSettingsSecretDto,
    actor: AuthActor | undefined,
  ): Promise<AdminSecretRefSummary> {
    this.assertSuperadmin(actor);

    const routeGroup = normalizeRouteGroup(dto.routeGroup);
    const name = dto.name.trim();
    const secret = dto.secret.trim();

    if (!name || !secret) throw new BadRequestException('Secret name and value are required');

    const secretRef = `secret:${randomUUID()}`;
    const encryptionContext = this.secretEncryptionContext(secretRef, dto.kind, routeGroup, dto.protocol ?? null);
    const encrypted = this.secretVault.encryptJson(
      {
        kind: dto.kind,
        value: secret,
      },
      encryptionContext,
    );
    const fingerprint = this.secretVault.fingerprint(secret);

    await this.database.transaction(async (executor) => {
      await executor.query(
        `
          INSERT INTO secret_records (
            secret_ref, name, kind, scope, route_group, protocol,
            encrypted_payload, key_id, fingerprint, created_by
          )
          VALUES ($1, $2, $3, 'settings', $4, $5, $6, $7, $8, $9)
        `,
        [
          secretRef,
          name,
          dto.kind,
          routeGroup,
          dto.protocol ?? null,
          encrypted.payload,
          encrypted.keyId,
          fingerprint,
          actor?.username ?? actor?.id ?? null,
        ],
      );

      await this.audit.record(
        actor,
        'settings.secret.create',
        'secret_record',
        secretRef,
        {
          kind: dto.kind,
          routeGroup,
          protocol: dto.protocol ?? null,
          keyId: encrypted.keyId,
          fingerprint,
        },
        executor,
      );
    });

    return this.getSecretRef(secretRef);
  }

  async createProtocolSetup(
    dto: CreateProtocolSetupDto,
    actor: AuthActor | undefined,
  ): Promise<AdminProtocolSetupSummary> {
    this.assertSuperadmin(actor);
    this.assertSafeConfig(dto.config);

    const routeGroup = normalizeRouteGroup(dto.routeGroup);
    const protocolSetupId = await this.database.transaction(async (executor) => {
      const secretRef = dto.secretRef?.trim() || null;
      const targetServerId = dto.targetServerId?.trim() || null;
      if (secretRef) await this.ensureSecretRefExists(executor, secretRef, routeGroup, dto.protocol);
      if (targetServerId) await this.ensureServerExists(executor, targetServerId);

      const result = await executor.query<{ id: string }>(
        `
          INSERT INTO protocol_setups (
            name, protocol, profile, route_group, port, config, secret_ref, target_server_id, created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
          RETURNING id
        `,
        [
          dto.name.trim(),
          dto.protocol,
          dto.profile,
          routeGroup,
          dto.port,
          JSON.stringify(dto.config ?? {}),
          secretRef,
          targetServerId,
          actor?.username ?? actor?.id ?? null,
        ],
      );
      const id = result.rows[0].id;

      await this.audit.record(
        actor,
        'settings.protocol.create',
        'protocol_setup',
        id,
        {
          protocol: dto.protocol,
          profile: dto.profile,
          routeGroup,
          hasSecretRef: Boolean(secretRef),
          targetServerId,
        },
        executor,
      );

      return id;
    }).catch((error) => {
      this.throwConflictIfUniqueViolation(error, 'Protocol setup name already exists for this route group');
      throw error;
    });

    return this.getProtocolSetup(protocolSetupId);
  }

  async provisionProtocolSetup(
    id: string,
    actor: AuthActor | undefined,
  ): Promise<ProvisionProtocolSetupResponse> {
    this.assertSuperadmin(actor);

    const provisioned = await this.database.transaction(async (executor) => {
      const setup = await this.getProtocolSetupForUpdate(executor, id);
      const routeGroup = normalizeRouteGroup(setup.routeGroup);

      if (setup.provisionedOutboundId) {
        const existing = await executor.query<{ id: string }>('SELECT id FROM outbounds WHERE id = $1', [
          setup.provisionedOutboundId,
        ]);

        if (existing.rows[0]) {
          await this.audit.record(
            actor,
            'settings.protocol.provision',
            'protocol_setup',
            setup.id,
            {
              protocol: setup.protocol,
              profile: setup.profile,
              routeGroup,
              outboundId: setup.provisionedOutboundId,
              idempotent: true,
            },
            executor,
          );

          return {
            protocolSetupId: setup.id,
            outboundId: setup.provisionedOutboundId,
          };
        }
      }

      if (setup.secretRef) {
        await this.ensureSecretRefExists(executor, setup.secretRef, routeGroup, setup.protocol);
      } else if (setup.protocol === 'wireguard') {
        throw new BadRequestException('WireGuard provisioning requires an encrypted private-key reference');
      }

      const outboundConfig = this.buildProvisionedOutboundConfig(setup);
      this.assertSafeConfig(outboundConfig);

      const priority = await this.nextOutboundPriority(executor, routeGroup);
      const outboundType = this.protocolToOutboundType(setup.protocol);
      const outbound = await executor.query<{ id: string }>(
        `
          INSERT INTO outbounds (
            server_id, name, type, route_group, priority, enabled, maintenance_mode,
            config, secret_ref, health_interval_seconds, fail_threshold,
            recovery_threshold, cooldown_seconds, weight, max_users, health_status
          )
          VALUES ($1, $2, $3, $4, $5, false, true, $6::jsonb, $7, $8, $9, $10, $11, $12, NULL, 'unknown')
          RETURNING id
        `,
        [
          setup.targetServerId,
          setup.name,
          outboundType,
          routeGroup,
          priority,
          JSON.stringify(outboundConfig),
          setup.secretRef,
          60,
          3,
          3,
          120,
          this.profileToOutboundWeight(setup.profile),
        ],
      );
      const outboundId = outbound.rows[0].id;

      await executor.query(
        `
          UPDATE protocol_setups
          SET status = 'provisioned',
              provisioned_outbound_id = $2,
              provisioned_at = now(),
              updated_at = now()
          WHERE id = $1
        `,
        [setup.id, outboundId],
      );

      await this.audit.record(
        actor,
        'settings.protocol.provision',
        'protocol_setup',
        setup.id,
        {
          protocol: setup.protocol,
          profile: setup.profile,
          routeGroup,
          outboundId,
          outboundType,
          targetServerId: setup.targetServerId,
          hasSecretRef: Boolean(setup.secretRef),
          enabled: false,
          maintenanceMode: true,
        },
        executor,
      );

      return {
        protocolSetupId: setup.id,
        outboundId,
      };
    });

    const protocolSetup = await this.getProtocolSetup(provisioned.protocolSetupId);
    const outbound = await this.getOutbound(provisioned.outboundId);

    return {
      protocolSetup,
      outbound,
      serverApplyPlan: protocolSetup.serverApplyPlan ?? this.buildProtocolServerApplyPlan(protocolSetup),
    };
  }

  async recordProtocolServerApplyDryRun(
    id: string,
    dto: RecordProtocolServerApplyDto,
    actor: AuthActor | undefined,
  ): Promise<RecordProtocolServerApplyResponse> {
    this.assertSuperadmin(actor);

    const applyMode = (dto?.applyMode ?? 'dryRun') as 'dryRun';
    if (applyMode !== 'dryRun') {
      throw new BadRequestException('Only dryRun protocol server apply mode is currently supported');
    }

    const eventId = randomUUID();
    await this.database.transaction(async (executor) => {
      const setup = await this.getProtocolSetupForUpdate(executor, id);
      if (!setup.provisionedOutboundId) {
        throw new ConflictException('Protocol setup must be provisioned before server apply dry-run');
      }

      await this.ensureOutboundExists(executor, setup.provisionedOutboundId);

      const plan = this.buildProtocolServerApplyPlan(setup);
      const snapshot = this.buildProtocolServerApplyDryRunSnapshot(setup, plan, applyMode);
      const createdBy = actor?.username ?? actor?.id ?? null;
      const reasonCodes = await this.insertProtocolApplyEvent(executor, eventId, setup, snapshot, createdBy);

      await this.audit.record(
        actor,
        'settings.protocol.server_apply.dry_run.record',
        'protocol_apply_event',
        eventId,
        {
          protocolSetupId: setup.id,
          protocol: setup.protocol,
          profile: setup.profile,
          routeGroup: setup.routeGroup,
          outboundId: snapshot.outboundId,
          targetServerId: snapshot.targetServerId,
          applyMode,
          applyStatus: snapshot.applyStatus,
          featureFlagEnabled: snapshot.featureFlagEnabled,
          adapterImplemented: snapshot.adapterImplemented,
          canExecute: snapshot.canExecute,
          commandCount: snapshot.commandCount,
          configChangeCount: snapshot.configChangeCount,
          secretSafe: snapshot.secretSafe,
          reasonCodes,
          preflightStatus: snapshot.preflight.status,
          canRecordDryRun: snapshot.preflight.canRecordDryRun,
          canExecuteDataPlane: snapshot.preflight.canExecuteDataPlane,
          preflightBlockedReasonCodes: snapshot.preflight.blockedReasonCodes,
          liveApply: false,
        },
        executor,
      );
    });

    const [event, protocolSetup] = await Promise.all([
      this.getProtocolApplyEventDetail(eventId),
      this.getProtocolSetup(id),
    ]);

    return {
      event,
      protocolSetup,
      serverApplyPlan: protocolSetup.serverApplyPlan ?? this.buildProtocolServerApplyPlan(protocolSetup),
    };
  }

  async requestProtocolServerApply(
    id: string,
    dto: RequestProtocolServerApplyDto,
    actor: AuthActor | undefined,
  ): Promise<RequestProtocolServerApplyResponse> {
    this.assertSuperadmin(actor);

    const applyMode = (dto?.applyMode ?? 'live') as 'live';
    if (applyMode !== 'live') {
      throw new BadRequestException('Only live protocol server apply requests are supported by this endpoint');
    }

    const eventId = randomUUID();
    let blockedReasonCodes: string[] = [];
    let liveApplyAccepted = false;
    let dataPlaneMutationExecuted = false;

    const liveRequest = await this.database.transaction<{
      setup: ProtocolSetupRow;
      plan: AdminProtocolServerApplyPlanSummary;
    } | null>(async (executor) => {
      const setup = await this.getProtocolSetupForUpdate(executor, id);
      if (!setup.provisionedOutboundId) {
        throw new ConflictException('Protocol setup must be provisioned before server apply request');
      }

      await this.ensureOutboundExists(executor, setup.provisionedOutboundId);

      const plan = this.buildProtocolServerApplyPlan(setup);
      blockedReasonCodes = this.protocolServerApplyLiveBlockedReasonCodes(plan);
      const snapshot =
        blockedReasonCodes.length > 0
          ? this.buildProtocolServerApplyLiveRequestSnapshot(setup, plan, applyMode, blockedReasonCodes)
          : this.buildProtocolServerApplyLiveAcceptedSnapshot(setup, plan, applyMode);
      const createdBy = actor?.username ?? actor?.id ?? null;
      const reasonCodes = await this.insertProtocolApplyEvent(executor, eventId, setup, snapshot, createdBy);
      liveApplyAccepted = blockedReasonCodes.length === 0;

      await this.audit.record(
        actor,
        liveApplyAccepted
          ? 'settings.protocol.server_apply.live.accept'
          : 'settings.protocol.server_apply.live.request',
        'protocol_apply_event',
        eventId,
        {
          protocolSetupId: setup.id,
          protocol: setup.protocol,
          profile: setup.profile,
          routeGroup: setup.routeGroup,
          outboundId: snapshot.outboundId,
          targetServerId: snapshot.targetServerId,
          applyMode,
          applyStatus: snapshot.applyStatus,
          featureFlagEnabled: snapshot.featureFlagEnabled,
          adapterImplemented: snapshot.adapterImplemented,
          canExecute: snapshot.canExecute,
          commandCount: snapshot.commandCount,
          configChangeCount: snapshot.configChangeCount,
          secretSafe: snapshot.secretSafe,
          reasonCodes,
          preflightStatus: snapshot.preflight.status,
          canRecordDryRun: snapshot.preflight.canRecordDryRun,
          canExecuteDataPlane: snapshot.preflight.canExecuteDataPlane,
          preflightBlockedReasonCodes: snapshot.preflight.blockedReasonCodes,
          liveApplyRequested: true,
          liveApplyAccepted,
          dataPlaneMutationExecuted: false,
          blockedReasonCodes,
        },
        executor,
      );

      return liveApplyAccepted ? { setup, plan } : null;
    });

    if (liveRequest) {
      const acceptedSetup = liveRequest.setup;
      const acceptedPlan = liveRequest.plan;
      const execution = await this.executeProtocolServerApply(acceptedSetup, acceptedPlan);
      dataPlaneMutationExecuted = execution.dataPlaneMutationExecuted;

      await this.database.transaction(async (executor) => {
        const snapshot = this.buildProtocolServerApplyLiveExecutionSnapshot(acceptedSetup, acceptedPlan, execution);
        const reasonCodes = await this.updateProtocolApplyEventSnapshot(executor, eventId, snapshot);

        await this.audit.record(
          actor,
          execution.status === 'succeeded'
            ? 'settings.protocol.server_apply.live.succeeded'
            : 'settings.protocol.server_apply.live.failed',
          'protocol_apply_event',
          eventId,
          {
            protocolSetupId: acceptedSetup.id,
            protocol: acceptedSetup.protocol,
            profile: acceptedSetup.profile,
            routeGroup: acceptedSetup.routeGroup,
            outboundId: snapshot.outboundId,
            targetServerId: snapshot.targetServerId,
            applyMode,
            applyStatus: snapshot.applyStatus,
            featureFlagEnabled: snapshot.featureFlagEnabled,
            adapterImplemented: snapshot.adapterImplemented,
            canExecute: snapshot.canExecute,
            commandCount: snapshot.commandCount,
            configChangeCount: snapshot.configChangeCount,
            secretSafe: snapshot.secretSafe,
            reasonCodes,
            preflightStatus: snapshot.preflight.status,
            canRecordDryRun: snapshot.preflight.canRecordDryRun,
            canExecuteDataPlane: snapshot.preflight.canExecuteDataPlane,
            preflightBlockedReasonCodes: snapshot.preflight.blockedReasonCodes,
            liveApplyRequested: true,
            liveApplyAccepted: true,
            dataPlaneMutationExecuted: snapshot.dataPlaneMutationExecuted,
            executor: execution.executor,
            executionStatus: execution.status,
            failedCommandId: execution.failedCommandId,
            rollbackAttempted: execution.rollbackAttempted,
            rollbackSucceeded: execution.rollbackSucceeded,
          },
          executor,
        );
      });
    }

    const [event, protocolSetup] = await Promise.all([
      this.getProtocolApplyEventDetail(eventId),
      this.getProtocolSetup(id),
    ]);

    return {
      event,
      protocolSetup,
      serverApplyPlan: protocolSetup.serverApplyPlan ?? this.buildProtocolServerApplyPlan(protocolSetup),
      liveApplyRequested: true,
      liveApplyAccepted,
      dataPlaneMutationExecuted,
      blockedReasonCodes,
    };
  }

  private async insertProtocolApplyEvent(
    executor: DatabaseQueryExecutor,
    eventId: string,
    setup: ProtocolServerApplySource,
    snapshot: AdminProtocolServerApplyDryRunSnapshot,
    createdBy: string | null,
  ): Promise<string[]> {
    const reasonCodes = snapshot.reasonCodes.map(String);

    await executor.query(
      `
        INSERT INTO protocol_apply_events (
          id, protocol_setup_id, outbound_id, target_server_id, apply_mode,
          apply_status, feature_flag_enabled, adapter_implemented, can_execute,
          command_count, config_change_count, secret_safe, reason_codes,
          dry_run_snapshot, created_by
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13::jsonb,
          $14::jsonb, $15
        )
      `,
      [
        eventId,
        setup.id,
        snapshot.outboundId ?? setup.provisionedOutboundId,
        snapshot.targetServerId ?? setup.targetServerId,
        snapshot.applyMode,
        snapshot.applyStatus,
        snapshot.featureFlagEnabled,
        snapshot.adapterImplemented,
        snapshot.canExecute,
        snapshot.commandCount,
        snapshot.configChangeCount,
        snapshot.secretSafe,
        JSON.stringify(reasonCodes),
        JSON.stringify(snapshot),
        createdBy,
      ],
    );

    return reasonCodes;
  }

  private async updateProtocolApplyEventSnapshot(
    executor: DatabaseQueryExecutor,
    eventId: string,
    snapshot: AdminProtocolServerApplyDryRunSnapshot,
  ): Promise<string[]> {
    const reasonCodes = snapshot.reasonCodes.map(String);

    await executor.query(
      `
        UPDATE protocol_apply_events
        SET apply_status = $2,
            feature_flag_enabled = $3,
            adapter_implemented = $4,
            can_execute = $5,
            command_count = $6,
            config_change_count = $7,
            secret_safe = $8,
            reason_codes = $9::jsonb,
            dry_run_snapshot = $10::jsonb
        WHERE id = $1
      `,
      [
        eventId,
        snapshot.applyStatus,
        snapshot.featureFlagEnabled,
        snapshot.adapterImplemented,
        snapshot.canExecute,
        snapshot.commandCount,
        snapshot.configChangeCount,
        snapshot.secretSafe,
        JSON.stringify(reasonCodes),
        JSON.stringify(snapshot),
      ],
    );

    return reasonCodes;
  }

  async listProtocolApplyEvents(
    filters: { protocolSetupId?: string; routeGroup?: string; limit?: number } = {},
  ): Promise<AdminProtocolServerApplyEventSummary[]> {
    const routeGroup = filters.routeGroup ? normalizeRouteGroup(filters.routeGroup) : undefined;
    const result = await this.database.query<ProtocolApplyEventRow>(
      `
        SELECT
          event.id,
          event.protocol_setup_id AS "protocolSetupId",
          ps.name AS "protocolSetupName",
          ps.protocol,
          ps.profile,
          ps.route_group AS "routeGroup",
          event.outbound_id AS "outboundId",
          event.target_server_id AS "targetServerId",
          COALESCE(target_server.hostname, target_server.external_id) AS "targetServerLabel",
          event.apply_mode AS "applyMode",
          event.apply_status AS "applyStatus",
          event.feature_flag_enabled AS "featureFlagEnabled",
          event.adapter_implemented AS "adapterImplemented",
          event.can_execute AS "canExecute",
          event.command_count AS "commandCount",
          event.config_change_count AS "configChangeCount",
          event.secret_safe AS "secretSafe",
          event.reason_codes AS "reasonCodes",
          event.created_by AS "createdBy",
          event.created_at AS "createdAt"
        FROM protocol_apply_events event
        JOIN protocol_setups ps ON ps.id = event.protocol_setup_id
        LEFT JOIN servers target_server ON target_server.id = event.target_server_id
        WHERE ($1::uuid IS NULL OR event.protocol_setup_id = $1::uuid)
          AND ($2::text IS NULL OR ps.route_group = $2)
        ORDER BY event.created_at DESC
        LIMIT $3
      `,
      [filters.protocolSetupId ?? null, routeGroup ?? null, filters.limit ?? 25],
    );

    return result.rows.map((row) => this.mapProtocolApplyEvent(row));
  }

  async getProtocolApplyEventDetail(id: string): Promise<AdminProtocolServerApplyEventDetail> {
    const result = await this.database.query<ProtocolApplyEventRow>(
      `
        SELECT
          event.id,
          event.protocol_setup_id AS "protocolSetupId",
          ps.name AS "protocolSetupName",
          ps.protocol,
          ps.profile,
          ps.route_group AS "routeGroup",
          event.outbound_id AS "outboundId",
          event.target_server_id AS "targetServerId",
          COALESCE(target_server.hostname, target_server.external_id) AS "targetServerLabel",
          event.apply_mode AS "applyMode",
          event.apply_status AS "applyStatus",
          event.feature_flag_enabled AS "featureFlagEnabled",
          event.adapter_implemented AS "adapterImplemented",
          event.can_execute AS "canExecute",
          event.command_count AS "commandCount",
          event.config_change_count AS "configChangeCount",
          event.secret_safe AS "secretSafe",
          event.reason_codes AS "reasonCodes",
          event.dry_run_snapshot AS "dryRunSnapshot",
          event.created_by AS "createdBy",
          event.created_at AS "createdAt"
        FROM protocol_apply_events event
        JOIN protocol_setups ps ON ps.id = event.protocol_setup_id
        LEFT JOIN servers target_server ON target_server.id = event.target_server_id
        WHERE event.id = $1
      `,
      [id],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Protocol apply event not found');

    return this.mapProtocolApplyEventDetail(row);
  }

  async upsertRouteSettings(
    dto: UpsertRouteSettingsDto,
    actor: AuthActor | undefined,
  ): Promise<AdminRouteSettingsSummary> {
    const routeGroup = normalizeRouteGroup(dto.routeGroup);
    const protocolProfile = dto.protocolProfile ?? 'balanced';
    const speedProfile = dto.speedProfile ?? defaultSpeedProfileForProtocol(protocolProfile);

    await this.database.transaction(async (executor) => {
      if (dto.selectedOutboundId) await this.ensureRouteOutboundCandidate(executor, dto.selectedOutboundId, routeGroup);

      await executor.query(
        `
          INSERT INTO route_settings (
            route_group, mode, selected_outbound_id, load_balance_strategy,
            protocol_profile, speed_profile, updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (route_group)
          DO UPDATE SET
            mode = excluded.mode,
            selected_outbound_id = excluded.selected_outbound_id,
            load_balance_strategy = excluded.load_balance_strategy,
            protocol_profile = excluded.protocol_profile,
            speed_profile = excluded.speed_profile,
            updated_by = excluded.updated_by,
            updated_at = now()
        `,
        [
          routeGroup,
          dto.mode,
          dto.selectedOutboundId ?? null,
          dto.loadBalanceStrategy,
          protocolProfile,
          speedProfile,
          actor?.username ?? actor?.id ?? null,
        ],
      );

      await this.audit.record(
        actor,
        'settings.route.update',
        'route_settings',
        routeGroup,
        {
          mode: dto.mode,
          selectedOutboundId: dto.selectedOutboundId ?? null,
          loadBalanceStrategy: dto.loadBalanceStrategy,
          protocolProfile,
          speedProfile,
        },
        executor,
      );
    });

    return this.getRouteSettings(routeGroup);
  }

  async listProtocolSetups(routeGroup: string): Promise<AdminProtocolSetupSummary[]> {
    const result = await this.database.query<ProtocolSetupRow>(
      this.protocolSetupSelectSql('ps.route_group = $1', 'ORDER BY ps.updated_at DESC, ps.created_at DESC LIMIT 100'),
      [routeGroup],
    );

    return result.rows.map((row) => this.mapProtocolSetup(row));
  }

  async getProtocolSetup(id: string): Promise<AdminProtocolSetupSummary> {
    const result = await this.database.query<ProtocolSetupRow>(
      this.protocolSetupSelectSql('ps.id = $1'),
      [id],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Protocol setup not found');

    return this.mapProtocolSetup(row);
  }

  async getSecretRef(secretRef: string): Promise<AdminSecretRefSummary> {
    const result = await this.database.query<SecretRecordRow>(
      `
        SELECT
          secret_ref AS "secretRef",
          name,
          kind,
          route_group AS "routeGroup",
          protocol,
          fingerprint,
          status,
          created_by AS "createdBy",
          created_at AS "createdAt",
          updated_at AS "updatedAt",
          last_rotated_at AS "lastRotatedAt"
        FROM secret_records
        WHERE secret_ref = $1
      `,
      [secretRef],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Secret reference not found');

    return this.mapSecretRef(row);
  }

  async getServerCredential(id: string): Promise<AdminServerCredentialSummary> {
    const result = await this.database.query<ServerCredentialRow>(
      `
        SELECT
          id,
          server_id AS "serverId",
          name,
          kind,
          status,
          last_used_at AS "lastUsedAt",
          last_rotated_at AS "lastRotatedAt",
          revoked_at AS "revokedAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM server_credentials
        WHERE id = $1
      `,
      [id],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Server credential not found');

    return this.mapServerCredential(row);
  }

  async getRouteSettings(routeGroup: string): Promise<AdminRouteSettingsSummary> {
    const result = await this.database.query<RouteSettingsRow>(
      `
        SELECT
          rs.route_group AS "routeGroup",
          rs.mode,
          rs.selected_outbound_id AS "selectedOutboundId",
          o.name AS "selectedOutboundName",
          rs.load_balance_strategy AS "loadBalanceStrategy",
          rs.protocol_profile AS "protocolProfile",
          rs.speed_profile AS "speedProfile",
          rs.updated_by AS "updatedBy",
          rs.updated_at AS "updatedAt"
        FROM route_settings rs
        LEFT JOIN outbounds o ON o.id = rs.selected_outbound_id
        WHERE rs.route_group = $1
      `,
      [routeGroup],
    );
    const row = result.rows[0];

    if (!row) {
      return {
        routeGroup,
        mode: 'automatic',
        selectedOutboundId: null,
        selectedOutboundName: null,
        loadBalanceStrategy: 'balanced',
        protocolProfile: 'balanced',
        speedProfile: 'balanced',
        updatedBy: null,
        updatedAt: null,
      };
    }

    return {
      routeGroup: row.routeGroup,
      mode: row.mode,
      selectedOutboundId: row.selectedOutboundId,
      selectedOutboundName: row.selectedOutboundName,
      loadBalanceStrategy: row.loadBalanceStrategy,
      protocolProfile: row.protocolProfile,
      speedProfile: row.speedProfile,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt?.toISOString() ?? null,
    };
  }

  private async getRouteAssignment(routeGroup: string, assignmentKey: string): Promise<RouteAssignmentRow | null> {
    const result = await this.database.query<RouteAssignmentRow>(
      `
        SELECT
          ra.route_group AS "routeGroup",
          ra.assignment_key AS "assignmentKey",
          ra.assignment_label AS "assignmentLabel",
          ra.current_outbound_id AS "currentOutboundId",
          current_outbound.name AS "currentOutboundName",
          ra.locked_outbound_id AS "lockedOutboundId",
          locked_outbound.name AS "lockedOutboundName",
          ra.auto_route_enabled AS "autoRouteEnabled",
          ra.route_locked AS "routeLocked",
          ra.protocol_profile AS "protocolProfile",
          ra.speed_profile AS "speedProfile",
          ra.hysteresis_score_delta AS "hysteresisScoreDelta",
          ra.cooldown_seconds AS "cooldownSeconds",
          ra.cooldown_until AS "cooldownUntil",
          ra.last_decision_at AS "lastDecisionAt",
          ra.decision_state AS "decisionState",
          ra.updated_at AS "updatedAt"
        FROM route_assignments ra
        LEFT JOIN outbounds current_outbound ON current_outbound.id = ra.current_outbound_id
        LEFT JOIN outbounds locked_outbound ON locked_outbound.id = ra.locked_outbound_id
        WHERE ra.route_group = $1 AND ra.assignment_key = $2
      `,
      [routeGroup, assignmentKey],
    );

    return result.rows[0] ?? null;
  }

  private mapRouteAssignmentSummary(
    routeGroup: string,
    assignmentKey: string,
    routeSettings: AdminRouteSettingsSummary,
    assignment: RouteAssignmentRow | null,
  ): AdminRouteAssignmentSummary {
    if (!assignment) {
      const lockedOutboundId = routeSettings.mode === 'manual' ? routeSettings.selectedOutboundId ?? null : null;

      return {
        routeGroup,
        assignmentKey,
        assignmentLabel: null,
        currentOutboundId: routeSettings.selectedOutboundId ?? null,
        currentOutboundName: routeSettings.selectedOutboundName ?? null,
        lockedOutboundId,
        lockedOutboundName: lockedOutboundId ? routeSettings.selectedOutboundName ?? null : null,
        autoRouteEnabled: routeSettings.mode === 'automatic',
        routeLocked: Boolean(lockedOutboundId),
        protocolProfile: routeSettings.protocolProfile,
        speedProfile: routeSettings.speedProfile,
        hysteresisScoreDelta: 15,
        cooldownSeconds: 180,
        cooldownUntil: null,
        lastDecisionAt: null,
        decisionState: 'monitoring',
        updatedAt: routeSettings.updatedAt ?? null,
      };
    }

    return {
      routeGroup: assignment.routeGroup,
      assignmentKey: assignment.assignmentKey,
      assignmentLabel: assignment.assignmentLabel,
      currentOutboundId: assignment.currentOutboundId,
      currentOutboundName: assignment.currentOutboundName,
      lockedOutboundId: assignment.lockedOutboundId,
      lockedOutboundName: assignment.lockedOutboundName,
      autoRouteEnabled: assignment.autoRouteEnabled,
      routeLocked: assignment.routeLocked,
      protocolProfile: assignment.protocolProfile,
      speedProfile: assignment.speedProfile,
      hysteresisScoreDelta: assignment.hysteresisScoreDelta,
      cooldownSeconds: assignment.cooldownSeconds,
      cooldownUntil: assignment.cooldownUntil?.toISOString() ?? null,
      lastDecisionAt: assignment.lastDecisionAt?.toISOString() ?? null,
      decisionState: assignment.decisionState,
      updatedAt: assignment.updatedAt?.toISOString() ?? null,
    };
  }

  private mapProtocolApplyEvent(row: ProtocolApplyEventRow): AdminProtocolServerApplyEventSummary {
    const event: AdminProtocolServerApplyEventSummary = {
      id: row.id,
      protocolSetupId: row.protocolSetupId,
      protocolSetupName: row.protocolSetupName,
      protocol: row.protocol,
      profile: row.profile,
      routeGroup: row.routeGroup,
      outboundId: row.outboundId,
      targetServerId: row.targetServerId,
      targetServerLabel: row.targetServerLabel,
      applyMode: row.applyMode,
      applyStatus: row.applyStatus,
      featureFlagEnabled: row.featureFlagEnabled,
      adapterImplemented: row.adapterImplemented,
      canExecute: row.canExecute,
      commandCount: row.commandCount,
      configChangeCount: row.configChangeCount,
      secretSafe: row.secretSafe,
      reasonCodes: this.stringArrayOrEmpty(row.reasonCodes),
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
    };

    if (row.dryRunSnapshot !== undefined) {
      event.dryRunSnapshot = this.mapProtocolServerApplyDryRunSnapshot(row.dryRunSnapshot);
    }

    return event;
  }

  private mapProtocolApplyEventDetail(row: ProtocolApplyEventRow): AdminProtocolServerApplyEventDetail {
    return {
      ...this.mapProtocolApplyEvent(row),
      dryRunSnapshot: this.mapProtocolServerApplyDryRunSnapshot(row.dryRunSnapshot),
    };
  }

  private mapAlertTimelineEvents(row: AlertRow, rangeStart: Date): AdminIncidentTimelineEvent[] {
    const events: AdminIncidentTimelineEvent[] = [];
    const baseMetadata = {
      alertId: row.id,
      firstSeenAt: row.firstSeenAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      sourceType: row.sourceType,
    };

    if (row.firstSeenAt.getTime() >= rangeStart.getTime()) {
      events.push({
        id: `${row.id}:opened`,
        kind: 'alert_opened',
        severity: incidentSeverityFromAlert(row.severity),
        title: row.title,
        detail: row.message,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        sourceLabel: row.sourceLabel,
        occurredAt: row.firstSeenAt.toISOString(),
        status: row.status,
        metadata: baseMetadata,
      });
    }

    if (row.resolvedAt && row.resolvedAt.getTime() >= rangeStart.getTime()) {
      events.push({
        id: `${row.id}:resolved`,
        kind: 'alert_resolved',
        severity: 'info',
        title: row.title,
        detail: row.message,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        sourceLabel: row.sourceLabel,
        occurredAt: row.resolvedAt.toISOString(),
        status: 'resolved',
        metadata: baseMetadata,
      });
    }

    return events;
  }

  private mapRouteDecisionTimelineEvent(row: RouteDecisionEventRow): AdminIncidentTimelineEvent {
    const reasonCodes = this.stringArrayOrEmpty(row.reasonCodes);
    const kind = row.decisionKind === 'assignment_apply' ? 'route_assignment' : 'route_decision';
    const outboundName = row.toOutboundName ?? row.fromOutboundName ?? null;

    return {
      id: `route-decision:${row.id}`,
      kind,
      severity: routeDecisionTimelineSeverity(row, reasonCodes),
      title: kind === 'route_assignment' ? 'Route assignment applied' : 'Route decision recorded',
      detail: describeRouteDecisionTimelineDetail(row, reasonCodes),
      sourceType: 'route_decision',
      sourceId: row.assignmentKey,
      sourceLabel: row.routeGroup,
      routeGroup: row.routeGroup,
      outboundName,
      actorId: row.createdBy,
      occurredAt: row.createdAt.toISOString(),
      status: row.decisionState,
      metadata: {
        eventId: row.id,
        assignmentKey: row.assignmentKey,
        decisionKind: row.decisionKind,
        decisionState: row.decisionState,
        scoreProfile: row.scoreProfile ?? null,
        reasonCodes: reasonCodes.length > 0 ? reasonCodes.slice(0, 8).join(', ') : null,
        fromOutboundId: row.fromOutboundId,
        toOutboundId: row.toOutboundId,
        fromScore: row.fromScore,
        toScore: row.toScore,
        scoreDelta: row.scoreDelta,
        routeLocked: row.routeLocked,
        autoRouteEnabled: row.autoRouteEnabled,
        applied: Boolean(row.appliedAt),
      },
    };
  }

  private async getRouteDecisionEvent(id: string): Promise<AdminRouteDecisionEventSummary> {
    const result = await this.database.query<RouteDecisionEventRow>(
      `
        SELECT
          event.id,
          event.route_group AS "routeGroup",
          event.assignment_key AS "assignmentKey",
          event.decision_kind AS "decisionKind",
          event.decision_state AS "decisionState",
          event.score_profile AS "scoreProfile",
          event.from_outbound_id AS "fromOutboundId",
          from_outbound.name AS "fromOutboundName",
          event.to_outbound_id AS "toOutboundId",
          to_outbound.name AS "toOutboundName",
          event.from_score AS "fromScore",
          event.to_score AS "toScore",
          event.score_delta AS "scoreDelta",
          event.hysteresis_score_delta AS "hysteresisScoreDelta",
          event.cooldown_until AS "cooldownUntil",
          event.route_locked AS "routeLocked",
          event.auto_route_enabled AS "autoRouteEnabled",
          event.reason_codes AS "reasonCodes",
          event.applied_at AS "appliedAt",
          event.created_by AS "createdBy",
          event.created_at AS "createdAt"
        FROM route_decision_events event
        LEFT JOIN outbounds from_outbound ON from_outbound.id = event.from_outbound_id
        LEFT JOIN outbounds to_outbound ON to_outbound.id = event.to_outbound_id
        WHERE event.id = $1
      `,
      [id],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Route decision event not found');

    return this.mapRouteDecisionEvent(row);
  }

  private mapRouteDecisionEvent(row: RouteDecisionEventRow): AdminRouteDecisionEventSummary {
    return {
      id: row.id,
      routeGroup: row.routeGroup,
      assignmentKey: row.assignmentKey,
      decisionKind: row.decisionKind,
      decisionState: row.decisionState,
      scoreProfile: row.scoreProfile,
      fromOutboundId: row.fromOutboundId,
      fromOutboundName: row.fromOutboundName,
      toOutboundId: row.toOutboundId,
      toOutboundName: row.toOutboundName,
      fromScore: row.fromScore,
      toScore: row.toScore,
      scoreDelta: row.scoreDelta,
      hysteresisScoreDelta: row.hysteresisScoreDelta,
      cooldownUntil: row.cooldownUntil?.toISOString() ?? null,
      routeLocked: row.routeLocked,
      autoRouteEnabled: row.autoRouteEnabled,
      reasonCodes: Array.isArray(row.reasonCodes) ? row.reasonCodes.map(String) : [],
      appliedAt: row.appliedAt?.toISOString() ?? null,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private mapRouteDecisionEventDetail(row: RouteDecisionEventRow): AdminRouteDecisionEventDetail {
    const decisionContext = this.asRecord(row.decisionContext);

    return {
      ...this.mapRouteDecisionEvent(row),
      decisionContext,
      dryRunSnapshot: this.mapRouteDecisionDryRunSnapshot(decisionContext.dryRunSnapshot),
      switchExecution: this.mapRouteDecisionSwitchExecution(decisionContext.switchExecution),
      switchPreflight: this.mapRouteDecisionSwitchPreflight(decisionContext.switchPreflight),
      switchRollout: this.mapRouteDecisionSwitchRollout(decisionContext.switchRollout),
      switchRolloutEvaluation: this.mapRouteDecisionSwitchRolloutEvaluation(decisionContext.switchRolloutEvaluation),
      switchOrchestration: this.mapRouteDecisionSwitchOrchestration(decisionContext.switchOrchestration),
    };
  }

  private mapProtocolServerApplyDryRunSnapshot(value: unknown): AdminProtocolServerApplyDryRunSnapshot | null {
    const snapshot = this.asRecord(value);
    if (Object.keys(snapshot).length === 0) return null;

    const steps = Array.isArray(snapshot.steps)
      ? snapshot.steps
          .map((item, index) => this.mapProtocolServerApplyStep(item, index))
          .filter((item): item is AdminProtocolServerApplyPlanSummary['steps'][number] => Boolean(item))
      : [];
    const commands = Array.isArray(snapshot.commands)
      ? snapshot.commands
          .map((item, index) => this.mapProtocolServerApplyCommand(item, index))
          .filter((item): item is AdminProtocolServerApplyPlanSummary['commands'][number] => Boolean(item))
      : [];
    const configChanges = Array.isArray(snapshot.configChanges)
      ? snapshot.configChanges
          .map((item, index) => this.mapProtocolServerApplyConfigChange(item, index))
          .filter((item): item is AdminProtocolServerApplyPlanSummary['configChanges'][number] => Boolean(item))
      : [];

    return {
      generatedAt: this.stringOrFallback(snapshot.generatedAt, ''),
      protocolSetupId: this.stringOrFallback(snapshot.protocolSetupId, ''),
      protocol: this.stringOrFallback(snapshot.protocol, 'wireguard'),
      profile: this.stringOrFallback(snapshot.profile, 'balanced'),
      routeGroup: this.stringOrFallback(snapshot.routeGroup, 'main'),
      outboundId: this.stringOrNullable(snapshot.outboundId),
      targetServerId: this.stringOrNullable(snapshot.targetServerId),
      targetServerLabel: this.stringOrNullable(snapshot.targetServerLabel),
      applyMode: this.stringOrFallback(snapshot.applyMode, 'dryRun'),
      applyStatus: this.stringOrFallback(snapshot.applyStatus, 'recorded'),
      liveApply: snapshot.liveApply === true,
      dataPlaneMutationExecuted: snapshot.dataPlaneMutationExecuted === true,
      featureFlagEnabled: snapshot.featureFlagEnabled === true,
      adapterImplemented: snapshot.adapterImplemented === true,
      dataPlaneReady: snapshot.dataPlaneReady === true,
      canExecute: snapshot.canExecute === true,
      configMaterialReady: snapshot.configMaterialReady !== false,
      configMaterialMissingFields: this.stringArrayOrEmpty(snapshot.configMaterialMissingFields),
      commandPolicyReady: snapshot.commandPolicyReady !== false,
      commandPolicyViolations: this.stringArrayOrEmpty(snapshot.commandPolicyViolations),
      requiresSecret: snapshot.requiresSecret === true,
      hasSecretRef: snapshot.hasSecretRef === true,
      secretDecryptAllowed: snapshot.secretDecryptAllowed === true,
      requiresServerAccess: snapshot.requiresServerAccess !== false,
      hasServerAccess: snapshot.hasServerAccess === true,
      commandCount: this.numberOrFallback(snapshot.commandCount, commands.length),
      configChangeCount: this.numberOrFallback(snapshot.configChangeCount, configChanges.length),
      secretSafe:
        snapshot.secretSafe !== false &&
        steps.every((step) => step.secretSafe) &&
        commands.every((command) => command.secretSafe) &&
        configChanges.every((change) => change.secretSafe),
      reasonCodes: this.stringArrayOrEmpty(snapshot.reasonCodes),
      adapter: this.mapProtocolServerApplyAdapter(snapshot.adapter, {
        dataPlaneReady: snapshot.dataPlaneReady === true,
        enabled: snapshot.featureFlagEnabled === true,
        hasServerAccess: snapshot.hasServerAccess === true,
        implemented: snapshot.adapterImplemented === true,
        protocol: this.stringOrFallback(snapshot.protocol, 'wireguard'),
        targetServerId: this.stringOrNullable(snapshot.targetServerId),
        targetServerLabel: this.stringOrNullable(snapshot.targetServerLabel),
      }),
      preflight: this.mapProtocolServerApplyPreflight(snapshot.preflight, {
        canExecuteDataPlane: snapshot.canExecute === true,
        canRecordDryRun: Boolean(this.stringOrNullable(snapshot.outboundId)) && snapshot.secretSafe !== false,
        status: this.stringOrFallback(snapshot.applyStatus, 'recorded'),
      }),
      steps,
      commands,
      configChanges,
    };
  }

  private mapProtocolServerApplyAdapter(
    value: unknown,
    fallback: {
      dataPlaneReady: boolean;
      enabled: boolean;
      hasServerAccess: boolean;
      implemented: boolean;
      protocol: string;
      targetServerId: string | null;
      targetServerLabel: string | null;
    },
  ): AdminProtocolServerApplyAdapterSummary {
    const adapter = this.asRecord(value);
    const runner = this.asRecord(adapter.commandRunner);
    const boundary = this.asRecord(adapter.serverAccessBoundary);
    const implemented = typeof adapter.implemented === 'boolean' ? adapter.implemented : fallback.implemented;
    const dataPlaneReady = typeof adapter.dataPlaneReady === 'boolean' ? adapter.dataPlaneReady : fallback.dataPlaneReady;
    const enabled = typeof adapter.enabled === 'boolean' ? adapter.enabled : fallback.enabled;
    const runnerImplemented = typeof runner.implemented === 'boolean' ? runner.implemented : implemented;
    const liveExecutionEnabled =
      typeof runner.liveExecutionEnabled === 'boolean' ? runner.liveExecutionEnabled : false;

    return {
      id: this.stringOrFallback(adapter.id, 'protocol-server-apply'),
      label: this.stringOrFallback(adapter.label, 'Protocol server apply adapter'),
      status: this.stringOrFallback(adapter.status, dataPlaneReady ? 'ready' : enabled ? 'dryRunOnly' : 'disabled'),
      protocol: this.stringOrNullable(adapter.protocol) ?? fallback.protocol,
      enabled,
      implemented,
      dataPlaneReady,
      supportedProtocols: this.stringArrayOrEmpty(adapter.supportedProtocols).length > 0
        ? this.stringArrayOrEmpty(adapter.supportedProtocols)
        : ['wireguard', 'vless', 'l2tp', 'ikev2'],
      reasonCodes: this.stringArrayOrEmpty(adapter.reasonCodes),
      dryRunSupported: adapter.dryRunSupported !== false,
      commandRunner: {
        id: this.stringOrFallback(runner.id, 'protocol-server-command-runner'),
        label: this.stringOrFallback(runner.label, 'Protocol server command runner'),
        mode: this.stringOrFallback(runner.mode, dataPlaneReady ? 'live' : 'dryRunOnly'),
        liveExecutionEnabled,
        dryRunOnly: runner.dryRunOnly !== false,
        implemented: runnerImplemented,
        reasonCodes: this.stringArrayOrEmpty(runner.reasonCodes),
      },
      serverAccessBoundary: {
        targetServerId: this.stringOrNullable(boundary.targetServerId) ?? fallback.targetServerId,
        targetServerLabel: this.stringOrNullable(boundary.targetServerLabel) ?? fallback.targetServerLabel,
        accessProfileReady:
          typeof boundary.accessProfileReady === 'boolean' ? boundary.accessProfileReady : fallback.hasServerAccess,
        credentialRefPresent: boundary.credentialRefPresent === true,
        credentialRecordActive: boundary.credentialRecordActive === true,
        credentialDecryptAllowed: boundary.credentialDecryptAllowed === true,
        reasonCodes: this.stringArrayOrEmpty(boundary.reasonCodes),
      },
    };
  }

  private mapProtocolServerApplyPreflight(
    value: unknown,
    fallback: Pick<AdminProtocolServerApplyPreflightSummary, 'status' | 'canRecordDryRun' | 'canExecuteDataPlane'>,
  ): AdminProtocolServerApplyPreflightSummary {
    const preflight = this.asRecord(value);
    const gates = Array.isArray(preflight.gates)
      ? preflight.gates
          .map((item, index) => this.mapProtocolServerApplyPreflightGate(item, index))
          .filter((item): item is AdminProtocolServerApplyPreflightSummary['gates'][number] => Boolean(item))
      : [];

    return {
      status: this.stringOrFallback(preflight.status, fallback.status),
      canRecordDryRun: typeof preflight.canRecordDryRun === 'boolean' ? preflight.canRecordDryRun : fallback.canRecordDryRun,
      canExecuteDataPlane:
        typeof preflight.canExecuteDataPlane === 'boolean'
          ? preflight.canExecuteDataPlane
          : fallback.canExecuteDataPlane,
      passedGateCount: this.numberOrFallback(
        preflight.passedGateCount,
        gates.filter((item) => item.status === 'passed').length,
      ),
      blockedGateCount: this.numberOrFallback(
        preflight.blockedGateCount,
        gates.filter((item) => item.status === 'blocked').length,
      ),
      futureGateCount: this.numberOrFallback(
        preflight.futureGateCount,
        gates.filter((item) => item.status === 'future').length,
      ),
      warningGateCount: this.numberOrFallback(
        preflight.warningGateCount,
        gates.filter((item) => item.status === 'warning').length,
      ),
      blockedReasonCodes: this.stringArrayOrEmpty(preflight.blockedReasonCodes),
      liveApplyBlockedReasonCodes: this.stringArrayOrEmpty(preflight.liveApplyBlockedReasonCodes),
      gates,
    };
  }

  private mapProtocolServerApplyPreflightGate(
    value: unknown,
    index: number,
  ): AdminProtocolServerApplyPreflightSummary['gates'][number] | null {
    const gate = this.asRecord(value);
    const kind = this.stringOrFallback(gate.kind, '');
    if (!kind) return null;

    return {
      id: this.stringOrFallback(gate.id, `protocol-apply-preflight-${index + 1}`),
      kind,
      status: this.stringOrFallback(gate.status, 'future'),
      blocksDryRun: gate.blocksDryRun === true,
      blocksDataPlane: gate.blocksDataPlane !== false,
      observedValue: this.stringOrNullable(gate.observedValue),
      reasonCodes: this.stringArrayOrEmpty(gate.reasonCodes),
    };
  }

  private mapProtocolServerApplyStep(
    value: unknown,
    index: number,
  ): AdminProtocolServerApplyPlanSummary['steps'][number] | null {
    const step = this.asRecord(value);
    const kind = this.stringOrFallback(step.kind, '');
    if (!kind) return null;

    return {
      id: this.stringOrFallback(step.id, `protocol-apply-step-${index + 1}`),
      kind,
      status: this.stringOrFallback(step.status, 'future'),
      commandPreviewCount: this.numberOrFallback(step.commandPreviewCount, 0),
      dataPlaneMutation: step.dataPlaneMutation === true,
      secretSafe: step.secretSafe !== false,
      reasonCodes: this.stringArrayOrEmpty(step.reasonCodes),
    };
  }

  private mapProtocolServerApplyCommand(
    value: unknown,
    index: number,
  ): AdminProtocolServerApplyPlanSummary['commands'][number] | null {
    const command = this.asRecord(value);
    const commandText = this.stringOrFallback(command.command, '');
    if (!commandText) return null;

    return {
      id: this.stringOrFallback(command.id, `protocol-apply-command-${index + 1}`),
      kind: this.stringOrFallback(command.kind, 'preflight'),
      command: commandText,
      requiresRoot: command.requiresRoot === true,
      dataPlaneMutation: command.dataPlaneMutation === true,
      secretSafe: command.secretSafe !== false,
      allowlisted: command.allowlisted !== false,
      timeoutSeconds: this.numberOrFallback(command.timeoutSeconds, 30),
    };
  }

  private mapProtocolServerApplyConfigChange(
    value: unknown,
    index: number,
  ): AdminProtocolServerApplyPlanSummary['configChanges'][number] | null {
    const change = this.asRecord(value);
    const filePath = this.stringOrFallback(change.filePath, '');
    if (!filePath) return null;

    return {
      id: this.stringOrFallback(change.id, `protocol-apply-config-${index + 1}`),
      kind: this.stringOrFallback(change.kind, 'config'),
      filePath,
      action: this.stringOrFallback(change.action, 'validate'),
      dataPlaneMutation: change.dataPlaneMutation === true,
      secretSafe: change.secretSafe !== false,
    };
  }

  private mapRouteDecisionSwitchOrchestration(
    value: unknown,
  ): AdminRouteDecisionSwitchOrchestrationSummary | null {
    const orchestration = this.asRecord(value);
    if (Object.keys(orchestration).length === 0) return null;

    const stages = Array.isArray(orchestration.stages)
      ? orchestration.stages
          .map((item, index) => this.mapRouteDecisionSwitchOrchestrationStage(item, index))
          .filter((item): item is AdminRouteDecisionSwitchOrchestrationSummary['stages'][number] => Boolean(item))
      : [];

    return {
      status: this.stringOrFallback(orchestration.status, 'blocked'),
      phase: this.stringOrFallback(orchestration.phase, 'guard'),
      recommendedAction: this.stringOrFallback(orchestration.recommendedAction, 'manualReview'),
      generatedAt: this.stringOrFallback(orchestration.generatedAt, new Date(0).toISOString()),
      dataPlaneReady: orchestration.dataPlaneReady === true,
      canExecuteDataPlane: orchestration.canExecuteDataPlane === true,
      assignmentOnly: orchestration.assignmentOnly === true,
      routeLocked: orchestration.routeLocked === true,
      cooldownActive: orchestration.cooldownActive === true,
      preserveExistingSessions: orchestration.preserveExistingSessions === true,
      switchNewSessionsOnly: orchestration.switchNewSessionsOnly === true,
      activeSessionsProtected: orchestration.activeSessionsProtected === true,
      activeSessionsMayMove: orchestration.activeSessionsMayMove === true,
      canaryPercent: this.numberOrFallback(orchestration.canaryPercent, 0),
      nextPercent: this.numberOrFallback(orchestration.nextPercent, 0),
      holdSecondsRemaining: this.numberOrFallback(orchestration.holdSecondsRemaining, 0),
      rollbackRequired: orchestration.rollbackRequired === true,
      stageCount: this.numberOrFallback(orchestration.stageCount, stages.length),
      reasonCodes: this.stringArrayOrEmpty(orchestration.reasonCodes),
      stages,
    };
  }

  private mapRouteDecisionSwitchOrchestrationStage(
    value: unknown,
    index: number,
  ): AdminRouteDecisionSwitchOrchestrationSummary['stages'][number] | null {
    const stage = this.asRecord(value);
    const code = this.stringOrFallback(stage.code, '');
    if (!code) return null;

    return {
      id: this.stringOrFallback(stage.id, `switch-orchestration-stage-${index + 1}`),
      phase: this.stringOrFallback(stage.phase, 'guard'),
      code,
      status: this.stringOrFallback(stage.status, 'future'),
      trafficScope: this.stringOrFallback(stage.trafficScope, 'none'),
      sessionImpact: this.stringOrFallback(stage.sessionImpact, 'none'),
      targetPercent: this.numberOrFallback(stage.targetPercent, 0),
      targetOutboundId: this.stringOrNullable(stage.targetOutboundId),
      dataPlaneMutation: stage.dataPlaneMutation === true,
      estimatedSeconds: stage.estimatedSeconds === null || stage.estimatedSeconds === undefined
        ? null
        : this.numberOrFallback(stage.estimatedSeconds, 0),
      reasonCodes: this.stringArrayOrEmpty(stage.reasonCodes),
    };
  }

  private mapRouteDecisionSwitchRolloutEvaluation(
    value: unknown,
  ): AdminRouteDecisionSwitchRolloutEvaluationSummary | null {
    const evaluation = this.asRecord(value);
    if (Object.keys(evaluation).length === 0) return null;

    return {
      status: this.stringOrFallback(evaluation.status, 'blocked'),
      recommendedAction: this.stringOrFallback(evaluation.recommendedAction, 'manualReview'),
      evaluatedAt: this.stringOrFallback(evaluation.evaluatedAt, new Date(0).toISOString()),
      dataPlaneReady: evaluation.dataPlaneReady === true,
      guardPassed: evaluation.guardPassed === true,
      routeConsistencyHoldActive: evaluation.routeConsistencyHoldActive === true,
      canaryPercent: this.numberOrFallback(evaluation.canaryPercent, 0),
      nextPercent: this.numberOrFallback(evaluation.nextPercent, 0),
      maxPercent: this.numberOrFallback(evaluation.maxPercent, 0),
      holdSecondsRemaining: this.numberOrFallback(evaluation.holdSecondsRemaining, 0),
      observedLossPercent: this.nullableNumber(evaluation.observedLossPercent),
      observedJitterMs: this.nullableNumber(evaluation.observedJitterMs),
      observedLatencyMs: this.nullableNumber(evaluation.observedLatencyMs),
      observedScore: this.nullableNumber(evaluation.observedScore),
      reasonCodes: this.stringArrayOrEmpty(evaluation.reasonCodes),
    };
  }

  private mapRouteDecisionSwitchRollout(value: unknown): AdminRouteDecisionSwitchRolloutSummary | null {
    const rollout = this.asRecord(value);
    if (Object.keys(rollout).length === 0) return null;

    const steps = Array.isArray(rollout.steps)
      ? rollout.steps
          .map((item, index) => this.mapRouteDecisionSwitchRolloutStep(item, index))
          .filter((item): item is AdminRouteDecisionSwitchRolloutSummary['steps'][number] => Boolean(item))
      : [];

    return {
      status: this.stringOrFallback(rollout.status, 'blocked'),
      strategy: this.stringOrFallback(rollout.strategy, 'assignmentOnly'),
      dataPlaneReady: rollout.dataPlaneReady === true,
      existingSessionsPinned: rollout.existingSessionsPinned === true,
      newSessionsCanary: rollout.newSessionsCanary === true,
      automaticExpansion: rollout.automaticExpansion === true,
      initialPercent: this.numberOrFallback(rollout.initialPercent, 0),
      maxPercent: this.numberOrFallback(rollout.maxPercent, 0),
      canaryDurationSeconds: this.numberOrFallback(rollout.canaryDurationSeconds, 0),
      routeConsistencyHoldSeconds: this.numberOrFallback(rollout.routeConsistencyHoldSeconds, 0),
      rollbackOnLossPercent: this.numberOrFallback(rollout.rollbackOnLossPercent, 0),
      rollbackOnJitterMs: this.numberOrFallback(rollout.rollbackOnJitterMs, 0),
      rollbackOnLatencyMs: this.numberOrFallback(rollout.rollbackOnLatencyMs, 0),
      reasonCodes: this.stringArrayOrEmpty(rollout.reasonCodes),
      steps,
    };
  }

  private mapRouteDecisionSwitchRolloutStep(
    value: unknown,
    index: number,
  ): AdminRouteDecisionSwitchRolloutSummary['steps'][number] | null {
    const step = this.asRecord(value);
    const code = this.stringOrFallback(step.code, '');
    if (!code) return null;

    return {
      id: this.stringOrFallback(step.id, `switch-rollout-step-${index + 1}`),
      phase: this.stringOrFallback(step.phase, 'canary'),
      code,
      status: this.stringOrFallback(step.status, 'future'),
      trafficScope: this.stringOrFallback(step.trafficScope, 'none'),
      targetPercent: this.numberOrFallback(step.targetPercent, 0),
      durationSeconds: step.durationSeconds === null || step.durationSeconds === undefined
        ? null
        : this.numberOrFallback(step.durationSeconds, 0),
      dataPlaneMutation: step.dataPlaneMutation === true,
      reasonCodes: this.stringArrayOrEmpty(step.reasonCodes),
    };
  }

  private mapRouteDecisionSwitchPreflight(value: unknown): AdminRouteDecisionSwitchPreflightSummary | null {
    const preflight = this.asRecord(value);
    if (Object.keys(preflight).length === 0) return null;

    const checks = Array.isArray(preflight.checks)
      ? preflight.checks
          .map((item, index) => this.mapRouteDecisionSwitchPreflightCheck(item, index))
          .filter((item): item is AdminRouteDecisionSwitchPreflightSummary['checks'][number] => Boolean(item))
      : [];

    return {
      status: this.stringOrFallback(preflight.status, 'blocked'),
      dataPlaneReady: preflight.dataPlaneReady === true,
      canExecuteDataPlane: preflight.canExecuteDataPlane === true,
      safeToArm: preflight.safeToArm === true,
      checkCount: this.numberOrFallback(preflight.checkCount, checks.length),
      failedCheckCount: this.numberOrFallback(
        preflight.failedCheckCount,
        checks.filter((item) => item.status === 'failed').length,
      ),
      futureCheckCount: this.numberOrFallback(
        preflight.futureCheckCount,
        checks.filter((item) => item.status === 'future').length,
      ),
      reasonCodes: this.stringArrayOrEmpty(preflight.reasonCodes),
      checks,
    };
  }

  private mapRouteDecisionSwitchPreflightCheck(
    value: unknown,
    index: number,
  ): AdminRouteDecisionSwitchPreflightSummary['checks'][number] | null {
    const check = this.asRecord(value);
    const code = this.stringOrFallback(check.code, '');
    if (!code) return null;

    return {
      id: this.stringOrFallback(check.id, `preflight-check-${index + 1}`),
      kind: this.stringOrFallback(check.kind, 'guards'),
      code,
      status: this.stringOrFallback(check.status, 'future'),
      dataPlaneMutation: check.dataPlaneMutation === true,
      estimatedSeconds: check.estimatedSeconds === null || check.estimatedSeconds === undefined
        ? null
        : this.numberOrFallback(check.estimatedSeconds, 0),
      reasonCodes: this.stringArrayOrEmpty(check.reasonCodes),
    };
  }

  private mapRouteDecisionSwitchExecution(value: unknown): AdminRouteDecisionSwitchExecutionSummary | null {
    const execution = this.asRecord(value);
    if (Object.keys(execution).length === 0) return null;

    return {
      status: this.stringOrFallback(execution.status, 'blocked'),
      phase: this.stringOrFallback(execution.phase, 'guarded'),
      generatedAt: this.stringOrFallback(execution.generatedAt, ''),
      appliedAt: this.stringOrNullable(execution.appliedAt),
      fromOutboundId: this.stringOrNullable(execution.fromOutboundId),
      toOutboundId: this.stringOrNullable(execution.toOutboundId),
      assignmentApplied: execution.assignmentApplied === true,
      dataPlaneApplied: execution.dataPlaneApplied === true,
      dataPlaneReady: execution.dataPlaneReady === true,
      preserveExistingSessions: execution.preserveExistingSessions === true,
      switchNewSessionsOnly: execution.switchNewSessionsOnly === true,
      drainRequired: execution.drainRequired === true,
      emergencySwitch: execution.emergencySwitch === true,
      stickyUntil: this.stringOrNullable(execution.stickyUntil),
      drainUntil: this.stringOrNullable(execution.drainUntil),
      cooldownUntil: this.stringOrNullable(execution.cooldownUntil),
      rollbackReady: execution.rollbackReady === true,
      executedStepIds: this.stringArrayOrEmpty(execution.executedStepIds),
      futureStepIds: this.stringArrayOrEmpty(execution.futureStepIds),
      reasonCodes: this.stringArrayOrEmpty(execution.reasonCodes),
    };
  }

  private mapRouteDecisionDryRunSnapshot(value: unknown): AdminRouteDecisionApplyDryRunSnapshot | null {
    const snapshot = this.asRecord(value);
    if (Object.keys(snapshot).length === 0) return null;

    const commands = Array.isArray(snapshot.commands)
      ? snapshot.commands
          .map((item, index) => this.mapRouteDecisionDryRunCommand(item, index))
          .filter((item): item is AdminRouteDecisionApplyDryRunCommand => Boolean(item))
      : [];
    const configChanges = Array.isArray(snapshot.configChanges)
      ? snapshot.configChanges
          .map((item, index) => this.mapRouteDecisionDryRunConfigChange(item, index))
          .filter((item): item is AdminRouteDecisionApplyDryRunConfigChange => Boolean(item))
      : [];

    return {
      generatedAt: this.stringOrFallback(snapshot.generatedAt, ''),
      adapterId: this.stringOrFallback(snapshot.adapterId, ''),
      adapterStatus: this.stringOrFallback(snapshot.adapterStatus, 'missing'),
      adapterEnabled: snapshot.adapterEnabled === true,
      adapterImplemented: snapshot.adapterImplemented === true,
      dataPlaneReady: snapshot.dataPlaneReady === true,
      dryRunSupported: snapshot.dryRunSupported === true,
      secretSafe:
        snapshot.secretSafe !== false &&
        commands.every((item) => item.secretSafe) &&
        configChanges.every((item) => item.secretSafe),
      commandCount: this.numberOrFallback(snapshot.commandCount, commands.length),
      configChangeCount: this.numberOrFallback(snapshot.configChangeCount, configChanges.length),
      commands,
      configChanges,
    };
  }

  private mapRouteDecisionDryRunCommand(
    value: unknown,
    index: number,
  ): AdminRouteDecisionApplyDryRunCommand | null {
    const command = this.asRecord(value);
    const commandText = this.stringOrFallback(command.command, '');
    if (!commandText) return null;

    return {
      id: this.stringOrFallback(command.id, `command-${index + 1}`),
      kind: this.stringOrFallback(command.kind, 'precheck'),
      command: commandText,
      requiresRoot: command.requiresRoot === true,
      dataPlaneMutation: command.dataPlaneMutation === true,
      secretSafe: command.secretSafe !== false,
    };
  }

  private mapRouteDecisionDryRunConfigChange(
    value: unknown,
    index: number,
  ): AdminRouteDecisionApplyDryRunConfigChange | null {
    const configChange = this.asRecord(value);
    const filePath = this.stringOrFallback(configChange.filePath, '');
    if (!filePath) return null;

    return {
      id: this.stringOrFallback(configChange.id, `config-${index + 1}`),
      filePath,
      action: this.stringOrFallback(configChange.action, 'validate'),
      description: this.stringOrFallback(configChange.description, filePath),
      secretSafe: configChange.secretSafe !== false,
    };
  }

  async listWireGuardCandidates(
    routeGroup: string,
    settings?: RouteScoringContext,
  ): Promise<AdminWireGuardCandidate[]> {
    const scoringSettings = settings ?? await this.getRouteSettings(routeGroup);
    const result = await this.database.query<WireGuardCandidateRow>(
      `
        SELECT
          o.id,
          o.name,
          s.external_id AS "serverExternalId",
          s.hostname AS "serverHostname",
          s.country AS "serverCountry",
          s.region AS "serverRegion",
          o.route_group AS "routeGroup",
          o.config,
          o.health_status AS "healthStatus",
          o.weight,
          o.enabled,
          o.maintenance_mode AS "maintenanceMode",
          h.latency_ms AS "latencyMs",
          h.jitter_ms AS "jitterMs",
          h.packet_loss_percent AS "packetLossPercent",
          h.checked_at AS "checkedAt",
          sm.health_score AS "serverHealthScore",
          sm.raw AS "serverMetricRaw"
        FROM outbounds o
        LEFT JOIN servers s ON s.id = o.server_id
        LEFT JOIN LATERAL (
          SELECT *
          FROM outbound_health_checks oh
          WHERE oh.outbound_id = o.id
          ORDER BY oh.checked_at DESC
          LIMIT 1
        ) h ON true
        LEFT JOIN LATERAL (
          SELECT *
          FROM server_metrics server_metric
          WHERE server_metric.server_id = o.server_id
          ORDER BY server_metric.observed_at DESC
          LIMIT 1
        ) sm ON true
        WHERE o.type = 'wireguard'
          AND o.route_group = $1
        ORDER BY o.priority ASC, o.created_at ASC
        LIMIT 100
      `,
      [routeGroup],
    );
    const outboundCandidates = result.rows.map((row) => this.mapWireGuardCandidate(row, scoringSettings));
    const telemetryCandidates = await this.listWireGuardTelemetryCandidates(routeGroup, scoringSettings);

    return [...outboundCandidates, ...telemetryCandidates]
      .sort((left, right) => right.score - left.score)
      .slice(0, 100);
  }

  private async listWireGuardTelemetryCandidates(
    routeGroup: string,
    settings: RouteScoringContext,
  ): Promise<AdminWireGuardCandidate[]> {
    const result = await this.database.query<WireGuardTelemetryRow>(
      `
        SELECT
          s.external_id AS "serverExternalId",
          s.hostname AS "serverHostname",
          s.country AS "serverCountry",
          s.region AS "serverRegion",
          m.observed_at AS "observedAt",
          m.health_score AS "healthScore",
          m.raw AS "metricRaw"
        FROM servers s
        JOIN LATERAL (
          SELECT *
          FROM server_metrics sm
          WHERE sm.server_id = s.id
          ORDER BY sm.observed_at DESC
          LIMIT 1
        ) m ON true
        WHERE jsonb_typeof(m.raw->'wireGuardInterfaces') = 'array'
          AND jsonb_array_length(m.raw->'wireGuardInterfaces') > 0
        ORDER BY m.observed_at DESC
        LIMIT 100
      `,
    );

    return result.rows.flatMap((row) =>
      (row.metricRaw?.wireGuardInterfaces ?? [])
        .filter((item): item is WireGuardInterfaceMetric => this.isWireGuardInterfaceMetric(item))
        .map((item) => this.mapWireGuardTelemetryCandidate(row, item, routeGroup, settings)),
    );
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
    return normalizeLimitParam(input, fallback, max);
  }

  normalizeRouteAnalyticsRangeHours(input: string | undefined): number {
    return normalizeRangeHoursParam(input, 168, 2160);
  }

  normalizeIncidentTimelineRangeHours(input: string | undefined): number {
    return normalizeRangeHoursParam(input, 24, 2160);
  }

  normalizeUuidQuery(input: string | undefined, name: string): string | undefined {
    return normalizeUuidParam(input, name);
  }

  private normalizeAlertStatus(input: string | undefined): string | undefined {
    return normalizeAlertStatusParam(input);
  }

  private normalizeSimpleText(input: string | undefined, name: string): string | undefined {
    return normalizeSimpleTextParam(input, name);
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
        sc.name AS "credentialName",
        sc.kind AS "credentialKind",
        sc.status AS "credentialStatus",
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
      LEFT JOIN server_credentials sc ON sc.id::text = NULLIF(btrim(ap.credential_ref), '')
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

  private protocolSetupSelectSql(whereClause: string, suffix = ''): string {
    return `
      SELECT
        ps.id,
        ps.name,
        ps.protocol,
        ps.profile,
        ps.route_group AS "routeGroup",
        ps.port,
        ps.status,
        ps.config,
        ps.secret_ref AS "secretRef",
        ps.target_server_id AS "targetServerId",
        COALESCE(ts.hostname, ts.external_id) AS "targetServerLabel",
        (
          sap.id IS NOT NULL
          AND sap.address IS NOT NULL
          AND sap.ssh_port IS NOT NULL
          AND sap.username IS NOT NULL
          AND NULLIF(btrim(sap.credential_ref), '') IS NOT NULL
          AND sap.bootstrap_state = 'installed'
        ) AS "targetServerAccessReady",
        sap.id AS "targetServerAccessProfileId",
        sap.address AS "targetServerAccessAddress",
        sap.ssh_port AS "targetServerSshPort",
        sap.username AS "targetServerUsername",
        sap.access_method AS "targetServerAccessMethod",
        NULLIF(btrim(sap.credential_ref), '') AS "targetServerCredentialRef",
        sc.kind AS "targetServerCredentialKind",
        (sc.id IS NOT NULL) AS "targetServerCredentialReady",
        ps.provisioned_outbound_id AS "provisionedOutboundId",
        po.enabled AS "provisionedOutboundEnabled",
        po.maintenance_mode AS "provisionedOutboundMaintenanceMode",
        po.health_status AS "provisionedOutboundHealthStatus",
        po.last_checked_at AS "provisionedOutboundLastCheckedAt",
        po.last_healthy_at AS "provisionedOutboundLastHealthyAt",
        ps.provisioned_at AS "provisionedAt",
        ps.created_by AS "createdBy",
        ps.created_at AS "createdAt",
        ps.updated_at AS "updatedAt"
      FROM protocol_setups ps
      LEFT JOIN servers ts ON ts.id = ps.target_server_id
      LEFT JOIN server_access_profiles sap ON sap.server_id = ts.id
      LEFT JOIN server_credentials sc ON sc.id::text = NULLIF(btrim(sap.credential_ref), '')
        AND sc.status = 'active'
        AND sc.revoked_at IS NULL
      LEFT JOIN outbounds po ON po.id = ps.provisioned_outbound_id
      WHERE ${whereClause}
      ${suffix}
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
      wireGuardInterfaces: row.metricRaw?.wireGuardInterfaces,
      routeProbes: row.metricRaw?.routeProbes,
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
      hasActiveCredential: row.credentialStatus === 'active',
      credentialName: row.credentialName,
      credentialKind: row.credentialKind,
      credentialStatus: row.credentialStatus,
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
      usageMultiplier: row.usageMultiplier,
      maxUsers: row.maxUsers,
      lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
      lastHealthyAt: row.lastHealthyAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapServerInterface(row: ServerInterfaceRow): AdminServerInterfaceSummary {
    return {
      id: row.id,
      serverId: row.serverId,
      serverExternalId: row.serverExternalId,
      serverHostname: row.serverHostname,
      name: row.name,
      operator: row.operator,
      kind: row.kind,
      status: row.status,
      macAddress: row.macAddress,
      addressCidr: row.addressCidr,
      linkedTunnelId: row.linkedTunnelId,
      linkedTunnelName: row.linkedTunnelName,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapTunnel(row: TunnelRow): AdminTunnelSummary {
    return {
      id: row.id,
      serverId: row.serverId,
      serverExternalId: row.serverExternalId,
      serverHostname: row.serverHostname,
      name: row.name,
      type: row.type,
      remoteEndpoint: row.remoteEndpoint,
      interfaceName: row.interfaceName,
      localInterfaceId: row.localInterfaceId,
      localInterfaceName: row.localInterfaceName,
      interfaceOperator: row.interfaceOperator,
      routeGroup: row.routeGroup,
      status: row.status,
      lockable: row.lockable,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapProtocolSetup(row: ProtocolSetupRow): AdminProtocolSetupSummary {
    return {
      id: row.id,
      name: row.name,
      protocol: row.protocol,
      profile: row.profile,
      routeGroup: row.routeGroup,
      port: row.port,
      status: row.status,
      config: this.redactConfig(this.asRecord(row.config)),
      hasSecretRef: Boolean(row.secretRef),
      targetServerId: row.targetServerId,
      targetServerLabel: row.targetServerLabel,
      targetServerAccessReady: row.targetServerAccessReady,
      provisionedOutboundId: row.provisionedOutboundId,
      provisionedAt: row.provisionedAt?.toISOString() ?? null,
      serverApplyPlan: this.buildProtocolServerApplyPlan(row),
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapSecretRef(row: SecretRecordRow): AdminSecretRefSummary {
    return {
      secretRef: row.secretRef,
      name: row.name,
      kind: row.kind,
      routeGroup: row.routeGroup,
      protocol: row.protocol,
      fingerprint: row.fingerprint,
      status: row.status,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      lastRotatedAt: row.lastRotatedAt?.toISOString() ?? null,
    };
  }

  private mapServerCredential(row: ServerCredentialRow): AdminServerCredentialSummary {
    return {
      id: row.id,
      serverId: row.serverId,
      name: row.name,
      kind: row.kind,
      status: row.status,
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      lastRotatedAt: row.lastRotatedAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async listRouteQualityWindows(
    routeGroup: string,
    rangeHours: number,
  ): Promise<RouteQualityWindowSummary[]> {
    try {
      await this.routeQualityAggregation.aggregateRecent(routeGroup, Math.min(rangeHours, 168));
      const summaryRows = await this.queryRouteQualitySummaryWindows(routeGroup, rangeHours);

      if (summaryRows.length > 0) {
        return summaryRows.map((row) => this.mapRouteQualityWindow(row, routeGroup));
      }
    } catch (error) {
      if (!this.isUndefinedTableError(error)) throw error;
    }

    const rawRows = await this.queryRawRouteQualityWindows(routeGroup, rangeHours);
    return rawRows.map((row) => this.mapRouteQualityWindow(row, routeGroup));
  }

  private async queryRouteQualitySummaryWindows(
    routeGroup: string,
    rangeHours: number,
  ): Promise<RouteQualityWindowRow[]> {
    const result = await this.database.query<RouteQualityWindowRow>(
      `
        SELECT
          s.external_id AS "serverExternalId",
          s.hostname AS "serverHostname",
          q.outbound_id AS "outboundId",
          q.outbound_key AS "outboundKey",
          q.outbound_name AS "outboundName",
          q.operator,
          q.protocol,
          q.score_profile AS "scoreProfile",
          q.hour_of_day AS "hourOfDay",
          q.day_of_week AS "dayOfWeek",
          SUM(q.sample_count)::int AS "sampleCount",
          ROUND((SUM(q.average_score * q.sample_count) / NULLIF(SUM(q.sample_count), 0))::numeric, 1)::float AS "averageScore",
          ROUND((SUM(q.average_latency_ms * q.sample_count) FILTER (WHERE q.average_latency_ms IS NOT NULL) / NULLIF(SUM(q.sample_count) FILTER (WHERE q.average_latency_ms IS NOT NULL), 0))::numeric, 1)::float AS "averageLatencyMs",
          ROUND((SUM(q.average_jitter_ms * q.sample_count) FILTER (WHERE q.average_jitter_ms IS NOT NULL) / NULLIF(SUM(q.sample_count) FILTER (WHERE q.average_jitter_ms IS NOT NULL), 0))::numeric, 1)::float AS "averageJitterMs",
          ROUND((SUM(q.average_packet_loss_percent * q.sample_count) FILTER (WHERE q.average_packet_loss_percent IS NOT NULL) / NULLIF(SUM(q.sample_count) FILTER (WHERE q.average_packet_loss_percent IS NOT NULL), 0))::numeric, 2)::float AS "averagePacketLossPercent",
          ROUND((SUM(q.degraded_sample_percent * q.sample_count) / NULLIF(SUM(q.sample_count), 0))::numeric, 1)::float AS "degradedSamplePercent",
          ROUND((SUM(q.critical_sample_percent * q.sample_count) / NULLIF(SUM(q.sample_count), 0))::numeric, 1)::float AS "criticalSamplePercent"
        FROM route_quality_hourly q
        JOIN servers s ON s.id = q.server_id
        WHERE q.route_group = $1
          AND q.bucket_start >= now() - ($2::int * interval '1 hour')
        GROUP BY
          s.external_id,
          s.hostname,
          q.outbound_id,
          q.outbound_key,
          q.outbound_name,
          q.operator,
          q.protocol,
          q.score_profile,
          q.hour_of_day,
          q.day_of_week
        ORDER BY "averageScore" DESC, "sampleCount" DESC
        LIMIT 500
      `,
      [routeGroup, rangeHours],
    );

    return result.rows;
  }

  private async queryRouteHealthHistoryPoints(
    routeGroup: string,
    rangeHours: number,
    limit: number,
  ): Promise<RouteHealthHistoryRow[]> {
    const result = await this.database.query<RouteHealthHistoryRow>(
      `
        SELECT
          q.route_group AS "routeGroup",
          q.bucket_start AS "bucketStart",
          s.external_id AS "serverExternalId",
          s.hostname AS "serverHostname",
          q.outbound_id AS "outboundId",
          q.outbound_key AS "outboundKey",
          q.outbound_name AS "outboundName",
          q.operator,
          q.protocol,
          q.score_profile AS "scoreProfile",
          EXTRACT(HOUR FROM q.bucket_start)::int AS "hourOfDay",
          EXTRACT(DOW FROM q.bucket_start)::int AS "dayOfWeek",
          SUM(q.sample_count)::int AS "sampleCount",
          ROUND((SUM(q.average_score * q.sample_count) / NULLIF(SUM(q.sample_count), 0))::numeric, 1)::float AS "averageScore",
          ROUND((SUM(q.average_latency_ms * q.sample_count) FILTER (WHERE q.average_latency_ms IS NOT NULL) / NULLIF(SUM(q.sample_count) FILTER (WHERE q.average_latency_ms IS NOT NULL), 0))::numeric, 1)::float AS "averageLatencyMs",
          ROUND((SUM(q.average_jitter_ms * q.sample_count) FILTER (WHERE q.average_jitter_ms IS NOT NULL) / NULLIF(SUM(q.sample_count) FILTER (WHERE q.average_jitter_ms IS NOT NULL), 0))::numeric, 1)::float AS "averageJitterMs",
          ROUND((SUM(q.average_packet_loss_percent * q.sample_count) FILTER (WHERE q.average_packet_loss_percent IS NOT NULL) / NULLIF(SUM(q.sample_count) FILTER (WHERE q.average_packet_loss_percent IS NOT NULL), 0))::numeric, 2)::float AS "averagePacketLossPercent",
          ROUND((SUM(q.degraded_sample_percent * q.sample_count) / NULLIF(SUM(q.sample_count), 0))::numeric, 1)::float AS "degradedSamplePercent",
          ROUND((SUM(q.critical_sample_percent * q.sample_count) / NULLIF(SUM(q.sample_count), 0))::numeric, 1)::float AS "criticalSamplePercent"
        FROM route_quality_hourly q
        JOIN servers s ON s.id = q.server_id
        WHERE q.route_group = $1
          AND q.bucket_start >= now() - ($2::int * interval '1 hour')
        GROUP BY
          q.route_group,
          q.bucket_start,
          s.external_id,
          s.hostname,
          q.outbound_id,
          q.outbound_key,
          q.outbound_name,
          q.operator,
          q.protocol,
          q.score_profile
        ORDER BY q.bucket_start DESC, "averageScore" ASC, "sampleCount" DESC
        LIMIT $3
      `,
      [routeGroup, rangeHours, limit],
    );

    return result.rows;
  }

  private async queryRawRouteQualityWindows(routeGroup: string, rangeHours: number): Promise<RouteQualityWindowRow[]> {
    const result = await this.database.query<RouteQualityWindowRow>(
      `
        WITH probe_rows AS (
          SELECT
            s.external_id AS "serverExternalId",
            s.hostname AS "serverHostname",
            COALESCE(probe_outbound.id, matched_outbound.id) AS "outboundId",
            COALESCE(
              NULLIF(probe.value->>'outboundKey', ''),
              probe_outbound.id::text,
              matched_outbound.id::text,
              NULLIF(probe.value->>'outboundName', ''),
              probe_outbound.name,
              matched_outbound.name,
              'unassigned'
            ) AS "outboundKey",
            COALESCE(NULLIF(probe.value->>'outboundName', ''), probe_outbound.name, matched_outbound.name) AS "outboundName",
            COALESCE(
              NULLIF(probe.value->>'operator', ''),
              NULLIF(probe_outbound.config->>'operator', ''),
              NULLIF(probe_outbound.config->>'interfaceOperator', ''),
              NULLIF(probe_outbound.config->>'isp', ''),
              NULLIF(matched_outbound.config->>'operator', ''),
              NULLIF(matched_outbound.config->>'interfaceOperator', ''),
              NULLIF(matched_outbound.config->>'isp', ''),
              'unknown'
            ) AS operator,
            lower(probe.value->>'protocol') AS protocol,
            sm.observed_at AS "observedAt",
            probe.value->>'status' AS status,
            (probe.value->>'latencyMs')::double precision AS "latencyMs",
            (probe.value->>'jitterMs')::double precision AS "jitterMs",
            (probe.value->>'packetLossPercent')::double precision AS "packetLossPercent"
          FROM server_metrics sm
          JOIN servers s ON s.id = sm.server_id
          CROSS JOIN LATERAL jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(sm.raw->'routeProbes') = 'array' THEN sm.raw->'routeProbes'
              ELSE '[]'::jsonb
            END
          ) AS probe(value)
          LEFT JOIN outbounds probe_outbound
            ON probe_outbound.id::text = probe.value->>'outboundId'
            AND probe_outbound.server_id = sm.server_id
            AND probe_outbound.route_group = $1
          LEFT JOIN LATERAL (
            SELECT o.id, o.name, o.type, o.config, o.priority, o.created_at
            FROM outbounds o
            WHERE o.server_id = sm.server_id
              AND o.route_group = $1
              AND (
                lower(o.type) = lower(probe.value->>'protocol')
                OR (lower(probe.value->>'protocol') IN ('udp', 'quic', 'wireguard') AND lower(o.type) = 'wireguard')
                OR lower(o.type) = 'direct'
              )
            ORDER BY
              CASE
                WHEN lower(o.type) = lower(probe.value->>'protocol') THEN 0
                WHEN lower(probe.value->>'protocol') IN ('udp', 'quic', 'wireguard') AND lower(o.type) = 'wireguard' THEN 1
                ELSE 2
              END,
              o.priority ASC,
              o.created_at ASC
            LIMIT 1
          ) AS matched_outbound ON true
          WHERE sm.observed_at >= now() - ($2::int * interval '1 hour')
            AND COALESCE(NULLIF(probe.value->>'routeGroup', ''), $1::text) = $1::text
        ),
        scored AS (
          SELECT
            *,
            GREATEST(0, LEAST(100,
              CASE status
                WHEN 'healthy' THEN 100
                WHEN 'degraded' THEN 72
                WHEN 'critical' THEN 20
                ELSE 55
              END
              - GREATEST(0, COALESCE("latencyMs", 0) - CASE protocol WHEN 'dns' THEN 80 WHEN 'tcp' THEN 100 ELSE 70 END) * 0.09
              - GREATEST(0, COALESCE("jitterMs", 0) - CASE protocol WHEN 'tcp' THEN 25 WHEN 'dns' THEN 25 ELSE 10 END)
              - GREATEST(0, COALESCE("packetLossPercent", 0)) * CASE protocol WHEN 'tcp' THEN 16 WHEN 'dns' THEN 16 ELSE 24 END
            )) AS "sampleScore"
          FROM probe_rows
          WHERE protocol IN ('tcp', 'udp', 'quic', 'dns', 'wireguard', 'mtu')
        ),
        profile_rows AS (
          SELECT
            scored.*,
            profile.score_profile AS "scoreProfile",
            GREATEST(0, LEAST(100, profile.profile_score)) AS "profileScore"
          FROM scored
          CROSS JOIN LATERAL (
            VALUES
              ('balanced', "sampleScore"),
              ('stability', CASE WHEN protocol IN ('udp', 'quic', 'wireguard', 'mtu') THEN "sampleScore" ELSE "sampleScore" - 6 END),
              ('throughput', CASE WHEN status = 'healthy' THEN "sampleScore" + 3 ELSE "sampleScore" - 4 END),
              ('gaming', CASE WHEN protocol IN ('udp', 'quic', 'wireguard', 'tcp', 'mtu') THEN "sampleScore" - GREATEST(0, COALESCE("latencyMs", 0) - 85) * 0.05 - GREATEST(0, COALESCE("jitterMs", 0) - 6) * 0.9 - GREATEST(0, COALESCE("packetLossPercent", 0) - 0.1) * 20 END),
              ('tcp', CASE WHEN protocol = 'tcp' THEN "sampleScore" END),
              ('udp', CASE WHEN protocol IN ('udp', 'wireguard') THEN "sampleScore" END),
              ('quic', CASE WHEN protocol IN ('quic', 'udp') THEN "sampleScore" END),
              ('dns', CASE WHEN protocol = 'dns' THEN "sampleScore" END),
              ('wireguard', CASE WHEN protocol IN ('wireguard', 'udp', 'mtu') THEN "sampleScore" END)
          ) AS profile(score_profile, profile_score)
          WHERE profile.profile_score IS NOT NULL
        )
        SELECT
          "serverExternalId",
          "serverHostname",
          "outboundId",
          "outboundKey",
          "outboundName",
          operator,
          protocol,
          "scoreProfile",
          EXTRACT(HOUR FROM "observedAt")::int AS "hourOfDay",
          EXTRACT(DOW FROM "observedAt")::int AS "dayOfWeek",
          COUNT(*)::int AS "sampleCount",
          ROUND(AVG("profileScore")::numeric, 1)::float AS "averageScore",
          ROUND(AVG("latencyMs")::numeric, 1)::float AS "averageLatencyMs",
          ROUND(AVG("jitterMs")::numeric, 1)::float AS "averageJitterMs",
          ROUND(AVG("packetLossPercent")::numeric, 2)::float AS "averagePacketLossPercent",
          ROUND((COUNT(*) FILTER (WHERE status IN ('degraded', 'critical'))::numeric * 100 / COUNT(*)), 1)::float AS "degradedSamplePercent",
          ROUND((COUNT(*) FILTER (WHERE status = 'critical')::numeric * 100 / COUNT(*)), 1)::float AS "criticalSamplePercent"
        FROM profile_rows
        GROUP BY
          "serverExternalId",
          "serverHostname",
          "outboundId",
          "outboundKey",
          "outboundName",
          operator,
          protocol,
          "scoreProfile",
          EXTRACT(HOUR FROM "observedAt"),
          EXTRACT(DOW FROM "observedAt")
        ORDER BY "averageScore" DESC, "sampleCount" DESC
        LIMIT 500
      `,
      [routeGroup, rangeHours],
    );

    return result.rows;
  }

  private mapRouteQualityWindow(row: RouteQualityWindowRow, routeGroup: string): RouteQualityWindowSummary {
    return {
      routeGroup,
      serverExternalId: row.serverExternalId,
      serverHostname: row.serverHostname,
      outboundId: row.outboundId,
      outboundKey: row.outboundKey,
      outboundName: row.outboundName,
      operator: row.operator,
      protocol: row.protocol,
      scoreProfile: row.scoreProfile,
      hourOfDay: Number(row.hourOfDay),
      dayOfWeek: row.dayOfWeek === null || row.dayOfWeek === undefined ? null : Number(row.dayOfWeek),
      sampleCount: Number(row.sampleCount),
      averageScore: roundMetric(row.averageScore, 1) ?? 0,
      averageLatencyMs: roundMetric(row.averageLatencyMs, 1),
      averageJitterMs: roundMetric(row.averageJitterMs, 1),
      averagePacketLossPercent: roundMetric(row.averagePacketLossPercent, 2),
      degradedSamplePercent: roundMetric(row.degradedSamplePercent, 1) ?? 0,
      criticalSamplePercent: roundMetric(row.criticalSamplePercent, 1) ?? 0,
    };
  }

  private mapRouteHealthHistoryPoint(row: RouteHealthHistoryRow): RouteHealthHistoryPoint {
    return {
      routeGroup: row.routeGroup,
      bucketStart: row.bucketStart.toISOString(),
      serverExternalId: row.serverExternalId,
      serverHostname: row.serverHostname,
      outboundId: row.outboundId,
      outboundKey: row.outboundKey,
      outboundName: row.outboundName,
      operator: row.operator,
      protocol: row.protocol,
      scoreProfile: row.scoreProfile,
      sampleCount: Number(row.sampleCount),
      averageScore: roundMetric(row.averageScore, 1) ?? 0,
      averageLatencyMs: roundMetric(row.averageLatencyMs, 1),
      averageJitterMs: roundMetric(row.averageJitterMs, 1),
      averagePacketLossPercent: roundMetric(row.averagePacketLossPercent, 2),
      degradedSamplePercent: roundMetric(row.degradedSamplePercent, 1) ?? 0,
      criticalSamplePercent: roundMetric(row.criticalSamplePercent, 1) ?? 0,
      healthStatus: this.routeHealthHistoryStatus(row),
    };
  }

  private routeHealthHistoryStatus(row: RouteHealthHistoryRow): HealthState {
    const sampleCount = Number(row.sampleCount);
    const score = Number(row.averageScore);
    const loss = row.averagePacketLossPercent === null ? null : Number(row.averagePacketLossPercent);
    const degradedPercent = Number(row.degradedSamplePercent);
    const criticalPercent = Number(row.criticalSamplePercent);

    if (!Number.isFinite(sampleCount) || sampleCount <= 0 || !Number.isFinite(score)) return 'unknown';
    if (score < 50 || criticalPercent >= 20 || (loss !== null && Number.isFinite(loss) && loss >= 2)) return 'critical';
    if (score < 70 || degradedPercent >= 35 || (loss !== null && Number.isFinite(loss) && loss >= 1)) return 'degraded';

    return 'healthy';
  }

  private buildRouteQualityRecommendations(
    routeGroup: string,
    windows: RouteQualityWindowSummary[],
    minimumSamples: number,
    rangeHours: number,
  ): RouteQualityRecommendation[] {
    const qualifiedWindows = windows.filter((window) => window.sampleCount >= minimumSamples);
    const degradedCandidates = qualifiedWindows.filter((window) => isDegradedRouteQualityWindow(window));
    const upcomingDegradedWindows = degradedCandidates
      .map((window) => {
        const nextWindowAt = nextRouteQualityWindowStart(window);
        if (!nextWindowAt) return null;

        const startsInMinutes = Math.max(0, Math.round((nextWindowAt.getTime() - Date.now()) / 60_000));
        return { window, nextWindowAt, startsInMinutes };
      })
      .filter((item): item is { window: RouteQualityWindowSummary; nextWindowAt: Date; startsInMinutes: number } => {
        if (!item) return false;

        return item.startsInMinutes <= routeQualityPredictionLookaheadHours() * 60;
      })
      .sort(
        (left, right) =>
          left.startsInMinutes - right.startsInMinutes ||
          left.window.averageScore - right.window.averageScore ||
          right.window.degradedSamplePercent - left.window.degradedSamplePercent,
      )
      .slice(0, 3)
      .map((item) =>
        this.mapRouteQualityRecommendation(
          'upcomingDegradedWindow',
          item.window,
          minimumSamples,
          rangeHours,
          item.nextWindowAt,
          item.startsInMinutes,
        ),
      );
    const bestWindows = qualifiedWindows
      .filter((window) => isBestRouteQualityWindow(window))
      .sort((left, right) => right.averageScore - left.averageScore || right.sampleCount - left.sampleCount)
      .slice(0, 3)
      .map((window) => this.mapRouteQualityRecommendation('bestWindow', window, minimumSamples, rangeHours));
    const degradedWindows = degradedCandidates
      .sort((left, right) => left.averageScore - right.averageScore || right.degradedSamplePercent - left.degradedSamplePercent)
      .slice(0, 3)
      .map((window) => this.mapRouteQualityRecommendation('degradedWindow', window, minimumSamples, rangeHours));
    const recommendations = [...upcomingDegradedWindows, ...bestWindows, ...degradedWindows];

    if (recommendations.length > 0) return recommendations;

    return [
      {
        kind: 'insufficientData',
        routeGroup,
        serverExternalId: null,
        serverHostname: null,
        protocol: null,
        hourOfDay: null,
        averageScore: null,
        sampleCount: windows.reduce((sum, window) => sum + window.sampleCount, 0),
        confidence: windows.length >= 4 ? 'low' : 'low',
        reason: 'insufficientRouteHistory',
      },
    ];
  }

  private mapRouteQualityRecommendation(
    kind: 'bestWindow' | 'degradedWindow' | 'upcomingDegradedWindow',
    window: RouteQualityWindowSummary,
    minimumSamples: number,
    rangeHours: number,
    nextWindowAt?: Date | null,
    startsInMinutes?: number | null,
  ): RouteQualityRecommendation {
    return {
      kind,
      routeGroup: window.routeGroup,
      serverExternalId: window.serverExternalId,
      serverHostname: window.serverHostname,
      outboundId: window.outboundId,
      outboundKey: window.outboundKey,
      outboundName: window.outboundName,
      operator: window.operator,
      protocol: window.protocol,
      scoreProfile: window.scoreProfile,
      hourOfDay: window.hourOfDay,
      dayOfWeek: window.dayOfWeek,
      nextWindowAt: nextWindowAt?.toISOString() ?? null,
      startsInMinutes: startsInMinutes ?? null,
      averageScore: window.averageScore,
      sampleCount: window.sampleCount,
      confidence: routeQualityConfidence(window.sampleCount, minimumSamples, rangeHours),
      reason:
        kind === 'bestWindow'
          ? 'strongHistoricalWindow'
          : kind === 'upcomingDegradedWindow'
            ? 'upcomingDegradedHistoricalWindow'
            : 'degradedHistoricalWindow',
    };
  }

  private mapWireGuardTelemetryCandidate(
    row: WireGuardTelemetryRow,
    item: WireGuardInterfaceMetric,
    routeGroup: string,
    settings: RouteScoringContext,
  ): AdminWireGuardCandidate {
    const routeProbes = this.getRouteProbes(row.metricRaw);
    const routeProbeSummary = this.summarizeRouteProbes(routeProbes);
    const baseScore = calculateWireGuardTelemetryScore(item, row.healthScore);
    const bufferbloat = assessRouteBufferbloat({
      latencyMs: routeProbeSummary.latencyMs,
      jitterMs: routeProbeSummary.jitterMs,
      loadPercent: null,
      loadedLatencyMs: routeProbeSummary.loadedLatencyMs,
      loadedLatencyDeltaMs: routeProbeSummary.loadedLatencyDeltaMs,
    });
    const mtu = this.assessRouteMtu({ routeProbes, configuredMtuBytes: null });
    const scoreResult = this.calculateRouteProfileScores(
      {
        baseScore,
        healthStatus: mapWireGuardTelemetryStatus(item.status),
        latencyMs: routeProbeSummary.latencyMs,
        jitterMs: routeProbeSummary.jitterMs,
        packetLossPercent: routeProbeSummary.packetLossPercent,
        loadedLatencyMs: bufferbloat.loadedLatencyMs,
        loadedLatencyDeltaMs: bufferbloat.loadedLatencyDeltaMs,
        loadPercent: null,
        routeProbes,
        serverHealthScore: row.healthScore,
        latestHandshakeAgeSeconds: item.latestHandshakeAgeSeconds ?? null,
      },
      settings,
    );

    return {
      id: `agent:${row.serverExternalId}:${item.name}`,
      name: `${row.serverHostname || row.serverExternalId} / ${item.name}`,
      endpoint: row.serverHostname || row.serverExternalId,
      routeGroup,
      healthStatus: mapWireGuardTelemetryStatus(item.status),
      score: scoreResult.selectedScore,
      selectedScoreProfile: scoreResult.selectedProfile,
      profileScores: scoreResult.profileScores,
      scoreReasons: scoreResult.reasons,
      latencyMs: routeProbeSummary.latencyMs,
      jitterMs: routeProbeSummary.jitterMs,
      packetLossPercent: routeProbeSummary.packetLossPercent,
      loadedLatencyMs: bufferbloat.loadedLatencyMs,
      loadedLatencyDeltaMs: bufferbloat.loadedLatencyDeltaMs,
      bufferbloatSeverity: bufferbloat.severity,
      bufferbloatRecommendation: bufferbloat.recommendation,
      pathMtuBytes: mtu.pathMtuBytes,
      recommendedTunnelMtuBytes: mtu.recommendedTunnelMtuBytes,
      configuredMtuBytes: mtu.configuredMtuBytes,
      mtuStatus: mtu.status,
      mtuRecommendation: mtu.recommendation,
      mtuSessionSafe: mtu.sessionSafe,
      mtuReasonCodes: mtu.reasonCodes,
      loadPercent: null,
      serverExternalId: row.serverExternalId,
      serverHostname: row.serverHostname,
      serverCountry: normalizeRouteDecisionCountryCode(row.serverCountry),
      serverRegion: row.serverRegion,
      interfaceName: item.name,
      peerCount: item.peerCount,
      activePeerCount: item.activePeerCount,
      latestHandshakeAgeSeconds: item.latestHandshakeAgeSeconds ?? null,
      rxBps: item.rxBps ?? null,
      txBps: item.txBps ?? null,
      checkedAt: row.observedAt.toISOString(),
      source: 'agent',
    };
  }

  private mapWireGuardCandidate(row: WireGuardCandidateRow, settings: RouteScoringContext): AdminWireGuardCandidate {
    const config = this.asRecord(row.config);
    const loadPercent = extractLoadPercent(config, row.weight);
    const routeProbes = this.getRouteProbes(row.serverMetricRaw);
    const routeProbeSummary = this.summarizeRouteProbes(routeProbes);
    const configuredMtuBytes =
      numberFromConfig(config.mtu) ??
      numberFromConfig(config.mtuBytes) ??
      numberFromConfig(config.interfaceMtu);
    const bufferbloat = assessRouteBufferbloat({
      latencyMs: row.latencyMs ?? routeProbeSummary.latencyMs,
      jitterMs: row.jitterMs ?? routeProbeSummary.jitterMs,
      loadPercent,
      loadedLatencyMs: numberFromConfig(config.loadedLatencyMs) ?? routeProbeSummary.loadedLatencyMs,
      loadedLatencyDeltaMs: numberFromConfig(config.loadedLatencyDeltaMs) ?? routeProbeSummary.loadedLatencyDeltaMs,
    });
    const mtu = this.assessRouteMtu({ routeProbes, configuredMtuBytes });
    const scoreResult = this.calculateRouteProfileScores(
      {
        baseScore: calculateWireGuardScore(row),
        healthStatus: row.healthStatus,
        latencyMs: row.latencyMs,
        jitterMs: row.jitterMs,
        packetLossPercent: row.packetLossPercent,
        loadedLatencyMs: bufferbloat.loadedLatencyMs,
        loadedLatencyDeltaMs: bufferbloat.loadedLatencyDeltaMs,
        loadPercent,
        routeProbes,
        serverHealthScore: row.serverHealthScore,
        enabled: row.enabled,
        maintenanceMode: row.maintenanceMode,
      },
      settings,
    );

    return {
      id: row.id,
      name: row.name,
      endpoint: extractEndpoint(config),
      routeGroup: row.routeGroup,
      healthStatus: row.healthStatus,
      score: scoreResult.selectedScore,
      selectedScoreProfile: scoreResult.selectedProfile,
      profileScores: scoreResult.profileScores,
      scoreReasons: scoreResult.reasons,
      latencyMs: row.latencyMs,
      jitterMs: row.jitterMs,
      packetLossPercent: row.packetLossPercent,
      loadedLatencyMs: bufferbloat.loadedLatencyMs,
      loadedLatencyDeltaMs: bufferbloat.loadedLatencyDeltaMs,
      bufferbloatSeverity: bufferbloat.severity,
      bufferbloatRecommendation: bufferbloat.recommendation,
      pathMtuBytes: mtu.pathMtuBytes,
      recommendedTunnelMtuBytes: mtu.recommendedTunnelMtuBytes,
      configuredMtuBytes: mtu.configuredMtuBytes,
      mtuStatus: mtu.status,
      mtuRecommendation: mtu.recommendation,
      mtuSessionSafe: mtu.sessionSafe,
      mtuReasonCodes: mtu.reasonCodes,
      loadPercent,
      serverExternalId: row.serverExternalId,
      serverHostname: row.serverHostname,
      serverCountry: normalizeRouteDecisionCountryCode(row.serverCountry),
      serverRegion: row.serverRegion,
      interfaceName: this.stringFromConfig(config.interfaceName),
      peerCount: null,
      activePeerCount: null,
      latestHandshakeAgeSeconds: null,
      rxBps: null,
      txBps: null,
      checkedAt: row.checkedAt?.toISOString() ?? null,
      source: 'outbound',
    };
  }

  private toRouteDecisionCandidateSummary(
    candidate: AdminWireGuardCandidate | null | undefined,
  ): AdminRouteDecisionCandidateSummary | null {
    if (!candidate) return null;

    return {
      id: candidate.id,
      name: candidate.name,
      routeGroup: candidate.routeGroup,
      source: candidate.source,
      healthStatus: candidate.healthStatus,
      score: candidate.score,
      selectedScoreProfile: candidate.selectedScoreProfile,
      latencyMs: candidate.latencyMs ?? null,
      jitterMs: candidate.jitterMs ?? null,
      packetLossPercent: candidate.packetLossPercent ?? null,
      loadedLatencyMs: candidate.loadedLatencyMs ?? null,
      loadedLatencyDeltaMs: candidate.loadedLatencyDeltaMs ?? null,
      bufferbloatSeverity: candidate.bufferbloatSeverity ?? null,
      bufferbloatRecommendation: candidate.bufferbloatRecommendation ?? null,
      pathMtuBytes: candidate.pathMtuBytes ?? null,
      recommendedTunnelMtuBytes: candidate.recommendedTunnelMtuBytes ?? null,
      configuredMtuBytes: candidate.configuredMtuBytes ?? null,
      mtuStatus: candidate.mtuStatus ?? null,
      mtuRecommendation: candidate.mtuRecommendation ?? null,
      mtuSessionSafe: candidate.mtuSessionSafe ?? null,
      mtuReasonCodes: candidate.mtuReasonCodes ?? [],
      loadPercent: candidate.loadPercent ?? null,
      serverCountry: candidate.serverCountry ?? null,
      serverRegion: candidate.serverRegion ?? null,
    };
  }

  private buildRouteDecisionCandidateReviews(
    candidates: AdminWireGuardCandidate[],
    context: {
      currentCandidate: AdminWireGuardCandidate | null;
      recommendedCandidate: AdminWireGuardCandidate | null;
      clientRoutePreference: AdminRouteDecisionClientPreferenceSummary | null;
      routeLocked: boolean;
      autoRouteEnabled: boolean;
      routeMode: string;
      cooldownActive: boolean;
      hysteresisScoreDelta: number;
    },
  ): AdminRouteDecisionCandidateReviewSummary[] {
    return candidates.slice(0, 12).map((candidate) => {
      const summary = this.toRouteDecisionCandidateSummary(candidate);
      const scoreDeltaFromCurrent = context.currentCandidate
        ? Math.round(candidate.score - context.currentCandidate.score)
        : null;
      const reviewReasonCodes = new Set<string>();
      const isRecommended = context.recommendedCandidate?.id === candidate.id;
      const isCurrent = context.currentCandidate?.id === candidate.id;
      const isHealthy = this.isRouteDecisionCandidateHealthy(candidate);
      const preferenceMismatch = this.isRouteDecisionPreferenceMismatch(candidate, context.clientRoutePreference);
      let disposition: AdminRouteDecisionCandidateReviewSummary['disposition'] = 'eligible';

      if (isRecommended) reviewReasonCodes.add('recommended_candidate');
      if (isCurrent) reviewReasonCodes.add('current_candidate');
      if (!isHealthy) {
        reviewReasonCodes.add('candidate_unhealthy');
        if (isCurrent) reviewReasonCodes.add('current_candidate_unhealthy');
        if (candidate.score < 50) reviewReasonCodes.add('score_below_threshold');
      }
      if (
        candidate.bufferbloatRecommendation === 'sqmRecommended' ||
        candidate.bufferbloatRecommendation === 'avoidUnderLoad'
      ) {
        reviewReasonCodes.add('loaded_latency_high');
      }
      if (candidate.mtuRecommendation === 'reduce') reviewReasonCodes.add('mtu_reduce_recommended');
      if (candidate.mtuRecommendation === 'manualReview') reviewReasonCodes.add('mtu_manual_review');
      if (candidate.mtuStatus === 'blocked') reviewReasonCodes.add('mtu_probe_blocked');
      if (candidate.source !== 'outbound') reviewReasonCodes.add('agent_candidate_not_applicable');
      this.routeDecisionPreferenceReasonCodes(candidate, context.clientRoutePreference)
        .forEach((reasonCode) => reviewReasonCodes.add(reasonCode));
      if (!isRecommended && !isCurrent && scoreDeltaFromCurrent !== null && scoreDeltaFromCurrent < context.hysteresisScoreDelta) {
        reviewReasonCodes.add('score_delta_below_hysteresis');
      }

      if (isRecommended) {
        disposition = 'recommended';
      } else if (isCurrent) {
        disposition = 'current';
      } else if (!isHealthy) {
        disposition = 'unhealthy';
      } else if (candidate.source !== 'outbound') {
        disposition = 'diagnosticOnly';
      } else if (preferenceMismatch) {
        disposition = 'preferenceMismatch';
      } else if (context.routeLocked) {
        disposition = 'routeLocked';
        reviewReasonCodes.add('route_locked');
      } else if (!context.autoRouteEnabled || context.routeMode !== 'automatic') {
        disposition = 'manualMode';
        reviewReasonCodes.add('manual_mode');
      } else if (context.cooldownActive) {
        disposition = 'cooldownBlocked';
        reviewReasonCodes.add('cooldown_active');
      } else if (scoreDeltaFromCurrent !== null && scoreDeltaFromCurrent < context.hysteresisScoreDelta) {
        disposition = 'belowHysteresis';
      }

      return {
        ...summary!,
        disposition,
        scoreDeltaFromCurrent,
        reviewReasonCodes: [...reviewReasonCodes],
        scoreReasons: candidate.scoreReasons?.slice(0, 4) ?? [],
      };
    });
  }

  private buildRouteDecisionProfileRecommendations(
    candidates: AdminWireGuardCandidate[],
    selectedProfile: RouteScoreProfile,
  ): AdminRouteDecisionProfileRecommendation[] {
    const selectedBest = this.bestCandidateForRouteProfile(candidates, selectedProfile);
    const selectedBestScore = selectedBest ? this.scoreForRouteProfile(selectedBest, selectedProfile) : 0;
    const recommendations = this.routeDecisionScoreProfiles()
      .map((profile) => {
        const usableCandidates = this.usableCandidatesForRouteProfile(candidates, profile);
        const bestCandidate = this.bestCandidateForRouteProfile(candidates, profile);
        const score = bestCandidate ? this.scoreForRouteProfile(bestCandidate, profile) : 0;
        const reasonCodes = new Set<string>();

        if (profile === selectedProfile) reasonCodes.add('selectedProfile');
        if (bestCandidate) reasonCodes.add('bestProfileScore');
        if (score - selectedBestScore >= 8) reasonCodes.add('profileScoreLead');
        if (profile === 'gaming') reasonCodes.add('gamingSensitive');
        if (profile === 'stability' || profile === 'wireguard') reasonCodes.add('stabilitySensitive');
        if (profile === 'throughput') reasonCodes.add('throughputSensitive');
        if (['tcp', 'udp', 'quic', 'dns'].includes(profile)) reasonCodes.add('protocolSensitive');

        return {
          profile,
          recommendedCandidateId: bestCandidate?.id ?? null,
          recommendedCandidateName: bestCandidate?.name ?? null,
          score,
          scoreDeltaFromSelected: Math.round(score - selectedBestScore),
          candidateCount: usableCandidates.length,
          reasonCodes: [...reasonCodes],
        };
      })
      .filter((item) => item.candidateCount > 0)
      .sort((left, right) => right.score - left.score);

    const selectedRecommendation = recommendations.find((item) => item.profile === selectedProfile);
    const visible = recommendations.slice(0, 5);

    if (selectedRecommendation && !visible.some((item) => item.profile === selectedProfile)) {
      visible.push(selectedRecommendation);
    }

    return visible;
  }

  private buildRouteDecisionLoadBalancingSummary(
    candidates: AdminWireGuardCandidate[],
    context: RouteScoringContext & { selectedProfile: RouteScoreProfile },
  ): AdminRouteDecisionLoadBalancingSummary {
    const managedCandidateCount = candidates.filter((candidate) => candidate.source === 'outbound').length;
    const reasonCodes = new Set<string>([
      'advisoryOnly',
      'dataPlaneDisabled',
      'profileWeighted',
      'healthWeighted',
      'packetLossWeighted',
      'jitterWeighted',
      'latencyWeighted',
    ]);
    const securityProfile = context.speedProfile === 'highSecurity' || context.protocolProfile === 'highSecurity';
    const routeConsistencyProfile = ['gaming', 'stability', 'udp', 'quic', 'wireguard'].includes(context.selectedProfile) || securityProfile;

    if (context.selectedProfile === 'throughput' || context.loadBalanceStrategy === 'throughput') {
      reasonCodes.add('throughputWeighted');
    }
    if (candidates.some((candidate) => candidate.loadPercent !== null && candidate.loadPercent !== undefined)) {
      reasonCodes.add('loadWeighted');
    }
    if (securityProfile) reasonCodes.add('securityProfileWeighted');
    if (routeConsistencyProfile) reasonCodes.add('routeConsistency');

    const eligibleCandidates = this.usableCandidatesForRouteProfile(candidates, context.selectedProfile)
      .map((candidate) => {
        const profileScore = this.scoreForRouteProfile(candidate, context.selectedProfile);
        const riskPenalty = this.calculateLoadBalancingRiskPenalty(candidate, context.selectedProfile);

        return {
          candidate,
          profileScore,
          adjustedScore: roundRouteScore(profileScore - riskPenalty),
          riskPenalty,
        };
      })
      .filter((candidate) => candidate.adjustedScore >= 45)
      .sort((left, right) => right.adjustedScore - left.adjustedScore || right.profileScore - left.profileScore);

    if (eligibleCandidates.length === 0) {
      reasonCodes.add('insufficientEligibleCandidates');

      return {
        mode: 'insufficientCandidates',
        strategy: context.loadBalanceStrategy,
        selectedProfile: context.selectedProfile,
        primaryCandidateId: null,
        primaryCandidateName: null,
        secondaryCandidateId: null,
        secondaryCandidateName: null,
        candidateCount: managedCandidateCount,
        eligibleCandidateCount: 0,
        totalAssignedWeightPercent: 0,
        reasonCodes: [...reasonCodes],
        candidates: [],
      };
    }

    const primary = eligibleCandidates[0];
    const secondary = eligibleCandidates[1] ?? null;
    const closeScoreThreshold = context.selectedProfile === 'throughput' || context.loadBalanceStrategy === 'throughput'
      ? 18
      : context.selectedProfile === 'balanced'
        ? 12
        : 8;
    const secondaryIsClose = Boolean(secondary && primary.adjustedScore - secondary.adjustedScore <= closeScoreThreshold);
    const weightedMode =
      !routeConsistencyProfile &&
      Boolean(secondary) &&
      secondaryIsClose &&
      ['balanced', 'throughput', 'tcp', 'dns'].includes(context.selectedProfile);
    const mode: AdminRouteDecisionLoadBalancingSummary['mode'] = weightedMode
      ? 'weighted'
      : eligibleCandidates.length > 1 ? 'primaryStandby' : 'singlePrimary';

    if (weightedMode) reasonCodes.add('scoreCloseToPrimary');

    const weightedCandidates = weightedMode
      ? eligibleCandidates
        .filter((item) => primary.adjustedScore - item.adjustedScore <= closeScoreThreshold)
        .slice(0, context.selectedProfile === 'throughput' || context.loadBalanceStrategy === 'throughput' ? 3 : 2)
      : [primary];
    const weightByCandidateId = new Map<string, number>();

    if (weightedMode) {
      const weightBases = weightedCandidates.map((item) => Math.max(5, item.adjustedScore - 45));
      const totalWeightBase = weightBases.reduce((sum, value) => sum + value, 0);
      let assignedWeight = 0;

      weightedCandidates.forEach((item, index) => {
        const weight = index === weightedCandidates.length - 1
          ? Math.max(0, 100 - assignedWeight)
          : Math.round((weightBases[index] / totalWeightBase) * 100);
        assignedWeight += weight;
        weightByCandidateId.set(item.candidate.id, weight);
      });
    } else {
      weightByCandidateId.set(primary.candidate.id, 100);
    }

    const visibleCandidates = eligibleCandidates.slice(0, 5);
    const summaryCandidates = visibleCandidates.map((item, index) => {
      const weightPercent = weightByCandidateId.get(item.candidate.id) ?? 0;
      const role: AdminRouteDecisionLoadBalancingSummary['candidates'][number]['role'] =
        index === 0 ? 'primary' : weightPercent > 0 ? 'secondary' : 'standby';

      return {
        id: item.candidate.id,
        name: item.candidate.name,
        role,
        weightPercent,
        score: item.candidate.score,
        profileScore: item.profileScore,
        adjustedScore: item.adjustedScore,
        riskLevel: this.routeLoadBalancingRiskLevel(item.riskPenalty, item.adjustedScore),
        reasonCodes: this.buildLoadBalancingCandidateReasons(item.candidate, {
          role,
          selectedProfile: context.selectedProfile,
          loadBalanceStrategy: context.loadBalanceStrategy,
          securityProfile,
        }),
      };
    });
    const secondaryCandidate = summaryCandidates.find((candidate) => candidate.role === 'secondary') ?? summaryCandidates[1] ?? null;
    const totalAssignedWeightPercent = summaryCandidates.reduce((sum, candidate) => sum + candidate.weightPercent, 0);

    return {
      mode,
      strategy: context.loadBalanceStrategy,
      selectedProfile: context.selectedProfile,
      primaryCandidateId: primary.candidate.id,
      primaryCandidateName: primary.candidate.name,
      secondaryCandidateId: secondaryCandidate?.id ?? null,
      secondaryCandidateName: secondaryCandidate?.name ?? null,
      candidateCount: managedCandidateCount,
      eligibleCandidateCount: eligibleCandidates.length,
      totalAssignedWeightPercent,
      reasonCodes: [...reasonCodes],
      candidates: summaryCandidates,
    };
  }

  private calculateLoadBalancingRiskPenalty(candidate: AdminWireGuardCandidate, profile: RouteScoreProfile): number {
    let penalty = 0;
    const healthStatus = String(candidate.healthStatus).toLowerCase();
    const packetLossThreshold = profile === 'gaming'
      ? 0.1
      : ['stability', 'udp', 'quic', 'wireguard'].includes(profile) ? 0.25 : 1;
    const jitterThreshold = profile === 'gaming'
      ? 6
      : ['stability', 'udp', 'quic', 'wireguard'].includes(profile) ? 10 : 25;
    const latencyThreshold = profile === 'gaming' ? 85 : profile === 'dns' ? 80 : profile === 'tcp' ? 100 : 130;

    if (healthStatus === 'critical' || healthStatus === 'down') penalty += 100;
    if (healthStatus === 'degraded') penalty += 12;
    if (healthStatus === 'unknown') penalty += 6;
    penalty += thresholdPenalty(candidate.packetLossPercent, packetLossThreshold, 18);
    penalty += thresholdPenalty(candidate.jitterMs, jitterThreshold, 0.7);
    penalty += thresholdPenalty(candidate.latencyMs, latencyThreshold, 0.05);
    penalty += thresholdPenalty(candidate.loadPercent, profile === 'gaming' ? 60 : 72, 0.3);

    if (candidate.bufferbloatSeverity === 'high') penalty += 24;
    if (candidate.bufferbloatSeverity === 'medium') penalty += 12;
    if (candidate.bufferbloatRecommendation === 'sqmRecommended') penalty += 8;
    if (candidate.bufferbloatRecommendation === 'avoidUnderLoad') penalty += 40;

    return Math.round(penalty * 10) / 10;
  }

  private routeLoadBalancingRiskLevel(riskPenalty: number, adjustedScore: number): 'low' | 'medium' | 'high' {
    if (riskPenalty >= 24 || adjustedScore < 60) return 'high';
    if (riskPenalty >= 10 || adjustedScore < 75) return 'medium';

    return 'low';
  }

  private buildLoadBalancingCandidateReasons(
    candidate: AdminWireGuardCandidate,
    context: {
      role: string;
      selectedProfile: RouteScoreProfile;
      loadBalanceStrategy: LoadBalanceStrategy | string;
      securityProfile: boolean;
    },
  ): string[] {
    const reasonCodes = new Set<string>(['profileWeighted']);

    if (context.role === 'primary') reasonCodes.add('bestCompositeScore');
    if (context.role === 'secondary') reasonCodes.add('scoreCloseToPrimary');
    if (context.role === 'standby') reasonCodes.add('standbyRoute');
    if (String(candidate.healthStatus).toLowerCase() !== 'healthy') reasonCodes.add('healthWeighted');
    if ((candidate.packetLossPercent ?? 0) > 0.1) reasonCodes.add('packetLossWeighted');
    if ((candidate.jitterMs ?? 0) > 6) reasonCodes.add('jitterWeighted');
    if ((candidate.latencyMs ?? 0) > 85) reasonCodes.add('latencyWeighted');
    if ((candidate.loadPercent ?? 0) > 65) reasonCodes.add('loadWeighted');
    if (context.selectedProfile === 'throughput' || context.loadBalanceStrategy === 'throughput') {
      reasonCodes.add('throughputWeighted');
    }
    if (context.securityProfile) reasonCodes.add('securityProfileWeighted');
    if (['gaming', 'stability', 'udp', 'quic', 'wireguard'].includes(context.selectedProfile)) {
      reasonCodes.add('routeConsistency');
    }

    return [...reasonCodes];
  }

  private bestCandidateForRouteProfile(
    candidates: AdminWireGuardCandidate[],
    profile: RouteScoreProfile,
  ): AdminWireGuardCandidate | null {
    const usableCandidates = this.usableCandidatesForRouteProfile(candidates, profile);
    if (usableCandidates.length === 0) return null;

    return usableCandidates.sort((left, right) => this.scoreForRouteProfile(right, profile) - this.scoreForRouteProfile(left, profile))[0];
  }

  private usableCandidatesForRouteProfile(
    candidates: AdminWireGuardCandidate[],
    profile: RouteScoreProfile,
  ): AdminWireGuardCandidate[] {
    return candidates.filter((candidate) => {
      const status = String(candidate.healthStatus).toLowerCase();
      if (candidate.source !== 'outbound') return false;
      if (status === 'critical' || status === 'down') return false;
      if (candidate.bufferbloatRecommendation === 'avoidUnderLoad') return false;

      return this.scoreForRouteProfile(candidate, profile) >= 50;
    });
  }

  private scoreForRouteProfile(candidate: AdminWireGuardCandidate, profile: RouteScoreProfile): number {
    return candidate.profileScores?.[profile] ?? candidate.score;
  }

  private routeDecisionScoreProfiles(): RouteScoreProfile[] {
    return ['balanced', 'stability', 'throughput', 'gaming', 'tcp', 'udp', 'quic', 'dns', 'wireguard'];
  }

  private buildRouteDecisionSessionSafetySummary(context: {
    action: RouteDecisionAction;
    selectedProfile: RouteScoreProfile;
    routeMode: string;
    routeLocked: boolean;
    autoRouteEnabled: boolean;
    cooldownActive: boolean;
    currentCandidate: AdminWireGuardCandidate | null;
    recommendedCandidate: AdminWireGuardCandidate | null;
    healthBasedSwitch: boolean;
    scoreDelta: number | null;
    hysteresisScoreDelta: number;
  }): AdminRouteDecisionSessionSafetySummary {
    const reasonCodes = new Set<string>(['assignmentOnly', 'dataPlaneDisabled']);
    const latencySensitive = this.isSessionSensitiveRouteProfile(context.selectedProfile);
    const hasSwitchCandidate = Boolean(
      context.action === 'switchRecommended' &&
        context.recommendedCandidate?.source === 'outbound' &&
        (!context.currentCandidate || context.recommendedCandidate.id !== context.currentCandidate.id),
    );
    const currentStatus = String(context.currentCandidate?.healthStatus ?? 'unknown').toLowerCase();
    const currentRouteFailed = Boolean(
      context.currentCandidate &&
        (
          context.healthBasedSwitch ||
          currentStatus === 'critical' ||
          currentStatus === 'down' ||
          !this.isRouteDecisionCandidateHealthy(context.currentCandidate)
        ),
    );

    if (context.selectedProfile === 'gaming') reasonCodes.add('gamingSensitive');
    if (['udp', 'quic', 'wireguard'].includes(context.selectedProfile)) reasonCodes.add('udpSessionSensitive');
    if (latencySensitive) reasonCodes.add('routeConsistency');
    if (context.routeLocked || !context.autoRouteEnabled || context.routeMode !== 'automatic') reasonCodes.add('manualOrLocked');
    if (context.cooldownActive) reasonCodes.add('cooldownActive');
    if (!context.currentCandidate) reasonCodes.add('noCurrentRoute');
    if (context.scoreDelta !== null && context.scoreDelta >= context.hysteresisScoreDelta) reasonCodes.add('scoreDeltaSwitch');

    if (!hasSwitchCandidate) {
      reasonCodes.add('noSwitchNeeded');

      return {
        mode: context.routeLocked || context.cooldownActive || !context.autoRouteEnabled ? 'stickyHold' : 'notRequired',
        policy: 'keepExisting',
        riskLevel: latencySensitive ? 'medium' : 'low',
        selectedProfile: context.selectedProfile,
        stickySessionTtlSeconds: latencySensitive ? 1800 : 600,
        estimatedDrainSeconds: 0,
        drainExistingSessions: false,
        switchNewSessionsOnly: false,
        emergencySwitchAllowed: false,
        reasonCodes: [...reasonCodes],
      };
    }

    if (!context.currentCandidate) {
      return {
        mode: 'safeToSwitch',
        policy: 'none',
        riskLevel: 'low',
        selectedProfile: context.selectedProfile,
        stickySessionTtlSeconds: latencySensitive ? 1800 : 600,
        estimatedDrainSeconds: 0,
        drainExistingSessions: false,
        switchNewSessionsOnly: false,
        emergencySwitchAllowed: false,
        reasonCodes: [...reasonCodes],
      };
    }

    reasonCodes.add('publicIpMayChange');
    reasonCodes.add('natStateMayReset');

    if (currentRouteFailed) {
      reasonCodes.add('emergencyHealthFailure');

      return {
        mode: 'emergencySwitch',
        policy: 'emergencyReroute',
        riskLevel: 'high',
        selectedProfile: context.selectedProfile,
        stickySessionTtlSeconds: latencySensitive ? 1800 : 600,
        estimatedDrainSeconds: 0,
        drainExistingSessions: false,
        switchNewSessionsOnly: false,
        emergencySwitchAllowed: true,
        reasonCodes: [...reasonCodes],
      };
    }

    if (latencySensitive) {
      reasonCodes.add('stickySessionsRequired');
      reasonCodes.add('drainExistingSessions');
      reasonCodes.add('newSessionsOnly');

      return {
        mode: 'drainNewSessions',
        policy: 'newSessionsOnly',
        riskLevel: context.selectedProfile === 'gaming' || ['udp', 'quic', 'wireguard'].includes(context.selectedProfile)
          ? 'high'
          : 'medium',
        selectedProfile: context.selectedProfile,
        stickySessionTtlSeconds: context.selectedProfile === 'gaming' ? 3600 : 1800,
        estimatedDrainSeconds: context.selectedProfile === 'gaming' ? 600 : 300,
        drainExistingSessions: true,
        switchNewSessionsOnly: true,
        emergencySwitchAllowed: false,
        reasonCodes: [...reasonCodes],
      };
    }

    return {
      mode: 'safeToSwitch',
      policy: 'none',
      riskLevel: 'low',
      selectedProfile: context.selectedProfile,
      stickySessionTtlSeconds: 600,
      estimatedDrainSeconds: 30,
      drainExistingSessions: false,
      switchNewSessionsOnly: false,
      emergencySwitchAllowed: false,
      reasonCodes: [...reasonCodes],
    };
  }

  private isSessionSensitiveRouteProfile(profile: RouteScoreProfile): boolean {
    return profile === 'gaming' || profile === 'stability' || profile === 'udp' || profile === 'quic' || profile === 'wireguard';
  }

  private buildRouteDecisionSwitchEngineSummary(context: {
    action: RouteDecisionAction;
    currentCandidate: AdminWireGuardCandidate | null;
    recommendedCandidate: AdminWireGuardCandidate | null;
    routeLocked: boolean;
    autoRouteEnabled: boolean;
    routeMode: string;
    cooldownActive: boolean;
    sessionSafety: AdminRouteDecisionSessionSafetySummary;
    applyPlan: AdminRouteDecisionApplyPlanSummary;
  }): AdminRouteDecisionSwitchEngineSummary {
    const reasonCodes = new Set<string>(['assignmentOnly']);
    const recommendedOutboundId = context.recommendedCandidate?.source === 'outbound' ? context.recommendedCandidate.id : null;
    const currentOutboundId = context.currentCandidate?.source === 'outbound' ? context.currentCandidate.id : null;
    const switchRequired = context.action === 'switchRecommended' && Boolean(recommendedOutboundId);

    if (!context.applyPlan.dataPlaneReady) reasonCodes.add('dataPlaneDisabled');
    if (context.applyPlan.adapter.reasonCodes.includes('server_apply_adapter_missing')) reasonCodes.add('serverApplyAdapterMissing');
    if (context.routeLocked) reasonCodes.add('routeLock');
    if (!context.autoRouteEnabled || context.routeMode !== 'automatic') reasonCodes.add('manualMode');
    if (context.cooldownActive) reasonCodes.add('cooldownActive');
    if (!switchRequired) reasonCodes.add('noSwitchNeeded');
    if (context.sessionSafety.switchNewSessionsOnly) reasonCodes.add('newSessionsOnly');
    if (context.sessionSafety.drainExistingSessions) reasonCodes.add('drainSafe');
    if (context.sessionSafety.mode === 'stickyHold' || context.sessionSafety.drainExistingSessions) reasonCodes.add('stickySessions');
    if (context.sessionSafety.emergencySwitchAllowed) reasonCodes.add('emergencySwitch');
    reasonCodes.add('rollbackPlanned');

    const blocked = context.applyPlan.status === 'blocked';
    if (blocked) reasonCodes.add('guardBlocked');

    const mode: AdminRouteDecisionSwitchEngineSummary['mode'] = !switchRequired
      ? 'noChange'
      : context.sessionSafety.emergencySwitchAllowed
        ? 'emergencyReroute'
        : context.sessionSafety.drainExistingSessions
          ? 'stickyDrain'
          : context.sessionSafety.switchNewSessionsOnly
            ? 'newSessionsOnly'
            : 'assignmentOnly';
    const status: AdminRouteDecisionSwitchEngineSummary['status'] = !switchRequired
      ? 'notRequired'
      : blocked
        ? 'blocked'
        : context.applyPlan.dataPlaneReady ? 'dataPlaneReady' : 'planningOnly';
    const futureOrReady = context.applyPlan.dataPlaneReady ? 'ready' : 'future';
    const guardStatus = blocked ? 'blocked' : switchRequired ? 'ready' : 'notRequired';
    const dataPlaneStepStatus = switchRequired && !blocked ? futureOrReady : 'notRequired';
    const steps: AdminRouteDecisionSwitchEngineSummary['steps'] = [
      {
        id: 'verify-switch-guards',
        kind: 'guard',
        code: 'verify_switch_guards',
        status: guardStatus,
        sessionImpact: 'none',
        targetOutboundId: recommendedOutboundId,
        dataPlaneMutation: false,
        estimatedSeconds: 1,
        reasonCodes: context.applyPlan.guardReasonCodes,
      },
    ];

    if (context.sessionSafety.drainExistingSessions || context.sessionSafety.switchNewSessionsOnly) {
      steps.push({
        id: 'pin-existing-sessions',
        kind: 'sessionPin',
        code: 'pin_existing_sessions',
        status: dataPlaneStepStatus,
        sessionImpact: 'existingSessions',
        targetOutboundId: currentOutboundId,
        dataPlaneMutation: true,
        estimatedSeconds: 1,
        reasonCodes: ['stickySessions'],
      });
      steps.push({
        id: 'route-new-sessions',
        kind: 'newSessionRoute',
        code: 'route_new_sessions',
        status: dataPlaneStepStatus,
        sessionImpact: 'newSessionsOnly',
        targetOutboundId: recommendedOutboundId,
        dataPlaneMutation: true,
        estimatedSeconds: 1,
        reasonCodes: ['newSessionsOnly'],
      });
    }

    if (context.sessionSafety.drainExistingSessions) {
      steps.push({
        id: 'drain-existing-sessions',
        kind: 'drain',
        code: 'drain_existing_sessions',
        status: dataPlaneStepStatus,
        sessionImpact: 'existingSessions',
        targetOutboundId: currentOutboundId,
        dataPlaneMutation: true,
        estimatedSeconds: context.sessionSafety.estimatedDrainSeconds,
        reasonCodes: ['drainSafe'],
      });
    }

    if (switchRequired) {
      steps.push({
        id: 'switch-active-route',
        kind: 'switch',
        code: context.sessionSafety.emergencySwitchAllowed ? 'emergency_switch_active_route' : 'switch_active_route',
        status: dataPlaneStepStatus,
        sessionImpact: context.sessionSafety.emergencySwitchAllowed
          ? 'allSessions'
          : context.sessionSafety.drainExistingSessions
            ? 'existingSessions'
            : 'none',
        targetOutboundId: recommendedOutboundId,
        dataPlaneMutation: true,
        estimatedSeconds: 2,
        reasonCodes: context.sessionSafety.emergencySwitchAllowed
          ? ['emergencySwitch']
          : context.sessionSafety.drainExistingSessions
            ? ['drainSafe']
            : ['assignmentOnly'],
      });
    }

    steps.push({
      id: 'verify-switched-route',
      kind: 'verify',
      code: 'verify_switched_route',
      status: switchRequired && !blocked ? futureOrReady : 'notRequired',
      sessionImpact: 'none',
      targetOutboundId: recommendedOutboundId,
      dataPlaneMutation: false,
      estimatedSeconds: 10,
      reasonCodes: [],
    });
    steps.push({
      id: 'rollback-previous-route',
      kind: 'rollback',
      code: 'rollback_previous_route',
      status: switchRequired && !blocked ? futureOrReady : 'notRequired',
      sessionImpact: 'allSessions',
      targetOutboundId: currentOutboundId,
      dataPlaneMutation: true,
      estimatedSeconds: 2,
      reasonCodes: ['rollbackPlanned'],
    });

    const estimatedTotalSeconds = steps.reduce((sum, step) => sum + (step.estimatedSeconds ?? 0), 0);

    return {
      status,
      mode,
      dataPlaneReady: context.applyPlan.dataPlaneReady,
      preserveExistingSessions: context.sessionSafety.drainExistingSessions || context.sessionSafety.switchNewSessionsOnly,
      switchNewSessionsOnly: context.sessionSafety.switchNewSessionsOnly,
      drainRequired: context.sessionSafety.drainExistingSessions,
      rollbackReady: switchRequired,
      estimatedTotalSeconds,
      reasonCodes: [...reasonCodes],
      steps,
    };
  }

  private buildRouteDecisionSwitchPreflightSummary(context: {
    action: RouteDecisionAction;
    switchEngine: AdminRouteDecisionSwitchEngineSummary;
    applyPlan: AdminRouteDecisionApplyPlanSummary;
    sessionSafety: AdminRouteDecisionSessionSafetySummary;
  }): AdminRouteDecisionSwitchPreflightSummary {
    const switchRequired = context.action === 'switchRecommended';
    const adapter = context.applyPlan.adapter;
    const checks: AdminRouteDecisionSwitchPreflightSummary['checks'] = [];
    const reasonCodes = new Set<string>();
    const dryRunSecretSafe =
      adapter.dryRunCommands.every((command) => command.secretSafe) &&
      adapter.dryRunConfigChanges.every((change) => change.secretSafe);
    const hasFailedGuards = context.applyPlan.status === 'blocked' || context.switchEngine.status === 'blocked';
    const cooldownBlocked = context.applyPlan.guardReasonCodes.includes('cooldown_active');
    const sessionSafetyRequired =
      context.sessionSafety.drainExistingSessions ||
      context.sessionSafety.switchNewSessionsOnly ||
      context.switchEngine.preserveExistingSessions;

    const addCheck = (check: AdminRouteDecisionSwitchPreflightSummary['checks'][number]) => {
      checks.push(check);
      check.reasonCodes.forEach((reason) => reasonCodes.add(reason));
    };
    const notRequired = !switchRequired;

    addCheck({
      id: 'route-data-plane-feature-flag',
      kind: 'featureFlag',
      code: 'route_data_plane_feature_flag',
      status: notRequired ? 'notRequired' : adapter.enabled ? 'passed' : 'future',
      dataPlaneMutation: false,
      estimatedSeconds: null,
      reasonCodes: notRequired || adapter.enabled ? [] : ['featureFlagDisabled'],
    });
    addCheck({
      id: 'server-apply-adapter',
      kind: 'adapter',
      code: 'server_apply_adapter',
      status: notRequired
        ? 'notRequired'
        : adapter.status === 'unsupported'
          ? 'failed'
          : adapter.implemented
            ? 'passed'
            : 'future',
      dataPlaneMutation: true,
      estimatedSeconds: null,
      reasonCodes: notRequired
        ? []
        : adapter.status === 'unsupported'
          ? ['adapterUnsupported']
          : adapter.implemented
            ? ['dataPlaneReady']
            : ['adapterMissing'],
    });
    addCheck({
      id: 'secret-safe-dry-run',
      kind: 'dryRun',
      code: 'secret_safe_dry_run',
      status: notRequired ? 'notRequired' : adapter.dryRunSupported && dryRunSecretSafe ? 'passed' : 'future',
      dataPlaneMutation: false,
      estimatedSeconds: 1,
      reasonCodes: notRequired ? [] : ['dryRunOnly'],
    });
    addCheck({
      id: 'route-switch-guards',
      kind: 'guards',
      code: 'route_switch_guards',
      status: notRequired ? 'notRequired' : hasFailedGuards ? 'failed' : 'passed',
      dataPlaneMutation: false,
      estimatedSeconds: 1,
      reasonCodes: notRequired || !hasFailedGuards ? [] : ['guardBlocked'],
    });
    addCheck({
      id: 'session-safety-policy',
      kind: 'sessionSafety',
      code: 'session_safety_policy',
      status: notRequired ? 'notRequired' : sessionSafetyRequired ? 'warning' : 'passed',
      dataPlaneMutation: true,
      estimatedSeconds: context.sessionSafety.estimatedDrainSeconds,
      reasonCodes: notRequired || !sessionSafetyRequired ? [] : ['sessionSafetyRequired'],
    });
    addCheck({
      id: 'rollback-plan',
      kind: 'rollback',
      code: 'rollback_plan',
      status: notRequired ? 'notRequired' : context.switchEngine.rollbackReady ? 'passed' : 'future',
      dataPlaneMutation: true,
      estimatedSeconds: 2,
      reasonCodes: notRequired ? [] : ['rollbackPlanned'],
    });
    addCheck({
      id: 'cooldown-policy',
      kind: 'cooldown',
      code: 'cooldown_policy',
      status: notRequired ? 'notRequired' : cooldownBlocked ? 'failed' : 'passed',
      dataPlaneMutation: false,
      estimatedSeconds: 1,
      reasonCodes: notRequired ? [] : ['cooldownRequired'],
    });
    addCheck({
      id: 'decision-audit',
      kind: 'audit',
      code: 'decision_audit',
      status: notRequired ? 'notRequired' : 'passed',
      dataPlaneMutation: false,
      estimatedSeconds: 1,
      reasonCodes: notRequired ? [] : ['auditReady'],
    });
    addCheck({
      id: 'post-switch-health-verify',
      kind: 'healthVerify',
      code: 'post_switch_health_verify',
      status: notRequired ? 'notRequired' : context.applyPlan.dataPlaneReady ? 'passed' : 'future',
      dataPlaneMutation: false,
      estimatedSeconds: 10,
      reasonCodes: notRequired
        ? []
        : context.applyPlan.dataPlaneReady
          ? ['dataPlaneReady']
          : ['healthVerifyRequired'],
    });

    if (!switchRequired) reasonCodes.add('noSwitchNeeded');

    const failedCheckCount = checks.filter((check) => check.status === 'failed').length;
    const futureCheckCount = checks.filter((check) => check.status === 'future').length;
    const dataPlaneReady = switchRequired && context.applyPlan.dataPlaneReady && context.switchEngine.dataPlaneReady && adapter.dataPlaneReady;
    if (dataPlaneReady) reasonCodes.add('dataPlaneReady');

    const canExecuteDataPlane = dataPlaneReady && failedCheckCount === 0 && futureCheckCount === 0;
    const safeToArm = switchRequired && failedCheckCount === 0 && context.switchEngine.status !== 'blocked';
    const status: AdminRouteDecisionSwitchPreflightSummary['status'] = !switchRequired
      ? 'notRequired'
      : failedCheckCount > 0
        ? 'blocked'
        : canExecuteDataPlane
          ? 'ready'
          : 'planningOnly';

    return {
      status,
      dataPlaneReady,
      canExecuteDataPlane,
      safeToArm,
      checkCount: checks.length,
      failedCheckCount,
      futureCheckCount,
      reasonCodes: [...reasonCodes],
      checks,
    };
  }

  private buildRouteDecisionSwitchRolloutSummary(context: {
    action: RouteDecisionAction;
    selectedProfile: RouteScoreProfile;
    sessionSafety: AdminRouteDecisionSessionSafetySummary;
    switchEngine: AdminRouteDecisionSwitchEngineSummary;
    switchPreflight: AdminRouteDecisionSwitchPreflightSummary;
    applyPlan: AdminRouteDecisionApplyPlanSummary;
  }): AdminRouteDecisionSwitchRolloutSummary {
    const switchRequired = context.action === 'switchRecommended';
    const blocked = context.switchPreflight.status === 'blocked' || context.applyPlan.status === 'blocked';
    const latencySensitive = this.isSessionSensitiveRouteProfile(context.selectedProfile);
    const dataPlaneReady =
      context.applyPlan.dataPlaneReady &&
      context.switchEngine.dataPlaneReady &&
      context.switchPreflight.canExecuteDataPlane;
    const emergencySwitch = context.sessionSafety.emergencySwitchAllowed;
    const existingSessionsPinned =
      context.sessionSafety.drainExistingSessions ||
      context.sessionSafety.switchNewSessionsOnly ||
      context.switchEngine.preserveExistingSessions;
    const newSessionsCanary = switchRequired && !emergencySwitch;
    const initialPercent = !switchRequired ? 0 : latencySensitive ? 5 : 10;
    const maxPercent = switchRequired ? 100 : 0;
    const canaryDurationSeconds = latencySensitive ? 600 : 300;
    const routeConsistencyHoldSeconds = existingSessionsPinned
      ? Math.max(context.sessionSafety.stickySessionTtlSeconds, context.sessionSafety.estimatedDrainSeconds)
      : 0;
    const rollbackOnLossPercent = latencySensitive ? 1 : 2;
    const rollbackOnJitterMs = context.selectedProfile === 'gaming' ? 15 : latencySensitive ? 25 : 40;
    const rollbackOnLatencyMs = context.selectedProfile === 'gaming' ? 80 : latencySensitive ? 120 : 180;
    const reasonCodes = new Set<string>();

    if (!switchRequired) reasonCodes.add('noSwitchNeeded');
    if (!dataPlaneReady) reasonCodes.add('dataPlaneDisabled');
    if (blocked) reasonCodes.add('preflightBlocked');
    if (existingSessionsPinned) reasonCodes.add('stickySessions');
    if (context.sessionSafety.switchNewSessionsOnly) reasonCodes.add('newSessionsOnly');
    if (emergencySwitch) reasonCodes.add('emergencySwitch');
    if (newSessionsCanary) reasonCodes.add('canaryRequired');
    if (latencySensitive) reasonCodes.add('gamingSensitive');
    if (routeConsistencyHoldSeconds > 0) reasonCodes.add('routeConsistencyHold');
    if (switchRequired) {
      reasonCodes.add('assignmentOnly');
      reasonCodes.add('rollbackGuard');
      reasonCodes.add('healthVerifyRequired');
    }
    if (dataPlaneReady) reasonCodes.add('dataPlaneReady');

    const status: AdminRouteDecisionSwitchRolloutSummary['status'] = !switchRequired
      ? 'notRequired'
      : blocked
        ? 'blocked'
        : emergencySwitch
          ? 'emergencyOnly'
          : dataPlaneReady
            ? 'canaryReady'
            : 'planningOnly';
    const strategy: AdminRouteDecisionSwitchRolloutSummary['strategy'] = !switchRequired
      ? 'none'
      : emergencySwitch
        ? 'emergencyReroute'
        : existingSessionsPinned
          ? 'stickyDrainCanary'
          : dataPlaneReady
            ? 'newSessionCanary'
            : 'assignmentOnly';
    const futureOrReady = dataPlaneReady ? 'ready' : 'future';
    const rolloutStepStatus = !switchRequired ? 'notRequired' : blocked ? 'blocked' : futureOrReady;
    const assignmentStatus = !switchRequired ? 'notRequired' : blocked ? 'blocked' : 'ready';
    const steps: AdminRouteDecisionSwitchRolloutSummary['steps'] = [
      {
        id: 'persist-control-plane-assignment',
        phase: 'assignment',
        code: 'persist_control_plane_assignment',
        status: assignmentStatus,
        trafficScope: 'controlPlane',
        targetPercent: switchRequired ? 100 : 0,
        durationSeconds: 1,
        dataPlaneMutation: false,
        reasonCodes: switchRequired ? ['assignmentOnly'] : ['noSwitchNeeded'],
      },
      {
        id: 'pin-existing-sessions-for-rollout',
        phase: 'pinExisting',
        code: 'pin_existing_sessions_for_rollout',
        status: switchRequired && existingSessionsPinned && !blocked ? rolloutStepStatus : 'notRequired',
        trafficScope: 'newSessions',
        targetPercent: 0,
        durationSeconds: routeConsistencyHoldSeconds,
        dataPlaneMutation: true,
        reasonCodes: existingSessionsPinned ? ['stickySessions', 'routeConsistencyHold'] : [],
      },
      {
        id: 'canary-new-sessions',
        phase: 'canary',
        code: 'canary_new_sessions',
        status: switchRequired && newSessionsCanary && !blocked ? rolloutStepStatus : 'notRequired',
        trafficScope: 'canary',
        targetPercent: initialPercent,
        durationSeconds: canaryDurationSeconds,
        dataPlaneMutation: true,
        reasonCodes: newSessionsCanary ? ['canaryRequired', 'newSessionsOnly'] : [],
      },
      {
        id: 'verify-canary-health',
        phase: 'verify',
        code: 'verify_canary_health',
        status: switchRequired && !blocked ? rolloutStepStatus : 'notRequired',
        trafficScope: 'canary',
        targetPercent: initialPercent,
        durationSeconds: 60,
        dataPlaneMutation: false,
        reasonCodes: ['healthVerifyRequired'],
      },
      {
        id: 'expand-new-session-rollout',
        phase: 'expand',
        code: 'expand_new_session_rollout',
        status: switchRequired && newSessionsCanary && !blocked ? rolloutStepStatus : 'notRequired',
        trafficScope: 'allNewSessions',
        targetPercent: Math.min(50, maxPercent),
        durationSeconds: canaryDurationSeconds,
        dataPlaneMutation: true,
        reasonCodes: ['canaryRequired'],
      },
      {
        id: 'complete-new-session-rollout',
        phase: 'full',
        code: 'complete_new_session_rollout',
        status: switchRequired && newSessionsCanary && !blocked ? rolloutStepStatus : 'notRequired',
        trafficScope: 'allNewSessions',
        targetPercent: maxPercent,
        durationSeconds: routeConsistencyHoldSeconds,
        dataPlaneMutation: true,
        reasonCodes: ['routeConsistencyHold'],
      },
      {
        id: 'rollback-on-regression',
        phase: 'rollback',
        code: 'rollback_on_regression',
        status: switchRequired && !blocked ? rolloutStepStatus : 'notRequired',
        trafficScope: 'allSessions',
        targetPercent: 0,
        durationSeconds: 2,
        dataPlaneMutation: true,
        reasonCodes: ['rollbackGuard'],
      },
    ];

    return {
      status,
      strategy,
      dataPlaneReady,
      existingSessionsPinned,
      newSessionsCanary,
      automaticExpansion: dataPlaneReady && !latencySensitive && !emergencySwitch && !blocked,
      initialPercent,
      maxPercent,
      canaryDurationSeconds,
      routeConsistencyHoldSeconds,
      rollbackOnLossPercent,
      rollbackOnJitterMs,
      rollbackOnLatencyMs,
      reasonCodes: [...reasonCodes],
      steps,
    };
  }

  private buildRouteDecisionSwitchRolloutEvaluationSummary(context: {
    action: RouteDecisionAction;
    selectedProfile: RouteScoreProfile;
    evaluatedAt: Date;
    recommendedCandidate: AdminWireGuardCandidate | null;
    switchPreflight: AdminRouteDecisionSwitchPreflightSummary;
    switchRollout: AdminRouteDecisionSwitchRolloutSummary;
  }): AdminRouteDecisionSwitchRolloutEvaluationSummary {
    const switchRequired = context.action === 'switchRecommended';
    const observedLossPercent = context.recommendedCandidate?.packetLossPercent ?? null;
    const observedJitterMs = context.recommendedCandidate?.jitterMs ?? null;
    const observedLatencyMs = context.recommendedCandidate?.latencyMs ?? null;
    const observedScore = context.recommendedCandidate?.score ?? null;
    const lossTriggered =
      observedLossPercent !== null && observedLossPercent > context.switchRollout.rollbackOnLossPercent;
    const jitterTriggered =
      observedJitterMs !== null && observedJitterMs > context.switchRollout.rollbackOnJitterMs;
    const latencyTriggered =
      observedLatencyMs !== null && observedLatencyMs > context.switchRollout.rollbackOnLatencyMs;
    const scoreTooLow = observedScore !== null && observedScore < 50;
    const hasHealthSignals =
      observedLossPercent !== null ||
      observedJitterMs !== null ||
      observedLatencyMs !== null ||
      observedScore !== null;
    const rolloutBlocked =
      context.switchRollout.status === 'blocked' ||
      context.switchPreflight.status === 'blocked' ||
      context.switchRollout.reasonCodes.includes('preflightBlocked');
    const regressionDetected = lossTriggered || jitterTriggered || latencyTriggered || scoreTooLow;
    const routeConsistencyHoldActive =
      switchRequired &&
      context.switchRollout.existingSessionsPinned &&
      context.switchRollout.routeConsistencyHoldSeconds > 0;
    const guardPassed =
      switchRequired &&
      !rolloutBlocked &&
      hasHealthSignals &&
      !regressionDetected;
    const reasonCodes = new Set<string>();

    if (!switchRequired) reasonCodes.add('noSwitchNeeded');
    if (rolloutBlocked) reasonCodes.add('rolloutBlocked');
    if (context.switchPreflight.status === 'blocked') reasonCodes.add('preflightBlocked');
    if (!context.switchRollout.dataPlaneReady) reasonCodes.add('dataPlaneDisabled');
    if (!hasHealthSignals && switchRequired) reasonCodes.add('healthUnknown');
    if (lossTriggered) reasonCodes.add('lossGuardTriggered');
    if (jitterTriggered) reasonCodes.add('jitterGuardTriggered');
    if (latencyTriggered) reasonCodes.add('latencyGuardTriggered');
    if (scoreTooLow) reasonCodes.add('scoreTooLow');
    if (routeConsistencyHoldActive) reasonCodes.add('routeConsistencyHold');
    if (this.isSessionSensitiveRouteProfile(context.selectedProfile)) reasonCodes.add('gamingSensitive');
    if (guardPassed) reasonCodes.add('guardPassed');

    const status: AdminRouteDecisionSwitchRolloutEvaluationSummary['status'] = !switchRequired
      ? 'notRequired'
      : rolloutBlocked
        ? 'blocked'
        : regressionDetected
          ? 'rollbackRecommended'
          : !hasHealthSignals
            ? 'hold'
            : !context.switchRollout.dataPlaneReady
              ? 'planningOnly'
              : context.switchRollout.automaticExpansion && !routeConsistencyHoldActive
                ? 'expandReady'
                : 'canaryReady';
    const recommendedAction: AdminRouteDecisionSwitchRolloutEvaluationSummary['recommendedAction'] = !switchRequired
      ? 'none'
      : rolloutBlocked || !hasHealthSignals
        ? 'manualReview'
        : regressionDetected
          ? 'rollback'
          : !context.switchRollout.dataPlaneReady
            ? 'hold'
            : status === 'expandReady'
              ? 'expandCanary'
              : 'startCanary';

    if (recommendedAction === 'manualReview') reasonCodes.add('manualReviewRequired');
    if (recommendedAction === 'startCanary') reasonCodes.add('canaryReady');
    if (recommendedAction === 'expandCanary') reasonCodes.add('expansionReady');

    const canaryPercent = switchRequired ? context.switchRollout.initialPercent : 0;
    const nextPercent =
      recommendedAction === 'expandCanary'
        ? Math.min(context.switchRollout.maxPercent, Math.max(canaryPercent * 2, 10))
        : recommendedAction === 'startCanary'
          ? canaryPercent
          : 0;

    return {
      status,
      recommendedAction,
      evaluatedAt: context.evaluatedAt.toISOString(),
      dataPlaneReady: context.switchRollout.dataPlaneReady,
      guardPassed,
      routeConsistencyHoldActive,
      canaryPercent,
      nextPercent,
      maxPercent: context.switchRollout.maxPercent,
      holdSecondsRemaining: routeConsistencyHoldActive ? context.switchRollout.routeConsistencyHoldSeconds : 0,
      observedLossPercent,
      observedJitterMs,
      observedLatencyMs,
      observedScore,
      reasonCodes: [...reasonCodes],
    };
  }

  private buildRouteDecisionSwitchOrchestrationSummary(context: {
    action: RouteDecisionAction;
    generatedAt: Date;
    currentCandidate: AdminWireGuardCandidate | null;
    recommendedCandidate: AdminWireGuardCandidate | null;
    routeLocked: boolean;
    autoRouteEnabled: boolean;
    routeMode: string;
    cooldownActive: boolean;
    sessionSafety: AdminRouteDecisionSessionSafetySummary;
    switchEngine: AdminRouteDecisionSwitchEngineSummary;
    switchPreflight: AdminRouteDecisionSwitchPreflightSummary;
    switchRollout: AdminRouteDecisionSwitchRolloutSummary;
    switchRolloutEvaluation: AdminRouteDecisionSwitchRolloutEvaluationSummary;
    applyPlan: AdminRouteDecisionApplyPlanSummary;
  }): AdminRouteDecisionSwitchOrchestrationSummary {
    const fromOutboundId = context.currentCandidate?.source === 'outbound' ? context.currentCandidate.id : null;
    const toOutboundId = context.recommendedCandidate?.source === 'outbound' ? context.recommendedCandidate.id : null;
    const switchRequired = context.action === 'switchRecommended' && Boolean(toOutboundId);
    const gateBlocked =
      context.action === 'routeLocked' ||
      context.action === 'manualMode' ||
      context.action === 'cooldownActive' ||
      context.action === 'insufficientCandidates' ||
      context.action === 'noHealthyCandidate' ||
      context.action === 'noManagedCandidate';
    const preflightBlocked = context.switchPreflight.status === 'blocked';
    const rolloutBlocked =
      context.switchRollout.status === 'blocked' ||
      context.switchRolloutEvaluation.status === 'blocked';
    const blocked = gateBlocked || preflightBlocked || rolloutBlocked || context.applyPlan.status === 'blocked';
    const canExecuteDataPlane = context.switchPreflight.canExecuteDataPlane && context.switchRollout.dataPlaneReady;
    const assignmentOnly =
      switchRequired &&
      context.applyPlan.assignmentOnlyAvailable &&
      (!canExecuteDataPlane || context.applyPlan.applyMode === 'assignmentOnly');
    const rollbackRequired = context.switchRolloutEvaluation.status === 'rollbackRecommended';
    const preserveExistingSessions = context.switchEngine.preserveExistingSessions;
    const switchNewSessionsOnly = context.switchEngine.switchNewSessionsOnly;
    const activeSessionsMayMove = context.sessionSafety.emergencySwitchAllowed && switchRequired;
    const activeSessionsProtected =
      !activeSessionsMayMove &&
      (preserveExistingSessions || switchNewSessionsOnly || context.switchRollout.existingSessionsPinned);
    const holdSecondsRemaining = context.switchRolloutEvaluation.holdSecondsRemaining;
    const reasonCodes = new Set<string>();

    if (!switchRequired && !gateBlocked) reasonCodes.add('noSwitchNeeded');
    if (context.routeLocked || context.action === 'routeLocked') reasonCodes.add('routeLock');
    if (!context.autoRouteEnabled || context.routeMode !== 'automatic' || context.action === 'manualMode') reasonCodes.add('manualMode');
    if (context.cooldownActive || context.action === 'cooldownActive') reasonCodes.add('cooldownActive');
    if (assignmentOnly) reasonCodes.add('assignmentOnly');
    if (!canExecuteDataPlane) reasonCodes.add('dataPlaneDisabled');
    if (preflightBlocked) reasonCodes.add('preflightBlocked');
    if (rolloutBlocked) reasonCodes.add('rolloutBlocked');
    if (context.switchRolloutEvaluation.guardPassed) reasonCodes.add('guardPassed');
    if (context.switchRolloutEvaluation.reasonCodes.includes('healthUnknown')) reasonCodes.add('healthUnknown');
    if (rollbackRequired) reasonCodes.add('rollbackGuard');
    if (preserveExistingSessions) reasonCodes.add('stickySessions');
    if (switchNewSessionsOnly) reasonCodes.add('newSessionsOnly');
    if (context.switchEngine.drainRequired) reasonCodes.add('drainSafe');
    if (context.switchRollout.newSessionsCanary) reasonCodes.add('canaryRequired');
    if (context.switchRolloutEvaluation.routeConsistencyHoldActive) reasonCodes.add('routeConsistencyHold');
    if (context.switchRolloutEvaluation.reasonCodes.includes('gamingSensitive')) reasonCodes.add('gamingSensitive');
    if (switchRequired) reasonCodes.add('auditRequired');
    if (canExecuteDataPlane) reasonCodes.add('dataPlaneReady');

    const recommendedAction: AdminRouteDecisionSwitchOrchestrationSummary['recommendedAction'] = !switchRequired
      ? gateBlocked
        ? context.action === 'cooldownActive'
          ? 'hold'
          : 'manualReview'
        : 'none'
      : blocked
        ? 'manualReview'
        : rollbackRequired
          ? 'rollback'
          : context.switchRolloutEvaluation.recommendedAction === 'expandCanary'
            ? canExecuteDataPlane ? 'expandCanary' : 'recordDecision'
            : context.switchRolloutEvaluation.recommendedAction === 'startCanary'
              ? canExecuteDataPlane ? 'startCanary' : 'recordDecision'
              : context.switchRolloutEvaluation.recommendedAction === 'hold'
                ? 'hold'
                : context.switchRolloutEvaluation.recommendedAction === 'manualReview'
                  ? 'manualReview'
                  : assignmentOnly
                    ? 'recordDecision'
                    : 'hold';
    const status: AdminRouteDecisionSwitchOrchestrationSummary['status'] = !switchRequired && !gateBlocked
      ? 'notRequired'
      : blocked
        ? 'blocked'
        : rollbackRequired
          ? 'rollbackRecommended'
          : recommendedAction === 'hold' || holdSecondsRemaining > 0
            ? 'holding'
            : recommendedAction === 'expandCanary'
              ? 'expandReady'
              : recommendedAction === 'startCanary'
                ? 'canaryReady'
                : assignmentOnly
                  ? 'assignmentOnly'
                  : canExecuteDataPlane
                    ? 'dataPlaneReady'
                    : 'planningOnly';
    const phase: AdminRouteDecisionSwitchOrchestrationSummary['phase'] = status === 'notRequired'
      ? 'noChange'
      : blocked
        ? 'guard'
        : rollbackRequired
          ? 'rollback'
          : recommendedAction === 'expandCanary'
            ? 'expand'
            : recommendedAction === 'startCanary'
              ? 'canary'
              : assignmentOnly
                ? 'assignment'
                : preserveExistingSessions
                  ? 'pinExisting'
                  : 'verify';

    const guardStatus = status === 'notRequired' ? 'notRequired' : blocked ? 'blocked' : 'ready';
    const dataPlaneStageStatus = !switchRequired ? 'notRequired' : blocked ? 'blocked' : canExecuteDataPlane ? 'ready' : 'future';
    const assignmentStatus = !switchRequired ? 'notRequired' : blocked ? 'blocked' : 'ready';
    const holdStatus = holdSecondsRemaining > 0 ? 'hold' : 'notRequired';
    const stages: AdminRouteDecisionSwitchOrchestrationSummary['stages'] = [
      {
        id: 'orchestrate-guard-route-gates',
        phase: 'guard',
        code: 'guard_route_locks_cooldown_and_health',
        status: guardStatus,
        trafficScope: 'none',
        sessionImpact: 'none',
        targetPercent: 0,
        targetOutboundId: toOutboundId,
        dataPlaneMutation: false,
        estimatedSeconds: 1,
        reasonCodes: [...reasonCodes].filter((reason) =>
          ['routeLock', 'manualMode', 'cooldownActive', 'preflightBlocked', 'rolloutBlocked', 'guardPassed', 'healthUnknown'].includes(reason),
        ),
      },
      {
        id: 'orchestrate-record-assignment',
        phase: 'assignment',
        code: 'record_control_plane_assignment',
        status: assignmentStatus,
        trafficScope: 'controlPlane',
        sessionImpact: 'none',
        targetPercent: switchRequired ? 100 : 0,
        targetOutboundId: toOutboundId,
        dataPlaneMutation: false,
        estimatedSeconds: 1,
        reasonCodes: switchRequired ? ['assignmentOnly', 'auditRequired'] : ['noSwitchNeeded'],
      },
      {
        id: 'orchestrate-pin-existing',
        phase: 'pinExisting',
        code: 'pin_existing_active_sessions',
        status: switchRequired && preserveExistingSessions ? dataPlaneStageStatus : 'notRequired',
        trafficScope: 'newSessions',
        sessionImpact: 'existingSessions',
        targetPercent: 0,
        targetOutboundId: fromOutboundId,
        dataPlaneMutation: true,
        estimatedSeconds: 1,
        reasonCodes: preserveExistingSessions ? ['stickySessions'] : [],
      },
      {
        id: 'orchestrate-canary-new-sessions',
        phase: 'canary',
        code: 'canary_new_sessions_only',
        status: switchRequired && context.switchRollout.newSessionsCanary ? dataPlaneStageStatus : 'notRequired',
        trafficScope: 'canary',
        sessionImpact: 'newSessionsOnly',
        targetPercent: context.switchRolloutEvaluation.canaryPercent,
        targetOutboundId: toOutboundId,
        dataPlaneMutation: true,
        estimatedSeconds: context.switchRollout.canaryDurationSeconds,
        reasonCodes: context.switchRollout.newSessionsCanary ? ['canaryRequired', 'newSessionsOnly'] : [],
      },
      {
        id: 'orchestrate-hold-consistency',
        phase: 'drain',
        code: 'hold_route_consistency_window',
        status: switchRequired ? holdStatus : 'notRequired',
        trafficScope: 'newSessions',
        sessionImpact: 'existingSessions',
        targetPercent: context.switchRolloutEvaluation.canaryPercent,
        targetOutboundId: fromOutboundId,
        dataPlaneMutation: false,
        estimatedSeconds: holdSecondsRemaining,
        reasonCodes: holdSecondsRemaining > 0 ? ['routeConsistencyHold', 'drainSafe'] : [],
      },
      {
        id: 'orchestrate-verify-canary',
        phase: 'verify',
        code: 'verify_loss_jitter_latency_guards',
        status: switchRequired && !blocked ? (rollbackRequired ? 'blocked' : dataPlaneStageStatus) : 'notRequired',
        trafficScope: 'canary',
        sessionImpact: 'none',
        targetPercent: context.switchRolloutEvaluation.canaryPercent,
        targetOutboundId: toOutboundId,
        dataPlaneMutation: false,
        estimatedSeconds: 60,
        reasonCodes: rollbackRequired ? ['rollbackGuard'] : ['guardPassed'],
      },
      {
        id: 'orchestrate-expand',
        phase: 'expand',
        code: 'expand_new_session_rollout',
        status: recommendedAction === 'expandCanary' ? 'ready' : switchRequired && !blocked ? 'future' : 'notRequired',
        trafficScope: 'allNewSessions',
        sessionImpact: 'newSessionsOnly',
        targetPercent: context.switchRolloutEvaluation.nextPercent,
        targetOutboundId: toOutboundId,
        dataPlaneMutation: true,
        estimatedSeconds: context.switchRollout.canaryDurationSeconds,
        reasonCodes: ['canaryRequired'],
      },
      {
        id: 'orchestrate-rollback',
        phase: 'rollback',
        code: 'rollback_on_guard_regression',
        status: rollbackRequired ? 'ready' : switchRequired && !blocked ? 'future' : 'notRequired',
        trafficScope: 'allSessions',
        sessionImpact: 'allSessions',
        targetPercent: 0,
        targetOutboundId: fromOutboundId,
        dataPlaneMutation: true,
        estimatedSeconds: 2,
        reasonCodes: ['rollbackGuard'],
      },
    ];

    return {
      status,
      phase,
      recommendedAction,
      generatedAt: context.generatedAt.toISOString(),
      dataPlaneReady: context.switchRollout.dataPlaneReady,
      canExecuteDataPlane,
      assignmentOnly,
      routeLocked: context.routeLocked,
      cooldownActive: context.cooldownActive,
      preserveExistingSessions,
      switchNewSessionsOnly,
      activeSessionsProtected,
      activeSessionsMayMove,
      canaryPercent: context.switchRolloutEvaluation.canaryPercent,
      nextPercent: context.switchRolloutEvaluation.nextPercent,
      holdSecondsRemaining,
      rollbackRequired,
      stageCount: stages.length,
      reasonCodes: [...reasonCodes],
      stages,
    };
  }

  private buildRouteDecisionSwitchExecutionSummary(context: {
    preview: AdminRouteDecisionPreviewResponse;
    appliedAt: Date;
    cooldownUntil: Date;
    assignmentApplied: boolean;
    dataPlaneApplied: boolean;
  }): AdminRouteDecisionSwitchExecutionSummary {
    const fromOutboundId = context.preview.currentCandidate?.source === 'outbound' ? context.preview.currentCandidate.id : null;
    const toOutboundId = context.preview.recommendedCandidate?.source === 'outbound' ? context.preview.recommendedCandidate.id : null;
    const switchRequired = context.preview.action === 'switchRecommended' && Boolean(toOutboundId);
    const reasonCodes = new Set<string>(['assignmentOnly']);

    if (context.assignmentApplied) reasonCodes.add('assignmentApplied');
    if (!context.dataPlaneApplied) reasonCodes.add('dataPlaneNotApplied');
    if (!context.preview.switchEngine.dataPlaneReady) reasonCodes.add('dataPlaneDisabled');
    if (context.preview.applyPlan.adapter.reasonCodes.includes('server_apply_adapter_missing')) reasonCodes.add('serverApplyAdapterMissing');
    if (context.preview.switchEngine.preserveExistingSessions) reasonCodes.add('stickySessionsPreserved');
    if (context.preview.switchEngine.switchNewSessionsOnly) reasonCodes.add('newSessionsOnly');
    if (context.preview.switchEngine.drainRequired) reasonCodes.add('drainWindowArmed');
    if (context.preview.sessionSafety.emergencySwitchAllowed) reasonCodes.add('emergencySwitch');
    if (context.preview.switchEngine.rollbackReady) reasonCodes.add('rollbackReady');
    reasonCodes.add('cooldownArmed');

    const status: AdminRouteDecisionSwitchExecutionSummary['status'] = !switchRequired
      ? 'notRequired'
      : !context.assignmentApplied
        ? 'blocked'
        : context.dataPlaneApplied
          ? 'dataPlaneApplied'
          : context.preview.switchEngine.dataPlaneReady
            ? 'controlPlaneApplied'
            : 'dataPlaneBlocked';
    const phase: AdminRouteDecisionSwitchExecutionSummary['phase'] = !switchRequired
      ? 'noChange'
      : context.dataPlaneApplied
        ? 'dataPlaneApplied'
        : context.preview.sessionSafety.emergencySwitchAllowed
          ? 'emergencyApplied'
          : context.preview.switchEngine.drainRequired
            ? 'stickyDrainArmed'
            : context.preview.switchEngine.switchNewSessionsOnly
              ? 'newSessionsArmed'
              : 'guarded';
    const stickyUntil = context.preview.switchEngine.preserveExistingSessions
      ? new Date(context.appliedAt.getTime() + context.preview.sessionSafety.stickySessionTtlSeconds * 1000).toISOString()
      : null;
    const drainUntil = context.preview.switchEngine.drainRequired
      ? new Date(context.appliedAt.getTime() + context.preview.sessionSafety.estimatedDrainSeconds * 1000).toISOString()
      : null;
    const executedStepIds = [
      ...context.preview.switchEngine.steps
        .filter((step) => !step.dataPlaneMutation && step.status !== 'blocked' && step.status !== 'notRequired')
        .map((step) => step.id),
      ...context.preview.applyPlan.steps
        .filter((step) => !step.dataPlaneMutation && ['persist-assignment', 'set-cooldown'].includes(step.id))
        .map((step) => step.id),
    ];
    const futureStepIds = context.preview.switchEngine.steps
      .filter((step) => step.dataPlaneMutation && !context.dataPlaneApplied)
      .map((step) => step.id);

    return {
      status,
      phase,
      generatedAt: context.preview.generatedAt,
      appliedAt: context.appliedAt.toISOString(),
      fromOutboundId,
      toOutboundId,
      assignmentApplied: context.assignmentApplied,
      dataPlaneApplied: context.dataPlaneApplied,
      dataPlaneReady: context.preview.switchEngine.dataPlaneReady,
      preserveExistingSessions: context.preview.switchEngine.preserveExistingSessions,
      switchNewSessionsOnly: context.preview.switchEngine.switchNewSessionsOnly,
      drainRequired: context.preview.switchEngine.drainRequired,
      emergencySwitch: context.preview.sessionSafety.emergencySwitchAllowed,
      stickyUntil,
      drainUntil,
      cooldownUntil: context.cooldownUntil.toISOString(),
      rollbackReady: context.preview.switchEngine.rollbackReady,
      executedStepIds: [...new Set(executedStepIds)],
      futureStepIds,
      reasonCodes: [...reasonCodes],
    };
  }

  private buildRouteDecisionApplyPlan(context: {
    action: RouteDecisionAction;
    currentCandidate: AdminWireGuardCandidate | null;
    recommendedCandidate: AdminWireGuardCandidate | null;
    routeLocked: boolean;
    autoRouteEnabled: boolean;
    cooldownActive: boolean;
    hysteresisScoreDelta: number;
    healthBasedSwitch: boolean;
    sessionSafety: AdminRouteDecisionSessionSafetySummary;
    scoreDelta: number | null;
  }): AdminRouteDecisionApplyPlanSummary {
    const guardReasonCodes = new Set<string>();
    const recommendedOutboundId = context.recommendedCandidate?.source === 'outbound' ? context.recommendedCandidate.id : null;
    const currentOutboundId = context.currentCandidate?.source === 'outbound' ? context.currentCandidate.id : null;
    const adapter = this.buildRouteDecisionApplyAdapter(context.recommendedCandidate, context.currentCandidate);

    if (context.action !== 'switchRecommended') guardReasonCodes.add('apply_requires_switch_recommended');
    if (context.routeLocked) guardReasonCodes.add('route_locked');
    if (!context.autoRouteEnabled) guardReasonCodes.add('manual_mode');
    if (context.cooldownActive) guardReasonCodes.add('cooldown_active');
    if (!recommendedOutboundId) guardReasonCodes.add('agent_candidate_not_applicable');
    if (
      !context.healthBasedSwitch &&
      context.scoreDelta !== null &&
      context.currentCandidate &&
      context.scoreDelta < context.hysteresisScoreDelta
    ) {
      guardReasonCodes.add('score_delta_below_hysteresis');
    }

    const assignmentOnlyAvailable =
      context.action === 'switchRecommended' &&
      Boolean(recommendedOutboundId) &&
      !context.routeLocked &&
      context.autoRouteEnabled &&
      !context.cooldownActive;

    if (assignmentOnlyAvailable) {
      adapter.reasonCodes.forEach((reason) => guardReasonCodes.add(reason));
    }
    const dataPlaneReady = assignmentOnlyAvailable && adapter.dataPlaneReady;

    const status: AdminRouteDecisionApplyPlanSummary['status'] = assignmentOnlyAvailable
      ? dataPlaneReady ? 'dataPlaneReady' : 'assignmentOnlyReady'
      : context.action === 'keepCurrent'
        ? 'notRequired'
        : 'blocked';
    const estimatedDrainSeconds = assignmentOnlyAvailable ? context.sessionSafety.estimatedDrainSeconds : 0;

    return {
      status,
      applyMode: 'assignmentOnly',
      dataPlaneReady,
      assignmentOnlyAvailable,
      adapter,
      estimatedDrainSeconds,
      guardReasonCodes: [...guardReasonCodes],
      steps: [
        {
          id: 'verify-preview-fresh',
          kind: 'guard',
          code: 'verify_preview_fresh',
          targetOutboundId: recommendedOutboundId,
          dataPlaneMutation: false,
          estimatedSeconds: 1,
        },
        {
          id: 'verify-route-lock-clear',
          kind: 'guard',
          code: 'verify_route_lock_clear',
          targetOutboundId: recommendedOutboundId,
          dataPlaneMutation: false,
          estimatedSeconds: 1,
        },
        {
          id: 'verify-cooldown-clear',
          kind: 'guard',
          code: 'verify_cooldown_clear',
          targetOutboundId: recommendedOutboundId,
          dataPlaneMutation: false,
          estimatedSeconds: 1,
        },
        {
          id: 'persist-assignment',
          kind: 'assignment',
          code: 'persist_assignment',
          targetOutboundId: recommendedOutboundId,
          dataPlaneMutation: false,
          estimatedSeconds: 1,
        },
        {
          id: 'set-cooldown',
          kind: 'assignment',
          code: 'set_cooldown',
          targetOutboundId: recommendedOutboundId,
          dataPlaneMutation: false,
          estimatedSeconds: 1,
        },
        {
          id: 'drain-current-route',
          kind: 'drain',
          code: 'drain_current_route',
          targetOutboundId: currentOutboundId,
          dataPlaneMutation: true,
          estimatedSeconds: estimatedDrainSeconds,
        },
        {
          id: 'switch-data-plane-route',
          kind: 'switch',
          code: 'switch_data_plane_route',
          targetOutboundId: recommendedOutboundId,
          dataPlaneMutation: true,
          estimatedSeconds: 2,
        },
        {
          id: 'verify-route-health',
          kind: 'verify',
          code: 'verify_route_health',
          targetOutboundId: recommendedOutboundId,
          dataPlaneMutation: false,
          estimatedSeconds: 10,
        },
      ],
      rollbackSteps: [
        {
          id: 'restore-previous-route',
          kind: 'rollback',
          code: 'restore_previous_route',
          targetOutboundId: currentOutboundId,
          dataPlaneMutation: true,
          estimatedSeconds: 2,
        },
      ],
    };
  }

  private buildRouteDecisionApplyAdapter(
    candidate: AdminWireGuardCandidate | null,
    currentCandidate: AdminWireGuardCandidate | null,
  ): AdminRouteDecisionApplyAdapterSummary {
    const enabled = this.configFlag('AFROGATE_ROUTE_DATA_PLANE_APPLY_ENABLED', false);
    const outboundType = candidate?.source === 'outbound' ? 'wireguard' : null;
    const supportedOutboundTypes = ['wireguard'];
    const supportedProtocols = ['wireguard'];
    const implemented = false;
    const reasonCodes = new Set<string>();

    if (!candidate) {
      reasonCodes.add('no_managed_candidate');
    } else if (candidate.source !== 'outbound') {
      reasonCodes.add('agent_candidate_not_applicable');
    } else if (!outboundType || !supportedOutboundTypes.includes(outboundType)) {
      reasonCodes.add('route_apply_adapter_unsupported');
    }

    if (!enabled) reasonCodes.add('data_plane_apply_disabled');
    if (!implemented) reasonCodes.add('server_apply_adapter_missing');
    if (candidate?.source === 'outbound') reasonCodes.add('dry_run_only');

    const dataPlaneReady = Boolean(candidate?.source === 'outbound' && outboundType && enabled && implemented);
    const status: AdminRouteDecisionApplyAdapterSummary['status'] = dataPlaneReady
      ? 'ready'
      : !candidate || candidate.source !== 'outbound'
        ? 'missing'
        : !supportedOutboundTypes.includes(outboundType ?? '')
          ? 'unsupported'
          : 'disabled';

    return {
      id: 'wireguard-policy-routing',
      label: 'WireGuard policy routing adapter',
      status,
      outboundType,
      protocol: outboundType,
      enabled,
      implemented,
      dataPlaneReady,
      supportedOutboundTypes,
      supportedProtocols,
      reasonCodes: [...reasonCodes],
      dryRunSupported: Boolean(candidate?.source === 'outbound'),
      dryRunCommands: this.buildWireGuardDryRunCommands(candidate, currentCandidate),
      dryRunConfigChanges: this.buildWireGuardDryRunConfigChanges(candidate),
    };
  }

  private buildWireGuardDryRunCommands(
    candidate: AdminWireGuardCandidate | null,
    currentCandidate: AdminWireGuardCandidate | null,
  ): AdminRouteDecisionApplyDryRunCommand[] {
    if (!candidate || candidate.source !== 'outbound') return [];

    const interfaceName = safeWireGuardInterfaceName(candidate.interfaceName, candidate.id);
    const currentInterfaceName = currentCandidate?.source === 'outbound'
      ? safeWireGuardInterfaceName(currentCandidate.interfaceName, currentCandidate.id)
      : null;
    const routeTable = safeRouteTableName(candidate.routeGroup);
    const mark = routeMarkHex(candidate.routeGroup);

    const commands: AdminRouteDecisionApplyDryRunCommand[] = [
      {
        id: 'precheck-interface',
        kind: 'precheck',
        command: `ip link show dev ${shellToken(interfaceName)}`,
        requiresRoot: false,
        dataPlaneMutation: false,
        secretSafe: true,
      },
      {
        id: 'precheck-wireguard',
        kind: 'precheck',
        command: `wg show ${shellToken(interfaceName)} latest-handshakes`,
        requiresRoot: false,
        dataPlaneMutation: false,
        secretSafe: true,
      },
      {
        id: 'precheck-current-table',
        kind: 'precheck',
        command: `ip route show table ${shellToken(routeTable)}`,
        requiresRoot: false,
        dataPlaneMutation: false,
        secretSafe: true,
      },
      {
        id: 'drain-route-mark',
        kind: 'drain',
        command: `nft list table inet afrogate`,
        requiresRoot: true,
        dataPlaneMutation: false,
        secretSafe: true,
      },
      {
        id: 'switch-route-table',
        kind: 'switch',
        command: `ip route replace default dev ${shellToken(interfaceName)} table ${shellToken(routeTable)}`,
        requiresRoot: true,
        dataPlaneMutation: true,
        secretSafe: true,
      },
      {
        id: 'switch-policy-rule',
        kind: 'switch',
        command: `ip rule replace fwmark ${mark} table ${shellToken(routeTable)} priority 1060`,
        requiresRoot: true,
        dataPlaneMutation: true,
        secretSafe: true,
      },
      {
        id: 'verify-selected-interface',
        kind: 'verify',
        command: `ip route get 1.1.1.1 mark ${mark}`,
        requiresRoot: false,
        dataPlaneMutation: false,
        secretSafe: true,
      },
    ];

    if (currentInterfaceName) {
      commands.push({
        id: 'rollback-previous-route',
        kind: 'rollback',
        command: `ip route replace default dev ${shellToken(currentInterfaceName)} table ${shellToken(routeTable)}`,
        requiresRoot: true,
        dataPlaneMutation: true,
        secretSafe: true,
      });
    }

    return commands;
  }

  private buildWireGuardDryRunConfigChanges(
    candidate: AdminWireGuardCandidate | null,
  ): AdminRouteDecisionApplyDryRunConfigChange[] {
    if (!candidate || candidate.source !== 'outbound') return [];

    const routeTable = safeRouteTableName(candidate.routeGroup);

    return [
      {
        id: 'iproute-table',
        filePath: '/etc/iproute2/rt_tables.d/afrogate.conf',
        action: 'update',
        description: `Ensure route table entry for ${routeTable}`,
        secretSafe: true,
      },
      {
        id: 'afrogate-assignment-record',
        filePath: `/etc/afrogate/routes/${safePathSegment(candidate.routeGroup)}/default.json`,
        action: 'update',
        description: `Record selected outbound ${candidate.id} and interface ${safeWireGuardInterfaceName(candidate.interfaceName, candidate.id)}`,
        secretSafe: true,
      },
    ];
  }

  private buildRouteDecisionDryRunSnapshot(
    preview: AdminRouteDecisionPreviewResponse,
  ): AdminRouteDecisionApplyDryRunSnapshot {
    const adapter = preview.applyPlan.adapter;
    const commands = adapter.dryRunCommands.map((item) => ({ ...item }));
    const configChanges = adapter.dryRunConfigChanges.map((item) => ({ ...item }));

    return {
      generatedAt: new Date().toISOString(),
      adapterId: adapter.id,
      adapterStatus: adapter.status,
      adapterEnabled: adapter.enabled,
      adapterImplemented: adapter.implemented,
      dataPlaneReady: adapter.dataPlaneReady,
      dryRunSupported: adapter.dryRunSupported,
      secretSafe: commands.every((item) => item.secretSafe) && configChanges.every((item) => item.secretSafe),
      commandCount: commands.length,
      configChangeCount: configChanges.length,
      commands,
      configChanges,
    };
  }

  private routeDecisionApplyBlockReasons(preview: AdminRouteDecisionPreviewResponse): string[] {
    const reasonCodes = new Set<string>();

    if (preview.action !== 'switchRecommended') reasonCodes.add('apply_requires_switch_recommended');
    if (preview.routeLocked) reasonCodes.add('route_locked');
    if (!preview.autoRouteEnabled) reasonCodes.add('manual_mode');
    if (preview.cooldownUntil && new Date(preview.cooldownUntil).getTime() > Date.now()) reasonCodes.add('cooldown_active');
    if (!preview.recommendedCandidate || preview.recommendedCandidate.source !== 'outbound') {
      reasonCodes.add('agent_candidate_not_applicable');
    }
    if (
      !preview.reasonCodes.includes('health_based_switch') &&
      preview.scoreDelta !== null &&
      preview.scoreDelta !== undefined &&
      preview.currentCandidate &&
      preview.scoreDelta < preview.hysteresisScoreDelta
    ) {
      reasonCodes.add('score_delta_below_hysteresis');
    }

    return [...reasonCodes];
  }

  private isRouteDecisionCandidateHealthy(candidate: AdminWireGuardCandidate): boolean {
    const status = String(candidate.healthStatus).toLowerCase();

    return (
      candidate.score >= 50 &&
      status !== 'critical' &&
      status !== 'down' &&
      candidate.bufferbloatRecommendation !== 'avoidUnderLoad' &&
      candidate.mtuStatus !== 'blocked'
    );
  }

  private assessRouteMtu(input: {
    routeProbes: RouteProbeMetric[];
    configuredMtuBytes?: number | null;
  }): RouteMtuAssessment {
    const mtuProbes = input.routeProbes.filter((probe) => String(probe.protocol).toLowerCase() === 'mtu');
    const summary = this.summarizeRouteProbes(mtuProbes);
    const configuredMtuBytes = roundMetric(input.configuredMtuBytes ?? summary.configuredMtuBytes, 0);
    const pathMtuBytes = summary.pathMtuBytes;
    const recommendedTunnelMtuBytes = summary.recommendedTunnelMtuBytes ?? (
      pathMtuBytes !== null ? Math.max(576, pathMtuBytes - 80) : null
    );
    const reasonCodes = new Set<string>();
    const hasBlockedProbe = mtuProbes.some((probe) => probe.status === 'critical' || probe.mtuStatus === 'blocked');

    if (!mtuProbes.length) {
      return {
        pathMtuBytes: null,
        recommendedTunnelMtuBytes: null,
        configuredMtuBytes,
        status: 'unknown',
        recommendation: 'none',
        sessionSafe: false,
        reasonCodes: ['mtu_probe_not_configured'],
      };
    }

    if (hasBlockedProbe && pathMtuBytes === null) {
      return {
        pathMtuBytes: null,
        recommendedTunnelMtuBytes: null,
        configuredMtuBytes,
        status: 'blocked',
        recommendation: 'manualReview',
        sessionSafe: false,
        reasonCodes: ['mtu_probe_blocked', 'manual_review_required'],
      };
    }

    if (pathMtuBytes !== null && pathMtuBytes < 1280) {
      reasonCodes.add('path_mtu_below_ipv6_minimum');
      reasonCodes.add('manual_review_required');
      return {
        pathMtuBytes,
        recommendedTunnelMtuBytes,
        configuredMtuBytes,
        status: 'blocked',
        recommendation: 'manualReview',
        sessionSafe: false,
        reasonCodes: [...reasonCodes],
      };
    }

    if (
      configuredMtuBytes !== null &&
      recommendedTunnelMtuBytes !== null &&
      configuredMtuBytes > recommendedTunnelMtuBytes + 8
    ) {
      reasonCodes.add('configured_mtu_above_safe_path');
      reasonCodes.add('new_sessions_only');
      return {
        pathMtuBytes,
        recommendedTunnelMtuBytes,
        configuredMtuBytes,
        status: 'fragmentationRisk',
        recommendation: 'reduce',
        sessionSafe: false,
        reasonCodes: [...reasonCodes],
      };
    }

    if (
      (pathMtuBytes !== null && pathMtuBytes < 1400) ||
      (recommendedTunnelMtuBytes !== null && recommendedTunnelMtuBytes < 1320)
    ) {
      reasonCodes.add('low_path_mtu');
      reasonCodes.add('avoid_mid_session_change');
      return {
        pathMtuBytes,
        recommendedTunnelMtuBytes,
        configuredMtuBytes,
        status: 'fragmentationRisk',
        recommendation: configuredMtuBytes === null ? 'manualReview' : 'keep',
        sessionSafe: false,
        reasonCodes: [...reasonCodes],
      };
    }

    return {
      pathMtuBytes,
      recommendedTunnelMtuBytes,
      configuredMtuBytes,
      status: 'healthy',
      recommendation: 'keep',
      sessionSafe: true,
      reasonCodes: ['mtu_probe_healthy'],
    };
  }

  private calculateLoadedLatencyPenalty(signals: RouteScoreSignals): number {
    const assessment = assessRouteBufferbloat({
      latencyMs: signals.latencyMs,
      jitterMs: signals.jitterMs,
      loadPercent: signals.loadPercent,
      loadedLatencyMs: signals.loadedLatencyMs,
      loadedLatencyDeltaMs: signals.loadedLatencyDeltaMs,
    });

    if (assessment.loadedLatencyDeltaMs !== null) {
      return Math.min(28, Math.max(0, assessment.loadedLatencyDeltaMs - 30) * 0.12);
    }

    return {
      high: 22,
      medium: 12,
      low: 5,
      none: 0,
      unknown: 0,
    }[assessment.severity];
  }

  private calculateRouteProfileScores(signals: RouteScoreSignals, settings: RouteScoringContext): RouteScoreResult {
    if (signals.enabled === false || signals.maintenanceMode) {
      const profileScores = createUniformRouteScores(0);
      const selectedProfile = this.selectRouteScoreProfile(settings);

      return {
        selectedProfile,
        selectedScore: 0,
        profileScores,
        reasons: [{ code: 'maintenance', profile: selectedProfile, impact: 100 }],
      };
    }

    const baseScore = clamp(signals.baseScore, 0, 100);
    const serverPenalty = signals.serverHealthScore !== null && signals.serverHealthScore !== undefined && signals.serverHealthScore < 60
      ? (60 - signals.serverHealthScore) / 2
      : 0;
    const latencyMs = signals.latencyMs;
    const jitterMs = signals.jitterMs;
    const packetLossPercent = signals.packetLossPercent;
    const loadPercent = signals.loadPercent;
    const handshakePenalty = signals.latestHandshakeAgeSeconds === undefined
      ? 0
      : calculateHandshakePenalty(signals.latestHandshakeAgeSeconds);
    const loadedLatencyPenalty = this.calculateLoadedLatencyPenalty(signals);
    const stableBase = baseScore
      - thresholdPenalty(packetLossPercent, 0.2, 28)
      - thresholdPenalty(jitterMs, 8, 1.15)
      - thresholdPenalty(latencyMs, 100, 0.08)
      - loadedLatencyPenalty * 0.8
      - serverPenalty;
    const throughputBase = baseScore
      - thresholdPenalty(loadPercent, 70, 0.65)
      - thresholdPenalty(packetLossPercent, 1, 24)
      - thresholdPenalty(jitterMs, 35, 0.7)
      - loadedLatencyPenalty * 0.3
      - serverPenalty;
    const balancedBase = baseScore
      - thresholdPenalty(packetLossPercent, 1, 12)
      - thresholdPenalty(jitterMs, 25, 0.45)
      - thresholdPenalty(latencyMs, 140, 0.05)
      - loadedLatencyPenalty * 0.45
      - serverPenalty;
    const gamingBase = baseScore
      - thresholdPenalty(packetLossPercent, 0.1, 36)
      - thresholdPenalty(jitterMs, 6, 1.35)
      - thresholdPenalty(latencyMs, 85, 0.11)
      - thresholdPenalty(loadPercent, 65, 0.35)
      - loadedLatencyPenalty * 1.15
      - serverPenalty
      - handshakePenalty * 0.35;

    const profileScores = roundRouteScores({
      balanced: this.applyProbeScore(balancedBase, signals.routeProbes, protocolsForScoreProfile('balanced'), 0.22),
      stability: this.applyProbeScore(stableBase, signals.routeProbes, protocolsForScoreProfile('stability'), 0.34),
      throughput: this.applyProbeScore(throughputBase, signals.routeProbes, protocolsForScoreProfile('throughput'), 0.2),
      gaming: this.applyProbeScore(gamingBase, signals.routeProbes, protocolsForScoreProfile('gaming'), 0.46),
      tcp: this.applyProbeScore(balancedBase - thresholdPenalty(latencyMs, 100, 0.08), signals.routeProbes, ['tcp'], 0.42),
      udp: this.applyProbeScore(stableBase, signals.routeProbes, ['udp', 'wireguard'], 0.42),
      quic: this.applyProbeScore(stableBase, signals.routeProbes, ['quic', 'udp'], 0.42),
      dns: this.applyProbeScore(balancedBase - thresholdPenalty(latencyMs, 80, 0.08), signals.routeProbes, ['dns'], 0.45),
      wireguard: this.applyProbeScore(baseScore - handshakePenalty - serverPenalty, signals.routeProbes, ['wireguard', 'udp'], 0.32),
    });
    const selectedProfile = this.selectRouteScoreProfile(settings);

    return {
      selectedProfile,
      selectedScore: profileScores[selectedProfile],
      profileScores,
      reasons: this.buildRouteScoreReasons(signals, selectedProfile),
    };
  }

  private selectRouteScoreProfile(settings: RouteScoringContext): RouteScoreProfile {
    const protocolProfile = settings.protocolProfile;

    if (isProtocolSpecificScoreProfile(protocolProfile)) return protocolProfile;
    if (protocolProfile === 'gaming' || settings.speedProfile === 'gaming') return 'gaming';
    if (
      settings.loadBalanceStrategy === 'stability' ||
      settings.speedProfile === 'highSecurity' ||
      protocolProfile === 'highSecurity'
    ) {
      return 'stability';
    }
    if (
      settings.loadBalanceStrategy === 'throughput' ||
      settings.speedProfile === 'highSpeed' ||
      protocolProfile === 'highSpeed'
    ) {
      return 'throughput';
    }

    return 'balanced';
  }

  private applyProbeScore(
    baseScore: number,
    routeProbes: RouteProbeMetric[],
    protocols: string[],
    probeWeight: number,
  ): number {
    const probeScore = calculateProtocolProbeScore(routeProbes, protocols);

    if (probeScore === null) return baseScore;

    return baseScore * (1 - probeWeight) + probeScore * probeWeight;
  }

  private summarizeRouteProbes(routeProbes: RouteProbeMetric[]): {
    latencyMs: number | null;
    jitterMs: number | null;
    packetLossPercent: number | null;
    loadedLatencyMs: number | null;
    loadedLatencyDeltaMs: number | null;
    pathMtuBytes: number | null;
    recommendedTunnelMtuBytes: number | null;
    configuredMtuBytes: number | null;
  } {
    const mtuProbes = routeProbes.filter((probe) => String(probe.protocol).toLowerCase() === 'mtu');

    return {
      latencyMs: averageMetric(routeProbes.map((probe) => probe.latencyMs)),
      jitterMs: averageMetric(routeProbes.map((probe) => probe.jitterMs)),
      packetLossPercent: averageMetric(routeProbes.map((probe) => probe.packetLossPercent)),
      loadedLatencyMs: averageMetric(routeProbes.map((probe) => probe.loadedLatencyMs)),
      loadedLatencyDeltaMs: averageMetric(routeProbes.map((probe) => loadedLatencyDeltaFromProbe(probe))),
      pathMtuBytes: minimumMetric(mtuProbes.map((probe) => probe.pathMtuBytes)),
      recommendedTunnelMtuBytes: minimumMetric(mtuProbes.map((probe) => probe.recommendedTunnelMtuBytes)),
      configuredMtuBytes: maximumMetric(mtuProbes.map((probe) => probe.configuredMtuBytes)),
    };
  }

  private getRouteProbes(raw: Partial<ServerMetricSnapshot> | null | undefined): RouteProbeMetric[] {
    if (!Array.isArray(raw?.routeProbes)) return [];

    return raw.routeProbes.filter((probe): probe is RouteProbeMetric => this.isRouteProbeMetric(probe));
  }

  private isRouteProbeMetric(value: unknown): value is RouteProbeMetric {
    if (!this.isRecord(value)) return false;

    return (
      typeof value.protocol === 'string' &&
      typeof value.target === 'string' &&
      typeof value.status === 'string'
    );
  }

  private buildRouteScoreReasons(signals: RouteScoreSignals, selectedProfile: RouteScoreProfile): RouteScoreReason[] {
    const reasons: RouteScoreReason[] = [];
    const pushReason = (
      code: RouteScoreReason['code'],
      impact: number,
      value?: number | null,
      threshold?: number | null,
      source?: string | null,
    ) => {
      if (impact <= 0.5) return;

      reasons.push({
        code,
        profile: selectedProfile,
        impact: Math.round(impact * 10) / 10,
        value: value ?? null,
        threshold: threshold ?? null,
        source: source ?? null,
      });
    };

    const healthImpact = {
      critical: 55,
      degraded: 22,
      unknown: 8,
    }[signals.healthStatus] ?? 0;
    const strictLossProfile = ['stability', 'udp', 'quic', 'wireguard'].includes(selectedProfile);
    const lossThreshold = selectedProfile === 'gaming' ? 0.2 : strictLossProfile ? 0.5 : 1;
    const jitterThreshold = selectedProfile === 'gaming' ? 8 : strictLossProfile ? 10 : 25;
    const latencyThreshold = selectedProfile === 'gaming' ? 90 : selectedProfile === 'dns' ? 80 : selectedProfile === 'tcp' ? 100 : 120;
    const loadThreshold = selectedProfile === 'gaming' ? 65 : 70;
    const selectedProbeScore = calculateProtocolProbeScore(
      signals.routeProbes,
      protocolsForScoreProfile(selectedProfile),
    );
    const selectedMtuScore = calculateProtocolProbeScore(signals.routeProbes, ['mtu']);
    const loadedLatencyAssessment = assessRouteBufferbloat({
      latencyMs: signals.latencyMs,
      jitterMs: signals.jitterMs,
      loadPercent: signals.loadPercent,
      loadedLatencyMs: signals.loadedLatencyMs,
      loadedLatencyDeltaMs: signals.loadedLatencyDeltaMs,
    });

    pushReason('healthStatus', healthImpact);
    pushReason(
      'packetLoss',
      thresholdPenalty(signals.packetLossPercent, lossThreshold, 20),
      signals.packetLossPercent,
      lossThreshold,
    );
    pushReason('jitter', thresholdPenalty(signals.jitterMs, jitterThreshold, 0.8), signals.jitterMs, jitterThreshold);
    pushReason(
      'loadedLatency',
      this.calculateLoadedLatencyPenalty(signals),
      loadedLatencyAssessment.loadedLatencyDeltaMs ?? loadedLatencyAssessment.loadedLatencyMs,
      loadedLatencyAssessment.loadedLatencyDeltaMs === null ? null : 30,
      loadedLatencyAssessment.severity,
    );
    pushReason(
      'latency',
      thresholdPenalty(signals.latencyMs, latencyThreshold, 0.06),
      signals.latencyMs,
      latencyThreshold,
    );
    pushReason('load', thresholdPenalty(signals.loadPercent, loadThreshold, 0.55), signals.loadPercent, loadThreshold);
    if (signals.serverHealthScore !== null && signals.serverHealthScore !== undefined) {
      pushReason('serverHealth', thresholdPenalty(60 - signals.serverHealthScore, 0, 0.5), signals.serverHealthScore, 60);
    }
    if (signals.latestHandshakeAgeSeconds !== undefined) {
      pushReason(
        'wireguardHandshake',
        calculateHandshakePenalty(signals.latestHandshakeAgeSeconds),
        signals.latestHandshakeAgeSeconds,
        180,
      );
    }
    if (selectedProbeScore !== null) {
      pushReason(
        'routeProbe',
        thresholdPenalty(80 - selectedProbeScore, 0, 1),
        Math.round(selectedProbeScore * 10) / 10,
        80,
        protocolsForScoreProfile(selectedProfile).join(','),
      );
    }
    if (selectedMtuScore !== null) {
      pushReason('mtu', thresholdPenalty(85 - selectedMtuScore, 0, 0.8), selectedMtuScore, 85, 'path-mtu');
    }

    return reasons.sort((left, right) => right.impact - left.impact).slice(0, 6);
  }

  private isWireGuardInterfaceMetric(value: unknown): value is WireGuardInterfaceMetric {
    if (!this.isRecord(value)) return false;

    return (
      typeof value.name === 'string' &&
      typeof value.peerCount === 'number' &&
      typeof value.activePeerCount === 'number' &&
      typeof value.status === 'string'
    );
  }

  private routeDecisionCandidateCountry(candidate: AdminWireGuardCandidate): string | null {
    return normalizeRouteDecisionCountryCode(candidate.serverCountry);
  }

  private normalizeRouteScoreProfile(value: string | null | undefined): RouteScoreProfile | null {
    const normalized = value?.trim();
    if (!normalized) return null;

    return this.routeDecisionScoreProfiles().includes(normalized as RouteScoreProfile)
      ? (normalized as RouteScoreProfile)
      : null;
  }

  private configFlag(name: string, fallback: boolean): boolean {
    const value = process.env[name];
    if (value === undefined || value === null || value.trim() === '') return fallback;

    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  }

  private assertSuperadmin(actor: AuthActor | undefined): void {
    if (actor?.role === 'superadmin' || actor?.isSuperAdmin) return;

    throw new ForbiddenException('Only superadmin can create protocol setup drafts');
  }

  private async ensureServerExists(executor: DatabaseQueryExecutor, id: string): Promise<void> {
    const result = await executor.query<{ id: string }>('SELECT id FROM servers WHERE id = $1', [id]);
    if (!result.rows[0]) throw new NotFoundException('Server not found');
  }

  private async ensureServerInterfaceExists(
    executor: DatabaseQueryExecutor,
    id: string,
    serverId?: string,
  ): Promise<{ id: string; serverId: string }> {
    const result = await executor.query<{ id: string; serverId: string }>(
      'SELECT id, server_id AS "serverId" FROM server_interfaces WHERE id = $1',
      [id],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Server interface not found');
    if (serverId && row.serverId !== serverId) {
      throw new BadRequestException('Server interface belongs to a different server');
    }

    return row;
  }

  private async ensureTunnelExists(
    executor: DatabaseQueryExecutor,
    id: string,
  ): Promise<{ id: string; serverId: string; localInterfaceId: string | null }> {
    const result = await executor.query<{ id: string; serverId: string; localInterfaceId: string | null }>(
      'SELECT id, server_id AS "serverId", local_interface_id AS "localInterfaceId" FROM tunnels WHERE id = $1',
      [id],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Tunnel not found');

    return row;
  }

  private async ensureOutboundExists(executor: DatabaseQueryExecutor, id: string): Promise<void> {
    const result = await executor.query<{ id: string }>('SELECT id FROM outbounds WHERE id = $1', [id]);
    if (!result.rows[0]) throw new NotFoundException('Outbound not found');
  }

  private async ensureRouteOutboundCandidate(
    executor: DatabaseQueryExecutor,
    id: string,
    routeGroup: string,
  ): Promise<void> {
    const result = await executor.query<{ id: string; routeGroup: string; type: string }>(
      'SELECT id, route_group AS "routeGroup", type FROM outbounds WHERE id = $1',
      [id],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Outbound not found');
    if (row.routeGroup !== routeGroup) throw new BadRequestException('Outbound belongs to a different route group');
    if (row.type !== 'wireguard') throw new BadRequestException('Route assignment requires a WireGuard outbound');
  }

  private async getProtocolSetupForUpdate(
    executor: DatabaseQueryExecutor,
    id: string,
  ): Promise<ProtocolSetupRow> {
    const result = await executor.query<ProtocolSetupRow>(
      this.protocolSetupSelectSql('ps.id = $1', 'FOR UPDATE OF ps'),
      [id],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Protocol setup not found');

    return row;
  }

  private async ensureSecretRefExists(
    executor: DatabaseQueryExecutor,
    secretRef: string,
    routeGroup: string,
    protocol: string,
  ): Promise<void> {
    const result = await executor.query<{ routeGroup: string | null; protocol: string | null }>(
      `
        SELECT route_group AS "routeGroup", protocol
        FROM secret_records
        WHERE secret_ref = $1
          AND status = 'active'
          AND revoked_at IS NULL
      `,
      [secretRef],
    );
    const row = result.rows[0];

    if (!row) throw new NotFoundException('Secret reference not found');
    if (row.routeGroup && row.routeGroup !== routeGroup) {
      throw new BadRequestException('Secret reference belongs to a different route group');
    }
    if (row.protocol && row.protocol !== protocol) {
      throw new BadRequestException('Secret reference belongs to a different protocol');
    }
  }

  private secretEncryptionContext(
    secretRef: string,
    kind: string,
    routeGroup: string,
    protocol: string | null,
  ): string {
    return ['settings-secret', secretRef, kind, routeGroup, protocol ?? 'any'].join(':');
  }

  private serverCredentialEncryptionContext(serverId: string, credentialId: string, kind: string): string {
    return ['server-credential', serverId, credentialId, kind].join(':');
  }

  private buildProtocolServerApplyPlan(setup: ProtocolServerApplySource): AdminProtocolServerApplyPlanSummary {
    const config = this.asRecord(setup.config);
    const featureFlagEnabled = this.configFlag('AFROGATE_PROTOCOL_SERVER_APPLY_ENABLED', false);
    const outboundId = setup.provisionedOutboundId ?? null;
    const hasOutbound = Boolean(outboundId);
    const requiresSecret = this.protocolRequiresServerSecret(setup.protocol);
    const hasSecretRef = this.protocolSetupHasSecretRef(setup);
    const protocolSecretDecryptEnabled = this.configFlag('AFROGATE_PROTOCOL_SERVER_APPLY_SECRET_DECRYPT_ENABLED', false);
    const requiresServerAccess = true;
    const targetServerId = setup.targetServerId ?? null;
    const hasTargetServer = Boolean(targetServerId);
    const hasServerAccess = hasTargetServer && Boolean(setup.targetServerAccessReady);
    const hasServerCredential = hasTargetServer && Boolean(setup.targetServerCredentialReady);
    const targetServerLabel =
      setup.targetServerLabel ??
      this.stringFromConfig(config.serverName) ??
      this.stringFromConfig(config.activeWireGuardServerExternalId) ??
      null;
    const adapter = this.buildProtocolServerApplyAdapter({
      featureFlagEnabled,
      hasServerAccess,
      hasServerCredential,
      hasTargetServer,
      requiresServerAccess,
      setup,
      targetServerId,
      targetServerLabel,
    });
    const adapterImplemented = adapter.implemented;
    const secretDecryptAllowed = Boolean(
      !requiresSecret ||
        (featureFlagEnabled &&
          adapter.commandRunner.liveExecutionEnabled &&
          protocolSecretDecryptEnabled &&
          adapterImplemented &&
          hasSecretRef),
    );
    const unitName = this.safeProtocolUnitName(setup);
    const commands = this.buildProtocolServerApplyCommands(setup, unitName);
    const configChanges = this.buildProtocolServerApplyConfigChanges(setup, unitName);
    const configMaterial = this.protocolServerApplyConfigMaterial(setup);
    const commandPolicy = this.protocolServerApplyCommandPolicy(commands);
    const missingSecret = requiresSecret && !hasSecretRef;
    const missingTargetAccess = hasOutbound && requiresServerAccess && (!hasTargetServer || !hasServerAccess || !hasServerCredential);
    const secretSafe = commands.every((command) => command.secretSafe) && configChanges.every((change) => change.secretSafe);
    const preflightDraft = this.buildProtocolServerApplyPreflight({
      adapter,
      adapterImplemented,
      commands,
      commandPolicy,
      configChanges,
      configMaterial,
      featureFlagEnabled,
      hasOutbound,
      hasSecretRef,
      hasServerAccess,
      hasServerCredential,
      hasTargetServer,
      outboundEnabled: setup.provisionedOutboundEnabled ?? null,
      outboundHealthStatus: setup.provisionedOutboundHealthStatus ?? null,
      outboundMaintenanceMode: setup.provisionedOutboundMaintenanceMode ?? null,
      requiresSecret,
      requiresServerAccess,
      secretDecryptAllowed,
      secretSafe,
      setup,
    });
    const dataPlaneReady =
      featureFlagEnabled &&
      adapter.dataPlaneReady &&
      configMaterial.ready &&
      commandPolicy.ready &&
      hasOutbound &&
      !missingSecret &&
      (!requiresSecret || secretDecryptAllowed) &&
      (!requiresServerAccess || (hasServerAccess && hasServerCredential)) &&
      preflightDraft.canExecuteDataPlane;
    const canExecute = dataPlaneReady;
    const hardBlocked = preflightDraft.gates.some((gate) => gate.status === 'blocked' && gate.blocksDataPlane);
    const reasonCodes = new Set<ProtocolServerApplyReason | string>([
      'protocolSupported',
      'auditRequired',
      'defaultInactive',
      'healthVerifyRequired',
    ]);

    if (featureFlagEnabled) reasonCodes.add('featureFlagReady');
    else reasonCodes.add('featureFlagDisabled');
    if (adapterImplemented) reasonCodes.add('adapterReady');
    else reasonCodes.add('adapterMissing');
    for (const reason of adapter.reasonCodes) reasonCodes.add(reason);
    reasonCodes.add(configMaterial.ready ? 'configMaterialReady' : 'configMaterialMissing');
    reasonCodes.add(commandPolicy.ready ? 'commandPolicyReady' : 'commandPolicyViolation');
    if (hasOutbound) {
      reasonCodes.add('outboundReady');
      reasonCodes.add('maintenanceMode');
    } else {
      reasonCodes.add('outboundMissing');
    }
    if (requiresSecret) {
      if (hasSecretRef) {
        reasonCodes.add('secretReady');
        reasonCodes.add(secretDecryptAllowed ? 'secretDecryptReady' : 'secretDecryptDisabled');
      } else {
        reasonCodes.add('secretMissing');
      }
    }
    if (requiresServerAccess) {
      if (!hasTargetServer) {
        reasonCodes.add('serverMissing');
        reasonCodes.add('serverAccessMissing');
      } else if (hasServerAccess) {
        reasonCodes.add('serverAccessReady');
      } else {
        reasonCodes.add('serverAccessMissing');
      }
      if (!hasTargetServer || !setup.targetServerCredentialRef) {
        reasonCodes.add('serverCredentialRefMissing');
      } else if (hasServerCredential) {
        reasonCodes.add('serverCredentialReady');
      } else {
        reasonCodes.add('serverCredentialInactive');
      }
    }
    if (dataPlaneReady) reasonCodes.add('dataPlaneReady');
    else reasonCodes.add('adapterDryRunOnly');
    for (const reason of preflightDraft.liveApplyBlockedReasonCodes) reasonCodes.add(reason);

    const status = this.protocolServerApplyStatus({
      dataPlaneReady,
      hardBlocked,
      hasOutbound,
      missingSecret,
      missingTargetAccess,
    });
    const preflight: AdminProtocolServerApplyPreflightSummary = {
      ...preflightDraft,
      status,
      canExecuteDataPlane: dataPlaneReady,
    };

    return {
      status,
      generatedAt: new Date().toISOString(),
      protocol: setup.protocol,
      profile: setup.profile,
      routeGroup: setup.routeGroup,
      outboundId,
      targetServerId,
      targetServerLabel,
      featureFlagEnabled,
      adapterImplemented,
      dataPlaneReady,
      canExecute,
      configMaterialReady: configMaterial.ready,
      configMaterialMissingFields: configMaterial.missingFields,
      commandPolicyReady: commandPolicy.ready,
      commandPolicyViolations: commandPolicy.violations,
      requiresSecret,
      hasSecretRef,
      secretDecryptAllowed,
      requiresServerAccess,
      hasServerAccess,
      commandCount: commands.length,
      configChangeCount: configChanges.length,
      secretSafe,
      reasonCodes: Array.from(reasonCodes),
      adapter,
      preflight,
      steps: this.buildProtocolServerApplySteps({
        setup,
        commands,
        featureFlagEnabled,
        adapterImplemented,
        configMaterialReady: configMaterial.ready,
        commandPolicyReady: commandPolicy.ready,
        dataPlaneReady,
        hasOutbound,
        requiresSecret,
        hasSecretRef,
        secretDecryptAllowed,
        requiresServerAccess,
        hasTargetServer,
        hasServerAccess,
      }),
      commands,
      configChanges,
    };
  }

  private buildProtocolServerApplyAdapter(input: {
    featureFlagEnabled: boolean;
    hasServerAccess: boolean;
    hasServerCredential: boolean;
    hasTargetServer: boolean;
    requiresServerAccess: boolean;
    setup: ProtocolServerApplySource;
    targetServerId: string | null;
    targetServerLabel: string | null;
  }): AdminProtocolServerApplyAdapterSummary {
    const supportedProtocols = ['wireguard', 'vless', 'l2tp', 'ikev2'];
    const protocolSupported = supportedProtocols.includes(input.setup.protocol);
    const liveExecutionEnabled = this.configFlag('AFROGATE_PROTOCOL_SERVER_APPLY_LIVE_EXECUTOR_ENABLED', false);
    const credentialDecryptEnabled = this.configFlag('AFROGATE_PROTOCOL_SERVER_APPLY_CREDENTIAL_DECRYPT_ENABLED', false);
    const implemented = protocolSupported;
    const accessMethodSupported =
      !input.requiresServerAccess ||
      ['ssh_key', 'temporary_root_key', 'existing_admin_key'].includes(input.setup.targetServerAccessMethod ?? '');
    const credentialRefPresent = Boolean(input.setup.targetServerCredentialRef);
    const credentialRecordActive = Boolean(input.setup.targetServerCredentialReady);
    const credentialKindSupported =
      !input.requiresServerAccess || input.setup.targetServerCredentialKind === 'ssh_private_key';
    const commandRunnerReady = protocolSupported && implemented && liveExecutionEnabled;
    const credentialDecryptAllowed = Boolean(
      input.featureFlagEnabled &&
        commandRunnerReady &&
        credentialDecryptEnabled &&
        accessMethodSupported &&
        credentialKindSupported &&
        input.hasTargetServer &&
        input.hasServerAccess &&
        credentialRefPresent &&
        credentialRecordActive,
    );
    const accessReasonCodes = new Set<ProtocolServerApplyReason | string>();

    if (!input.requiresServerAccess) {
      accessReasonCodes.add('serverAccessReady');
    } else if (!input.hasTargetServer) {
      accessReasonCodes.add('serverMissing');
      accessReasonCodes.add('serverAccessMissing');
    } else if (input.hasServerAccess) {
      accessReasonCodes.add('serverAccessReady');
    } else {
      accessReasonCodes.add('serverAccessMissing');
    }

    if (!credentialRefPresent) {
      accessReasonCodes.add('serverCredentialRefMissing');
    } else if (credentialRecordActive) {
      accessReasonCodes.add('serverCredentialReady');
    } else {
      accessReasonCodes.add('serverCredentialInactive');
    }
    if (!accessMethodSupported) accessReasonCodes.add('serverAccessMethodUnsupported');
    if (credentialRefPresent && credentialRecordActive && !credentialKindSupported) {
      accessReasonCodes.add('serverCredentialKindUnsupported');
    }
    accessReasonCodes.add(credentialDecryptAllowed ? 'serverCredentialDecryptReady' : 'serverCredentialDecryptDisabled');

    const commandRunnerReasonCodes = new Set<ProtocolServerApplyReason | string>();
    if (commandRunnerReady) commandRunnerReasonCodes.add('liveExecutorReady');
    else commandRunnerReasonCodes.add('commandRunnerDryRunOnly');
    if (!implemented) commandRunnerReasonCodes.add('liveExecutorMissing');
    if (!liveExecutionEnabled) commandRunnerReasonCodes.add('liveExecutorDisabled');

    const accessReady =
      !input.requiresServerAccess ||
      (input.hasServerAccess && input.hasServerCredential && accessMethodSupported && credentialKindSupported);
    const dataPlaneReady = Boolean(
      input.featureFlagEnabled &&
        commandRunnerReady &&
        accessReady &&
        (!input.requiresServerAccess || credentialDecryptAllowed),
    );
    const reasonCodes = new Set<ProtocolServerApplyReason | string>([
      protocolSupported ? 'protocolSupported' : 'adapterMissing',
      implemented ? 'adapterReady' : 'adapterMissing',
      ...accessReasonCodes,
      ...commandRunnerReasonCodes,
    ]);
    if (!dataPlaneReady) reasonCodes.add('adapterDryRunOnly');
    if (input.featureFlagEnabled) reasonCodes.add('featureFlagReady');
    else reasonCodes.add('featureFlagDisabled');
    const status: AdminProtocolServerApplyAdapterSummary['status'] = dataPlaneReady
      ? 'ready'
      : !protocolSupported
        ? 'unsupported'
        : !input.featureFlagEnabled
          ? 'disabled'
          : 'dryRunOnly';

    return {
      id: 'protocol-server-apply',
      label: 'Protocol server apply adapter',
      status,
      protocol: input.setup.protocol,
      enabled: input.featureFlagEnabled,
      implemented,
      dataPlaneReady,
      supportedProtocols,
      reasonCodes: [...reasonCodes],
      dryRunSupported: protocolSupported,
      commandRunner: {
        id: 'protocol-server-command-runner',
        label: 'Protocol server command runner',
        mode: commandRunnerReady ? 'live' : 'dryRunOnly',
        liveExecutionEnabled,
        dryRunOnly: !commandRunnerReady,
        implemented,
        reasonCodes: [...commandRunnerReasonCodes],
      },
      serverAccessBoundary: {
        targetServerId: input.targetServerId,
        targetServerLabel: input.targetServerLabel,
        accessProfileReady: input.hasServerAccess,
        credentialRefPresent,
        credentialRecordActive,
        credentialDecryptAllowed,
        reasonCodes: [...accessReasonCodes],
      },
    };
  }

  private buildProtocolServerApplyDryRunSnapshot(
    setup: ProtocolServerApplySource,
    plan: AdminProtocolServerApplyPlanSummary,
    applyMode: ProtocolServerApplyMode,
  ): AdminProtocolServerApplyDryRunSnapshot {
    const commands = plan.commands.map((command) => ({ ...command }));
    const configChanges = plan.configChanges.map((change) => ({ ...change }));
    const steps = plan.steps.map((step) => ({ ...step, reasonCodes: [...step.reasonCodes] }));

    return {
      generatedAt: new Date().toISOString(),
      protocolSetupId: setup.id,
      protocol: plan.protocol,
      profile: plan.profile,
      routeGroup: plan.routeGroup,
      outboundId: plan.outboundId ?? null,
      targetServerId: plan.targetServerId ?? setup.targetServerId ?? null,
      targetServerLabel: plan.targetServerLabel ?? setup.targetServerLabel ?? null,
      applyMode,
      applyStatus: 'recorded',
      liveApply: false,
      dataPlaneMutationExecuted: false,
      featureFlagEnabled: plan.featureFlagEnabled,
      adapterImplemented: plan.adapterImplemented,
      dataPlaneReady: plan.dataPlaneReady,
      canExecute: plan.canExecute,
      configMaterialReady: plan.configMaterialReady,
      configMaterialMissingFields: [...plan.configMaterialMissingFields],
      commandPolicyReady: plan.commandPolicyReady,
      commandPolicyViolations: [...plan.commandPolicyViolations],
      requiresSecret: plan.requiresSecret,
      hasSecretRef: plan.hasSecretRef,
      secretDecryptAllowed: plan.secretDecryptAllowed,
      requiresServerAccess: plan.requiresServerAccess,
      hasServerAccess: plan.hasServerAccess,
      commandCount: commands.length,
      configChangeCount: configChanges.length,
      secretSafe:
        plan.secretSafe &&
        steps.every((step) => step.secretSafe) &&
        commands.every((command) => command.secretSafe) &&
        configChanges.every((change) => change.secretSafe),
      reasonCodes: [...plan.reasonCodes],
      adapter: {
        ...plan.adapter,
        reasonCodes: [...plan.adapter.reasonCodes],
        supportedProtocols: [...plan.adapter.supportedProtocols],
        commandRunner: {
          ...plan.adapter.commandRunner,
          reasonCodes: [...plan.adapter.commandRunner.reasonCodes],
        },
        serverAccessBoundary: {
          ...plan.adapter.serverAccessBoundary,
          reasonCodes: [...plan.adapter.serverAccessBoundary.reasonCodes],
        },
      },
      preflight: {
        ...plan.preflight,
        gates: plan.preflight.gates.map((gate) => ({ ...gate, reasonCodes: [...gate.reasonCodes] })),
        blockedReasonCodes: [...plan.preflight.blockedReasonCodes],
        liveApplyBlockedReasonCodes: [...plan.preflight.liveApplyBlockedReasonCodes],
      },
      steps,
      commands,
      configChanges,
    };
  }

  private buildProtocolServerApplyLiveRequestSnapshot(
    setup: ProtocolServerApplySource,
    plan: AdminProtocolServerApplyPlanSummary,
    applyMode: 'live',
    blockedReasonCodes: string[],
  ): AdminProtocolServerApplyDryRunSnapshot {
    const snapshot = this.buildProtocolServerApplyDryRunSnapshot(setup, plan, applyMode);
    const reasonCodes = this.uniqueStrings([
      ...snapshot.reasonCodes.map(String),
      'liveApplyRequested',
      'liveApplyBlocked',
      ...blockedReasonCodes,
    ]);
    const liveApplyBlockedReasonCodes = this.uniqueStrings([
      ...snapshot.preflight.liveApplyBlockedReasonCodes.map(String),
      ...blockedReasonCodes,
    ]);

    return {
      ...snapshot,
      applyStatus: 'blocked',
      liveApply: false,
      dataPlaneMutationExecuted: false,
      dataPlaneReady: false,
      canExecute: false,
      reasonCodes,
      preflight: {
        ...snapshot.preflight,
        canExecuteDataPlane: false,
        liveApplyBlockedReasonCodes,
      },
    };
  }

  private buildProtocolServerApplyLiveAcceptedSnapshot(
    setup: ProtocolServerApplySource,
    plan: AdminProtocolServerApplyPlanSummary,
    applyMode: 'live',
  ): AdminProtocolServerApplyDryRunSnapshot {
    const snapshot = this.buildProtocolServerApplyDryRunSnapshot(setup, plan, applyMode);
    const reasonCodes = this.uniqueStrings([
      ...snapshot.reasonCodes.map(String),
      'liveApplyRequested',
      'liveApplyAccepted',
    ]);

    return {
      ...snapshot,
      applyStatus: 'accepted',
      liveApply: true,
      dataPlaneMutationExecuted: false,
      reasonCodes,
      execution: null,
    };
  }

  private buildProtocolServerApplyLiveExecutionSnapshot(
    setup: ProtocolServerApplySource,
    plan: AdminProtocolServerApplyPlanSummary,
    execution: ProtocolServerApplyExecutionSummary,
  ): AdminProtocolServerApplyDryRunSnapshot {
    const snapshot = this.buildProtocolServerApplyDryRunSnapshot(setup, plan, 'live');
    const succeeded = execution.status === 'succeeded';
    const reasonCodes = this.uniqueStrings([
      ...snapshot.reasonCodes.map(String),
      'liveApplyRequested',
      'liveApplyAccepted',
      succeeded ? 'liveApplySucceeded' : 'liveApplyFailed',
      execution.rollbackAttempted ? 'rollbackRequired' : null,
      execution.rollbackSucceeded ? 'rollbackReady' : null,
    ].filter((reason): reason is string => Boolean(reason)));

    return {
      ...snapshot,
      applyStatus: succeeded ? 'executed' : execution.status,
      liveApply: true,
      dataPlaneMutationExecuted: execution.dataPlaneMutationExecuted,
      reasonCodes,
      execution,
    };
  }

  private protocolServerApplyLiveBlockedReasonCodes(plan: AdminProtocolServerApplyPlanSummary): string[] {
    const preflightReasons = plan.preflight.liveApplyBlockedReasonCodes.map(String);

    if (!plan.preflight.canExecuteDataPlane || !plan.canExecute) {
      return this.uniqueStrings(['liveApplyBlocked', ...preflightReasons]);
    }

    return [];
  }

  private async executeProtocolServerApply(
    setup: ProtocolServerApplySource,
    plan: AdminProtocolServerApplyPlanSummary,
  ): Promise<ProtocolServerApplyExecutionSummary> {
    const startedAt = new Date().toISOString();
    const unitName = this.safeProtocolUnitName(setup);
    const configPath = this.protocolServerApplyConfigPath(setup.protocol, unitName);
    const stagedConfigPath = `/var/lib/afrogate/protocols/${safePathSegment(unitName)}.rendered`;
    const steps: ProtocolServerApplyExecutionCommandResult[] = [];
    let tempDir: string | null = null;
    let dataPlaneMutationExecuted = false;
    let rollbackAttempted = false;
    let rollbackSucceeded: boolean | null = null;
    let failedCommandId: string | null = null;

    const finish = (status: ProtocolServerApplyExecutionSummary['status']): ProtocolServerApplyExecutionSummary => ({
      status,
      executor: 'openssh',
      startedAt,
      finishedAt: new Date().toISOString(),
      stagedConfigPath,
      configPath,
      commandCount: steps.length,
      successfulCommandCount: steps.filter((step) => step.status === 'succeeded').length,
      failedCommandId,
      rollbackAttempted,
      rollbackSucceeded,
      dataPlaneMutationExecuted,
      steps,
    });
    const pushFailure = (id: string, kind: string, dataPlaneMutation = false) => {
      failedCommandId = id;
      steps.push({
        id,
        kind,
        status: 'failed',
        exitCode: null,
        durationMs: 0,
        dataPlaneMutation,
        timedOut: false,
      });
    };

    try {
      const access = await this.loadProtocolServerApplyRemoteAccess(setup);
      const secret = await this.loadProtocolServerApplySecretMaterial(setup);
      const renderedConfig = this.renderProtocolServerConfig(setup, unitName, secret);
      this.assertRenderedProtocolServerConfig(renderedConfig);

      tempDir = await mkdtemp(join(tmpdir(), 'afrogate-protocol-apply-'));
      const keyPath = join(tempDir, 'id_ed25519');
      const configFilePath = join(tempDir, 'protocol.rendered');
      await writeFile(keyPath, this.normalizePrivateKey(access.privateKey), { encoding: 'utf8' });
      await chmod(keyPath, 0o600);
      await writeFile(configFilePath, renderedConfig, { encoding: 'utf8' });
      await chmod(configFilePath, 0o600);

      const runCommand = async (
        command: AdminProtocolServerApplyPlanSummary['commands'][number],
        options: { allowFailure?: boolean } = {},
      ): Promise<ProtocolServerApplyExecutionCommandResult> => {
        const result = await this.runProtocolServerApplySshCommand(access, keyPath, command);
        if (result.status === 'failed' && options.allowFailure) result.status = 'skipped';
        steps.push(result);
        if (result.status === 'failed' && !options.allowFailure) failedCommandId = command.id;
        return result;
      };
      const runInternalCommand = async (
        idSuffix: string,
        kind: AdminProtocolServerApplyPlanSummary['commands'][number]['kind'],
        command: string,
        dataPlaneMutation: boolean,
        timeoutSeconds = 20,
        options: { allowFailure?: boolean } = {},
      ): Promise<ProtocolServerApplyExecutionCommandResult> =>
        runCommand(
          {
            id: `${setup.id}:${idSuffix}`,
            kind,
            command,
            requiresRoot: true,
            dataPlaneMutation,
            secretSafe: true,
            allowlisted: this.protocolServerApplyCommandAllowlisted(command),
            timeoutSeconds,
          },
          options,
        );

      for (const command of plan.commands.filter((item) => item.kind === 'preflight' || item.kind === 'package')) {
        const result = await runCommand(command);
        if (result.status === 'failed') return finish('failed');
      }

      const stageDir = this.posixDirname(stagedConfigPath);
      const configDir = this.posixDirname(configPath);
      const stageDirCommand = plan.commands.find((item) => item.id.endsWith(':config-stage-dir'));
      const stageDirResult = stageDirCommand
        ? await runCommand(stageDirCommand)
        : await runInternalCommand('config-stage-dir', 'config', `mkdir -p ${shellToken(stageDir)}`, false);
      if (stageDirResult.status === 'failed') return finish('failed');

      const targetDirCommand = plan.commands.find((item) => item.id.endsWith(':config-target-dir'));
      const targetDirResult = targetDirCommand
        ? await runCommand(targetDirCommand)
        : await runInternalCommand('config-target-dir', 'config', `mkdir -p ${shellToken(configDir)}`, false);
      if (targetDirResult.status === 'failed') return finish('failed');

      const uploadResult = await this.runProtocolServerApplyScp(
        access,
        keyPath,
        configFilePath,
        stagedConfigPath,
        `${setup.id}:config-stage-upload`,
      );
      steps.push(uploadResult);
      if (uploadResult.status === 'failed') {
        failedCommandId = uploadResult.id;
        return finish('failed');
      }

      const existingConfig = await runInternalCommand(
        'config-existing',
        'config',
        `test -f ${shellToken(configPath)}`,
        false,
        10,
        { allowFailure: true },
      );
      const backupCommand = plan.commands.find((item) => item.id.endsWith(':config-backup'));
      let backupCreated = false;
      if (existingConfig.status === 'succeeded' && backupCommand) {
        const backupResult = await runCommand(backupCommand);
        backupCreated = backupResult.status === 'succeeded';
        if (!backupCreated) return finish('failed');
      } else if (backupCommand) {
        steps.push({
          id: backupCommand.id,
          kind: backupCommand.kind,
          status: 'skipped',
          exitCode: null,
          durationMs: 0,
          dataPlaneMutation: backupCommand.dataPlaneMutation,
          timedOut: false,
        });
      }

      const installCommand = plan.commands.find((item) => item.id.endsWith(':config-install'));
      const installResult = installCommand
        ? await runCommand(installCommand)
        : await runInternalCommand(
            'config-install',
            'config',
            `install -m 600 ${shellToken(stagedConfigPath)} ${shellToken(configPath)}`,
            true,
          );
      if (installResult.status === 'failed') return finish('failed');
      dataPlaneMutationExecuted = true;

      const executionCommands = plan.commands.filter(
        (item) =>
          item.kind !== 'preflight' &&
          item.kind !== 'package' &&
          item.kind !== 'rollback' &&
          !item.id.endsWith(':config-stage-dir') &&
          !item.id.endsWith(':config-target-dir') &&
          !item.id.endsWith(':config-install'),
      );
      for (const command of executionCommands) {
        const result = await runCommand(command);
        if (result.status !== 'failed') {
          if (command.dataPlaneMutation) dataPlaneMutationExecuted = true;
          continue;
        }

        if (backupCreated) {
          const rollbackCommand = plan.commands.find((item) => item.kind === 'rollback' && item.id.includes(':rollback-'));
          if (rollbackCommand) {
            rollbackAttempted = true;
            const rollbackResult = await runCommand(rollbackCommand, { allowFailure: true });
            rollbackSucceeded = rollbackResult.status === 'succeeded';
          }
        }

        return finish(rollbackSucceeded ? 'rolledBack' : 'failed');
      }

      await this.markProtocolServerApplySecretsUsed(setup);
      return finish('succeeded');
    } catch {
      pushFailure(`${setup.id}:executor`, 'preflight');
      return finish('failed');
    } finally {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
      }
    }
  }

  private async loadProtocolServerApplyRemoteAccess(
    setup: ProtocolServerApplySource,
  ): Promise<ProtocolServerApplyRemoteAccess> {
    const serverId = setup.targetServerId?.trim();
    const credentialRef = setup.targetServerCredentialRef?.trim();
    if (!serverId || !credentialRef || !setup.targetServerAccessAddress || !setup.targetServerUsername) {
      throw new ConflictException('Protocol apply server access is incomplete');
    }
    if (setup.targetServerCredentialKind !== 'ssh_private_key') {
      throw new ConflictException('Protocol apply currently requires an SSH private-key credential');
    }
    const address = setup.targetServerAccessAddress.trim();
    const username = setup.targetServerUsername.trim();
    const sshPort = setup.targetServerSshPort ?? 22;
    if (!this.isSafeProtocolServerApplyHost(address) || !this.isSafeProtocolServerApplyUsername(username)) {
      throw new ConflictException('Protocol apply server access contains unsupported SSH target characters');
    }
    if (!Number.isInteger(sshPort) || sshPort < 1 || sshPort > 65535) {
      throw new ConflictException('Protocol apply SSH port is invalid');
    }

    const result = await this.database.query<ProtocolServerApplyCredentialMaterialRow>(
      `
        SELECT
          id,
          server_id AS "serverId",
          kind,
          encrypted_payload AS "encryptedPayload",
          status,
          revoked_at AS "revokedAt"
        FROM server_credentials
        WHERE id::text = $1
          AND server_id = $2
          AND status = 'active'
          AND revoked_at IS NULL
      `,
      [credentialRef, serverId],
    );
    const row = result.rows[0];
    if (!row) throw new ConflictException('Active server credential was not found for protocol apply');

    const payload = this.secretVault.decryptJson(
      row.encryptedPayload,
      this.serverCredentialEncryptionContext(row.serverId, row.id, row.kind),
    );
    const privateKey = this.stringFromConfig(payload.value);
    if (payload.kind !== row.kind || !privateKey) {
      throw new ConflictException('Server credential payload is invalid');
    }

    return {
      address,
      sshPort,
      username,
      credentialRef,
      credentialKind: row.kind,
      privateKey,
    };
  }

  private async loadProtocolServerApplySecretMaterial(
    setup: ProtocolServerApplySource,
  ): Promise<ProtocolServerApplySecretMaterial> {
    const secretRef = setup.secretRef?.trim();
    if (!secretRef) throw new ConflictException('Protocol apply secret reference is missing');

    const result = await this.database.query<ProtocolServerApplySecretMaterialRow>(
      `
        SELECT
          secret_ref AS "secretRef",
          kind,
          route_group AS "routeGroup",
          protocol,
          encrypted_payload AS "encryptedPayload",
          status,
          revoked_at AS "revokedAt"
        FROM secret_records
        WHERE secret_ref = $1
          AND status = 'active'
          AND revoked_at IS NULL
      `,
      [secretRef],
    );
    const row = result.rows[0];
    if (!row) throw new ConflictException('Protocol apply secret reference is inactive');
    if (row.routeGroup && row.routeGroup !== setup.routeGroup) {
      throw new ConflictException('Protocol apply secret belongs to a different route group');
    }
    if (row.protocol && row.protocol !== setup.protocol) {
      throw new ConflictException('Protocol apply secret belongs to a different protocol');
    }

    const payload = this.secretVault.decryptJson(
      row.encryptedPayload,
      this.secretEncryptionContext(row.secretRef, row.kind, row.routeGroup ?? setup.routeGroup, row.protocol ?? null),
    );
    const value = this.stringFromConfig(payload.value);
    if (payload.kind !== row.kind || !value) throw new ConflictException('Protocol apply secret payload is invalid');

    return {
      kind: row.kind,
      value,
    };
  }

  private renderProtocolServerConfig(
    setup: ProtocolServerApplySource,
    unitName: string,
    secret: ProtocolServerApplySecretMaterial,
  ): string {
    const config = this.asRecord(setup.config);

    if (secret.kind === 'protocolCredential' && config.rawSecretConfig === true) {
      return secret.value.trimEnd() + '\n';
    }

    switch (setup.protocol) {
      case 'wireguard':
        return this.renderWireGuardServerConfig(setup, secret);
      case 'vless':
        return this.renderVlessServerConfig(setup, unitName, secret);
      case 'l2tp':
      case 'ikev2':
        return secret.value.trimEnd() + '\n';
      default:
        throw new ConflictException('Protocol apply adapter does not support this protocol');
    }
  }

  private renderWireGuardServerConfig(
    setup: ProtocolServerApplySource,
    secret: ProtocolServerApplySecretMaterial,
  ): string {
    const config = this.asRecord(setup.config);
    const privateKey = secret.value.trim();
    const addressCidr = this.stringFromConfig(config.addressCidr);
    const listenPort = numberFromConfig(config.listenPort) ?? setup.port;
    const peerPublicKey = this.stringFromConfig(config.peerPublicKey);
    const allowedIps = this.stringFromConfig(config.allowedIps);
    const endpoint = this.stringFromConfig(config.endpoint);
    const persistentKeepalive = numberFromConfig(config.persistentKeepalive);

    if (secret.kind !== 'wireguardPrivateKey' || !privateKey || !addressCidr || !peerPublicKey || !allowedIps) {
      throw new ConflictException('WireGuard protocol apply material is incomplete');
    }

    const lines = [
      '[Interface]',
      `PrivateKey = ${privateKey}`,
      `Address = ${addressCidr}`,
      `ListenPort = ${listenPort}`,
      '',
      '[Peer]',
      `PublicKey = ${peerPublicKey}`,
      `AllowedIPs = ${allowedIps}`,
    ];

    if (endpoint) lines.push(`Endpoint = ${endpoint}`);
    if (persistentKeepalive && persistentKeepalive > 0) lines.push(`PersistentKeepalive = ${persistentKeepalive}`);

    return `${lines.join('\n')}\n`;
  }

  private renderVlessServerConfig(
    setup: ProtocolServerApplySource,
    unitName: string,
    secret: ProtocolServerApplySecretMaterial,
  ): string {
    const config = this.asRecord(setup.config);
    const credential = secret.value.trim();
    if (secret.kind !== 'protocolCredential' || !credential) {
      throw new ConflictException('VLESS protocol apply material is incomplete');
    }

    const listenAddress = this.stringFromConfig(config.listenAddress) ?? '::';
    const flow = this.stringFromConfig(config.flow);
    const user: Record<string, string> = { uuid: credential };
    if (flow) user.flow = flow;

    return `${JSON.stringify(
      {
        log: { level: 'warn' },
        inbounds: [
          {
            type: 'vless',
            tag: unitName,
            listen: listenAddress,
            listen_port: setup.port,
            users: [user],
          },
        ],
        outbounds: [{ type: 'direct', tag: 'direct' }],
      },
      null,
      2,
    )}\n`;
  }

  private assertRenderedProtocolServerConfig(value: string): void {
    if (!value.trim()) throw new ConflictException('Rendered protocol config is empty');
    if (value.length > 65536) throw new ConflictException('Rendered protocol config is too large');
    if (value.includes('\0')) throw new ConflictException('Rendered protocol config contains invalid bytes');
  }

  private normalizePrivateKey(value: string): string {
    return value.endsWith('\n') ? value : `${value}\n`;
  }

  private async markProtocolServerApplySecretsUsed(setup: ProtocolServerApplySource): Promise<void> {
    const now = new Date();
    await Promise.all([
      setup.secretRef
        ? this.database.query(
            `UPDATE secret_records SET last_used_at = $2, updated_at = now() WHERE secret_ref = $1`,
            [setup.secretRef, now],
          )
        : Promise.resolve(),
      setup.targetServerCredentialRef
        ? this.database.query(
            `UPDATE server_credentials SET last_used_at = $2, updated_at = now() WHERE id::text = $1`,
            [setup.targetServerCredentialRef, now],
          )
        : Promise.resolve(),
    ]);
  }

  private async runProtocolServerApplySshCommand(
    access: ProtocolServerApplyRemoteAccess,
    keyPath: string,
    command: AdminProtocolServerApplyPlanSummary['commands'][number],
  ): Promise<ProtocolServerApplyExecutionCommandResult> {
    const startedAt = Date.now();
    const result = await this.runLocalProcess(
      'ssh',
      [
        '-i',
        keyPath,
        '-p',
        String(access.sshPort),
        '-o',
        'BatchMode=yes',
        '-o',
        'IdentitiesOnly=yes',
        '-o',
        'StrictHostKeyChecking=accept-new',
        '-o',
        'ConnectTimeout=10',
        '-l',
        access.username,
        access.address,
        command.command,
      ],
      command.timeoutSeconds,
    );

    return {
      id: command.id,
      kind: command.kind,
      status: result.exitCode === 0 ? 'succeeded' : 'failed',
      exitCode: result.exitCode,
      durationMs: Date.now() - startedAt,
      dataPlaneMutation: command.dataPlaneMutation,
      timedOut: result.timedOut,
    };
  }

  private async runProtocolServerApplyScp(
    access: ProtocolServerApplyRemoteAccess,
    keyPath: string,
    localPath: string,
    remotePath: string,
    id: string,
  ): Promise<ProtocolServerApplyExecutionCommandResult> {
    const startedAt = Date.now();
    const result = await this.runLocalProcess(
      'scp',
      [
        '-i',
        keyPath,
        '-P',
        String(access.sshPort),
        '-o',
        'BatchMode=yes',
        '-o',
        'IdentitiesOnly=yes',
        '-o',
        'StrictHostKeyChecking=accept-new',
        '-o',
        'ConnectTimeout=10',
        localPath,
        this.scpProtocolServerApplyTarget(access, remotePath),
      ],
      45,
    );

    return {
      id,
      kind: 'config',
      status: result.exitCode === 0 ? 'succeeded' : 'failed',
      exitCode: result.exitCode,
      durationMs: Date.now() - startedAt,
      dataPlaneMutation: false,
      timedOut: result.timedOut,
    };
  }

  private scpProtocolServerApplyTarget(access: ProtocolServerApplyRemoteAccess, remotePath: string): string {
    const host = access.address.includes(':') && !access.address.startsWith('[') ? `[${access.address}]` : access.address;
    return `${access.username}@${host}:${remotePath}`;
  }

  private isSafeProtocolServerApplyHost(value: string): boolean {
    return value.length > 0 && value.length <= 253 && !/[\s"'`;$\\]/.test(value);
  }

  private isSafeProtocolServerApplyUsername(value: string): boolean {
    return /^[a-z_][a-z0-9_.-]{0,63}$/i.test(value);
  }

  private runLocalProcess(
    command: string,
    args: string[],
    timeoutSeconds: number,
  ): Promise<{ exitCode: number | null; timedOut: boolean }> {
    return new Promise((resolve) => {
      let settled = false;
      let timedOut = false;
      const child = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      const finish = (exitCode: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve({ exitCode, timedOut });
      };
      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, Math.max(5, timeoutSeconds) * 1000);

      child.stdout?.on('data', () => undefined);
      child.stderr?.on('data', () => undefined);
      child.on('error', () => finish(null));
      child.on('close', (code) => finish(code));
    });
  }

  private posixDirname(value: string): string {
    const index = value.lastIndexOf('/');
    if (index <= 0) return '/';
    return value.slice(0, index);
  }

  private protocolServerApplyStatus(input: {
    dataPlaneReady: boolean;
    hardBlocked: boolean;
    hasOutbound: boolean;
    missingSecret: boolean;
    missingTargetAccess: boolean;
  }): AdminProtocolServerApplyPlanSummary['status'] {
    if (!input.hasOutbound) return 'planningOnly';
    if (input.missingSecret || input.missingTargetAccess || input.hardBlocked) return 'blocked';
    if (input.dataPlaneReady) return 'applyReady';

    return 'dryRunReady';
  }

  private buildProtocolServerApplyPreflight(input: {
    adapter: AdminProtocolServerApplyAdapterSummary;
    adapterImplemented: boolean;
    commands: AdminProtocolServerApplyPlanSummary['commands'];
    commandPolicy: { ready: boolean; violations: string[] };
    configChanges: AdminProtocolServerApplyPlanSummary['configChanges'];
    configMaterial: { ready: boolean; missingFields: string[] };
    featureFlagEnabled: boolean;
    hasOutbound: boolean;
    hasSecretRef: boolean;
    hasServerAccess: boolean;
    hasServerCredential: boolean;
    hasTargetServer: boolean;
    outboundEnabled: boolean | null;
    outboundHealthStatus: string | null;
    outboundMaintenanceMode: boolean | null;
    requiresSecret: boolean;
    requiresServerAccess: boolean;
    secretDecryptAllowed: boolean;
    secretSafe: boolean;
    setup: ProtocolServerApplySource;
  }): AdminProtocolServerApplyPreflightSummary {
    type Gate = AdminProtocolServerApplyPreflightSummary['gates'][number];
    const gate = (
      kind: Gate['kind'],
      status: Gate['status'],
      reasonCodes: Array<ProtocolServerApplyReason | string>,
      options: {
        blocksDataPlane?: boolean;
        blocksDryRun?: boolean;
        observedValue?: string | null;
      } = {},
    ): Gate => ({
      id: `${input.setup.id}:preflight:${kind}`,
      kind,
      status,
      blocksDryRun: options.blocksDryRun === true,
      blocksDataPlane: options.blocksDataPlane !== false,
      observedValue: options.observedValue ?? null,
      reasonCodes,
    });
    const outboundHealthStatus = (input.outboundHealthStatus ?? 'unknown').toLowerCase();
    const outboundHealthGateStatus =
      !input.hasOutbound
        ? 'future'
        : outboundHealthStatus === 'healthy'
          ? 'passed'
          : outboundHealthStatus === 'degraded' || outboundHealthStatus === 'critical' || outboundHealthStatus === 'unhealthy'
            ? 'blocked'
            : 'future';
    const outboundHealthReason =
      outboundHealthGateStatus === 'passed'
        ? 'outboundHealthReady'
        : outboundHealthGateStatus === 'blocked'
          ? 'outboundHealthDegraded'
          : 'outboundHealthUnknown';
    const defaultInactiveStatus =
      !input.hasOutbound
        ? 'future'
        : input.outboundEnabled === false && input.outboundMaintenanceMode === true
          ? 'passed'
          : 'warning';
    const hasRollbackArtifacts =
      input.commands.some((command) => command.kind === 'rollback') &&
      input.configChanges.some((change) => change.kind === 'rollback');
    const hasHealthVerificationCommand = input.commands.some((command) => command.kind === 'health');
    const secretStatus =
      !input.requiresSecret
        ? 'notRequired'
        : !input.hasSecretRef
          ? 'blocked'
          : input.secretDecryptAllowed
            ? 'passed'
            : 'future';
    const accessMethodSupported =
      !input.requiresServerAccess ||
      ['ssh_key', 'temporary_root_key', 'existing_admin_key'].includes(input.setup.targetServerAccessMethod ?? '');
    const credentialKindSupported =
      !input.requiresServerAccess || input.setup.targetServerCredentialKind === 'ssh_private_key';
    const serverCredentialStatus =
      !input.requiresServerAccess
        ? 'notRequired'
        : !input.hasTargetServer || !input.adapter.serverAccessBoundary.credentialRefPresent
          ? 'blocked'
          : !input.hasServerCredential
            ? 'blocked'
            : !accessMethodSupported || !credentialKindSupported
              ? 'blocked'
            : input.adapter.serverAccessBoundary.credentialDecryptAllowed
              ? 'passed'
              : 'future';
    const commandRunnerStatus = input.adapter.commandRunner.mode === 'live' && input.adapter.commandRunner.implemented
      ? 'passed'
      : 'future';
    const gates: Gate[] = [
      gate(
        'featureFlag',
        input.featureFlagEnabled ? 'passed' : 'future',
        [input.featureFlagEnabled ? 'featureFlagReady' : 'featureFlagDisabled'],
      ),
      gate(
        'adapter',
        input.adapterImplemented ? 'passed' : 'future',
        [input.adapterImplemented ? 'adapterReady' : 'adapterMissing', !input.adapterImplemented ? 'adapterDryRunOnly' : null].filter(
          (reason): reason is ProtocolServerApplyReason => Boolean(reason),
        ),
      ),
      gate('dryRunSafety', input.secretSafe ? 'passed' : 'blocked', [input.secretSafe ? 'dryRunSafe' : 'dryRunUnsafe'], {
        blocksDryRun: !input.secretSafe,
      }),
      gate(
        'configMaterial',
        input.configMaterial.ready ? 'passed' : 'blocked',
        [input.configMaterial.ready ? 'configMaterialReady' : 'configMaterialMissing'],
        {
          blocksDryRun: false,
          observedValue: input.configMaterial.missingFields.length > 0 ? input.configMaterial.missingFields.join(', ') : null,
        },
      ),
      gate(
        'commandPolicy',
        input.commandPolicy.ready ? 'passed' : 'blocked',
        [input.commandPolicy.ready ? 'commandPolicyReady' : 'commandPolicyViolation'],
        {
          observedValue: input.commandPolicy.violations.length > 0 ? input.commandPolicy.violations.slice(0, 3).join(', ') : null,
        },
      ),
      gate('outbound', input.hasOutbound ? 'passed' : 'future', [input.hasOutbound ? 'outboundReady' : 'outboundMissing'], {
        blocksDryRun: !input.hasOutbound,
      }),
      gate('outboundHealth', outboundHealthGateStatus, [outboundHealthReason], {
        observedValue: input.outboundHealthStatus ?? 'unknown',
      }),
      gate(
        'defaultInactive',
        defaultInactiveStatus,
        [
          input.outboundEnabled === true ? 'outboundEnabled' : 'defaultInactive',
          input.outboundMaintenanceMode === true ? 'maintenanceMode' : null,
        ].filter((reason): reason is ProtocolServerApplyReason => Boolean(reason)),
        {
          blocksDataPlane: false,
          observedValue: input.hasOutbound
            ? `enabled=${input.outboundEnabled === true}; maintenance=${input.outboundMaintenanceMode === true}`
            : null,
        },
      ),
      gate(
        'secret',
        secretStatus,
        input.requiresSecret
          ? [
              input.hasSecretRef ? 'secretReady' : 'secretMissing',
              input.hasSecretRef ? (input.secretDecryptAllowed ? 'secretDecryptReady' : 'secretDecryptDisabled') : null,
            ].filter((reason): reason is ProtocolServerApplyReason => Boolean(reason))
          : [],
        {
          blocksDryRun: input.requiresSecret && !input.hasSecretRef,
        },
      ),
      gate(
        'serverAccess',
        input.requiresServerAccess
          ? input.hasTargetServer
            ? input.hasServerAccess
              ? 'passed'
              : 'blocked'
            : 'blocked'
          : 'notRequired',
        [
          input.requiresServerAccess && !input.hasTargetServer ? 'serverMissing' : null,
          input.requiresServerAccess ? (input.hasServerAccess ? 'serverAccessReady' : 'serverAccessMissing') : null,
        ].filter((reason): reason is ProtocolServerApplyReason => Boolean(reason)),
      ),
      gate(
        'serverCredential',
        serverCredentialStatus,
        input.requiresServerAccess
          ? [
              !input.hasTargetServer || !input.adapter.serverAccessBoundary.credentialRefPresent ? 'serverCredentialRefMissing' : null,
              input.adapter.serverAccessBoundary.credentialRefPresent
                ? input.hasServerCredential
                  ? 'serverCredentialReady'
                  : 'serverCredentialInactive'
                : null,
              input.hasServerCredential
                ? input.adapter.serverAccessBoundary.credentialDecryptAllowed
                  ? 'serverCredentialDecryptReady'
                  : 'serverCredentialDecryptDisabled'
                : null,
              !accessMethodSupported ? 'serverAccessMethodUnsupported' : null,
              input.hasServerCredential && !credentialKindSupported ? 'serverCredentialKindUnsupported' : null,
            ].filter((reason): reason is ProtocolServerApplyReason => Boolean(reason))
          : [],
      ),
      gate(
        'commandRunner',
        commandRunnerStatus,
        input.adapter.commandRunner.reasonCodes,
      ),
      gate(
        'rollback',
        input.adapterImplemented ? (hasRollbackArtifacts ? 'passed' : 'blocked') : 'future',
        [hasRollbackArtifacts ? 'rollbackReady' : 'rollbackRequired'],
      ),
      gate('audit', 'passed', ['auditReady', 'auditRequired']),
      gate(
        'healthVerification',
        input.adapterImplemented
          ? hasHealthVerificationCommand && (!input.requiresServerAccess || (input.hasServerAccess && input.hasServerCredential))
            ? 'passed'
            : 'blocked'
          : 'future',
        [hasHealthVerificationCommand ? 'postApplyHealthRequired' : 'healthVerifyRequired'],
      ),
    ];
    const canRecordDryRun = gates.every((item) => !item.blocksDryRun || item.status === 'passed' || item.status === 'warning' || item.status === 'notRequired');
    const canExecuteDataPlane = gates.every((item) => !item.blocksDataPlane || item.status === 'passed' || item.status === 'notRequired');
    const liveApplyBlockedReasonCodes = this.uniqueStrings(
      gates
        .filter((item) => item.blocksDataPlane && item.status !== 'passed' && item.status !== 'notRequired')
        .flatMap((item) => item.reasonCodes),
    );
    const blockedReasonCodes = this.uniqueStrings(
      gates.filter((item) => item.status === 'blocked').flatMap((item) => item.reasonCodes),
    );

    return {
      status: canExecuteDataPlane ? 'applyReady' : canRecordDryRun ? 'dryRunReady' : 'planningOnly',
      canRecordDryRun,
      canExecuteDataPlane,
      passedGateCount: gates.filter((item) => item.status === 'passed').length,
      blockedGateCount: gates.filter((item) => item.status === 'blocked').length,
      futureGateCount: gates.filter((item) => item.status === 'future').length,
      warningGateCount: gates.filter((item) => item.status === 'warning').length,
      blockedReasonCodes,
      liveApplyBlockedReasonCodes,
      gates,
    };
  }

  private buildProtocolServerApplySteps(input: {
    setup: ProtocolServerApplySource;
    commands: AdminProtocolServerApplyPlanSummary['commands'];
    featureFlagEnabled: boolean;
    adapterImplemented: boolean;
    configMaterialReady: boolean;
    commandPolicyReady: boolean;
    dataPlaneReady: boolean;
    hasOutbound: boolean;
    requiresSecret: boolean;
    hasSecretRef: boolean;
    secretDecryptAllowed: boolean;
    requiresServerAccess: boolean;
    hasTargetServer: boolean;
    hasServerAccess: boolean;
  }): AdminProtocolServerApplyPlanSummary['steps'] {
    const reason = (...items: Array<ProtocolServerApplyReason | false | null | undefined>) =>
      items.filter((item): item is ProtocolServerApplyReason => Boolean(item));
    const step = (
      kind: AdminProtocolServerApplyPlanSummary['steps'][number]['kind'],
      status: AdminProtocolServerApplyPlanSummary['steps'][number]['status'],
      reasonCodes: ProtocolServerApplyReason[],
      dataPlaneMutation = false,
    ): AdminProtocolServerApplyPlanSummary['steps'][number] => ({
      id: `${input.setup.id}:${kind}`,
      kind,
      status,
      commandPreviewCount: input.commands.filter((command) => command.kind === kind).length,
      dataPlaneMutation,
      secretSafe: true,
      reasonCodes,
    });

    const preflightStatus = !input.commandPolicyReady
      ? 'blocked'
      : input.featureFlagEnabled && input.adapterImplemented
        ? 'ready'
        : 'future';
    const downstreamStatus = input.dataPlaneReady ? 'ready' : 'future';
    const configStatus = input.configMaterialReady ? downstreamStatus : 'blocked';
    const secretStepStatus =
      !input.requiresSecret
        ? 'notRequired'
        : !input.hasSecretRef
          ? 'blocked'
          : input.secretDecryptAllowed
            ? 'ready'
            : 'future';

    return [
      step(
        'preflight',
        preflightStatus,
        reason(
          'protocolSupported',
          'auditRequired',
          input.commandPolicyReady ? 'commandPolicyReady' : 'commandPolicyViolation',
          !input.featureFlagEnabled && 'featureFlagDisabled',
          !input.adapterImplemented && 'adapterDryRunOnly',
          !input.adapterImplemented && 'adapterMissing',
        ),
      ),
      step(
        'secret',
        secretStepStatus,
        reason(
          input.requiresSecret && (input.hasSecretRef ? 'secretReady' : 'secretMissing'),
          input.requiresSecret && input.hasSecretRef && (input.secretDecryptAllowed ? 'secretDecryptReady' : 'secretDecryptDisabled'),
        ),
      ),
      step(
        'serverAccess',
        input.requiresServerAccess
          ? input.hasOutbound
            ? input.hasServerAccess
              ? 'ready'
              : 'blocked'
            : 'future'
          : 'notRequired',
        reason(
          input.hasOutbound ? 'outboundReady' : 'outboundMissing',
          input.requiresServerAccess && !input.hasTargetServer && 'serverMissing',
          input.requiresServerAccess && (input.hasServerAccess ? 'serverAccessReady' : 'serverAccessMissing'),
        ),
      ),
      step('package', downstreamStatus, reason(input.hasOutbound ? 'outboundReady' : 'outboundMissing')),
      step(
        'config',
        configStatus,
        reason(input.configMaterialReady ? 'configMaterialReady' : 'configMaterialMissing', 'defaultInactive', input.hasOutbound && 'maintenanceMode'),
        true,
      ),
      step('service', downstreamStatus, reason('defaultInactive', input.hasOutbound && 'maintenanceMode'), true),
      step('health', downstreamStatus, reason('healthVerifyRequired')),
      step('rollback', downstreamStatus, reason('auditRequired'), true),
    ];
  }

  private protocolServerApplyConfigMaterial(setup: ProtocolServerApplySource): {
    ready: boolean;
    missingFields: string[];
  } {
    const config = this.asRecord(setup.config);
    const missingFields = new Set<string>();
    const requireString = (key: string, label = key) => {
      if (!this.stringFromConfig(config[key])) missingFields.add(label);
    };
    const requirePort = (label = 'port') => {
      if (!Number.isInteger(setup.port) || setup.port < 1 || setup.port > 65535) missingFields.add(label);
    };

    switch (setup.protocol) {
      case 'wireguard':
        requireString('interfaceName');
        requireString('addressCidr');
        requirePort('listenPort');
        requireString('endpoint');
        requireString('allowedIps');
        requireString('peerPublicKey');
        break;
      case 'vless':
        requireString('endpoint');
        requirePort();
        break;
      case 'l2tp':
      case 'ikev2':
        requireString('endpoint');
        requirePort();
        break;
      default:
        requirePort();
        break;
    }

    const fields = Array.from(missingFields);

    return {
      ready: fields.length === 0,
      missingFields: fields,
    };
  }

  private protocolServerApplyCommandPolicy(commands: AdminProtocolServerApplyPlanSummary['commands']): {
    ready: boolean;
    violations: string[];
  } {
    const violations = new Set<string>();
    const hasRollbackCommand = commands.some((command) => command.kind === 'rollback' && command.secretSafe);

    for (const command of commands) {
      if (!command.allowlisted) violations.add(`${command.id}:not-allowlisted`);
      if (!command.secretSafe) violations.add(`${command.id}:not-secret-safe`);
      if (!Number.isFinite(command.timeoutSeconds) || command.timeoutSeconds < 5 || command.timeoutSeconds > 120) {
        violations.add(`${command.id}:timeout-out-of-range`);
      }
      if (command.command.length > 240) violations.add(`${command.id}:command-too-long`);
      if (
        /[\r\n`;]/.test(command.command) ||
        command.command.includes('$(') ||
        command.command.includes('${') ||
        command.command.includes('&&') ||
        command.command.includes('||')
      ) {
        violations.add(`${command.id}:shell-control-blocked`);
      }
      if (command.dataPlaneMutation && !command.requiresRoot) violations.add(`${command.id}:mutation-requires-root`);
      if (command.dataPlaneMutation && command.kind !== 'rollback' && !hasRollbackCommand) {
        violations.add(`${command.id}:rollback-missing`);
      }
    }

    const items = Array.from(violations);

    return {
      ready: items.length === 0,
      violations: items,
    };
  }

  private protocolServerApplyCommandTimeout(kind: AdminProtocolServerApplyPlanSummary['commands'][number]['kind']): number {
    switch (kind) {
      case 'service':
        return 45;
      case 'rollback':
        return 30;
      case 'package':
      case 'config':
      case 'health':
        return 20;
      default:
        return 10;
    }
  }

  private protocolServerApplyCommandAllowlisted(command: string): boolean {
    const trimmed = command.trim();
    const allowedPrefixes = [
      'id ',
      'command ',
      'wg-quick ',
      'systemctl ',
      'wg ',
      'cp ',
      'mkdir ',
      'install ',
      'sing-box ',
      'test ',
      'ipsec ',
      'xl2tpd-control ',
      'swanctl ',
      'true',
    ];

    return allowedPrefixes.some((prefix) => trimmed === prefix.trim() || trimmed.startsWith(prefix));
  }

  private buildProtocolServerApplyCommands(
    setup: ProtocolServerApplySource,
    unitName: string,
  ): AdminProtocolServerApplyPlanSummary['commands'] {
    const configPath = this.protocolServerApplyConfigPath(setup.protocol, unitName);
    const stagedPath = `/var/lib/afrogate/protocols/${safePathSegment(unitName)}.rendered`;
    const configDir = this.posixDirname(configPath);
    const command = (
      idSuffix: string,
      kind: AdminProtocolServerApplyPlanSummary['commands'][number]['kind'],
      preview: string,
      requiresRoot: boolean,
      dataPlaneMutation: boolean,
    ): AdminProtocolServerApplyPlanSummary['commands'][number] => ({
      id: `${setup.id}:${idSuffix}`,
      kind,
      command: preview,
      requiresRoot,
      dataPlaneMutation,
      secretSafe: true,
      allowlisted: this.protocolServerApplyCommandAllowlisted(preview),
      timeoutSeconds: this.protocolServerApplyCommandTimeout(kind),
    });
    const base = [
      command('preflight-user', 'preflight', 'id -u afrogate', false, false),
      command('preflight-systemctl', 'preflight', 'command -v systemctl', false, false),
    ];
    const configPrepare = [
      command('config-stage-dir', 'config', `mkdir -p ${shellToken('/var/lib/afrogate/protocols')}`, true, false),
      command('config-target-dir', 'config', `mkdir -p ${shellToken(configDir)}`, true, false),
      command('config-backup', 'rollback', `cp ${shellToken(configPath)} ${shellToken(`${configPath}.afrogate.bak`)}`, true, true),
      command('config-install', 'config', `install -m 600 ${shellToken(stagedPath)} ${shellToken(configPath)}`, true, true),
    ];

    switch (setup.protocol) {
      case 'wireguard':
        return [
          ...base,
          command('package-wireguard-wg', 'package', 'command -v wg', false, false),
          command('package-wireguard-wg-quick', 'package', 'command -v wg-quick', false, false),
          ...configPrepare,
          command('config-wireguard-check', 'config', `wg-quick strip ${shellToken(configPath)}`, true, false),
          command('service-wireguard-status', 'service', `systemctl status wg-quick@${shellToken(unitName)}`, false, false),
          command('service-wireguard-reload', 'service', `systemctl reload-or-restart wg-quick@${shellToken(unitName)}`, true, true),
          command('health-wireguard', 'health', `wg show ${shellToken(unitName)}`, true, false),
          command('rollback-wireguard', 'rollback', `cp ${shellToken(`${configPath}.afrogate.bak`)} ${shellToken(configPath)}`, true, true),
        ];
      case 'vless':
        return [
          ...base,
          command('package-vless-sing-box', 'package', 'command -v sing-box', false, false),
          command('package-vless-xray', 'package', 'command -v xray', false, false),
          ...configPrepare,
          command('config-vless-check', 'config', `sing-box check -c ${shellToken(configPath)}`, true, false),
          command('service-vless-status', 'service', 'systemctl status sing-box', false, false),
          command('service-vless-reload', 'service', 'systemctl reload-or-restart sing-box', true, true),
          command('health-vless', 'health', `test -S /run/afrogate/${safePathSegment(unitName)}.sock`, true, false),
          command('rollback-vless', 'rollback', `cp ${shellToken(`${configPath}.afrogate.bak`)} ${shellToken(configPath)}`, true, true),
        ];
      case 'l2tp':
        return [
          ...base,
          command('package-l2tp-ipsec', 'package', 'command -v ipsec', false, false),
          command('package-l2tp-xl2tpd', 'package', 'command -v xl2tpd', false, false),
          ...configPrepare,
          command('config-l2tp-check', 'config', `test -f ${shellToken(configPath)}`, true, false),
          command('service-l2tp-status', 'service', 'systemctl status strongswan-starter xl2tpd', false, false),
          command('service-l2tp-reload', 'service', 'systemctl reload-or-restart strongswan-starter xl2tpd', true, true),
          command('health-l2tp-ipsec', 'health', 'ipsec status', true, false),
          command('health-l2tp-control', 'health', 'xl2tpd-control status', true, false),
          command('rollback-l2tp', 'rollback', `cp ${shellToken(`${configPath}.afrogate.bak`)} ${shellToken(configPath)}`, true, true),
        ];
      case 'ikev2':
        return [
          ...base,
          command('package-ikev2-ipsec', 'package', 'command -v ipsec', false, false),
          command('package-ikev2-swanctl', 'package', 'command -v swanctl', false, false),
          ...configPrepare,
          command('config-ikev2-check', 'config', `test -f ${shellToken(configPath)}`, true, false),
          command('service-ikev2-status', 'service', 'systemctl status strongswan-starter', false, false),
          command('service-ikev2-reload', 'service', 'systemctl reload-or-restart strongswan-starter', true, true),
          command('health-ikev2-ipsec', 'health', 'ipsec statusall', true, false),
          command('health-ikev2-swanctl', 'health', 'swanctl --list-sas', true, false),
          command('rollback-ikev2', 'rollback', `cp ${shellToken(`${configPath}.afrogate.bak`)} ${shellToken(configPath)}`, true, true),
        ];
      default:
        return [
          ...base,
          command('package-custom', 'package', 'test -d /etc/afrogate', false, false),
          ...configPrepare,
          command('config-custom-check', 'config', `test -f ${shellToken(configPath)}`, true, false),
          command('health-custom', 'health', 'true', false, false),
        ];
    }
  }

  private buildProtocolServerApplyConfigChanges(
    setup: ProtocolServerApplySource,
    unitName: string,
  ): AdminProtocolServerApplyPlanSummary['configChanges'] {
    const configPath = this.protocolServerApplyConfigPath(setup.protocol, unitName);
    const stagedPath = `/var/lib/afrogate/protocols/${safePathSegment(unitName)}.rendered`;

    return [
      {
        id: `${setup.id}:config-render`,
        kind: 'config',
        filePath: stagedPath,
        action: 'create',
        dataPlaneMutation: false,
        secretSafe: true,
      },
      {
        id: `${setup.id}:config-install`,
        kind: 'config',
        filePath: configPath,
        action: 'update',
        dataPlaneMutation: true,
        secretSafe: true,
      },
      {
        id: `${setup.id}:config-rollback`,
        kind: 'rollback',
        filePath: `${configPath}.afrogate.bak`,
        action: 'create',
        dataPlaneMutation: true,
        secretSafe: true,
      },
    ];
  }

  private protocolServerApplyConfigPath(protocol: string, unitName: string): string {
    const safeUnitName = safeConfigFileName(unitName);

    switch (protocol) {
      case 'wireguard':
        return `/etc/wireguard/${safeUnitName}.conf`;
      case 'vless':
        return `/etc/sing-box/afrogate-${safeUnitName}.json`;
      case 'l2tp':
        return `/etc/ipsec.d/afrogate-${safeUnitName}.conf`;
      case 'ikev2':
        return `/etc/swanctl/conf.d/afrogate-${safeUnitName}.conf`;
      default:
        return `/etc/afrogate/protocols/${safeUnitName}.conf`;
    }
  }

  private protocolRequiresServerSecret(protocol: string): boolean {
    return protocol === 'wireguard' || protocol === 'vless' || protocol === 'l2tp' || protocol === 'ikev2';
  }

  private protocolSetupHasSecretRef(setup: ProtocolServerApplySource): boolean {
    return typeof setup.hasSecretRef === 'boolean' ? setup.hasSecretRef : Boolean(setup.secretRef);
  }

  private safeProtocolUnitName(setup: ProtocolServerApplySource): string {
    const config = this.asRecord(setup.config);

    if (setup.protocol === 'wireguard') {
      return safeWireGuardInterfaceName(this.stringFromConfig(config.interfaceName), setup.id);
    }

    const suffix = setup.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'route';
    const prefix = safePathSegment(`${setup.protocol}-${setup.name}`).slice(0, 36).replace(/-+$/g, '');

    return `${prefix || setup.protocol}-${suffix}`;
  }

  private buildProvisionedOutboundConfig(setup: ProtocolSetupRow): Record<string, unknown> {
    const config = { ...this.asRecord(setup.config) };
    const healthTarget = this.stringFromConfig(config.healthTarget);
    const endpoint = this.stringFromConfig(config.endpoint);
    const endpointTarget = this.parseHostPort(endpoint);

    if (healthTarget && this.isHttpUrl(healthTarget) && !this.stringFromConfig(config.healthUrl)) {
      config.healthUrl = healthTarget;
    }

    if (endpointTarget) {
      if (!this.stringFromConfig(config.healthHost)) config.healthHost = endpointTarget.host;
      if (numberFromConfig(config.healthPort) === null) config.healthPort = endpointTarget.port;
    }

    return {
      ...config,
      protocol: setup.protocol,
      profile: setup.profile,
      port: setup.port,
      provisioningMode: 'control-plane-draft',
      serverApplyState: 'planning-only',
      serverApplyPlanVersion: 1,
      serverApplyFeatureFlag: 'AFROGATE_PROTOCOL_SERVER_APPLY_ENABLED',
      serverApplyDryRunOnly: true,
      serverApplyTargetServerId: setup.targetServerId ?? null,
      serverApplyTargetServerLabel: setup.targetServerLabel ?? null,
      serverApplyTargetServerAccessReady: Boolean(setup.targetServerAccessReady),
      provisionedFromProtocolSetupId: setup.id,
      provisionedRouteGroup: setup.routeGroup,
      materialRefAttached: Boolean(setup.secretRef),
    };
  }

  private protocolToOutboundType(protocol: string): string {
    switch (protocol) {
      case 'wireguard':
        return 'wireguard';
      case 'vless':
        return 'vless-local-proxy';
      case 'l2tp':
        return 'l2tp';
      case 'ikev2':
        return 'ikev2';
      default:
        return 'custom';
    }
  }

  private profileToOutboundWeight(profile: string): number {
    switch (profile) {
      case 'highSpeed':
        return 120;
      case 'highSecurity':
        return 80;
      case 'gaming':
        return 90;
      default:
        return 100;
    }
  }

  private stringFromConfig(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private isHttpUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private parseHostPort(value: string | null): { host: string; port: number } | null {
    if (!value) return null;

    const trimmed = value.trim();
    if (trimmed.includes('://') || trimmed.startsWith('[')) return null;

    const match = /^(?<host>[a-z0-9.-]+):(?<port>[0-9]{1,5})$/i.exec(trimmed);
    if (!match?.groups) return null;

    const port = Number(match.groups.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null;

    return {
      host: match.groups.host,
      port,
    };
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
          credential_ref = CASE
            WHEN $10 THEN excluded.credential_ref
            ELSE server_access_profiles.credential_ref
          END,
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
        profile.credentialRef !== undefined,
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

  private async updateServerInterfaceFields(
    executor: DatabaseQueryExecutor,
    id: string,
    dto: UpdateServerInterfaceDto,
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
    if (dto.operator !== undefined) add('operator', 'operator', dto.operator);
    if (dto.kind !== undefined) add('kind', 'kind', dto.kind);
    if (dto.status !== undefined) add('status', 'status', dto.status);
    if (dto.macAddress !== undefined) add('macAddress', 'mac_address', dto.macAddress);
    if (dto.addressCidr !== undefined) add('addressCidr', 'address_cidr', dto.addressCidr);
    if (dto.notes !== undefined) add('notes', 'notes', dto.notes);

    if (!setClauses.length) return fields;

    values.push(id);
    await executor.query(
      `
        UPDATE server_interfaces
        SET ${setClauses.join(', ')},
            updated_at = now()
        WHERE id = $${values.length}
      `,
      values,
    );

    return fields;
  }

  private async updateTunnelFields(
    executor: DatabaseQueryExecutor,
    id: string,
    dto: UpdateTunnelDto,
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
    if (dto.remoteEndpoint !== undefined) add('remoteEndpoint', 'remote_endpoint', dto.remoteEndpoint);
    if (dto.interfaceName !== undefined) add('interfaceName', 'interface_name', dto.interfaceName);
    if (dto.localInterfaceId !== undefined) add('localInterfaceId', 'local_interface_id', dto.localInterfaceId);
    if (dto.routeGroup !== undefined) add('routeGroup', 'route_group', dto.routeGroup);
    if (dto.status !== undefined) add('status', 'status', dto.status);
    if (dto.lockable !== undefined) add('lockable', 'lockable', dto.lockable);
    if (dto.notes !== undefined) add('notes', 'notes', dto.notes);

    if (!setClauses.length) return fields;

    values.push(id);
    await executor.query(
      `
        UPDATE tunnels
        SET ${setClauses.join(', ')},
            updated_at = now()
        WHERE id = $${values.length}
      `,
      values,
    );

    return fields;
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
    if (dto.usageMultiplier !== undefined) add('usageMultiplier', 'usage_multiplier', dto.usageMultiplier);
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

  private stringOrFallback(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
  }

  private stringOrNullable(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
  }

  private stringArrayOrEmpty(value: unknown): string[] {
    return Array.isArray(value) ? value.map(String) : [];
  }

  private uniqueStrings(values: Array<string | null | undefined>): string[] {
    return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0))];
  }

  private numberOrFallback(value: unknown, fallback: number): number {
    const numericValue = Number(value);

    return Number.isFinite(numericValue) ? numericValue : fallback;
  }

  private nullableNumber(value: unknown): number | null {
    const numericValue = Number(value);

    return Number.isFinite(numericValue) ? numericValue : null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private throwConflictIfUniqueViolation(error: unknown, message: string): void {
    if (this.isErrorWithCode(error) && error.code === '23505') {
      throw new ConflictException(message);
    }
  }

  private isUndefinedTableError(error: unknown): boolean {
    return this.isErrorWithCode(error) && ['42P01', '42703', '42P10'].includes(error.code);
  }

  private isErrorWithCode(error: unknown): error is { code: string } {
    return typeof error === 'object' && error !== null && 'code' in error;
  }
}
