/**
 * Ads Accounts Admin Resources
 * 广告账号管理相关的后台资源hooks
 */

import { createParamResource, createStaticResource } from '~/lib/api/resources';
import type { AdsAccountStats, AdsAccount } from '~/lib/api/types/console';
import { fetchAdsAccountStats, fetchAdsAccounts } from '~/lib/api/console';

export const useConsoleAdsAccountStats = createStaticResource<AdsAccountStats>(
  ['console', 'ads-accounts', 'stats'],
  fetchAdsAccountStats,
  {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  },
);

export const useConsoleAdsAccounts = createParamResource<
  {
    page?: number;
    limit?: number;
    status?: string;
    provider?: string;
    userId?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  },
  { items: AdsAccount[]; total: number; totalPages: number }
>(
  (params) => ['console', 'ads-accounts', params],
  (params, signal) => fetchAdsAccounts(params, signal),
  {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  },
);
