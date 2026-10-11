import { Fragment } from 'react';
import { ArrowUp } from 'lucide-react';
import { Equalizer } from '@/components/equalizer';
import { useLang } from '@/i18n';
import { usePlayer } from '@/lib/player';

function MarqueeRow({ items }: { items: readonly string[] }) {
  return (
    <div className="flex items-center gap-10 px-5">
      {items.map((label, i) => (
        <Fragment key={`${label}-${i}`}>
          <span className="whitespace-nowrap">{label}</span>
          <span aria-hidden="true" className={i % 2 === 0 ? 'text-[var(--primary)]' : 'text-[var(--secondary)]'}>
            ✦
          </span>
        </Fragment>
      ))}
    </div>
  );
}

export function Footer() {
  const { t } = useLang();
  const { playing } = usePlayer();
  const links = [
    { href: '#radio', label: t.nav.radio },
    { href: '#features', label: t.nav.features },
    { href: '#pricing', label: t.nav.pricing },
    { href: '#faq', label: t.nav.faq },
  ];
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <footer className="relative mt-10 w-full overflow-hidden border-t border-[var(--border)]">
      {/* Genre marquee — forced LTR so the translate direction is stable in RTL */}
      <div dir="ltr" aria-hidden="true" className="w-full overflow-hidden border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--foreground)_2%,transparent)] py-3">
        <div className="animate-marquee flex w-max text-xs font-bold tracking-[0.25em] text-[var(--muted-foreground)] uppercase">
          <MarqueeRow items={t.footer.marquee} />
          <MarqueeRow items={t.footer.marquee} />
        </div>
      </div>

      {/* extra bottom padding keeps the copyright line clear of the mini player on phones */}
      <div className="relative mx-auto w-full max-w-6xl px-4 pb-24 pt-16 sm:px-5 sm:pb-10">
        {/* Giant brand watermark */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 select-none overflow-hidden text-center font-black leading-none tracking-tighter"
          style={{
            fontSize: 'clamp(5rem, 22vw, 18rem)',
            color: 'transparent',
            background: 'linear-gradient(180deg, color-mix(in oklch, var(--foreground) 9%, transparent), transparent 70%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            transform: 'translateY(30%)',
          }}
        >
          {t.brand}
        </div>

        <div className="relative z-10 grid gap-10 md:grid-cols-[1.4fr_1fr] md:items-start">
          <div>
            <div className="flex items-center gap-2.5 text-xl font-black">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(135deg,var(--primary),var(--secondary))] text-white">
                <Equalizer active={playing} bars={4} className="h-4" />
              </span>
              {t.brand}
            </div>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--muted-foreground)]">{t.footer.tagline}</p>
            <p className="mt-8 text-balance text-4xl font-black tracking-tight md:text-6xl">
              <span
                className="animate-gradient-text"
                style={{ backgroundImage: 'linear-gradient(110deg, var(--foreground), var(--primary), var(--accent), var(--foreground))' }}
              >
                {t.footer.ready}
              </span>
            </p>
          </div>

          <nav aria-label={t.footer.links}>
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-[var(--muted-foreground)]">{t.footer.links}</h2>
            <ul className="mt-4 grid grid-cols-2 gap-1 sm:grid-cols-1">
              {links.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--foreground)] transition-colors hover:text-[var(--primary)]"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="relative z-10 mt-14 flex items-center justify-between gap-4 border-t border-[var(--border)] pt-6">
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">
            © 2026 {t.brand}. {t.footer.rights}
          </p>
          <button
            type="button"
            onClick={scrollToTop}
            aria-label={t.footer.backToTop}
            className="grid h-11 w-11 place-items-center rounded-full border border-[var(--border)] bg-[color-mix(in_oklch,var(--foreground)_4%,transparent)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
          >
            <ArrowUp className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </footer>
  );
}
