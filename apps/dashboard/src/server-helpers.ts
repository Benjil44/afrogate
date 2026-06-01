import type { RouteProbeMetric, ServerAccessMethod, ServerBootstrapState, ServerCredentialKind, WireGuardInterfaceMetric } from '@afrogate/shared';
import type { Tone } from './dashboard-types';
import type { DashboardFormatters } from './formatters';
import type { DashboardStrings } from './i18n';

export function summarizeWireGuardInterfaces(
  interfaces: WireGuardInterfaceMetric[],
  format: DashboardFormatters,
  t: DashboardStrings,
): { label: string; tone: Tone } {
  if (interfaces.length === 0) {
    return { label: t.serverEdit.values.noWireGuardTelemetry, tone: 'neutral' };
  }

  const totalPeers = interfaces.reduce((sum, item) => sum + item.peerCount, 0);
  const activePeers = interfaces.reduce((sum, item) => sum + item.activePeerCount, 0);
  const worstStatus = interfaces.reduce((current, item) => {
    const currentRank = wireGuardStatusRank(current);
    const nextRank = wireGuardStatusRank(item.status);

    return nextRank > currentRank ? item.status : current;
  }, 'up');
  const statusLabel = wireGuardStatusLabel(worstStatus, t);
  const peerSummary = totalPeers > 0
    ? t.serverEdit.values.wireGuardPeerSummary(format.integer(activePeers), format.integer(totalPeers))
    : t.serverEdit.values.wireGuardNoPeers;

  return {
    label: `${statusLabel} / ${peerSummary}`,
    tone: wireGuardTone({ status: worstStatus, peerCount: totalPeers, activePeerCount: activePeers } as WireGuardInterfaceMetric),
  };
}

export function wireGuardTone(item: WireGuardInterfaceMetric): Tone {
  if (item.status === 'up' && item.peerCount > 0 && item.activePeerCount === item.peerCount) return 'good';
  if (item.status === 'degraded' || item.activePeerCount > 0) return 'warning';
  if (item.status === 'down' || item.peerCount > 0) return 'critical';

  return 'neutral';
}

export function wireGuardStatusRank(status: string): number {
  if (status === 'down') return 3;
  if (status === 'degraded') return 2;
  if (status === 'unknown') return 1;

  return 0;
}

export function summarizeRouteProbes(
  probes: RouteProbeMetric[],
  format: DashboardFormatters,
  t: DashboardStrings,
): { label: string; tone: Tone } {
  if (probes.length === 0) {
    return { label: t.serverEdit.values.noProtocolProbes, tone: 'neutral' };
  }

  const criticalCount = probes.filter((probe) => probe.status === 'critical').length;
  const degradedCount = probes.filter((probe) => probe.status === 'degraded').length;
  const healthyCount = probes.filter((probe) => probe.status === 'healthy').length;
  const tone: Tone = criticalCount > 0 ? 'critical' : degradedCount > 0 ? 'warning' : 'good';

  return {
    label: t.serverEdit.values.protocolProbeSummary(
      format.integer(healthyCount),
      format.integer(probes.length),
    ),
    tone,
  };
}

export function wireGuardStatusLabel(status: string, t: DashboardStrings): string {
  if (status === 'up') return t.serverEdit.values.wireGuardStatusUp;
  if (status === 'degraded') return t.serverEdit.values.wireGuardStatusDegraded;
  if (status === 'down') return t.serverEdit.values.wireGuardStatusDown;

  return t.serverEdit.values.wireGuardStatusUnknown;
}

export function inventoryStatusTone(status: string): Tone {
  if (status === 'up' || status === 'healthy') return 'good';
  if (status === 'degraded') return 'warning';
  if (status === 'down' || status === 'critical') return 'critical';

  return 'neutral';
}

export function inventoryStatusLabel(status: string, t: DashboardStrings): string {
  if (status === 'up' || status === 'healthy') return t.serverEdit.values.statusUp;
  if (status === 'degraded') return t.serverEdit.values.statusDegraded;
  if (status === 'down' || status === 'critical') return t.serverEdit.values.statusDown;

  return t.serverEdit.values.statusUnknown;
}

export function formatWireGuardPeerSummary(
  item: WireGuardInterfaceMetric,
  format: DashboardFormatters,
  t: DashboardStrings,
): string {
  return item.peerCount > 0
    ? t.serverEdit.values.wireGuardPeerSummary(format.integer(item.activePeerCount), format.integer(item.peerCount))
    : t.serverEdit.values.wireGuardNoPeers;
}

export function formatWireGuardHandshake(
  item: WireGuardInterfaceMetric,
  format: DashboardFormatters,
  t: DashboardStrings,
): string {
  return typeof item.latestHandshakeAgeSeconds === 'number'
    ? t.serverEdit.values.latestHandshakeAge(format.durationSeconds(item.latestHandshakeAgeSeconds))
    : t.serverEdit.values.noHandshake;
}

export function isServerAccessMethod(value: unknown): value is ServerAccessMethod {
  return value === 'ssh_key' ||
    value === 'temporary_root_password' ||
    value === 'temporary_root_key' ||
    value === 'existing_admin_key';
}

export function isServerBootstrapState(value: unknown): value is ServerBootstrapState {
  return value === 'not_started' ||
    value === 'pending' ||
    value === 'installed' ||
    value === 'failed' ||
    value === 'revoked';
}

export function isServerCredentialKind(value: unknown): value is ServerCredentialKind {
  return value === 'ssh_private_key' ||
    value === 'ssh_password' ||
    value === 'api_token';
}
