import { useMotionTier } from '@/motion/provider';
import { useLang } from '@/i18n';

/**
 * Hero waveform strip (motion spec §3.4): N bars, pure SVG + CSS, no deps, no per-bar state.
 *  - `--amp`   0.03 (flat line) -> 1 (lit); scales every bar through `--env` and `--beat-mult`.
 *  - `--kindle` 0 -> 1 sweeps the ember layer from the inline-start edge (right in Persian).
 * Both custom properties live on the strip wrapper; the hero toggles `.signal-locked` and CSS
 * transitions (registered `@property`) do the kindling, so the first paint needs no engine.
 */
const MAX_HEIGHT = 180;

function envelope(i: number) {
  return (0.25 + 0.75 * Math.abs(Math.sin(i * 0.37) * Math.sin(i * 1.9 + 0.6))).toFixed(3);
}

/** Analyser band per bar: low bands in the centre, highs at the edges (classic spectrum silhouette). */
function band(i: number, count: number) {
  return Math.min(7, Math.floor((Math.abs(i - (count - 1) / 2) / (count / 2)) * 8));
}

function Bars({ count, width, className }: { count: number; width: number; className?: string }) {
  const gap = (1000 - count * width) / count;
  return (
    <g className={className}>
      {Array.from({ length: count }, (_, i) => (
        <rect
          key={i}
          className={`wave-bar b${band(i, count)}`}
          x={(gap / 2 + i * (width + gap)).toFixed(2)}
          y={100 - MAX_HEIGHT / 2}
          width={width}
          height={MAX_HEIGHT}
          rx={width / 2}
          style={{ '--i': i, '--env': envelope(i) } as React.CSSProperties}
        />
      ))}
    </g>
  );
}

export function Waveform() {
  const tier = useMotionTier();
  const { dir } = useLang();
  const full = tier === 'full';
  const count = full ? 64 : 40;
  const width = full ? 6 : 10;

  return (
    <div className="wave-strip" aria-hidden="true">
      {/* lite/static halo: one pre-blurred gradient whose opacity follows --kindle */}
      {!full && <div className="wave-halo" />}
      <svg className="waveform" viewBox="0 0 1000 200" preserveAspectRatio="none" focusable="false">
        <defs>
          <linearGradient id="wave-grad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="var(--wave-dim)" />
            <stop offset="0.5" stopColor="var(--primary)" />
            <stop offset="0.85" stopColor="var(--accent)" />
            <stop offset="1" stopColor="var(--glow)" />
          </linearGradient>
          <clipPath id="wave-kindle">
            <rect className="wave-clip" x="0" y="0" width="1000" height="200" style={{ transformOrigin: dir === 'rtl' ? '100% 50%' : '0% 50%' }} />
          </clipPath>
        </defs>
        {full && <Bars count={count} width={width} className="wave-glow" />}
        <Bars count={count} width={width} className="wave-bars" />
        <g clipPath="url(#wave-kindle)">
          <Bars count={count} width={width} className="wave-ember" />
        </g>
      </svg>
    </div>
  );
}
