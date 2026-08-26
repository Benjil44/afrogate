// Source of truth for the grouped sidebar (IA restructure). Pure data + the
// collapsed-groups localStorage helpers. NO runtime imports — only a type
// import — so this module is loadable by `node --test` (no path-alias /
// lucide barrel).
import type { ActiveView } from './dashboard-types';

/** The seven top-level sidebar groups, in display order. */
export type NavGroupId =
  | 'overview'
  | 'customers'
  | 'revenue'
  | 'infrastructure'
  | 'observability'
  | 'automation'
  | 'settings';

/**
 * Unique sidebar-entry ids. Each is also the `t.nav` label key. An entry may
 * deep-link into a tab of a wrapper page (`tab`), which is why ids are not
 * always the same as the view id (e.g. `exits-routing` → view `exits`,
 * tab `routing`).
 */
export type NavEntryId =
  | 'dashboard'
  | 'reports'
  | 'customers'
  | 'microtiks'
  | 'pricing'
  | 'billing'
  | 'resellers'
  | 'topups'
  | 'reseller-topups'
  | 'servers'
  | 'exits'
  | 'exits-sources'
  | 'exits-routing'
  | 'network'
  | 'alerts'
  | 'audit'
  | 'telegram-bot'
  | 'settings'
  | 'users'
  | 'backups';

export interface NavEntry {
  id: NavEntryId;
  view: ActiveView;
  /** Canonical `?tab=` value for entries that address a tab inside a wrapper page. */
  tab?: string;
}

export interface NavGroupDef {
  id: NavGroupId;
  entries: NavEntry[];
}

/**
 * Admin sidebar tree (CTO IA plan): Overview + 6 groups. Every feature has
 * exactly ONE nav entry; wrapper-page tabs are addressed via `tab` so each
 * feature also has exactly one URL.
 */
export const NAV_GROUPS: NavGroupDef[] = [
  {
    id: 'overview',
    entries: [
      { id: 'dashboard', view: 'dashboard' },
      { id: 'reports', view: 'reports' },
    ],
  },
  {
    id: 'customers',
    entries: [
      { id: 'customers', view: 'customers' },
      { id: 'microtiks', view: 'microtiks' },
      { id: 'pricing', view: 'pricing' },
    ],
  },
  {
    id: 'revenue',
    entries: [
      { id: 'billing', view: 'billing' },
      { id: 'resellers', view: 'resellers' },
      { id: 'topups', view: 'topups' },
      { id: 'reseller-topups', view: 'reseller-topups' },
    ],
  },
  {
    id: 'infrastructure',
    entries: [
      { id: 'servers', view: 'servers' },
      { id: 'exits', view: 'exits', tab: 'egress' },
      { id: 'exits-sources', view: 'exits', tab: 'sources' },
      { id: 'exits-routing', view: 'exits', tab: 'routing' },
      { id: 'network', view: 'network' },
    ],
  },
  {
    id: 'observability',
    entries: [
      { id: 'alerts', view: 'alerts' },
      { id: 'audit', view: 'audit' },
    ],
  },
  {
    id: 'automation',
    entries: [
      { id: 'telegram-bot', view: 'settings', tab: 'telegram' },
    ],
  },
  {
    id: 'settings',
    entries: [
      { id: 'settings', view: 'settings' },
      { id: 'users', view: 'users' },
      { id: 'backups', view: 'backups' },
    ],
  },
];

/**
 * Reseller sidebar tree: Overview + their Customers + Revenue only. The
 * reseller "Customers" entry points at the `users` view, which renders
 * ResellerUsersPage (their customer list) for reseller sessions.
 */
export const RESELLER_NAV_GROUPS: NavGroupDef[] = [
  { id: 'overview', entries: [{ id: 'dashboard', view: 'dashboard' }] },
  { id: 'customers', entries: [{ id: 'customers', view: 'users' }] },
  { id: 'revenue', entries: [{ id: 'billing', view: 'billing' }] },
];

/**
 * Views that are still routable but no longer have their own page: each one
 * now lives as a tab inside a wrapper page. The router rewrites these URLs
 * (replaceState) to the canonical `/view?tab=` URL so every feature keeps
 * exactly ONE address and old bookmarks never 404.
 */
export const ORPHAN_VIEW_REDIRECTS: Partial<Record<ActiveView, { view: ActiveView; tab: string }>> = {
  routes: { view: 'exits', tab: 'routing' },
  outbounds: { view: 'exits', tab: 'egress' },
  inbounds: { view: 'network', tab: 'inbounds' },
  connections: { view: 'network', tab: 'connections' },
};

/**
 * Resolve which sidebar entry is active for the current view + `?tab=`.
 * Preference order: exact (view, tab) match → the view's tab-less entry →
 * the view's first entry (so `/exits` with no tab highlights "Exits").
 */
export function activeNavEntryId(
  groups: NavGroupDef[],
  view: ActiveView,
  tab: string | null,
): NavEntryId | null {
  const entries = groups.flatMap((group) => group.entries).filter((entry) => entry.view === view);
  if (entries.length === 0) return null;

  const exact = entries.find((entry) => (entry.tab ?? null) === tab);
  if (exact) return exact.id;

  const untabbed = entries.find((entry) => entry.tab === undefined);
  return (untabbed ?? entries[0]).id;
}

// Persisted per-admin collapsed groups. Mirrors the sidebar/kiosk
// localStorage pattern in DashboardApp.tsx.
export const collapsedGroupsStorageKey = 'afrows.dashboard.nav-collapsed';

const ALL_GROUP_IDS: NavGroupId[] = ['overview', 'customers', 'revenue', 'infrastructure', 'observability', 'automation', 'settings'];

export function parseCollapsedGroups(stored: string | null): NavGroupId[] {
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return ALL_GROUP_IDS.filter((id) => parsed.includes(id));
  } catch {
    return [];
  }
}

export function serializeCollapsedGroups(collapsed: NavGroupId[]): string {
  return JSON.stringify(ALL_GROUP_IDS.filter((id) => collapsed.includes(id)));
}
