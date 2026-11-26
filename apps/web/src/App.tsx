import { useEffect } from 'react';
import { Backdrop } from './components/backdrop';
import { Home } from './pages/home';

/**
 * Single-screen site: every path renders the music player (nginx already serves index.html for any
 * route), so no router is bundled — that keeps ~20 kB gzip off the first load on slow mobile links.
 * Views are state + `#hash` (`#station=<id>`). An unknown path is normalised
 * to `/` in the address bar, keeping `?lang=` and the hash.
 */
export function App() {
  useEffect(() => {
    if (window.location.pathname !== '/') {
      window.history.replaceState(null, '', `/${window.location.search}${window.location.hash}`);
    }
  }, []);

  return (
    <>
      <Backdrop />
      <Home />
    </>
  );
}
