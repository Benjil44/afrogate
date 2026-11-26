import { useEffect } from 'react';
import { useMotionTier } from '@/motion/provider';

/**
 * The "living backdrop": a fixed layer behind the whole shell, composed of two large radial washes
 * derived from the current track's colour (`--station`, set on <html> by the player). It slowly
 * drifts, breathes faintly with the music on the full tier, and leans with the pointer (parallax).
 *
 * Spatial-depth design: the glass panels (styles.css `html.motion-full .panel`) sit in front and
 * sample this layer through `backdrop-filter`, so the room re-tints as one calm sweep on every track
 * change (the `--station` colour animates for free). Purely decorative — always `aria-hidden`.
 *
 * Parallax is pointer-driven and written straight to CSS custom properties on <html> (never React
 * state, so it stays off the render path), rAF-throttled, and attached ONLY on the full tier. Lite
 * keeps the drift but no parallax; static freezes to a single still gradient (styles.css).
 */
export function Backdrop() {
  const tier = useMotionTier();

  useEffect(() => {
    if (tier !== 'full') return;
    const root = document.documentElement;
    let px = 0;
    let py = 0;
    let raf = 0;
    const apply = () => {
      raf = 0;
      root.style.setProperty('--px', px.toFixed(3));
      root.style.setProperty('--py', py.toFixed(3));
    };
    const onMove = (e: PointerEvent) => {
      px = (e.clientX / window.innerWidth) * 2 - 1;
      py = (e.clientY / window.innerHeight) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const recenter = () => {
      px = 0;
      py = 0;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', recenter);
    window.addEventListener('blur', recenter);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', recenter);
      window.removeEventListener('blur', recenter);
      if (raf) cancelAnimationFrame(raf);
      root.style.setProperty('--px', '0');
      root.style.setProperty('--py', '0');
    };
  }, [tier]);

  return (
    <div className="backdrop" aria-hidden="true">
      <span className="backdrop-blob backdrop-blob-a" />
      <span className="backdrop-blob backdrop-blob-b" />
      <span className="backdrop-grain" />
    </div>
  );
}
