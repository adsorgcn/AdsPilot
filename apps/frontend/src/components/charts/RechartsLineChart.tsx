'use client';

import * as React from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { cn } from '~/core/generic/shadcn-utils';

export interface RechartsLineChartProps {
  data: Array<Record<string, any>>;
  xKey: string;
  yKeys: Array<{
    key: string;
    name: string;
    color: string;
  }>;
  height?: number;
  showArea?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
  className?: string;
  loading?: boolean;
}

export function RechartsLineChart({
  data,
  xKey,
  yKeys,
  height = 300,
  showArea = true,
  showGrid = true,
  showLegend = true,
  className,
  loading = false,
}: RechartsLineChartProps) {
  if (loading) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height }}>
        <div className="space-y-3 w-full">
          <div className="h-8 w-full animate-pulse rounded bg-muted" />
          <div className="h-48 w-full animate-pulse rounded bg-muted" />
        </div>
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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-border bg-card/95 backdrop-blur-sm p-3 shadow-lg">
          <p className="text-sm font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-semibold">{entry.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const ChartComponent = showArea ? AreaChart : LineChart;

  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height={height}>
        <ChartComponent data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
          )}
          <XAxis
            dataKey={xKey}
            className="text-xs text-muted-foreground"
            stroke="currentColor"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            className="text-xs text-muted-foreground"
            stroke="currentColor"
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => value.toLocaleString()}
          />
          <Tooltip content={<CustomTooltip />} />
          {showLegend && (
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="circle"
              formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
            />
          )}
          {yKeys.map((yKey) => {
            if (showArea) {
              return (
                <Area
                  key={yKey.key}
                  type="monotone"
                  dataKey={yKey.key}
                  name={yKey.name}
                  stroke={yKey.color}
                  fill={yKey.color}
                  fillOpacity={0.2}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2 }}
                />
              );
            }
            return (
              <Line
                key={yKey.key}
                type="monotone"
                dataKey={yKey.key}
                name={yKey.name}
                stroke={yKey.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2 }}
              />
            );
          })}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}