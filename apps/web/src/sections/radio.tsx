import { motion } from 'framer-motion';
import { Pause, Play } from 'lucide-react';
import { SectionHeading } from '@/components/section-heading';
import { Equalizer } from '@/components/equalizer';
import { cn } from '@/lib/utils';
import { useLang } from '@/i18n';
import { CHANNEL_ART, CHANNEL_KEYS, usePlayer, type ChannelKey } from '@/lib/player';

/** Deterministic fake listener counts so the tiles feel alive without a backend. */
const LISTENERS: Record<ChannelKey, number> = {
  pop: 12480,
  traditional: 3210,
  rap: 8940,
  nostalgia: 5620,
  chill: 7310,
  podcast: 2170,
};

export function Radio() {
  const { t, lang } = useLang();
  const { channel, playing, select } = usePlayer();
  const fmt = new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en-US');

  return (
    <section id="radio" className="relative mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-20 sm:px-5">
      <SectionHeading tag={t.radio.tag} title={t.radio.title} subtitle={t.radio.subtitle} />

      <ul className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 lg:gap-5">
        {CHANNEL_KEYS.map((key, i) => {
          const ch = t.radio.channels[key];
          const active = channel === key;
          const isPlaying = active && playing;
          return (
            <motion.li
              key={key}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: (i % 6) * 0.06, ease: [0.16, 1, 0.3, 1] }}
            >
              <button
                type="button"
                onClick={() => select(key)}
                aria-pressed={isPlaying}
                aria-label={`${isPlaying ? t.radio.pauseChannel : t.radio.playChannel}: ${ch.name}`}
                className={cn(
                  'group flex w-full flex-col items-stretch rounded-2xl border p-2 text-start transition-all duration-300',
                  active
                    ? 'border-[var(--primary)] bg-[color-mix(in_oklch,var(--primary)_10%,transparent)]'
                    : 'border-[var(--border)] bg-[color-mix(in_oklch,var(--foreground)_3%,transparent)] hover:border-[color-mix(in_oklch,var(--foreground)_25%,transparent)] hover:-translate-y-1',
                )}
              >
                {/* Gradient album art */}
                <span className="relative block aspect-square w-full overflow-hidden rounded-xl" style={{ background: CHANNEL_ART[key] }}>
                  <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_55%)]" />
                  <span className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(to_top,rgba(0,0,0,0.55),transparent)]" />
                  <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white backdrop-blur">
                    <span className={cn('h-1.5 w-1.5 rounded-full bg-red-400', isPlaying && 'animate-blink')} />
                    {t.radio.live}
                  </span>
                  <span className="absolute bottom-2 start-2">
                    <Equalizer active={isPlaying} bars={5} className="h-5 text-white" />
                  </span>
                  <span
                    className={cn(
                      'absolute bottom-2 end-2 grid h-10 w-10 place-items-center rounded-full bg-white text-[#120f18] shadow-lg transition-all duration-300',
                      isPlaying ? 'opacity-100' : 'opacity-0 translate-y-1 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100',
                    )}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" fill="currentColor" aria-hidden="true" /> : <Play className="ms-0.5 h-4 w-4" fill="currentColor" aria-hidden="true" />}
                  </span>
                </span>
                <span className="mt-3 block px-1 pb-1">
                  <span className="block truncate text-sm font-bold">{ch.name}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-[var(--muted-foreground)]">{ch.desc}</span>
                  <span className="mt-2 block text-[11px] font-semibold text-[var(--accent)]">
                    {fmt.format(LISTENERS[key])} {t.radio.listeners}
                  </span>
                </span>
              </button>
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
}
