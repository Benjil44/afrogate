// Builds the sidebar NavItemData arrays for each group from the pure view-id
// arrays in nav-views.ts. Icons live here (Sidebar.tsx no longer owns the list).
import { Activity, Archive, Bell, CreditCard, Gauge, LogIn, Network, Route, Router as RouterIcon, ScrollText, Server, Settings as SettingsIcon, Store, Users, UserRound, Waypoints, Workflow } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ActiveView, NavItemData } from './dashboard-types';
import { ADVANCED_VIEWS, MAIN_VIEWS } from './nav-views';

// Exhaustive icon per view (TS errors if a view is missing).
const NAV_ICONS: Record<ActiveView, LucideIcon> = {
  dashboard: Activity,
  servers: Server,
  users: UserRound,
  customers: Users,
  audit: ScrollText,
  backups: Archive,
  billing: CreditCard,
  resellers: Store,
  reports: Gauge,
  routes: Route,
  connections: Network,
  network: Workflow,
  inbounds: LogIn,
  outbounds: Waypoints,
  exits: Waypoints,
  microtiks: RouterIcon,
  alerts: Bell,
  settings: SettingsIcon,
};

function toNavItem(id: ActiveView): NavItemData {
  return { id, labelKey: id, icon: NAV_ICONS[id] };
}

export const MAIN_NAV: NavItemData[] = MAIN_VIEWS.map(toNavItem);
export const ADVANCED_NAV: NavItemData[] = ADVANCED_VIEWS.map(toNavItem);
