import { SetMetadata } from '@nestjs/common';
import type { AdminPermissionId, Role } from '@afrows/shared';

export const ROLES_KEY = 'afrows:roles';
export const PERMISSIONS_KEY = 'afrows:permissions';

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
export const Permissions = (...permissions: AdminPermissionId[]) => SetMetadata(PERMISSIONS_KEY, permissions);
