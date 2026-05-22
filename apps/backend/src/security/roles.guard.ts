import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@afrogate/shared';
import type { RequestWithAuth } from './auth-request';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const actor = request.actor;

    if (!actor || actor.type !== 'admin') {
      throw new ForbiddenException('Admin role is required');
    }

    if (actor.role === 'owner' || requiredRoles.includes(actor.role)) return true;

    throw new ForbiddenException('Insufficient role');
  }
}
