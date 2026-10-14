import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * CSS-only height collapse (grid-template-rows 0fr -> 1fr) replacing framer-motion
 * `AnimatePresence` for the promo bar, the mobile menu and FAQ answers. The content stays
 * mounted; when closed it is `inert` and hidden from assistive tech. Reduced motion is handled
 * by the global `prefers-reduced-motion` rule in styles.css.
 */
export function Collapse({
  open,
  className,
  innerClassName,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { open: boolean; innerClassName?: string; children: ReactNode }) {
  return (
    <div {...rest} inert={!open} aria-hidden={!open} className={cn('fold', open && 'is-open', className)}>
      <div className={cn('fold-inner', innerClassName)}>{children}</div>
    </div>
  );
}
