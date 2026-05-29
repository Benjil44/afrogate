import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { AdminUserStatus, Role } from '@afrogate/shared';

const MANAGED_ADMIN_ROLES: Role[] = ['owner', 'admin', 'supervisor', 'support', 'auditor', 'reseller'];
const ADMIN_USER_STATUSES: AdminUserStatus[] = ['active', 'disabled'];

export class CreateAdminUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  username!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(256)
  password!: string;

  @IsIn(MANAGED_ADMIN_ROLES)
  role!: Role;

  @IsOptional()
  @IsIn(ADMIN_USER_STATUSES)
  status?: AdminUserStatus;
}

export class UpdateAdminUserDto {
  @IsOptional()
  @IsIn(MANAGED_ADMIN_ROLES)
  role?: Role;

  @IsOptional()
  @IsIn(ADMIN_USER_STATUSES)
  status?: AdminUserStatus;
}

export class UpdateAdminUserPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  password!: string;
}
