import { useEffect } from 'react';
import { Home } from './pages/home';

/**
 * Single-page site: every path renders the landing page (nginx already serves index.html for any
 * route), so no router is bundled — that keeps ~20 kB gzip off the first load on slow mobile links.
 * An unknown path is normalised to `/` in the address bar, keeping `?lang=` and the `#anchor`.
 */
export function App() {
  useEffect(() => {
    if (window.location.pathname !== '/') {
      window.history.replaceState(null, '', `/${window.location.search}${window.location.hash}`);
    }
  }, []);

  return <Home />;
}
