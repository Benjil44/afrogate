import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MiniPlayer } from '@/components/mini-player';
import { LibraryState, NowPlayingPanel, NowPlayingSheet } from '@/components/now-playing';
import { PlaybackSettingsButton } from '@/components/playback-settings';
import { PlayerSheet } from '@/components/player-sheet';
import { ShortcutsDialog } from '@/components/shortcuts-dialog';
import { Sidebar, TabBar } from '@/components/sidebar';
import { SEARCH_INPUT_ID, TopBar } from '@/components/top-bar';
import { TransportBar } from '@/components/transport';
import { fill, useLang } from '@/i18n';
import { useCollection } from '@/lib/collection';
import { usePlayer } from '@/lib/player';
import { routeHref, useHashRoute, type Route } from '@/lib/route';
import { useShortcuts } from '@/lib/use-shortcuts';
import { HomeView, LibraryView, SearchView, StationPage, TrackListView, TrackPage } from '@/pages/views';

/**
 * Streaming-app shell (afrows.com = the radio only). The page never scrolls (`100dvh` grid,
 * `overflow: hidden`); only the main panel's content and the side lists scroll inside.
 *
 *   >= 1280   sidebar (nav + your library) | main panel | now playing  /  player bar (80px)
 *   768–1279  icon sidebar | main panel  /  player bar; now playing opens as a side sheet
 *   < 768     main panel / mini player (64px, opens the full player sheet) / tab bar
 *
 * Routes are hash-based (`lib/route.ts`): #/ · #/search?q= · #/library ·
 * #/station/<id> · #/all · #/latest · #/track/<id> (share links).
 */
function View({ route }: { route: Route }) {
  switch (route.name) {
    case 'search':
      return <SearchView q={route.q} />;
    case 'library':
      return <LibraryView />;
    case 'station':
      return <StationPage id={route.id} />;
    case 'track':
      return <TrackPage id={route.id} />;
    case 'all':
    case 'latest':
      return <TrackListView kind={route.name} />;
    default:
      return <HomeView />;
  }
}

function routeKey(route: Route): string {
  return route.name === 'station' || route.name === 'track' ? `${route.name}:${route.id}` : route.name;
}

export function Home() {
  const { t } = useLang();
  const { status, track, playing, started, ad } = usePlayer();
  const { addRecent } = useCollection();
  const [route, navigate] = useHashRoute();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [nowOpen, setNowOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Legacy hashes: `#station=<id>` -> `#/station/<id>`; old landing anchors (`#vpn`, `#pricing`, …) -> home.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && !hash.startsWith('#/')) window.history.replaceState(window.history.state, '', routeHref(route));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route change: main panel back to the top; focus moves to the new view's heading (not while
  // typing a search, which must keep focus in the field).
  const lastRoute = useRef<string>(routeKey(route));
  useEffect(() => {
    const key = routeKey(route);
    if (key === lastRoute.current) return;
    lastRoute.current = key;
    scrollRef.current?.scrollTo({ top: 0 });
    if (route.name === 'search') return;
    const frame = requestAnimationFrame(() => scrollRef.current?.querySelector<HTMLElement>('[data-view-heading]')?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [route]);

  // Recently played (this browser only).
  useEffect(() => {
    if (playing && track.src) addRecent(track.id);
  }, [playing, track, addRecent]);

  // Phone player sheet: its own history entry, so Back closes it.
  const openSheet = useCallback(() => {
    const state: unknown = window.history.state;
    window.history.pushState({ ...(state && typeof state === 'object' ? state : {}), playerSheet: true }, '');
    setSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    const state = window.history.state as { playerSheet?: boolean } | null;
    if (state?.playerSheet) window.history.back(); // popstate below closes it
    else setSheetOpen(false);
  }, []);

  useEffect(() => {
    const onPop = () => {
      const state = window.history.state as { playerSheet?: boolean } | null;
      if (!state?.playerSheet) setSheetOpen(false);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);
  const focusSearch = useCallback(() => document.getElementById(SEARCH_INPUT_ID)?.focus(), []);
  useShortcuts(openShortcuts, focusSearch);

  // Polite announcement on track change only (not on load, not on progress).
  const [announcement, setAnnouncement] = useState('');
  const lastAnnounced = useRef<string | null>(null);
  useEffect(() => {
    if (!started || !playing || track.id === lastAnnounced.current || !track.src) return;
    lastAnnounced.current = track.id;
    setAnnouncement(fill(t.player.nowPlayingAnnounce, { title: track.title, artist: track.artist }));
  }, [started, playing, track, t]);
  // An ad break: say so once (the music track did not change, so the effect above stays quiet).
  useEffect(() => {
    if (ad) {
      lastAnnounced.current = null; // the track after the break is announced again
      setAnnouncement(t.player.advertisement);
    }
  }, [ad, t]);

  const ready = status === 'ready';

  return (
    <div className="shell bg-background text-foreground">
      <a
        href="#content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('content')?.focus();
        }}
      >
        {t.app.skipToContent}
      </a>

      <div className="area-side">
        <Sidebar route={route} />
      </div>

      <main id="content" tabIndex={-1} className="area-main panel flex flex-col outline-none">
        <TopBar route={route} navigate={navigate} onOpenShortcuts={openShortcuts} />
        <div ref={scrollRef} className="scroll-area min-h-0 flex-1 overflow-y-auto px-2 pb-6 sm:px-4">
          {ready ? (
            <View route={route} />
          ) : (
            <div className="grid min-h-full place-items-center py-8">
              <LibraryState />
            </div>
          )}
        </div>
      </main>

      <aside aria-label={t.player.nowPlaying} className="area-now panel">
        <NowPlayingPanel />
      </aside>

      <div className="area-bar">
        <TransportBar nowOpen={nowOpen} onToggleNow={() => setNowOpen((o) => !o)} extra={<PlaybackSettingsButton size="sm" />} />
      </div>

      {ready && track.src && (
        <div className="area-mini">
          <MiniPlayer sheetOpen={sheetOpen} onOpen={openSheet} />
        </div>
      )}

      <div className="area-tabs">
        <TabBar route={route} />
      </div>

      {/* At <body> level so it is still heard while a sheet makes the app root inert. */}
      {createPortal(
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>,
        document.body,
      )}

      <PlayerSheet open={sheetOpen} onClose={closeSheet} />
      <NowPlayingSheet open={nowOpen} onClose={() => setNowOpen(false)} />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
