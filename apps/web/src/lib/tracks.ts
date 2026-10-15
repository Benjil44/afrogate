/**
 * Real-audio mixes. The list is data, not code: it is read at runtime from a manifest
 * (`tracks.json`) so new mixes appear without a rebuild. The music lives in the Borjino public
 * share (https://media.borjino.com/music/, managed by the Borjino app, CORS-enabled for
 * afrows.com); `VITE_MEDIA_BASE` / `VITE_TRACKS_URL` override it — e.g. `VITE_MEDIA_BASE=/Podcast/`
 * in `apps/web/.env.development.local` for local dev (not `.env.local`, which production builds read too), because the share only allows the afrows.com origins.
 * Durations are read from `loadedmetadata` at play time — nothing is downloaded before the user
 * presses play.
 *
 * Manifest format (an array, in play order):
 *   [{ "id": "vibes-1", "title": "RokoshaA Vibes 1", "artist": "DJ Rokoshaa", "file": "DJ Rokoshaa - RokoshaA Vibes 1.mp3" }]
 * Every field is untrusted: it is validated here and rendered as text only.
 */
export interface Track {
  id: string;
  title: string;
  artist: string;
  src: string;
}

function withSlash(base: string): string {
  return base.endsWith('/') ? base : `${base}/`;
}

const rawBase: unknown = import.meta.env.VITE_MEDIA_BASE;
/** Borjino public music share; see the header comment. */
const DEFAULT_MEDIA_BASE = 'https://media.borjino.com/music/';
export const MEDIA_BASE = typeof rawBase === 'string' && rawBase ? withSlash(rawBase) : DEFAULT_MEDIA_BASE;

const rawManifest: unknown = import.meta.env.VITE_TRACKS_URL;
export const TRACKS_URL = typeof rawManifest === 'string' && rawManifest ? rawManifest : `${MEDIA_BASE}tracks.json`;

const MAX_TRACKS = 200;
const MAX_TEXT = 120;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function text(value: unknown, required: boolean): string | null {
  if (typeof value !== 'string') return required ? null : '';
  const trimmed = value.trim().slice(0, MAX_TEXT);
  return required && !trimmed ? null : trimmed;
}

/** A plain file name inside the media base: no path separators, no `..`, no URL scheme. */
function safeFile(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const file = value.trim();
  if (!file || file.length > 255 || /[/\\]/.test(file) || file.includes('..') || file.includes(':')) return null;
  return file;
}

/** Validate an untrusted manifest; invalid entries are skipped, duplicate ids keep the first. */
export function parseManifest(data: unknown, base: string = MEDIA_BASE): Track[] {
  if (!Array.isArray(data)) throw new Error('manifest is not an array');
  const seen = new Set<string>();
  const tracks: Track[] = [];
  for (const entry of data.slice(0, MAX_TRACKS)) {
    if (!entry || typeof entry !== 'object') continue;
    const raw = entry as Record<string, unknown>;
    const id = typeof raw.id === 'string' && ID_PATTERN.test(raw.id) ? raw.id : null;
    const title = text(raw.title, true);
    const artist = text(raw.artist, false);
    const file = safeFile(raw.file);
    if (!id || title === null || artist === null || !file || seen.has(id)) continue;
    seen.add(id);
    tracks.push({ id, title, artist, src: withSlash(base) + encodeURIComponent(file) });
  }
  return tracks;
}

export async function loadTracks(signal?: AbortSignal): Promise<Track[]> {
  const response = await fetch(TRACKS_URL, { signal, cache: 'no-cache', credentials: 'omit' });
  if (!response.ok) throw new Error(`manifest ${response.status}`);
  return parseManifest(await response.json());
}

/** Same-origin media plays normally; cross-origin media is requested with CORS (see player.tsx). */
export function isSameOrigin(src: string): boolean {
  try {
    return new URL(src, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}
