'use client';

'use client';

import { useMemo } from 'react';

import MetricGrid from '../../components/metrics/MetricGrid';
import type { MetricCardProps } from '../../components/metrics/MetricCard';
import {
  ResourceErrorState,
  ResourceListSkeleton,
} from '~/core/ui/ResourceState';
import { useConsoleOfferStats } from '~/lib/admin/resources/offers';
import type { OfferStats } from '~/lib/api/types/console';

export default function OfferStatsCards() {
  const { data, error, isLoading, refetch } = useConsoleOfferStats();

  // Compute cards before any early returns to satisfy hooks rules
  const cards = useMemo(() => mapStatsToCards(data), [data]);

  if (error) {
    return (
      <ResourceErrorState
        title="Offer 指标加载失败"
        description="无法获取 Offer 统计概览，请稍后重试。"
        error={error}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  if (isLoading && !data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-lg border bg-card p-6">
            <ResourceListSkeleton rows={1} />
          </div>
        ))}
      </div>
    );
  }

  return <MetricGrid metrics={cards} columns={3} />;
}

function mapStatsToCards(stats?: OfferStats): MetricCardProps[] {
  const resolved: OfferStats = stats ?? {
    total: 0,
    pendingEvaluation: 0,
    deployable: 0,
    deployed: 0,
    averageScore: 0,
    totalRevenue: 0,
  };

  return [
    {
      title: '总 Offer 数',
      value: resolved.total.toLocaleString(),
      badge: 'Total',
      tone: 'default',
    },
    {
      title: '待评估',
      value: resolved.pendingEvaluation.toLocaleString(),
      badge: 'Pending',
      tone: resolved.pendingEvaluation > 0 ? 'warn' : 'default',
    },
    {
      title: '可部署',
      value: resolved.deployable.toLocaleString(),
      badge: 'Deployable',
      tone: 'success',
    },
    {
      title: '已部署',
      value: resolved.deployed.toLocaleString(),
      badge: 'Deployed',
      tone: 'default',
    },
    {
      title: '平均评分',
      value: resolved.averageScore.toFixed(1),
      description: '目标 ≥ 7.5',
      badge: 'Quality',
      tone: resolved.averageScore >= 7.5 ? 'success' : resolved.averageScore >= 6 ? 'warn' : 'error',
    },
    {
      title: '累计收入',
      value: formatCurrency(resolved.totalRevenue),
      badge: 'Revenue',
      tone: 'success',
    },
  ];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
