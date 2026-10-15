import { Loader2, Pause, Play } from 'lucide-react';
import { Equalizer } from '@/components/equalizer';
import { useLang } from '@/i18n';
import { trackArt, usePlayer } from '@/lib/player';
import { useScrollFlag } from '@/motion/use-scroll-flag';
import { cn } from '@/lib/utils';

/**
 * Music-app style bottom bar: slides in once a mix is playing and the hero player is off screen.
 * Stays mounted; `.is-visible` drives a CSS translate/visibility transition (no presence library).
 */
export function MiniPlayer() {
  const { t } = useLang();
  const { track, index, playing, loading, toggle } = usePlayer();
  const pastHero = useScrollFlag(() => window.innerHeight * 0.9);
  const visible = playing && pastHero;

  return (
    <div className={cn('mini-player fixed inset-x-3 bottom-3 z-40 sm:inset-x-auto sm:start-5 sm:w-80', visible && 'is-visible')}>
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--card)_85%,transparent)] p-2.5 shadow-2xl backdrop-blur-xl">
        <span className="h-11 w-11 shrink-0 rounded-xl" style={{ background: trackArt(index) }} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">
            <bdi>{track.title || t.deck.noTrack}</bdi>
          </span>
          <span className="block truncate text-xs text-[var(--muted-foreground)]">
            <bdi>{track.artist}</bdi>
          </span>
        </span>
        <Equalizer active={playing} bars={4} className="h-4 text-[var(--primary)]" />
        <button
          type="button"
          aria-label={playing ? t.hero.player.pause : t.hero.player.play}
          aria-pressed={playing}
          onClick={() => toggle()}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--secondary))] text-white"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : playing ? (
            <Pause className="h-5 w-5" fill="currentColor" aria-hidden="true" />
          ) : (
            <Play className="ms-0.5 h-5 w-5" fill="currentColor" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
