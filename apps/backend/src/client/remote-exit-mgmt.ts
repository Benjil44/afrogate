/**
 * One remote exit's (Germany, USA) best-effort SSH management channel:
 * read-usage / rmu / adu over a forced-command wrapper, guarded by that site's
 * OWN circuit breaker. Every method isolates its failure: a link going down
 * NEVER throws into a caller, so Ireland's local metering/provisioning and the
 * other remote exit are unaffected. Never logs the email (it carries the
 * client_config uuid), the argv, or any key material — only the sub-command name.
 *
 * Collaborators (backoff, argv builders, ssh exec, logger, config) are injected
 * so this file has no relative runtime imports: the `node --test` strip-types
 * runner loads it directly, and the Nest services (germany-mgmt.service.ts,
 * usa-mgmt.service.ts) just wire the real pieces.
 */
import type { RemoteExitMgmtConfig } from './germany-mgmt';

export type RemoteExitGate = 'run' | 'probe' | 'skip';

/** The breaker surface used here (DeMgmtBackoff implements it). */
export interface RemoteExitBackoff {
  gate(): RemoteExitGate;
  onSuccess(): { closed: boolean; suppressed: number };
  onFailure(): { opened: boolean; windowMs: number };
}

export interface RemoteExitLogger {
  log(message: string): void;
  warn(message: string): void;
  debug(message: string): void;
}

export interface RemoteExitMgmtDeps {
  /** Human label for logs ("Germany", "USA"). Never carries secrets. */
  label: string;
  /** false = the site is switched off: every call is a no-op (no ssh is spawned). */
  enabled(): boolean;
  config(): RemoteExitMgmtConfig;
  /** The WS inbound adu provisions onto. */
  inbound(): { tag: string; port: number };
  backoff: RemoteExitBackoff;
  isLinkFailure(error: unknown): boolean;
  readUsageArgs(cfg: RemoteExitMgmtConfig): string[];
  removeUserArgs(cfg: RemoteExitMgmtConfig, email: string): string[];
  addUserArgs(cfg: RemoteExitMgmtConfig): string[];
  buildAduJson(uuid: string, email: string, tag: string, port: number): string;
  /** Runs `ssh <args>` (stdin optional); rejects with the execFile error. */
  exec(args: string[], stdin?: string): Promise<{ stdout: string }>;
  logger: RemoteExitLogger;
}

export class RemoteExitMgmt {
  private readonly deps: RemoteExitMgmtDeps;

  // Explicit field (no parameter properties): strip-only `node --test` can't parse those.
  constructor(deps: RemoteExitMgmtDeps) {
    this.deps = deps;
  }

  get label(): string {
    return this.deps.label;
  }

  isEnabled(): boolean {
    return this.deps.enabled();
  }

  /** Pull the durable usage buffer. Returns the raw JSON stdout, or null on any
   *  failure (disabled, link down / backing off, key missing, non-zero exit, timeout). */
  async readUsage(): Promise<string | null> {
    if (!this.isEnabled()) return null;
    const result = await this.run('read-usage', this.deps.readUsageArgs(this.deps.config()));
    return result === null ? null : result.stdout;
  }

  /** Remove one user from the site's WS inbound. Best-effort; true iff it ran clean. */
  async removeUser(email: string): Promise<boolean> {
    if (!this.isEnabled()) return false;
    return (await this.run('rmu', this.deps.removeUserArgs(this.deps.config(), email))) !== null;
  }

  /** Provision one user (adu JSON on stdin). Best-effort. */
  async addUser(aduConfigJson: string): Promise<boolean> {
    if (!this.isEnabled()) return false;
    return (await this.run('adu', this.deps.addUserArgs(this.deps.config()), aduConfigJson)) !== null;
  }

  /** Re-provision a user onto the site's WS inbound by identity (builds the adu
   *  JSON). Idempotent on the remote side — a user that still exists is a no-op. */
  async addUserByIdentity(uuid: string, email: string): Promise<boolean> {
    const { tag, port } = this.deps.inbound();
    return this.addUser(this.deps.buildAduJson(uuid, email, tag, port));
  }

  /**
   * One guarded ssh call. null = failed or skipped by the breaker (callers treat
   * both the same way and retry on their next tick). Never throws.
   */
  private async run(op: string, args: string[], stdin?: string): Promise<{ stdout: string } | null> {
    const { backoff, logger, label } = this.deps;
    const gate = backoff.gate();
    if (gate === 'skip') return null;
    try {
      const result = await this.deps.exec(args, stdin);
      this.linkUp();
      return result;
    } catch (error) {
      if (!this.deps.isLinkFailure(error)) {
        this.linkUp(); // the remote command answered: the channel itself is fine
        logger.warn(`${label} ${op} failed: ${remoteExitErrMsg(error)}`);
        return null;
      }
      const { opened, windowMs } = backoff.onFailure();
      if (opened) {
        logger.warn(
          `${label} mgmt link unreachable (${op}: ${remoteExitErrMsg(error)}); backing off — next probe in ${Math.round(windowMs / 1000)}s, further failures logged at debug until it recovers`,
        );
      } else if (gate === 'probe') {
        logger.debug(`${label} mgmt probe (${op}) failed; next probe in ${Math.round(windowMs / 1000)}s`);
      } else {
        logger.warn(`${label} ${op} failed: ${remoteExitErrMsg(error)}`);
      }
      return null;
    }
  }

  private linkUp(): void {
    const { closed, suppressed } = this.deps.backoff.onSuccess();
    if (closed) this.deps.logger.log(`${this.deps.label} mgmt link restored; ${suppressed} call(s) were skipped during backoff`);
  }
}

/**
 * Exit status only. execFile's `error.message` is "Command failed: ssh ...
 * rmu <email>" — the full argv, which carries the client_config uuid — so it
 * must never reach the log.
 */
export function remoteExitErrMsg(error: unknown): string {
  if (!error || typeof error !== 'object') return 'unknown error';
  const e = error as { code?: unknown; signal?: unknown; killed?: unknown };
  if (e.killed === true) return 'timeout';
  if (typeof e.signal === 'string' && e.signal) return `signal ${e.signal}`;
  if (typeof e.code === 'number') return `exit ${e.code}`;
  if (typeof e.code === 'string') return e.code; // spawn errors (ENOENT ...)
  return 'unknown error';
}
