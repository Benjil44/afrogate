import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { RequestWithAuth } from './auth-request';
import { checkEdgeToken } from './edge-token';

/**
 * Guards the Germany edge-sync endpoints. Authorized iff the request's
 * `Authorization: Bearer <token>` equals `AFROWS_EDGE_TOKEN` (constant-time
 * compare, see checkEdgeToken). When `AFROWS_EDGE_TOKEN` is unset/empty the
 * whole edge surface is inert: EVERY request is rejected (503), so the
 * endpoints stay dark until an operator configures the shared secret. Never
 * logs the token.
 */
@Injectable()
export class EdgeTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const result = checkEdgeToken(request.headers.authorization, process.env.AFROWS_EDGE_TOKEN);

    if (result.ok) return true;
    if (result.reason === 'unconfigured') {
      throw new ServiceUnavailableException('Edge sync is not configured');
    }
    if (result.reason === 'missing') {
      throw new UnauthorizedException('Edge token is required');
    }
    throw new UnauthorizedException('Invalid edge token');
  }
}
