/**
 * Task Management API
 */

import type BaseApiClient from '../../core/BaseApiClient';
import type { Task, TaskStats } from '../../types/console';

export class TaskManagementApi {
  constructor(private client: BaseApiClient) {}

  async getStats(options?: { signal?: AbortSignal }): Promise<TaskStats> {
    return this.client.get<TaskStats>('/tasks/stats', {
      signal: options?.signal,
    });
  }

  async getList(
    params?: {
      page?: number;
      pageSize?: number;
      status?: string;
      type?: string;
      userId?: string;
    },
    options?: { signal?: AbortSignal },
  ): Promise<{ items: Task[]; total: number; totalPages: number }> {
    return this.client.get('/tasks', { params, signal: options?.signal });
  }

  async cancel(taskId: string, reason?: string): Promise<void> {
    return this.client.post(`/tasks/${taskId}/cancel`, { reason });
  }

  async retry(taskId: string): Promise<void> {
    return this.client.post(`/tasks/${taskId}/retry`, {});
  }
}
