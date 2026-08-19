// Single source of truth for whether E2E should exercise the Persian (fa) UI.
//
// This reuses the SAME authoritative flag the dashboard application itself uses
// to gate Persian — apps/dashboard/src/i18n.ts › LANGUAGE_TOGGLE_ENABLED — so
// there is no second, test-only "Persian disabled" switch that could drift out
// of sync with the product. When Persian is re-enabled in the app (the flag
// flips to true), the guarded fa E2E cases automatically start running again;
// no test change is required.
import { LANGUAGE_TOGGLE_ENABLED } from '../../../apps/dashboard/src/i18n';

export const PERSIAN_ENABLED: boolean = LANGUAGE_TOGGLE_ENABLED;

export const PERSIAN_DISABLED_SKIP_REASON =
  'Persian is intentionally disabled in this build ' +
  '(apps/dashboard/src/i18n.ts › LANGUAGE_TOGGLE_ENABLED = false); ' +
  'the fa E2E cases run automatically when Persian is re-enabled.';
