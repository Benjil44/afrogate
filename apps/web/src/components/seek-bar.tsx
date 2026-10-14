import { formatTime, useLang } from '@/i18n';
import { usePlayerProgress, usePlayer } from '@/lib/player';
import { cn } from '@/lib/utils';

/**
 * Accessible seek slider (native range input: arrow keys step, Home/End jump) with the
 * elapsed / total clock in the current language's digits. Only this component re-renders on
 * `timeupdate` thanks to the separate progress context.
 */
export function SeekBar({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { t, lang } = useLang();
  const { seek, track, durations } = usePlayer();
  const { currentTime, duration } = usePlayerProgress();
  const total = duration || durations[track.id] || 0;
  const pct = total > 0 ? Math.min(100, (currentTime / total) * 100) : 0;

  return (
    <div className={cn('w-full', className)}>
      <div className="seek relative h-6 w-full">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-[var(--muted)]">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--primary),var(--secondary))]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <input
          type="range"
          className="seek-input absolute inset-0 h-full w-full cursor-pointer"
          min={0}
          max={total > 0 ? Math.floor(total) : 0}
          step={1}
          value={Math.floor(currentTime)}
          disabled={total <= 0}
          aria-label={t.deck.seek}
          aria-valuetext={`${formatTime(currentTime, lang)} / ${formatTime(total, lang)}`}
          onChange={(e) => seek(Number(e.currentTarget.value))}
        />
      </div>
      <div className={cn('flex justify-between font-semibold tabular-nums text-[var(--muted-foreground)]', compact ? 'mt-0 text-[10px]' : 'mt-1 text-[11px]')}>
        <span>{formatTime(currentTime, lang)}</span>
        <span>{total > 0 ? formatTime(total, lang) : '—'}</span>
      </div>
    </div>
  );
}
