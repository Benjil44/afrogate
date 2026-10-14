import { useEffect, useRef } from 'react';

const CSS_SCROLL_TIMELINE = typeof CSS !== 'undefined' && CSS.supports('animation-timeline: scroll()');

/**
 * Reading-progress bar. A CSS scroll-driven animation where supported (zero JS, zero main-thread
 * work); otherwise one passive scroll listener writes `scaleX` directly. It shows on every tier
 * — progress is information, not decoration. Fills from the inline-start edge (right in RTL).
 */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = ref.current;
    if (CSS_SCROLL_TIMELINE || !bar) return;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="scroll-progress fixed inset-x-0 top-0 z-[60] h-[3px] bg-[linear-gradient(90deg,var(--primary),var(--secondary))]"
    />
  );
}
