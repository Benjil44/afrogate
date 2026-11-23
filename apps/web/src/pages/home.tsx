import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { AppHeader } from '@/components/app-header';
import { MiniPlayer } from '@/components/mini-player';
import { LibraryState, NowPlaying } from '@/components/now-playing';
import { PlayerSheet } from '@/components/player-sheet';
import { QueueList } from '@/components/queue-list';
import { ShortcutsDialog } from '@/components/shortcuts-dialog';
import { StationChips, StationGrid, StationRail, StationView } from '@/components/stations';
import { TransportBar } from '@/components/transport';
import { fill, useLang } from '@/i18n';
import { usePlayer } from '@/lib/player';
import { ALL_STATION } from '@/lib/tracks';
import { useShortcuts } from '@/lib/use-shortcuts';
import { cn } from '@/lib/utils';

/**
 * One-screen player (design: afrows-player/01_PLAYER_UX.md). The shell is a `100dvh` grid with
 * `overflow: hidden`; only the station rail / grid and the queue scroll internally.
 *
 *   >= 1280  header / stations rail | now playing | up next / transport bar (80px)
 *   1024+    header / station chips / now playing | up next / transport bar
 *   640+     header / station chips / now playing (+ "Up next" toggle panel) / transport bar
 *   < 640    header / station grid -> station list / mini bar (64px) -> full player sheet
 *
 * No router: views are state + `#hash` — `#station=<id>` selects a station. Old landing anchors
 * (`#vpn`, `#pricing`, …) simply land on the player: afrows.com is the radio only (owner, 2026-11-22).
 */
const STATION_HASH = /^#station=([a-z0-9_-]{1,40})$/;

interface HashRoute {
  station: string | null;
}

function readHash(): HashRoute {
  return { station: STATION_HASH.exec(window.location.hash)?.[1] ?? null };
}

function clearHash() {
  // Keep `history.state` (the player-sheet marker) when rewriting the URL.
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
}

export function Home() {
  const { t } = useLang();
  const { status, stations, stationId, track, playing, started, selectStation, station } = usePlayer();

  const [route, setRoute] = useState<HashRoute>(readHash);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [browseId, setBrowseId] = useState<string | null>(route.station);
  const appliedStation = useRef<string | null>(null);
  /** Deep-linked station waiting for the player state to catch up (keeps the hash sync from clearing it). */
  const pendingStation = useRef<string | null>(null);

  // Hash -> state (deep links, back/forward).
  useEffect(() => {
    const onHash = () => setRoute(readHash());
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onHash);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('popstate', onHash);
    };
  }, []);

  // `#station=<id>`: apply once the library is ready (unknown / empty ids show "Station is empty").
  useEffect(() => {
    if (status !== 'ready' || !route.station || appliedStation.current === route.station) return;
    appliedStation.current = route.station;
    pendingStation.current = route.station;
    selectStation(route.station);
    setBrowseId(route.station);
  }, [status, route.station, selectStation]);

  // Keep `#station=` in sync with the current station (shareable), without adding history entries.
  useEffect(() => {
    if (status !== 'ready') return;
    if (pendingStation.current) {
      if (stationId !== pendingStation.current) return;
      pendingStation.current = null;
    }
    const current = STATION_HASH.exec(window.location.hash)?.[1] ?? ALL_STATION;
    // Also drops legacy landing anchors (`#vpn`, `#pricing`, …) once the player is up.
    if (current === stationId && (stationId !== ALL_STATION || !window.location.hash)) return;
    if (stationId === ALL_STATION) clearHash();
    else window.history.replaceState(window.history.state, '', `#station=${stationId}`);
    appliedStation.current = stationId === ALL_STATION ? null : stationId;
  }, [status, stationId]);

  // Phone player sheet: its own history entry, so the Back button / gesture closes it.
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

  useShortcuts(useCallback(() => setShortcutsOpen(true), []));

  // Polite announcement on track change only (not on load, not on progress).
  const [announcement, setAnnouncement] = useState('');
  const lastAnnounced = useRef<string | null>(null);
  useEffect(() => {
    if (!started || !playing || track.id === lastAnnounced.current || !track.src) return;
    lastAnnounced.current = track.id;
    setAnnouncement(fill(t.player.nowPlayingAnnounce, { title: track.title, artist: track.artist }));
  }, [started, playing, track, t]);

  const multiStation = stations.length > 1;
  const ready = status === 'ready';
  const queueId = 'up-next';
  const accent = station?.color ? ({ '--station': station.color } as CSSProperties) : undefined;
  const phoneStation = multiStation ? browseId : ALL_STATION;

  return (
    <div className={cn('shell bg-background text-foreground', !multiStation && 'shell-single')} style={accent}>
      <a
        href="#main"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        {t.player.skipToPlayer}
      </a>

      <div className="area-header">
        <AppHeader onOpenShortcuts={() => setShortcutsOpen(true)} />
      </div>

      {ready && multiStation && (
        <>
          <div className="area-rail hidden xl:block">
            <StationRail />
          </div>
          <div className="area-chips hidden sm:block xl:hidden">
            <StationChips />
          </div>
        </>
      )}

      <main id="main" tabIndex={-1} className="area-main outline-none">
        {/* Phone: station grid -> station list. */}
        <div className="h-full sm:hidden">
          {!ready ? (
            <div className="flex h-full w-full min-w-0 items-center justify-center overflow-y-auto px-4 py-6">
              <LibraryState />
            </div>
          ) : phoneStation ? (
            <StationView id={phoneStation} onBack={multiStation ? () => setBrowseId(null) : undefined} />
          ) : (
            <StationGrid onBrowse={setBrowseId} />
          )}
        </div>
        {/* Tablet / desktop: now playing. */}
        <div className="hidden h-full sm:block">
          <NowPlaying />
        </div>
      </main>

      <div className={cn('area-queue hidden border-s border-[var(--border)] bg-background lg:block', queueOpen && 'sm:block')}>
        <QueueList id={queueId} />
      </div>

      <div className="area-bar">
        <div className="hidden h-full sm:block">
          <TransportBar queueOpen={queueOpen} onToggleQueue={() => setQueueOpen((o) => !o)} queueId={queueId} />
        </div>
        {ready && track.src && (
          <div className="sm:hidden">
            <MiniPlayer sheetOpen={sheetOpen} onOpen={openSheet} />
          </div>
        )}
      </div>

      {/* At <body> level so it is still heard while a sheet makes the app root inert. */}
      {createPortal(
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>,
        document.body,
      )}

      <PlayerSheet open={sheetOpen} onClose={closeSheet} />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
