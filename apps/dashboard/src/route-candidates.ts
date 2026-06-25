import type { LoadBalanceStrategy, RouteSelectionMode } from '@afrows/shared';
import type { WireGuardHealthCandidate } from './dashboard-types';
import type { DashboardStrings } from './i18n';

// Sample fallback candidates shown when the API returns none. Moved verbatim from
// SettingsPage; `endpoint` lets the WireGuard-setup form override the primary's label.
export function buildSampleWireGuardCandidates(
  t: DashboardStrings,
  endpoint?: string,
): WireGuardHealthCandidate[] {
  return [
    {
      id: 'wg-primary', name: t.settings.primaryGateway,
      endpoint: (endpoint && endpoint.trim()) || 'gateway.example.com:51820',
      routeGroup: 'main', healthStatus: 'healthy', score: 92, latencyMs: 48, jitterMs: 5,
      packetLossPercent: 0.1, loadPercent: 42, checkedAt: null, source: 'sample',
    },
    {
      id: 'wg-backup', name: t.settings.backupGateway, endpoint: 'backup.example.com:51820',
      routeGroup: 'main', healthStatus: 'healthy', score: 84, latencyMs: 63, jitterMs: 9,
      packetLossPercent: 0.3, loadPercent: 31, checkedAt: null, source: 'sample',
    },
    {
      id: 'wg-control', name: t.settings.controlGateway, endpoint: 'control.example.com:51820',
      routeGroup: 'main', healthStatus: 'degraded', score: 71, latencyMs: 88, jitterMs: 15,
      packetLossPercent: 0.7, loadPercent: 58, checkedAt: null, source: 'sample',
    },
  ];
}

export function pickWireGuardCandidates(
  api: WireGuardHealthCandidate[],
  sample: WireGuardHealthCandidate[],
): WireGuardHealthCandidate[] {
  return api.length > 0 ? api : sample;
}

export function deriveActiveWireGuard(
  candidates: WireGuardHealthCandidate[],
  routeMode: RouteSelectionMode,
  selectedWireGuardId: string,
): { best: WireGuardHealthCandidate; selected: WireGuardHealthCandidate; active: WireGuardHealthCandidate } {
  const best = candidates.reduce((b, c) => (c.score > b.score ? c : b), candidates[0]);
  const selected = candidates.find((c) => c.id === selectedWireGuardId) ?? best;
  const active = routeMode === 'manual' ? selected : best;
  return { best, selected, active };
}

// Re-export so callers have one import site for the load-balance option list shape.
export type { LoadBalanceStrategy };
