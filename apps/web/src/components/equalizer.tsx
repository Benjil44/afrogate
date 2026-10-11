import { cn } from '@/lib/utils';

/**
 * Pure-CSS animated equalizer. `active` runs the bars; otherwise they rest low.
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
        <span key={i} className="eq-bar" style={{ animationDelay: `${(i * 0.13) % 0.7}s` }} />
      ))}
    </span>
  );
}
