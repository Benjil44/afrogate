import { useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Heart, Pause, Play, SearchX, Shuffle } from 'lucide-react';
import { CategoryArt, TrackArt } from '@/components/art';
import { Shelf, StationCard, TrackCard, type ShelfItem } from '@/components/cards';
import { ShareButton } from '@/components/share-button';
import { NoticeButton, StateNotice } from '@/components/state-notice';
import { SEARCH_INPUT_ID } from '@/components/top-bar';
import { ENERGY_LEVELS, TrackChips, TrackRows, energyLabel, energyLevel, type EnergyLevel } from '@/components/track-row';
import { NUMBER_LOCALE, fill, formatTime, trackCount, useLang } from '@/i18n';
import { useCollection } from '@/lib/collection';
import { stationName, usePlayer } from '@/lib/player';
import { routeHref } from '@/lib/route';
import { searchLibrary } from '@/lib/search';
import { ALL_STATION, stationTracks, type Category, type Library, type Track } from '@/lib/tracks';
import { cn } from '@/lib/utils';

/**
 * Main-panel views. Each starts with an `h1`-level heading for the view (focused on navigation
 * so screen readers land on the new content). Rows follow the catalogue: empty shelves are
 * hidden and a one-card shelf becomes a grid.
 */
const LATEST_MAX = 10;

function ViewHeading({ children, sr = false }: { children: string; sr?: boolean }) {
  return (
    <h1 data-view-heading tabIndex={-1} className={sr ? 'sr-only' : 'px-1 text-3xl font-black tracking-tight outline-none [overflow-wrap:anywhere]'}>
      {children}
    </h1>
  );
}

function trackItems(tracks: readonly Track[], stationId: string): ShelfItem[] {
  return tracks.map((track) => ({ key: track.id, node: <TrackCard track={track} stationId={stationId} /> }));
}

function stationItems(categories: readonly Category[], result = false): ShelfItem[] {
  return categories.map((c) => ({ key: c.id, node: <StationCard category={c} result={result} /> }));
}

/** Manifest order is publish order, so the newest mixes are last: show them first. */
function latestTracks(library: Library): Track[] {
  return [...library.tracks].reverse().slice(0, LATEST_MAX);
}

/** Every mix, newest first (manifest order is publish order). */
function allMixes(library: Library): Track[] {
  return [...library.tracks].reverse();
}

function byIds(library: Library, ids: readonly string[]): Track[] {
  const map = new Map(library.tracks.map((t) => [t.id, t] as const));
  return ids.map((id) => map.get(id)).filter((t): t is Track => Boolean(t));
}

const PRIMARY_BTN =
  'inline-flex h-12 items-center gap-2 rounded-full bg-[image:var(--brand-gradient)] px-6 text-sm font-bold text-white shadow-lg hover:brightness-110';
const SECONDARY_BTN =
  'inline-flex h-12 items-center gap-2 rounded-full border border-[var(--border)] px-5 text-sm font-bold text-[var(--foreground)] hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)]';
const LINK_BTN =
  'inline-flex h-11 items-center rounded-full border border-[var(--border)] px-5 text-sm font-bold hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)]';

/** "Continue listening": last session's track + position (this device only), until something plays. */
function ContinueCard() {
  const { t, lang } = useLang();
  const { resumePoint, resume, started, library } = usePlayer();
  if (!resumePoint || started) return null;
  const { track, position, stationId } = resumePoint;
  const time = formatTime(position, lang);
  const station = stationName(library.categories.find((c) => c.id === stationId), lang, t);
  return (
    <section aria-labelledby="continue-title" className="min-w-0">
      <h2 id="continue-title" className="px-1 pb-2 text-xl font-black tracking-tight">
        {t.app.continueListening}
      </h2>
      <button
        type="button"
        onClick={resume}
        aria-label={fill(t.app.continueTrack, { title: track.title, time })}
        className="card group flex w-full max-w-xl items-center gap-4 rounded-xl bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)] p-2 pe-4 text-start"
      >
        <TrackArt track={track} className="h-16 w-16 rounded-lg shadow-lg shadow-black/40" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-bold">
            <bdi>{track.title}</bdi>
          </span>
          <span className="block truncate text-xs text-[var(--muted-foreground)]">
            {position > 0 && (
              <>
                {fill(t.app.continueFrom, { time: '' })}
                <span dir="ltr">{time}</span>
                {' · '}
              </>
            )}
            <bdi>{station}</bdi>
          </span>
        </span>
        <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[image:var(--brand-gradient)] text-white shadow-lg">
          <Play className="h-5 w-5 translate-x-[6%]" fill="currentColor" />
        </span>
      </button>
    </section>
  );
}

/** Full, newest-first list of every mix (shared by Home and the search landing). */
function MixesList({ id, library }: { id: string; library: Library }) {
  const { t } = useLang();
  return (
    <section aria-labelledby={`${id}-title`} className="min-w-0">
      <h2 id={`${id}-title`} className="px-1 pb-2 text-xl font-black tracking-tight">
        {t.app.allMixes}
      </h2>
      <TrackRows tracks={allMixes(library)} stationId={ALL_STATION} />
    </section>
  );
}

/**
 * Home: Continue-listening (only with a resume point) + Recently-played (if any) + one primary
 * "All mixes" list. Collapsed from five near-duplicate shelves (0.136 redesign): the catalogue is
 * small, so one newest-first list replaces the old "Latest" / "All" / Stations rows.
 */
export function HomeView() {
  const { t } = useLang();
  const { library } = usePlayer();
  const { recent } = useCollection();
  const recentTracks = byIds(library, recent).slice(0, LATEST_MAX);
  return (
    <div className="flex flex-col gap-8">
      <ViewHeading sr>{t.app.home}</ViewHeading>
      <ContinueCard />
      <Shelf id="row-recent" title={t.app.recent} items={trackItems(recentTracks, ALL_STATION)} />
      <MixesList id="home-mixes" library={library} />
    </div>
  );
}

/** Calm / Medium / High toggle chips (single choice; "All" clears). Only when the manifest has energy. */
function EnergyFilter({ value, onChange }: { value: EnergyLevel | null; onChange: (level: EnergyLevel | null) => void }) {
  const { t } = useLang();
  const options: (EnergyLevel | null)[] = [null, ...ENERGY_LEVELS];
  return (
    <div role="group" aria-label={t.app.energyFilter} className="flex flex-wrap items-center gap-2 px-1">
      <span aria-hidden="true" className="text-sm font-bold text-[var(--muted-foreground)]">
        {t.app.energy}
      </span>
      {options.map((level) => {
        const pressed = value === level;
        return (
          <button
            key={level ?? 'all'}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(level)}
            className={cn(
              'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-bold transition-colors',
              pressed ? 'border-transparent bg-[var(--foreground)] text-[var(--background)]' : 'border-[var(--border)] hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)]',
            )}
          >
            {level ? energyLabel(level, t) : t.app.energyAll}
          </button>
        );
      })}
    </div>
  );
}

export function TrackListView({ kind }: { kind: 'all' | 'latest' }) {
  const { t, lang } = useLang();
  const { library } = usePlayer();
  const [energy, setEnergy] = useState<EnergyLevel | null>(null);
  if (kind === 'latest') {
    const tracks = latestTracks(library);
    return (
      <div className="flex flex-col gap-6">
        <ViewHeading>{t.app.latest}</ViewHeading>
        <Shelf id="grid-latest" title={trackCount(tracks.length, lang, t)} items={trackItems(tracks, ALL_STATION)} layout="grid" />
      </div>
    );
  }
  const hasEnergy = library.tracks.some((track) => track.energy !== undefined);
  const tracks = energy ? library.tracks.filter((track) => energyLevel(track.energy) === energy) : library.tracks;
  return (
    <div className="flex flex-col gap-4">
      <ViewHeading>{t.app.allTracks}</ViewHeading>
      {hasEnergy && <EnergyFilter value={energy} onChange={setEnergy} />}
      <p role="status" className="px-1 text-sm text-[var(--muted-foreground)]">
        {tracks.length ? trackCount(tracks.length, lang, t) : t.app.noEnergyMatch}
      </p>
      <TrackRows tracks={tracks} stationId={ALL_STATION} />
    </div>
  );
}

/** Station page: colour hero (category colour, else the brand colour), Play + Shuffle, numbered track list. */
export function StationPage({ id }: { id: string }) {
  const { t, lang } = useLang();
  const { library, playStation, shuffleStation, stationId, playing, toggle } = usePlayer();
  const category = library.categories.find((c) => c.id === id);
  const tracks = stationTracks(library, id);
  if (!category || tracks.length === 0) {
    return (
      <div className="grid min-h-[50%] place-items-center">
        <ViewHeading sr>{t.player.stationEmpty}</ViewHeading>
        <StateNotice tone="neutral" title={t.player.stationEmpty} body={t.player.stationEmptyBody}>
          <NoticeButton onClick={() => playStation(ALL_STATION)} primary>
            {t.player.playAll}
          </NoticeButton>
        </StateNotice>
      </div>
    );
  }
  const name = stationName(category, lang, t);
  const current = stationId === id;
  const active = current && playing;
  // `color` is a validated `#RRGGBB` (tracks.ts). The hero fades into the panel colour, so the text
  // near its bottom always sits on the dark card colour, whatever the station colour is.
  const hero = { '--station': category.color ?? 'var(--primary)' } as CSSProperties;
  return (
    <div className="flex flex-col gap-4">
      <div
        style={hero}
        className="-mx-2 flex flex-wrap items-end gap-5 bg-[linear-gradient(to_bottom,color-mix(in_oklch,var(--station)_55%,var(--card))_0%,var(--card)_100%)] px-3 pb-4 pt-8 sm:-mx-4 sm:px-5"
      >
        <CategoryArt category={category} label={name} big className="aspect-square w-32 rounded-xl shadow-2xl shadow-black/50 sm:w-44" />
        <div className="min-w-0 flex-1 basis-56">
          <ViewHeading>{name}</ViewHeading>
          <p className="mt-1 px-1 text-sm text-[var(--muted-foreground)]">{trackCount(tracks.length, lang, t)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => (current ? toggle() : playStation(id))} aria-pressed={active} className={PRIMARY_BTN}>
              {active ? <Pause className="h-4 w-4" fill="currentColor" aria-hidden="true" /> : <Play className="h-4 w-4 translate-x-[6%]" fill="currentColor" aria-hidden="true" />}
              {active ? t.player.pause : t.player.playStation}
            </button>
            {tracks.length > 1 && (
              <button type="button" onClick={() => shuffleStation(id)} className={SECONDARY_BTN}>
                <Shuffle className="h-4 w-4" aria-hidden="true" />
                {t.player.shufflePlay}
              </button>
            )}
          </div>
        </div>
      </div>
      <section aria-labelledby="station-tracks-title">
        <h2 id="station-tracks-title" className="sr-only">
          {t.app.resultsTracks}
        </h2>
        <TrackRows tracks={tracks} stationId={id} />
      </section>
    </div>
  );
}

/** Arrow keys move between `[data-result]` controls; Up from the first one returns to the search field. */
function onResultsKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-result]'));
  const index = items.findIndex((el) => el === document.activeElement || el.contains(document.activeElement));
  if (index < 0) return;
  e.preventDefault();
  if (e.key === 'ArrowDown') items[Math.min(items.length - 1, index + 1)]?.focus();
  else if (index === 0) document.getElementById(SEARCH_INPUT_ID)?.focus();
  else items[index - 1]?.focus();
}

export function SearchView({ q }: { q: string }) {
  const { t, lang } = useLang();
  const { library, stations } = usePlayer();
  const { recent } = useCollection();
  const results = useMemo(() => searchLibrary(library, stations, q, t.player.allMusic), [library, stations, q, t]);

  // No query yet: the search landing shows what to listen to — recently played (if any) above the
  // full newest-first mixes list — instead of the lone "All music" station tile.
  if (!results) {
    const recentTracks = byIds(library, recent).slice(0, LATEST_MAX);
    return (
      <div className="flex flex-col gap-8">
        <ViewHeading sr>{t.app.search}</ViewHeading>
        <Shelf id="search-recent" title={t.app.recent} items={trackItems(recentTracks, ALL_STATION)} />
        <MixesList id="search-mixes" library={library} />
      </div>
    );
  }
  const total = results.stations.length + results.tracks.length;
  const count = total === 1 ? t.app.resultsOne : fill(t.app.resultsMany, { n: new Intl.NumberFormat(NUMBER_LOCALE[lang]).format(total) });
  return (
    <div className="flex flex-col gap-8">
      <ViewHeading sr>{t.app.search}</ViewHeading>
      <p role="status" className="sr-only">
        {total ? count : fill(t.app.noResults, { q: q.trim() })}
      </p>
      {total === 0 ? (
        <div className="grid place-items-center py-10">
          <span aria-hidden="true" className="mb-3 text-[var(--muted-foreground)]">
            <SearchX className="h-10 w-10" />
          </span>
          <StateNotice tone="neutral" title={fill(t.app.noResults, { q: q.trim() })} body={t.app.noResultsHint}>
            <a href={routeHref({ name: 'search', q: '' })} className={LINK_BTN}>
              {t.app.browseAll}
            </a>
          </StateNotice>
        </div>
      ) : (
        <div id="search-results" onKeyDown={onResultsKeyDown} data-scroll-list className="flex flex-col gap-8">
          {results.tracks.length > 0 && (
            <section aria-labelledby="search-tracks-title" className="min-w-0">
              <h2 id="search-tracks-title" className="px-1 pb-2 text-xl font-black tracking-tight">
                {t.app.resultsTracks}
              </h2>
              <TrackRows tracks={results.tracks} stationId={ALL_STATION} result />
            </section>
          )}
          <Shelf id="search-stations" title={t.app.resultsStations} items={stationItems(results.stations, true)} layout="grid" />
        </div>
      )}
    </div>
  );
}

/** Shared track link (`#/track/<id>`): the track is cued (no autoplay); the first tap on Play starts it. */
export function TrackPage({ id }: { id: string }) {
  const { t, lang } = useLang();
  const { library, track: current, playing, toggle, cueTrack, playStation } = usePlayer();
  const track = library.tracks.find((x) => x.id === id);
  const found = Boolean(track);

  // Cue once per opened link (never interrupts music that is already playing).
  useEffect(() => {
    if (found) cueTrack(id);
  }, [id, found, cueTrack]);

  if (!track) {
    return (
      <div className="grid min-h-[50%] place-items-center">
        <ViewHeading sr>{t.app.trackNotFound}</ViewHeading>
        <StateNotice tone="neutral" title={t.app.trackNotFound} body={t.app.trackNotFoundBody}>
          <a href={routeHref({ name: 'search', q: '' })} className={LINK_BTN}>
            {t.app.browseAll}
          </a>
        </StateNotice>
      </div>
    );
  }
  const isCurrent = current.id === track.id && Boolean(current.src);
  const active = isCurrent && playing;
  const stationsOf = track.categories.map((cid) => library.categories.find((c) => c.id === cid)).filter((c): c is Category => Boolean(c));
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-5 px-1 pt-2">
        <TrackArt track={track} big className="aspect-square w-40 rounded-xl shadow-2xl shadow-black/50 sm:w-52" />
        <div className="min-w-0 flex-1 basis-56">
          <p className="px-1 text-xs font-extrabold uppercase tracking-widest text-[var(--muted-foreground)]">{t.app.trackPage}</p>
          <ViewHeading>{track.title}</ViewHeading>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 px-1 text-sm text-[var(--muted-foreground)]">
            <bdi>{track.artist}</bdi>
            <TrackChips track={track} lang={lang} t={t} />
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => (isCurrent ? toggle() : playStation(ALL_STATION, track.id))} aria-pressed={active} className={PRIMARY_BTN}>
              {active ? <Pause className="h-4 w-4" fill="currentColor" aria-hidden="true" /> : <Play className="h-4 w-4 translate-x-[6%]" fill="currentColor" aria-hidden="true" />}
              {active ? t.player.pause : t.app.playThisTrack}
            </button>
            <ShareButton track={track} />
          </div>
        </div>
      </div>
      {stationsOf.length > 0 && <Shelf id="track-stations" title={t.player.stations} items={stationItems(stationsOf)} layout="grid" />}
    </div>
  );
}

/** "Your library" = saved/liked mixes only. Recently played lives on Home and in the sidebar. */
export function LibraryView() {
  const { t } = useLang();
  const { library } = usePlayer();
  const { liked } = useCollection();
  const likedTracks = byIds(library, liked);
  return (
    <div className="flex flex-col gap-8">
      <ViewHeading>{t.app.library}</ViewHeading>
      {likedTracks.length === 0 ? (
        <div className="grid place-items-center py-10">
          <span aria-hidden="true" className="mb-3 text-[var(--muted-foreground)]">
            <Heart className="h-10 w-10" />
          </span>
          <StateNotice tone="neutral" title={t.app.libraryEmpty} body={t.app.libraryEmptyHint} />
        </div>
      ) : (
        <Shelf id="lib-liked" title={t.app.liked} items={trackItems(likedTracks, ALL_STATION)} layout="grid" />
      )}
    </div>
  );
}
