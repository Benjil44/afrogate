import { useEffect, useRef } from 'react';
import { NUMBER_LOCALE, useLang } from '@/i18n';
import { CHANNEL_KEYS, usePlayer, type ChannelKey } from '@/lib/player';
import { useMotion } from '@/motion/provider';
import { DUR, EASE } from '@/motion/tokens';
import { useFx } from '@/motion/use-fx';
import { cn } from '@/lib/utils';

/** Decorative FM frequencies, one per station (digits are formatted per language). */
const FREQUENCIES = [88.1, 91.3, 94.6, 98.0, 101.7, 105.4];
const TICKS = 61;

/**
 * Tuner scale (motion spec §2.2): six labelled stops in DOM order (flex, so RTL mirrors for free)
 * and a glowing needle positioned from the active stop's physical `offsetLeft` — correct in both
 * directions, no sign needed. `compact` renders a non-interactive miniature for the phone mock.
 */
export function RadioDial({ compact = false }: { compact?: boolean }) {
  const { t, lang } = useLang();
  const { channel, selectChannel } = usePlayer();
  const { engine, tier } = useMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const needleRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const activeIndex = CHANNEL_KEYS.indexOf(channel);
  const fmt = new Intl.NumberFormat(NUMBER_LOCALE[lang], { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const activeX = () => {
    const root = rootRef.current;
    const needle = needleRef.current;
    const stop = root?.querySelectorAll<HTMLElement>('.dial-stop')[activeIndex];
    if (!root || !needle || !stop) return 0;
    return stop.offsetLeft + stop.offsetWidth / 2 - needle.offsetWidth / 2;
  };

  // Entrance: ticks draw from the centre, then the needle scans from the start edge to the station.
  useFx(rootRef, ({ gsap, dir, tier: fxTier }) => {
    if (compact) return;
    const root = rootRef.current!;
    const needle = needleRef.current!;
    const halo = haloRef.current!;
    const startX = dir === 'rtl' ? root.clientWidth - needle.offsetWidth : 0;
    const tl = gsap.timeline({ scrollTrigger: { trigger: root, start: 'top 70%', once: true } });
    tl.from('.dial-tick', { scaleY: 0, opacity: 0, duration: 0.5, ease: EASE.out, stagger: { each: 0.012, from: 'center' } })
      .fromTo(needle, { x: startX }, { x: activeX, duration: fxTier === 'full' ? DUR.sweep : 0.9, ease: EASE.inOut }, 0.2)
      .fromTo(halo, { opacity: 0.2 }, { opacity: 1, yoyo: true, repeat: 1, duration: (fxTier === 'full' ? DUR.sweep : 0.9) / 2, ease: 'sine.inOut' }, 0.2);
  });

  // Channel change / resize: snap the needle (GSAP only on a real channel change, instant otherwise).
  const prevIndex = useRef(activeIndex);
  useEffect(() => {
    const needle = needleRef.current;
    const halo = haloRef.current;
    if (!needle || !halo) return;
    const place = (animate: boolean) => {
      const x = activeX();
      if (animate && engine && tier !== 'static') {
        engine.gsap.to(needle, { x, duration: DUR.snap, ease: EASE.back, overwrite: 'auto' });
        engine.gsap.fromTo(halo, { opacity: 0.4 }, { opacity: 1, yoyo: true, repeat: 1, duration: 0.5, overwrite: 'auto' });
      } else {
        needle.style.transform = `translateX(${x}px)`;
      }
    };
    place(prevIndex.current !== activeIndex);
    prevIndex.current = activeIndex;
    const ro = new ResizeObserver(() => place(false));
    ro.observe(rootRef.current!);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, engine, tier, lang]);

  const Stop = compact ? 'span' : 'button';

  return (
    <div
      ref={rootRef}
      role={compact ? undefined : 'group'}
      aria-label={compact ? undefined : t.radio.dial}
      aria-hidden={compact || undefined}
      className={cn('dial relative w-full select-none', compact ? 'dial-compact' : 'mx-auto max-w-3xl')}
    >
      <svg className={cn('dial-scale block w-full', compact ? 'h-4' : 'h-7')} viewBox="0 0 600 28" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        {Array.from({ length: TICKS }, (_, i) => {
          const x = (i / (TICKS - 1)) * 600;
          const major = i % 10 === 0;
          return <line key={i} className="dial-tick" x1={x} x2={x} y1={major ? 4 : 14} y2={28} vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
      {/* Physical `left` on purpose: the needle is positioned from the active stop's offsetLeft in both directions. */}
      <div className="dial-needle pointer-events-none absolute w-11" ref={needleRef} style={{ left: 0 }}>
        <div ref={haloRef} className="dial-halo absolute inset-x-0 top-0 mx-auto h-full w-11" />
        <div className="dial-pin absolute inset-y-0 start-1/2 w-0.5 -translate-x-1/2" />
      </div>
      <div className={cn('dial-stops flex items-stretch justify-between', compact ? 'mt-1' : 'mt-2')}>
        {CHANNEL_KEYS.map((key: ChannelKey, i) => {
          const active = key === channel;
          const label = fmt.format(FREQUENCIES[i]);
          return (
            <Stop
              key={key}
              type={compact ? undefined : 'button'}
              onClick={compact ? undefined : () => selectChannel(key)}
              aria-pressed={compact ? undefined : active}
              aria-label={compact ? undefined : `${t.radio.tune}: ${t.radio.channels[key].name}`}
              className={cn(
                'dial-stop flex flex-col items-center justify-center rounded-xl font-bold tabular-nums transition-colors',
                compact ? 'min-h-4 px-0.5 text-[8px]' : 'min-h-11 min-w-11 px-1.5 text-xs sm:text-sm',
                active ? 'text-[var(--accent)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
              )}
            >
              <bdi>{label}</bdi>
              {!compact && <span className="mt-0.5 hidden text-[10px] font-semibold sm:block">{t.radio.channels[key].name}</span>}
            </Stop>
          );
        })}
      </div>
    </div>
  );
}
