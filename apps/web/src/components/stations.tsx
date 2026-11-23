import type { CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, Play } from 'lucide-react';
import { Equalizer } from '@/components/equalizer';
import { NUMBER_LOCALE, formatTime, trackCount, useLang } from '@/i18n';
import { NoticeButton, StateNotice } from '@/components/state-notice';
import { stationArt, stationName, trackDuration, usePlayer } from '@/lib/player';
import { ALL_STATION, stationTracks, type Category } from '@/lib/tracks';
import { cn } from '@/lib/utils';

/**
 * Station pickers per breakpoint: `StationRail` (>= 1280px, vertical list), `StationChips`
 * (640–1279px, inline-axis scroll), `StationGrid` + `StationView` (phone). Stations are plain
 * buttons with `aria-pressed` (no roving focus needed). The accent is the station's validated
 * `#RRGGBB` colour (or the palette fallback) — as a 3px inline-start strip, never behind text.
 */
function accentStyle(category: Category | undefined): CSSProperties | undefined {
  return category?.color ? ({ '--station': category.color } as CSSProperties) : undefined;
}

export function StationArt({ category, index, className }: { category: Category; index: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('block shrink-0 overflow-hidden', className)} style={{ background: stationArt(category.color, index) }}>
      {category.cover && <img src={category.cover} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />}
    </span>
  );
}

function useStationCounts() {
  const { library } = usePlayer();
  return (id: string) => stationTracks(library, id).length;
}

export function StationRail() {
  const { t, lang } = useLang();
  const { stations, stationId, selectStation, playing } = usePlayer();
  const count = useStationCounts();
  return (
    <nav aria-label={t.player.stationsNav} className="flex h-full min-h-0 flex-col border-e border-[var(--border)]">
      <h2 className="px-5 pb-2 pt-5 text-xs font-extrabold uppercase tracking-widest text-[var(--muted-foreground)]">{t.player.stations}</h2>
      <ul data-scroll-list className="scroll-area min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {stations.map((c, i) => {
          const active = c.id === stationId;
          return (
            <li key={c.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => selectStation(c.id)}
                style={accentStyle(c)}
                className={cn(
                  'station-row flex min-h-14 w-full items-center gap-3 rounded-xl border-s-[3px] px-2 py-2 text-start transition-colors',
                  active
                    ? 'border-[var(--station,var(--primary))] bg-[color-mix(in_oklch,var(--foreground)_7%,transparent)]'
                    : 'border-transparent hover:bg-[color-mix(in_oklch,var(--foreground)_4%,transparent)]',
                )}
              >
                <StationArt category={c} index={i} className="h-10 w-10 rounded-lg" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">
                    <bdi>{stationName(c, lang, t)}</bdi>
                  </span>
                  <span className="block text-xs text-[var(--muted-foreground)]">{trackCount(count(c.id), lang, t)}</span>
                </span>
                {active && <Equalizer active={playing} bars={3} className="h-3.5 text-[var(--accent)]" />}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function StationChips() {
  const { t, lang } = useLang();
  const { stations, stationId, selectStation } = usePlayer();
  return (
    <nav aria-label={t.player.stationsNav} className="border-b border-[var(--border)]">
      <ul className="scroll-area flex gap-2 overflow-x-auto px-4 py-2 lg:px-6">
        {stations.map((c) => {
          const active = c.id === stationId;
          return (
            <li key={c.id} className="shrink-0">
              <button
                type="button"
                aria-pressed={active}
                onClick={() => selectStation(c.id)}
                style={accentStyle(c)}
                className={cn(
                  'inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold transition-colors',
                  active
                    ? 'border-[var(--station,var(--primary))] bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)] text-[var(--foreground)]'
                    : 'border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
                )}
              >
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-[var(--station,var(--primary))]" />
                <bdi>{stationName(c, lang, t)}</bdi>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Phone home: 2-column station cards; a tap opens the station's list. */
export function StationGrid({ onBrowse }: { onBrowse: (id: string) => void }) {
  const { t, lang } = useLang();
  const { stations, stationId, playing } = usePlayer();
  const count = useStationCounts();
  return (
    <nav aria-label={t.player.stationsNav} className="flex h-full min-h-0 flex-col">
      <h2 className="px-4 pb-2 pt-4 text-xs font-extrabold uppercase tracking-widest text-[var(--muted-foreground)]">{t.player.stations}</h2>
      <ul className="scroll-area grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto px-4 pb-4">
        {stations.map((c, i) => {
          const current = c.id === stationId;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onBrowse(c.id)}
                aria-current={current || undefined}
                style={accentStyle(c)}
                className={cn(
                  'flex w-full flex-col overflow-hidden rounded-2xl border bg-[var(--card)] text-start',
                  current ? 'border-[var(--station,var(--primary))]' : 'border-[var(--border)]',
                )}
              >
                <StationArt category={c} index={i} className="aspect-[16/10] w-full" />
                <span className="flex min-h-14 items-center gap-2 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      <bdi>{stationName(c, lang, t)}</bdi>
                    </span>
                    <span className="block text-xs text-[var(--muted-foreground)]">{trackCount(count(c.id), lang, t)}</span>
                  </span>
                  {current && <Equalizer active={playing} bars={3} className="h-3.5 text-[var(--accent)]" />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Phone station page: back, "Play station" (primary), the station's tracks. */
export function StationView({ id, onBack }: { id: string; onBack?: () => void }) {
  const { t, lang, dir } = useLang();
  const { library, stations, stationId, track, playing, failed, durations, playStation, jumpTo, position } = usePlayer();
  const category = library.categories.find((c) => c.id === id);
  const index = Math.max(0, stations.findIndex((c) => c.id === id));
  const list = stationTracks(library, id);
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const isCurrent = id === stationId;

  return (
    <section aria-labelledby="station-view-title" className="flex h-full min-h-0 flex-col" style={accentStyle(category)}>
      <div className="flex items-center gap-2 px-2 pt-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={t.player.backToStations}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--foreground)] hover:bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)]"
          >
            <BackIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        <h2 id="station-view-title" className={cn('min-w-0 flex-1 truncate text-lg font-black', !onBack && 'px-2')}>
          {category ? <bdi>{stationName(category, lang, t)}</bdi> : t.player.stations}
        </h2>
      </div>
      {list.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3">
          {category && <StationArt category={category} index={index} className="h-16 w-16 rounded-xl" />}
          <div className="min-w-0 flex-1">
            <p className="text-xs text-[var(--muted-foreground)]">{trackCount(list.length, lang, t)}</p>
            <button
              type="button"
              onClick={() => playStation(id)}
              className="mt-1 inline-flex h-11 items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--primary),var(--secondary))] px-5 text-sm font-bold text-white"
            >
              <Play className="h-4 w-4" fill="currentColor" aria-hidden="true" />
              {t.player.playStation}
            </button>
          </div>
        </div>
      )}
      {list.length === 0 ? (
        <div className="grid min-h-0 flex-1 place-items-center">
          <StateNotice tone="neutral" title={t.player.stationEmpty} body={t.player.stationEmptyBody}>
            {id !== ALL_STATION && (
              <NoticeButton onClick={() => playStation(ALL_STATION)} primary>
                {t.player.playAll}
              </NoticeButton>
            )}
          </StateNotice>
        </div>
      ) : (
        <ol data-scroll-list className="scroll-area min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {list.map((item, i) => {
            const active = isCurrent && item.id === track.id;
            const bad = failed.has(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => (active ? jumpTo(position) : playStation(id, item.id))}
                  aria-current={active || undefined}
                  className={cn(
                    'flex min-h-14 w-full items-center gap-3 rounded-xl px-2 text-start',
                    active ? 'bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)]' : 'hover:bg-[color-mix(in_oklch,var(--foreground)_4%,transparent)]',
                  )}
                >
                  <span className="w-6 shrink-0 text-center text-xs font-bold tabular-nums text-[var(--muted-foreground)]">
                    {active ? <Equalizer active={playing} bars={3} className="h-3.5 text-[var(--accent)]" /> : new Intl.NumberFormat(NUMBER_LOCALE[lang]).format(i + 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      <bdi>{item.title}</bdi>
                    </span>
                    <span className="block truncate text-xs text-[var(--muted-foreground)]">
                      {bad ? <span className="font-semibold text-[var(--accent)]">{t.player.unavailable}</span> : <bdi>{item.artist}</bdi>}
                    </span>
                  </span>
                  <span dir="ltr" className="shrink-0 text-xs tabular-nums text-[var(--muted-foreground)]">
                    {trackDuration(item, durations) > 0 ? formatTime(trackDuration(item, durations), lang) : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
