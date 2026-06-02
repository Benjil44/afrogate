import { BadRequestException } from '@nestjs/common';

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
