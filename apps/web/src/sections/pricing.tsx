import { Check } from 'lucide-react';
import { Reveal } from '@/components/reveal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLang } from '@/i18n';

export function Pricing() {
  const { t, appHref } = useLang();
  // Static example prices — live plans/billing live in the panel.
  const plans = [
    { key: 'starter', featured: false },
    { key: 'pro', featured: true },
    { key: 'reseller', featured: false },
  ] as const;

  return (
    <section id="pricing" className="relative mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-20">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-black tracking-tight md:text-5xl">{t.pricing.title}</h2>
          <p className="mt-4 text-[var(--muted-foreground)]">{t.pricing.subtitle}</p>
        </div>
      </Reveal>

      <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
        {plans.map(({ key, featured }, i) => {
          const p = t.pricing.plans[key];
          return (
            <Reveal key={key} delay={i * 0.08}>
              <div
                className={cn(
                  'relative flex h-full flex-col rounded-2xl border p-7 backdrop-blur-md',
                  featured
                    ? 'border-[var(--primary)] bg-[color-mix(in_oklch,var(--primary)_10%,transparent)]'
                    : 'border-[var(--border)] bg-[color-mix(in_oklch,var(--foreground)_3%,transparent)]',
                )}
              >
                {featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[linear-gradient(135deg,var(--primary),var(--secondary))] px-3 py-1 text-xs font-bold text-white">
                    {t.pricing.mostPopular}
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">{p.name}</h3>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                    {t.pricing.discount}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">{p.tagline}</p>
                <div className="mt-5 flex items-end gap-2">
                  <span className="text-4xl font-black">{p.price}</span>
                  <span className="mb-1 text-sm text-[var(--muted-foreground)] line-through opacity-70">{p.was}</span>
                  <span className="mb-1 text-sm text-[var(--muted-foreground)]">{t.pricing.perMonth}</span>
                </div>
                <ul className="mt-6 flex flex-1 flex-col gap-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                      <Check className="h-4 w-4 shrink-0 text-[var(--primary)]" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button as="a" href={appHref} variant={featured ? 'primary' : 'glass'} size="md" className="mt-7 w-full">
                  {p.cta}
                </Button>
              </div>
            </Reveal>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-[var(--muted-foreground)]">{t.pricing.note}</p>
    </section>
  );
}
