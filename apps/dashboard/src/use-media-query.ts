import { useEffect, useState } from 'react';

/**
 * Tracks a CSS media query (same matchMedia pattern DashboardApp uses for its
 * sidebar breakpoints). Starts `false` when matchMedia is unavailable (SSR,
 * old WebViews) so the desktop layout is the safe default.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' && Boolean(window.matchMedia) ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const apply = () => setMatches(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [query]);

  return matches;
}

/** Below Tailwind's `md` breakpoint (phones): wide interactive table cells
 * become unreachable behind the pinned actions column, so pages move such
 * controls into the row's expandable detail panel instead. */
export function usePhoneViewport(): boolean {
  return useMediaQuery('(max-width: 767px)');
}
