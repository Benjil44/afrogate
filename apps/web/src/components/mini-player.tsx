import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pause, Play } from 'lucide-react';
import { Equalizer } from '@/components/equalizer';
import { useLang } from '@/i18n';
import { CHANNEL_ART, usePlayer } from '@/lib/player';

/** Music-app style bottom bar: appears once the demo is playing and the hero player is off screen. */
export function MiniPlayer() {
  const { t } = useLang();
  const { channel, playing, toggle } = usePlayer();
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    const onScroll = () => setPastHero(window.scrollY > window.innerHeight * 0.9);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const visible = playing && pastHero;
  const ch = t.radio.channels[channel];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-3 bottom-3 z-40 sm:inset-x-auto sm:start-5 sm:w-80"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--card)_85%,transparent)] p-2.5 shadow-2xl backdrop-blur-xl">
            <span className="h-11 w-11 shrink-0 rounded-xl" style={{ background: CHANNEL_ART[channel] }} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{t.hero.player.track}</span>
              <span className="block truncate text-xs text-[var(--muted-foreground)]">
                {t.hero.player.liveBadge} · {ch.name}
              </span>
            </span>
            <Equalizer active={playing} bars={4} className="h-4 text-[var(--primary)]" />
            <button
              type="button"
              aria-label={playing ? t.hero.player.pause : t.hero.player.play}
              aria-pressed={playing}
              onClick={toggle}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--secondary))] text-white"
            >
              {playing ? <Pause className="h-5 w-5" fill="currentColor" aria-hidden="true" /> : <Play className="ms-0.5 h-5 w-5" fill="currentColor" aria-hidden="true" />}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
