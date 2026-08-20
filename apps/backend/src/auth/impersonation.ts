import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Role } from '@afrows/shared';

/**
 * Pure authorization rules for superadmin "Sign in as seller" impersonation, kept
 * free of Nest DI so the node --test runner can exercise them directly.
 *
 * Two invariants: only a real superadmin may impersonate, and only an ACTIVE
 * `reseller`-role login user may be the target. Everything else throws — a session
 * is never minted for a non-reseller (e.g. another admin) or an inactive account.
 */

export interface ImpersonationCaller {
  type: 'admin' | 'agent' | 'client';
  role: Role;
  isSuperAdmin?: boolean;
}

export interface ImpersonationTargetAccount {
  id: string;
  username: string;
  role: Role;
  status: 'active' | 'disabled';
  isSuperAdmin: boolean;
}

/**
 * Assert the caller may impersonate the target reseller. Throws ForbiddenException
 * (caller not superadmin, or target not an active reseller) / NotFoundException
 * (no such target). Narrows `target` to non-undefined on success.
 */
export function assertCanImpersonateReseller(
  caller: ImpersonationCaller | undefined,
  target: ImpersonationTargetAccount | undefined,
): asserts target is ImpersonationTargetAccount {
  if (!caller || caller.type !== 'admin' || caller.role !== 'superadmin' || caller.isSuperAdmin !== true) {
    throw new ForbiddenException('Superadmin access is required to sign in as a seller');
  }
  if (!target) {
    throw new NotFoundException('Seller login user was not found');
  }
  if (target.role !== 'reseller') {
    throw new ForbiddenException('Only reseller users can be impersonated');
  }
  if (target.status !== 'active') {
    throw new ForbiddenException('Seller login user is not active');
  }
}
