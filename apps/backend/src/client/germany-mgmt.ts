/**
 * Pure builders for the locked-down Ireland->Germany SSH management channel.
 * Germany->Ireland is impossible on this topology, so Ireland reaches Germany
 * over a single-purpose key that maps to fixed remote sub-commands:
 *
 *   read-usage            -> prints /var/lib/afrows/de-usage.json
 *   rmu <email>           -> removes the user from Germany's WS inbound afrows-de-ws
 *   adu   (JSON on stdin) -> provisions a user onto afrows-de-ws (port 8090, no flow)
 *
 * Host/key are env-configurable. The channel is FLAKY (village blackout ~2h/day),
 * so every real call must be best-effort + time-bounded (ConnectTimeout + a hard
 * process timeout) and NEVER block Ireland's local metering/provisioning.
 *
 * No I/O, no decorators — loadable by the `node --test` type-stripping runner.
 */

export interface DeMgmtConfig {
  /** `user@host` passed as the ssh destination. */
  sshTarget: string;
  /** Path to the single-purpose private key on the Ireland box. */
  keyPath: string;
  /** ssh ConnectTimeout in seconds (bounds a hang on the flaky link). */
  connectTimeoutSeconds: number;
}

export const DE_MGMT_DEFAULT_SSH = 'root@162.19.253.235';
export const DE_MGMT_DEFAULT_KEY = '/etc/afrows/de_mgmt_key';
export const DE_MGMT_DEFAULT_CONNECT_TIMEOUT = 10;

/** Germany's WS inbound the mgmt channel provisions onto (tag + port). The wrapper
 *  hard-codes the same tag for `rmu`; adu carries it in the JSON below. */
export const DE_INBOUND_TAG = 'afrows-de-ws';
export const DE_INBOUND_PORT = 8090;

/**
 * Build the `xray api adu` JSON for one user on Germany's WS inbound. VLESS with
 * NO flow — the WS/TLS transport rejects xtls-rprx-vision, unlike the reality
 * inbound. The inbound descriptor MUST carry tag+port+protocol+settings or xray
 * rejects the call. One client per call (adu is idempotent per user).
 */
export function buildDeAduJson(
  uuid: string,
  email: string,
  tag: string = DE_INBOUND_TAG,
  port: number = DE_INBOUND_PORT,
): string {
  return JSON.stringify({
    inbounds: [
      {
        tag,
        port,
        protocol: 'vless',
        settings: { decryption: 'none', clients: [{ id: uuid, email, level: 0 }] },
      },
    ],
  });
}

export function resolveDeMgmtConfig(env: Record<string, string | undefined>): DeMgmtConfig {
  return {
    sshTarget: env.AFROWS_DE_MGMT_SSH?.trim() || DE_MGMT_DEFAULT_SSH,
    keyPath: env.AFROWS_DE_MGMT_KEY?.trim() || DE_MGMT_DEFAULT_KEY,
    connectTimeoutSeconds: DE_MGMT_DEFAULT_CONNECT_TIMEOUT,
  };
}

/** Shared ssh flags: batch mode (never prompt), fixed key, bounded connect. */
function baseSshArgs(cfg: DeMgmtConfig): string[] {
  return [
    '-o',
    'BatchMode=yes',
    '-o',
    `ConnectTimeout=${cfg.connectTimeoutSeconds}`,
    '-i',
    cfg.keyPath,
    cfg.sshTarget,
  ];
}

/** `ssh ... root@... read-usage` -> the durable buffer JSON on stdout. */
export function deReadUsageArgs(cfg: DeMgmtConfig): string[] {
  return [...baseSshArgs(cfg), 'read-usage'];
}

/** `ssh ... root@... rmu <email>` -> removes the user from afrows-de-ws. */
export function deRemoveUserArgs(cfg: DeMgmtConfig, email: string): string[] {
  return [...baseSshArgs(cfg), 'rmu', email];
}

/** `ssh ... root@... adu` -> provisions the user; the adu JSON is passed on stdin. */
export function deAddUserArgs(cfg: DeMgmtConfig): string[] {
  return [...baseSshArgs(cfg), 'adu'];
}
