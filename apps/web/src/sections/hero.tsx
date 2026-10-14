import { Fragment, lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Bell, Ban, AudioLines, Radio, Download, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlayerCard } from '@/components/player-card';
import { Waveform } from '@/components/waveform';
import { useLang } from '@/i18n';
import { useMotion } from '@/motion/provider';
import { useFx } from '@/motion/use-fx';
import { cn } from '@/lib/utils';

const Waves = lazy(() => import('@/motion/bg/waves'));

const n = (i: number) => ({ '--n': i }) as CSSProperties;

/**
 * Act 1 — "Static -> Signal". The page loads to silence (flat line, dim aurora, "Searching…");
 * ~0.7 s in or on the first scroll/tap the section gets `.signal-locked`: CSS transitions kindle
 * the waveform (registered `--amp` / `--kindle`), the aurora brightens, the status flips and the
 * wordmark reveals its meaning. Zero JS is needed for the first paint; GSAP only adds the scroll
 * parallax, and the Waves canvas mounts after the engine chunk (never on `static`).
 */
export function Hero() {
  const { t } = useLang();
  const { tier, engine } = useMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const auroraRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [locked, setLocked] = useState(tier === 'static');

  useEffect(() => {
    if (tier === 'static') {
      setLocked(true);
      return;
    }
    const lock = () => setLocked(true);
    const timer = window.setTimeout(lock, 700);
    const opts: AddEventListenerOptions = { once: true, passive: true };
    window.addEventListener('scroll', lock, opts);
    window.addEventListener('pointerdown', lock, opts);
    window.addEventListener('keydown', lock, opts);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', lock);
      window.removeEventListener('pointerdown', lock);
      window.removeEventListener('keydown', lock);
    };
  }, [tier]);

  // Scroll parallax (replaces framer useScroll/useTransform): aurora drifts; on `full` the copy recedes.
  useFx(sectionRef, ({ gsap, tier: fxTier, scrub }) => {
    const tl = gsap.timeline({ scrollTrigger: { trigger: sectionRef.current, start: 'top top', end: 'bottom 30%', scrub } });
    tl.to(auroraRef.current, { yPercent: 22, ease: 'none' }, 0);
    if (fxTier === 'full') {
      tl.to(copyRef.current, { yPercent: -12, opacity: 0.35, ease: 'none' }, 0.3).to(playerRef.current, { yPercent: -20, ease: 'none' }, 0);
    }
  });

  const stats = [
    { Icon: Ban, label: t.hero.stats.adFree },
    { Icon: AudioLines, label: t.hero.stats.quality },
    { Icon: Radio, label: t.hero.stats.live },
    { Icon: Download, label: t.hero.stats.offline },
  ];
  const words = t.hero.title.split(' ');

  return (
    <section
      id="top"
      ref={sectionRef}
      className={cn('hero relative w-full overflow-x-clip px-4 pt-32 sm:px-5 lg:pt-40', locked && 'signal-locked')}
    >
      <p className="sr-only">{t.hero.srIntro}</p>

      {/* Aurora (always present, CSS) + lazy Waves canvas (lite/full, after the engine chunk) */}
      <div ref={auroraRef} className="hero-aurora pointer-events-none absolute left-1/2 top-1/3 h-[60vh] w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-[50%] blur-[100px]">
        <div
          className="h-full w-full"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--primary) 26%, transparent) 0%, color-mix(in oklch, var(--secondary) 18%, transparent) 42%, transparent 70%)',
          }}
        />
      </div>
      {engine && tier !== 'static' && (
        <Suspense fallback={null}>
          <Waves tier={tier} />
        </Suspense>
      )}

      {/* Floating orbs — the second one is dropped under 640px (blur budget) */}
      <div className="animate-float-slow pointer-events-none absolute start-[6%] top-[18%] h-40 w-40 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary)_32%,transparent),transparent_70%)] blur-2xl" />
      <div
        className="animate-float-slow pointer-events-none absolute end-[8%] top-[60%] hidden h-56 w-56 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--secondary)_30%,transparent),transparent_70%)] blur-2xl sm:block"
        style={{ animationDelay: '2s' }}
      />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-12 pb-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10 lg:pb-24">
        <div ref={copyRef} className="hero-in flex flex-col items-center text-center lg:items-start lg:text-start">
          <div
            style={n(0)}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[color-mix(in_oklch,var(--foreground)_4%,transparent)] px-4 py-1.5 text-xs font-semibold text-[var(--muted-foreground)] backdrop-blur-md"
          >
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
            {t.hero.badge}
          </div>

          <p role="status" style={n(1)} className="hero-signal mb-5 inline-flex items-center gap-2 text-xs font-bold">
            <span aria-hidden="true" className="signal-dot" />
            <span>{locked ? t.hero.signal.locked : t.hero.signal.searching}</span>
            {locked && <span className="signal-freq text-[var(--accent)]">· {t.hero.signal.frequency}</span>}
          </p>

          <h1 aria-label={t.hero.title} style={n(2)} className="text-balance text-4xl font-black leading-[1.12] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            <span aria-hidden="true">
              {words.map((word, i) => (
                <Fragment key={`${word}-${i}`}>
                  <span className="hero-word" style={{ '--w': i } as CSSProperties}>
                    {word}
                  </span>
                  {i < words.length - 1 ? ' ' : ''}
                </Fragment>
              ))}
            </span>
          </h1>

          <p style={n(3)} className="wordmark mt-4 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 text-sm font-semibold text-[var(--muted-foreground)] lg:justify-start">
            <span className="wm-part">
              <span className="wm-key">{t.hero.wordmark.afro}</span>
              <span className="wm-meaning">{t.hero.wordmark.afroMeaning}</span>
            </span>
            <span aria-hidden="true" className="text-[var(--primary)]">
              ·
            </span>
            <span className="wm-part">
              <bdi className="wm-key">{t.hero.wordmark.ws}</bdi>
              <span className="wm-meaning">{t.hero.wordmark.wsMeaning}</span>
            </span>
          </p>

          <p style={n(4)} className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-[var(--muted-foreground)] md:text-lg">
            {t.hero.subtitle}
          </p>

          <div style={n(5)} className="mt-9 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
            <Button as="a" href="#pricing" variant="primary" size="lg">
              <Bell className="h-4 w-4" aria-hidden="true" />
              {t.hero.ctaPrimary}
            </Button>
            <Button as="a" href="#radio" variant="glass" size="lg">
              {t.hero.ctaSecondary}
            </Button>
          </div>

          <ul style={n(6)} className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 lg:justify-start">
            {stats.map(({ Icon, label }) => (
              <li key={label} className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted-foreground)]">
                <Icon className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div ref={playerRef} className="flex justify-center lg:justify-end">
          <div className="hero-card w-full max-w-md">
            <PlayerCard />
          </div>
        </div>
      </div>

      <Waveform />
    </section>
  );
}
