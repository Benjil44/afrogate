import { Reveal } from '@/components/reveal';
import { CountUp } from '@/components/count-up';
import { useLang } from '@/i18n';

// Representative figures — edit as real telemetry becomes available.
const STATS = [
  { key: 'uptime', value: 99.9, decimals: 1, suffix: '%' },
  { key: 'ping', value: 18, decimals: 0, suffix: 'ms' },
  { key: 'jitter', value: 3, decimals: 0, suffix: 'ms' },
  { key: 'locations', value: 25, decimals: 0, suffix: '+' },
] as const;

export function Metrics() {
  const { t } = useLang();
  return (
    <section className="relative mx-auto w-full max-w-6xl px-5 py-16">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {STATS.map((s, i) => (
          <Reveal key={s.key} delay={i * 0.08}>
            <div className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--foreground)_3%,transparent)] p-6 text-center backdrop-blur-md">
              <div className="bg-[linear-gradient(135deg,var(--primary),var(--secondary))] bg-clip-text text-3xl font-black text-transparent md:text-4xl">
                <CountUp value={s.value} decimals={s.decimals} suffix={s.suffix} />
              </div>
              <div className="mt-2 text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                {t.metrics[s.key]}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
