import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LangToggle } from '@/components/lang-toggle';
import { useLang, APP_URL } from '@/i18n';

function Logo() {
  return (
    <a href="/" className="flex items-center gap-2 text-lg font-black tracking-tight">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#0a0a0f] font-black">
        <span className="bg-[linear-gradient(135deg,var(--primary),var(--secondary))] bg-clip-text text-transparent">A</span>
      </span>
      <span className="bg-[linear-gradient(180deg,var(--foreground),color-mix(in_oklch,var(--foreground)_55%,transparent))] bg-clip-text text-transparent">
        Afrows
      </span>
    </a>
  );
}

export function Nav() {
  const { t } = useLang();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { href: '#features', label: t.nav.features },
    { href: '#pricing', label: t.nav.pricing },
  ];

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled
          ? 'border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--background)_70%,transparent)] backdrop-blur-xl'
          : 'border-b border-transparent',
      )}
    >
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
        <Logo />

        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <LangToggle />
          <Button as="a" href={APP_URL} variant="ghost" size="sm">
            {t.nav.login}
          </Button>
          <Button as="a" href={APP_URL} variant="primary" size="sm">
            {t.nav.getStarted}
          </Button>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <LangToggle />
          <button
            type="button"
            aria-label={t.nav.menu}
            onClick={() => setOpen((o) => !o)}
            className="grid h-9 w-9 place-items-center rounded-full border border-[var(--border)] text-[var(--foreground)]"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-[var(--border)] bg-[color-mix(in_oklch,var(--background)_88%,transparent)] backdrop-blur-xl md:hidden"
          >
            <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-4">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="py-1 text-sm font-medium text-[var(--muted-foreground)]"
                >
                  {l.label}
                </a>
              ))}
              <div className="mt-2 flex gap-3">
                <Button as="a" href={APP_URL} variant="glass" size="sm" className="flex-1">
                  {t.nav.login}
                </Button>
                <Button as="a" href={APP_URL} variant="primary" size="sm" className="flex-1">
                  {t.nav.getStarted}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
