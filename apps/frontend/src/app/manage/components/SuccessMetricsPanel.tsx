'use client';

import { toast } from 'sonner';

import Tile from '~/core/ui/Tile';
import Button from '~/core/ui/Button';
import { Alert } from '~/core/ui/Alert';
import { useConsoleSuccessMetrics } from '~/lib/admin/resources/success-metrics';

import MetricGrid from './metrics/MetricGrid';
import type { MetricCardProps } from './metrics/MetricCard';

function formatPercentage(value: number) {
  if (Number.isNaN(value)) {
    return '—';
  }

  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) {
    return '—';
  }

  return new Intl.NumberFormat('zh-CN').format(value);
}

export default function SuccessMetricsPanel() {
  const { data, error, isLoading, refetch } = useConsoleSuccessMetrics();

  const handleRefresh = async () => {
    await refetch();
    toast.success('成功指标已刷新');
  };

  return (
    <Tile>
      <Tile.Heading>成功指标看板</Tile.Heading>
      <Tile.Body>
        {error ? (
          <Alert type="error">
            <Alert.Heading>无法加载成功指标</Alert.Heading>
            <p className="text-sm text-red-600/80">
              {error instanceof Error ? error.message : '未知错误'}
            </p>
          </Alert>
        ) : null}

        <div className="flex items-center justify-between pb-4">
          <p className="text-sm text-muted-foreground">
            活跃与转化指标按 120 秒刷新一次，可手动刷新查看最新结果。
          </p>

          <Button size="small" variant="outline" loading={isLoading} onClick={handleRefresh}>
            刷新
          </Button>
        </div>

        {isLoading && !data ? (
          <div className="flex justify-center py-12 text-sm text-muted-foreground">
            正在加载成功指标…
          </div>
        ) : null}

        {data ? <MetricGrid metrics={mapMetrics(data)} columns={3} /> : null}
      </Tile.Body>
    </Tile>
  );
}

function mapMetrics(data: NonNullable<ReturnType<typeof useConsoleSuccessMetrics>['data']>): MetricCardProps[] {
  return [
    {
      title: '激活率',
      value: formatPercentage(data.activationRate),
      description: `已激活 ${formatNumber(data.activatedUsers)} / 总用户 ${formatNumber(data.usersTotal)}`,
      trendLabel: data.activationRate > 0.5 ? '目标达成' : '低于目标 50%',
      trend: data.activationRate > 0.5 ? 'up' : 'down',
      tone: data.activationRate > 0.5 ? 'success' : 'warn',
      actions: [
        {
          label: '查看 Onboarding',
          href: '/tasks',
          variant: 'secondary',
        },
      ],
    },
    {
      title: '留存率',
      value: formatPercentage(data.retentionRate),
      description: `连续使用用户 ${formatNumber(data.returningUsers)}`,
      trendLabel: data.retentionRate >= 0.4 ? '健康' : '建议回访',
      trend: data.retentionRate >= 0.4 ? 'steady' : 'down',
      tone: data.retentionRate >= 0.4 ? 'success' : 'warn',
      actions: [
        {
          label: '查看留存任务',
          href: '/manage/tasks',
        },
      ],
    },
    {
      title: 'Offer 转化率',
      value: formatPercentage(data.conversionRate),
      description: `合格 Offer ${formatNumber(data.qualifiedOffers)}`,
      trendLabel: data.conversionRate >= 0.25 ? '优于行业均值' : '低于均值',
      trend: data.conversionRate >= 0.25 ? 'up' : 'down',
      tone: data.conversionRate >= 0.25 ? 'success' : 'warn',
      actions: [
        {
          label: '查看 Offer 详情',
          href: '/offers',
        },
      ],
    },
  ];
}
