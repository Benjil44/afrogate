import type { RouteBufferbloatRecommendation, RouteBufferbloatSeverity } from '@afrows/shared';

export interface RouteBufferbloatAssessment {
  loadedLatencyMs: number | null;
  loadedLatencyDeltaMs: number | null;
  severity: RouteBufferbloatSeverity;
  recommendation: RouteBufferbloatRecommendation;
}

/** Rounds a value to `digits` decimals; null/non-finite passes through as null. */
function roundMetric(value: number | null | undefined, digits: number): number | null {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const multiplier = 10 ** digits;
  return Math.round(Number(value) * multiplier) / multiplier;
}

/**
 * Bufferbloat severity. Prefers the measured loaded-latency delta; otherwise
 * infers from load% combined with idle latency/jitter. Returns 'unknown' when
 * neither signal is available.
 */
export function routeBufferbloatSeverity(input: {
  latencyMs: number | null;
  jitterMs: number | null;
  loadPercent: number | null;
  loadedLatencyDeltaMs: number | null;
}): RouteBufferbloatSeverity {
  if (input.loadedLatencyDeltaMs !== null) {
    if (input.loadedLatencyDeltaMs >= 150) return 'high';
    if (input.loadedLatencyDeltaMs >= 75) return 'medium';
    if (input.loadedLatencyDeltaMs >= 30) return 'low';
    return 'none';
  }

  if (input.loadPercent === null) return 'unknown';
  if (input.loadPercent >= 85 && ((input.latencyMs ?? 0) >= 140 || (input.jitterMs ?? 0) >= 35)) return 'high';
  if (input.loadPercent >= 75 && ((input.latencyMs ?? 0) >= 110 || (input.jitterMs ?? 0) >= 25)) return 'medium';
  if (input.loadPercent >= 65 && ((input.latencyMs ?? 0) >= 90 || (input.jitterMs ?? 0) >= 15)) return 'low';

  return 'none';
}

/** Operator recommendation derived from a bufferbloat severity. */
export function routeBufferbloatRecommendation(severity: RouteBufferbloatSeverity): RouteBufferbloatRecommendation {
  switch (severity) {
    case 'high':
      return 'avoidUnderLoad';
    case 'medium':
      return 'sqmRecommended';
    case 'low':
      return 'watch';
    default:
      return 'none';
  }
}

/** Full bufferbloat assessment: loaded latency, delta-from-idle, severity, and recommendation. */
export function assessRouteBufferbloat(input: {
  latencyMs: number | null;
  jitterMs: number | null;
  loadPercent: number | null;
  loadedLatencyMs?: number | null;
  loadedLatencyDeltaMs?: number | null;
}): RouteBufferbloatAssessment {
  const loadedLatencyMs = roundMetric(input.loadedLatencyMs, 1);
  const loadedLatencyDeltaMs = roundMetric(
    input.loadedLatencyDeltaMs ??
      (loadedLatencyMs !== null && input.latencyMs !== null ? loadedLatencyMs - input.latencyMs : null),
    1,
  );
  const severity = routeBufferbloatSeverity({
    latencyMs: input.latencyMs,
    jitterMs: input.jitterMs,
    loadPercent: input.loadPercent,
    loadedLatencyDeltaMs,
  });

  return {
    loadedLatencyMs,
    loadedLatencyDeltaMs,
    severity,
    recommendation: routeBufferbloatRecommendation(severity),
  };
}
