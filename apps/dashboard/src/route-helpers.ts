import type { RouteHealthHistoryPoint, RouteQualityRecommendation } from '@afrogate/shared';
import type { WireGuardHealthCandidate } from './dashboard-types';
import type { DashboardFormatters } from './formatters';
import type { DashboardStrings } from './i18n';

export function formatWireGuardCandidatePeers(
  candidate: WireGuardHealthCandidate,
  format: DashboardFormatters,
  t: DashboardStrings,
): string {
  if (typeof candidate.peerCount !== 'number' || typeof candidate.activePeerCount !== 'number') return '--';

  return t.settings.activePeers(format.integer(candidate.activePeerCount), format.integer(candidate.peerCount));
}

export function formatWireGuardCandidateHandshake(
  candidate: WireGuardHealthCandidate,
  format: DashboardFormatters,
  t: DashboardStrings,
): string {
  if (typeof candidate.latestHandshakeAgeSeconds !== 'number') return t.settings.noHandshake;

  return t.settings.latestHandshakeAge(format.durationSeconds(candidate.latestHandshakeAgeSeconds));
}

export function formatWireGuardCandidateRate(candidate: WireGuardHealthCandidate, format: DashboardFormatters): string {
  return `${format.bytesPerSecond(candidate.rxBps ?? null)} / ${format.bytesPerSecond(candidate.txBps ?? null)}`;
}

export function routeRecommendationKey(recommendation: RouteQualityRecommendation): string {
  return [
    recommendation.kind,
    recommendation.serverExternalId ?? 'none',
    recommendation.outboundKey ?? recommendation.outboundId ?? 'unassigned',
    recommendation.operator ?? 'unknown',
    recommendation.protocol ?? 'any',
    recommendation.scoreProfile ?? 'any',
    recommendation.dayOfWeek ?? 'anyday',
    recommendation.hourOfDay ?? 'all',
  ].join(':');
}

export function routeRecommendationTitle(recommendation: RouteQualityRecommendation, t: DashboardStrings): string {
  if (recommendation.kind === 'upcomingDegradedWindow') return t.settings.upcomingRouteWindow;
  if (recommendation.kind === 'bestWindow') return t.settings.bestRouteWindow;
  if (recommendation.kind === 'degradedWindow') return t.settings.watchRouteWindow;

  return t.settings.noRouteRecommendations;
}

export function routeRecommendationDetail(
  recommendation: RouteQualityRecommendation,
  format: DashboardFormatters,
  t: DashboardStrings,
): string {
  const server = recommendation.outboundName || recommendation.serverHostname || recommendation.serverExternalId || t.settings.anyRoute;
  const protocol = recommendation.protocol ? String(recommendation.protocol).toUpperCase() : t.settings.anyProtocol;
  const window = formatRouteHourWindow(recommendation.hourOfDay ?? null, format);
  const samples = t.settings.routeAnalyticsSamples(format.integer(recommendation.sampleCount));
  const startsIn = t.settings.routeAnalyticsStartsIn(formatRouteStartsIn(recommendation.startsInMinutes ?? null, format));

  if (recommendation.kind === 'bestWindow') {
    return t.settings.bestRouteRecommendation(server, protocol, window, samples);
  }
  if (recommendation.kind === 'upcomingDegradedWindow') {
    return t.settings.upcomingRouteRecommendation(server, protocol, window, startsIn, samples);
  }
  if (recommendation.kind === 'degradedWindow') {
    return t.settings.watchRouteRecommendation(server, protocol, window, samples);
  }

  return t.settings.routeAnalyticsNeedsData;
}

export function routeRecommendationConfidence(recommendation: RouteQualityRecommendation, t: DashboardStrings): string {
  if (recommendation.confidence === 'high') return t.settings.confidenceHigh;
  if (recommendation.confidence === 'medium') return t.settings.confidenceMedium;

  return t.settings.confidenceLow;
}

export function routeRecommendationOperator(
  recommendation: RouteQualityRecommendation,
  format: DashboardFormatters,
  t: DashboardStrings,
): string {
  const operator = recommendation.operator;
  if (!operator || operator === 'unknown') return t.settings.unknownOperator;

  return format.label(operator);
}

export function routeRecommendationProfile(
  recommendation: RouteQualityRecommendation,
  format: DashboardFormatters,
  t: DashboardStrings,
): string {
  const profile = recommendation.scoreProfile;
  if (!profile) return t.settings.unknownProfile;

  return format.label(String(profile));
}

export function routeHealthHistoryKey(point: RouteHealthHistoryPoint): string {
  return [
    point.bucketStart,
    point.serverExternalId,
    point.outboundKey ?? point.outboundId ?? 'unassigned',
    point.operator ?? 'unknown',
    point.protocol,
    point.scoreProfile ?? 'any',
  ].join(':');
}

export function routeHealthPointRoute(
  point: RouteHealthHistoryPoint,
  format: DashboardFormatters,
  t: DashboardStrings,
): string {
  return format.label(point.outboundName || point.serverHostname || point.serverExternalId || t.settings.anyRoute);
}

export function routeHealthPointMeta(
  point: RouteHealthHistoryPoint,
  format: DashboardFormatters,
  t: DashboardStrings,
): string {
  const bucket = point.bucketStart ? format.time(new Date(point.bucketStart), false) : '--';
  const operator = point.operator && point.operator !== 'unknown' ? format.label(point.operator) : t.settings.unknownOperator;
  const protocol = point.protocol ? String(point.protocol).toUpperCase() : t.settings.anyProtocol;
  const profile = point.scoreProfile ? format.label(String(point.scoreProfile)) : t.settings.unknownProfile;

  return `${bucket} / ${operator} / ${protocol} / ${profile}`;
}

export function formatRouteHourWindow(hourOfDay: number | null, format: DashboardFormatters): string {
  if (hourOfDay === null || !Number.isFinite(hourOfDay)) return '--';

  const startHour = ((Math.trunc(hourOfDay) % 24) + 24) % 24;
  const endHour = (startHour + 1) % 24;

  return `${format.integer(startHour)}:00-${format.integer(endHour)}:00`;
}

export function formatRouteStartsIn(minutes: number | null, format: DashboardFormatters): string {
  if (minutes === null || !Number.isFinite(minutes)) return '--';
  if (minutes <= 0) return format.durationMinutes(0);

  return format.durationMinutes(minutes);
}
