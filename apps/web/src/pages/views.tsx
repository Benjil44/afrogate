import { useMemo } from 'react';
import { Heart, Play, SearchX } from 'lucide-react';
import { CategoryArt } from '@/components/art';
import { Shelf, StationCard, TrackCard, type ShelfItem } from '@/components/cards';
import { NoticeButton, StateNotice } from '@/components/state-notice';
import { fill, trackCount, useLang, type Dict, type Lang } from '@/i18n';
import { useCollection } from '@/lib/collection';
import { stationName, usePlayer } from '@/lib/player';
import { routeHref } from '@/lib/route';
import { ALL_STATION, stationTracks, type Category, type Library, type Track } from '@/lib/tracks';

/**
 * Main-panel views. Each starts with an `h1`-level heading for the view (focused on navigation
 * so screen readers land on the new content). Rows follow the catalogue: empty shelves are
 * hidden and a one-card shelf becomes a grid.
 */
const LATEST_MAX = 10;

function ViewHeading({ children, sr = false }: { children: string; sr?: boolean }) {
  return (
    <h1 data-view-heading tabIndex={-1} className={sr ? 'sr-only' : 'px-1 text-3xl font-black tracking-tight outline-none'}>
      {children}
    </h1>
  );
}

function trackItems(tracks: readonly Track[], stationId: string): ShelfItem[] {
  return tracks.map((track) => ({ key: track.id, node: <TrackCard track={track} stationId={stationId} /> }));
}

function stationItems(categories: readonly Category[]): ShelfItem[] {
  return categories.map((c) => ({ key: c.id, node: <StationCard category={c} /> }));
}

/** Manifest order is publish order, so the newest mixes are last: show them first. */
function latestTracks(library: Library): Track[] {
  return [...library.tracks].reverse().slice(0, LATEST_MAX);
}

function byIds(library: Library, ids: readonly string[]): Track[] {
  const map = new Map(library.tracks.map((t) => [t.id, t] as const));
  return ids.map((id) => map.get(id)).filter((t): t is Track => Boolean(t));
}

export function HomeView() {
  const { t } = useLang();
  const { library, stations } = usePlayer();
  const { recent } = useCollection();
  const realStations = stations.filter((c) => !c.synthetic);
  const latest = latestTracks(library);
  const recentTracks = byIds(library, recent).slice(0, LATEST_MAX);
  return (
    <div className="flex flex-col gap-8">
      <ViewHeading sr>{t.app.home}</ViewHeading>
      <Shelf id="row-recent" title={t.app.recent} showAllHref={routeHref({ name: 'library' })} items={trackItems(recentTracks, ALL_STATION)} />
      {/* Stations only when the manifest has real categories ("All music" alone adds nothing here). */}
      {realStations.length > 0 && <Shelf id="row-stations" title={t.app.stationsRow} showAllHref={routeHref({ name: 'browse' })} items={stationItems(stations)} />}
      <Shelf id="row-latest" title={t.app.latest} showAllHref={routeHref({ name: 'latest' })} items={trackItems(latest, ALL_STATION)} />
      {library.tracks.length > LATEST_MAX && (
        <Shelf id="row-all" title={t.app.allTracks} showAllHref={routeHref({ name: 'all' })} items={trackItems(library.tracks, ALL_STATION)} />
      )}
    </div>
  );
}

export function BrowseView() {
  const { t } = useLang();
  const { stations } = usePlayer();
  return (
    <div className="flex flex-col gap-6">
      <ViewHeading>{t.app.browse}</ViewHeading>
      <Shelf id="grid-stations" title={t.app.stationsRow} items={stationItems(stations)} layout="grid" />
    </div>
  );
}

export function TrackListView({ kind }: { kind: 'all' | 'latest' }) {
  const { t, lang } = useLang();
  const { library } = usePlayer();
  const tracks = kind === 'all' ? library.tracks : latestTracks(library);
  const title = kind === 'all' ? t.app.allTracks : t.app.latest;
  return (
    <div className="flex flex-col gap-6">
      <ViewHeading>{title}</ViewHeading>
      <Shelf id={`grid-${kind}`} title={trackCount(tracks.length, lang, t)} items={trackItems(tracks, ALL_STATION)} layout="grid" />
    </div>
  );
}

export function StationPage({ id }: { id: string }) {
  const { t, lang } = useLang();
  const { library, playStation, stationId, playing, toggle } = usePlayer();
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
  const active = stationId === id && playing;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end gap-5 px-1">
        <CategoryArt category={category} label={name} big className="aspect-square w-32 rounded-xl shadow-2xl shadow-black/50 sm:w-44" />
        <div className="min-w-0 flex-1">
          <ViewHeading>{name}</ViewHeading>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{trackCount(tracks.length, lang, t)}</p>
          <button
            type="button"
            onClick={() => (active ? toggle() : playStation(id))}
            aria-pressed={active}
            className="mt-3 inline-flex h-12 items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--primary),var(--secondary))] px-6 text-sm font-bold text-white shadow-lg"
          >
            <Play className="h-4 w-4 translate-x-[6%]" fill="currentColor" aria-hidden="true" />
            {t.player.playStation}
          </button>
        </div>
      </div>
      <Shelf id="grid-station" title={t.app.resultsTracks} items={trackItems(tracks, id)} layout="grid" />
    </div>
  );
}

function normalise(text: string): string {
  // Case-insensitive, Arabic/Persian letter variants folded (ي->ی, ك->ک), ZWNJ and diacritics ignored.
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[ً-ٰٟ‌‍]/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim();
}

function categoryNames(category: Category, lang: Lang, t: Dict): string {
  return `${stationName(category, lang, t)} ${category.name.en} ${category.name.fa ?? ''}`;
}

export function SearchView({ q }: { q: string }) {
  const { t, lang } = useLang();
  const { library, stations } = usePlayer();
  const query = normalise(q);
  const results = useMemo(() => {
    if (!query) return null;
    const matchingStations = stations.filter((c) => normalise(categoryNames(c, lang, t)).includes(query));
    const tracks = library.tracks.filter((track) => {
      const cats = track.categories
        .map((id) => library.categories.find((c) => c.id === id))
        .filter((c): c is Category => Boolean(c))
        .map((c) => categoryNames(c, lang, t))
        .join(' ');
      return normalise(`${track.title} ${track.artist} ${cats}`).includes(query);
    });
    return { stations: matchingStations, tracks };
  }, [query, stations, library, lang, t]);

  if (!results) {
    return (
      <div className="flex flex-col gap-6">
        <ViewHeading>{t.app.search}</ViewHeading>
        <Shelf id="search-browse" title={t.app.browseAll} items={stationItems(stations)} layout="grid" />
      </div>
    );
  }
  const none = results.stations.length === 0 && results.tracks.length === 0;
  return (
    <div className="flex flex-col gap-8">
      <ViewHeading sr>{t.app.search}</ViewHeading>
      {none ? (
        <div className="grid place-items-center py-10">
          <span aria-hidden="true" className="mb-3 text-[var(--muted-foreground)]">
            <SearchX className="h-10 w-10" />
          </span>
          <StateNotice tone="neutral" title={fill(t.app.noResults, { q: q.trim() })} body={t.app.noResultsHint}>
            <a href={routeHref({ name: 'browse' })} className="inline-flex h-11 items-center rounded-full border border-[var(--border)] px-5 text-sm font-bold hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)]">
              {t.app.browseAll}
            </a>
          </StateNotice>
        </div>
      ) : (
        <>
          <Shelf id="search-stations" title={t.app.resultsStations} items={stationItems(results.stations)} layout="grid" />
          <Shelf id="search-tracks" title={t.app.resultsTracks} items={trackItems(results.tracks, ALL_STATION)} layout="grid" />
        </>
      )}
    </div>
  );
}

export function LibraryView() {
  const { t } = useLang();
  const { library } = usePlayer();
  const { liked, recent } = useCollection();
  const likedTracks = byIds(library, liked);
  const recentTracks = byIds(library, recent);
  return (
    <div className="flex flex-col gap-8">
      <ViewHeading>{t.app.library}</ViewHeading>
      {likedTracks.length === 0 && recentTracks.length === 0 ? (
        <div className="grid place-items-center py-10">
          <span aria-hidden="true" className="mb-3 text-[var(--muted-foreground)]">
            <Heart className="h-10 w-10" />
          </span>
          <StateNotice tone="neutral" title={t.app.libraryEmpty} body={t.app.libraryEmptyHint} />
        </div>
      ) : (
        <>
          <Shelf id="lib-liked" title={t.app.liked} items={trackItems(likedTracks, ALL_STATION)} layout="grid" />
          <Shelf id="lib-recent" title={t.app.recent} items={trackItems(recentTracks, ALL_STATION)} layout="grid" />
        </>
      )}
    </div>
  );
}
