/**
 * Dashboard Admin Resources
 * 后台仪表板相关的资源hooks
 */

import { createStaticResource } from '~/lib/api/resources';
import type { DashboardMetrics, RecentActivityResponse } from '~/lib/api/types/console';
import { fetchDashboardMetrics, fetchRecentActivity } from '~/lib/api/console';

export const useConsoleDashboardMetrics = createStaticResource<DashboardMetrics>(
  ['console', 'dashboard', 'metrics'],
  fetchDashboardMetrics,
  {
    refreshInterval: 60_000, // 1分钟
    revalidateOnFocus: true,
  },
);

export const useConsoleRecentActivity = createStaticResource<RecentActivityResponse>(
  ['console', 'dashboard', 'recent-activity'],
  fetchRecentActivity,
  {
    refreshInterval: 30_000, // 30秒
    revalidateOnFocus: true,
  },
);
