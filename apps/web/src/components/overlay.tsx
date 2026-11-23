import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useMotionTier } from '@/motion/provider';
import { cn } from '@/lib/utils';

/**
 * Modal surface rendered at `<body>` level (a transformed ancestor would break `position: fixed`).
 * Variants: `side` = full-height panel from the inline-end edge (now playing, 768–1279px),
 * `bottom` = full-screen sheet from below (phone player), `dialog` = centred card (shortcuts).
 *
 * Two-state mount: `mounted` keeps the node for the exit transition, `shown` drives the CSS
 * (`.is-shown`), set on the frame after mount so the enter transition runs. `static` tier and
 * reduced motion skip the transition (styles.css). While open: the app root is `inert` (ref-counted
 * across stacked overlays), Tab is trapped inside, Esc closes, and focus returns to the opener.
 * The page itself never scrolls, so no body scroll lock is needed.
 */
type Variant = 'side' | 'bottom' | 'dialog';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let openCount = 0;

function setRootInert(delta: 1 | -1) {
  openCount = Math.max(0, openCount + delta);
  const root = document.getElementById('root');
  if (root) root.inert = openCount > 0;
  document.documentElement.toggleAttribute('data-overlay-open', openCount > 0);
}

/** True while any overlay is open (global shortcuts stand down). */
export function isOverlayOpen(): boolean {
  return openCount > 0;
}

function focusables(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

export function Overlay({
  open,
  onClose,
  variant,
  labelledBy,
  label,
  initialFocus,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  variant: Variant;
  labelledBy?: string;
  label?: string;
  /** Element to focus on open (defaults to the first focusable in the panel). */
  initialFocus?: RefObject<HTMLElement | null>;
  className?: string;
  children: ReactNode;
}) {
  const tier = useMotionTier();
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Mount -> next frame show; hide -> unmount after the exit transition.
  useEffect(() => {
    if (open) {
      setMounted(true);
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setShown(false);
    const timer = window.setTimeout(() => setMounted(false), tier === 'static' ? 0 : 340);
    return () => window.clearTimeout(timer);
  }, [open, tier]);

  // Open side effects: inert background, initial focus, focus restore on close.
  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setRootInert(1);
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target = initialFocus?.current ?? focusables(panel)[0] ?? panel;
      target.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      setRootInert(-1);
      const opener = openerRef.current;
      // Restore after `inert` is lifted (same task), only if the opener is still on the page.
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!mounted) return null;

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      onCloseRef.current();
      return;
    }
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const items = focusables(panel);
    if (items.length === 0) {
      e.preventDefault();
      panel.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className={cn('overlay', `overlay-${variant}`, shown && open && 'is-shown')}>
      <div className="overlay-backdrop" aria-hidden="true" onClick={() => onCloseRef.current()} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn('overlay-panel', className)}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
