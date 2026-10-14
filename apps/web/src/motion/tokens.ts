/**
 * Shared motion constants (docs/landing-wave-station-motion.md §2).
 * `expo.out` matches the `cubic-bezier(0.16,1,0.3,1)` used by the CSS transitions.
 */
export const EASE = { out: 'expo.out', soft: 'power3.out', inOut: 'power2.inOut', back: 'back.out(1.4)' } as const;
export const DUR = { reveal: 0.7, words: 0.6, sweep: 1.2, snap: 0.45 } as const;
export const STAGGER = { card: 0.08, words: 0.045, tile: 0.06 } as const;
/** lite = no lag (cheaper), full = smoothed scrub. */
export const SCRUB = { full: 0.8, lite: true } as const;
