'use client';

import { StatCardSkeleton } from '~/components/Skeleton';
import { useConsoleAdsAccountStats } from '~/lib/admin/resources/ads-accounts';

export default function AdsAccountStatsCards() {
  const {
    data: stats,
    error,
    isLoading,
  } = useConsoleAdsAccountStats();

  const errorMessage = error
    ? error instanceof Error
      ? error.message
      : 'Failed to load statistics'
    : null;

  const loading = isLoading && !stats;

  if (errorMessage) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-800">Failed to load statistics: {errorMessage}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <div className="overflow-hidden rounded-lg border bg-card p-6">
        <div className="text-sm text-muted-foreground">Total Accounts</div>
        <div className="text-3xl font-bold">
          {stats?.total.toLocaleString() ?? 0}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card p-6">
        <div className="text-sm text-muted-foreground">Active</div>
        <div className="text-3xl font-bold text-green-600">
          {stats?.active.toLocaleString() ?? 0}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card p-6">
        <div className="text-sm text-muted-foreground">Suspended</div>
        <div className="text-3xl font-bold text-red-600">
          {stats?.suspended.toLocaleString() ?? 0}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card p-6">
        <div className="text-sm text-muted-foreground">Total Cost</div>
        <div className="text-3xl font-bold text-orange-600">
          {formatCurrency(stats?.totalCost ?? 0)}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card p-6">
        <div className="text-sm text-muted-foreground">Avg ROAS</div>
        <div className={`text-3xl font-bold ${(stats?.averageRoas ?? 0) > 1 ? 'text-green-600' : 'text-red-600'}`}>
          {(stats?.averageRoas ?? 0).toFixed(2)}
        </div>
      </div>
    </div>
  );
}
