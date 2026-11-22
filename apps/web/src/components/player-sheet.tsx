import { useRef, type CSSProperties } from 'react';
import { ChevronDown } from 'lucide-react';
import { Cover, PlaybackNotices } from '@/components/now-playing';
import { Overlay } from '@/components/overlay';
import { QueueList } from '@/components/queue-list';
import { SeekBar } from '@/components/seek-bar';
import { NextButton, PlayButton, PrevButton, RepeatButton, ShuffleButton } from '@/components/transport';
import { useLang } from '@/i18n';
import { stationName, usePlayer } from '@/lib/player';

/**
 * Phone full player (opened from the mini bar): close, cover, title, timeline, transport, Up next.
 * Fits 360×640 without page scroll — only the queue scrolls. No volume slider on phones (hardware
 * keys; iOS ignores element volume). Close button always present; Esc closes; focus is trapped.
 */
export function PlayerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useLang();
  const { track, station } = usePlayer();
  const closeRef = useRef<HTMLButtonElement>(null);
  const accent = station?.color ? ({ '--station': station.color } as CSSProperties) : undefined;

  return (
    <Overlay open={open} onClose={onClose} variant="bottom" labelledBy="player-sheet-title" initialFocus={closeRef}>
      <div className="flex h-full min-h-0 flex-col" style={accent}>
        <div className="flex h-14 shrink-0 items-center gap-2 px-2">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t.player.closePlayer}
            className="grid h-11 w-11 place-items-center rounded-full text-[var(--foreground)] hover:bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)]"
          >
            <ChevronDown className="h-6 w-6" aria-hidden="true" />
          </button>
          <h2 id="player-sheet-title" className="min-w-0 flex-1 truncate text-center text-sm font-bold text-[var(--muted-foreground)]">
            {t.player.nowPlaying} · <bdi>{stationName(station, lang, t)}</bdi>
          </h2>
          <span className="w-11" aria-hidden="true" />
        </div>
        <div className="flex shrink-0 flex-col items-center gap-3 px-5">
          <Cover className="sheet-cover" />
          <div className="w-full text-center">
            <p className="truncate text-xl font-black">
              <bdi>{track.title}</bdi>
            </p>
            <p className="truncate text-sm text-[var(--muted-foreground)]">
              <bdi>{track.artist}</bdi>
            </p>
          </div>
          <SeekBar tall />
          <div className="flex w-full items-center justify-between">
            <ShuffleButton />
            <PrevButton />
            <PlayButton size="md" />
            <NextButton />
            <RepeatButton />
          </div>
          <PlaybackNotices />
        </div>
        <QueueList compact className="min-h-0 flex-1 border-t border-[var(--border)]" />
      </div>
    </Overlay>
  );
}
