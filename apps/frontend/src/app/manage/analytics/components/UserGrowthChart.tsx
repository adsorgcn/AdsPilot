'use client';

import { Skeleton } from '~/core/ui/Skeleton';
import { ResourceErrorState } from '~/core/ui/ResourceState';
import { useConsoleUserGrowth } from '~/lib/admin/resources/analytics';

export default function UserGrowthChart() {
  const { data, error, isLoading } = useConsoleUserGrowth({ period: 'daily', days: 30 });

  if (error) {
    return (
      <ResourceErrorState
        title={'User Growth Data Load Failed'}
        description={'Unable to get user growth data, please try again later.'}
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
          <div className="text-sm text-muted-foreground">Today New Users</div>
          <div className="text-2xl font-bold">{data.todayNewUsers?.toLocaleString() ?? 0}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Week New Users</div>
          <div className="text-2xl font-bold">{data.weekNewUsers?.toLocaleString() ?? 0}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Month New Users</div>
          <div className="text-2xl font-bold">{data.monthNewUsers?.toLocaleString() ?? 0}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">DAU / MAU</div>
          <div className="text-2xl font-bold">
            {data.dau?.toLocaleString() ?? 0} / {data.mau?.toLocaleString() ?? 0}
          </div>
        </div>
      </div>

      {/* Chart Placeholder */}
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-4 text-sm font-medium">User Growth Trend (Last 30 Days)</div>
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          {data.dataPoints && data.dataPoints.length > 0 ? (
            <div className="w-full">
              <div className="text-xs text-muted-foreground mb-2">
                Data points: {data.dataPoints.length}
              </div>
              <div className="h-48 flex items-end gap-1">
                {data.dataPoints.map((point, index) => {
                  const maxValue = Math.max(...data.dataPoints.map(p => p.value));
                  const height = maxValue > 0 ? (point.value / maxValue) * 100 : 0;
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center group">
                      <div
                        className="w-full bg-primary/70 hover:bg-primary transition-colors rounded-t"
                        style={{ height: `${height}%`, minHeight: point.value > 0 ? '4px' : '0' }}
                        title={`${point.date}: ${point.value} users`}
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
            'Chart visualization will be implemented with charting library (e.g., Recharts, Chart.js)'
          )}
        </div>
      </div>
    </div>
  );
}
