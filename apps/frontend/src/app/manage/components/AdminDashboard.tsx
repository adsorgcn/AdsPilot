import dynamic from 'next/dynamic';

import SystemAlertsBanner from './SystemAlertsBanner';
import DashboardMetricsCards from './DashboardMetricsCards';
import Tile from '~/core/ui/Tile';
import Spinner from '~/core/ui/Spinner';
import type { AdminStatsResponse } from '~/lib/admin';
import SuccessMetricsPanel from './SuccessMetricsPanel';
import FadeIn from '~/components/FadeIn';
import { FadeInStagger, FadeInStaggerItem } from '~/components/FadeIn';

const RecentActivityFeed = dynamic(() => import('./RecentActivityFeed'), {
  loading: () => (
    <Tile>
      <Tile.Body>
        <div className="flex justify-center py-12">
          <Spinner className="text-primary" />
        </div>
      </Tile.Body>
    </Tile>
  ),
});

function AdminDashboard({ stats }: { stats: AdminStatsResponse }) {
  const counters = stats.counters ?? {};

  const tiles = [
    {
      label: '用户总数',
      value: formatCounter(counters.users),
      helper: '所有注册用户数量',
    },
    {
      label: '活跃订阅',
      value: formatCounter(counters.subscriptionsActive),
      helper: '正在计费的订阅',
    },
    {
      label: '累计 Token',
      value: formatCounter(counters.tokensTotal),
      helper: '用户账户可用 Token 总和',
    },
    {
      label: '近 24 小时通知',
      value: formatCounter(counters.notifications24h),
      helper: '下发的风险提醒/系统通知',
    },
  ];

  return (
    <div className={'flex flex-col space-y-6'}>
      {/* System Alerts Banner */}
      <FadeIn>
        <SystemAlertsBanner />
      </FadeIn>

      {/* Basic Stats Cards */}
      <FadeInStagger
        className={
          'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        }
      >
        {tiles.map((tile) => (
          <FadeInStaggerItem key={tile.label}>
            <Tile>
              <Tile.Heading>{tile.label}</Tile.Heading>

              <Tile.Body>
                <div className={'flex flex-col space-y-1'}>
                  <Tile.Figure>{tile.value}</Tile.Figure>
                  <span className={'text-xs text-muted-foreground'}>
                    {tile.helper}
                  </span>
                </div>
              </Tile.Body>
            </Tile>
          </FadeInStaggerItem>
        ))}
      </FadeInStagger>

      {/* Key Performance Indicators */}
      <FadeIn delay={0.2}>
        <DashboardMetricsCards />
      </FadeIn>

      {/* Success Metrics */}
      <FadeIn delay={0.3}>
        <SuccessMetricsPanel />
      </FadeIn>

      {/* Recent Activity Feed */}
      <FadeIn delay={0.4}>
        <RecentActivityFeed />
      </FadeIn>

      <p className={'text-xs text-muted-foreground'}>
        数据更新时间：{formatTimestamp(stats.updatedAt)}
      </p>
    </div>
  );
}

export default AdminDashboard;

function formatCounter(value?: number) {
  if (typeof value !== 'number' || value < 0) {
    return '—';
  }

  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatTimestamp(value?: string) {
  if (!value) {
    return '未知';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}
