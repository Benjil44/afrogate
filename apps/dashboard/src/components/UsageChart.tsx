import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { ClientUsageSeriesPoint } from '@afrows/shared';
import type { DashboardFormatters } from '../formatters';

export type UsageChartGranularity = 'hour' | 'day';

// Fixed chart geometry (px). The width is measured from the container so the
// SVG renders in crisp pixel coordinates instead of a distorted viewBox.
const PLOT_TOP = 6;
const PLOT_HEIGHT = 104;
const LABEL_BAND = 20;
const CHART_HEIGHT = PLOT_TOP + PLOT_HEIGHT + LABEL_BAND;
// Below this per-bucket width the chart scrolls inside its own container
// instead of squeezing bars into invisibility (mobile keeps no page overflow).
const MIN_BAR_STEP = 8;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

/** Measured content width of a block container (ResizeObserver-backed). */
function useMeasuredWidth(): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0);
      setWidth((current) => (current === next ? current : next));
    });
    observer.observe(element);
    setWidth(Math.round(element.clientWidth));
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

/**
 * Continuous time buckets ending "now": sparse rollup points (only buckets with
 * usage exist server-side) are placed on a fixed axis of `bucketCount` steps and
 * the gaps read as explicit zero usage.
 */
function fillBuckets(
  points: ClientUsageSeriesPoint[],
  granularity: UsageChartGranularity,
  bucketCount: number,
): ClientUsageSeriesPoint[] {
  const stepMs = granularity === 'hour' ? MS_PER_HOUR : MS_PER_DAY;
  const nowBucket = Math.floor(Date.now() / stepMs);
  const byBucket = new Map<number, number>();
  for (const point of points) {
    const timestamp = Date.parse(point.bucketStart);
    if (!Number.isFinite(timestamp)) continue;
    const key = Math.floor(timestamp / stepMs);
    byBucket.set(key, (byBucket.get(key) ?? 0) + Math.max(0, point.usedBytes));
  }
  const buckets: ClientUsageSeriesPoint[] = [];
  for (let key = nowBucket - bucketCount + 1; key <= nowBucket; key += 1) {
    buckets.push({ bucketStart: new Date(key * stepMs).toISOString(), usedBytes: byBucket.get(key) ?? 0 });
  }
  return buckets;
}

/** Baseline-anchored bar with rounded top corners only. */
function barPath(x: number, top: number, width: number, height: number): string {
  const radius = Math.min(2.5, width / 2, height);
  const bottom = PLOT_TOP + PLOT_HEIGHT;
  return [
    `M${x} ${bottom}`,
    `V${top + radius}`,
    `Q${x} ${top} ${x + radius} ${top}`,
    `H${x + width - radius}`,
    `Q${x + width} ${top} ${x + width} ${top + radius}`,
    `V${bottom}`,
    'Z',
  ].join(' ');
}

/**
 * Self-contained inline-SVG bar chart for time-bucketed byte usage.
 * No chart library, theme tokens via CSS variables, RTL-aware (time reads
 * right-to-left in Persian while numbers stay LTR), responsive: fills its
 * container and scrolls internally when buckets would drop below MIN_BAR_STEP.
 * Reusable beyond per-customer usage (per-node / per-reseller series later).
 */
export function UsageChart({
  bucketCount,
  emptyLabel,
  format,
  granularity,
  loading = false,
  loadingLabel,
  points,
  title,
}: {
  /** Fixed axis length (48 for hourly/48h, 30 for daily/30d). */
  bucketCount: number;
  emptyLabel: string;
  format: DashboardFormatters;
  granularity: UsageChartGranularity;
  loading?: boolean;
  loadingLabel?: string;
  points: ClientUsageSeriesPoint[];
  title: string;
}) {
  const [containerRef, containerWidth] = useMeasuredWidth();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const isRtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';

  const buckets = useMemo(() => fillBuckets(points, granularity, bucketCount), [points, granularity, bucketCount]);
  const total = useMemo(() => buckets.reduce((sum, bucket) => sum + bucket.usedBytes, 0), [buckets]);

  const bucketLabel = (point: ClientUsageSeriesPoint): string =>
    granularity === 'hour' ? format.chartTime(point.bucketStart) : format.chartDate(point.bucketStart);
  const tooltipLabel = (point: ClientUsageSeriesPoint): string =>
    granularity === 'hour' ? format.dateTime(new Date(point.bucketStart)) : format.chartDate(point.bucketStart);

  const count = buckets.length;
  const innerWidth = Math.max(containerWidth, count * MIN_BAR_STEP);
  const step = count > 0 ? innerWidth / count : innerWidth;
  const gap = Math.min(2, step * 0.25);
  const barWidth = Math.max(1, step - gap);
  const yMax = Math.max(1, ...buckets.map((bucket) => bucket.usedBytes));
  const yFor = (value: number): number => PLOT_TOP + PLOT_HEIGHT * (1 - value / yMax);
  // RTL mirrors the time axis: the newest bucket sits at the inline-start edge's
  // opposite side, so time still reads in the document's reading direction.
  const slotFor = (index: number): number => (isRtl ? count - 1 - index : index);

  // Sparse x tick labels (~5), aligned to bucket centers.
  const tickEvery = Math.max(1, Math.ceil(count / 5));
  const hovered = hoverIndex !== null ? buckets[hoverIndex] : null;
  const hoveredCenter = hoverIndex !== null ? slotFor(hoverIndex) * step + step / 2 : 0;
  const tooltipLeft = Math.min(Math.max(hoveredCenter, 56), Math.max(innerWidth - 56, 56));

  const header = (
    <div className="flex items-baseline justify-between gap-2">
      <span className="truncate text-[12px] font-bold text-afro-muted" title={title}>{title}</span>
      {!loading && total > 0 ? (
        <span className="whitespace-nowrap text-[12px] font-bold tabular-nums text-afro-ink">{format.bytes(total)}</span>
      ) : null}
    </div>
  );

  if (loading) {
    return (
      <div className="grid min-w-0 gap-1.5">
        {header}
        <div
          className="flex animate-pulse items-center justify-center rounded-md border border-dashed border-afro-line bg-afro-page text-[12px] text-afro-muted"
          role="status"
          style={{ height: CHART_HEIGHT }}
        >
          {loadingLabel ?? '…'}
        </div>
      </div>
    );
  }

  if (points.length === 0 || total <= 0) {
    return (
      <div className="grid min-w-0 gap-1.5">
        {header}
        <div
          className="flex items-center justify-center rounded-md border border-dashed border-afro-line bg-afro-page px-3 text-center text-[12px] text-afro-muted"
          role="status"
          style={{ height: CHART_HEIGHT }}
        >
          {emptyLabel}
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-1.5">
      {header}
      {/* overflow-y-clip keeps this wrapper horizontal-scroll-only (see DataTable). */}
      <div className="overflow-x-auto overflow-y-clip" ref={containerRef}>
        <div className="relative" style={{ minWidth: `${count * MIN_BAR_STEP}px` }}>
          <svg
            aria-label={`${title} — ${format.bytes(total)}`}
            className="block"
            height={CHART_HEIGHT}
            onMouseLeave={() => setHoverIndex(null)}
            role="img"
            width={innerWidth}
          >
            {/* Recessive gridlines: top (max), middle, baseline. */}
            {[yMax, yMax / 2, 0].map((value) => (
              <line
                key={value}
                stroke="var(--color-afro-line)"
                strokeWidth={1}
                x1={0}
                x2={innerWidth}
                y1={yFor(value)}
                y2={yFor(value)}
              />
            ))}
            {/* Bars (zero buckets draw nothing — the baseline reads as zero). */}
            {buckets.map((bucket, index) => {
              if (bucket.usedBytes <= 0) return null;
              const height = Math.max(2, PLOT_HEIGHT * (bucket.usedBytes / yMax));
              const x = slotFor(index) * step + (step - barWidth) / 2;
              return (
                <path
                  d={barPath(x, PLOT_TOP + PLOT_HEIGHT - height, barWidth, height)}
                  fill="var(--color-afro-teal)"
                  fillOpacity={hoverIndex === index ? 1 : 0.85}
                  key={bucket.bucketStart}
                />
              );
            })}
            {/* Y labels sit just below their gridline (the max line is at the very
                top edge, so labels above it would clip). Painted after the bars with
                a panel-colored halo so tall bars can't swallow them; digits render
                LTR either way. */}
            {[yMax, yMax / 2].map((value) => (
              <text
                fill="var(--color-afro-muted)"
                fontSize={10}
                key={`label-${value}`}
                paintOrder="stroke"
                stroke="var(--color-afro-panel)"
                strokeWidth={3}
                textAnchor={isRtl ? 'end' : 'start'}
                x={isRtl ? innerWidth - 2 : 2}
                y={yFor(value) + 10}
              >
                {format.bytes(value)}
              </text>
            ))}
            {/* Sparse time ticks; edge-clipped centers are skipped so labels never
                get cut off at either end of the plot. */}
            {buckets.map((bucket, index) => {
              if (index % tickEvery !== 0) return null;
              const center = slotFor(index) * step + step / 2;
              if (center < 18 || center > innerWidth - 18) return null;
              return (
                <text
                  fill="var(--color-afro-muted)"
                  fontSize={10}
                  key={`tick-${bucket.bucketStart}`}
                  textAnchor="middle"
                  x={center}
                  y={PLOT_TOP + PLOT_HEIGHT + 14}
                >
                  {bucketLabel(bucket)}
                </text>
              );
            })}
            {/* Full-height hover targets — much larger than the marks themselves. */}
            {buckets.map((bucket, index) => (
              <rect
                fill="transparent"
                height={PLOT_TOP + PLOT_HEIGHT}
                key={`hit-${bucket.bucketStart}`}
                onFocus={() => setHoverIndex(index)}
                onMouseEnter={() => setHoverIndex(index)}
                width={step}
                x={slotFor(index) * step}
                y={0}
              >
                <title>{`${tooltipLabel(bucket)} — ${format.bytes(bucket.usedBytes)}`}</title>
              </rect>
            ))}
          </svg>
          {hovered ? (
            <div
              className="pointer-events-none absolute top-0.5 z-[1] -translate-x-1/2 rounded-md bg-afro-sidebar px-2 py-1 text-center text-[11px] leading-tight text-white shadow-md"
              style={{ left: tooltipLeft }}
            >
              <span className="block whitespace-nowrap opacity-80">{tooltipLabel(hovered)}</span>
              <strong className="block whitespace-nowrap tabular-nums">{format.bytes(hovered.usedBytes)}</strong>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
