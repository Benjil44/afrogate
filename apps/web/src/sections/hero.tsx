import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLang, APP_URL } from '@/i18n';

export function Hero() {
  const { t } = useLang();
  return (
    <section className="relative flex min-h-[92vh] w-full items-center justify-center overflow-hidden px-5 pt-16">
      {/* Aurora glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[60vh] w-[80vw] -translate-x-1/2 -translate-y-1/2 rounded-[50%] blur-[90px]"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--primary) 18%, transparent) 0%, color-mix(in oklch, var(--secondary) 14%, transparent) 40%, transparent 70%)',
        }}
      />
      {/* Grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundSize: '60px 60px',
          backgroundImage:
            'linear-gradient(to right, color-mix(in oklch, var(--foreground) 3%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklch, var(--foreground) 3%, transparent) 1px, transparent 1px)',
          maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)',
        }}
      />

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[color-mix(in_oklch,var(--foreground)_4%,transparent)] px-4 py-1.5 text-xs font-semibold text-[var(--muted-foreground)] backdrop-blur-md"
        >
          <Sparkles className="h-3.5 w-3.5 text-[var(--primary)]" />
          {t.hero.badge}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="text-balance text-4xl font-black leading-[1.05] tracking-tight md:text-6xl lg:text-7xl"
        >
          <span className="bg-[linear-gradient(180deg,var(--foreground),color-mix(in_oklch,var(--foreground)_45%,transparent))] bg-clip-text text-transparent">
            {t.hero.title}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-6 max-w-2xl text-base leading-relaxed text-[var(--muted-foreground)] md:text-lg"
        >
          {t.hero.subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <Button as="a" href={APP_URL} variant="primary" size="lg">
            {t.hero.ctaPrimary}
          </Button>
          <Button as="a" href="#features" variant="glass" size="lg">
            {t.hero.ctaSecondary}
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
