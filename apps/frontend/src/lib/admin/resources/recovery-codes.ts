/**
 * Recovery Codes Admin Resources
 * 恢复码管理相关的资源hooks
 */

import { createParamResource, createStaticResource } from '~/lib/api/resources';
import type { RecoveryCodeStats, RecoveryCode } from '~/lib/api/types/console';
import { fetchRecoveryCodeStats, fetchRecoveryCodes } from '~/lib/api/console';

export const useConsoleRecoveryCodeStats = createStaticResource<RecoveryCodeStats>(
  ['console', 'recovery-codes', 'stats'],
  fetchRecoveryCodeStats,
  {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  },
);

export const useConsoleRecoveryCodes = createParamResource<
  {
    page?: number;
    pageSize?: number;
    status?: string;
    userId?: string;
  },
  { items: RecoveryCode[]; total: number; totalPages: number }
>(
  (params) => ['console', 'recovery-codes', params],
  (params, signal) => fetchRecoveryCodes(params, signal),
  {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  },
);
