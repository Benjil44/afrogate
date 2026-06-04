import { BadRequestException } from '@nestjs/common';
import type { CurrentPanelVolumeChargeScope } from '@afrows/shared';

export const CURRENT_PANEL_VOLUME_CHARGE_SCOPES = new Set<CurrentPanelVolumeChargeScope>([
  'account_quota',
  'selected_clients',
  'account_and_selected_clients',
]);

export const CLIENT_USAGE_EVENT_SOURCES = new Set([
  'admin',
  'agent',
  'panel_sync',
  'payment_adjustment',
  'manual_adjustment',
  'client_report',
  'unknown',
]);

export const CLIENT_USAGE_DIRECTIONS = new Set(['rx', 'tx', 'combined']);

function nullableString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/** Normalizes a client-usage event source, defaulting to `admin`; throws on an unknown source. */
export function normalizeClientUsageSource(value: string | undefined): string {
  const normalized = nullableString(value)?.toLowerCase() ?? 'admin';
  if (!CLIENT_USAGE_EVENT_SOURCES.has(normalized)) throw new BadRequestException('Invalid client usage source');
  return normalized;
}

/** Normalizes a client-usage direction, defaulting to `combined`; throws on an unknown direction. */
export function normalizeClientUsageDirection(value: string | undefined): string {
  const normalized = nullableString(value)?.toLowerCase() ?? 'combined';
  if (!CLIENT_USAGE_DIRECTIONS.has(normalized)) throw new BadRequestException('Invalid client usage direction');
  return normalized;
}

/** Normalizes a current-panel volume-charge scope, defaulting to `account_quota`; throws on an unknown scope. */
export function normalizeCurrentPanelVolumeChargeScope(
  value: string | null | undefined,
): CurrentPanelVolumeChargeScope {
  const normalized = nullableString(value) ?? 'account_quota';
  if (!CURRENT_PANEL_VOLUME_CHARGE_SCOPES.has(normalized as CurrentPanelVolumeChargeScope)) {
    throw new BadRequestException('Invalid current panel volume charge scope');
  }
  return normalized as CurrentPanelVolumeChargeScope;
}

/** Trims, de-duplicates, drops blanks, and sorts a list of charge client ids. */
export function normalizeCurrentPanelChargeClientIds(value: string[]): string[] {
  return Array.from(new Set(value.map((id) => id.trim()).filter(Boolean))).sort();
}
