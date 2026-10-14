import { useEffect, useRef, useState } from 'react';
import { Apple, Globe, Smartphone, Play } from 'lucide-react';
import { Equalizer } from '@/components/equalizer';
import { RadioDial } from '@/components/radio-dial';
import { SectionHeading } from '@/components/section-heading';
import { useLang } from '@/i18n';
import { CHANNEL_ART, CHANNEL_KEYS, trackArt, usePlayer, usePlayerProgress } from '@/lib/player';
import { useMotion } from '@/motion/provider';
import { EASE } from '@/motion/tokens';
import { useFx } from '@/motion/use-fx';
import { cn } from '@/lib/utils';

const SCREENS = 3;

/** Non-interactive progress line for the phone mock (the real seek bar lives in the deck / hero). */
function ProgressLine() {
  const { currentTime, duration } = usePlayerProgress();
  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  return (
    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/25">
      <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Pure-CSS phone mock with three screens: library, now playing, station dial. No images, no store links. */
function PhoneMock({ screen }: { screen: number }) {
  const { t } = useLang();
  const { playing, track, index } = usePlayer();
  const rows = [
    { name: t.apps.phone.playlistA, art: CHANNEL_ART.pop, count: 42 },
    { name: t.apps.phone.playlistB, art: CHANNEL_ART.chill, count: 28 },
    { name: t.apps.phone.playlistC, art: CHANNEL_ART.rap, count: 35 },
  ];
  const stations = CHANNEL_KEYS.slice(0, 3);

  return (
    <div aria-hidden="true" className="phone relative mx-auto w-[240px] rounded-[2.4rem] border border-[var(--border)] bg-[var(--card)] p-2.5 shadow-2xl shadow-[color-mix(in_oklch,var(--secondary)_30%,transparent)] sm:w-[260px]">
      <div className="overflow-hidden rounded-[1.9rem] bg-[var(--background)]">
        <div className="mx-auto mt-2 h-1.5 w-20 rounded-full bg-[var(--muted)]" />
        <div className="phone-screens relative h-[300px]">
          {/* 1 — library */}
          <div className={cn('phone-screen px-4 pb-5 pt-5', screen === 0 && 'is-on')}>
            <p className="text-sm font-black">{t.apps.phone.header}</p>
            <div className="mt-3 h-24 rounded-2xl p-3" style={{ background: CHANNEL_ART.nostalgia }}>
              <div className="flex h-full flex-col justify-between text-white">
                <Equalizer active={playing} bars={6} className="h-5" />
                <p className="truncate text-xs font-bold drop-shadow">
                  <bdi>{track.title}</bdi>
                </p>
              </div>
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {rows.map((r) => (
                <li key={r.name} className="flex items-center gap-2.5 rounded-xl bg-[color-mix(in_oklch,var(--foreground)_4%,transparent)] p-2">
                  <span className="h-9 w-9 shrink-0 rounded-lg" style={{ background: r.art }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-bold">{r.name}</span>
                    <span className="block text-[10px] text-[var(--muted-foreground)]">
                      {r.count} {t.apps.phone.trackCount}
                    </span>
                  </span>
                  <Play className="h-3.5 w-3.5 text-[var(--muted-foreground)]" fill="currentColor" />
                </li>
              ))}
            </ul>
          </div>

          {/* 2 — now playing */}
          <div className={cn('phone-screen px-4 pb-5 pt-5', screen === 1 && 'is-on')}>
            <p className="text-sm font-black">{t.hero.player.title}</p>
            <div className="mt-3 grid place-items-center">
              <div className="animate-spin-slow relative h-28 w-28 rounded-full shadow-lg" style={{ background: trackArt(index) }}>
                <div className="absolute inset-[36%] rounded-full bg-[var(--background)]" />
              </div>
            </div>
            <div className="mt-4 rounded-2xl p-3 text-white" style={{ background: trackArt(index) }}>
              <p className="truncate text-xs font-bold">
                <bdi>{track.title}</bdi>
              </p>
              <p className="truncate text-[10px] opacity-85">
                <bdi>{track.artist}</bdi>
              </p>
              <ProgressLine />
            </div>
            <div className="mt-3 flex items-center justify-center gap-3">
              <span className="h-7 w-7 rounded-full bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)]" />
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--secondary))] text-white">
                <Equalizer active={playing} bars={4} className="h-3.5" />
              </span>
              <span className="h-7 w-7 rounded-full bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)]" />
            </div>
          </div>

          {/* 3 — station dial */}
          <div className={cn('phone-screen px-4 pb-5 pt-5', screen === 2 && 'is-on')}>
            <p className="text-sm font-black">{t.radio.tag}</p>
            <div className="mt-3 rounded-2xl bg-[color-mix(in_oklch,var(--foreground)_4%,transparent)] p-2.5">
              <RadioDial compact />
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {stations.map((key) => (
                <li key={key} className="flex items-center gap-2.5 rounded-xl bg-[color-mix(in_oklch,var(--foreground)_4%,transparent)] p-2">
                  <span className="h-9 w-9 shrink-0 rounded-lg" style={{ background: CHANNEL_ART[key] }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-bold">{t.radio.channels[key].name}</span>
                    <span className="block truncate text-[10px] text-[var(--muted-foreground)]">{t.radio.channels[key].desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Act 4 — "Receivers". `full`: the card is pinned and the phone tilts in while its three screens
 * and the platform rows advance with the scroll. `lite`: no pin, screens auto-cycle while the
 * phone is in view. `static`: screen 1 only, rows neutral.
 */
export function Apps() {
  const { t } = useLang();
  const { tier } = useMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const [screen, setScreen] = useState(0);
  const platforms = [
    { Icon: Globe, ...t.apps.web },
    { Icon: Smartphone, ...t.apps.android },
    { Icon: Apple, ...t.apps.ios },
  ];

  // lite: timer-driven screen cycle, only while the phone is at least half visible.
  useEffect(() => {
    const phone = phoneRef.current;
    if (tier !== 'lite' || !phone) {
      setScreen(0);
      return;
    }
    let timer = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        window.clearInterval(timer);
        timer = entry.isIntersecting ? window.setInterval(() => setScreen((s) => (s + 1) % SCREENS), 3200) : 0;
      },
      { threshold: 0.5 },
    );
    io.observe(phone);
    return () => {
      io.disconnect();
      window.clearInterval(timer);
    };
  }, [tier]);

  // full: pinned, scrubbed phone story.
  useFx(sectionRef, ({ gsap, tier: fxTier, sign, scrub }) => {
    if (fxTier !== 'full') return;
    const card = cardRef.current!;
    const phone = phoneRef.current!;
    const screens = Array.from(card.querySelectorAll<HTMLElement>('.phone-screen'));
    const rows = Array.from(card.querySelectorAll<HTMLElement>('.app-row'));
    gsap.set(screens.slice(1), { opacity: 0, yPercent: 6 });
    gsap.set(rows[0], { '--row-lit': 1 });
    const tl = gsap.timeline({
      scrollTrigger: { trigger: card, start: 'top 12%', end: '+=140%', pin: true, pinSpacing: true, anticipatePin: 1, scrub, invalidateOnRefresh: true },
    });
    tl.fromTo(phone, { rotateY: sign * -14, yPercent: 6 }, { rotateY: 0, yPercent: 0, ease: EASE.soft, duration: 0.3 }, 0);
    for (let i = 1; i < SCREENS; i++) {
      const at = 0.33 * i;
      tl.to(screens[i - 1], { opacity: 0, yPercent: -6, duration: 0.15 }, at)
        .fromTo(screens[i], { opacity: 0, yPercent: 6 }, { opacity: 1, yPercent: 0, duration: 0.15 }, at)
        .fromTo(rows[i - 1], { '--row-lit': 1 }, { '--row-lit': 0, duration: 0.1 }, at)
        .fromTo(rows[i], { '--row-lit': 0 }, { '--row-lit': 1, duration: 0.1 }, at);
    }
  });

  return (
    <section id="apps" ref={sectionRef} className="relative mx-auto w-full max-w-6xl px-4 py-20 sm:px-5">
      <div ref={cardRef} className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--foreground)_2%,transparent)] px-6 py-12 sm:px-10 lg:px-14">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 80% 20%, color-mix(in oklch, var(--secondary) 24%, transparent), transparent 55%), radial-gradient(circle at 10% 90%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 50%)',
          }}
        />
        <div className="relative grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading tag={t.apps.tag} title={t.apps.title} subtitle={t.apps.subtitle} />
            <ul className="mt-10 flex flex-col gap-3">
              {platforms.map(({ Icon, name, desc }, i) => (
                <li
                  key={name}
                  data-fx="rise"
                  className={cn(
                    'app-row relative flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--background)_60%,transparent)] p-4 backdrop-blur-md',
                    tier === 'lite' && screen === i && 'is-lit',
                  )}
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)] text-[var(--foreground)]">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{name}</span>
                    <span className="block text-xs leading-snug text-[var(--muted-foreground)]">{desc}</span>
                  </span>
                  <span className="shrink-0 rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] font-bold text-[var(--accent)]">
                    {t.apps.comingSoon}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="phone-stage" data-fx={tier === 'full' ? undefined : 'rise'} data-fx-y="40">
            <div ref={phoneRef}>
              <PhoneMock screen={screen} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
