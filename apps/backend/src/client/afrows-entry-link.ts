/**
 * Builds the client-facing `vless://` link for the native Afrows inbound. Two
 * modes: `ws` (VLESS+WS+TLS via nginx — the reliable, widely-compatible default)
 * and `reality` (VLESS+Reality). No secrets: only public connection params.
 */

export interface AfrowsInboundParams {
  mode: 'ws' | 'reality';
  host: string;
  port: number;
  serverName: string; // SNI
  fingerprint: string;
  // ws:
  wsPath?: string;
  wsHost?: string;
  // reality:
  publicKey?: string;
  shortId?: string;
  flow?: string;
}

export function buildAfrowsEntryUri(
  params: AfrowsInboundParams,
  entryUuid: string,
  name: string,
): string {
  const q = new URLSearchParams({ encryption: 'none', fp: params.fingerprint, sni: params.serverName });
  if (params.mode === 'ws') {
    q.set('security', 'tls');
    q.set('type', 'ws');
    q.set('host', params.wsHost || params.serverName);
    q.set('path', params.wsPath || '/');
  } else {
    q.set('security', 'reality');
    q.set('type', 'tcp');
    q.set('pbk', params.publicKey ?? '');
    q.set('sid', params.shortId ?? '');
    if (params.flow) q.set('flow', params.flow);
  }
  return `vless://${entryUuid}@${params.host}:${params.port}?${q.toString()}#${encodeURIComponent(name)}`;
}

/**
 * Reads the inbound public params from environment. Returns null when not
 * configured (so the subscription omits the native link). `AFROWS_INBOUND_MODE`
 * selects ws (default) or reality.
 */
export function readAfrowsInboundEnv(env: Record<string, string | undefined>): AfrowsInboundParams | null {
  const host = env.AFROWS_INBOUND_HOST?.trim();
  const serverName = env.AFROWS_INBOUND_REALITY_SNI?.trim() || env.AFROWS_INBOUND_SNI?.trim();
  if (!host || !serverName) return null;

  const portRaw = Number(env.AFROWS_INBOUND_PORT ?? '443');
  const port = Number.isInteger(portRaw) && portRaw > 0 && portRaw <= 65535 ? portRaw : 443;
  const fingerprint = env.AFROWS_INBOUND_REALITY_FP?.trim() || 'chrome';
  const mode = (env.AFROWS_INBOUND_MODE?.trim() || 'reality') === 'ws' ? 'ws' : 'reality';

  if (mode === 'ws') {
    return {
      mode: 'ws',
      host,
      port,
      serverName,
      fingerprint,
      wsPath: env.AFROWS_INBOUND_WS_PATH?.trim() || '/',
      wsHost: env.AFROWS_INBOUND_WS_HOST?.trim() || serverName,
    };
  }

  const publicKey = env.AFROWS_INBOUND_REALITY_PBK?.trim();
  const shortId = env.AFROWS_INBOUND_REALITY_SID?.trim();
  if (!publicKey || !shortId) return null;
  return {
    mode: 'reality',
    host,
    port,
    serverName,
    fingerprint,
    publicKey,
    shortId,
    flow: env.AFROWS_INBOUND_FLOW?.trim() || 'xtls-rprx-vision',
  };
}
