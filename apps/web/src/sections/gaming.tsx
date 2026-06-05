import { motion } from 'framer-motion';
import { Gamepad2, Check, Activity } from 'lucide-react';
import { Reveal } from '@/components/reveal';
import { Button } from '@/components/ui/button';
import { useLang, APP_URL } from '@/i18n';

const TYPICAL_PATH = 'M0,92 L36,28 L72,78 L108,18 L144,72 L180,34 L216,84 L252,22 L288,76 L324,40 L360,70 L400,30';
const AFROWS_PATH = 'M0,104 L80,101 L160,106 L240,100 L320,105 L400,102';

function LatencyGraph() {
  return (
    <svg viewBox="0 0 400 120" className="h-40 w-full" preserveAspectRatio="none">
      {[24, 60, 96].map((y) => (
        <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="color-mix(in oklch, var(--foreground) 7%, transparent)" strokeWidth="1" />
      ))}
      <motion.path
        d={TYPICAL_PATH}
        fill="none"
        stroke="#f59e0b"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 0.85 }}
        viewport={{ once: true }}
        transition={{ duration: 1.6, ease: 'easeInOut' }}
      />
      <motion.path
        d={AFROWS_PATH}
        fill="none"
        stroke="#34d399"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: 'drop-shadow(0 0 6px #34d39988)' }}
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.6, ease: 'easeInOut', delay: 0.3 }}
      />
    </svg>
  );
}

function Bar({ label, value, width, color, delay }: { label: string; value: string; width: string; color: string; delay: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
        <span className="text-[var(--muted-foreground)]">{label}</span>
        <span style={{ color }}>{value}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color, boxShadow: `0 0 12px ${color}66` }}
          initial={{ width: 0 }}
          whileInView={{ width }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay }}
        />
      </div>
    </div>
  );
}

export function Gaming() {
  const { t } = useLang();
  const g = t.gaming;
  const stats = [
    { value: '18', unit: g.unit, label: g.statPing, color: '#34d399' },
    { value: '3', unit: g.unit, label: g.statJitter, color: '#34d399' },
    { value: '-85%', unit: '', label: g.statLoss, color: '#34d399' },
  ];

  return (
    <section id="gaming" className="relative mx-auto w-full max-w-6xl scroll-mt-24 px-5 py-20">
      <Reveal>
        <div
          className="relative overflow-hidden rounded-3xl border border-emerald-500/25 p-8 md:p-12"
          style={{ background: 'radial-gradient(120% 100% at 0% 0%, color-mix(in oklch, #10b981 14%, transparent), transparent 55%), color-mix(in oklch, var(--foreground) 3%, transparent)' }}
        >
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
            {/* Left: copy */}
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300">
                <Gamepad2 className="h-3.5 w-3.5" />
                {g.tag}
              </span>
              <h2 className="mt-5 text-3xl font-black tracking-tight md:text-5xl">{g.title}</h2>
              <p className="mt-4 max-w-md text-[var(--muted-foreground)]">{g.subtitle}</p>

              <ul className="mt-6 flex flex-col gap-3">
                {g.perks.map((p) => (
                  <li key={p} className="flex items-center gap-2.5 text-sm text-[var(--foreground)]">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500/20 text-emerald-300">
                      <Check className="h-3 w-3" />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>

              <Button as="a" href={APP_URL} size="lg" className="mt-8 border-0 bg-[linear-gradient(135deg,#10b981,#22d3ee)] text-[#04140d]">
                {g.cta}
              </Button>
            </div>

            {/* Right: animated dashboard */}
            <div className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--background)_60%,transparent)] p-6 backdrop-blur-md">
              <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                <Activity className="h-4 w-4 text-emerald-400" />
                Live latency
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
                  <span className="animate-blink h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {g.improvement}
                </span>
              </div>

              <LatencyGraph />

              <div className="mt-5 flex flex-col gap-4">
                <Bar label={g.withoutLabel} value={`120 ${g.unit}`} width="100%" color="#f59e0b" delay={0.1} />
                <Bar label={g.withLabel} value={`18 ${g.unit}`} width="22%" color="#34d399" delay={0.4} />
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--foreground)_3%,transparent)] p-3 text-center">
                    <div className="text-xl font-black" style={{ color: s.color }}>
                      {s.value}
                      <span className="text-xs font-semibold">{s.unit}</span>
                    </div>
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
