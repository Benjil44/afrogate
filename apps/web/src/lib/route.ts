import { useCallback, useEffect, useState } from 'react';

/**
 * Hash routes for the main panel (no router library: ~20 kB gzip saved).
 *   #/            home          #/browse      all stations      #/library   liked + recent
 *   #/search?q=   search        #/station/<id> one station       #/all       all tracks
 *   #/latest      latest mixes
 * Legacy `#station=<id>` maps to the station route; anything else (old landing anchors such as
 * `#vpn` / `#pricing`) lands on home.
 */
export type Route =
  | { name: 'home' }
  | { name: 'browse' }
  | { name: 'library' }
  | { name: 'all' }
  | { name: 'latest' }
  | { name: 'search'; q: string }
  | { name: 'station'; id: string };

const STATION_ID = /^[a-z0-9_-]{1,40}$/;
const MAX_QUERY = 80;

export function parseHash(hash: string): Route {
  const legacy = /^#station=([a-z0-9_-]{1,40})$/.exec(hash);
  if (legacy) return { name: 'station', id: legacy[1] };
  if (!hash.startsWith('#/')) return { name: 'home' };
  const [path, query = ''] = hash.slice(2).split('?');
  const parts = path.split('/').filter(Boolean);
  switch (parts[0]) {
    case 'browse':
      return { name: 'browse' };
    case 'library':
      return { name: 'library' };
    case 'all':
      return { name: 'all' };
    case 'latest':
      return { name: 'latest' };
    case 'search': {
      let q = '';
      try {
        q = new URLSearchParams(query).get('q') ?? '';
      } catch {
        q = '';
      }
      return { name: 'search', q: q.slice(0, MAX_QUERY) };
    }
    case 'station':
      return parts[1] && STATION_ID.test(parts[1]) ? { name: 'station', id: parts[1] } : { name: 'browse' };
    default:
      return { name: 'home' };
  }
}

export function routeHref(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'search':
      return route.q ? `#/search?${new URLSearchParams({ q: route.q }).toString()}` : '#/search';
    case 'station':
      return `#/station/${route.id}`;
    default:
      return `#/${route.name}`;
  }
}

/** Current route + `navigate` (push by default; `replace` for search-as-you-type). */
export function useHashRoute(): [Route, (route: Route, options?: { replace?: boolean }) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const sync = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  const navigate = useCallback((next: Route, options?: { replace?: boolean }) => {
    const href = routeHref(next);
    if (window.location.hash !== href) {
      if (options?.replace) window.history.replaceState(window.history.state, '', href);
      else window.history.pushState(null, '', href);
    }
    setRoute(next);
  }, []);

  return [route, navigate];
}

/** Two routes point at the same view (for `aria-current`). */
export function sameSection(a: Route, b: Route['name']): boolean {
  if (b === 'browse') return a.name === 'browse' || a.name === 'station';
  if (b === 'home') return a.name === 'home' || a.name === 'all' || a.name === 'latest';
  return a.name === b;
}
