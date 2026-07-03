'use client';

import { ResourceErrorState } from '~/core/ui/ResourceState';
import { Skeleton } from '~/core/ui/Skeleton';
import { useConsoleTokenStats } from '~/lib/admin/resources/tokens';

export default function TokenStatsCards() {
  const { data, error, isLoading, refetch } = useConsoleTokenStats();

  if (error) {
    return (
      <ResourceErrorState
        title={'Token 统计加载失败'}
        description={'无法获取 Token 统计信息，请稍后重试。'}
        error={error}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  const stats = data ?? {
    totalUsers: 0,
    totalTokens: 0,
    averageBalance: 0,
    negativeBalanceCount: 0,
  };

  const cards = [
    {
      label: 'Total Users',
      value: stats.totalUsers?.toLocaleString() ?? '0',
    },
    {
      label: 'Total Tokens',
      value: stats.totalTokens?.toLocaleString() ?? '0',
    },
    {
      label: 'Average Balance',
      value:
        typeof stats.averageBalance === 'number'
          ? stats.averageBalance.toFixed(2)
          : '0.00',
    },
    {
      label: 'Negative Balance Users',
      value: stats.negativeBalanceCount?.toLocaleString() ?? '0',
      className: 'text-destructive',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="overflow-hidden rounded-lg border bg-card p-6"
        >
          <div className="text-sm text-muted-foreground">{card.label}</div>
          <div className={`text-3xl font-bold ${card.className ?? ''}`}>
            {isLoading ? (
              <Skeleton className="mt-2 h-9 w-24" />
            ) : (
              card.value
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
