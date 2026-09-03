import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import { fetchAdminOperationsThroughput } from '../api/admin';
import type { DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { mutedTextClass, panelClass } from '../ui-classes';
import { EChart, type AfroChartOption } from './EChart';
import { PanelHeading } from './primitives';

const DOWNLOAD_COLOR = '#16a34a'; // green
const UPLOAD_COLOR = '#dc2626'; // red
const MAX_POINTS = 40; // ~2 min at a 3s cadence
const POLL_MS = 3000;

interface Sample {
  ts: number;
  downloadBps: number;
  uploadBps: number;
}

/**
 * Real-time traffic panel: a live ECharts area chart of total throughput —
 * Download (green) and Upload (red) — with the current speeds and the number of
 * clients online. Self-polls the light /operations-throughput endpoint (its own
 * server-side sample state, so it does not perturb the 10s overview numbers).
 */
export function LiveThroughputPanel({
  sessionToken,
  activeUsers,
  format,
  t,
}: {
  sessionToken: string;
  activeUsers: number | undefined;
  format: DashboardFormatters;
  t: DashboardStrings;
}) {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [available, setAvailable] = useState(true);
  const primedRef = useRef(false);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    const controller = new AbortController();

    const tick = async () => {
      try {
        const r = await fetchAdminOperationsThroughput(sessionToken, controller.signal);
        if (!active) return;
        setAvailable(r.available);
        // Skip the first sample (bps is 0 until the endpoint has a prior reading).
        if (!primedRef.current) {
          primedRef.current = true;
        } else if (r.available) {
          setSamples((prev) => {
            const next = [...prev, { ts: r.ts, downloadBps: r.downloadBps, uploadBps: r.uploadBps }];
            return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next;
          });
        }
      } catch {
        /* keep last; transient */
      } finally {
        if (active) timer = window.setTimeout(() => void tick(), POLL_MS);
      }
    };
    void tick();
    return () => {
      active = false;
      controller.abort();
      if (timer) window.clearTimeout(timer);
    };
  }, [sessionToken]);

  const latest = samples.length ? samples[samples.length - 1] : null;

  const option = useMemo<AfroChartOption>(() => {
    const labels = samples.map((s) =>
      new Date(s.ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    );
    return {
      animation: false,
      grid: { left: 56, right: 14, top: 30, bottom: 26 },
      legend: {
        data: [t.liveTraffic.download, t.liveTraffic.upload],
        top: 0,
        itemWidth: 14,
        itemHeight: 8,
        textStyle: { fontSize: 12 },
      },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (v) => format.bytesPerSecond(Number(v) || 0),
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: labels,
        axisLabel: { fontSize: 10, hideOverlap: true },
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, formatter: (v: number) => format.bytesPerSecond(v) },
        splitLine: { lineStyle: { opacity: 0.35 } },
      },
      series: [
        {
          name: t.liveTraffic.download,
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { color: DOWNLOAD_COLOR, width: 2 },
          itemStyle: { color: DOWNLOAD_COLOR },
          areaStyle: { color: DOWNLOAD_COLOR, opacity: 0.16 },
          data: samples.map((s) => Math.round(s.downloadBps)),
        },
        {
          name: t.liveTraffic.upload,
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { color: UPLOAD_COLOR, width: 2 },
          itemStyle: { color: UPLOAD_COLOR },
          areaStyle: { color: UPLOAD_COLOR, opacity: 0.14 },
          data: samples.map((s) => Math.round(s.uploadBps)),
        },
      ],
    };
  }, [samples, t, format]);

  return (
    <section className={panelClass}>
      <PanelHeading title={t.liveTraffic.title} icon={Activity} meta={t.liveTraffic.subtitle} />

      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <Stat label={t.liveTraffic.clientsOnline} value={format.integer(activeUsers ?? 0)} />
        <Stat
          label={t.liveTraffic.download}
          value={format.bytesPerSecond(latest?.downloadBps ?? 0)}
          color={DOWNLOAD_COLOR}
        />
        <Stat
          label={t.liveTraffic.upload}
          value={format.bytesPerSecond(latest?.uploadBps ?? 0)}
          color={UPLOAD_COLOR}
        />
      </div>

      <div className="mt-2">
        {available ? (
          <EChart ariaLabel={t.liveTraffic.title} className="h-48 w-full" option={option} />
        ) : (
          <p className={`${mutedTextClass} py-8 text-center text-[13px]`}>{t.liveTraffic.unavailable}</p>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-md border border-afro-line px-2 py-1.5">
      <div className={`${mutedTextClass} truncate text-[11px]`}>{label}</div>
      <div className="text-[15px] font-bold leading-tight" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}
