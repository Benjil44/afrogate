export interface ParsedVless {
  name: string;
  type: 'vless-local-proxy';
  config: Record<string, unknown>;
}

/**
 * Parse a `vless://` share link into a self-contained outbound config used for
 * monitoring/health-testing (NOT wired into the subscription renderer).
 * Throws on malformed input.
 */
export function parseVlessUrl(input: string): ParsedVless {
  const raw = input.trim();
  if (!raw.toLowerCase().startsWith('vless://')) {
    throw new Error('Not a vless:// link');
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Malformed vless:// link');
  }

  const uuid = decodeURIComponent(url.username);
  const address = url.hostname;
  const port = Number(url.port || '443');
  if (!uuid || !address || !Number.isInteger(port)) {
    throw new Error('Malformed vless:// link');
  }

  const q = url.searchParams;
  const name = url.hash ? decodeURIComponent(url.hash.slice(1)) : `${address}:${port}`;

  const config: Record<string, unknown> = {
    address,
    port,
    uuid,
    encryption: q.get('encryption') ?? 'none',
    security: q.get('security') ?? 'none',
    serverName: q.get('sni') ?? q.get('peer') ?? undefined,
    flow: q.get('flow') || undefined,
    network: q.get('type') ?? 'tcp',
    headerType: q.get('headerType') || undefined,
    host: q.get('host') || undefined,
    path: q.get('path') ? decodeURIComponent(q.get('path') as string) : undefined,
    fingerprint: q.get('fp') || undefined,
    publicKey: q.get('pbk') || undefined,
    shortId: q.get('sid') || undefined,
  };
  for (const key of Object.keys(config)) {
    if (config[key] === undefined) delete config[key];
  }

  return { name, type: 'vless-local-proxy', config };
}
