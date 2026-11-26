import { useEffect, useRef, useState } from 'react';
import { WifiOff, X } from 'lucide-react';
import { TrackArt } from '@/components/art';
import { Overlay } from '@/components/overlay';
import { QueueList } from '@/components/queue-list';
import { ShareButton } from '@/components/share-button';
import { LoadingSkeleton, NoticeButton, StateNotice } from '@/components/state-notice';
import { LikeButton } from '@/components/transport';
import { useLang } from '@/i18n';
import { stationName, usePlayer } from '@/lib/player';
import { ALL_STATION, type Track } from '@/lib/tracks';
import { useMotionTier } from '@/motion/provider';
import { cn } from '@/lib/utils';

/** Track issue + connectivity notices (now-playing panel and phone sheet). */
export function PlaybackNotices({ className }: { className?: string }) {
  const { t } = useLang();
  const { issue, online, started, retryTrack } = usePlayer();
  return (
    <div role="status" className={cn('flex min-h-6 flex-col items-center gap-2 text-center text-sm', className)}>
      {issue === 'skipping' && <p className="font-semibold text-[var(--accent)]">{t.player.skipping}</p>}
      {issue === 'failed' && (
        <p className="flex flex-wrap items-center justify-center gap-2 font-semibold text-[var(--accent)]">
          {t.player.trackFailed}
          <NoticeButton onClick={retryTrack} icon>
            {t.player.retry}
          </NoticeButton>
        </p>
      )}
      {!online && started && (
        <p className="inline-flex items-center gap-2 text-[var(--muted-foreground)]">
          <WifiOff className="h-4 w-4" aria-hidden="true" />
          {t.player.offline}
        </p>
      )}
    </div>
  );
}

/**
 * Large cover of the current track (cover image, else generated art). The signature moment: on a
 * track change the old cover crossfades out while the new one fades + scales in (~300ms); on pause it
 * settles to ~0.96 with a slight dim. The outgoing cover is kept mounted only for the fade.
 */
export function Cover({ className }: { className?: string }) {
  const { track, playing, started } = usePlayer();
  const tier = useMotionTier();
  const [prev, setPrev] = useState<Track | null>(null);
  const curRef = useRef(track);

  useEffect(() => {
    if (track.id === curRef.current.id) return;
    if (tier !== 'static') setPrev(curRef.current);
    curRef.current = track;
    const timer = window.setTimeout(() => setPrev(null), 320);
    return () => window.clearTimeout(timer);
  }, [track, tier]);

  const paused = started && !playing;
  return (
    <div className={cn('cover-shell relative aspect-square overflow-hidden rounded-xl', paused && 'is-paused', className)}>
      <TrackArt key={track.id} track={track} big className="cover-xfade-in absolute inset-0 h-full w-full rounded-xl" />
      {prev && <TrackArt key={prev.id} track={prev} big className="cover-xfade-out absolute inset-0 h-full w-full rounded-xl" />}
      <span aria-hidden="true" className="cover-dim pointer-events-none absolute inset-0 rounded-xl bg-black" />
    </div>
  );
}

/**
 * Library-level states for the main panel: loading skeleton, manifest error with Retry, empty
 * library. Returns null when the library is ready.
 */
export function LibraryState() {
  const { t } = useLang();
  const { status, reload } = usePlayer();
  if (status === 'loading') return <LoadingSkeleton />;
  if (status === 'error')
    return (
      <StateNotice tone="error" title={t.player.errorTitle} body={t.player.errorBody}>
        <NoticeButton onClick={reload} icon primary>
          {t.player.retry}
        </NoticeButton>
      </StateNotice>
    );
  if (status === 'empty') return <StateNotice tone="neutral" title={t.player.emptyTitle} body={t.player.emptyBody} />;
  return null;
}

/** Shown in the now-playing panel when the current station has no playable track. */
function EmptyQueue() {
  const { t } = useLang();
  const { playStation } = usePlayer();
  return (
    <StateNotice tone="neutral" title={t.player.stationEmpty} body={t.player.stationEmptyBody}>
      <NoticeButton onClick={() => playStation(ALL_STATION)} primary>
        {t.player.playAll}
      </NoticeButton>
    </StateNotice>
  );
}

/**
 * End-side "Now playing" panel (>= 1280px column; a side sheet below that): cover, title,
 * artist · station, like, notices and the Up next queue (the only part that scrolls).
 */
export function NowPlayingPanel({ onClose, headingId = 'np-title' }: { onClose?: () => void; headingId?: string }) {
  const { t, lang } = useLang();
  const { track, station, status, queue, ad } = usePlayer();
  const ready = status === 'ready' && queue.length > 0;
  return (
    <section aria-labelledby={headingId} className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-4">
        <h2 id={headingId} className="truncate text-base font-black">
          {t.player.nowPlaying}
        </h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t.app.closeNowPlaying}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--foreground)] hover:bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>
      {status !== 'ready' ? null : !ready ? (
        <div className="grid flex-1 place-items-center px-2">
          <EmptyQueue />
        </div>
      ) : (
        <>
          <div className="flex shrink-0 flex-col gap-3 px-4">
            <Cover className="np-panel-cover mx-auto w-full" />
            <div className="flex items-start gap-2">
              <div key={ad ? 'ad' : track.id} className="np-text-in min-w-0 flex-1">
                <p className="truncate text-lg font-black">
                  <bdi>{ad ? t.player.advertisement : track.title}</bdi>
                </p>
                <p className="truncate text-sm text-[var(--muted-foreground)]">
                  {ad ? (
                    <bdi>{t.player.adNote}</bdi>
                  ) : (
                    <>
                      <bdi>{track.artist}</bdi>
                      {track.artist && ' · '}
                      <bdi>{stationName(station, lang, t)}</bdi>
                    </>
                  )}
                </p>
              </div>
              <ShareButton track={track} />
              <LikeButton />
            </div>
            <PlaybackNotices />
          </div>
          <QueueList id={`${headingId}-queue`} compact className="min-h-0 flex-1" />
        </>
      )}
    </section>
  );
}

/** Now playing as an end-side sheet (768–1279px, where the column is hidden). */
export function NowPlayingSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Overlay open={open} onClose={onClose} variant="side" labelledBy="np-sheet-title">
      <NowPlayingPanel onClose={onClose} headingId="np-sheet-title" />
    </Overlay>
  );
}
