import { useRef } from 'react';
import { Ban, AudioLines, Download, ListMusic, MonitorSmartphone, Radio } from 'lucide-react';
import { SectionHeading } from '@/components/section-heading';
import { useLang } from '@/i18n';
import { isBelowFold } from '@/motion/tier';
import { useFx } from '@/motion/use-fx';

/** Act 3 — "Clean signal": calm cards; each icon tile kindles (`--lit`) right after its card lands. */
export function Features() {
  const { t } = useLang();
  const ref = useRef<HTMLElement>(null);
  const items = [
    { key: 'adFree', Icon: Ban },
    { key: 'quality', Icon: AudioLines },
    { key: 'offline', Icon: Download },
    { key: 'playlists', Icon: ListMusic },
    { key: 'devices', Icon: MonitorSmartphone },
    { key: 'radio', Icon: Radio },
  ] as const;

  useFx(ref, ({ gsap, ScrollTrigger }) => {
    const icons = Array.from(ref.current!.querySelectorAll<HTMLElement>('.feat-icon')).filter(isBelowFold);
    if (icons.length === 0) return;
    gsap.set(icons, { '--lit': 0 });
    ScrollTrigger.batch(icons, {
      start: 'top 88%',
      once: true,
      onEnter: (els) => gsap.to(els, { '--lit': 1, duration: 0.5, delay: 0.25, stagger: 0.08, ease: 'power2.out' }),
    });
  });

  return (
    <section id="features" ref={ref} className="relative mx-auto w-full max-w-6xl px-4 py-20 sm:px-5">
      <SectionHeading tag={t.features.tag} title={t.features.title} subtitle={t.features.subtitle} />

      <ul className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ key, Icon }) => {
          const item = t.features.items[key];
          return (
            <li
              key={key}
              data-fx="rise"
              className="group relative h-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[linear-gradient(145deg,color-mix(in_oklch,var(--foreground)_4%,transparent),color-mix(in_oklch,var(--foreground)_1%,transparent))] p-6 backdrop-blur-md transition-colors duration-300 hover:border-[color-mix(in_oklch,var(--primary)_45%,transparent)]"
            >
              <div className="pointer-events-none absolute -end-16 -top-16 h-40 w-40 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary)_22%,transparent),transparent_70%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative">
                <div className="feat-icon mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary)_30%,transparent),color-mix(in_oklch,var(--secondary)_30%,transparent))] transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-110">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-bold text-[var(--foreground)]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">{item.body}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
