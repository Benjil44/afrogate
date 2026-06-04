import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { roleHasPermission, type AdminPermissionId, type Role } from '@afrows/shared';
import type { RequestWithAuth } from './auth-request';
import { PERMISSIONS_KEY, ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredPermissions = this.reflector.getAllAndOverride<AdminPermissionId[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length && !requiredPermissions?.length) return true;

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const actor = request.actor;

    if (!actor || actor.type !== 'admin') {
      throw new ForbiddenException('Admin role is required');
    }

    const roleAllowed = !requiredRoles?.length
      || actor.role === 'superadmin'
      || actor.role === 'owner'
      || requiredRoles.includes(actor.role);
    const permissionsAllowed = !requiredPermissions?.length
      || requiredPermissions.every((permission) => roleHasPermission(actor.role, permission));

    if (roleAllowed && permissionsAllowed) return true;

    throw new ForbiddenException('Insufficient role');
  }
}
