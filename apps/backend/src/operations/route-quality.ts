import type { RouteQualityWindowSummary } from '@afrows/shared';

/** A window is "best" when scores are high and degraded samples are few. */
export function isBestRouteQualityWindow(window: RouteQualityWindowSummary): boolean {
  return window.averageScore >= 78 && window.degradedSamplePercent <= 25;
}

/** A window is "degraded" when scores are low or degraded samples are frequent. */
export function isDegradedRouteQualityWindow(window: RouteQualityWindowSummary): boolean {
  return window.averageScore < 60 || window.degradedSamplePercent >= 35;
}

/** Next occurrence (as a Date) of a recurring weekly window, or null when its day/hour is unusable. */
export function nextRouteQualityWindowStart(window: RouteQualityWindowSummary, now = new Date()): Date | null {
  if (window.dayOfWeek === null || window.dayOfWeek === undefined) return null;
  if (!Number.isFinite(window.dayOfWeek) || !Number.isFinite(window.hourOfDay)) return null;

  const dayOfWeek = ((Math.trunc(window.dayOfWeek) % 7) + 7) % 7;
  const hourOfDay = ((Math.trunc(window.hourOfDay) % 24) + 24) % 24;
  const candidate = new Date(now);
  candidate.setMilliseconds(0);
  candidate.setSeconds(0);
  candidate.setMinutes(0);
  candidate.setHours(hourOfDay);
  candidate.setDate(candidate.getDate() + ((dayOfWeek - candidate.getDay() + 7) % 7));

  if (now.getTime() >= candidate.getTime() + 60 * 60 * 1000) {
    candidate.setDate(candidate.getDate() + 7);
  }

  return candidate;
}

/** Prediction look-ahead window in hours, from env, clamped to [1, 168]; defaults to 8. */
export function routeQualityPredictionLookaheadHours(): number {
  const value = Number(process.env.AFROWS_ROUTE_QUALITY_PREDICTION_LOOKAHEAD_HOURS ?? 8);
  if (!Number.isInteger(value)) return 8;
  return Math.min(168, Math.max(1, value));
}

/** Confidence tier for a prediction given sample volume and the analysis range. */
export function routeQualityConfidence(
  sampleCount: number,
  minimumSamples: number,
  rangeHours: number,
): 'low' | 'medium' | 'high' {
  if (sampleCount >= minimumSamples * 4 && rangeHours >= 168) return 'high';
  if (sampleCount >= minimumSamples * 2) return 'medium';
  return 'low';
}

/** Minimum samples required for analytics to be meaningful, scaled to the range length. */
export function minimumRouteAnalyticsSamples(rangeHours: number): number {
  if (rangeHours >= 720) return 8;
  if (rangeHours >= 168) return 4;
  return 2;
}
