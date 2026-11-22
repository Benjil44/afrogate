import { forwardRef } from 'react';
import { Equalizer } from '@/components/equalizer';
import { ProgressHairline } from '@/components/seek-bar';
import { CoverThumb, NextButton, PlayButton } from '@/components/transport';
import { useLang } from '@/i18n';
import { usePlayer } from '@/lib/player';

/**
 * Phone mini bar (64px, a grid row — never overlays content, so focus is never obscured):
 * cover + title opens the full player sheet; Play/Pause and Next act in place. A hairline shows
 * progress (decorative; the real slider is in the sheet).
 */
export const MiniPlayer = forwardRef<HTMLButtonElement, { onOpen: () => void; sheetOpen: boolean }>(function MiniPlayer({ onOpen, sheetOpen }, ref) {
  const { t } = useLang();
  const { track, playing } = usePlayer();
  return (
    <section aria-label={t.player.playerRegion} className="mini-bar relative flex h-16 items-center gap-2 border-t border-[var(--border)] bg-[var(--card)] ps-2 pe-1">
      <button
        ref={ref}
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-expanded={sheetOpen}
        aria-label={`${t.player.openPlayer}: ${track.title}`}
        className="flex h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-1 text-start"
      >
        <CoverThumb className="h-11 w-11" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">
            <bdi>{track.title || t.player.noTrack}</bdi>
          </span>
          <span className="block truncate text-xs text-[var(--muted-foreground)]">
            <bdi>{track.artist}</bdi>
          </span>
        </span>
        <Equalizer active={playing} bars={4} className="h-4 shrink-0 text-[var(--accent)]" />
      </button>
      <PlayButton size="sm" />
      <NextButton />
      <ProgressHairline />
    </section>
  );
});
