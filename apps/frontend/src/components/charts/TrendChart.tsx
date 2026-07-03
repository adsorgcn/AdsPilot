import dynamic from 'next/dynamic';
import type { Color } from '@tremor/react';
import { currencyFormatter } from '~/lib/tremor-chart-config';

interface TrendChartProps {
  data: Array<{
    date: string;
    [key: string]: string | number;
  }>;
  categories: string[];
  colors?: Color[];
  valueFormatter?: (value: number) => string;
  yAxisWidth?: number;
  showLegend?: boolean;
  showGridLines?: boolean;
  className?: string;
}

// 动态导入LineChart组件以减少初始bundle大小
const LineChart = dynamic(
  () => import('@tremor/react').then(mod => ({ default: mod.LineChart })),
  {
    loading: () => <div className="h-80 w-full animate-pulse bg-gray-200 rounded" />,
    ssr: false
  }
);

export function TrendChart({
  data,
  categories,
  colors = ['blue', 'purple', 'pink'],
  valueFormatter = currencyFormatter,
  yAxisWidth = 60,
  showLegend = true,
  showGridLines = true,
  className = 'h-80',
}: TrendChartProps) {
  return (
    <LineChart
      data={data}
      index="date"
      categories={categories}
      colors={colors}
      valueFormatter={valueFormatter}
      yAxisWidth={yAxisWidth}
      showLegend={showLegend}
      showGridLines={showGridLines}
      showAnimation={true}
      className={className}
    />
  );
}