'use client';

import { Skeleton } from '~/core/ui/Skeleton';
import { ResourceErrorState } from '~/core/ui/ResourceState';
import { useConsoleTokenConsumption } from '~/lib/admin/resources/analytics';

export default function TokenConsumptionChart() {
  const { data, error, isLoading } = useConsoleTokenConsumption({ period: 'daily', days: 30 });

  if (error) {
    return (
      <ResourceErrorState
        title={'Token Consumption Data Load Failed'}
        description={'Unable to get token consumption data, please try again later.'}
        error={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (isLoading || !data) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total Consumed</div>
          <div className="text-2xl font-bold">{data.totalConsumed?.toLocaleString() ?? 0}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Today Consumed</div>
          <div className="text-2xl font-bold">{data.todayConsumed?.toLocaleString() ?? 0}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Week Consumed</div>
          <div className="text-2xl font-bold">{data.weekConsumed?.toLocaleString() ?? 0}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Month Consumed</div>
          <div className="text-2xl font-bold">{data.monthConsumed?.toLocaleString() ?? 0}</div>
        </div>
      </div>

      {/* Top Consumers */}
      {data.topConsumers && data.topConsumers.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <div className="mb-4 text-sm font-medium">Top 10 Consumers</div>
          <div className="space-y-2">
            {data.topConsumers.slice(0, 10).map((consumer, index) => (
              <div key={consumer.userId} className="flex items-center justify-between border-b pb-2 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
                  <span className="text-sm">{consumer.userEmail}</span>
                </div>
                <span className="text-sm font-semibold">{consumer.consumed?.toLocaleString()} tokens</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart Placeholder */}
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-4 text-sm font-medium">Token Consumption Trend (Last 30 Days)</div>
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          Chart visualization placeholder - implement with charting library
        </div>
      </div>
    </div>
  );
}
