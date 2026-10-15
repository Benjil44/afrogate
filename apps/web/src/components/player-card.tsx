import { Heart, Loader2, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Equalizer } from '@/components/equalizer';
import { SeekBar } from '@/components/seek-bar';
import { useLang } from '@/i18n';
import { trackArt, usePlayer } from '@/lib/player';

/**
 * Hero "receiver": the real player's now-playing card (vinyl, seek bar, transport).
 * Audio is streamed on demand through the shared player; nothing loads before play.
 */
export function PlayerCard({ className }: { className?: string }) {
  const { t, dir } = useLang();
  const { track, index, playing, loading, error, toggle, step } = usePlayer();
  const p = t.hero.player;
  // In RTL the "previous" arrow points right, so swap the icons rather than the semantics.
  const PrevIcon = dir === 'rtl' ? SkipForward : SkipBack;
  const NextIcon = dir === 'rtl' ? SkipBack : SkipForward;

  return (
    <div
      className={cn(
        'player-card relative w-full max-w-md rounded-3xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--card)_80%,transparent)] p-5 shadow-2xl shadow-[color-mix(in_oklch,var(--primary)_25%,transparent)] backdrop-blur-xl sm:p-6',
        className,
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between text-xs font-bold">
        <span className="inline-flex items-center gap-2 text-[var(--muted-foreground)]">
          <Equalizer active={playing} bars={4} className="h-3.5 text-[var(--primary)]" />
          {p.title}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklch,var(--primary)_16%,transparent)] px-2.5 py-1 text-[var(--foreground)]">
          <span className={cn('h-1.5 w-1.5 rounded-full bg-[var(--primary)]', playing && 'animate-blink')} />
          {t.deck.mix} {index + 1}
        </span>
      </div>

      {/* Vinyl art */}
      <div className="mt-5 grid place-items-center">
        <div className="relative h-44 w-44 sm:h-52 sm:w-52">
          <div
            className="animate-spin-slow absolute inset-0 rounded-full shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]"
            style={{ background: trackArt(index) }}
          >
            {/* grooves */}
            <div
              className="absolute inset-0 rounded-full opacity-40"
              style={{
                background:
                  'repeating-radial-gradient(circle at 50% 50%, transparent 0 3px, rgba(0,0,0,0.35) 3px 4px)',
              }}
            />
            <div className="absolute inset-[34%] rounded-full bg-[var(--background)]" />
            <div className="absolute inset-[46%] rounded-full bg-[var(--card)] ring-1 ring-[var(--border)]" />
          </div>
          {/* sheen */}
          <div className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(160deg,rgba(255,255,255,0.22),transparent_45%)]" />
        </div>
      </div>

      {/* Track info */}
      <div className="mt-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">
            <bdi>{track.title || t.deck.noTrack}</bdi>
          </p>
          <p className="truncate text-sm text-[var(--muted-foreground)]">
            <bdi>{track.artist}</bdi>
          </p>
        </div>
        <button
          type="button"
          aria-label={p.like}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--muted-foreground)] transition-colors hover:text-[var(--primary)]"
        >
          <Heart className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <SeekBar className="mt-3" />

      {/* Controls */}
      <div className="mt-3 flex items-center justify-center gap-4">
        <button
          type="button"
          aria-label={p.previous}
          onClick={() => step(-1)}
          className="grid h-12 w-12 place-items-center rounded-full text-[var(--foreground)] transition-colors hover:bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)]"
        >
          <PrevIcon className="h-6 w-6" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={playing ? p.pause : p.play}
          aria-pressed={playing}
          aria-busy={loading}
          onClick={() => toggle()}
          className="grid h-16 w-16 place-items-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--secondary))] text-white shadow-lg shadow-[color-mix(in_oklch,var(--primary)_45%,transparent)] transition-transform hover:scale-105 active:scale-95"
        >
          {loading ? (
            <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
          ) : playing ? (
            <Pause className="h-7 w-7" fill="currentColor" aria-hidden="true" />
          ) : (
            <Play className="ms-1 h-7 w-7" fill="currentColor" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          aria-label={p.next}
          onClick={() => step(1)}
          className="grid h-12 w-12 place-items-center rounded-full text-[var(--foreground)] transition-colors hover:bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)]"
        >
          <NextIcon className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>

      <p role="status" className={cn('mt-4 text-center text-[11px]', error ? 'font-semibold text-[var(--accent)]' : 'text-[var(--muted-foreground)]')}>
        {error ? t.deck.error : p.hint}
      </p>
    </div>
  );
}
