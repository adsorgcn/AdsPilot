'use client';

import * as React from 'react';
import { RadarChart as RechartsRadar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '~/core/generic/shadcn-utils';

export interface RadarChartProps {
  data: Array<{
    subject: string;
    value: number;
    fullMark: number;
  }>;
  height?: number;
  color?: string;
  className?: string;
  loading?: boolean;
}

export function RadarChart({
  data,
  height = 300,
  color = '#3b82f6',
  className,
  loading = false,
}: RadarChartProps) {
  if (loading) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height }}>
        <div className="h-full w-full animate-pulse rounded-full bg-muted" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center text-muted-foreground', className)} style={{ height }}>
        No data available
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border border-border bg-card/95 backdrop-blur-sm p-3 shadow-lg">
          <p className="text-sm font-medium mb-1">{data.subject}</p>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Score:</span>
            <span className="font-semibold">{data.value}</span>
            <span className="text-muted-foreground">/ {data.fullMark}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsRadar data={data}>
          <PolarGrid className="stroke-muted" opacity={0.3} />
          <PolarAngleAxis
            dataKey="subject"
            className="text-xs text-muted-foreground"
            tick={{ fill: 'currentColor' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 10]}
            className="text-xs text-muted-foreground"
            tick={{ fill: 'currentColor' }}
          />
          <Radar
            name="Score"
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.3}
            strokeWidth={2}
          />
          <Tooltip content={<CustomTooltip />} />
        </RechartsRadar>
      </ResponsiveContainer>
    </div>
  );
}