import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DESKTOP_QUERY, REDUCE_QUERY, detectMotionTier, type MotionTier } from './tier';

/**
 * Single owner of the motion tier (`full` / `lite` / `static`) and the `<html class="motion-*">`
 * classes every CSS animation keys off. The one-screen player has no scroll story, so the old
 * gsap / ScrollTrigger / Lenis engine is not loaded at all (no "fx" chunk, nothing to smooth-scroll);
 * motion is CSS only, gated by the tier, and the player uses the tier to gate the analyser.
 */
interface MotionContextValue {
  tier: MotionTier;
}

const MotionContext = createContext<MotionContextValue | null>(null);

const TIER_CLASSES: Record<MotionTier, string> = { full: 'motion-full', lite: 'motion-lite', static: 'motion-static' };

export function MotionProvider({ children }: { children: ReactNode }) {
  const [tier, setTier] = useState<MotionTier>(detectMotionTier);

  // <html class="motion-*"> for the CSS tiers; `has-prop` gates the registered-property beat loops.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove(...Object.values(TIER_CLASSES));
    root.classList.add(TIER_CLASSES[tier]);
    root.classList.toggle('has-prop', typeof CSS !== 'undefined' && 'registerProperty' in CSS);
  }, [tier]);

  // Live signals: reduced-motion or the desktop breakpoint flipping at runtime re-evaluates the tier.
  useEffect(() => {
    const queries = [window.matchMedia(REDUCE_QUERY), window.matchMedia(DESKTOP_QUERY)];
    const onChange = () => setTier(detectMotionTier());
    queries.forEach((q) => q.addEventListener('change', onChange));
    return () => queries.forEach((q) => q.removeEventListener('change', onChange));
  }, []);

  const value = useMemo<MotionContextValue>(() => ({ tier }), [tier]);
  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export function useMotion(): MotionContextValue {
  const ctx = useContext(MotionContext);
  if (!ctx) throw new Error('useMotion must be used within MotionProvider');
  return ctx;
}

export function useMotionTier(): MotionTier {
  return useMotion().tier;
}
