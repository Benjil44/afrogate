import type { RouteProbeMetric } from '@afrows/shared';

/** Clamp a number into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Linear penalty for how far `value` exceeds `threshold`, scaled by `multiplier`; 0 for null/non-finite. */
export function thresholdPenalty(value: number | null | undefined, threshold: number, multiplier: number): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(0, value - threshold) * multiplier;
}

/** Round a metric to `digits` decimals, or null for null/non-finite input. */
export function roundMetric(value: number | null | undefined, digits: number): number | null {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const multiplier = 10 ** digits;
  return Math.round(Number(value) * multiplier) / multiplier;
}

/** Loaded-latency delta from a probe: explicit delta, else loaded - base latency, else null. */
export function loadedLatencyDeltaFromProbe(probe: RouteProbeMetric): number | null {
  if (typeof probe.loadedLatencyDeltaMs === 'number' && Number.isFinite(probe.loadedLatencyDeltaMs)) {
    return probe.loadedLatencyDeltaMs;
  }
  if (
    typeof probe.loadedLatencyMs === 'number' &&
    Number.isFinite(probe.loadedLatencyMs) &&
    typeof probe.latencyMs === 'number' &&
    Number.isFinite(probe.latencyMs)
  ) {
    return probe.loadedLatencyMs - probe.latencyMs;
  }
  return null;
}

/** Score a single MTU probe (0-100) from status and path/recommended/configured MTU gaps. */
export function calculateMtuProbeScore(probe: RouteProbeMetric): number {
  const statusScore = {
    healthy: 100,
    degraded: 68,
    critical: 20,
    unknown: 55,
  }[String(probe.status).toLowerCase()] ?? 55;
  const pathMtu = roundMetric(probe.pathMtuBytes, 0);
  const recommendedTunnelMtu = roundMetric(probe.recommendedTunnelMtuBytes, 0);
  const configuredMtu = roundMetric(probe.configuredMtuBytes, 0);
  const configuredOverRecommended = configuredMtu !== null && recommendedTunnelMtu !== null
    ? Math.max(0, configuredMtu - recommendedTunnelMtu)
    : 0;
  const pathMtuPenalty = pathMtu === null ? 0 : thresholdPenalty(1280 - pathMtu, 0, 0.16);
  const recommendedPenalty = recommendedTunnelMtu === null ? 0 : thresholdPenalty(1280 - recommendedTunnelMtu, 0, 0.2);
  const configuredPenalty = Math.min(35, configuredOverRecommended * 0.18);

  return clamp(statusScore - pathMtuPenalty - recommendedPenalty - configuredPenalty, 0, 100);
}

/** Score a single route probe (0-100) from status, latency, jitter, loss, and loaded latency. */
export function calculateSingleProbeScore(probe: RouteProbeMetric): number {
  const protocol = String(probe.protocol).toLowerCase();
  if (protocol === 'mtu') return calculateMtuProbeScore(probe);

  const statusScore = {
    healthy: 100,
    degraded: 72,
    critical: 20,
    unknown: 55,
  }[String(probe.status).toLowerCase()] ?? 55;
  const latencyThreshold = protocol === 'dns' ? 80 : protocol === 'tcp' ? 100 : 70;
  const jitterThreshold = protocol === 'tcp' || protocol === 'dns' ? 25 : 10;
  const lossMultiplier = protocol === 'tcp' || protocol === 'dns' ? 16 : 24;
  const loadedLatencyDeltaMs = loadedLatencyDeltaFromProbe(probe);
  const score = statusScore
    - thresholdPenalty(probe.latencyMs ?? null, latencyThreshold, 0.09)
    - thresholdPenalty(probe.jitterMs ?? null, jitterThreshold, 1)
    - thresholdPenalty(probe.packetLossPercent ?? null, 0, lossMultiplier)
    - thresholdPenalty(loadedLatencyDeltaMs, 30, 0.18);

  return clamp(score, 0, 100);
}

/** Aggregate probe score for the given protocols (65% average, 35% worst); null when none match. */
export function calculateProtocolProbeScore(routeProbes: RouteProbeMetric[], protocols: string[]): number | null {
  const protocolSet = new Set(protocols);
  const scores = routeProbes
    .filter((probe) => protocolSet.has(String(probe.protocol).toLowerCase()))
    .map((probe) => calculateSingleProbeScore(probe));

  if (!scores.length) return null;

  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const worst = Math.min(...scores);

  return average * 0.65 + worst * 0.35;
}
