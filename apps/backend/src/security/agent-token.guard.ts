import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { hashAgentToken } from './agent-token';
import type { RequestWithAuth } from './auth-request';
import { readBearerToken, secureTokenEquals } from './bearer-token';

interface RegisteredAgentTokenRow {
  id: string;
  serverExternalId: string | null;
  serverId: string | null;
  scopes: unknown;
}

@Injectable()
export class AgentTokenGuard implements CanActivate {
  constructor(private readonly database: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const expectedToken = process.env.AFROWS_AGENT_TOKEN;
    const legacyToken = expectedToken && expectedToken !== 'change-me-local-token' ? expectedToken : null;
    const hasLegacyToken = Boolean(legacyToken);
    const hasDatabaseTokens = Boolean(process.env.DATABASE_URL);
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const token = readBearerToken(request.headers.authorization);

    if (!hasLegacyToken && !hasDatabaseTokens) {
      throw new ServiceUnavailableException('Agent token is not configured');
    }

    if (!token) {
      throw new UnauthorizedException('Agent token is required');
    }

    if (legacyToken && secureTokenEquals(token, legacyToken)) {
      request.actor = {
        id: process.env.AFROWS_AGENT_ID ?? 'unknown-agent',
        role: 'agent',
        type: 'agent',
      };

      return true;
    }

    if (hasDatabaseTokens) {
      const registeredToken = await this.findRegisteredToken(token);

      if (registeredToken) {
        request.actor = {
          id: registeredToken.serverExternalId ?? registeredToken.serverId ?? registeredToken.id,
          role: 'agent',
          type: 'agent',
        };

        return true;
      }
    }

    throw new UnauthorizedException('Invalid agent token');
  }

  private async findRegisteredToken(token: string): Promise<RegisteredAgentTokenRow | null> {
    try {
      const result = await this.database.query<RegisteredAgentTokenRow>(
        `
          UPDATE agent_tokens agt
          SET last_used_at = now()
          FROM servers s
          WHERE agt.server_id = s.id
            AND agt.token_hash = $1
            AND agt.revoked_at IS NULL
            AND agt.scopes ? 'metrics:write'
          RETURNING
            agt.id,
            agt.server_id AS "serverId",
            s.external_id AS "serverExternalId",
            agt.scopes
        `,
        [hashAgentToken(token)],
      );

      return result.rows[0] ?? null;
    } catch {
      throw new ServiceUnavailableException('Registered agent token lookup is unavailable');
    }
  }
}
