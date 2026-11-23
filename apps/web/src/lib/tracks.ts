/**
 * Music library. The list is data, not code: it is read at runtime from a manifest (`tracks.json`)
 * so new mixes appear without a rebuild. The music lives in the Borjino public share
 * (https://media.borjino.com/music/, managed by the Borjino app, CORS-enabled for afrows.com);
 * `VITE_MEDIA_BASE` / `VITE_TRACKS_URL` override it — e.g. `VITE_MEDIA_BASE=/Podcast/` in
 * `apps/web/.env.development.local` for local dev (not `.env.local`, which production builds read
 * too), because the share only allows the afrows.com origins. Nothing is downloaded before the
 * user presses play.
 *
 * Two manifests (Borjino contract, feat/music-manifest-v2): `tracks.v2.json` is fetched first; on a
 * 404 / invalid / empty v2 we fall back to `tracks.json` (v1). `parseManifest` accepts either shape:
 *   v1 — a plain array, in play order:
 *     [{ "id": "vibes-1", "title": "…", "artist": "…", "file": "….mp3", "durationSec": 3492, "cover": "….webp" }]
 *   v2 — { "version": 2, "generatedAt": "…", "categories": [{ "id", "name": { "fa"?, "en" }, "sort", "color", "cover" }],
 *          "tracks": [{ …v1, "categories": ["chill"], "bpm"?, "energy"? }] }
 * Either way the result starts with a synthetic "All music" station (Borjino must not publish an
 * `all` id). Every field is untrusted: it is validated here and rendered as text only; `color` is
 * accepted as `#RRGGBB` only and media URLs must stay on the media host. Category ids are key slugs
 * (max 40 chars), at most 50 categories, at most 5 per track; `bpm` (integer 40–250) and `energy`
 * (integer 1–5) are optional and only kept when valid (P2 ordering, unused in the P1 UI).
 */
import { parseAdFeed, type AdFeed } from './ad-schedule';

export interface Track {
  id: string;
  title: string;
  artist: string;
  /** Audio URL on the media host. */
  src: string;
  /** Duration from the manifest (seconds), or null until `loadedmetadata`. */
  durationSec: number | null;
  /** Cover image URL on the media host, or null (gradient art is used instead). */
  cover: string | null;
  /** Category ids this track belongs to (unknown ids already dropped). */
  categories: readonly string[];
  /** Integer 40–250 when known (v2 only). */
  bpm?: number;
  /** Integer 1–5 when known (v2 only). */
  energy?: number;
}

export interface Category {
  id: string;
  name: { en: string; fa: string | null };
  /** `#RRGGBB` accent, or null (palette fallback). */
  color: string | null;
  cover: string | null;
  /** True only for the synthesized "All music" station (its name comes from i18n). */
  synthetic: boolean;
}

export interface Library {
  /** "All music" first, then the manifest categories by `sort`, then manifest order. */
  categories: readonly Category[];
  tracks: readonly Track[];
}

/** Id of the synthesized station that holds every track. */
export const ALL_STATION = 'all';

function withSlash(base: string): string {
  return base.endsWith('/') ? base : `${base}/`;
}

const rawBase: unknown = import.meta.env.VITE_MEDIA_BASE;
/** Borjino public music share; see the header comment. */
const DEFAULT_MEDIA_BASE = 'https://media.borjino.com/music/';
export const MEDIA_BASE = typeof rawBase === 'string' && rawBase ? withSlash(rawBase) : DEFAULT_MEDIA_BASE;

const rawManifest: unknown = import.meta.env.VITE_TRACKS_URL;
export const TRACKS_URL = typeof rawManifest === 'string' && rawManifest ? rawManifest : `${MEDIA_BASE}tracks.json`;

const rawManifestV2: unknown = import.meta.env.VITE_TRACKS_V2_URL;
/** v2 manifest (categories). Missing / invalid -> the v1 `TRACKS_URL` is used. */
export const TRACKS_V2_URL = typeof rawManifestV2 === 'string' && rawManifestV2 ? rawManifestV2 : `${MEDIA_BASE}tracks.v2.json`;

const rawAds: unknown = import.meta.env.VITE_ADS_URL;
/** Public voice-ads feed (Borjino plan 06 §3). Missing / invalid -> no ads, music unaffected. */
export const ADS_URL = typeof rawAds === 'string' && rawAds ? rawAds : `${MEDIA_BASE}ads.v1.json`;

const MAX_TRACKS = 200;
const MAX_CATEGORIES = 50;
const MAX_TRACK_CATEGORIES = 5;
const MAX_TEXT = 120;
const MAX_NAME = 48;
/** Longest mix accepted from the manifest (12 h); anything else is ignored and read from the file. */
const MAX_DURATION = 12 * 3600;
const TRACK_ID = /^[A-Za-z0-9_-]{1,64}$/;
/** Category key slug (Borjino `MusicCategory.key`). */
const CATEGORY_ID = /^[a-z0-9_-]{1,40}$/;
const COLOR = /^#[0-9A-Fa-f]{6}$/;

function text(value: unknown, required: boolean, max = MAX_TEXT): string | null {
  if (typeof value !== 'string') return required ? null : '';
  const trimmed = value.trim().slice(0, max);
  return required && !trimmed ? null : trimmed;
}

function originOf(url: string): string | null {
  try {
    const here = typeof window === 'undefined' ? 'https://afrows.com/' : window.location.href;
    return new URL(url, here).origin;
  } catch {
    return null;
  }
}

/**
 * A media reference: a plain file name inside the media base (no separators, no `..`, no scheme),
 * or an absolute http(s) URL on the media host itself (no credentials). Anything else is rejected.
 */
function mediaUrl(value: unknown, base: string): string | null {
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
  if (ref.length > 255 || /[/\\]/.test(ref) || ref.includes('..') || ref.includes(':')) return null;
  return withSlash(base) + encodeURIComponent(ref);
}

function duration(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_DURATION ? value : null;
}

function intIn(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : undefined;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function parseCategories(data: unknown, base: string): Category[] {
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>([ALL_STATION]);
  const parsed: { category: Category; sort: number; order: number }[] = [];
  data.slice(0, MAX_CATEGORIES).forEach((entry: unknown, order: number) => {
    const raw = record(entry);
    if (!raw) return;
    const id = typeof raw.id === 'string' && CATEGORY_ID.test(raw.id) ? raw.id : null;
    const names = record(raw.name);
    const en = names ? text(names.en, true, MAX_NAME) : null;
    if (!id || !names || !en || seen.has(id)) return;
    const fa = text(names.fa, false, MAX_NAME);
    seen.add(id);
    parsed.push({
      category: {
        id,
        name: { en, fa: fa ? fa : null },
        color: typeof raw.color === 'string' && COLOR.test(raw.color) ? raw.color.toUpperCase() : null,
        cover: mediaUrl(raw.cover, base),
        synthetic: false,
      },
      sort: typeof raw.sort === 'number' && Number.isFinite(raw.sort) ? raw.sort : Number.MAX_SAFE_INTEGER,
      order,
    });
  });
  // Stable order: `sort`, then manifest order.
  parsed.sort((a, b) => a.sort - b.sort || a.order - b.order);
  return parsed.map((p) => p.category);
}

function parseTracks(data: unknown, base: string, known: ReadonlySet<string>): Track[] {
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  const tracks: Track[] = [];
  for (const entry of data.slice(0, MAX_TRACKS) as unknown[]) {
    const raw = record(entry);
    if (!raw) continue;
    const id = typeof raw.id === 'string' && TRACK_ID.test(raw.id) ? raw.id : null;
    const title = text(raw.title, true);
    const artist = text(raw.artist, false);
    const src = mediaUrl(raw.file, base);
    if (!id || title === null || artist === null || !src || seen.has(id)) continue;
    seen.add(id);
    const rawCategories: unknown[] = Array.isArray(raw.categories) ? (raw.categories as unknown[]) : [];
    const categories = Array.from(
      new Set(rawCategories.filter((c): c is string => typeof c === 'string' && known.has(c))),
    ).slice(0, MAX_TRACK_CATEGORIES);
    const track: Track = { id, title, artist, src, durationSec: duration(raw.durationSec), cover: mediaUrl(raw.cover, base), categories };
    const bpm = intIn(raw.bpm, 40, 250);
    const energy = intIn(raw.energy, 1, 5);
    if (bpm !== undefined) track.bpm = bpm;
    if (energy !== undefined) track.energy = energy;
    tracks.push(track);
  }
  return tracks;
}

const ALL_CATEGORY: Category = { id: ALL_STATION, name: { en: 'All music', fa: null }, color: null, cover: null, synthetic: true };

/**
 * Validate an untrusted manifest (v1 array or v2 object). Invalid entries are skipped, duplicate
 * ids keep the first. Throws only when the top-level value is neither an array nor an object.
 */
export function parseManifest(data: unknown, base: string = MEDIA_BASE): Library {
  if (Array.isArray(data)) {
    return { categories: [ALL_CATEGORY], tracks: parseTracks(data, base, new Set<string>()) };
  }
  const root = record(data);
  if (!root) throw new Error('manifest is neither an array nor an object');
  const categories = parseCategories(root.categories, base);
  const tracks = parseTracks(root.tracks, base, new Set(categories.map((c) => c.id)));
  return { categories: [ALL_CATEGORY, ...categories], tracks };
}

/** Tracks of one station in manifest order ("All music" = every track). */
export function stationTracks(library: Library, stationId: string): Track[] {
  if (stationId === ALL_STATION) return [...library.tracks];
  return library.tracks.filter((t) => t.categories.includes(stationId));
}

/** Stations worth showing: "All music" plus every category with at least one valid track. */
export function visibleStations(library: Library): Category[] {
  return library.categories.filter((c) => c.synthetic || library.tracks.some((t) => t.categories.includes(c.id)));
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal, cache: 'no-cache', credentials: 'omit' });
  if (!response.ok) throw new Error(`manifest ${response.status}`);
  return response.json();
}

/** v2 first; any v2 failure (404, bad JSON, wrong version, no valid track) falls back to v1. */
export async function loadLibrary(signal?: AbortSignal): Promise<Library> {
  try {
    const data = await fetchJson(TRACKS_V2_URL, signal);
    const root = record(data);
    if (root && root.version === 2) {
      const library = parseManifest(root);
      if (library.tracks.length > 0) return library;
    }
  } catch (err) {
    if (signal?.aborted) throw err;
  }
  return parseManifest(await fetchJson(TRACKS_URL, signal));
}

/** The ads feed, validated; `null` on any failure (404, bad JSON, disabled, nothing playable). */
export async function loadAdFeed(signal?: AbortSignal): Promise<AdFeed | null> {
  try {
    return parseAdFeed(await fetchJson(ADS_URL, signal), MEDIA_BASE);
  } catch {
    return null;
  }
}

/** Same-origin media plays normally; cross-origin media is requested with CORS (see player.tsx). */
export function isSameOrigin(src: string): boolean {
  try {
    return new URL(src, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}
