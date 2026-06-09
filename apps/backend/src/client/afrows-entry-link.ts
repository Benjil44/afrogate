/**
 * Builds the client-facing `vless://` Reality link for the native Afrows inbound
 * (afrows-in). Uses the inbound's PUBLIC params (host/port/public-key/shortId/
 * SNI) + the user's entry UUID. No secrets here — the Reality private key stays
 * server-side; the public key + shortId are meant to be in client links.
 */

export interface AfrowsInboundParams {
  host: string;
  port: number;
  publicKey: string;
  shortId: string;
  serverName: string;
  flow: string;
  fingerprint: string;
}

export function buildAfrowsEntryUri(
  params: AfrowsInboundParams,
  entryUuid: string,
  name: string,
): string {
  const q = new URLSearchParams({
    encryption: 'none',
    security: 'reality',
    sni: params.serverName,
    fp: params.fingerprint,
    pbk: params.publicKey,
    sid: params.shortId,
    type: 'tcp',
    flow: params.flow,
  });
  return `vless://${entryUuid}@${params.host}:${params.port}?${q.toString()}#${encodeURIComponent(name)}`;
}

/**
 * Reads the afrows-in inbound public params from environment. Returns null when
 * the inbound isn't configured (host/pubkey/shortId/sni required), so the
 * subscription simply omits the native link until the operator sets them.
 */
export function readAfrowsInboundEnv(env: Record<string, string | undefined>): AfrowsInboundParams | null {
  const host = env.AFROWS_INBOUND_HOST?.trim();
  const publicKey = env.AFROWS_INBOUND_REALITY_PBK?.trim();
  const shortId = env.AFROWS_INBOUND_REALITY_SID?.trim();
  const serverName = env.AFROWS_INBOUND_REALITY_SNI?.trim();
  if (!host || !publicKey || !shortId || !serverName) return null;

  const portRaw = Number(env.AFROWS_INBOUND_PORT ?? '8443');
  const port = Number.isInteger(portRaw) && portRaw > 0 && portRaw <= 65535 ? portRaw : 8443;
  return {
    host,
    port,
    publicKey,
    shortId,
    serverName,
    flow: env.AFROWS_INBOUND_FLOW?.trim() || 'xtls-rprx-vision',
    fingerprint: env.AFROWS_INBOUND_REALITY_FP?.trim() || 'chrome',
  };
}
