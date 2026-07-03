/**
 * Task Management Client
 * 处理任务相关的所有API操作
 */

import BaseApiClient from '../../core/BaseApiClient';
import type { Task, TaskStats } from '../../types/console';

const CONSOLE_API_BASE_URL =
  process.env.NEXT_PUBLIC_CONSOLE_API_URL ||
  'https://console-yt54xvsg5q-an.a.run.app/api/v1/console';

export class TaskManagementClient extends BaseApiClient {
  constructor() {
    super(CONSOLE_API_BASE_URL);
  }

  /**
   * 获取任务统计信息
   */
  async getTaskStats(options?: { signal?: AbortSignal }): Promise<TaskStats> {
    return this.get<TaskStats>('/tasks/stats', { signal: options?.signal });
  }

  /**
   * 获取任务列表
   */
  async getTasks(
    params?: {
      page?: number;
      pageSize?: number;
      status?: string;
      userId?: string;
      search?: string;
    },
    options?: { signal?: AbortSignal },
  ): Promise<{ items: Task[]; total: number; totalPages: number }> {
    return this.get('/tasks', { params, signal: options?.signal });
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string, reason: string): Promise<void> {
    return this.post(`/tasks/${taskId}/cancel`, { reason });
  }

  /**
   * 重试任务
   */
  async retryTask(taskId: string): Promise<void> {
    return this.post(`/tasks/${taskId}/retry`);
  }
}

export const taskManagementClient = new TaskManagementClient();
