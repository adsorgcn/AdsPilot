'use client';

import { ResourceErrorState } from '~/core/ui/ResourceState';
import { Skeleton } from '~/core/ui/Skeleton';
import { useConsoleSubscriptionStats } from '~/lib/admin/resources/subscriptions';
import { ArrowTrendingUpIcon, CheckCircleIcon, ClockIcon, XCircleIcon } from '@heroicons/react/24/outline';

export default function SubscriptionStatsCards() {
  const { data, error, isLoading, refetch } = useConsoleSubscriptionStats();

  if (error) {
    return (
      <ResourceErrorState
        title={'Subscription Statistics Load Failed'}
        description={'Unable to get subscription statistics, please try again later.'}
        error={error}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  const stats = data ?? {
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    trialingSubscriptions: 0,
    canceledSubscriptions: 0,
    recentSubscriptions: 0,
    expiringSoon: 0,
  };

  const cards = [
    {
      label: 'Total Subscriptions',
      value: stats.totalSubscriptions?.toLocaleString() ?? '0',
      icon: ArrowTrendingUpIcon,
      className: 'text-blue-600',
    },
    {
      label: 'Active Subscriptions',
      value: stats.activeSubscriptions?.toLocaleString() ?? '0',
      icon: CheckCircleIcon,
      className: 'text-green-600',
    },
    {
      label: 'Trialing',
      value: stats.trialingSubscriptions?.toLocaleString() ?? '0',
      icon: ClockIcon,
      className: 'text-yellow-600',
    },
    {
      label: 'Canceled',
      value: stats.canceledSubscriptions?.toLocaleString() ?? '0',
      icon: XCircleIcon,
      className: 'text-red-600',
    },
    {
      label: 'Recent (7 days)',
      value: stats.recentSubscriptions?.toLocaleString() ?? '0',
      icon: ArrowTrendingUpIcon,
      className: 'text-purple-600',
    },
    {
      label: 'Expiring Soon',
      value: stats.expiringSoon?.toLocaleString() ?? '0',
      icon: ClockIcon,
      className: 'text-orange-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="overflow-hidden rounded-lg border bg-card p-6"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">{card.label}</div>
              <Icon className={`h-5 w-5 ${card.className}`} />
            </div>
            <div className="mt-2 text-3xl font-bold">
              {isLoading ? (
                <Skeleton className="h-9 w-24" />
              ) : (
                card.value
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
