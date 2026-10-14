import { useEffect, type DependencyList, type RefObject } from 'react';
import { useLang } from '@/i18n';
import type { Engine } from './engine';
import { useMotion } from './provider';
import { SCRUB } from './tokens';

type ActiveTier = 'full' | 'lite';

export interface FxApi extends Engine {
  tier: ActiveTier;
  dir: 'rtl' | 'ltr';
  /** +1 LTR, -1 RTL — every horizontal tween value goes through this (§0.5). */
  sign: 1 | -1;
  /** Tier-appropriate `scrub` value for scroll-driven timelines. */
  scrub: number | boolean;
  /** The gsap.context for async work (e.g. after `document.fonts.ready`): `ctx.add(() => …)`. */
  ctx: gsap.Context;
}

/**
 * `gsap.context`-scoped effect that waits for the engine chunk. Never runs on `static`.
 * The returned cleanup (if any) runs before the context is reverted.
 */
export function useFx(
  scope: RefObject<HTMLElement | null>,
  build: (fx: FxApi) => void | (() => void),
  deps: DependencyList = [],
): void {
  const { engine, tier } = useMotion();
  const { dir } = useLang();

  useEffect(() => {
    const el = scope.current;
    if (!engine || tier === 'static' || !el) return;
    let cleanup: void | (() => void);
    const ctx = engine.gsap.context((self) => {
      cleanup = build({
        ...engine,
        tier,
        dir,
        sign: dir === 'rtl' ? -1 : 1,
        scrub: SCRUB[tier],
        ctx: self,
      });
    }, el);
    return () => {
      cleanup?.();
      ctx.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, tier, dir, ...deps]);
}
