import { readFileSync } from 'node:fs';
import type { ClientEntryLinkKind } from '@afrows/shared';

/**
 * Builds the client-facing `vless://` link for the native Afrows inbound. Two
 * modes: `ws` (VLESS+WS+TLS via nginx — the reliable, widely-compatible default)
 * and `reality` (VLESS+Reality). No secrets: only public connection params.
 */

export interface AfrowsInboundParams {
  /** `xhttp` = XHTTP packet-up (over REALITY, or plain + VLESS Encryption when `vlessEncryption` is
   *  set); `http` = tcp with an HTTP request header, no TLS. */
  mode: 'ws' | 'reality' | 'xhttp' | 'http';
  host: string;
  port: number;
  serverName: string; // SNI
  fingerprint: string;
  // ws:
  wsPath?: string;
  wsHost?: string;
  /** TLS Encrypted ClientHello config source (xray `ech=`), e.g.
   *  `crypto.cloudflare.com+udp://8.8.8.8` (not 1.1.1.1: Iranian ISPs block that lookup since 2026-10). Hides the afrows SNI from ISP DPI
   *  (Shatel freezes afrows.com-SNI flows); clients without ECH ignore it. */
  ech?: string;
  // reality:
  publicKey?: string;
  shortId?: string;
  flow?: string;
  // xhttp:
  xhttpPath?: string;
  /** XHTTP `extra` JSON for the share link (e.g. xmux: one POST per connection). */
  xhttpExtra?: string;
  // http (decoy Host/path in the plain-HTTP header; the payload is VLESS-Encrypted):
  httpHost?: string;
  httpPath?: string;
  /** VLESS Encryption client string (`mlkem768x25519plus.…`); default `none`. */
  vlessEncryption?: string;
}

export function buildAfrowsEntryUri(
  params: AfrowsInboundParams,
  entryUuid: string,
  name: string,
): string {
  if (params.mode === 'xhttp' && params.vlessEncryption) {
    const x = new URLSearchParams({
      encryption: params.vlessEncryption,
      security: 'none',
      type: 'xhttp',
      host: params.httpHost ?? '',
      path: params.xhttpPath || '/',
      mode: 'packet-up',
    });
    if (params.xhttpExtra) x.set('extra', params.xhttpExtra);
    return `vless://${entryUuid}@${params.host}:${params.port}?${x.toString()}#${encodeURIComponent(name)}`;
  }
  if (params.mode === 'http') {
    const h = new URLSearchParams({
      encryption: params.vlessEncryption || 'none',
      security: 'none',
      type: 'tcp',
      headerType: 'http',
      host: params.httpHost ?? '',
      path: params.httpPath || '/',
    });
    return `vless://${entryUuid}@${params.host}:${params.port}?${h.toString()}#${encodeURIComponent(name)}`;
  }
  const q = new URLSearchParams({ encryption: 'none', fp: params.fingerprint, sni: params.serverName });
  if (params.mode === 'ws') {
    q.set('security', 'tls');
    q.set('type', 'ws');
    q.set('host', params.wsHost || params.serverName);
    q.set('path', params.wsPath || '/');
    if (params.ech) q.set('ech', params.ech);
  } else {
    q.set('security', 'reality');
    q.set('type', params.mode === 'xhttp' ? 'xhttp' : 'tcp');
    if (params.mode === 'xhttp') {
      q.set('path', params.xhttpPath || '/');
      q.set('mode', 'packet-up');
    }
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

/**
 * XHTTP client `extra` for the direct USA link: one POST per fresh TCP connection, so no
 * upload flow lives long enough for Iranian DPI to cut it (the Iran->USA chain fix).
 */
export const US_DIRECT_XHTTP_EXTRA = JSON.stringify({
  scMaxEachPostBytes: 32000,
  scMinPostsIntervalMs: 5,
  xmux: { maxConcurrency: '1', cMaxReuseTimes: '1', hMaxRequestTimes: '1', hMaxReusableSecs: '1' },
});

/**
 * The DIRECT USA entries (no Cloudflare; MCI throttles Cloudflare after the handshake,
 * 2026-11-04): up to three links to the USA box itself, from AFROWS_US_DIRECT_*, each with a
 * fixed number so a customer's report ("Direct 3 works") stays meaningful:
 *   1 REALITY (PBK, SID, REALITY_PORT, REALITY_SNI);
 *   2 XHTTP packet-up + VLESS Encryption, no TLS (XHTTP_PORT, XHTTP_PATH);
 *   3 tcp HTTP header + VLESS Encryption (HTTP_PORT, HTTP_PATH).
 * 2 and 3 share HTTP_HOST (decoy Host) and HTTP_ENCRYPTION. ENABLED + HOST gate all; FP default ios.
 * Returned best-first as measured on MCI, Irancell and Shatel: 1, 3, 2.
 * Same customer uuid and the same per-user 2x metering as the Cloudflare USA link.
 */
export function readAfrowsUsDirectEnv(
  env: Record<string, string | undefined>,
): Array<{ slot: number; params: AfrowsInboundParams }> {
  const get = (key: string) => env[`AFROWS_US_DIRECT_${key}`]?.trim() || undefined;
  if (!['1', 'true', 'yes', 'on'].includes(get('ENABLED')?.toLowerCase() ?? '')) return [];
  const host = get('HOST');
  if (!host) return [];
  const port = (key: string) => {
    const value = Number(get(key));
    return Number.isInteger(value) && value > 0 && value <= 65535 ? value : null;
  };
  const fingerprint = get('FP') || 'ios';
  const publicKey = get('PBK');
  const shortId = get('SID');
  const httpHost = get('HTTP_HOST');
  const vlessEncryption = get('HTTP_ENCRYPTION');
  const entries: Array<{ slot: number; params: AfrowsInboundParams }> = [];
  const realityPort = port('REALITY_PORT');
  const realitySni = get('REALITY_SNI');
  if (publicKey && shortId && realityPort && realitySni) {
    entries.push({ slot: 1, params: { mode: 'reality', host, port: realityPort, serverName: realitySni, fingerprint, publicKey, shortId } });
  }
  const httpPort = port('HTTP_PORT');
  if (httpPort && httpHost && vlessEncryption) {
    entries.push({
      slot: 3,
      params: { mode: 'http', host, port: httpPort, serverName: httpHost, fingerprint, httpHost, httpPath: get('HTTP_PATH') || '/', vlessEncryption },
    });
  }
  const xhttpPort = port('XHTTP_PORT');
  if (xhttpPort && httpHost && vlessEncryption) {
    entries.push({
      slot: 2,
      params: {
        mode: 'xhttp', host, port: xhttpPort, serverName: httpHost, fingerprint, httpHost, vlessEncryption,
        xhttpPath: get('XHTTP_PATH') || '/', xhttpExtra: US_DIRECT_XHTTP_EXTRA,
      },
    });
  }
  return entries;
}

/**
 * Per-country Hexogate entries (kind `hexo`): the customer connects to the Afrows Iran server
 * over the SAME VLESS+WS+TLS path as the native "Afrows Shatel" entry (nginx :443 → WS on
 * 127.0.0.1), differing only by a per-country ws path `/afrowsws-<cc>`. nginx routes that path
 * to the internal `hexo-in-<cc>` inbound, which chains out through the operator's Hexogate
 * front to the exit country; bytes meter on the Afrows inbound exactly as today. There is NO
 * REALITY inbound on the live Afrows box, so each `Hexo <CC>` link reuses the WS entry's
 * host/port(443)/sni/fp/host/ech verbatim (read from `readAfrowsInboundEnv`) and overrides
 * ONLY the ws path — byte-identical to the `Afrows Shatel` entry except `path`.
 *
 * Gated by AFROWS_HEXO_ENTRY_ENABLED (default off). Parametric over AFROWS_HEXO_ENTRY_PORTS
 * (`CC:port`, shared verbatim with afrows-hexo-egress-sync.py) — the per-country port is the
 * INTERNAL hexo-in-<cc> listener the reconciler opens, NOT the customer-facing port (always
 * 443), so the map is used here only to enumerate the countries. Optionally narrowed to
 * AFROWS_HEXO_COUNTRIES. The operator's Hexogate UUID never appears: the link carries the
 * customer's own entry uuid. Returns [] unless enabled AND the base WS inbound is configured.
 *
 * Finding 6 (no dead links): when `resolved` is given (a non-null set of live-listener CCs
 * from the reconciler's state file), a country is emitted only if it is in that set, so a
 * `Hexo <CC>` link never points at a path with no listener. `null`/omitted keeps the old
 * behaviour (every configured country). An empty set yields no hexo entries.
 */
export function readAfrowsHexoEntriesEnv(
  env: Record<string, string | undefined>,
  resolved?: ReadonlySet<string> | null,
): Array<{ cc: string; params: AfrowsInboundParams }> {
  const enabled = ['1', 'true', 'yes', 'on'].includes(env.AFROWS_HEXO_ENTRY_ENABLED?.trim().toLowerCase() ?? '');
  if (!enabled) return [];
  // Hexo entries ARE the native WS entry with a per-country path; no WS inbound -> no hexo links.
  const base = readAfrowsInboundEnv(env);
  if (!base || base.mode !== 'ws') return [];
  const only = new Set(
    (env.AFROWS_HEXO_COUNTRIES ?? '').split(',').map((c) => c.trim().toUpperCase()).filter(Boolean),
  );
  const out: Array<{ cc: string; params: AfrowsInboundParams }> = [];
  for (const entry of (env.AFROWS_HEXO_ENTRY_PORTS ?? HEXO_DEFAULT_PORTS).split(',')) {
    const [ccRaw, portRaw] = entry.split(':');
    const cc = ccRaw?.trim().toUpperCase();
    const port = Number(portRaw);
    // port validated to keep parity with the reconciler's CC:port contract; the customer link
    // stays on the base WS port (443) and differentiates the country by ws path, not by port.
    if (!cc || !Number.isInteger(port) || port <= 0 || port > 65535) continue;
    if (only.size && !only.has(cc)) continue;
    if (resolved && !resolved.has(cc)) continue; // Finding 6: only countries with a live listener
    out.push({ cc, params: { ...base, wsPath: `/afrowsws-${cc.toLowerCase()}` } });
  }
  return out;
}

/** Default CC:port map; must match afrows-hexo-egress-sync.py DEFAULT_PORTS. The port is the
 *  internal hexo-in-<cc> listener (nginx maps /afrowsws-<cc> → 127.0.0.1:port); the customer
 *  link itself always dials the base WS port (443). */
export const HEXO_DEFAULT_PORTS = 'DE:8460,NL:8461,SE:8462,TR:8463,US:8464,AM:8465,RO:8466';

/** Freshness window for the reconciler's resolved-countries state (Finding 6): 30 minutes.
 *  The reconciler rewrites the file on every healthy tick, so a file older than this means
 *  the reconciler is stuck/offline and we fall back to the configured country list. */
export const HEXO_RESOLVED_MAX_AGE_MS = 30 * 60_000;

/**
 * Finding 6 — parse the reconciler's resolved-countries state. The file is written by
 * afrows-hexo-egress-sync.py as `{"countries":["de",...],"updated_at":<unix seconds>}` (CCs
 * lowercase, updated_at an integer unix-seconds timestamp). Returns the UPPERCASE CC set when
 * the JSON is well-formed AND fresh (updated_at within HEXO_RESOLVED_MAX_AGE_MS of `nowMs`);
 * returns `null` when absent/malformed/stale so the caller falls back to AFROWS_HEXO_COUNTRIES.
 * An empty-but-fresh `countries` array returns an empty set (meaning: advertise no hexo links).
 * Pure: the file read is `readHexoResolvedCountries`.
 */
export function parseHexoResolvedCountries(
  fileText: string | null | undefined,
  nowMs: number,
  maxAgeMs: number = HEXO_RESOLVED_MAX_AGE_MS,
): Set<string> | null {
  if (!fileText) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileText);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const { countries, updated_at: updatedAt } = parsed as { countries?: unknown; updated_at?: unknown };
  if (!Array.isArray(countries) || typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)) return null;
  // Stale (or an absurd future clock, which we also treat as untrustworthy) -> fall back.
  if (Math.abs(nowMs - updatedAt * 1000) > maxAgeMs) return null;
  const ccs = countries
    .filter((c): c is string => typeof c === 'string')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  return new Set(ccs);
}

/**
 * Finding 6 — read + parse the reconciler's resolved-countries state from
 * AFROWS_HEXO_RESOLVED_PATH (default /var/lib/afrows/hexo-resolved.json). Returns the fresh
 * UPPERCASE CC set, or `null` (absent/unreadable/malformed/stale) to fall back to the
 * configured country list. Best-effort I/O: any read error is swallowed as "fall back".
 */
export function readHexoResolvedCountries(
  env: Record<string, string | undefined>,
  nowMs: number = Date.now(),
): Set<string> | null {
  const path = env.AFROWS_HEXO_RESOLVED_PATH?.trim() || '/var/lib/afrows/hexo-resolved.json';
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return null;
  }
  return parseHexoResolvedCountries(text, nowMs);
}

/** Remarks for each entry link: per-customer (dashboard/bot) or fixed ASCII (public subscription). */
export type EntryLinkRemarks = Record<ClientEntryLinkKind, string>;

/** Fixed, PII-free remarks for the publicly fetched subscription body. `hexo` is a base;
 *  the per-country entry appends the country code ("Afro DE"). */
export const PUBLIC_ENTRY_LINK_REMARKS: EntryLinkRemarks = {
  germany: 'Afrows Germany',
  iran: 'Afrows Shatel',
  usa: 'USA AI Support 2x',
  hexo: 'Afro',
};

/** Customer-facing remarks: "<name> · Germany" / "<name> · Shatel" / "<name> · USA AI Support 2x" / "<name> · Afro <CC>". */
export function customerEntryLinkRemarks(displayName: string): EntryLinkRemarks {
  const name = displayName.trim() || 'Afrows';
  return {
    germany: `${name} · Germany`,
    iran: `${name} · Shatel`,
    usa: `${name} · USA AI Support 2x`,
    hexo: `${name} · Afro`,
  };
}

/**
 * Every VLESS entry link for one entry uuid, in order: Germany (de.afrows.com via
 * Cloudflare, fast but frozen on Shatel), Iran (afrows-in, works on Shatel; also
 * exits in Germany), then the direct USA entries, then USA via Cloudflare (us.afrows.com).
 * Each is present only when its env is configured.
 */
export function buildEntryLinkSet(
  env: Record<string, string | undefined>,
  entryUuid: string | null | undefined,
  remarks: EntryLinkRemarks,
  hexoResolved?: ReadonlySet<string> | null,
): Array<{ kind: ClientEntryLinkKind; uri: string }> {
  if (!entryUuid) return [];
  const links: Array<{ kind: ClientEntryLinkKind; uri: string }> = [];
  const germany = readAfrowsDeEntryEnv(env);
  if (germany) links.push({ kind: 'germany', uri: buildAfrowsEntryUri(germany, entryUuid, remarks.germany) });
  const iran = readAfrowsInboundEnv(env);
  if (iran) {
    links.push({ kind: 'iran', uri: buildAfrowsEntryUri(iran, entryUuid, remarks.iran) });
    // Extra entry IPs for the same Iran inbound (AFROWS_INBOUND_EXTRA_HOSTS, comma-separated),
    // e.g. the old server that DNATs to this one: same link through another datacenter's route,
    // so customers can compare which entry their ISP reaches better. Named "<Shatel> 2", "3", …
    readInboundExtraHosts(env).forEach((host, index) => {
      links.push({ kind: 'iran', uri: buildAfrowsEntryUri({ ...iran, host }, entryUuid, `${remarks.iran} ${index + 2}`) });
    });
  }
  // Direct USA entries first (no Cloudflare; they work on MCI, Irancell and Shatel), best-first,
  // named "<USA remark> · Direct <slot>"; the Cloudflare USA link last.
  for (const { slot, params } of readAfrowsUsDirectEnv(env)) {
    links.push({ kind: 'usa', uri: buildAfrowsEntryUri(params, entryUuid, `${remarks.usa} · Direct ${slot}`) });
  }
  const usa = readAfrowsUsEntryEnv(env);
  if (usa) links.push({ kind: 'usa', uri: buildAfrowsEntryUri(usa, entryUuid, remarks.usa) });
  // Per-country Hexogate entries (chained through the metered Afrows inbound), named
  // "<base> <CC>" (e.g. "Hexo DE"). Parametric over the country/port table — no hand-written
  // per-country blocks. Gated per-customer downstream by gateEntryLinks (foreign-exit access).
  for (const { cc, params } of readAfrowsHexoEntriesEnv(env, hexoResolved)) {
    links.push({ kind: 'hexo', uri: buildAfrowsEntryUri(params, entryUuid, `${remarks.hexo} ${cc}`) });
  }
  return links;
}

/** AFROWS_INBOUND_EXTRA_HOSTS: extra entry hosts for the Iran inbound (valid host chars only, deduped). */
export function readInboundExtraHosts(env: Record<string, string | undefined>): string[] {
  const primary = env.AFROWS_INBOUND_HOST?.trim();
  const hosts = (env.AFROWS_INBOUND_EXTRA_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter((host) => /^[A-Za-z0-9.-]+$/.test(host) && host !== primary);
  return [...new Set(hosts)];
}
