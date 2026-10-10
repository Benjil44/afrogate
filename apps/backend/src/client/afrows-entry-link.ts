import type { ClientEntryLinkKind } from '@afrows/shared';

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
  /** TLS Encrypted ClientHello config source (xray `ech=`), e.g.
   *  `crypto.cloudflare.com+udp://1.1.1.1`. Hides the afrows SNI from ISP DPI
   *  (Shatel freezes afrows.com-SNI flows); clients without ECH ignore it. */
  ech?: string;
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
    if (params.ech) q.set('ech', params.ech);
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
      ech: env.AFROWS_INBOUND_ECH?.trim() || undefined,
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

/**
 * Reads a SEPARATE Reality inbound (delivered ALONGSIDE the primary WS link, so
 * clients get both a widely-compatible WS entry and a block-resistant Reality
 * entry). Returns null unless AFROWS_REALITY_HOST/SNI/PBK/SID are all set.
 * `AFROWS_REALITY_FLOW` is optional (omit for no-vision, matching our inbound).
 */
export function readAfrowsRealityEnv(env: Record<string, string | undefined>): AfrowsInboundParams | null {
  const host = env.AFROWS_REALITY_HOST?.trim();
  const serverName = env.AFROWS_REALITY_SNI?.trim();
  const publicKey = env.AFROWS_REALITY_PBK?.trim();
  const shortId = env.AFROWS_REALITY_SID?.trim();
  if (!host || !serverName || !publicKey || !shortId) return null;

  const portRaw = Number(env.AFROWS_REALITY_PORT ?? '8443');
  const port = Number.isInteger(portRaw) && portRaw > 0 && portRaw <= 65535 ? portRaw : 8443;
  return {
    mode: 'reality',
    host,
    port,
    serverName,
    fingerprint: env.AFROWS_REALITY_FP?.trim() || 'chrome',
    publicKey,
    shortId,
    flow: env.AFROWS_REALITY_FLOW?.trim() || undefined,
  };
}

/**
 * Reads a remote-exit entry (Germany or USA) from `<prefix>_*` env:
 * ENABLED (gate, default off), HOST + SNI (required), PORT (443), FP (chrome),
 * MODE (`ws` default | `reality`), WS_PATH, WS_HOST (defaults to SNI), ECH; for
 * reality PBK + SID (required) and FLOW. Null unless enabled AND complete.
 */
function readRemoteEntryEnv(
  env: Record<string, string | undefined>,
  prefix: 'AFROWS_DE_ENTRY' | 'AFROWS_US_ENTRY',
  defaultWsPath: string,
): AfrowsInboundParams | null {
  const get = (key: string) => env[`${prefix}_${key}`]?.trim();
  if (!['1', 'true', 'yes', 'on'].includes(get('ENABLED')?.toLowerCase() ?? '')) return null;

  const host = get('HOST');
  const serverName = get('SNI');
  if (!host || !serverName) return null;

  const portRaw = Number(get('PORT') || '443');
  const port = Number.isInteger(portRaw) && portRaw > 0 && portRaw <= 65535 ? portRaw : 443;
  const fingerprint = get('FP') || 'chrome';
  const mode = (get('MODE') || 'ws') === 'reality' ? 'reality' : 'ws';

  if (mode === 'ws') {
    return {
      mode: 'ws',
      host,
      port,
      serverName,
      fingerprint,
      wsPath: get('WS_PATH') || defaultWsPath,
      wsHost: get('WS_HOST') || serverName,
      ech: get('ECH') || undefined,
    };
  }

  const publicKey = get('PBK');
  const shortId = get('SID');
  if (!publicKey || !shortId) return null;
  return {
    mode: 'reality',
    host,
    port,
    serverName,
    fingerprint,
    publicKey,
    shortId,
    flow: get('FLOW') || undefined,
  };
}

/**
 * Reads the NEW remote Germany entry (data plane: client->Cloudflare->tunnel->Germany
 * ->exit; fast, no Ireland/village hop). Emitted FIRST in the subscription as the
 * primary, with the existing Ireland/village entries kept as failover. This is an
 * ENTRY only (no exit creds) so per-user metering on the Germany xray is preserved.
 * Gated on AFROWS_DE_ENTRY_ENABLED (default off); WS path default /afrowsws.
 */
export function readAfrowsDeEntryEnv(env: Record<string, string | undefined>): AfrowsInboundParams | null {
  return readRemoteEntryEnv(env, 'AFROWS_DE_ENTRY', '/afrowsws');
}

/**
 * Reads the remote USA entry (client->Cloudflare->USA xray inbound afrows-us-ws
 * ->exit in the USA): an alternative exit, emitted after Germany and Shatel. Same
 * contract as Germany: gated on AFROWS_US_ENTRY_ENABLED (default off), HOST
 * (a Cloudflare IP) and SNI (us.afrows.com) required, WS path default /afrowsus.
 */
export function readAfrowsUsEntryEnv(env: Record<string, string | undefined>): AfrowsInboundParams | null {
  return readRemoteEntryEnv(env, 'AFROWS_US_ENTRY', '/afrowsus');
}

/** Remarks for each entry link: per-customer (dashboard/bot) or fixed ASCII (public subscription). */
export type EntryLinkRemarks = Record<ClientEntryLinkKind, string>;

/** Fixed, PII-free remarks for the publicly fetched subscription body. */
export const PUBLIC_ENTRY_LINK_REMARKS: EntryLinkRemarks = {
  germany: 'Afrows Germany',
  iran: 'Afrows Shatel',
  usa: 'Afrows USA',
};

/** Customer-facing remarks: "<name> · Germany" / "<name> · Shatel" / "<name> · USA". */
export function customerEntryLinkRemarks(displayName: string): EntryLinkRemarks {
  const name = displayName.trim() || 'Afrows';
  return { germany: `${name} · Germany`, iran: `${name} · Shatel`, usa: `${name} · USA` };
}

/**
 * Every VLESS entry link for one entry uuid, in order: Germany (de.afrows.com via
 * Cloudflare, fast but frozen on Shatel), Iran (afrows-in, works on Shatel; also
 * exits in Germany), then USA (us.afrows.com via Cloudflare, alternative exit).
 * Each is present only when its env is configured.
 */
export function buildEntryLinkSet(
  env: Record<string, string | undefined>,
  entryUuid: string | null | undefined,
  remarks: EntryLinkRemarks,
): Array<{ kind: ClientEntryLinkKind; uri: string }> {
  if (!entryUuid) return [];
  const links: Array<{ kind: ClientEntryLinkKind; uri: string }> = [];
  const germany = readAfrowsDeEntryEnv(env);
  if (germany) links.push({ kind: 'germany', uri: buildAfrowsEntryUri(germany, entryUuid, remarks.germany) });
  const iran = readAfrowsInboundEnv(env);
  if (iran) links.push({ kind: 'iran', uri: buildAfrowsEntryUri(iran, entryUuid, remarks.iran) });
  const usa = readAfrowsUsEntryEnv(env);
  if (usa) links.push({ kind: 'usa', uri: buildAfrowsEntryUri(usa, entryUuid, remarks.usa) });
  return links;
}
