import type { ClientSubscriptionEndpointSummary } from '@afrogate/shared';

/** Trims and rejects subscription-config values that are empty, too long, or carry CR/LF/NUL (injection guard). */
export function sanitizeSubscriptionConfigValue(value: string, maxLength: number): string | null {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return null;
  if (/[\r\n\u0000]/.test(normalized)) return null;
  return normalized;
}

/** Coerces a scalar (string/finite number/boolean) to its string form, else null. */
export function scalarCredentialValue(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return null;
}

/** First sanitized scalar value found across the given records/keys. */
export function firstCredentialString(
  records: Array<Record<string, unknown>>,
  keys: string[],
  maxLength: number,
): string | null {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      const normalized = scalarCredentialValue(value);
      const safe = normalized ? sanitizeSubscriptionConfigValue(normalized, maxLength) : null;
      if (safe) return safe;
    }
  }
  return null;
}

/** Like firstCredentialString but joins array values into a comma-separated, sanitized list. */
export function firstCredentialList(
  records: Array<Record<string, unknown>>,
  keys: string[],
  maxLength: number,
): string | null {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      const normalized = Array.isArray(value)
        ? value
            .map((item) => scalarCredentialValue(item))
            .filter((item): item is string => Boolean(item))
            .join(', ')
        : scalarCredentialValue(value);
      const safe = normalized ? sanitizeSubscriptionConfigValue(normalized, maxLength) : null;
      if (safe) return safe;
    }
  }
  return null;
}

/** `host:port` (or just host) for an endpoint, or null when no host is known. */
export function endpointHostPort(endpoint: ClientSubscriptionEndpointSummary): string | null {
  if (!endpoint.host) return null;
  return endpoint.port ? `${endpoint.host}:${endpoint.port}` : endpoint.host;
}

/** First config value that parses to a valid TCP/UDP port (1-65535). */
export function firstSafeEndpointNumber(config: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = config[key];
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) return parsed;
  }
  return null;
}

function parsePort(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : null;
}

/** Parses host/port out of a subscription address (handles scheme, path, and bracketed IPv6). */
export function parseSubscriptionAddress(address: string | null | undefined): { host: string | null; port: number | null } {
  const normalized = address?.trim();
  if (!normalized) return { host: null, port: null };

  const addressWithoutScheme = normalized.replace(/^[A-Za-z][A-Za-z0-9+.-]*:\/\//, '');
  const authority = addressWithoutScheme.split('/')[0]?.trim() || '';
  if (!authority) return { host: null, port: null };

  if (authority.startsWith('[')) {
    const closing = authority.indexOf(']');
    if (closing > 0) {
      const host = authority.slice(1, closing);
      const portValue = authority.slice(closing + 1).replace(/^:/, '');
      const port = parsePort(portValue);
      return { host, port };
    }
  }

  const lastColon = authority.lastIndexOf(':');
  if (lastColon > -1 && authority.indexOf(':') === lastColon) {
    const host = authority.slice(0, lastColon);
    const port = parsePort(authority.slice(lastColon + 1));
    return { host: host || null, port };
  }

  return { host: authority, port: null };
}

/** Resolves a sanitized {host, port, authority} target from an endpoint's structured fields or raw address. */
export function subscriptionEndpointTarget(
  endpoint: ClientSubscriptionEndpointSummary,
): { host: string | null; port: number | null; authority: string | null } {
  const parsed = parseSubscriptionAddress(endpoint.address);
  const host = endpoint.host ?? parsed.host;
  const port = endpoint.port ?? parsed.port;

  if (!host && endpoint.address) {
    return { host: null, port, authority: sanitizeSubscriptionConfigValue(endpoint.address, 220) };
  }

  const safeHost = host ? sanitizeSubscriptionConfigValue(host, 180) : null;
  const authority = safeHost ? `${safeHost}${port ? `:${port}` : ''}` : null;
  return { host: safeHost, port, authority };
}
