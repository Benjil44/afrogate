import { Heart, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Equalizer } from '@/components/equalizer';
import { useLang } from '@/i18n';
import { CHANNEL_ART, usePlayer } from '@/lib/player';

/**
 * Visual "now playing" card. Play/pause only animates the vinyl, progress and equalizer —
 * there is no audio and nothing is fetched.
 */
export function PlayerCard({ className }: { className?: string }) {
  const { t, dir } = useLang();
  const { channel, playing, toggle, step } = usePlayer();
  const p = t.hero.player;
  const ch = t.radio.channels[channel];
  // In RTL the "previous" arrow points right, so swap the icons rather than the semantics.
  const PrevIcon = dir === 'rtl' ? SkipForward : SkipBack;
  const NextIcon = dir === 'rtl' ? SkipBack : SkipForward;

  return (
    <div
      className={cn(
        'relative w-full max-w-md rounded-3xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--card)_80%,transparent)] p-5 shadow-2xl shadow-[color-mix(in_oklch,var(--primary)_25%,transparent)] backdrop-blur-xl sm:p-6',
        playing && 'is-playing',
        className,
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between text-xs font-bold">
        <span className="inline-flex items-center gap-2 text-[var(--muted-foreground)]">
          <Equalizer active={playing} bars={4} className="h-3.5 text-[var(--primary)]" />
          {p.title}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklch,var(--destructive)_18%,transparent)] px-2.5 py-1 text-[var(--foreground)]">
          <span className={cn('h-1.5 w-1.5 rounded-full bg-[var(--destructive)]', playing && 'animate-blink')} />
          {p.liveBadge} · {ch.name}
        </span>
      </div>

      {/* Vinyl art */}
      <div className="mt-5 grid place-items-center">
        <div className="relative h-44 w-44 sm:h-52 sm:w-52">
          <div
            className="animate-spin-slow absolute inset-0 rounded-full shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]"
            style={{ background: CHANNEL_ART[channel] }}
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
          <p className="truncate text-lg font-bold">{p.track}</p>
          <p className="truncate text-sm text-[var(--muted-foreground)]">
            {p.artist} · {ch.name}
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

      {/* Progress */}
      <div className="mt-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--muted)]">
          <div className="progress-fill h-full w-full rounded-full bg-[linear-gradient(90deg,var(--primary),var(--secondary))]" />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] font-semibold text-[var(--muted-foreground)]">
          <span>{p.elapsed}</span>
          <span>{p.total}</span>
        </div>
      </div>

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
          onClick={toggle}
          className="grid h-16 w-16 place-items-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--secondary))] text-white shadow-lg shadow-[color-mix(in_oklch,var(--primary)_45%,transparent)] transition-transform hover:scale-105 active:scale-95"
        >
          {playing ? <Pause className="h-7 w-7" fill="currentColor" aria-hidden="true" /> : <Play className="ms-1 h-7 w-7" fill="currentColor" aria-hidden="true" />}
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

      <p className="mt-4 text-center text-[11px] text-[var(--muted-foreground)]">{p.offlineHint}</p>
    </div>
  );
}
