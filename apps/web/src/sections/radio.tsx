import { RadioDial } from '@/components/radio-dial';
import { SectionHeading } from '@/components/section-heading';
import { cn } from '@/lib/utils';
import { useLang } from '@/i18n';
import { CHANNEL_ART, CHANNEL_KEYS, usePlayer } from '@/lib/player';

/**
 * Act 2 — "Stations": the dial. Six mood channels you can tune (the needle follows), presented
 * honestly as upcoming stations: no fake audio, no fake listener counts. Real sound lives in the
 * Deck right below.
 */
export function Radio() {
  const { t } = useLang();
  const { channel, selectChannel } = usePlayer();

  return (
    <section id="radio" className="relative mx-auto w-full max-w-6xl px-4 py-20 sm:px-5">
      <SectionHeading tag={t.radio.tag} title={t.radio.title} subtitle={t.radio.subtitle} />

      <div data-fx="rise" className="mt-10">
        <RadioDial />
      </div>

      <ul className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 lg:gap-5">
        {CHANNEL_KEYS.map((key) => {
          const ch = t.radio.channels[key];
          const active = channel === key;
          return (
            <li key={key} data-fx="rise">
              <button
                type="button"
                onClick={() => selectChannel(key)}
                aria-pressed={active}
                aria-label={`${t.radio.tune}: ${ch.name}`}
                className={cn(
                  'station-tile group flex h-full w-full flex-col items-stretch rounded-2xl border p-2 text-start transition-all duration-300',
                  active
                    ? 'is-active border-[var(--primary)] bg-[color-mix(in_oklch,var(--primary)_10%,transparent)]'
                    : 'border-[var(--border)] bg-[color-mix(in_oklch,var(--foreground)_3%,transparent)] hover:-translate-y-1 hover:border-[color-mix(in_oklch,var(--foreground)_25%,transparent)]',
                )}
              >
                {/* Gradient album art */}
                <span className="relative block aspect-square w-full overflow-hidden rounded-xl" style={{ background: CHANNEL_ART[key] }}>
                  <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_55%)]" />
                  <span className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(to_top,rgba(0,0,0,0.55),transparent)]" />
                  <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white backdrop-blur">
                    {t.radio.comingSoon}
                  </span>
                  <span
                    className={cn(
                      'absolute bottom-2 end-2 h-2.5 w-2.5 rounded-full border-2 border-white/80 transition-colors duration-300',
                      active ? 'bg-[var(--accent)]' : 'bg-transparent',
                    )}
                  />
                </span>
                <span className="mt-3 block px-1 pb-1">
                  <span className="block truncate text-sm font-bold">{ch.name}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-[var(--muted-foreground)]">{ch.desc}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
