// Source of truth for the two sidebar groups (sub-project A). Pure data + the
// Advanced-mode localStorage helpers. NO runtime imports — only a type import —
// so this module is loadable by `node --test` (no path-alias / lucide barrel).
import type { ActiveView } from './dashboard-types';

// Main: everyday business tasks. Always visible.
export const MAIN_VIEWS: ActiveView[] = [
  'dashboard', 'customers', 'billing', 'exits', 'alerts', 'users', 'settings',
];

// Advanced: raw infrastructure / xray plumbing. Visible only when Advanced mode is ON.
export const ADVANCED_VIEWS: ActiveView[] = [
  'servers', 'inbounds', 'connections', 'audit', 'backups', 'reports',
];

// Persisted per-admin toggle. Mirrors the kiosk-mode pattern in DashboardApp.tsx.
export const advancedModeStorageKey = 'afrows.dashboard.advanced';

export function parseAdvancedMode(stored: string | null): boolean {
  return stored === 'enabled';
}

export function serializeAdvancedMode(enabled: boolean): string {
  return enabled ? 'enabled' : 'disabled';
}
