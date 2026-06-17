import { motion, useScroll, useTransform } from 'framer-motion';
import { Sparkles, ShieldCheck, Clock, Globe, Zap, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const { t, appHref } = useLang();
  const { scrollY } = useScroll();
  const auroraY = useTransform(scrollY, [0, 700], [0, 160]);
  const gridY = useTransform(scrollY, [0, 700], [0, 80]);

  const trust = [
    { Icon: ShieldCheck, label: 'No-logs' },
    { Icon: Clock, label: '24/7' },
    { Icon: Zap, label: 'Instant setup' },
    { Icon: Globe, label: '25+ locations' },
  ];

  return (
    <section className="relative flex min-h-[94vh] w-full items-center justify-center overflow-hidden px-5 pb-10 pt-32">
      {/* Parallax aurora */}
      <motion.div
        style={{ y: auroraY }}
        className="pointer-events-none absolute left-1/2 top-1/3 h-[60vh] w-[85vw] -translate-x-1/2 -translate-y-1/2 rounded-[50%] blur-[100px]"
      >
        <div
          className="h-full w-full"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--primary) 22%, transparent) 0%, color-mix(in oklch, var(--secondary) 16%, transparent) 42%, transparent 70%)',
          }}
        />
      </motion.div>

      {/* Floating orbs */}
      <div className="animate-float-slow pointer-events-none absolute left-[8%] top-[22%] h-40 w-40 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary)_30%,transparent),transparent_70%)] blur-2xl" />
      <div
        className="animate-float-slow pointer-events-none absolute right-[10%] top-[55%] h-52 w-52 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--secondary)_28%,transparent),transparent_70%)] blur-2xl"
        style={{ animationDelay: '2s' }}
      />

      {/* Parallax grid */}
      <motion.div
        style={{ y: gridY }}
        className="pointer-events-none absolute inset-0"
      >
        <div
          className="h-full w-full"
          style={{
            backgroundSize: '56px 56px',
            backgroundImage:
              'linear-gradient(to right, color-mix(in oklch, var(--foreground) 4%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklch, var(--foreground) 4%, transparent) 1px, transparent 1px)',
            maskImage: 'radial-gradient(ellipse at center, black 35%, transparent 72%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 35%, transparent 72%)',
          }}
        />
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center"
      >
        <motion.div
          variants={item}
          className="mb-7 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[color-mix(in_oklch,var(--foreground)_4%,transparent)] px-4 py-1.5 text-xs font-semibold text-[var(--muted-foreground)] backdrop-blur-md"
        >
          <Sparkles className="h-3.5 w-3.5 text-[var(--primary)]" />
          {t.hero.badge}
          <span className="mx-1 h-1 w-1 rounded-full bg-[var(--border)]" />
          <span className="inline-flex items-center gap-1 text-[var(--foreground)]">
            <span className="animate-blink h-1.5 w-1.5 rounded-full bg-emerald-400" />
            18ms
          </span>
        </motion.div>

        <motion.h1
          variants={item}
          className="text-balance text-5xl font-black leading-[1.04] tracking-tight md:text-7xl lg:text-8xl"
        >
          <span
            className="animate-gradient-text"
            style={{
              backgroundImage:
                'linear-gradient(110deg, var(--foreground), var(--primary), var(--secondary), var(--foreground))',
            }}
          >
            {t.hero.title}
          </span>
        </motion.h1>

        <motion.p
          variants={item}
          className="mt-7 max-w-2xl text-base leading-relaxed text-[var(--muted-foreground)] md:text-lg"
        >
          {t.hero.subtitle}
        </motion.p>

        <motion.div variants={item} className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button as="a" href={appHref} variant="primary" size="lg">
            {t.hero.ctaPrimary}
          </Button>
          <Button as="a" href="#features" variant="glass" size="lg">
            {t.hero.ctaSecondary}
          </Button>
          <Button as="a" href="/afrows.apk" variant="glass" size="lg" download>
            <Download className="h-4 w-4" />
            {t.hero.ctaAndroid}
          </Button>
        </motion.div>

        <motion.div variants={item} className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          {trust.map(({ Icon, label }) => (
            <div key={label} className="inline-flex items-center gap-2 text-xs font-medium text-[var(--muted-foreground)]">
              <Icon className="h-4 w-4 text-[var(--primary)]" />
              {label}
            </div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
