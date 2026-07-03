'use client';

import { StatCardSkeleton } from '~/components/Skeleton';
import { useConsoleDashboardMetrics } from '~/lib/admin/resources/dashboard';
import {
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  BoltIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

export default function DashboardMetricsCards() {
  const {
    data: metrics,
    error,
    isLoading,
  } = useConsoleDashboardMetrics();

  const errorMessage = error
    ? error instanceof Error
      ? error.message
      : 'Failed to load metrics'
    : null;

  const loading = isLoading && !metrics;

  if (errorMessage) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-800">Failed to load metrics: {errorMessage}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    );
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getErrorRateColor = (rate: number) => {
    if (rate < 5) return 'text-green-600';
    if (rate < 15) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Key Performance Indicators</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* Task Success Rate */}
        <div className="overflow-hidden rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircleIcon className="h-4 w-4" />
            <span>Task Success Rate</span>
          </div>
          <div className={`mt-2 text-3xl font-bold ${getSuccessRateColor(metrics?.taskSuccessRate ?? 0)}`}>
            {(metrics?.taskSuccessRate ?? 0).toFixed(1)}%
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {metrics?.totalTasksToday ?? 0} tasks today
          </div>
        </div>

        {/* Average Task Duration */}
        <div className="overflow-hidden rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ClockIcon className="h-4 w-4" />
            <span>Avg Task Duration</span>
          </div>
          <div className="mt-2 text-3xl font-bold">
            {formatDuration(metrics?.avgTaskDuration ?? 0)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {metrics?.runningTasks ?? 0} running now
          </div>
        </div>

        {/* Average ROAS */}
        <div className="overflow-hidden rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CurrencyDollarIcon className="h-4 w-4" />
            <span>Average ROAS</span>
          </div>
          <div className={`mt-2 text-3xl font-bold ${(metrics?.averageRoas ?? 0) >= 1 ? 'text-green-600' : 'text-red-600'}`}>
            {(metrics?.averageRoas ?? 0).toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            ${(metrics?.totalAdRevenue ?? 0).toFixed(0)} revenue
          </div>
        </div>

        {/* API Response Time */}
        <div className="overflow-hidden rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BoltIcon className="h-4 w-4" />
            <span>API Response</span>
          </div>
          <div className="mt-2 text-3xl font-bold">
            {Math.round(metrics?.avgResponseTime ?? 0)}ms
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {(metrics?.requestsPerMinute ?? 0).toFixed(1)} req/min
          </div>
        </div>

        {/* Error Rate */}
        <div className="overflow-hidden rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ExclamationTriangleIcon className="h-4 w-4" />
            <span>Error Rate</span>
          </div>
          <div className={`mt-2 text-3xl font-bold ${getErrorRateColor(metrics?.errorRate ?? 0)}`}>
            {(metrics?.errorRate ?? 0).toFixed(1)}%
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Last hour
          </div>
        </div>

        {/* Active Users */}
        <div className="overflow-hidden rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <UserGroupIcon className="h-4 w-4" />
            <span>Active Users</span>
          </div>
          <div className="mt-2 text-3xl font-bold text-blue-600">
            {metrics?.activeUsersToday ?? 0}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Today
          </div>
        </div>
      </div>
    </div>
  );
}
