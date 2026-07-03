import * as React from 'react';
import { cn } from '~/core/generic/shadcn-utils';

export interface ProgressRingProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  strokeWidth?: number;
  showValue?: boolean;
  className?: string;
  color?: 'primary' | 'success' | 'warning' | 'error';
}

export function ProgressRing({
  value,
  max = 100,
  size = 'md',
  strokeWidth,
  showValue = true,
  className,
  color = 'primary',
}: ProgressRingProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const sizeMap = {
    sm: { dimension: 60, stroke: strokeWidth || 4, fontSize: 'text-xs' },
    md: { dimension: 80, stroke: strokeWidth || 6, fontSize: 'text-sm' },
    lg: { dimension: 120, stroke: strokeWidth || 8, fontSize: 'text-base' },
    xl: { dimension: 160, stroke: strokeWidth || 10, fontSize: 'text-lg' },
  };

  const { dimension, stroke, fontSize } = sizeMap[size];
  const radius = (dimension - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  const colorMap = {
    primary: 'from-blue-500 to-purple-500',
    success: 'from-green-500 to-emerald-500',
    warning: 'from-orange-500 to-yellow-500',
    error: 'from-red-500 to-pink-500',
  };

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={dimension} height={dimension} className="transform -rotate-90">
        <defs>
          <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" className="text-blue-500" stopColor="currentColor" />
            <stop offset="100%" className="text-purple-500" stopColor="currentColor" />
          </linearGradient>
        </defs>
        {/* Background circle */}
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="none"
          className="text-gray-200"
        />
        {/* Progress circle */}
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          stroke={`url(#gradient-${color})`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('font-bold', fontSize)}>
            {Math.round(percentage)}%
          </span>
        </div>
      )}
    </div>
  );
}