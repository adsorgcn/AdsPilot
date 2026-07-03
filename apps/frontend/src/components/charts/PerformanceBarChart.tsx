import dynamic from 'next/dynamic';
import type { Color } from '@tremor/react';
import { numberFormatter } from '~/lib/tremor-chart-config';

interface PerformanceBarChartProps {
  data: Array<{
    name: string;
    [key: string]: string | number;
  }>;
  categories: string[];
  colors?: Color[];
  valueFormatter?: (value: number) => string;
  yAxisWidth?: number;
  showLegend?: boolean;
  layout?: 'vertical' | 'horizontal';
  className?: string;
}

// 动态导入BarChart组件以减少初始bundle大小
const BarChart = dynamic(
  () => import('@tremor/react').then(mod => ({ default: mod.BarChart })),
  {
    loading: () => <div className="h-72 w-full animate-pulse bg-gray-200 rounded" />,
    ssr: false
  }
);

export function PerformanceBarChart({
  data,
  categories,
  colors = ['blue', 'green'],
  valueFormatter = numberFormatter,
  yAxisWidth = 48,
  showLegend = true,
  layout = 'vertical',
  className = 'h-72',
}: PerformanceBarChartProps) {
  return (
    <BarChart
      data={data}
      index="name"
      categories={categories}
      colors={colors}
      valueFormatter={valueFormatter}
      yAxisWidth={yAxisWidth}
      showLegend={showLegend}
      showAnimation={true}
      layout={layout}
      className={className}
    />
  );
}