'use client';

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Calendar, TrendingUp, DollarSign, Target } from 'lucide-react';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '~/components/ui/GlassCard';
import { RechartsLineChart } from '~/components/charts/RechartsLineChart';
import Button from '~/core/ui/Button';
import { cn } from '~/core/generic/shadcn-utils';

export type TimeRange = '7d' | '30d' | '90d';

export interface TrendData {
  date: string;
  revenue: number;
  spend: number;
  roas: number;
}

export interface DashboardTrendsChartProps {
  /**
   * Trend data for the chart
   */
  data: TrendData[];
  /**
   * Currently selected time range
   */
  timeRange: TimeRange;
  /**
   * Callback when time range changes
   */
  onTimeRangeChange?: (range: TimeRange) => void;
  /**
   * Whether data is loading
   */
  isLoading?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
}

const timeRangeOptions: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
];

/**
 * DashboardTrendsChart - Multi-line chart showing revenue, spend, and ROAS trends
 * 
 * Displays key performance metrics over time with interactive time range selection.
 * Uses gradient fills and smooth animations for a modern look.
 */
export function DashboardTrendsChart({
  data,
  timeRange,
  onTimeRangeChange,
  isLoading = false,
  className,
}: DashboardTrendsChartProps) {
  const { t } = useTranslation('common');

  // Calculate summary statistics
  const stats = React.useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalRevenue: 0,
        totalSpend: 0,
        avgRoas: 0,
        revenueChange: 0,
        spendChange: 0,
        roasChange: 0,
      };
    }

    const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
    const totalSpend = data.reduce((sum, d) => sum + d.spend, 0);
    const avgRoas = data.reduce((sum, d) => sum + d.roas, 0) / data.length;

    // Calculate changes (comparing first half vs second half)
    const midPoint = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, midPoint);
    const secondHalf = data.slice(midPoint);

    const firstHalfRevenue = firstHalf.reduce((sum, d) => sum + d.revenue, 0) / firstHalf.length;
    const secondHalfRevenue = secondHalf.reduce((sum, d) => sum + d.revenue, 0) / secondHalf.length;
    const revenueChange = firstHalfRevenue > 0 
      ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100 
      : 0;

    const firstHalfSpend = firstHalf.reduce((sum, d) => sum + d.spend, 0) / firstHalf.length;
    const secondHalfSpend = secondHalf.reduce((sum, d) => sum + d.spend, 0) / secondHalf.length;
    const spendChange = firstHalfSpend > 0 
      ? ((secondHalfSpend - firstHalfSpend) / firstHalfSpend) * 100 
      : 0;

    const firstHalfRoas = firstHalf.reduce((sum, d) => sum + d.roas, 0) / firstHalf.length;
    const secondHalfRoas = secondHalf.reduce((sum, d) => sum + d.roas, 0) / secondHalf.length;
    const roasChange = firstHalfRoas > 0 
      ? ((secondHalfRoas - firstHalfRoas) / firstHalfRoas) * 100 
      : 0;

    return {
      totalRevenue,
      totalSpend,
      avgRoas,
      revenueChange,
      spendChange,
      roasChange,
    };
  }, [data]);

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={className}
    >
      <GlassCard variant="gradient">
        <GlassCardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <GlassCardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              {t('dashboard.trends.title', 'Performance Trends')}
            </GlassCardTitle>
            
            {/* Time range selector */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div className="flex rounded-lg bg-muted/50 p-1">
                {timeRangeOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={timeRange === option.value ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onTimeRangeChange?.(option.value)}
                    className={cn(
                      'h-7 px-3 text-xs',
                      timeRange === option.value && 'bg-white dark:bg-gray-800 shadow-sm'
                    )}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </GlassCardHeader>

        <GlassCardContent className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-gradient-to-br from-blue-50/50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/20 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />
                {t('dashboard.trends.revenue', 'Total Revenue')}
              </div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(stats.totalRevenue)}
              </p>
              <p className={cn(
                'text-xs font-medium mt-1',
                stats.revenueChange >= 0 ? 'text-green-600' : 'text-red-600'
              )}>
                {formatPercentage(stats.revenueChange)}
              </p>
            </div>

            <div className="rounded-lg bg-gradient-to-br from-purple-50/50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/20 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />
                {t('dashboard.trends.spend', 'Ad Spend')}
              </div>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatCurrency(stats.totalSpend)}
              </p>
              <p className={cn(
                'text-xs font-medium mt-1',
                stats.spendChange >= 0 ? 'text-red-600' : 'text-green-600'
              )}>
                {formatPercentage(stats.spendChange)}
              </p>
            </div>

            <div className="rounded-lg bg-gradient-to-br from-green-50/50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/20 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Target className="h-4 w-4" />
                {t('dashboard.trends.roas', 'Avg ROAS')}
              </div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.avgRoas.toFixed(2)}x
              </p>
              <p className={cn(
                'text-xs font-medium mt-1',
                stats.roasChange >= 0 ? 'text-green-600' : 'text-red-600'
              )}>
                {formatPercentage(stats.roasChange)}
              </p>
            </div>
          </div>

          {/* Chart */}
          <div>
            <RechartsLineChart
              data={data}
              xKey="date"
              yKeys={[
                { 
                  key: 'revenue', 
                  name: t('dashboard.trends.revenue', 'Revenue'),
                  color: 'hsl(217, 91%, 60%)',
                },
                { 
                  key: 'spend', 
                  name: t('dashboard.trends.spend', 'Ad Spend'),
                  color: 'hsl(260, 91%, 65%)',
                },
                { 
                  key: 'roas', 
                  name: t('dashboard.trends.roas', 'ROAS'),
                  color: 'hsl(142, 76%, 45%)',
                },
              ]}
              height={300}
              showArea
              showGrid
              showLegend
              loading={isLoading}
            />
          </div>

          {/* Insights */}
          <div className="rounded-lg bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">
              {stats.avgRoas >= 3 
                ? t('dashboard.trends.insights.excellent', '🎉 Excellent ROAS! Your campaigns are highly profitable.')
                : stats.avgRoas >= 2
                ? t('dashboard.trends.insights.good', '✨ Good ROAS. Keep optimizing for better results.')
                : stats.avgRoas >= 1
                ? t('dashboard.trends.insights.breakeven', '📊 Breaking even. Consider optimizing targeting and creatives.')
                : t('dashboard.trends.insights.poor', '⚠️ Low ROAS. Review campaign strategy and reduce spend on underperforming offers.')}
            </p>
          </div>
        </GlassCardContent>
      </GlassCard>
    </motion.div>
  );
}