import * as React from 'react';
import { cn } from '~/core/generic/shadcn-utils';

export interface SparklineProps extends React.HTMLAttributes<HTMLDivElement> {
  data: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  variant?: 'primary' | 'success' | 'warning' | 'error';
  showDots?: boolean;
  showArea?: boolean;
  animated?: boolean;
}

const variantMap = {
  primary: {
    stroke: 'stroke-blue-600 dark:stroke-blue-400',
    fill: 'fill-blue-500/20 dark:fill-blue-400/20',
    dot: 'fill-blue-600 dark:fill-blue-400',
  },
  success: {
    stroke: 'stroke-green-600 dark:stroke-green-400',
    fill: 'fill-green-500/20 dark:fill-green-400/20',
    dot: 'fill-green-600 dark:fill-green-400',
  },
  warning: {
    stroke: 'stroke-orange-600 dark:stroke-orange-400',
    fill: 'fill-orange-500/20 dark:fill-orange-400/20',
    dot: 'fill-orange-600 dark:fill-orange-400',
  },
  error: {
    stroke: 'stroke-red-600 dark:stroke-red-400',
    fill: 'fill-red-500/20 dark:fill-red-400/20',
    dot: 'fill-red-600 dark:fill-red-400',
  },
};

export function Sparkline({
  data,
  width = 100,
  height = 30,
  strokeWidth = 2,
  variant = 'primary',
  showDots = false,
  showArea = true,
  animated = true,
  className,
  ...props
}: SparklineProps) {
  if (!data || data.length === 0) {
    return null;
  }

  const colors = variantMap[variant];
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Generate points for the line
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return { x, y };
  });

  // Generate path for line
  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  // Generate path for area (if enabled)
  const areaPath = showArea
    ? `${linePath} L ${width} ${height} L 0 ${height} Z`
    : '';

  return (
    <div className={cn('inline-block', className)} {...props}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        {/* Area fill */}
        {showArea && (
          <path
            d={areaPath}
            className={cn(colors.fill, animated && 'transition-all duration-300')}
          />
        )}

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(colors.stroke, animated && 'transition-all duration-300')}
        />

        {/* Dots */}
        {showDots &&
          points.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={strokeWidth * 1.5}
              className={cn(colors.dot, animated && 'transition-all duration-300')}
            />
          ))}
      </svg>
    </div>
  );
}