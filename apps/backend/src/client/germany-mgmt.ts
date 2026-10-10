/**
 * Pure builders for the locked-down REMOTE-EXIT SSH management channels (Germany
 * and USA). Each remote exit is reached over a single-purpose key that maps to
 * fixed remote sub-commands (a forced-command wrapper on the remote box):
 *
 *   read-usage            -> prints the site's durable usage buffer
 *                            (/var/lib/afrows/de-usage.json | us-usage.json, same format)
 *   rmu <email>           -> removes the user from the site's WS inbound
 *   adu   (JSON on stdin) -> provisions a user onto the site's WS inbound (VLESS, no flow)
 *
 *   Germany: inbound afrows-de-ws :8090, target `root@<ip>` + explicit `-i <key>`.
 *   USA:     inbound afrows-us-ws :10085, target an ssh_config Host alias
 *            (default `afrows-us-mgmt`; the alias carries hostname, key and the
 *            ProxyCommand), so no `-i` unless AFROWS_US_MGMT_KEY is set.
 *
 * The channels are FLAKY, so every real call must be best-effort + time-bounded
 * (ConnectTimeout + a hard process timeout) and NEVER block Ireland's local
 * metering/provisioning or the other site. The file keeps its historical name;
 * the Germany exports below are unchanged wrappers over the generic builders.
 *
 * No I/O, no decorators — loadable by the `node --test` type-stripping runner.
 */

/** ssh destination + optional key for one remote exit. */
export interface RemoteExitMgmtConfig {
  /** `user@host` or an ssh_config Host alias, passed as the ssh destination. */
  sshTarget: string;
  /** Path to the single-purpose private key; '' = let ssh_config pick it (no `-i`). */
  keyPath: string;
  /** ssh ConnectTimeout in seconds (bounds a hang on a flaky link). */
  connectTimeoutSeconds: number;
}

/** Germany's config always carries an explicit key (back-compat alias). */
export type DeMgmtConfig = RemoteExitMgmtConfig;

export const REMOTE_EXIT_DEFAULT_CONNECT_TIMEOUT = 10;

export const DE_MGMT_DEFAULT_SSH = 'root@162.19.253.235';
export const DE_MGMT_DEFAULT_KEY = '/etc/afrows/de_mgmt_key';
export const DE_MGMT_DEFAULT_CONNECT_TIMEOUT = REMOTE_EXIT_DEFAULT_CONNECT_TIMEOUT;

/** Germany's WS inbound the mgmt channel provisions onto (tag + port). The wrapper
 *  hard-codes the same tag for `rmu`; adu carries it in the JSON below. */
export const DE_INBOUND_TAG = 'afrows-de-ws';
export const DE_INBOUND_PORT = 8090;

/** USA mgmt target: an ssh_config Host alias (key + ProxyCommand + hostname live there). */
export const US_MGMT_DEFAULT_SSH = 'afrows-us-mgmt';
/** USA WS inbound (contract with the USA host's forced-command wrapper). */
export const US_INBOUND_TAG = 'afrows-us-ws';
export const US_INBOUND_PORT = 10085;

const TRUTHY = ['1', 'true', 'yes', 'on'];

/**
 * Build the `xray api adu` JSON for one user on a remote WS inbound. VLESS with
 * NO flow — the WS/TLS transport rejects xtls-rprx-vision. The inbound descriptor
 * MUST carry tag+port+protocol+settings or xray rejects the call. One client per
 * call (adu is idempotent per user).
 */
export function buildRemoteAduJson(uuid: string, email: string, tag: string, port: number): string {
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

/** Germany adu payload (defaults: afrows-de-ws:8090). */
export function buildDeAduJson(
  uuid: string,
  email: string,
  tag: string = DE_INBOUND_TAG,
  port: number = DE_INBOUND_PORT,
): string {
  return buildRemoteAduJson(uuid, email, tag, port);
}

/** USA adu payload (defaults: afrows-us-ws:10085). */
export function buildUsAduJson(
  uuid: string,
  email: string,
  tag: string = US_INBOUND_TAG,
  port: number = US_INBOUND_PORT,
): string {
  return buildRemoteAduJson(uuid, email, tag, port);
}

export function resolveDeMgmtConfig(env: Record<string, string | undefined>): DeMgmtConfig {
  return {
    sshTarget: env.AFROWS_DE_MGMT_SSH?.trim() || DE_MGMT_DEFAULT_SSH,
    keyPath: env.AFROWS_DE_MGMT_KEY?.trim() || DE_MGMT_DEFAULT_KEY,
    connectTimeoutSeconds: DE_MGMT_DEFAULT_CONNECT_TIMEOUT,
  };
}

/** USA: `AFROWS_US_MGMT_SSH` (default the `afrows-us-mgmt` alias), optional `AFROWS_US_MGMT_KEY`
 *  (default '' = no `-i`, the alias's IdentityFile is used). */
export function resolveUsMgmtConfig(env: Record<string, string | undefined>): RemoteExitMgmtConfig {
  return {
    sshTarget: env.AFROWS_US_MGMT_SSH?.trim() || US_MGMT_DEFAULT_SSH,
    keyPath: env.AFROWS_US_MGMT_KEY?.trim() || '',
    connectTimeoutSeconds: REMOTE_EXIT_DEFAULT_CONNECT_TIMEOUT,
  };
}

/** USA mgmt (provisioning + metering) is OFF unless AFROWS_US_MGMT_ENABLED is truthy. */
export function isUsMgmtEnabled(env: Record<string, string | undefined>): boolean {
  return TRUTHY.includes(env.AFROWS_US_MGMT_ENABLED?.trim().toLowerCase() ?? '');
}

/** Shared ssh flags: batch mode (never prompt), optional fixed key, bounded connect. */
function baseSshArgs(cfg: RemoteExitMgmtConfig): string[] {
  const args = ['-o', 'BatchMode=yes', '-o', `ConnectTimeout=${cfg.connectTimeoutSeconds}`];
  if (cfg.keyPath) args.push('-i', cfg.keyPath);
  args.push(cfg.sshTarget);
  return args;
}

/** `ssh ... <target> read-usage` -> the durable buffer JSON on stdout. */
export function remoteReadUsageArgs(cfg: RemoteExitMgmtConfig): string[] {
  return [...baseSshArgs(cfg), 'read-usage'];
}

/** `ssh ... <target> rmu <email>` -> removes the user from the site's WS inbound. */
export function remoteRemoveUserArgs(cfg: RemoteExitMgmtConfig, email: string): string[] {
  return [...baseSshArgs(cfg), 'rmu', email];
}

/** `ssh ... <target> adu` -> provisions the user; the adu JSON is passed on stdin. */
export function remoteAddUserArgs(cfg: RemoteExitMgmtConfig): string[] {
  return [...baseSshArgs(cfg), 'adu'];
}

// Historical Germany names (same argv).
export const deReadUsageArgs = remoteReadUsageArgs;
export const deRemoveUserArgs = remoteRemoveUserArgs;
export const deAddUserArgs = remoteAddUserArgs;
