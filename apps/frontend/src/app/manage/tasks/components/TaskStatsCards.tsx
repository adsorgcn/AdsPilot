'use client';

import {
  ResourceEmptyState,
  ResourceErrorState,
  ResourceListSkeleton,
} from '~/core/ui/ResourceState';
import { useConsoleTaskStats } from '~/lib/admin/resources/tasks';

export default function TaskStatsCards() {
  const { data: stats, error, isLoading, refetch } = useConsoleTaskStats();

  if (error) {
    return (
      <ResourceErrorState
        title="任务统计加载失败"
        description="无法获取任务概览，请稍后重试。"
        error={error}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  if (isLoading && !stats) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-lg border bg-card p-6">
            <ResourceListSkeleton rows={2} />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <ResourceEmptyState
        title="暂无任务统计数据"
        description="当前还没有任务执行记录。"
      />
    );
  }

  const cards = [
    {
      label: 'Total Tasks',
      value: stats.total.toLocaleString(),
    },
    {
      label: 'Pending',
      value: stats.pending.toLocaleString(),
      accent: 'text-yellow-600',
    },
    {
      label: 'Running',
      value: stats.running.toLocaleString(),
      accent: 'text-blue-600',
    },
    {
      label: 'Completed',
      value: stats.completed.toLocaleString(),
      accent: 'text-green-600',
    },
    {
      label: 'Failed',
      value: stats.failed.toLocaleString(),
      accent: 'text-red-600',
    },
    {
      label: 'Avg Tokens',
      value: stats.avgTokensPerTask.toFixed(0),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
      {cards.map((card) => (
        <div key={card.label} className="overflow-hidden rounded-lg border bg-card p-6">
          <div className="text-sm text-muted-foreground">{card.label}</div>
          <div className={`text-3xl font-bold ${card.accent ?? ''}`}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}
