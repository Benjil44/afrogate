import { useEffect, useState } from 'react';
import { Keyboard, Search, X } from 'lucide-react';
import { Equalizer } from '@/components/equalizer';
import { LangToggle } from '@/components/lang-toggle';
import { IconButton } from '@/components/transport';
import { useLang } from '@/i18n';
import { usePlayer } from '@/lib/player';
import { routeHref, type Route } from '@/lib/route';

/** Id of the search input (the `/` shortcut focuses it). */
export const SEARCH_INPUT_ID = 'site-search';

/**
 * Top bar of the main panel: big rounded search field (filters the manifest client-side; typing
 * opens / updates `#/search?q=` without stacking history entries), shortcuts help (pointer
 * devices) and the language toggle.
 */
export function TopBar({
  route,
  navigate,
  onOpenShortcuts,
}: {
  route: Route;
  navigate: (route: Route, options?: { replace?: boolean }) => void;
  onOpenShortcuts: () => void;
}) {
  const { t } = useLang();
  const { playing } = usePlayer();
  const routeQuery = route.name === 'search' ? route.q : '';
  const [value, setValue] = useState(routeQuery);

  // Back / forward / links change the query: follow it.
  useEffect(() => setValue(routeQuery), [routeQuery]);

  const update = (q: string) => {
    setValue(q);
    navigate({ name: 'search', q }, { replace: route.name === 'search' });
  };

  return (
    <div className="flex h-16 shrink-0 items-center gap-2 px-3 sm:px-4">
      {/* Phones have no sidebar: the logo (home link) sits here. */}
      <a href={routeHref({ name: 'home' })} aria-label={`${t.brandRadio} · ${t.app.home}`} className="grid h-11 w-11 shrink-0 place-items-center md:hidden">
        <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(135deg,var(--primary),var(--secondary))] text-white">
          <Equalizer active={playing} bars={4} className="h-4 text-white" />
        </span>
      </a>
      <form role="search" className="relative min-w-0 max-w-xl flex-1" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor={SEARCH_INPUT_ID} className="sr-only">
          {t.app.searchLabel}
        </label>
        <Search aria-hidden="true" className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <input
          id={SEARCH_INPUT_ID}
          type="search"
          dir="auto"
          autoComplete="off"
          enterKeyHint="search"
          maxLength={80}
          value={value}
          placeholder={t.app.searchPlaceholder}
          onChange={(e) => update(e.currentTarget.value)}
          aria-describedby={`${SEARCH_INPUT_ID}-hint`}
          aria-controls={route.name === 'search' && value ? 'search-results' : undefined}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && value) {
              e.stopPropagation();
              update('');
            } else if ((e.key === 'ArrowDown' || e.key === 'Enter') && !e.nativeEvent.isComposing) {
              // Results render in the main panel (pages/views.tsx SearchView): Down moves into them,
              // Enter plays the first track (or opens the first station).
              const first = document.querySelector<HTMLElement>('#search-results [data-result]');
              if (!first) return;
              e.preventDefault();
              if (e.key === 'ArrowDown') first.focus();
              else first.click();
            }
          }}
          className="search-input h-12 w-full rounded-full border border-transparent bg-[color-mix(in_oklch,var(--foreground)_9%,transparent)] ps-12 pe-12 text-sm font-semibold text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] hover:border-[var(--border)] focus:border-[var(--foreground)] focus:outline-none"
        />
        <span id={`${SEARCH_INPUT_ID}-hint`} className="sr-only">
          {t.app.searchKeysHint}
        </span>
        {value && (
          <button
            type="button"
            onClick={() => update('')}
            aria-label={t.app.clearSearch}
            className="absolute end-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </form>
      <div className="ms-auto flex shrink-0 items-center gap-2">
        <IconButton label={t.player.shortcutsOpen} aria-haspopup="dialog" onClick={onOpenShortcuts} className="tip-down hidden text-[var(--muted-foreground)] pointer-fine:grid">
          <Keyboard className="h-5 w-5" aria-hidden="true" />
        </IconButton>
        <LangToggle />
      </div>
    </div>
  );
}
