import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Role } from '@afrogate/shared';
import type { RequestWithAuth } from './auth-request';
import { readBearerToken, secureTokenEquals } from './bearer-token';

const DEFAULT_ADMIN_TOKEN = 'change-me-admin-token';
const SUPPORTED_ADMIN_ROLES = new Set<Role>(['owner', 'admin', 'support', 'auditor']);

@Injectable()
export class AdminTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expectedToken = process.env.AFROGATE_ADMIN_TOKEN;

    if (!expectedToken || expectedToken === DEFAULT_ADMIN_TOKEN) {
      throw new ServiceUnavailableException('Admin token is not configured');
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const token = readBearerToken(request.headers.authorization);

    if (!secureTokenEquals(token, expectedToken)) {
      throw new UnauthorizedException('Invalid admin token');
    }

    request.actor = {
      id: process.env.AFROGATE_ADMIN_ID ?? 'bootstrap-admin',
      role: this.resolveRole(),
      type: 'admin',
    };

    return true;
  }

  private resolveRole(): Role {
    const role = process.env.AFROGATE_ADMIN_ROLE;

    return role && SUPPORTED_ADMIN_ROLES.has(role as Role) ? role as Role : 'owner';
  }
}
