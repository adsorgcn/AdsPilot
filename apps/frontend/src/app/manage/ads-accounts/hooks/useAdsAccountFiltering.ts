import { useMemo } from 'react';
import type { AdsAccountAdmin } from '~/lib/api/types/console';

import {
  filterByPerformance,
  matchSyncBucket,
  resolveSyncStatus,
} from '../components/AdsAccountTable';

export type PerformanceFilter = 'all' | 'high-roas' | 'low-roas' | 'high-spend';
export type SyncFilter = 'all' | 'fresh' | 'stale' | 'never';

/**
 * 广告账号过滤逻辑
 */
export function useAdsAccountFiltering(
  accounts: AdsAccountAdmin[],
  performanceFilter: PerformanceFilter,
  syncFilter: SyncFilter,
) {
  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      if (!filterByPerformance(account, performanceFilter)) {
        return false;
      }

      const syncState = resolveSyncStatus(account);
      if (!matchSyncBucket(syncState, syncFilter)) {
        return false;
      }

      return true;
    });
  }, [accounts, performanceFilter, syncFilter]);

  return filteredAccounts;
}
