import { useRef } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SoundRings } from '@/components/sound-rings';
import { useLang } from '@/i18n';
import { watchOnscreen } from '@/motion/reveal';
import { SplitWords } from '@/motion/split-words';
import { isBelowFold } from '@/motion/tier';
import { EASE } from '@/motion/tokens';
import { useFx } from '@/motion/use-fx';

/** Act 7 — climax: "Go on air". Sound rings leave on the beat; the button is the brightest thing on the page. */
export function Cta() {
  const { t } = useLang();
  const ref = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  useFx(ref, (fx) => {
    const section = ref.current!;
    const button = buttonRef.current!;
    watchOnscreen(fx, section);
    if (!isBelowFold(button)) return;
    const tl = fx.gsap.timeline({ scrollTrigger: { trigger: section, start: 'top 75%', once: true } });
    tl.from(button, { scale: 0.9, opacity: 0, duration: 0.6, ease: EASE.back })
      .fromTo(button, { '--flare': 0 }, { '--flare': 1, duration: 0.45, ease: 'power1.in' }, 0.25)
      .to(button, { '--flare': 0, duration: 0.45, ease: 'power1.out' });
  });

  return (
    <section ref={ref} className="relative mx-auto w-full max-w-6xl px-4 py-20 sm:px-5">
      <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] px-6 py-16 text-center sm:px-8">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 0%, color-mix(in oklch, var(--primary) 28%, transparent), transparent 60%), radial-gradient(circle at 50% 100%, color-mix(in oklch, var(--secondary) 22%, transparent), transparent 60%)',
          }}
        />
        <div aria-hidden="true" className="cta-wave pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2" />
        <div className="relative z-10 mx-auto max-w-2xl">
          <p data-fx="rise" className="mb-4 text-xs font-extrabold uppercase tracking-[0.25em] text-[var(--accent)]">
            {t.cta.eyebrow}
          </p>
          <SplitWords as="h2" text={t.cta.title} className="text-balance text-3xl font-black leading-tight tracking-tight md:text-5xl" />
          <p data-fx="rise" className="mt-4 text-pretty text-[var(--muted-foreground)] md:text-lg">
            {t.cta.body}
          </p>
          <div ref={buttonRef} className="cta-button relative mt-8 inline-flex">
            <SoundRings />
            <span aria-hidden="true" className="cta-flare pointer-events-none absolute -inset-6 rounded-full" />
            <Button as="a" href="#pricing" variant="primary" size="lg" className="relative">
              <Bell className="h-4 w-4" aria-hidden="true" />
              {t.cta.button}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
