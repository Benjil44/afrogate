import type {
  AdminAlertSummary,
  AdminIncidentTimelineEvent,
  AdminOutboundSummary,
  AdminServerSummary,
  AdminTunnelSummary,
  RouteFailoverEventSummary,
  ServerMetricSnapshot,
} from '@afrows/shared';
import type {
  AlertRowData,
  MetricCardData,
  OutboundRowData,
  RouteFailoverRowData,
  ServerRowData,
  SidebarAlertState,
  Tone,
  TrafficTotals,
  TunnelRowData,
} from './dashboard-types';
import {
  createStorageFallback,
  normalizePercent,
  normalizePositive,
  sumNullable,
  type DashboardFormatters,
} from './formatters';
import type { DashboardStrings } from './i18n';

export function mapSnapshotToServerRow(snapshot: ServerMetricSnapshot): ServerRowData {
  return {
    id: snapshot.serverId,
    externalId: snapshot.serverId,
    name: snapshot.hostname || snapshot.serverId,
    meta: snapshot.platform || snapshot.serverId,
    cpu: normalizePercent(snapshot.cpuPercent),
    ram: normalizePercent(snapshot.ramPercent),
    diskFree: normalizePercent(snapshot.diskFreePercent),
    storages: snapshot.storages ?? createStorageFallback(snapshot.diskFreePercent),
    networkInterfaces: snapshot.networkInterfaces ?? [],
    wireGuardInterfaces: snapshot.wireGuardInterfaces ?? [],
    routeProbes: snapshot.routeProbes ?? [],
    inboundBps: normalizePositive(snapshot.inboundBps),
    outboundBps: normalizePositive(snapshot.outboundBps),
    pingMs: normalizePositive(snapshot.pingMs),
    jitterMs: normalizePositive(snapshot.jitterMs),
    packetLossPercent: normalizePercent(snapshot.packetLossPercent),
    score: snapshot.healthScore,
    observedAt: snapshot.observedAt,
    source: 'metrics',
  };
}

export function mapAdminServerToServerRow(server: AdminServerSummary): ServerRowData {
  if (server.latestMetric) {
    const row = mapSnapshotToServerRow(server.latestMetric);

    return {
      ...row,
      id: server.id,
      externalId: server.externalId,
      name: server.hostname || server.externalId,
      meta: createServerMeta(server),
      status: server.status,
      role: server.role,
      region: server.region,
      tags: server.tags,
      accessProfile: server.accessProfile,
      outboundCount: server.outboundCount,
      openAlertCount: server.openAlertCount,
      observedAt: server.latestMetric.observedAt || server.lastSeenAt,
      updatedAt: server.updatedAt,
      source: 'admin',
    };
  }

  return {
    id: server.id,
    externalId: server.externalId,
    name: server.hostname || server.externalId,
    meta: createServerMeta(server),
    status: server.status,
    role: server.role,
    region: server.region,
    tags: server.tags,
    cpu: null,
    ram: null,
    diskFree: null,
    storages: [],
    networkInterfaces: [],
    wireGuardInterfaces: [],
    routeProbes: [],
    inboundBps: null,
    outboundBps: null,
    pingMs: null,
    jitterMs: null,
    packetLossPercent: null,
    score: scoreFromHealthState(server.status),
    observedAt: server.lastSeenAt,
    accessProfile: server.accessProfile,
    outboundCount: server.outboundCount,
    openAlertCount: server.openAlertCount,
    updatedAt: server.updatedAt,
    source: 'admin',
  };
}

export function createServerMeta(server: AdminServerSummary): string {
  return [server.country, server.region].filter(Boolean).join(' / ') || server.platform || server.externalId;
}

export function scoreFromHealthState(status: string): number {
  if (status === 'healthy') return 90;
  if (status === 'degraded') return 60;
  if (status === 'critical') return 25;
  return 50;
}

export function mapAdminOutboundToRow(outbound: AdminOutboundSummary): OutboundRowData {
  const statusText = outbound.maintenanceMode
    ? 'maintenance'
    : outbound.enabled
      ? outbound.healthStatus
      : 'disabled';

  return {
    id: outbound.id,
    name: outbound.name,
    type: outbound.type,
    priority: outbound.priority,
    statusText,
    statusTone: mapOutboundStatusToTone(statusText),
    latencyMs: null,
    mode: outbound.routeGroup,
    usageMultiplier: outbound.usageMultiplier ?? 1,
    serverLabel: outbound.serverHostname || outbound.serverExternalId,
  };
}

export function mapAdminTunnelToRow(tunnel: AdminTunnelSummary): TunnelRowData {
  return {
    id: tunnel.id,
    name: tunnel.name,
    operator: tunnel.interfaceOperator || tunnel.localInterfaceName || tunnel.interfaceName || tunnel.serverHostname || tunnel.serverExternalId || tunnel.type,
    ping: null,
    jitter: null,
    loss: null,
    score: scoreFromTunnelStatus(tunnel.status),
    type: tunnel.type,
    serverLabel: tunnel.serverHostname || tunnel.serverExternalId,
    routeGroup: tunnel.routeGroup,
    status: tunnel.status,
    lockable: tunnel.lockable,
    localInterfaceName: tunnel.localInterfaceName,
    interfaceName: tunnel.interfaceName,
    remoteEndpoint: tunnel.remoteEndpoint,
    updatedAt: tunnel.updatedAt,
  };
}

export function scoreFromTunnelStatus(status: string): number {
  if (status === 'up') return 90;
  if (status === 'down') return 25;
  if (status === 'degraded') return 60;
  return scoreFromHealthState(status);
}

export function mapOutboundStatusToTone(status: string): Tone {
  if (status === 'healthy') return 'good';
  if (status === 'critical') return 'critical';
  if (status === 'degraded' || status === 'maintenance') return 'warning';
  return 'neutral';
}

export function mapRouteFailoverEventToRow(event: RouteFailoverEventSummary): RouteFailoverRowData {
  return {
    id: event.id,
    title: event.routeGroup,
    detail: event.reason,
    tone: 'neutral',
    createdAt: event.createdAt,
  };
}

export function createFallbackFailoverRows(t: DashboardStrings): RouteFailoverRowData[] {
  return [
    { id: 'sample-primary-route-healthy', title: 'Germany gateway', detail: t.failover.primaryRouteHealthy, tone: 'good' },
    { id: 'sample-standby-telegram-api', title: 'Control egress', detail: t.failover.standbyTelegramApi, tone: 'neutral' },
    { id: 'sample-restricted-internet-path', title: 'Iran direct', detail: t.failover.restrictedInternetPath, tone: 'warning' },
  ];
}

export function createSummary(
  servers: ServerRowData[],
  trafficTotals: TrafficTotals,
  alerts: AlertRowData[],
  t: DashboardStrings,
  format: DashboardFormatters,
  activeUsersOverride?: number | null,
): MetricCardData[] {
  const criticalAlerts = alerts.filter((alert) => !alert.isPlaceholder && alert.severity === 'critical').length;
  const activeUsers = activeUsersOverride ?? countActiveUsers(servers);

  return [
    { label: t.summary.activeUsers, value: format.integer(activeUsers), tone: 'neutral' },
    { label: t.summary.downloadNow, value: format.bytesPerSecond(trafficTotals.downloadBps), tone: 'good' },
    { label: t.summary.uploadNow, value: format.bytesPerSecond(trafficTotals.uploadBps), tone: 'neutral' },
    { label: t.summary.criticalAlerts, value: format.integer(criticalAlerts), tone: criticalAlerts > 0 ? 'critical' : 'good' },
  ];
}

export function createTrafficTotals(servers: ServerRowData[]): TrafficTotals {
  return {
    downloadBps: sumNullable(servers.map((server) => server.inboundBps)),
    uploadBps: sumNullable(servers.map((server) => server.outboundBps)),
  };
}

/**
 * Active users online = currently-connected WireGuard peers across all servers.
 * Returns 0 when no servers report in, so the dashboard shows the honest state
 * instead of a placeholder figure.
 */
export function countActiveUsers(servers: ServerRowData[]): number {
  return servers.reduce(
    (total, server) =>
      total + server.wireGuardInterfaces.reduce((sum, wg) => sum + (wg.activePeerCount ?? 0), 0),
    0,
  );
}

export function createComputedAlertRows(servers: ServerRowData[], t: DashboardStrings): AlertRowData[] {
  const rows: AlertRowData[] = [];

  for (const server of servers) {
    if (server.diskFree !== null && server.diskFree < 10) {
      rows.push({
        id: `${server.id}-storage`,
        title: t.alerts.storageBelow,
        source: server.name,
        severity: 'critical',
      });
    }

    if (server.score < 60) {
      rows.push({
        id: `${server.id}-health`,
        title: t.alerts.healthScoreDegraded,
        source: server.name,
        severity: server.score < 40 ? 'critical' : 'warning',
      });
    }
  }

  if (rows.length > 0) return rows.slice(0, 4);

  return [
    { id: 'sample-no-critical-alerts', title: t.alerts.noCriticalServerAlerts, source: t.alerts.monitoring, severity: 'good', isPlaceholder: true },
    { id: 'sample-outbound-failover-ready', title: t.alerts.outboundFailoverReady, source: t.alerts.routes, severity: 'neutral', isPlaceholder: true },
    { id: 'sample-backup-monitor-pending', title: t.alerts.backupMonitorPending, source: t.alerts.controlPlane, severity: 'warning', isPlaceholder: true },
  ];
}

export function mapAdminAlertsToRows(alerts: AdminAlertSummary[], t: DashboardStrings): AlertRowData[] {
  return alerts.map((alert) => ({
    id: alert.id,
    title: localizeAlertTitle(alert.title, t),
    source: alert.sourceLabel || alert.sourceId,
    severity: mapAlertSeverityToTone(alert.severity),
    message: alert.message,
    status: alert.status,
    lastSeenAt: alert.lastSeenAt,
    resolvedAt: alert.resolvedAt,
  }));
}

export function createNoOpenAlertsRow(t: DashboardStrings): AlertRowData {
  return {
    id: 'no-open-alerts',
    title: t.alerts.noOpenAlerts,
    source: t.alerts.monitoring,
    severity: 'good',
    isPlaceholder: true,
  };
}

export function localizeAlertTitle(title: string, t: DashboardStrings): string {
  const normalizedTitle = title.trim().toLowerCase();

  if (normalizedTitle === 'storage below 10%') return t.alerts.storageBelow;
  if (normalizedTitle === 'health score degraded') return t.alerts.healthScoreDegraded;

  return title;
}

export function incidentTimelineEventTitle(event: AdminIncidentTimelineEvent, t: DashboardStrings): string {
  const kind = incidentTimelineKindLabel(event.kind, t);

  if (event.kind === 'alert_opened' || event.kind === 'alert_resolved') {
    return `${kind}: ${localizeAlertTitle(event.title, t)}`;
  }

  return kind;
}

export function incidentTimelineEventDetail(
  event: AdminIncidentTimelineEvent,
  format: DashboardFormatters,
  t: DashboardStrings,
): string {
  const details = [
    event.detail,
    event.outboundName ? `${t.incidentTimeline.outbound}: ${format.label(event.outboundName)}` : null,
    event.status ? `${t.tables.status}: ${format.label(event.status)}` : null,
  ].filter((item): item is string => Boolean(item));

  return details.join(' / ') || format.label(event.kind);
}

export function incidentTimelineKindLabel(kind: string, t: DashboardStrings): string {
  switch (kind) {
    case 'alert_opened':
      return t.incidentTimeline.kinds.alertOpened;
    case 'alert_resolved':
      return t.incidentTimeline.kinds.alertResolved;
    case 'route_assignment':
      return t.incidentTimeline.kinds.routeAssignment;
    case 'route_decision':
      return t.incidentTimeline.kinds.routeDecision;
    default:
      return t.incidentTimeline.kinds.event;
  }
}

export function incidentTimelineSeverityTone(severity: string): Tone {
  if (severity === 'critical') return 'critical';
  if (severity === 'warning') return 'warning';

  return 'neutral';
}

export function mapAlertSeverityToTone(severity: string): Tone {
  if (severity === 'critical') return 'critical';
  if (severity === 'warning') return 'warning';
  if (severity === 'healthy' || severity === 'good') return 'good';

  return 'neutral';
}

export function countActiveAlertRows(alerts: AlertRowData[]): number {
  return alerts.filter((alert) => !alert.isPlaceholder).length;
}

export function createSidebarAlertState(alerts: AlertRowData[], format: DashboardFormatters): SidebarAlertState | null {
  const criticalCount = alerts.filter((alert) => !alert.isPlaceholder && alert.severity === 'critical').length;
  if (criticalCount > 0) {
    return {
      tone: 'critical',
      countLabel: format.integer(criticalCount),
    };
  }

  const warningCount = alerts.filter((alert) => !alert.isPlaceholder && alert.severity === 'warning').length;
  if (warningCount > 0) {
    return {
      tone: 'warning',
      countLabel: format.integer(warningCount),
    };
  }

  return null;
}
