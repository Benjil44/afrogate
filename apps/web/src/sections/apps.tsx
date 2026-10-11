import { Apple, Globe, Smartphone, Play } from 'lucide-react';
import { Reveal } from '@/components/reveal';
import { SectionHeading } from '@/components/section-heading';
import { Equalizer } from '@/components/equalizer';
import { useLang } from '@/i18n';
import { CHANNEL_ART, usePlayer } from '@/lib/player';

/** Pure-CSS phone mock showing a library screen; no images, no QR, no store links. */
function PhoneMock() {
  const { t } = useLang();
  const { playing } = usePlayer();
  const rows = [
    { name: t.apps.phone.playlistA, art: CHANNEL_ART.pop, count: 42 },
    { name: t.apps.phone.playlistB, art: CHANNEL_ART.chill, count: 28 },
    { name: t.apps.phone.playlistC, art: CHANNEL_ART.rap, count: 35 },
  ];
  return (
    <div aria-hidden="true" className="relative mx-auto w-[240px] rounded-[2.4rem] border border-[var(--border)] bg-[var(--card)] p-2.5 shadow-2xl shadow-[color-mix(in_oklch,var(--secondary)_30%,transparent)] sm:w-[260px]">
      <div className="overflow-hidden rounded-[1.9rem] bg-[var(--background)]">
        <div className="mx-auto mt-2 h-1.5 w-20 rounded-full bg-[var(--muted)]" />
        <div className="px-4 pb-5 pt-5">
          <p className="text-sm font-black">{t.apps.phone.header}</p>
          <div className="mt-3 h-24 rounded-2xl p-3" style={{ background: CHANNEL_ART.nostalgia }}>
            <div className="flex h-full flex-col justify-between text-white">
              <Equalizer active={playing} bars={6} className="h-5" />
              <p className="text-xs font-bold drop-shadow">{t.hero.player.track}</p>
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
      </div>
    </div>
  );
}

export function Apps() {
  const { t } = useLang();
  const platforms = [
    { Icon: Globe, ...t.apps.web },
    { Icon: Smartphone, ...t.apps.android },
    { Icon: Apple, ...t.apps.ios },
  ];

  return (
    <section id="apps" className="relative mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-20 sm:px-5">
      <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--foreground)_2%,transparent)] px-6 py-12 sm:px-10 lg:px-14">
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
                <li key={name}>
                  <Reveal delay={i * 0.08} className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--background)_60%,transparent)] p-4 backdrop-blur-md">
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
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
          <Reveal delay={0.15} y={40}>
            <PhoneMock />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
