import { useRef, type CSSProperties, type TouchEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { Cover, PlaybackNotices } from '@/components/now-playing';
import { Overlay } from '@/components/overlay';
import { QueueList } from '@/components/queue-list';
import { SeekBar } from '@/components/seek-bar';
import { LikeButton, NextButton, PlayButton, PrevButton, RepeatButton, ShuffleButton } from '@/components/transport';
import { useLang } from '@/i18n';
import { stationName, usePlayer } from '@/lib/player';
import { useMotionTier } from '@/motion/provider';

/** Drag distance (px) past which a downward swipe closes the sheet. */
const SWIPE_CLOSE = 96;

/**
 * Phone full player (opened from the mini bar): close, cover, title, timeline, transport, Up next.
 * Fits 360×640 without page scroll — only the queue scrolls. No volume slider on phones (hardware
 * keys; iOS ignores element volume). Close button always present; Esc, the Back button (history entry
 * pushed by the shell) and a downward swipe on the header / cover close it; focus is trapped. The swipe
 * is an enhancement on the header and cover only, so the seek bar and the queue keep their gestures.
 */
export function PlayerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useLang();
  const { track, station } = usePlayer();
  const closeRef = useRef<HTMLButtonElement>(null);
  const accent = station?.color ? ({ '--station': station.color } as CSSProperties) : undefined;
  const tier = useMotionTier();
  const bodyRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ y: number; dy: number } | null>(null);

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) dragRef.current = { y: e.touches[0].clientY, dy: 0 };
  };
  const onTouchMove = (e: TouchEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    drag.dy = Math.max(0, e.touches[0].clientY - drag.y);
    // Follow the finger (skipped on the static tier: no motion, the close still happens on release).
    if (bodyRef.current && tier !== 'static') bodyRef.current.style.transform = `translateY(${drag.dy}px)`;
  };
  const onTouchEnd = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (bodyRef.current) bodyRef.current.style.transform = '';
    if (drag && drag.dy > SWIPE_CLOSE) onClose();
  };
  const swipe = { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd };

  return (
    <Overlay open={open} onClose={onClose} variant="bottom" labelledBy="player-sheet-title" initialFocus={closeRef}>
      <div ref={bodyRef} className="flex h-full min-h-0 flex-col" style={accent}>
        <div className="flex h-14 shrink-0 touch-pan-x items-center gap-2 px-2" {...swipe}>
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
          <div className="touch-pan-x" {...swipe}>
            <Cover className="sheet-cover" />
          </div>
          <div className="flex w-full items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xl font-black">
                <bdi>{track.title}</bdi>
              </p>
              <p className="truncate text-sm text-[var(--muted-foreground)]">
                <bdi>{track.artist}</bdi>
              </p>
            </div>
            <LikeButton />
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
