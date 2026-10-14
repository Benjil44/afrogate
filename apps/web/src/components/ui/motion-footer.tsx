import { Fragment, useRef } from 'react';
import { ArrowUp } from 'lucide-react';
import { Equalizer } from '@/components/equalizer';
import { siteLinks } from '@/components/nav';
import { useLang } from '@/i18n';
import { usePlayer } from '@/lib/player';
import { useMotion } from '@/motion/provider';
import { watchOnscreen } from '@/motion/reveal';
import { SplitWords } from '@/motion/split-words';
import { useFx } from '@/motion/use-fx';

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

/** Act 8 — sign-off: the name glows from the ground (watermark parallax + ember glow), marquee of stations. */
export function Footer() {
  const { t } = useLang();
  const { playing } = usePlayer();
  const { scrollTo } = useMotion();
  const ref = useRef<HTMLElement>(null);
  const watermarkRef = useRef<HTMLDivElement>(null);
  const links = siteLinks(t);

  useFx(ref, (fx) => {
    const footer = ref.current!;
    watchOnscreen(fx, footer);
    // `--wm-glow` lives on the footer so both the watermark gradient and the ground glow read it.
    fx.gsap
      .timeline({ scrollTrigger: { trigger: footer, start: 'top bottom', end: 'bottom bottom', scrub: fx.scrub } })
      .fromTo(watermarkRef.current, { yPercent: 45 }, { yPercent: 12, ease: 'none' }, 0)
      .fromTo(footer, { '--wm-glow': 0 }, { '--wm-glow': 1, ease: 'none' }, 0);
  });

  return (
    <footer ref={ref} className="relative mt-10 w-full overflow-hidden border-t border-[var(--border)]">
      {/* Genre marquee — forced LTR so the translate direction is stable in RTL */}
      <div dir="ltr" aria-hidden="true" className="w-full overflow-hidden border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--foreground)_2%,transparent)] py-3">
        <div className="animate-marquee flex w-max text-xs font-bold tracking-[0.25em] text-[var(--muted-foreground)] uppercase">
          <MarqueeRow items={t.footer.marquee} />
          <MarqueeRow items={t.footer.marquee} />
        </div>
      </div>

      {/* extra bottom padding keeps the copyright line clear of the mini player on phones */}
      <div className="relative mx-auto w-full max-w-6xl px-4 pb-24 pt-16 sm:px-5 sm:pb-10">
        {/* Giant brand watermark + ember ground glow */}
        <div aria-hidden="true" className="footer-ember pointer-events-none absolute inset-x-0 bottom-0 h-56" />
        <div
          ref={watermarkRef}
          aria-hidden="true"
          className="footer-watermark pointer-events-none absolute inset-x-0 bottom-0 select-none overflow-hidden text-center font-black leading-none tracking-tighter"
          style={{ fontSize: 'clamp(5rem, 22vw, 18rem)' }}
        >
          {t.brand}
        </div>

        <div className="relative z-10 grid gap-10 md:grid-cols-[1.4fr_1fr] md:items-start">
          <div>
            <div className="flex items-center gap-2.5 text-xl font-black">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(135deg,var(--primary),var(--secondary))] text-white">
                <Equalizer active={playing} bars={4} className="h-4" />
              </span>
              {t.brandFull}
            </div>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--muted-foreground)]">{t.footer.tagline}</p>
            <SplitWords as="p" text={t.footer.ready} className="footer-ready mt-8 text-balance text-4xl font-black tracking-tight md:text-6xl" />
            <p className="mt-3 text-sm font-semibold text-[var(--muted-foreground)]">{t.footer.signoff}</p>
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
            onClick={() => scrollTo(0)}
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
