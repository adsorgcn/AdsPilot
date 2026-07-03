'use client';

import { Skeleton } from '~/core/ui/Skeleton';
import { ResourceErrorState } from '~/core/ui/ResourceState';

export interface RevenueChartProps {
  period?: 'monthly' | 'weekly' | 'daily';
  days?: number;
  className?: string;
}

export function RevenueChart({
  period: _period = 'monthly',
  days: _days = 365,
  className = ''
}: RevenueChartProps) {
  // 这里可以添加实际的图表逻辑
  // 暂时使用静态数据作为占位符
  const isLoading = false;
  const error = null;
  const data = {
    mrr: 2998,
    arr: 35976,
    activeSubscribers: 42
  };

  if (error) {
    return (
      <ResourceErrorState
        title={'Revenue Data Load Failed'}
        description={'Unable to get revenue data, please try again later.'}
        error={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (isLoading || !data) {
    return (
      <div className={`rounded-lg border bg-card p-6 ${className}`}>
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Monthly Recurring Revenue</div>
          <div className="text-3xl font-bold">${(data.mrr ?? 0).toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Annual Recurring Revenue</div>
          <div className="text-3xl font-bold">${(data.arr ?? 0).toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Active Subscribers</div>
          <div className="text-3xl font-bold">{(data.activeSubscribers ?? 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Chart Placeholder */}
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-4 text-sm font-medium">Revenue Trend (Last 12 Months)</div>
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Chart visualization placeholder - MRR trend over time
        </div>
      </div>

      {/* Revenue Breakdown */}
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-4 text-sm font-medium">Revenue Breakdown by Plan</div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Elite Plan</span>
            <div className="flex items-center gap-2">
              <div className="h-2 w-32 rounded-full bg-primary/20">
                <div className="h-2 w-3/4 rounded-full bg-primary" />
              </div>
              <span className="text-sm font-semibold">$99/mo</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Pro Plan</span>
            <div className="flex items-center gap-2">
              <div className="h-2 w-32 rounded-full bg-blue-500/20">
                <div className="h-2 w-1/2 rounded-full bg-blue-500" />
              </div>
              <span className="text-sm font-semibold">$29/mo</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Starter Plan</span>
            <div className="flex items-center gap-2">
              <div className="h-2 w-32 rounded-full bg-gray-500/20">
                <div className="h-2 w-1/4 rounded-full bg-gray-500" />
              </div>
              <span className="text-sm font-semibold">$0/mo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}