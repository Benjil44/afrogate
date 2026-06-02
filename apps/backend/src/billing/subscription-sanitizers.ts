import type { ClientRouteOptionsResponse, ClientSubscriptionEndpointSummary } from '@afrogate/shared';

export interface ClientSubscriptionCredentialRenderResult {
  status: 'rendered' | 'blocked_secret_unavailable' | 'blocked_secret_invalid';
  uri?: string | null;
  configText?: string | null;
  missingFields: string[];
  warnings: string[];
}

type Outbound = ClientRouteOptionsResponse['outbounds'][number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True for an RFC-4122 v1-5 UUID string. */
export function isUuidValue(value: string): boolean {
  return UUID_RE.test(value);
}

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

/** Public-facing format label for a protocol's rendered subscription config. */
export function subscriptionConfigFormat(protocol: string): string {
  if (protocol === 'wireguard') return 'wireguard-profile';
  if (protocol === 'vless') return 'vless-uri';
  if (protocol === 'l2tp') return 'l2tp-profile';
  if (protocol === 'ikev2') return 'ikev2-profile';
  return 'manual-profile';
}

/** Per-protocol list of secret fields required before a credential can be rendered. */
export function subscriptionSecretMissingFields(protocol: string): string[] {
  if (protocol === 'wireguard') return ['client_private_key', 'client_public_key', 'peer_public_key'];
  if (protocol === 'vless') return ['client_uuid'];
  if (protocol === 'l2tp') return ['username', 'password_or_psk'];
  if (protocol === 'ikev2') return ['client_identity_or_certificate'];
  return [];
}

/** A "secret material present but incomplete" render result carrying the missing fields. */
export function invalidSubscriptionCredential(missingFields: string[]): ClientSubscriptionCredentialRenderResult {
  return {
    status: 'blocked_secret_invalid',
    missingFields,
    warnings: ['stored_client_secret_material_incomplete'],
  };
}

/** Non-sensitive profile describing the endpoint, safe to expose without secret material. */
export function subscriptionPublicProfile(
  protocol: string,
  outbound: Outbound,
  endpoint: ClientSubscriptionEndpointSummary,
): Record<string, string | number | boolean | null> {
  return {
    protocol,
    outboundId: outbound.id,
    routeGroup: outbound.routeGroup,
    endpoint: endpoint.address ?? endpointHostPort(endpoint),
    host: endpoint.host ?? null,
    port: endpoint.port ?? null,
    transport: endpoint.transport ?? null,
    countryCode: endpoint.countryCode ?? null,
    usageMultiplier: endpoint.usageMultiplier,
    secretSafe: true,
  };
}

/** Builds a `vless://` URI from outbound/endpoint data and per-client secret material. */
export function renderVlessClientUri(
  outbound: Outbound,
  endpoint: ClientSubscriptionEndpointSummary,
  secretMaterial: Record<string, unknown>,
  publicMetadata: Record<string, unknown>,
): ClientSubscriptionCredentialRenderResult {
  const target = subscriptionEndpointTarget(endpoint);
  const uuid = firstCredentialString([secretMaterial], ['clientUuid', 'uuid', 'clientId', 'id'], 80);
  const missingFields: string[] = [];

  if (!target.host) missingFields.push('public_host');
  if (!target.port) missingFields.push('public_port');
  if (!uuid || !isUuidValue(uuid)) missingFields.push('client_uuid');

  if (missingFields.length) return invalidSubscriptionCredential(missingFields);

  const network =
    firstCredentialString([publicMetadata, secretMaterial], ['transport', 'network', 'type'], 32) ??
    endpoint.transport ??
    'tcp';
  const encryption = firstCredentialString([publicMetadata, secretMaterial], ['encryption'], 32) ?? 'none';
  const params = new URLSearchParams();
  params.set('type', network);
  params.set('encryption', encryption);

  for (const [key, queryName, maxLength] of [
    ['security', 'security', 32],
    ['sni', 'sni', 160],
    ['serverName', 'sni', 160],
    ['flow', 'flow', 80],
    ['path', 'path', 180],
    ['hostHeader', 'host', 160],
    ['serviceName', 'serviceName', 160],
    ['headerType', 'headerType', 64],
    ['fingerprint', 'fp', 64],
    ['alpn', 'alpn', 80],
  ] as const) {
    const value = firstCredentialString([publicMetadata, secretMaterial], [key], maxLength);
    if (value) params.set(queryName, value);
  }

  const targetHost = target.host as string;
  const targetPort = target.port as number;
  const host = targetHost.includes(':') && !targetHost.startsWith('[') ? `[${targetHost}]` : targetHost;
  const label = encodeURIComponent(outbound.name || 'AfroGate');
  return {
    status: 'rendered',
    uri: `vless://${uuid}@${host}:${targetPort}?${params.toString()}#${label}`,
    configText: null,
    missingFields: [],
    warnings: [],
  };
}

/** Builds a WireGuard client profile (`.conf` text) from endpoint data and secret material. */
export function renderWireGuardClientConfig(
  endpoint: ClientSubscriptionEndpointSummary,
  secretMaterial: Record<string, unknown>,
  publicMetadata: Record<string, unknown>,
): ClientSubscriptionCredentialRenderResult {
  const target = subscriptionEndpointTarget(endpoint);
  const privateKey = firstCredentialString([secretMaterial], ['clientPrivateKey', 'privateKey'], 2048);
  const address = firstCredentialList([secretMaterial], ['clientAddress', 'address', 'addressCidr'], 256);
  const peerPublicKey = firstCredentialString(
    [publicMetadata, secretMaterial],
    ['peerPublicKey', 'serverPublicKey', 'publicKey'],
    2048,
  );
  const missingFields: string[] = [];

  if (!target.authority) missingFields.push('public_endpoint');
  if (!privateKey) missingFields.push('client_private_key');
  if (!address) missingFields.push('client_address');
  if (!peerPublicKey) missingFields.push('peer_public_key');

  if (missingFields.length) return invalidSubscriptionCredential(missingFields);

  const dns = firstCredentialList([secretMaterial, publicMetadata], ['dns', 'clientDns'], 256);
  const allowedIps =
    firstCredentialList([secretMaterial, publicMetadata], ['allowedIps', 'allowedIPs'], 512) ?? '0.0.0.0/0, ::/0';
  const mtu = firstCredentialString([secretMaterial, publicMetadata], ['mtu'], 16);
  const presharedKey = firstCredentialString([secretMaterial], ['presharedKey', 'preSharedKey', 'psk'], 2048);
  const keepalive = firstCredentialString([secretMaterial, publicMetadata], ['persistentKeepalive', 'keepalive'], 16);

  const lines = [
    '[Interface]',
    `PrivateKey = ${privateKey}`,
    `Address = ${address}`,
    dns ? `DNS = ${dns}` : null,
    mtu ? `MTU = ${mtu}` : null,
    '',
    '[Peer]',
    `PublicKey = ${peerPublicKey}`,
    presharedKey ? `PresharedKey = ${presharedKey}` : null,
    `AllowedIPs = ${allowedIps}`,
    `Endpoint = ${target.authority}`,
    keepalive ? `PersistentKeepalive = ${keepalive}` : null,
  ].filter((line): line is string => line !== null);

  return {
    status: 'rendered',
    uri: null,
    configText: lines.join('\n'),
    missingFields: [],
    warnings: [],
  };
}

/** Builds an L2TP/IPsec client profile (human-readable text) from endpoint data and secret material. */
export function renderL2tpClientProfile(
  endpoint: ClientSubscriptionEndpointSummary,
  secretMaterial: Record<string, unknown>,
  publicMetadata: Record<string, unknown>,
): ClientSubscriptionCredentialRenderResult {
  const target = subscriptionEndpointTarget(endpoint);
  const username = firstCredentialString([secretMaterial], ['username', 'user'], 256);
  const password = firstCredentialString([secretMaterial], ['password', 'clientPassword'], 2048);
  const psk = firstCredentialString([secretMaterial], ['preSharedKey', 'presharedKey', 'ipsecPsk', 'psk'], 2048);
  const missingFields: string[] = [];

  if (!target.authority) missingFields.push('public_endpoint');
  if (!username) missingFields.push('username');
  if (!password) missingFields.push('password');
  if (!psk) missingFields.push('ipsec_psk');

  if (missingFields.length) return invalidSubscriptionCredential(missingFields);

  const remoteId = firstCredentialString([publicMetadata, secretMaterial], ['remoteId', 'serverId'], 256);
  const lines = [
    'Protocol: L2TP/IPsec',
    `Server: ${target.authority}`,
    remoteId ? `Remote ID: ${remoteId}` : null,
    `Username: ${username}`,
    `Password: ${password}`,
    `PreSharedKey: ${psk}`,
  ].filter((line): line is string => line !== null);

  return {
    status: 'rendered',
    uri: null,
    configText: lines.join('\n'),
    missingFields: [],
    warnings: [],
  };
}

/** Builds an IKEv2 client profile (human-readable text) from endpoint data and secret material. */
export function renderIkev2ClientProfile(
  endpoint: ClientSubscriptionEndpointSummary,
  secretMaterial: Record<string, unknown>,
  publicMetadata: Record<string, unknown>,
): ClientSubscriptionCredentialRenderResult {
  const target = subscriptionEndpointTarget(endpoint);
  const identity = firstCredentialString([secretMaterial], ['identity', 'clientIdentity', 'localId', 'username'], 256);
  const username = firstCredentialString([secretMaterial], ['username', 'user'], 256);
  const password = firstCredentialString([secretMaterial], ['password', 'eapPassword'], 2048);
  const certificate = firstCredentialString(
    [secretMaterial],
    ['certificateAlias', 'certificateRef', 'clientCertificate'],
    4096,
  );
  const missingFields: string[] = [];

  if (!target.authority) missingFields.push('public_endpoint');
  if (!identity && !username) missingFields.push('client_identity');
  if (!password && !certificate) missingFields.push('client_auth_material');

  if (missingFields.length) return invalidSubscriptionCredential(missingFields);

  const remoteId =
    firstCredentialString([publicMetadata, secretMaterial], ['remoteId', 'serverId'], 256) ?? target.host ?? null;
  const lines = [
    'Protocol: IKEv2',
    `Server: ${target.authority}`,
    remoteId ? `Remote ID: ${remoteId}` : null,
    identity ? `Local ID: ${identity}` : null,
    username ? `Username: ${username}` : null,
    password ? `Password: ${password}` : null,
    certificate ? `Certificate: ${certificate}` : null,
  ].filter((line): line is string => line !== null);

  return {
    status: 'rendered',
    uri: null,
    configText: lines.join('\n'),
    missingFields: [],
    warnings: [],
  };
}
