import type { MetricsTimeRange, ServerMetricTimeseries } from '@afrogate/shared';
import type { AfroChartOption } from './components/EChart';
import type { ServerRowData } from './dashboard-types';
import { clamp, type DashboardFormatters } from './formatters';
import type { DashboardStrings } from './i18n';

export function createHealthChartOption(
  series: ServerMetricTimeseries[],
  t: DashboardStrings,
  format: DashboardFormatters,
): AfroChartOption {
  const chartSeries = series.map((item, index) => ({
    name: format.label(item.hostname || item.serverId),
    type: 'line' as const,
    showSymbol: false,
    smooth: true,
    sampling: 'lttb' as const,
    lineStyle: {
      width: 2,
    },
    markLine: index === 0
      ? {
          silent: true,
          symbol: 'none',
          label: {
            color: '#9a5b00',
            formatter: t.chart.watch,
          },
          lineStyle: {
            color: '#c27a1a',
            type: 'dashed' as const,
            width: 1,
          },
          data: [{ yAxis: 60 }],
        }
      : undefined,
    data: item.points.map((point) => [point.observedAt, point.healthScore]),
  }));

  return {
    color: ['#238a4b', '#2764a8', '#c27a1a', '#0f8f83', '#b91c1c'],
    textStyle: {
      fontFamily: format.fontFamily,
    },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value) => format.integer(Math.round(Number(value))),
    },
    legend: {
      top: 0,
      type: 'scroll',
      icon: 'roundRect',
      itemHeight: 8,
      itemWidth: 18,
      textStyle: {
        color: '#60717a',
        fontFamily: format.fontFamily,
      },
    },
    grid: {
      bottom: 24,
      containLabel: true,
      left: 6,
      right: 8,
      top: 36,
    },
    xAxis: {
      type: 'time',
      axisLine: {
        lineStyle: { color: '#dce4e8' },
      },
      axisLabel: {
        color: '#60717a',
        formatter: (value: string | number) => format.chartTime(value),
        hideOverlap: true,
        margin: 8,
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      splitNumber: 4,
      axisLabel: {
        color: '#60717a',
        formatter: (value: string | number) => format.integer(Number(value)),
        margin: 6,
      },
      splitLine: {
        lineStyle: { color: '#edf2f4' },
      },
    },
    dataZoom: [
      {
        type: 'inside',
        throttle: 50,
      },
    ],
    series: chartSeries,
  };
}

export function createDonutChartOption(
  rows: Array<{ color: string; name: string; value: number }>,
  format: DashboardFormatters,
): AfroChartOption {
  const data = rows.filter((row) => row.value > 0);
  const effectiveData = data.length > 0
    ? data
    : [{ color: '#dce4e8', name: '-', value: 1 }];

  return {
    color: effectiveData.map((row) => row.color),
    textStyle: {
      fontFamily: format.fontFamily,
    },
    tooltip: {
      trigger: 'item',
      valueFormatter: (value) => format.integer(Number(value)),
    },
    series: [
      {
        type: 'pie',
        radius: ['58%', '82%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        label: {
          show: false,
        },
        labelLine: {
          show: false,
        },
        data: effectiveData.map((row) => ({
          name: row.name,
          value: row.value,
        })),
      },
    ],
  };
}

export function createFallbackTimeseries(
  servers: ServerRowData[],
  range: MetricsTimeRange,
): ServerMetricTimeseries[] {
  const rangeMinutes = {
    '15m': 15,
    '1h': 60,
    '6h': 360,
    '24h': 1440,
  }[range];
  const pointCount = Math.min(48, Math.max(8, Math.round(rangeMinutes / 5)));
  const now = Date.now();
  const stepMs = (rangeMinutes * 60 * 1000) / Math.max(1, pointCount - 1);

  return servers.map((server, serverIndex) => ({
    serverId: server.id,
    hostname: server.name,
    platform: server.meta,
    points: Array.from({ length: pointCount }, (_, pointIndex) => {
      const wave = Math.sin((pointIndex + serverIndex) / 2.4) * 4;
      const drift = pointIndex % 7 === 0 ? -2 : 1;

      return {
        observedAt: new Date(now - (pointCount - pointIndex - 1) * stepMs).toISOString(),
        cpuPercent: server.cpu,
        ramPercent: server.ram,
        diskFreePercent: server.diskFree,
        healthScore: Math.round(clamp(server.score + wave + drift, 0, 100)),
      };
    }),
  }));
}
