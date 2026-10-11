import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { Reveal } from '@/components/reveal';
import { SectionHeading } from '@/components/section-heading';
import { cn } from '@/lib/utils';
import { useLang } from '@/i18n';

/** Accessible accordion: button + aria-expanded/aria-controls, region per answer. */
export function Faq() {
  const { t } = useLang();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="relative mx-auto w-full max-w-3xl scroll-mt-24 px-4 py-20 sm:px-5">
      <SectionHeading tag={t.faq.tag} title={t.faq.title} subtitle={t.faq.subtitle} />

      <Reveal className="mt-12">
        <ul className="flex flex-col gap-3">
          {t.faq.items.map((item, i) => {
            const open = openIndex === i;
            const btnId = `faq-q-${i}`;
            const panelId = `faq-a-${i}`;
            return (
              <li
                key={btnId}
                className={cn(
                  'rounded-2xl border transition-colors',
                  open ? 'border-[color-mix(in_oklch,var(--primary)_50%,transparent)] bg-[color-mix(in_oklch,var(--primary)_6%,transparent)]' : 'border-[var(--border)] bg-[color-mix(in_oklch,var(--foreground)_3%,transparent)]',
                )}
              >
                <h3>
                  <button
                    type="button"
                    id={btnId}
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setOpenIndex(open ? null : i)}
                    className="flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-start text-base font-bold"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      aria-hidden="true"
                      className={cn('h-5 w-5 shrink-0 text-[var(--muted-foreground)] transition-transform duration-300', open && 'rotate-180 text-[var(--primary)]')}
                    />
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      id={panelId}
                      role="region"
                      aria-labelledby={btnId}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-5 text-sm leading-relaxed text-[var(--muted-foreground)]">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </Reveal>
    </section>
  );
}
