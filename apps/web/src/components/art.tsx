import { NEUTRAL_ART, stationArt, trackArt, usePlayer } from '@/lib/player';
import type { Category, Library, Track } from '@/lib/tracks';
import { cn } from '@/lib/utils';

/**
 * Generated artwork (covers are mostly null in today's catalogue): a gradient with the title's
 * initials. The gradient colour means the SERIES a mix belongs to (its station colour, else a hue
 * derived from the series name), so every mix in a series shares one hue — never a random per-track
 * colour. Items with no series fall back to one neutral plum. Purely decorative — always
 * `aria-hidden`; the accessible name lives on the card / control around it.
 */
export function initials(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((w) => Array.from(w)[0] ?? '');
  return letters.join('').toUpperCase();
}

/** Stable small hash -> palette index. */
export function hashIndex(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Series name of a mix: the title with any trailing number (and its separators) removed, folded to
 * lower case — e.g. "RokoshaA Vibes 3" -> "rokoshaa vibes", so "RokoshaA Vibes 1…5" share a series.
 * Empty when the title is only a number (then the cover uses the neutral fallback).
 */
export function seriesKey(title: string): string {
  return title.replace(/[\s._#:·-]*\d+\s*$/u, '').trim().toLowerCase();
}

/** Colour of the first coloured category the track belongs to. */
export function trackColor(track: Track, library: Library): string | null {
  for (const id of track.categories) {
    const category = library.categories.find((c) => c.id === id);
    if (category?.color) return category.color;
  }
  return null;
}

/** Cover background for a mix: its station colour, else its series hue, else the neutral fallback. */
function trackBackground(track: Track, library: Library): string {
  const color = trackColor(track, library);
  if (color) return stationArt(color, 0);
  const key = seriesKey(track.title);
  return key ? trackArt(hashIndex(key)) : NEUTRAL_ART;
}

/** Cover background for a station: its colour, else a stable hue per station id, else neutral. */
function categoryBackground(category: Category): string {
  if (category.color) return stationArt(category.color, 0);
  return category.synthetic ? NEUTRAL_ART : trackArt(hashIndex(category.id));
}

function GeneratedArt({ background, label, cover, className, big }: { background: string; label: string; cover: string | null; className?: string; big?: boolean }) {
  return (
    <span aria-hidden="true" className={cn('art relative block shrink-0 overflow-hidden', className)} style={{ background }}>
      {cover ? (
        <img key={cover} src={cover} alt="" loading="lazy" decoding="async" className="cover-in h-full w-full object-cover" />
      ) : (
        <span className={cn('art-initials absolute inset-0 grid place-items-center font-black text-white/90', big ? 'text-6xl' : 'text-2xl')}>
          <bdi>{initials(label)}</bdi>
        </span>
      )}
    </span>
  );
}

export function TrackArt({ track, className, big }: { track: Track; className?: string; big?: boolean }) {
  const { library } = usePlayer();
  return <GeneratedArt background={trackBackground(track, library)} label={track.title} cover={track.cover} className={className} big={big} />;
}

export function CategoryArt({ category, label, className, big }: { category: Category; label: string; className?: string; big?: boolean }) {
  return <GeneratedArt background={categoryBackground(category)} label={label} cover={category.cover} className={className} big={big} />;
}
