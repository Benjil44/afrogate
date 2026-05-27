import { randomBytes } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import type { AgentHeartbeatResponse, AgentRegistrationResponse } from '@afrogate/shared';
import { AuditService } from '../audit/audit.service';
import { DatabaseService, type DatabaseQueryExecutor } from '../database/database.service';
import { hashAgentToken } from '../security/agent-token';
import type { AuthActor } from '../security/auth-request';
import { AgentHeartbeatDto } from './dto/agent-heartbeat.dto';
import { RegisterAgentDto } from './dto/register-agent.dto';

interface RegisteredServerRow {
  id: string;
  externalId: string;
  hostname: string | null;
  platform: string | null;
  status: string;
}

interface CreatedTokenRow {
  id: string;
  name: string;
  scopes: string[];
  createdAt: Date;
}

const agentTokenScopes = ['metrics:write'];

@Injectable()
export class AgentsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterAgentDto, actor: AuthActor | undefined): Promise<AgentRegistrationResponse> {
    const token = this.createAgentToken();
    const tokenHash = hashAgentToken(token);
    const tokenName = dto.tokenName?.trim() || `${dto.serverExternalId}-agent`;

    return this.database.transaction(async (executor) => {
      const server = await this.upsertServer(dto, executor);

      if (dto.revokeExistingTokens) {
        await executor.query(
          `
            UPDATE agent_tokens
            SET revoked_at = now()
            WHERE server_id = $1
              AND revoked_at IS NULL
          `,
          [server.id],
        );
      }

      const tokenResult = await executor.query<CreatedTokenRow>(
        `
          INSERT INTO agent_tokens (server_id, name, token_hash, scopes)
          VALUES ($1, $2, $3, $4::jsonb)
          RETURNING
            id,
            name,
            scopes,
            created_at AS "createdAt"
        `,
        [server.id, tokenName, tokenHash, JSON.stringify(agentTokenScopes)],
      );
      const createdToken = tokenResult.rows[0];

      await this.audit.record(
        actor,
        'agent.register',
        'server',
        server.id,
        {
          externalId: server.externalId,
          tokenId: createdToken.id,
          tokenName: createdToken.name,
          revokedExistingTokens: Boolean(dto.revokeExistingTokens),
        },
        executor,
      );

      return {
        server: {
          id: server.id,
          externalId: server.externalId,
          hostname: server.hostname,
          platform: server.platform,
          status: server.status,
        },
        token: {
          id: createdToken.id,
          name: createdToken.name,
          token,
          scopes: this.normalizeScopes(createdToken.scopes),
          createdAt: createdToken.createdAt.toISOString(),
        },
      };
    });
  }

  async heartbeat(dto: AgentHeartbeatDto, actor: AuthActor | undefined): Promise<AgentHeartbeatResponse> {
    const serverId = this.resolveHeartbeatServerId(dto, actor);
    const status = dto.status?.trim() || 'healthy';
    const result = await this.database.query<{ serverId: string; status: string; receivedAt: Date }>(
      `
        INSERT INTO servers (external_id, hostname, platform, status)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (external_id)
        DO UPDATE SET
          hostname = COALESCE(excluded.hostname, servers.hostname),
          platform = COALESCE(excluded.platform, servers.platform),
          status = excluded.status,
          last_seen_at = now(),
          updated_at = now()
        RETURNING
          external_id AS "serverId",
          status,
          last_seen_at AS "receivedAt"
      `,
      [
        serverId,
        dto.hostname ?? null,
        dto.platform ?? null,
        status,
      ],
    );
    const row = result.rows[0];

    return {
      serverId: row.serverId,
      status: row.status,
      receivedAt: row.receivedAt.toISOString(),
    };
  }

  private async upsertServer(dto: RegisterAgentDto, executor: DatabaseQueryExecutor): Promise<RegisteredServerRow> {
    const result = await executor.query<RegisteredServerRow>(
      `
        INSERT INTO servers (
          external_id, hostname, platform, country, region, role, tags, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'registered')
        ON CONFLICT (external_id)
        DO UPDATE SET
          hostname = COALESCE(excluded.hostname, servers.hostname),
          platform = COALESCE(excluded.platform, servers.platform),
          country = COALESCE(excluded.country, servers.country),
          region = COALESCE(excluded.region, servers.region),
          role = COALESCE(excluded.role, servers.role),
          tags = CASE
            WHEN jsonb_array_length(excluded.tags) > 0 THEN excluded.tags
            ELSE servers.tags
          END,
          status = CASE
            WHEN servers.status = 'unknown' THEN 'registered'
            ELSE servers.status
          END,
          updated_at = now()
        RETURNING
          id,
          external_id AS "externalId",
          hostname,
          platform,
          status
      `,
      [
        dto.serverExternalId,
        dto.hostname ?? null,
        dto.platform ?? null,
        dto.country ?? null,
        dto.region ?? null,
        dto.role ?? null,
        JSON.stringify(this.normalizeTags(dto.tags)),
      ],
    );

    return result.rows[0];
  }

  private createAgentToken(): string {
    return `agt_${randomBytes(32).toString('base64url')}`;
  }

  private resolveHeartbeatServerId(dto: AgentHeartbeatDto, actor: AuthActor | undefined): string {
    if (actor?.type === 'agent' && actor.id && actor.id !== 'unknown-agent') return actor.id;
    if (dto.serverId?.trim()) return dto.serverId.trim();

    throw new BadRequestException('Heartbeat server id is required');
  }

  private normalizeTags(value: unknown): string[] {
    if (!Array.isArray(value)) return [];

    return [...new Set(value.map((tag) => (typeof tag === 'string' ? tag.trim() : '')).filter(Boolean))];
  }

  private normalizeScopes(value: unknown): string[] {
    if (!Array.isArray(value)) return agentTokenScopes;

    const scopes = value.filter((scope): scope is string => typeof scope === 'string' && scope.length > 0);
    return scopes.length > 0 ? scopes : agentTokenScopes;
  }
}
