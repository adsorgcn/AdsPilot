import { useMemo } from 'react';
import { useTasks } from '~/lib/tasks';
import { buildOfferSyncMap } from '~/lib/tasks/offer-sync';

/**
 * Offer同步状态管理
 */
export function useOffersSyncStatus() {
  const {
    tasks: recentTasks,
    isLoading: tasksLoading,
  } = useTasks({
    limit: 150,
    sortBy: 'updated_at',
    sortOrder: 'desc',
  });

  const syncStatusMap = useMemo(
    () => buildOfferSyncMap(recentTasks),
    [recentTasks],
  );

  return {
    syncStatusMap,
    tasksLoading,
  };
}
