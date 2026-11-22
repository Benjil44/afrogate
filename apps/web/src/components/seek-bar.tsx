import { fill, formatTime, useLang } from '@/i18n';
import { trackDuration, usePlayer, usePlayerProgress } from '@/lib/player';
import { cn } from '@/lib/utils';

/**
 * Accessible seek slider (native range = `role="slider"`: arrow keys step, Home/End jump) with the
 * elapsed / total clock in the current language's digits. The whole timeline is an LTR island in
 * both languages (media time runs left-to-right, like OS players). Only this component re-renders
 * on `timeupdate` thanks to the separate progress context.
 */
export function SeekBar({ className, tall = false }: { className?: string; tall?: boolean }) {
  const { t, lang } = useLang();
  const { seek, track, durations } = usePlayer();
  const { currentTime, duration } = usePlayerProgress();
  const total = duration || trackDuration(track, durations);
  const pct = total > 0 ? Math.min(100, (currentTime / total) * 100) : 0;
  const now = formatTime(currentTime, lang);
  const end = total > 0 ? formatTime(total, lang) : '—';

  return (
    <div dir="ltr" className={cn('flex w-full items-center gap-3', className)}>
      <span className="w-14 shrink-0 text-end text-xs font-semibold tabular-nums text-[var(--muted-foreground)]">{now}</span>
      <div className={cn('seek relative w-full', tall ? 'h-11' : 'h-6')}>
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-[var(--muted)]">
          <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--station,var(--primary)),var(--secondary))]" style={{ width: `${pct}%` }} />
        </div>
        <input
          type="range"
          className="seek-input absolute inset-0 h-full w-full cursor-pointer"
          min={0}
          max={total > 0 ? Math.floor(total) : 0}
          step={1}
          value={Math.min(Math.floor(currentTime), total > 0 ? Math.floor(total) : 0)}
          disabled={total <= 0}
          aria-label={t.player.seek}
          aria-valuetext={fill(t.player.timeOf, { a: now, b: end })}
          onChange={(e) => seek(Number(e.currentTarget.value))}
        />
      </div>
      <span className="w-14 shrink-0 text-xs font-semibold tabular-nums text-[var(--muted-foreground)]">{end}</span>
    </div>
  );
}

/** Thin, non-interactive progress line (phone mini bar). */
export function ProgressHairline() {
  const { track, durations } = usePlayer();
  const { currentTime, duration } = usePlayerProgress();
  const total = duration || trackDuration(track, durations);
  const pct = total > 0 ? Math.min(100, (currentTime / total) * 100) : 0;
  return (
    <div dir="ltr" aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--muted)]">
      <div className="h-full bg-[var(--station,var(--primary))]" style={{ width: `${pct}%` }} />
    </div>
  );
}
