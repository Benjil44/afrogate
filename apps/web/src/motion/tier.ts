/**
 * Capability tiers (docs/landing-wave-station-motion.md §1.2). No gsap import here:
 * this file is part of the initial bundle and decides whether the engine chunk loads at all.
 */
export type MotionTier = 'full' | 'lite' | 'static';

interface NetworkInformationLike {
  saveData?: boolean;
}

export const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';
export const DESKTOP_QUERY = '(min-width: 1024px) and (pointer: fine)';

/** Hard signals (reduced motion, Save-Data, low memory) win; then pointer/width/CPU pick lite vs full. */
export function detectMotionTier(): MotionTier {
  if (typeof window === 'undefined') return 'static';
  const nav = navigator as Navigator & { connection?: NetworkInformationLike; deviceMemory?: number };
  if (window.matchMedia(REDUCE_QUERY).matches) return 'static';
  if (nav.connection?.saveData === true) return 'static';
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2) return 'static';
  if (!window.matchMedia(DESKTOP_QUERY).matches) return 'lite';
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4) return 'lite';
  return 'full';
}

/** True when the element starts below the viewport — only those get a "before reveal" hidden state. */
export function isBelowFold(el: Element): boolean {
  return el.getBoundingClientRect().top > window.innerHeight;
}
