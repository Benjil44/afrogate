import { useEffect, useRef } from 'react';
import { LineChart, type LineSeriesOption } from 'echarts/charts';
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  type DataZoomComponentOption,
  type GridComponentOption,
  type LegendComponentOption,
  type TooltipComponentOption,
} from 'echarts/components';
import { init, use, type ComposeOption, type ECharts as EChartsInstance } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

use([
  CanvasRenderer,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  LineChart,
  MarkLineComponent,
  TooltipComponent,
]);

export type AfroChartOption = ComposeOption<
  | DataZoomComponentOption
  | GridComponentOption
  | LegendComponentOption
  | LineSeriesOption
  | TooltipComponentOption
>;

export function EChart({
  option,
  className,
  ariaLabel,
}: {
  option: AfroChartOption;
  className?: string;
  ariaLabel: string;
}) {
  const chartElementRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsInstance | null>(null);

  useEffect(() => {
    const element = chartElementRef.current;
    if (!element) return;

    const chart = init(element, null, { renderer: 'canvas' });
    chartRef.current = chart;

    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, {
      lazyUpdate: true,
      notMerge: true,
    });
  }, [option]);

  return <div aria-label={ariaLabel} className={className} ref={chartElementRef} role="img" />;
}
