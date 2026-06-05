import { motion } from 'framer-motion';
import { Route, Gauge, ShieldCheck, Layers, Zap, Lock } from 'lucide-react';
import { Reveal } from '@/components/reveal';
import { useLang } from '@/i18n';

export function Features() {
  const { t } = useLang();
  const items = [
    { key: 'smartRouting', Icon: Route },
    { key: 'lowPing', Icon: Gauge },
    { key: 'stability', Icon: ShieldCheck },
    { key: 'multiProtocol', Icon: Layers },
    { key: 'speed', Icon: Zap },
    { key: 'privacy', Icon: Lock },
  ] as const;

  return (
    <section id="features" className="relative mx-auto w-full max-w-6xl scroll-mt-24 px-5 py-20">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-black tracking-tight md:text-5xl">{t.features.title}</h2>
          <p className="mt-4 text-[var(--muted-foreground)]">{t.features.subtitle}</p>
        </div>
      </Reveal>

      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ key, Icon }, i) => {
          const item = t.features.items[key];
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ type: 'spring', stiffness: 90, damping: 16, delay: (i % 3) * 0.08 }}
              whileHover={{ y: -6 }}
              className="group relative h-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[linear-gradient(145deg,color-mix(in_oklch,var(--foreground)_4%,transparent),color-mix(in_oklch,var(--foreground)_1%,transparent))] p-6 backdrop-blur-md transition-colors duration-300 hover:border-[color-mix(in_oklch,var(--primary)_45%,transparent)]"
            >
              {/* hover glow */}
              <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary)_22%,transparent),transparent_70%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

              <div className="relative">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--primary)_12%,transparent)] text-[var(--primary)] transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-110">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-[var(--foreground)]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">{item.body}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
