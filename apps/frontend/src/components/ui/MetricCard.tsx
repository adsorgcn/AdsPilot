import * as React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '~/core/generic/shadcn-utils';
import { GlassCard } from './GlassCard';
import { Sparkline } from './Sparkline';

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error';
  className?: string;
  loading?: boolean;
  sparklineData?: number[];
}

export function MetricCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  variant = 'default',
  className,
  loading = false,
  sparklineData,
}: MetricCardProps) {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'stable':
        return <Minus className="h-4 w-4 text-gray-400" />;
      default:
        return null;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      case 'stable':
        return 'text-gray-400';
      default:
        return 'text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <GlassCard variant={variant} className={cn('p-6', className)}>
        <div className="space-y-3">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
          <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
        </div>
      </GlassCard>
    );
  }

  const getSparklineVariant = (): 'primary' | 'success' | 'warning' | 'error' => {
    if (variant !== 'default') return variant;
    if (trend === 'up') return 'success';
    if (trend === 'down') return 'error';
    return 'primary';
  };

  return (
    <GlassCard variant={variant} className={cn('p-6', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <h3 className="text-3xl font-bold tracking-tight">{value}</h3>
            {trend && (
              <div className="flex items-center gap-1">
                {getTrendIcon()}
                {trendValue && (
                  <span className={cn('text-sm font-medium', getTrendColor())}>
                    {trendValue}
                  </span>
                )}
              </div>
            )}
          </div>
          {subtitle && (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          )}
          {sparklineData && sparklineData.length > 0 && (
            <div className="mt-3">
              <Sparkline
                data={sparklineData}
                width={120}
                height={24}
                variant={getSparklineVariant()}
                showArea
                animated
              />
            </div>
          )}
        </div>
        {icon && (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20">
            {icon}
          </div>
        )}
      </div>
    </GlassCard>
  );
}