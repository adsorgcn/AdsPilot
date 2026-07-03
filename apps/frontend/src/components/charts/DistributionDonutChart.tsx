import { DonutChart } from '@tremor/react';
import type { Color } from '@tremor/react';
import { percentageFormatter } from '~/lib/tremor-chart-config';

interface DistributionDonutChartProps {
  data: Array<{
    name: string;
    value: number;
  }>;
  category?: string;
  colors?: Color[];
  valueFormatter?: (value: number) => string;
  showLabel?: boolean;
  showAnimation?: boolean;
  className?: string;
}

export function DistributionDonutChart({
  data,
  category = 'value',
  colors = ['blue', 'cyan', 'indigo', 'violet', 'purple'],
  valueFormatter = percentageFormatter,
  showLabel = true,
  showAnimation = true,
  className = 'h-64',
}: DistributionDonutChartProps) {
  return (
    <DonutChart
      data={data}
      category={category}
      index="name"
      colors={colors}
      valueFormatter={valueFormatter}
      showLabel={showLabel}
      showAnimation={showAnimation}
      className={className}
    />
  );
}