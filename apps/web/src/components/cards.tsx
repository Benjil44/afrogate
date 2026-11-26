import type { ReactNode } from 'react';
import { Pause, Play } from 'lucide-react';
import { CategoryArt, TrackArt } from '@/components/art';
import { fill, trackCount, useLang } from '@/i18n';
import { stationName, usePlayer } from '@/lib/player';
import { routeHref } from '@/lib/route';
import { stationTracks, type Category, type Track } from '@/lib/tracks';
import { cn } from '@/lib/utils';

/**
 * Card shelves for the main panel. A shelf with two or more cards is a horizontal row (scrolls
 * on the inline axis; focusing a card scrolls it into view, so the row is keyboard-reachable
 * with Tab); a single card is never shown as a "row" — it falls back to the grid. Empty shelves
 * render nothing.
 */
export interface ShelfItem {
  key: string;
  node: ReactNode;
}

export function Shelf({
  id,
  title,
  showAllHref,
  items,
  layout = 'row',
}: {
  id: string;
  title: string;
  showAllHref?: string;
  items: readonly ShelfItem[];
  layout?: 'row' | 'grid';
}) {
  const { t } = useLang();
  if (items.length === 0) return null;
  const row = layout === 'row' && items.length > 1;
  return (
    <section aria-labelledby={`${id}-title`} className="min-w-0">
      <div className="flex items-baseline justify-between gap-3 px-1 pb-2">
        <h2 id={`${id}-title`} className="truncate text-xl font-black tracking-tight">
          {title}
        </h2>
        {showAllHref && row && (
          <a href={showAllHref} className="inline-flex min-h-11 shrink-0 items-center text-sm font-bold text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:underline">
            {t.app.showAll}
          </a>
        )}
      </div>
      <ul className={cn(row ? 'shelf-row scroll-area' : 'card-grid')}>
        {items.map((item) => (
          <li key={item.key} className="min-w-0">
            {item.node}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Decorative play/pause disc over a cover; visible on hover / focus and while it is the playing card. */
function PlayDisc({ active, playing }: { active: boolean; playing: boolean }) {
  return (
    <span aria-hidden="true" className={cn('card-play grid h-12 w-12 place-items-center rounded-full bg-[image:var(--brand-gradient)] text-white shadow-lg', active && 'is-active')}>
      {active && playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5 translate-x-[6%]" fill="currentColor" />}
    </span>
  );
}

/** A track card is one button: it plays the track within `stationId` (or pauses it when it is the playing one). */
export function TrackCard({ track, stationId }: { track: Track; stationId: string }) {
  const { t } = useLang();
  const { track: current, playing, toggle, playStation } = usePlayer();
  const active = current.id === track.id && Boolean(current.src);
  const label = fill(active && playing ? t.app.pauseTrack : t.app.playTrack, { title: track.title });
  return (
    <button
      type="button"
      onClick={() => (active ? toggle() : playStation(stationId, track.id))}
      aria-label={label}
      aria-current={active || undefined}
      className="card group flex w-full flex-col gap-2 rounded-xl p-2 text-start"
    >
      <span className="relative block">
        <TrackArt track={track} className="aspect-square w-full rounded-lg shadow-lg shadow-black/40" />
        <PlayDisc active={active} playing={playing} />
      </span>
      <span className="block min-w-0 px-1">
        <span className={cn('block truncate text-sm font-bold', active && 'text-[var(--accent)]')}>
          <bdi>{track.title}</bdi>
        </span>
        <span className="block truncate text-xs text-[var(--muted-foreground)]">
          <bdi>{track.artist}</bdi>
        </span>
      </span>
    </button>
  );
}

/**
 * Station card: a coloured radio tile with the station name (link to its page) plus a separate
 * play button over the tile (sibling, not nested, so both are real controls). The name sits on a
 * dark scrim, so text contrast never depends on the category colour.
 */
export function StationCard({ category, result = false }: { category: Category; result?: boolean }) {
  const { t, lang } = useLang();
  const { library, stationId, playing, toggle, playStation } = usePlayer();
  const name = stationName(category, lang, t);
  const count = stationTracks(library, category.id).length;
  const active = stationId === category.id && playing;
  return (
    <div className="card group relative rounded-xl p-2">
      <a href={routeHref({ name: 'station', id: category.id })} data-result={result || undefined} className="flex flex-col gap-2 rounded-lg">
        <span className="relative block overflow-hidden rounded-lg">
          <CategoryArt category={category} label={name} className="aspect-square w-full" />
          <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_top,rgb(0_0_0/0.72),transparent_60%)]" />
          <span className="absolute inset-x-3 bottom-3 line-clamp-2 text-lg font-black leading-tight text-white">
            <bdi>{name}</bdi>
          </span>
        </span>
        <span className="block px-1 text-xs text-[var(--muted-foreground)]">{trackCount(count, lang, t)}</span>
      </a>
      {count > 0 && (
        <button
          type="button"
          onClick={() => (active ? toggle() : playStation(category.id))}
          aria-label={fill(t.app.playStationNamed, { name })}
          aria-pressed={active}
          className="card-play-btn absolute end-4 top-4 rounded-full"
        >
          <PlayDisc active={active} playing={playing} />
        </button>
      )}
    </div>
  );
}
