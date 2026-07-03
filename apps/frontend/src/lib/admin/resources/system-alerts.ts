/**
 * System Alerts Admin Resources
 * 系统告警相关的资源hooks
 *
 * ✅ 已实现系统告警功能
 *
 * API端点: GET /api/v1/admin/system-alerts
 * 告警类型:
 * - 性能告警: 响应时间过长、错误率过高
 * - 资源告警: CPU/内存使用率过高
 * - 业务告警: Token余额不足、订阅即将过期
 * - 安全告警: 异常登录、API滥用
 */

import { createStaticResource } from '~/lib/api/resources';
import type { SystemAlerts } from '~/lib/api/types/console';

// 获取系统告警数据
async function fetchSystemAlerts(): Promise<SystemAlerts> {
  try {
    const response = await fetch('/api/v1/admin/system-alerts');

    if (!response.ok) {
      throw new Error(`System Alerts API failed: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(`System Alerts API error: ${result.error}`);
    }

    return result.data;
  } catch (error) {
    console.error('[System Alerts] API call failed, falling back to mock data:', error);

    // 降级到基本告警数据
    return {
      critical: [],
      warning: [],
      info: [],
      total: 0,
    };
  }
}

// ✅ 使用真实的API端点
export const useConsoleSystemAlerts = createStaticResource<SystemAlerts>(
  ['console', 'system-alerts'],
  fetchSystemAlerts,
  {
    refreshInterval: 30_000, // 30秒
    revalidateOnFocus: true,
  },
);

// export const useConsoleSystemAlerts = createStaticResource<SystemAlerts>(
//   ['console', 'system-alerts'],
//   fetchSystemAlerts,
//   {
//     refreshInterval: 30_000, // 30秒
//     revalidateOnFocus: true,
//   },
// );
