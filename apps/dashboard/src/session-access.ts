import type { AdminSessionResponse, Role } from '@afrogate/shared';

export const managedAdminRoles: Role[] = ['owner', 'admin', 'supervisor', 'support', 'auditor', 'reseller'];

export function canViewAdminUsers(session: AdminSessionResponse): boolean {
  return ['superadmin', 'owner', 'admin'].includes(session.actor.role);
}

export function canManageAdminUsers(session: AdminSessionResponse): boolean {
  return (session.actor.role === 'superadmin' && session.actor.isSuperAdmin === true) || session.actor.role === 'owner';
}

export function canViewAuditLogs(session: AdminSessionResponse): boolean {
  return ['superadmin', 'owner', 'admin', 'supervisor', 'auditor'].includes(session.actor.role);
}

export function canViewBackupStatus(session: AdminSessionResponse): boolean {
  return ['superadmin', 'owner', 'admin', 'supervisor', 'auditor'].includes(session.actor.role);
}

export function canViewReports(session: AdminSessionResponse): boolean {
  return ['superadmin', 'owner', 'admin', 'supervisor', 'auditor'].includes(session.actor.role);
}
