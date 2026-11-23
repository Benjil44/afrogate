import type { CSSProperties } from 'react';
import { WifiOff } from 'lucide-react';
import { Equalizer } from '@/components/equalizer';
import { LoadingSkeleton, NoticeButton, StateNotice } from '@/components/state-notice';
import { PlayButton } from '@/components/transport';
import { useLang } from '@/i18n';
import { stationArt, stationName, usePlayer } from '@/lib/player';
import { ALL_STATION } from '@/lib/tracks';
import { cn } from '@/lib/utils';

/** Track issue + connectivity notices (shared by the desktop hero and the phone sheet). */
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

/** Large cover: track cover, else station cover, else the station gradient. Cross-fades per track on motion tiers. */
export function Cover({ className }: { className?: string }) {
  const { track, station, stationIndex } = usePlayer();
  const cover = track.cover ?? station?.cover ?? null;
  return (
    <div
      aria-hidden="true"
      className={cn('relative aspect-square shrink-0 overflow-hidden rounded-3xl shadow-2xl shadow-black/50', className)}
      style={{ background: stationArt(station?.color ?? null, stationIndex) }}
    >
      {cover && <img key={track.id} src={cover} alt="" width={360} height={360} decoding="async" className="cover-in h-full w-full object-cover" />}
    </div>
  );
}

/**
 * Library-level states for the main column: loading skeleton, manifest error with Retry,
 * empty library, empty / unknown station. Returns null when the player can render.
 */
export function LibraryState({ onOpenVpn }: { onOpenVpn: () => void }) {
  const { t } = useLang();
  const { status, reload, queue, playStation } = usePlayer();
  if (status === 'loading') return <LoadingSkeleton />;
  if (status === 'error')
    return (
      <StateNotice tone="error" title={t.player.errorTitle} body={t.player.errorBody}>
        <NoticeButton onClick={reload} icon primary>
          {t.player.retry}
        </NoticeButton>
      </StateNotice>
    );
  if (status === 'empty')
    return (
      <StateNotice tone="neutral" title={t.player.emptyTitle} body={t.player.emptyBody}>
        <NoticeButton onClick={onOpenVpn}>{t.player.getVpn}</NoticeButton>
      </StateNotice>
    );
  if (queue.length === 0)
    return (
      <StateNotice tone="neutral" title={t.player.stationEmpty} body={t.player.stationEmptyBody}>
        <NoticeButton onClick={() => playStation(ALL_STATION)} primary>
          {t.player.playAll}
        </NoticeButton>
      </StateNotice>
    );
  return null;
}

/** Desktop / tablet centre column: cover, title, artist · station, 8-band visualiser, first-tap Start. */
export function NowPlaying({ onOpenVpn }: { onOpenVpn: () => void }) {
  const { t, lang } = useLang();
  const { track, station, playing, started, blocked, status, queue } = usePlayer();
  const ready = status === 'ready' && queue.length > 0;
  const accent = station?.color ? ({ '--station': station.color } as CSSProperties) : undefined;

  return (
    <section aria-labelledby="np-title" className="np relative flex h-full min-h-0 flex-col items-center justify-center gap-4 overflow-hidden px-6 py-4" style={accent}>
      <div aria-hidden="true" className="np-glow pointer-events-none absolute inset-0" />
      <h2 id="np-title" className="sr-only">
        {t.player.nowPlaying}
      </h2>
      {!ready ? (
        <div className="relative flex w-full min-w-0 justify-center">
          <LibraryState onOpenVpn={onOpenVpn} />
        </div>
      ) : (
        <>
          <Cover className="np-cover relative" />
          <div className="relative w-full max-w-xl text-center">
            <p className="truncate text-2xl font-black tracking-tight lg:text-3xl">
              <bdi>{track.title}</bdi>
            </p>
            <p className="mt-1 truncate text-sm text-[var(--muted-foreground)]">
              <bdi>{track.artist}</bdi>
              {track.artist && ' · '}
              <bdi>{stationName(station, lang, t)}</bdi>
            </p>
          </div>
          {started && !blocked && <Equalizer active={playing} bars={8} className="visualiser relative h-8 text-[var(--station,var(--primary))]" />}
          {(!started || blocked) && (
            <div className="relative flex flex-col items-center gap-2">
              <PlayButton size="lg" />
              <p className="max-w-xs text-center text-xs text-[var(--muted-foreground)]">{t.player.startHint}</p>
            </div>
          )}
          <PlaybackNotices className="relative" />
        </>
      )}
    </section>
  );
}
