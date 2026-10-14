import { useState } from 'react';
import { Bell, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Collapse } from '@/components/collapse';
import { LangToggle } from '@/components/lang-toggle';
import { Equalizer } from '@/components/equalizer';
import { useLang, type Dict } from '@/i18n';
import { usePlayer } from '@/lib/player';
import { useScrollFlag } from '@/motion/use-scroll-flag';

/** In-page anchors shared by the nav and the footer. */
export function siteLinks(t: Dict) {
  return [
    { href: '#radio', label: t.nav.radio },
    { href: '#mixes', label: t.nav.mixes },
    { href: '#features', label: t.nav.features },
    { href: '#pricing', label: t.nav.pricing },
    { href: '#faq', label: t.nav.faq },
  ];
}

function Logo() {
  const { t } = useLang();
  const { playing } = usePlayer();
  return (
    <a href="#top" aria-label={t.nav.home} className="flex items-center gap-2.5 text-lg font-black tracking-tight">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(135deg,var(--primary),var(--secondary))] text-white">
        <Equalizer active={playing} bars={4} className="h-4 text-white" />
      </span>
      <span>{t.brand}</span>
    </a>
  );
}

export function Nav() {
  const { t } = useLang();
  const scrolled = useScrollFlag(12);
  const [open, setOpen] = useState(false);
  const links = siteLinks(t);

  return (
    <header
      className={cn(
        'w-full transition-all duration-300',
        scrolled
          ? 'border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--background)_75%,transparent)] backdrop-blur-xl'
          : 'border-b border-transparent bg-[color-mix(in_oklch,var(--background)_40%,transparent)] backdrop-blur-md',
      )}
    >
      <nav aria-label={t.nav.menu} className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-5">
        <Logo />

        <ul className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 md:flex">
          <LangToggle />
          <Button as="a" href="#pricing" variant="primary" size="md">
            <Bell className="h-4 w-4" aria-hidden="true" />
            {t.nav.cta}
          </Button>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <LangToggle />
          <button
            type="button"
            aria-label={open ? t.nav.closeMenu : t.nav.menu}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
            className="grid h-11 w-11 place-items-center rounded-full border border-[var(--border)] text-[var(--foreground)]"
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </nav>

      <Collapse id="mobile-menu" open={open} className="md:hidden">
        <ul className="mx-auto flex max-w-6xl flex-col border-t border-[var(--border)] bg-[color-mix(in_oklch,var(--background)_92%,transparent)] px-4 py-3 backdrop-blur-xl">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center text-base font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                {l.label}
              </a>
            </li>
          ))}
          <li className="mt-2 pb-2">
            <Button as="a" href="#pricing" onClick={() => setOpen(false)} variant="primary" size="md" className="w-full">
              <Bell className="h-4 w-4" aria-hidden="true" />
              {t.nav.cta}
            </Button>
          </li>
        </ul>
      </Collapse>
    </header>
  );
}
