import { useSyncExternalStore } from 'react';

/**
 * One shared passive scroll listener for every "is the page scrolled past X" flag
 * (Nav, MiniPlayer). Works before the engine loads and on the `static` tier.
 */
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => cb());
}

function subscribe(cb: () => void) {
  if (listeners.size === 0) {
    window.addEventListener('scroll', notify, { passive: true });
    window.addEventListener('resize', notify, { passive: true });
  }
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      window.removeEventListener('scroll', notify);
      window.removeEventListener('resize', notify);
    }
  };
}

/** `threshold` in px, or a function (e.g. `() => innerHeight * 0.9`) re-evaluated on every scroll/resize. */
export function useScrollFlag(threshold: number | (() => number)): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.scrollY > (typeof threshold === 'function' ? threshold() : threshold),
    () => false,
  );
}
