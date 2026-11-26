import { Heart, Home, Library, Search, type LucideIcon } from 'lucide-react';
import { Equalizer } from '@/components/equalizer';
import { TrackArt } from '@/components/art';
import { useLang, type Dict } from '@/i18n';
import { useCollection } from '@/lib/collection';
import { usePlayer } from '@/lib/player';
import { routeHref, sameSection, type Route } from '@/lib/route';
import type { Track } from '@/lib/tracks';
import { cn } from '@/lib/utils';

/** Sections shared by the sidebar and the phone tab bar. */
export function navItems(t: Dict): { route: Route; section: Route['name']; label: string; Icon: LucideIcon }[] {
  return [
    { route: { name: 'home' }, section: 'home', label: t.app.home, Icon: Home },
    { route: { name: 'search', q: '' }, section: 'search', label: t.app.search, Icon: Search },
    { route: { name: 'library' }, section: 'library', label: t.app.library, Icon: Library },
  ];
}

function LibraryList() {
  const { t } = useLang();
  const { library, track: current, playing, playStation, toggle } = usePlayer();
  const { liked, recent } = useCollection();
  const map = new Map(library.tracks.map((x) => [x.id, x] as const));
  const ids = Array.from(new Set([...liked, ...recent]));
  const tracks = ids.map((id) => map.get(id)).filter((x): x is Track => Boolean(x));
  const likedSet = new Set(liked);
  if (tracks.length === 0) {
    return (
      <div className="m-2 rounded-lg bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)] p-4">
        <p className="text-sm font-bold">{t.app.libraryEmpty}</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">{t.app.libraryEmptyHint}</p>
      </div>
    );
  }
  return (
    <ul data-scroll-list className="scroll-area min-h-0 flex-1 overflow-y-auto px-2 pb-2">
      {tracks.map((item) => {
        const active = current.id === item.id && Boolean(current.src);
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => (active ? toggle() : playStation('all', item.id))}
              aria-current={active || undefined}
              className="flex min-h-14 w-full items-center gap-3 rounded-lg px-2 py-1.5 text-start hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)]"
            >
              <TrackArt track={item} className="h-11 w-11 rounded-md" />
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-sm font-bold', active && 'text-[var(--accent)]')}>
                  <bdi>{item.title}</bdi>
                </span>
                <span className="flex items-center gap-1 truncate text-xs text-[var(--muted-foreground)]">
                  {likedSet.has(item.id) && (
                    <>
                      <Heart className="h-3 w-3 shrink-0 text-[var(--state-active)]" fill="currentColor" aria-hidden="true" />
                      <span className="sr-only">{t.app.liked}: </span>
                    </>
                  )}
                  <bdi className="truncate">{item.artist}</bdi>
                </span>
              </span>
              {active && <Equalizer active={playing} bars={3} className="h-3.5 text-[var(--accent)]" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Start-side sidebar (>= 768px). 768–1279: icons only (labels stay as accessible names and show
 * as a tooltip on focus / hover). >= 1280: labels + "Your library" list (liked + recent).
 */
export function Sidebar({ route }: { route: Route }) {
  const { t } = useLang();
  const { playing } = usePlayer();
  const items = navItems(t);
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <nav aria-label={t.app.mainNav} className="panel panel-open shrink-0 p-2">
        <p className="flex h-12 items-center gap-2.5 px-2 text-lg font-black tracking-tight max-xl:justify-center max-xl:px-0">
          <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[image:var(--brand-gradient)] text-white">
            <Equalizer active={playing} bars={4} className="h-4 text-white" />
          </span>
          <span className="truncate max-xl:sr-only">{t.brandRadio}</span>
        </p>
        <ul className="mt-1 flex flex-col gap-1">
          {items.map(({ route: target, section, label, Icon }) => {
            const current = sameSection(route, section);
            return (
              <li key={section}>
                <a
                  href={routeHref(target)}
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    'tip-host tip-side relative flex h-12 items-center gap-4 rounded-lg px-3 text-sm font-bold transition-colors max-xl:justify-center max-xl:px-0',
                    current ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
                  )}
                >
                  <Icon className="h-6 w-6 shrink-0" aria-hidden="true" fill={current && section !== 'search' ? 'currentColor' : 'none'} />
                  <span className="max-xl:sr-only">{label}</span>
                  <span aria-hidden="true" className="tip xl:hidden">
                    {label}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
      <section aria-labelledby="side-library-title" className="panel hidden min-h-0 flex-1 flex-col xl:flex">
        <h2 id="side-library-title" className="flex h-12 shrink-0 items-center gap-2 px-4 text-sm font-black text-[var(--muted-foreground)]">
          <Library className="h-5 w-5" aria-hidden="true" />
          {t.app.quickAccess}
        </h2>
        <LibraryList />
      </section>
    </div>
  );
}

/** Phone bottom tab bar (< 768px): Home, Search, Library. */
export function TabBar({ route }: { route: Route }) {
  const { t } = useLang();
  const items = navItems(t);
  return (
    <nav aria-label={t.app.mainNav} className="tab-bar border-t border-[var(--border)] bg-[var(--card)]">
      <ul className="grid h-14 grid-cols-3">
        {items.map(({ route: target, section, label, Icon }) => {
          const current = sameSection(route, section);
          return (
            <li key={section}>
              <a
                href={routeHref(target)}
                aria-current={current ? 'page' : undefined}
                className={cn('flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-bold', current ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]')}
              >
                <Icon className="h-6 w-6" aria-hidden="true" fill={current && section !== 'search' ? 'currentColor' : 'none'} />
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
