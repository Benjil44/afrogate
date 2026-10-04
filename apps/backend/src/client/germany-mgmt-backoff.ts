/**
 * Circuit breaker for the Ireland->Germany SSH management channel.
 *
 * That channel rides the village tunnel; when the village is down every call
 * (read-usage each metering tick, adu per active user each membership tick,
 * rmu per over-quota user) spawns ssh and waits out ConnectTimeout, which
 * produced ~16k failed attempts + warn lines per day during the 2026-09 outage.
 *
 * Only LINK failures count — ssh's own exit 255 (connect / auth / host-key
 * error) or a process timeout. A remote sub-command that exits non-zero (e.g.
 * `rmu` of a user that is already gone) proves the link works and resets the
 * breaker, so it can never trip in normal operation.
 *
 * After `threshold` consecutive link failures the breaker opens: calls are
 * skipped (treated exactly like a failure by the caller, which already retries
 * on its next tick) for base * 2^(failures - threshold), capped at `maxMs`. When
 * the window expires ONE call is let through as a probe; success closes the
 * breaker, failure re-opens it with the next (longer) window.
 *
 * Latency cost after the link returns: at most `maxMs` (default 300 s) before
 * the next probe, i.e. Germany-side metering pulls, membership adds and
 * over-quota `rmu`s resume within <= 5 min of the link coming back.
 *
 * No I/O, no decorators — loadable by the `node --test` type-stripping runner.
 */

export interface DeMgmtBackoffConfig {
  /** Consecutive link failures before the breaker opens. */
  threshold: number;
  /** First open window (ms). */
  baseMs: number;
  /** Cap on the open window (ms) — also the worst-case resume latency. */
  maxMs: number;
}

export const DE_MGMT_BACKOFF_DEFAULTS: DeMgmtBackoffConfig = {
  threshold: 3,
  baseMs: 15_000,
  maxMs: 300_000,
};

/** `AFROWS_DE_MGMT_BACKOFF_MAX_SECONDS` (default 300, clamp 30..3600). */
export function resolveDeMgmtBackoffConfig(env: Record<string, string | undefined>): DeMgmtBackoffConfig {
  const raw = env.AFROWS_DE_MGMT_BACKOFF_MAX_SECONDS?.trim();
  const seconds = raw ? Number(raw) : NaN;
  const maxMs = Number.isFinite(seconds)
    ? Math.min(Math.max(Math.round(seconds), 30), 3600) * 1000
    : DE_MGMT_BACKOFF_DEFAULTS.maxMs;
  return { ...DE_MGMT_BACKOFF_DEFAULTS, maxMs };
}

/**
 * True when an `execFile('ssh', ...)` error means the channel itself failed
 * (vs. the remote command returning non-zero). ssh reserves exit 255 for its
 * own errors; a timeout kill surfaces as `killed`/`signal` with no exit code.
 */
export function isDeLinkFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return true;
  const e = error as { code?: unknown; killed?: unknown; signal?: unknown };
  if (e.code === 255) return true;
  if (e.killed === true || (typeof e.signal === 'string' && e.signal.length > 0)) return true;
  if (typeof e.code === 'number') return false; // remote command's own exit status
  return true; // spawn errors (ENOENT, EAGAIN ...) — the channel is unusable
}

export type DeMgmtGate = 'run' | 'probe' | 'skip';

export class DeMgmtBackoff {
  private failures = 0;
  private openUntil = 0;
  private probing = false;
  private suppressed = 0;
  private readonly cfg: DeMgmtBackoffConfig;
  private readonly now: () => number;

  // Explicit fields (no parameter properties): strip-only `node --test` can't parse those.
  constructor(cfg: DeMgmtBackoffConfig = DE_MGMT_BACKOFF_DEFAULTS, now: () => number = () => Date.now()) {
    this.cfg = cfg;
    this.now = now;
  }

  isOpen(): boolean {
    return this.failures >= this.cfg.threshold;
  }

  /** Whether a call may run now. 'probe' = the single trial call after a window. */
  gate(): DeMgmtGate {
    if (!this.isOpen()) return 'run';
    if (this.probing || this.now() < this.openUntil) {
      this.suppressed += 1;
      return 'skip';
    }
    this.probing = true;
    return 'probe';
  }

  /** The link answered. Returns how many calls were skipped if the breaker just closed. */
  onSuccess(): { closed: boolean; suppressed: number } {
    const closed = this.isOpen();
    const suppressed = this.suppressed;
    this.failures = 0;
    this.openUntil = 0;
    this.probing = false;
    this.suppressed = 0;
    return { closed, suppressed };
  }

  /** A link failure. `opened` is true only on the closed->open edge. */
  onFailure(): { opened: boolean; windowMs: number } {
    const wasOpen = this.isOpen();
    this.failures += 1;
    this.probing = false;
    if (!this.isOpen()) return { opened: false, windowMs: 0 };
    const exponent = Math.min(this.failures - this.cfg.threshold, 30);
    const windowMs = Math.min(this.cfg.baseMs * 2 ** exponent, this.cfg.maxMs);
    this.openUntil = this.now() + windowMs;
    return { opened: !wasOpen, windowMs };
  }
}
