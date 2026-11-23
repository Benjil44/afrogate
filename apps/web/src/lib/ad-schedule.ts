/**
 * Voice ads between tracks (Borjino plan `music-v2/06_ADS_AND_PLACES_PLAN.md` §3, afrows insertion
 * rule). Pure and dependency-free so `node --test` can run it with type stripping
 * (`apps/web/test/ad-schedule.test.ts`); the player (`player.tsx`) owns the audio side.
 *
 * Feed: `ads.v1.json` next to the track manifest, public and unsigned. Every field is untrusted.
 * Accepted shape (the plan's, plus the aliases the Lead's task card uses):
 *   { version?: 1, settings: { enabled?, every_n_tracks, min_minutes_between, per_break?,
 *     max_per_hour?, max_duration_s? },
 *     ads: [{ id, url | file, duration_ms? | duration_s?, gain_db?, active_from?, active_until? }] }
 * Titles are never read: players only ever show "Advertisement".
 * Anything missing / invalid / empty, or `enabled: false` -> `null` = no ads, music unaffected.
 *
 * Rule:
 * - A break is considered ONLY after a track ends naturally (`ended` / crossfade auto-advance), never
 *   after next / previous / a pick, and never before the first track.
 * - Due when tracks since the last break >= `every_n_tracks`, OR at least one track ended and the
 *   minutes since the last break (or since listening started) >= `min_minutes_between`.
 * - Also needs fewer than `max_per_hour` ads in the last 60 min (0 = no ads at all) and at least one
 *   ad inside its date window.
 * - A break plays up to `per_break` distinct ads, round-robin; the hourly cap can shorten it.
 * - Counters persist (localStorage, see `readCounters` / `serializeCounters`), so a reload neither
 *   resets the cadence nor the hourly cap.
 */

export interface AdSettings {
  everyNTracks: number;
  minMinutesBetween: number;
  perBreak: number;
  /** 0 = no ads at all (hard zero cap, same as Borjino's settings). */
  maxPerHour: number;
  /** Longer ads are skipped; null = no limit from the feed. */
  maxDurationS: number | null;
}

export interface Ad {
  id: string;
  /** Audio URL on the media host. */
  src: string;
  durationS: number | null;
  /** Linear gain from `gain_db` (1 = unchanged). */
  gain: number;
  /** Epoch ms, or null = open. */
  from: number | null;
  until: number | null;
}

export interface AdFeed {
  settings: AdSettings;
  ads: readonly Ad[];
}

export interface AdCounters {
  /** Natural track ends since the last break. */
  since: number;
  /** Epoch ms of the last break, or when listening started; 0 = not started yet. */
  lastAt: number;
  /** Epoch ms of every ad started in the last hour. */
  hist: number[];
  /** Round-robin cursor. */
  rr: number;
}

const HOUR_MS = 3_600_000;
const MAX_ADS = 50;
const AD_ID = /^[A-Za-z0-9_-]{1,64}$/;
/** `ads/<sha256>.<ext>` (the share's layout) or a bare file name. */
const AD_PATH = /^(ads\/)?[A-Za-z0-9_-][A-Za-z0-9._-]{0,127}\.(mp3|m4a|aac|ogg|oga|opus|wav|webm)$/i;
/** Hard ceiling whatever the feed says (the Borjino model allows at most 60 s). */
const MAX_AD_SECONDS = 60;

export const EMPTY_COUNTERS: AdCounters = { since: 0, lastAt: 0, hist: [], rr: 0 };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function intIn(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

function finiteIn(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

function time(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > 40) return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** A path inside the media base, or an absolute http(s) URL on the media host (no credentials). */
function adUrl(value: unknown, base: string): string | null {
  if (typeof value !== 'string') return null;
  const ref = value.trim();
  if (!ref || ref.length > 512) return null;
  if (/^https?:\/\//i.test(ref)) {
    let url: URL;
    try {
      url = new URL(ref);
    } catch {
      return null;
    }
    if (url.username || url.password || url.origin !== originOf(base)) return null;
    return url.href;
  }
  if (!AD_PATH.test(ref) || ref.includes('..')) return null;
  return (base.endsWith('/') ? base : `${base}/`) + ref;
}

function parseSettings(raw: Record<string, unknown>): AdSettings | null {
  if (raw.enabled === false) return null;
  const everyNTracks = intIn(raw.every_n_tracks, 1, 20);
  const minMinutesBetween = intIn(raw.min_minutes_between, 1, 120);
  if (everyNTracks === null || minMinutesBetween === null) return null;
  const perBreak = raw.per_break === undefined ? 1 : intIn(raw.per_break, 1, 3);
  const maxPerHour = raw.max_per_hour === undefined ? 4 : intIn(raw.max_per_hour, 0, 12);
  const maxDurationS = raw.max_duration_s === undefined ? null : intIn(raw.max_duration_s, 5, MAX_AD_SECONDS);
  if (perBreak === null || maxPerHour === null || (raw.max_duration_s !== undefined && maxDurationS === null)) return null;
  return { everyNTracks, minMinutesBetween, perBreak, maxPerHour, maxDurationS };
}

/** Validate an untrusted feed. `null` = no ads (absent, invalid, disabled or no playable ad). */
export function parseAdFeed(data: unknown, base: string): AdFeed | null {
  const root = record(data);
  if (!root || (root.version !== undefined && root.version !== 1)) return null;
  const rawSettings = record(root.settings);
  const settings = rawSettings ? parseSettings(rawSettings) : null;
  if (!settings || !Array.isArray(root.ads)) return null;
  const limit = Math.min(settings.maxDurationS ?? MAX_AD_SECONDS, MAX_AD_SECONDS);
  const seen = new Set<string>();
  const ads: Ad[] = [];
  for (const entry of (root.ads as unknown[]).slice(0, MAX_ADS)) {
    const raw = record(entry);
    if (!raw) continue;
    const id = typeof raw.id === 'string' && AD_ID.test(raw.id) ? raw.id : null;
    const src = adUrl(raw.url ?? raw.file, base);
    if (!id || !src || seen.has(id)) continue;
    const durationS =
      raw.duration_ms !== undefined ? (finiteIn(raw.duration_ms, 1, 600_000) ?? -1) / 1000 : raw.duration_s !== undefined ? (finiteIn(raw.duration_s, 0.001, 600) ?? -1) : null;
    if (durationS !== null && (durationS <= 0 || durationS > limit)) continue;
    const gainDb = raw.gain_db === undefined || raw.gain_db === null ? 0 : finiteIn(raw.gain_db, -30, 12);
    const from = time(raw.active_from);
    const until = time(raw.active_until);
    if (gainDb === null || from === undefined || until === undefined) continue;
    seen.add(id);
    ads.push({ id, src, durationS, gain: Math.pow(10, gainDb / 20), from, until });
  }
  return ads.length ? { settings, ads } : null;
}

/** Ads inside their date window at `now`. */
export function eligibleAds(feed: AdFeed, now: number): Ad[] {
  return feed.ads.filter((ad) => (ad.from === null || now >= ad.from) && (ad.until === null || now < ad.until));
}

function adsInLastHour(counters: AdCounters, now: number): number {
  return counters.hist.filter((at) => at > now - HOUR_MS && at <= now).length;
}

/** First play of the session: the minutes rule counts from here when no break happened yet. */
export function markListening(counters: AdCounters, now: number): AdCounters {
  return counters.lastAt > 0 ? counters : { ...counters, lastAt: now };
}

/** A track ended naturally. */
export function recordNaturalEnd(counters: AdCounters): AdCounters {
  return { ...counters, since: counters.since + 1 };
}

/** Is a break due now (call after `recordNaturalEnd`)? */
export function isBreakDue(feed: AdFeed | null, counters: AdCounters, now: number): boolean {
  if (!feed || counters.since < 1) return false;
  const { everyNTracks, minMinutesBetween, maxPerHour } = feed.settings;
  const cadence =
    counters.since >= everyNTracks || (counters.lastAt > 0 && now - counters.lastAt >= minMinutesBetween * 60_000);
  if (!cadence) return false;
  if (adsInLastHour(counters, now) >= maxPerHour) return false; // 0 = never
  return eligibleAds(feed, now).length > 0;
}

/**
 * Start a break: the ads to play (round-robin, distinct, capped by `per_break` and the hourly
 * allowance) and the counters with the cadence reset. Empty when no break is due.
 */
export function startBreak(feed: AdFeed | null, counters: AdCounters, now: number): { ads: Ad[]; counters: AdCounters } {
  if (!feed || !isBreakDue(feed, counters, now)) return { ads: [], counters };
  const eligible = eligibleAds(feed, now);
  const { perBreak, maxPerHour } = feed.settings;
  const allowance = maxPerHour - adsInLastHour(counters, now);
  const count = Math.max(0, Math.min(perBreak, eligible.length, allowance));
  const start = ((counters.rr % eligible.length) + eligible.length) % eligible.length;
  const ads = Array.from({ length: count }, (_, i) => eligible[(start + i) % eligible.length]);
  return { ads, counters: { ...counters, since: 0, lastAt: now, rr: start + count } };
}

/** An ad started playing (counts toward the hourly cap, even if it later fails: conservative). */
export function recordAdStart(counters: AdCounters, now: number): AdCounters {
  return { ...counters, hist: [...counters.hist.filter((at) => at > now - HOUR_MS && at <= now), now] };
}

/** Parse stored counters; anything invalid starts fresh. */
export function readCounters(raw: string | null): AdCounters {
  try {
    const data = record(JSON.parse(raw ?? 'null'));
    if (!data) return EMPTY_COUNTERS;
    const since = intIn(data.since, 0, 10_000) ?? 0;
    const lastAt = finiteIn(data.lastAt, 0, 8.64e15) ?? 0;
    const rr = intIn(data.rr, 0, 1_000_000) ?? 0;
    const hist = Array.isArray(data.hist)
      ? (data.hist as unknown[]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0).slice(-50)
      : [];
    return { since, lastAt, hist, rr };
  } catch {
    return EMPTY_COUNTERS;
  }
}

export function serializeCounters(counters: AdCounters): string {
  return JSON.stringify(counters);
}
