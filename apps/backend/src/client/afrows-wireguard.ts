/**
 * Native WireGuard delivery helpers for the Afrows app: server params from env,
 * keypair generation, client-address allocation, and wg-quick `.conf` rendering.
 * No secrets are read from disk here — the server's public key + endpoint are
 * public connection params supplied via env; the client keypair is generated
 * fresh per peer and the private key is stored encrypted by the caller.
 */

import { generateKeyPairSync } from 'crypto';

export interface AfrowsWireguardServer {
  /** Kernel interface name (wg0). */
  interface: string;
  /** Server (peer) public key. */
  serverPublicKey: string;
  /** Public endpoint `host:port` (e.g. 94.74.145.199:51822). */
  endpoint: string;
  /** DNS pushed to the client. */
  dns: string;
  /** AllowedIPs for full-tunnel (default 0.0.0.0/0). */
  allowedIps: string;
  /** PersistentKeepalive seconds. */
  keepalive: number;
  /** Client tunnel MTU. The wg→xray→Germany path is stacked, so the default
   *  1420 drops large TLS packets ("connects but web hangs"); 1280 is the
   *  proven value for this server (matches the MikroTik MSS-1240 fix). */
  mtu: number;
  /** First three octets of the tunnel subnet, e.g. "10.8.0". */
  subnet: string;
  /** First host octet to allocate (reserves .1=server and the manual range below it). */
  addressStart: number;
}

/**
 * Reads the WireGuard server params from env. Returns null when not configured
 * (so the subscription simply omits the WireGuard link). Required:
 * `AFROWS_WG_SERVER_PUBLIC_KEY`, `AFROWS_WG_ENDPOINT`.
 */
export function readAfrowsWireguardEnv(
  env: Record<string, string | undefined>,
): AfrowsWireguardServer | null {
  const serverPublicKey = env.AFROWS_WG_SERVER_PUBLIC_KEY?.trim();
  const endpoint = env.AFROWS_WG_ENDPOINT?.trim();
  if (!serverPublicKey || !endpoint) return null;

  const subnetCidr = env.AFROWS_WG_SUBNET?.trim() || '10.8.0.0/24';
  const subnet = subnetCidr.split('/')[0].split('.').slice(0, 3).join('.');

  return {
    interface: env.AFROWS_WG_INTERFACE?.trim() || 'wg0',
    serverPublicKey,
    endpoint,
    dns: env.AFROWS_WG_DNS?.trim() || '1.1.1.1',
    allowedIps: env.AFROWS_WG_ALLOWED_IPS?.trim() || '0.0.0.0/0',
    keepalive: clampInt(env.AFROWS_WG_KEEPALIVE, 25, 0, 65535),
    mtu: clampInt(env.AFROWS_WG_MTU, 1280, 1280, 1500),
    subnet,
    addressStart: clampInt(env.AFROWS_WG_ADDRESS_START, 16, 2, 254),
  };
}

/**
 * Generates a WireGuard X25519 keypair (base64), matching `wg genkey`/`wg pubkey`
 * output, without shelling out to the `wg` binary.
 */
export function generateWireguardKeypair(): { privateKey: string; publicKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync('x25519');
  // The raw 32-byte scalar / u-coordinate is the trailing 32 bytes of the
  // PKCS8 / SPKI DER encodings respectively.
  const privRaw = privateKey.export({ type: 'pkcs8', format: 'der' }).subarray(-32);
  const pubRaw = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);
  return { privateKey: privRaw.toString('base64'), publicKey: pubRaw.toString('base64') };
}

/**
 * Allocates the next free client address (`x.y.z.h/32`) given the addresses
 * already in use. Skips .1 (server) and anything below `addressStart`. Returns
 * null when the /24 is exhausted.
 */
export function nextWireguardAddress(
  usedAddresses: string[],
  server: AfrowsWireguardServer,
): string | null {
  const usedHosts = new Set<number>();
  for (const addr of usedAddresses) {
    const m = addr.match(/^\s*\d+\.\d+\.\d+\.(\d+)/);
    if (m) usedHosts.add(Number(m[1]));
  }
  for (let host = Math.max(server.addressStart, 2); host <= 254; host++) {
    if (!usedHosts.has(host)) return `${server.subnet}.${host}/32`;
  }
  return null;
}

/**
 * Returns a full-tunnel AllowedIPs rewritten to cover all of 0.0.0.0/0 EXCEPT
 * `host`/32 (the VPN server's own IP) — so the client reaches that host directly
 * while connected. Null if `host` isn't IPv4. 32 sibling CIDRs (standard /32 exclude).
 */
function allowedIpsExcludingHost(host: string, original: string): string | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  let addr = 0;
  for (let i = 1; i <= 4; i++) {
    const octet = Number(m[i]);
    if (octet > 255) return null;
    addr = ((addr << 8) | octet) >>> 0;
  }
  const cidrs: string[] = [];
  for (let prefix = 0; prefix < 32; prefix++) {
    const sibling = (addr ^ ((1 << (31 - prefix)) >>> 0)) >>> 0;
    const plen = prefix + 1;
    const mask = (0xffffffff << (32 - plen)) >>> 0;
    const net = (sibling & mask) >>> 0;
    cidrs.push(`${(net >>> 24) & 255}.${(net >>> 16) & 255}.${(net >>> 8) & 255}.${net & 255}/${plen}`);
  }
  return /::\/0/.test(original) ? `${cidrs.join(', ')}, ::/0` : cidrs.join(', ');
}

/** Renders a wg-quick `.conf` for a client peer. */
export function buildWireguardConf(opts: {
  privateKey: string;
  address: string;
  server: AfrowsWireguardServer;
  presharedKey?: string | null;
}): string {
  const { privateKey, address, server, presharedKey } = opts;
  // Split-tunnel the server's own IP out of a full tunnel, so the app can still
  // reach the Afrows API (same host) WHILE connected — otherwise 0.0.0.0/0 swallows
  // the in-app usage poll and the up/down stats read 0 forever.
  const endpointHost = server.endpoint.split(':')[0].trim();
  const allowedIps = /(^|[\s,])0\.0\.0\.0\/0([\s,]|$)/.test(server.allowedIps)
    ? allowedIpsExcludingHost(endpointHost, server.allowedIps) ?? server.allowedIps
    : server.allowedIps;
  const lines = [
    '[Interface]',
    `PrivateKey = ${privateKey}`,
    `Address = ${address}`,
    server.dns ? `DNS = ${server.dns}` : null,
    server.mtu > 0 ? `MTU = ${server.mtu}` : null,
    '',
    '[Peer]',
    `PublicKey = ${server.serverPublicKey}`,
    presharedKey ? `PresharedKey = ${presharedKey}` : null,
    `AllowedIPs = ${allowedIps}`,
    `Endpoint = ${server.endpoint}`,
    server.keepalive > 0 ? `PersistentKeepalive = ${server.keepalive}` : null,
  ].filter((line): line is string => line !== null);
  return lines.join('\n');
}

function clampInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) return fallback;
  return n;
}
