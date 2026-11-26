import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { fill, formatTime, useLang } from '@/i18n';
import { trackDuration, usePlayer, usePlayerProgress } from '@/lib/player';
import { useMotionTier } from '@/motion/provider';
import { cn } from '@/lib/utils';

/**
 * Accessible seek slider for long DJ mixes (native range = `role="slider"`: arrow keys step,
 * Home/End jump) with the elapsed / total clock in the current language's digits. The whole timeline
 * is an LTR island in both languages (media time runs left-to-right, like OS players), so the pointer
 * maths never flips. Only this component re-renders on `timeupdate` thanks to the separate progress
 * context.
 *
 * The fill is a `transform: scaleX` (compositor-only) interpolated every frame between the ~4Hz
 * `timeupdate` ticks, so it glides rather than stepping. On fine pointers the track grows and the
 * thumb appears on hover; a tooltip follows the pointer (and the drag) along the bar; the buffered
 * range shows behind the fill. A drag shows a preview time and commits the seek only on release.
 */
export function SeekBar({ className, tall = false }: { className?: string; tall?: boolean }) {
  const { t, lang } = useLang();
  const { seek, track, durations, ad, playing } = usePlayer();
  const { currentTime, duration, buffered } = usePlayerProgress();
  const tier = useMotionTier();
  const total = duration || trackDuration(track, durations);
  const max = total > 0 ? Math.floor(total) : 0;
  const disabled = total <= 0 || ad;

  /** Preview time while scrubbing (null = not scrubbing). */
  const [drag, setDrag] = useState<number | null>(null);
  /** Pointer position over the bar (null = not hovering), for the time tooltip. */
  const [hover, setHover] = useState<{ ratio: number; time: number } | null>(null);

  const fillRef = useRef<HTMLDivElement>(null);
  const bufRef = useRef<HTMLDivElement>(null);
  /** True while a pointer is held on the slider: preview only, commit the seek on release. */
  const draggingRef = useRef(false);

  // The rAF loop reads the latest values through a ref, so it subscribes once (not per timeupdate).
  const liveRef = useRef({ total, currentTime, playing, drag });
  liveRef.current = { total, currentTime, playing, drag };
  const baseRef = useRef({ time: currentTime, at: 0 });
  useEffect(() => {
    baseRef.current = { time: currentTime, at: performance.now() };
  }, [currentTime]);

  const setFill = (k: number) => {
    if (fillRef.current) fillRef.current.style.transform = `scaleX(${Math.min(1, Math.max(0, k))})`;
  };

  // Smooth fill: interpolate between ticks while playing. Static tier: set directly, no rAF.
  useEffect(() => {
    if (tier === 'static') {
      const { total: tt, currentTime: ct, drag: dd } = liveRef.current;
      setFill(tt > 0 ? (dd ?? ct) / tt : 0);
      return;
    }
    let raf = 0;
    const tick = () => {
      const { total: tt, currentTime: ct, playing: pl, drag: dd } = liveRef.current;
      const est = dd != null ? dd : pl ? Math.min(tt, baseRef.current.time + (performance.now() - baseRef.current.at) / 1000) : ct;
      setFill(tt > 0 ? est / tt : 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [tier, currentTime, total, drag, playing]);

  // Buffered range (changes slowly): set once per change.
  useEffect(() => {
    if (bufRef.current) bufRef.current.style.transform = `scaleX(${total > 0 ? Math.min(1, (buffered ?? 0) / total) : 0})`;
  }, [buffered, total]);

  const now = formatTime(drag ?? currentTime, lang);
  const end = total > 0 ? formatTime(total, lang) : '—';
  const tip = drag != null ? { ratio: total > 0 ? Math.min(1, drag / total) : 0, time: drag } : hover;

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' || disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHover({ ratio, time: ratio * total });
  };

  return (
    <div dir="ltr" className={cn('flex w-full items-center gap-3', className)}>
      <span className="w-14 shrink-0 text-end text-xs font-semibold tabular-nums text-[var(--muted-foreground)]">{now}</span>
      <div
        className={cn('seek relative w-full', tall ? 'h-11' : 'h-6', drag != null && 'is-dragging')}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHover(null)}
      >
        <div className="seek-rail pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-[var(--muted)]">
          <div ref={bufRef} className="seek-buffered absolute inset-0 origin-left rounded-full bg-[color-mix(in_oklch,var(--foreground)_16%,transparent)]" />
          <div ref={fillRef} className="seek-fill absolute inset-0 origin-left rounded-full bg-[linear-gradient(90deg,var(--station,var(--primary)),var(--secondary))]" />
        </div>
        <input
          type="range"
          className="seek-input absolute inset-0 h-full w-full cursor-pointer"
          min={0}
          max={max}
          step={1}
          value={Math.min(Math.floor(drag ?? currentTime), max)}
          disabled={disabled}
          aria-label={t.player.seek}
          aria-valuetext={fill(t.player.timeOf, { a: now, b: end })}
          onPointerDown={() => {
            draggingRef.current = true;
          }}
          onChange={(e) => {
            // React's onChange fires on every movement: while a pointer is held, only preview; a
            // keyboard change (no pointer) commits at once. The pointer drag commits on release.
            const v = Number(e.currentTarget.value);
            if (draggingRef.current) setDrag(v);
            else {
              seek(v);
              setDrag(null);
            }
          }}
          onPointerUp={(e) => {
            if (!draggingRef.current) return;
            draggingRef.current = false;
            seek(Number(e.currentTarget.value));
            setDrag(null);
          }}
          onPointerCancel={() => {
            draggingRef.current = false;
            setDrag(null);
          }}
          onBlur={() => {
            draggingRef.current = false;
            setDrag(null);
          }}
        />
        {tip && !disabled && (
          <span aria-hidden="true" className="seek-tip tabular-nums" style={{ insetInlineStart: `${tip.ratio * 100}%` }}>
            {formatTime(tip.time, lang)}
          </span>
        )}
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
  const k = total > 0 ? Math.min(1, currentTime / total) : 0;
  return (
    <div dir="ltr" aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--muted)]">
      <div className="h-full origin-left bg-[var(--station,var(--primary))]" style={{ transform: `scaleX(${k})` }} />
    </div>
  );
}
