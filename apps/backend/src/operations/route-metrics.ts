import { BadRequestException } from '@nestjs/common';
import type { RouteProfileScores, RouteProbeMetric, RouteScoreProfile, ServerMetricSnapshot } from '@afrows/shared';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Mean of the finite values, rounded to one decimal; null when there are none. */
export function averageMetric(values: Array<number | null | undefined>): number | null {
  const finiteValues = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!finiteValues.length) return null;
  return Math.round((finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length) * 10) / 10;
}

/** Minimum finite value, rounded; null when there are none. */
export function minimumMetric(values: Array<number | null | undefined>): number | null {
  const finiteValues = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!finiteValues.length) return null;
  return Math.round(Math.min(...finiteValues));
}

/** Maximum finite value, rounded; null when there are none. */
export function maximumMetric(values: Array<number | null | undefined>): number | null {
  const finiteValues = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!finiteValues.length) return null;
  return Math.round(Math.max(...finiteValues));
}

/** Penalty for a stale/absent WireGuard handshake: 18 when unknown, ramping after 180s, capped at 35. */
export function calculateHandshakePenalty(ageSeconds: number | null): number {
  if (ageSeconds === null) return 18;
  if (ageSeconds <= 180) return 0;
  return Math.min(35, (ageSeconds - 180) / 12);
}

/** Maps a raw WireGuard telemetry status to a normalized health state. */
export function mapWireGuardTelemetryStatus(status: string): string {
  if (status === 'up') return 'healthy';
  if (status === 'degraded') return 'degraded';
  if (status === 'down') return 'critical';
  return 'unknown';
}

/** Coerces a config value (number or numeric string) to a finite number, else null. */
export function numberFromConfig(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Resolves an endpoint string from config (explicit endpoint keys first, then host[:port]). */
export function extractEndpoint(config: Record<string, unknown>): string | null {
  for (const key of ['endpoint', 'healthEndpoint', 'targetEndpoint']) {
    const value = config[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  const host = ['healthHost', 'host', 'targetHost']
    .map((key) => config[key])
    .find((value): value is string => typeof value === 'string' && Boolean(value.trim()));
  const port = ['healthPort', 'port', 'targetPort']
    .map((key) => config[key])
    .find((value): value is string | number => typeof value === 'number' || typeof value === 'string');

  return host ? `${host}${port ? `:${port}` : ''}` : null;
}

/** Resolves a 0-100 load percent from config, falling back to a weight-derived estimate. */
export function extractLoadPercent(config: Record<string, unknown>, weight: number): number | null {
  for (const key of ['loadPercent', 'load', 'saturationPercent']) {
    const value = numberFromConfig(config[key]);
    if (value !== null) return Math.round(clamp(value, 0, 100));
  }

  if (weight <= 0) return null;

  return Math.round(clamp(100 - Math.min(weight, 100), 0, 100));
}

/** Uppercases and validates a 2-letter country code, else null. */
export function normalizeRouteDecisionCountryCode(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) return null;
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

/** Extracts and UUID-validates the client config id embedded in a `client_config:<uuid>` key. */
export function clientConfigIdFromRouteAssignmentKey(assignmentKey: string): string | null {
  const prefix = 'client_config:';
  if (!assignmentKey.startsWith(prefix)) return null;

  const clientConfigId = assignmentKey.slice(prefix.length);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientConfigId)
    ? clientConfigId
    : null;
}

/** Normalizes a route group identifier (defaults to `main`); throws on disallowed characters. */
export function normalizeRouteGroup(input: string | undefined): string {
  const routeGroup = input?.trim() || 'main';
  if (!/^[a-z][a-z0-9_-]{0,79}$/i.test(routeGroup)) {
    throw new BadRequestException('routeGroup must be simple text');
  }
  return routeGroup;
}

/** Normalizes a route assignment key (defaults to `default`); throws on disallowed characters. */
export function normalizeAssignmentKey(input: string | undefined): string {
  const assignmentKey = input?.trim() || 'default';
  if (!/^[a-z][a-z0-9_.:-]{0,119}$/i.test(assignmentKey)) {
    throw new BadRequestException('assignmentKey must be simple text');
  }
  return assignmentKey;
}

/** Returns the protocol profile when it is a known speed profile, else `balanced`. */
export function defaultSpeedProfileForProtocol(protocolProfile: string): string {
  if (
    protocolProfile === 'balanced' ||
    protocolProfile === 'highSpeed' ||
    protocolProfile === 'highSecurity' ||
    protocolProfile === 'gaming'
  ) {
    return protocolProfile;
  }
  return 'balanced';
}

export interface WireGuardScoreInput {
  enabled: boolean;
  maintenanceMode: boolean;
  healthStatus: string;
  latencyMs: number | null;
  jitterMs: number | null;
  packetLossPercent: number | null;
}

export interface WireGuardTelemetryScoreInput {
  status: string;
  peerCount: number;
  activePeerCount: number;
  latestHandshakeAgeSeconds?: number | null;
}

/** Rounds a route score and clamps it into [0, 100]. */
export function roundRouteScore(value: number): number {
  return Math.round(clamp(value, 0, 100));
}

/** Builds a RouteProfileScores object with the same score for every profile. */
export function createUniformRouteScores(score: number): RouteProfileScores {
  return {
    balanced: score,
    stability: score,
    throughput: score,
    gaming: score,
    tcp: score,
    udp: score,
    quic: score,
    dns: score,
    wireguard: score,
  };
}

/** Rounds+clamps every profile score in a RouteProfileScores object. */
export function roundRouteScores(scores: RouteProfileScores): RouteProfileScores {
  return {
    balanced: roundRouteScore(scores.balanced),
    stability: roundRouteScore(scores.stability),
    throughput: roundRouteScore(scores.throughput),
    gaming: roundRouteScore(scores.gaming),
    tcp: roundRouteScore(scores.tcp),
    udp: roundRouteScore(scores.udp),
    quic: roundRouteScore(scores.quic),
    dns: roundRouteScore(scores.dns),
    wireguard: roundRouteScore(scores.wireguard),
  };
}

/** True when the value is a protocol-specific score profile (tcp/udp/quic/dns/wireguard). */
export function isProtocolSpecificScoreProfile(value: string): value is RouteScoreProfile {
  return value === 'tcp' || value === 'udp' || value === 'quic' || value === 'dns' || value === 'wireguard';
}

/** Ordered list of probe protocols that contribute to a given score profile. */
export function protocolsForScoreProfile(profile: RouteScoreProfile): string[] {
  switch (profile) {
    case 'tcp':
      return ['tcp', 'mtu'];
    case 'udp':
      return ['udp', 'wireguard', 'mtu'];
    case 'quic':
      return ['quic', 'udp', 'mtu'];
    case 'dns':
      return ['dns', 'mtu'];
    case 'wireguard':
      return ['wireguard', 'udp', 'mtu'];
    case 'gaming':
      return ['udp', 'quic', 'wireguard', 'tcp', 'mtu'];
    default:
      return ['tcp', 'udp', 'quic', 'dns', 'wireguard', 'mtu'];
  }
}

/** Health/latency/jitter/loss score for a WireGuard candidate row (0 when disabled/in maintenance). */
export function calculateWireGuardScore(row: WireGuardScoreInput): number {
  if (!row.enabled || row.maintenanceMode) return 0;

  const baseScore =
    ({ healthy: 90, degraded: 68, critical: 35, unknown: 55 } as Record<string, number>)[row.healthStatus] ?? 55;
  const latencyPenalty = row.latencyMs === null ? 0 : Math.max(0, (row.latencyMs - 50) / 4);
  const jitterPenalty = row.jitterMs === null ? 0 : Math.max(0, (row.jitterMs - 10) / 2);
  const lossPenalty = row.packetLossPercent === null ? 0 : row.packetLossPercent * 18;

  return Math.round(clamp(baseScore - latencyPenalty - jitterPenalty - lossPenalty, 0, 100));
}

/** Telemetry-based WireGuard interface score (status, inactive peers, handshake age, server health). */
export function calculateWireGuardTelemetryScore(
  item: WireGuardTelemetryScoreInput,
  serverHealthScore: number | null,
): number {
  const baseScore =
    ({ up: 92, degraded: 72, down: 20, unknown: 52 } as Record<string, number>)[item.status] ?? 52;
  const inactivePeerPenalty =
    item.peerCount > 0 ? ((item.peerCount - item.activePeerCount) / item.peerCount) * 25 : 0;
  const handshakePenalty = calculateHandshakePenalty(item.latestHandshakeAgeSeconds ?? null);
  const serverPenalty =
    typeof serverHealthScore === 'number' && serverHealthScore < 60 ? (60 - serverHealthScore) / 2 : 0;

  return Math.round(clamp(baseScore - inactivePeerPenalty - handshakePenalty - serverPenalty, 0, 100));
}

/** Narrows an unknown value to a plain object record (rejects null/arrays/primitives). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loadedLatencyDeltaFromProbe(probe: RouteProbeMetric): number | null {
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

/** Validates an untrusted value as a RouteProbeMetric (protocol/target/status strings). */
export function isRouteProbeMetric(value: unknown): value is RouteProbeMetric {
  if (!isRecord(value)) return false;
  return (
    typeof value.protocol === 'string' && typeof value.target === 'string' && typeof value.status === 'string'
  );
}

/** Extracts the valid route probes from a (possibly untrusted) metric snapshot. */
export function getRouteProbes(raw: Partial<ServerMetricSnapshot> | null | undefined): RouteProbeMetric[] {
  if (!Array.isArray(raw?.routeProbes)) return [];
  return raw.routeProbes.filter((probe): probe is RouteProbeMetric => isRouteProbeMetric(probe));
}

/** Aggregates a set of route probes into averaged latency/jitter/loss + MTU summary fields. */
export function summarizeRouteProbes(routeProbes: RouteProbeMetric[]): {
  latencyMs: number | null;
  jitterMs: number | null;
  packetLossPercent: number | null;
  loadedLatencyMs: number | null;
  loadedLatencyDeltaMs: number | null;
  pathMtuBytes: number | null;
  recommendedTunnelMtuBytes: number | null;
  configuredMtuBytes: number | null;
} {
  const mtuProbes = routeProbes.filter((probe) => String(probe.protocol).toLowerCase() === 'mtu');

  return {
    latencyMs: averageMetric(routeProbes.map((probe) => probe.latencyMs)),
    jitterMs: averageMetric(routeProbes.map((probe) => probe.jitterMs)),
    packetLossPercent: averageMetric(routeProbes.map((probe) => probe.packetLossPercent)),
    loadedLatencyMs: averageMetric(routeProbes.map((probe) => probe.loadedLatencyMs)),
    loadedLatencyDeltaMs: averageMetric(routeProbes.map((probe) => loadedLatencyDeltaFromProbe(probe))),
    pathMtuBytes: minimumMetric(mtuProbes.map((probe) => probe.pathMtuBytes)),
    recommendedTunnelMtuBytes: minimumMetric(mtuProbes.map((probe) => probe.recommendedTunnelMtuBytes)),
    configuredMtuBytes: maximumMetric(mtuProbes.map((probe) => probe.configuredMtuBytes)),
  };
}
