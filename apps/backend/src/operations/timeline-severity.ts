import type { AdminIncidentTimelineEvent } from '@afrogate/shared';

type TimelineSeverity = AdminIncidentTimelineEvent['severity'];

/** Fields of a route-decision event row needed to derive its timeline severity/detail. */
export interface RouteDecisionTimelineRow {
  fromOutboundId: string | null;
  toOutboundId: string | null;
  fromOutboundName?: string | null;
  toOutboundName?: string | null;
  decisionState: string;
}

const HEALTH_CONCERN_FRAGMENTS = ['unhealthy', 'packetloss', 'jitter', 'latency', 'critical', 'emergency'];

/** Maps an alert severity to a timeline severity (critical/warning/info). */
export function incidentSeverityFromAlert(severity: string): TimelineSeverity {
  if (severity === 'critical') return 'critical';
  if (severity === 'warning') return 'warning';
  return 'info';
}

/** Severity for a route-decision timeline event: warning on a route change, health concern, or recommended switch. */
export function routeDecisionTimelineSeverity(
  row: RouteDecisionTimelineRow,
  reasonCodes: string[],
): TimelineSeverity {
  const changedRoute = Boolean(row.fromOutboundId && row.toOutboundId && row.fromOutboundId !== row.toOutboundId);
  const healthConcern = reasonCodes.some((reason) =>
    HEALTH_CONCERN_FRAGMENTS.some((fragment) => reason.toLowerCase().includes(fragment)),
  );

  return changedRoute || healthConcern || row.decisionState === 'switchRecommended' ? 'warning' : 'info';
}

/** Human-readable detail line for a route-decision timeline event (route change and/or top reasons). */
export function describeRouteDecisionTimelineDetail(row: RouteDecisionTimelineRow, reasonCodes: string[]): string {
  const fromOutbound = row.fromOutboundName ?? row.fromOutboundId ?? 'none';
  const toOutbound = row.toOutboundName ?? row.toOutboundId ?? null;
  const routeChange = toOutbound && fromOutbound !== toOutbound ? `${fromOutbound} -> ${toOutbound}` : toOutbound;
  const reasons = reasonCodes.slice(0, 3).join(', ');

  if (routeChange && reasons) return `${routeChange} / ${reasons}`;
  if (routeChange) return routeChange;
  if (reasons) return reasons;

  return row.decisionState;
}
