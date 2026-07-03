'use client';

import { StatCardSkeleton } from '~/components/Skeleton';
import { useConsoleRecoveryCodeStats } from '~/lib/admin/resources/recovery-codes';

export default function SecurityStatsCards() {
  const {
    data: stats,
    error,
    isLoading,
  } = useConsoleRecoveryCodeStats();

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="overflow-hidden rounded-lg border bg-card p-6">
        <div className="text-sm text-muted-foreground">Total Codes</div>
        <div className="text-3xl font-bold">
          {stats?.total.toLocaleString() ?? 0}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card p-6">
        <div className="text-sm text-muted-foreground">Available</div>
        <div className="text-3xl font-bold text-green-600">
          {stats?.available.toLocaleString() ?? 0}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card p-6">
        <div className="text-sm text-muted-foreground">Used</div>
        <div className="text-3xl font-bold text-gray-600">
          {stats?.used.toLocaleString() ?? 0}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card p-6">
        <div className="text-sm text-muted-foreground">Expired</div>
        <div className="text-3xl font-bold text-red-600">
          {stats?.expired.toLocaleString() ?? 0}
        </div>
      </div>
    </div>
  );
}
