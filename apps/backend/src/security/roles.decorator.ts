import { SetMetadata } from '@nestjs/common';
import type { AdminPermissionId, Role } from '@afrogate/shared';

export const ROLES_KEY = 'afrogate:roles';
export const PERMISSIONS_KEY = 'afrogate:permissions';

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
export const Permissions = (...permissions: AdminPermissionId[]) => SetMetadata(PERMISSIONS_KEY, permissions);
