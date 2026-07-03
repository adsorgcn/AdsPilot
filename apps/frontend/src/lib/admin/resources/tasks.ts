/**
 * Task Admin Resources
 * 任务管理相关的后台资源hooks
 */

import { createParamResource, createStaticResource } from '~/lib/api/resources';
import type { TaskStats, Task } from '~/lib/api/types/console';
import { fetchTaskStats, fetchTasks } from '~/lib/api/console';

export const useConsoleTaskStats = createStaticResource<TaskStats>(
  ['console', 'tasks', 'stats'],
  fetchTaskStats,
  {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  },
);

export const useConsoleTaskList = createParamResource<
  {
    page?: number;
    pageSize?: number;
    status?: string;
    type?: string;
    userId?: string;
  },
  { items: Task[]; total: number; totalPages: number }
>(
  (params) => ['console', 'tasks', params],
  (params, signal) => fetchTasks(params, signal),
  {
    refreshInterval: 15_000,
    revalidateOnFocus: true,
  },
);
