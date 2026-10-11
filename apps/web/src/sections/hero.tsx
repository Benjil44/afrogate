import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { Bell, Ban, AudioLines, Radio, Download, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlayerCard } from '@/components/player-card';
import { useLang } from '@/i18n';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};

export function Hero() {
  const { t } = useLang();
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();
  const auroraY = useTransform(scrollY, [0, 700], [0, reduced ? 0 : 160]);

  const stats = [
    { Icon: Ban, label: t.hero.stats.adFree },
    { Icon: AudioLines, label: t.hero.stats.quality },
    { Icon: Radio, label: t.hero.stats.live },
    { Icon: Download, label: t.hero.stats.offline },
  ];

  return (
    <section id="top" className="relative w-full overflow-hidden px-4 pb-16 pt-32 sm:px-5 lg:pb-24 lg:pt-40">
      {/* Aurora */}
      <motion.div
        style={{ y: auroraY }}
        className="pointer-events-none absolute left-1/2 top-1/3 h-[60vh] w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-[50%] blur-[100px]"
      >
        <div
          className="h-full w-full"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--primary) 26%, transparent) 0%, color-mix(in oklch, var(--secondary) 18%, transparent) 42%, transparent 70%)',
          }}
        />
      </motion.div>

      {/* Floating orbs */}
      <div className="animate-float-slow pointer-events-none absolute start-[6%] top-[18%] h-40 w-40 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary)_32%,transparent),transparent_70%)] blur-2xl" />
      <div
        className="animate-float-slow pointer-events-none absolute end-[8%] top-[60%] h-56 w-56 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--secondary)_30%,transparent),transparent_70%)] blur-2xl"
        style={{ animationDelay: '2s' }}
      />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex flex-col items-center text-center lg:items-start lg:text-start"
        >
          <motion.div
            variants={item}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[color-mix(in_oklch,var(--foreground)_4%,transparent)] px-4 py-1.5 text-xs font-semibold text-[var(--muted-foreground)] backdrop-blur-md"
          >
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
            {t.hero.badge}
          </motion.div>

          <motion.h1
            variants={item}
            className="text-balance text-4xl font-black leading-[1.12] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
          >
            <span
              className="animate-gradient-text"
              style={{
                backgroundImage:
                  'linear-gradient(110deg, var(--foreground), var(--primary), var(--accent), var(--secondary), var(--foreground))',
              }}
            >
              {t.hero.title}
            </span>
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-[var(--muted-foreground)] md:text-lg"
          >
            {t.hero.subtitle}
          </motion.p>

          <motion.div variants={item} className="mt-9 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
            <Button as="a" href="#pricing" variant="primary" size="lg">
              <Bell className="h-4 w-4" aria-hidden="true" />
              {t.hero.ctaPrimary}
            </Button>
            <Button as="a" href="#radio" variant="glass" size="lg">
              {t.hero.ctaSecondary}
            </Button>
          </motion.div>

          <motion.ul variants={item} className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 lg:justify-start">
            {stats.map(({ Icon, label }) => (
              <li key={label} className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted-foreground)]">
                <Icon className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
                {label}
              </li>
            ))}
          </motion.ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex justify-center lg:justify-end"
        >
          <PlayerCard />
        </motion.div>
      </div>
    </section>
  );
}
