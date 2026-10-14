/**
 * Real-audio mixes served from `public/Podcast/` (git-ignored, deployed separately) or from
 * `VITE_MEDIA_BASE` when the media lives elsewhere. Titles/artist are data, not UI copy.
 * Durations are read from `loadedmetadata` at play time — nothing is downloaded before the
 * user presses play.
 */
export interface Track {
  id: string;
  title: string;
  artist: string;
  src: string;
}

const ARTIST = 'DJ Rokoshaa';
const FILES = [
  'DJ Rokoshaa - RokoshaA Vibes 1.mp3',
  'DJ Rokoshaa - RokoshaA Vibes 2.mp3',
  'DJ Rokoshaa - RokoshaA Vibes 3.mp3',
  'DJ Rokoshaa - RokoshaA Vibes 4.mp3',
  'DJ Rokoshaa - RokoshaA Vibes 5.mp3',
] as const;

const rawBase: unknown = import.meta.env.VITE_MEDIA_BASE;
export const MEDIA_BASE = typeof rawBase === 'string' && rawBase ? (rawBase.endsWith('/') ? rawBase : `${rawBase}/`) : '/Podcast/';

export const TRACKS: readonly Track[] = FILES.map((file, i) => ({
  id: `vibes-${i + 1}`,
  title: `RokoshaA Vibes ${i + 1}`,
  artist: ARTIST,
  src: MEDIA_BASE + encodeURIComponent(file),
}));

export const TRACK_CREDIT_ARTIST = ARTIST;

/** Web Audio can only analyse same-origin (or CORS-clean) media; cross-origin bases fall back to the CSS beat. */
export function isSameOrigin(src: string): boolean {
  try {
    return new URL(src, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}
