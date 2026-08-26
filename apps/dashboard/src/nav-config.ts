// Builds the icon-bearing sidebar tree from the pure group/entry data in
// nav-views.ts, and filters it per session (role + permissions). Icons live
// here so nav-views.ts stays loadable by `node --test`.
import { Activity, Archive, Bell, Bot, CreditCard, Coins, Gauge, Receipt, Route, Router as RouterIcon, ScrollText, Server, Settings as SettingsIcon, Store, Users, UserRound, Wallet, Waypoints, Workflow } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AdminSessionResponse } from '@afrows/shared';
import { NAV_GROUPS, RESELLER_NAV_GROUPS, type NavEntry, type NavEntryId, type NavGroupId } from './nav-views';
import { canViewAdminUsers, canViewAuditLogs, canViewBackupStatus, canViewReports } from './session-access';

export interface SidebarNavItem extends NavEntry {
  icon: LucideIcon;
}

export interface SidebarNavGroup {
  id: NavGroupId;
  items: SidebarNavItem[];
}

// Exhaustive icon per sidebar entry (TS errors if an entry is missing).
const NAV_ICONS: Record<NavEntryId, LucideIcon> = {
  dashboard: Activity,
  reports: Gauge,
  customers: Users,
  microtiks: RouterIcon,
  pricing: Coins,
  billing: CreditCard,
  resellers: Store,
  topups: Receipt,
  'reseller-topups': Wallet,
  servers: Server,
  exits: Waypoints,
  'exits-sources': RouterIcon,
  'exits-routing': Route,
  network: Workflow,
  alerts: Bell,
  audit: ScrollText,
  'telegram-bot': Bot,
  settings: SettingsIcon,
  users: UserRound,
  backups: Archive,
};

function withIcons(groups: typeof NAV_GROUPS): SidebarNavGroup[] {
  return groups.map((group) => ({
    id: group.id,
    items: group.entries.map((entry) => ({ ...entry, icon: NAV_ICONS[entry.id] })),
  }));
}

export const SIDEBAR_GROUPS: SidebarNavGroup[] = withIcons(NAV_GROUPS);
export const RESELLER_SIDEBAR_GROUPS: SidebarNavGroup[] = withIcons(RESELLER_NAV_GROUPS);

function isSuperAdmin(session: AdminSessionResponse): boolean {
  return session.actor.role === 'superadmin' || session.actor.isSuperAdmin === true;
}

function entryVisible(item: SidebarNavItem, session: AdminSessionResponse): boolean {
  if (item.id === 'users') return canViewAdminUsers(session);
  if (item.id === 'audit') return canViewAuditLogs(session);
  if (item.id === 'backups') return canViewBackupStatus(session);
  if (item.id === 'reports') return canViewReports(session);
  if (item.id === 'pricing') return isSuperAdmin(session);
  return true;
}

/**
 * The sidebar tree for a session: resellers get the scoped 3-group tree
 * (Overview + their Customers + Revenue); admins get the full tree filtered
 * by their per-entry permissions. Groups left empty are dropped.
 */
export function visibleNavGroups(session: AdminSessionResponse): SidebarNavGroup[] {
  const groups = session.actor.role === 'reseller' ? RESELLER_SIDEBAR_GROUPS : SIDEBAR_GROUPS;
  return groups
    .map((group) => ({ ...group, items: group.items.filter((item) => entryVisible(item, session)) }))
    .filter((group) => group.items.length > 0);
}
