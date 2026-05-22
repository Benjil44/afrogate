import { SetMetadata } from '@nestjs/common';
import type { Role } from '@afrogate/shared';

export const ROLES_KEY = 'afrogate:roles';

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
