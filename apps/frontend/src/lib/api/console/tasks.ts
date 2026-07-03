import { consoleApi } from '~/lib/api';
import type { TaskStats, Task } from '~/lib/api/types/console';

export async function fetchTaskStats(signal?: AbortSignal): Promise<TaskStats> {
  return consoleApi.getTaskStats({ signal });
}

export interface TaskListParams {
  page?: number;
  limit?: number;
  pageSize?: number;
  status?: string;
  userId?: string;
  type?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function fetchTasks(
  params: TaskListParams = {},
  signal?: AbortSignal,
): Promise<{ items: Task[]; total: number; totalPages: number }> {
  return consoleApi.getTasks(params, { signal });
}

export async function cancelTask(taskId: string, reason: string) {
  return consoleApi.cancelTask(taskId, reason);
}

export async function retryTask(taskId: string) {
  return consoleApi.retryTask(taskId);
}
