import type { CSSProperties } from 'react';
import {
  NEUTRAL_ART,
  hashIndex,
  seriesKey,
  stationArt,
  trackArt,
  trackColor,
  usePlayer,
} from '@/lib/player';
import type { Category, Library, Track } from '@/lib/tracks';
import { cn } from '@/lib/utils';

/**
 * Generated artwork (covers are mostly null in today's catalogue): a per-series duotone with a
 * TYPOGRAPHIC cover — the episode number large and bold (parsed from the trailing number in the
 * title), the series name small above and the artist small below. The gradient colour means the
 * SERIES a mix belongs to (its station colour, else a hue derived from the series name), so every
 * mix in a series shares one hue. Text scales with the box via container-query units, so the same
 * art reads at a 44px thumbnail and a 288px now-playing cover; the small lines hide on tiny boxes.
 * Purely decorative — always `aria-hidden`; the accessible name lives on the card / control around it.
 */

/**
 * Typographic cover text. Hero = the trailing episode number ("05", "44", "11"); when there is none
 * (e.g. a Persian title with no number), a short series word — never initials, which look broken.
 */
export function coverParts(title: string, sub: string): { series: string; hero: string; sub: string } {
  const trimmed = title.trim();
  const match = trimmed.match(/(\d{1,4})\s*$/u);
  if (match && match.index !== undefined) {
    const series = trimmed.slice(0, match.index).replace(/[\s._#:·—–-]+$/u, '').trim();
    const num = match[1];
    return { series, hero: num.length < 2 ? num.padStart(2, '0') : num, sub };
  }
  const first = trimmed.split(/\s+/).filter(Boolean)[0] ?? trimmed;
  const chars = Array.from(first);
  return { series: '', hero: chars.length <= 8 ? first : `${chars.slice(0, 7).join('')}…`, sub };
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

function GeneratedArt({
  background,
  series,
  hero,
  sub,
  cover,
  seed,
  className,
  big,
}: {
  background: string;
  series: string;
  hero: string;
  sub: string;
  cover: string | null;
  /** Deterministic motif position (series key / category id hash). */
  seed: number;
  className?: string;
  big?: boolean;
}) {
  return (
    <span aria-hidden="true" className={cn('art relative block shrink-0 overflow-hidden', big && 'art-big', className)} style={{ background }}>
      {cover ? (
        <img key={cover} src={cover} alt="" loading="lazy" decoding="async" className="cover-in h-full w-full object-cover" />
      ) : (
        <span className="cover-in art-gen absolute inset-0">
          <span className="art-motif" style={{ '--mx': `${seed % 100}%`, '--my': `${(seed * 37) % 100}%` } as CSSProperties} />
          <span className="art-grain" />
          {hero && (
            <span className="art-cover">
              {series && (
                <span className="art-series">
                  <bdi>{series}</bdi>
                </span>
              )}
              <span className="art-hero">{hero}</span>
              {sub && (
                <span className="art-sub">
                  <bdi>{sub}</bdi>
                </span>
              )}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

export function TrackArt({ track, className, big }: { track: Track; className?: string; big?: boolean }) {
  const { library } = usePlayer();
  const { series, hero, sub } = coverParts(track.title, track.artist);
  const seed = hashIndex(seriesKey(track.title) || track.title || track.id);
  return (
    <GeneratedArt background={trackBackground(track, library)} series={series} hero={hero} sub={sub} cover={track.cover} seed={seed} className={className} big={big} />
  );
}

export function CategoryArt({ category, label, className, big }: { category: Category; label: string; className?: string; big?: boolean }) {
  // A station has no episode number: show a short word of its name (never initials), no artist line.
  const { series, hero } = coverParts(label, '');
  const seed = hashIndex(category.id);
  return (
    <GeneratedArt background={categoryBackground(category)} series={series} hero={hero} sub="" cover={category.cover} seed={seed} className={className} big={big} />
  );
}
