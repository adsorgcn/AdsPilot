'use client';

import { Skeleton } from '~/core/ui/Skeleton';
import { ResourceErrorState } from '~/core/ui/ResourceState';
import { useConsoleActivity } from '~/lib/admin/resources/analytics';

export default function ActivityMetrics() {
  const { data, error, isLoading } = useConsoleActivity({ days: 30 });

  if (error) {
    return (
      <ResourceErrorState
        title={'Activity Data Load Failed'}
        description={'Unable to get activity data, please try again later.'}
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
      {/* Active Users */}
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-4 text-sm font-medium">Active Users</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <div className="text-sm text-muted-foreground">Daily Active Users</div>
            <div className="text-3xl font-bold">{(data.dau ?? 0).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Weekly Active Users</div>
            <div className="text-3xl font-bold">{(data.wau ?? 0).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Monthly Active Users</div>
            <div className="text-3xl font-bold">{(data.mau ?? 0).toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Content Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total Offers</div>
          <div className="text-2xl font-bold">{(data.totalOffers ?? 0).toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Active Offers</div>
          <div className="text-2xl font-bold">{(data.activeOffers ?? 0).toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total Evaluations</div>
          <div className="text-2xl font-bold">{(data.totalEvaluations ?? 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Activity Trend */}
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-4 text-sm font-medium">User Activity Trend (Last 30 Days)</div>
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          {data.dataPoints && data.dataPoints.length > 0 ? (
            <div className="w-full">
              <div className="text-xs text-muted-foreground mb-2">
                Data points: {data.dataPoints.length}
              </div>
              <div className="h-40 flex items-end gap-1">
                {data.dataPoints.map((point, index) => {
                  const maxValue = Math.max(...data.dataPoints.map(p => p.value));
                  const height = maxValue > 0 ? (point.value / maxValue) * 100 : 0;
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center group">
                      <div
                        className="w-full bg-green-500/70 hover:bg-green-500 transition-colors rounded-t"
                        style={{ height: `${height}%`, minHeight: point.value > 0 ? '4px' : '0' }}
                        title={`${point.date}: ${point.value} active users`}
                      />
                      <div className="text-[8px] text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {point.value}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            'Activity trend chart placeholder'
          )}
        </div>
      </div>
    </div>
  );
}
