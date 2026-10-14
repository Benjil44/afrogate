import { cn } from '@/lib/utils';

/**
 * Pure-CSS equalizer. `active` runs the bars on the shared `--beat`; while the real analyser is
 * running (`html.is-live`) each bar follows its band level `--lv{n}` instead (see styles.css).
 * Honors prefers-reduced-motion through the global stylesheet.
 */
export function Equalizer({
  active,
  bars = 5,
  className,
}: {
  active: boolean;
  bars?: number;
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={cn('eq inline-flex items-end gap-[3px]', active && 'eq-active', className)}>
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} className={`eq-bar eq-b${(i * 3 + 1) % 8}`} style={{ animationDelay: `${(i * 0.13) % 0.7}s` }} />
      ))}
    </span>
  );
}
