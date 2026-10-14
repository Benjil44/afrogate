import { useRef } from 'react';
import { Check, Crown } from 'lucide-react';
import { SectionHeading } from '@/components/section-heading';
import { cn } from '@/lib/utils';
import { useLang } from '@/i18n';
import { useFx } from '@/motion/use-fx';

/** Act 5 — "Your frequency": the featured yearly card lands last and highest, and its glow is scrubbed in. */
export function Pricing() {
  const { t } = useLang();
  const ref = useRef<HTMLElement>(null);
  // Prices are i18n PLACEHOLDERS (see en.ts / fa.ts) until the billing catalogue exists.
  const plans = [
    { key: 'free', featured: false },
    { key: 'monthly', featured: false },
    { key: 'yearly', featured: true },
  ] as const;

  useFx(ref, ({ gsap, scrub }) => {
    const card = ref.current!.querySelector('.plan-featured');
    if (!card) return;
    gsap.fromTo(card, { '--plan-glow': 0 }, { '--plan-glow': 1, ease: 'none', scrollTrigger: { trigger: card, start: 'top 85%', end: 'top 45%', scrub } });
  });

  return (
    <section id="pricing" ref={ref} className="relative mx-auto w-full max-w-6xl px-4 py-20 sm:px-5">
      <SectionHeading tag={t.pricing.tag} title={t.pricing.title} subtitle={t.pricing.subtitle} />

      <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
        {plans.map(({ key, featured }) => {
          const p = t.pricing.plans[key];
          const isFree = key === 'free';
          const wasPrice = 'wasPrice' in p ? p.wasPrice : undefined;
          return (
            <div key={key} data-fx="rise" data-fx-y={featured ? 52 : undefined} className="h-full">
              <article
                aria-labelledby={`plan-${key}`}
                className={cn(
                  'relative flex h-full flex-col rounded-3xl border p-6 backdrop-blur-md lg:p-7',
                  featured
                    ? 'plan-featured border-[var(--primary)] bg-[linear-gradient(160deg,color-mix(in_oklch,var(--primary)_16%,transparent),color-mix(in_oklch,var(--secondary)_12%,transparent))] md:-translate-y-3'
                    : 'border-[var(--border)] bg-[color-mix(in_oklch,var(--foreground)_3%,transparent)]',
                )}
              >
                {featured && (
                  <span className="absolute -top-3.5 start-6 inline-flex items-center gap-1 rounded-full bg-[linear-gradient(135deg,var(--primary),var(--secondary))] px-3 py-1 text-xs font-bold text-white">
                    <span aria-hidden="true" className="crown-halo" />
                    <Crown className="relative h-3.5 w-3.5" aria-hidden="true" />
                    <span className="relative">{t.pricing.mostPopular}</span>
                  </span>
                )}
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <h3 id={`plan-${key}`} className="text-lg font-bold">
                    {p.name}
                  </h3>
                  {featured && (
                    <span className="rounded-full bg-[color-mix(in_oklch,var(--accent)_18%,transparent)] px-2.5 py-0.5 text-[11px] font-extrabold text-[var(--accent)]">
                      {t.pricing.save}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">{p.tagline}</p>

                <div className="mt-5 flex flex-wrap items-end gap-x-2 gap-y-1">
                  {isFree ? (
                    <span className="text-4xl font-black">{t.pricing.free}</span>
                  ) : (
                    <>
                      <span className="text-4xl font-black tabular-nums">{p.price}</span>
                      <span className="mb-1.5 text-sm font-semibold text-[var(--muted-foreground)]">{t.pricing.currency}</span>
                      <span className="mb-1.5 text-sm text-[var(--muted-foreground)]">{p.period}</span>
                    </>
                  )}
                </div>
                {wasPrice && (
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    <s className="tabular-nums opacity-80">{wasPrice}</s> {t.pricing.currency}
                  </p>
                )}

                <ul className="mt-6 flex flex-1 flex-col gap-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[var(--muted-foreground)]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* Not launched yet: visibly disabled "coming soon" CTA (no external links). */}
                <button
                  type="button"
                  disabled
                  className={cn(
                    'mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border text-sm font-bold',
                    featured
                      ? 'border-transparent bg-[linear-gradient(135deg,var(--primary),var(--secondary))] text-white opacity-80'
                      : 'border-[var(--border)] bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)] text-[var(--muted-foreground)]',
                  )}
                >
                  {t.pricing.comingSoon}
                </button>
                <p className="mt-3 text-center text-xs text-[var(--muted-foreground)]">{t.pricing.notifyHint}</p>
              </article>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-[var(--muted-foreground)]">{t.pricing.note}</p>
    </section>
  );
}
