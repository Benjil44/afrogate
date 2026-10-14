import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLang } from '@/i18n';
import type { Engine, Lenis } from './engine';
import { registerReveals } from './reveal';
import { DESKTOP_QUERY, REDUCE_QUERY, detectMotionTier, type MotionTier } from './tier';

/**
 * Single owner of: tier detection + `<html>` classes, lazy engine loading (gsap + ScrollTrigger +
 * SplitText + Lenis), Lenis lifecycle, in-page anchors, and `ScrollTrigger.refresh()` after
 * language / header-height changes. Sections never import gsap; they use `useFx` / `useMotion`.
 */
interface MotionContextValue {
  tier: MotionTier;
  /** Null until the "fx" chunk has loaded (always null on `static`). */
  engine: Engine | null;
  /** Re-measure ScrollTrigger positions (after layout changes such as PromoBar dismiss). */
  refresh: () => void;
  /** Scroll to an element or a page offset through Lenis on `full`, natively otherwise. */
  scrollTo: (target: Element | number) => void;
}

const MotionContext = createContext<MotionContextValue | null>(null);

const TIER_CLASSES: Record<MotionTier, string> = { full: 'motion-full', lite: 'motion-lite', static: 'motion-static' };
const expoOut = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Anchor offset comes from CSS only (`html { scroll-padding-top }`): native anchors and Lenis
 * (which reads scroll-padding/scroll-margin itself) then land in the same place.
 */
function scrollPadding(): number {
  const padding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
  return Number.isFinite(padding) ? padding : 120;
}

function scheduleIdle(cb: () => void): () => void {
  let idle = 0;
  let timer = 0;
  const run = () => {
    if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(cb, { timeout: 2000 });
    else timer = window.setTimeout(cb, 300);
  };
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
  return () => {
    window.removeEventListener('load', run);
    if (idle) window.cancelIdleCallback(idle);
    if (timer) window.clearTimeout(timer);
  };
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const { lang } = useLang();
  const [tier, setTier] = useState<MotionTier>(detectMotionTier);
  const [engine, setEngine] = useState<Engine | null>(null);
  const lenisRef = useRef<Lenis | null>(null);

  // <html class="motion-*"> for pure-CSS fallbacks; `has-prop` gates the registered-property beat loops.
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

  // Load the engine after first paint (idle after `load`, capped at 2 s) — never on `static`.
  useEffect(() => {
    if (tier === 'static' || engine) return;
    let cancelled = false;
    const cancel = scheduleIdle(() => {
      import('./engine').then((m) => {
        if (!cancelled) setEngine(m.engine);
      });
    });
    return () => {
      cancelled = true;
      cancel();
    };
  }, [tier, engine]);

  // Engine lifecycle per tier: reveals, Lenis (full only), anchor clicks, font refresh.
  useEffect(() => {
    if (!engine || tier === 'static') return;
    const { ScrollTrigger } = engine;
    const unregister = registerReveals(engine);

    if (tier === 'full') lenisRef.current = engine.createLenis();

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!anchor) return;
      const id = anchor.getAttribute('href')!.slice(1);
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      const lenis = lenisRef.current;
      if (!lenis) return; // lite: native anchors with scroll-padding-top
      e.preventDefault();
      lenis.scrollTo(target, { duration: 1.1, easing: expoOut });
      history.pushState(null, '', `#${id}`);
    };
    document.addEventListener('click', onClick);

    let fontsLive = true;
    document.fonts.ready.then(() => fontsLive && ScrollTrigger.refresh());
    ScrollTrigger.refresh();

    return () => {
      fontsLive = false;
      document.removeEventListener('click', onClick);
      unregister();
      lenisRef.current?.destroy();
      lenisRef.current = null;
    };
  }, [engine, tier]);

  // Language / direction change mirrors the layout: re-register new reveals and re-measure next frame.
  useEffect(() => {
    if (!engine || tier === 'static') return;
    let unregister = () => {};
    const frame = requestAnimationFrame(() => {
      unregister = registerReveals(engine);
      engine.ScrollTrigger.refresh();
    });
    return () => {
      cancelAnimationFrame(frame);
      unregister();
    };
  }, [lang, engine, tier]);

  const refresh = useCallback(() => {
    engine?.ScrollTrigger.refresh();
  }, [engine]);

  const scrollTo = useCallback((target: Element | number) => {
    const lenis = lenisRef.current;
    if (lenis) {
      lenis.scrollTo(target as HTMLElement | number, { duration: 1.1, easing: expoOut });
      return;
    }
    const top = typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY - scrollPadding();
    window.scrollTo({ top, behavior: 'smooth' });
  }, []);

  const value = useMemo<MotionContextValue>(() => ({ tier, engine, refresh, scrollTo }), [tier, engine, refresh, scrollTo]);
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
