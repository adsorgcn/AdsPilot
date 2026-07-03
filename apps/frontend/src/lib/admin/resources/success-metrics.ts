/**
 * Success Metrics Admin Resources
 * 成功指标相关的资源hooks
 */

import { createStaticResource } from '~/lib/api/resources';
import type { SuccessMetrics } from '~/lib/api/types/console';
import { fetchSuccessMetrics } from '~/lib/api/console';

export const useConsoleSuccessMetrics = createStaticResource<SuccessMetrics>(
  ['console', 'success-metrics'],
  fetchSuccessMetrics,
  {
    refreshInterval: 300_000, // 5分钟
    revalidateOnFocus: true,
  },
);
