/**
 * Build a minimal, self-contained Xray client config that exposes a local SOCKS
 * inbound and routes everything through a single VLESS outbound described by an
 * outbound's stored `config`. Used by the speed-test engine to measure
 * throughput THROUGH a given outbound. Pure + unit-tested; no I/O.
 */

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asPort(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(n) && n > 0 && n <= 65535 ? n : undefined;
}

export function buildXraySpeedTestConfig(
  config: Record<string, unknown>,
  socksPort: number,
): Record<string, unknown> {
  const address = asString(config.address);
  const port = asPort(config.port) ?? 443;
  const uuid = asString(config.uuid);
  if (!address || !uuid) {
    throw new Error('VLESS config requires both an address and a uuid');
  }

  const network = asString(config.network) ?? 'tcp';
  const security = asString(config.security) ?? 'none';
  const encryption = asString(config.encryption) ?? 'none';
  const flow = asString(config.flow) ?? '';
  const serverName = asString(config.serverName) ?? asString(config.host) ?? address;
  const host = asString(config.host);
  const path = asString(config.path) ?? '/';
  const fingerprint = asString(config.fingerprint) ?? 'chrome';
  const headerType = asString(config.headerType);

  const streamSettings: Record<string, unknown> = { network, security };

  if (security === 'tls') {
    streamSettings.tlsSettings = { serverName, fingerprint, allowInsecure: false };
  } else if (security === 'reality') {
    streamSettings.realitySettings = {
      serverName,
      fingerprint,
      publicKey: asString(config.publicKey) ?? '',
      shortId: asString(config.shortId) ?? '',
      spiderX: asString(config.spiderX) ?? '',
    };
  }

  if (network === 'ws') {
    streamSettings.wsSettings = {
      path,
      headers: host ? { Host: host } : {},
    };
  } else if (network === 'grpc') {
    streamSettings.grpcSettings = { serviceName: asString(config.serviceName) ?? path.replace(/^\//, '') };
  } else if (network === 'tcp' && headerType === 'http') {
    streamSettings.tcpSettings = {
      header: {
        type: 'http',
        request: {
          version: '1.1',
          method: 'GET',
          path: [path],
          headers: { Host: host ? [host] : [address] },
        },
      },
    };
  }

  return {
    log: { loglevel: 'warning' },
    inbounds: [
      {
        listen: '127.0.0.1',
        port: socksPort,
        protocol: 'socks',
        settings: { udp: true, auth: 'noauth' },
      },
    ],
    outbounds: [
      {
        protocol: 'vless',
        tag: 'proxy',
        settings: {
          vnext: [
            {
              address,
              port,
              users: [{ id: uuid, encryption, flow }],
            },
          ],
        },
        streamSettings,
      },
    ],
  };
}
