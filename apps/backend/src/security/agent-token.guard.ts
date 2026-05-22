import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { RequestWithAuth } from './auth-request';
import { readBearerToken, secureTokenEquals } from './bearer-token';

@Injectable()
export class AgentTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expectedToken = process.env.AFROGATE_AGENT_TOKEN;

    if (!expectedToken || expectedToken === 'change-me-local-token') {
      throw new ServiceUnavailableException('Agent token is not configured');
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const token = readBearerToken(request.headers.authorization);

    if (!secureTokenEquals(token, expectedToken)) {
      throw new UnauthorizedException('Invalid agent token');
    }

    request.actor = {
      id: process.env.AFROGATE_AGENT_ID ?? 'unknown-agent',
      role: 'agent',
      type: 'agent',
    };

    return true;
  }
}
