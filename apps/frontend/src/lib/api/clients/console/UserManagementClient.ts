/**
 * User Management Client
 * 处理用户管理相关的所有API操作
 */

import BaseApiClient from '../../core/BaseApiClient';
import type {
  UserSearchResponse,
  UserActivityTimelineResponse,
  SuccessMetrics,
  NpsFeedbackRequest,
} from '../../types/console';

const CONSOLE_API_BASE_URL =
  process.env.NEXT_PUBLIC_CONSOLE_API_URL ||
  'https://console-yt54xvsg5q-an.a.run.app/api/v1/console';

export class UserManagementClient extends BaseApiClient {
  constructor() {
    super(CONSOLE_API_BASE_URL);
  }

  /**
   * 搜索用户
   */
  async searchUsers(
    params: {
      q?: string;
      query?: string;
      status?: string;
      tag?: string;
      limit?: number;
    },
    options?: { signal?: AbortSignal },
  ): Promise<UserSearchResponse> {
    return this.get<UserSearchResponse>('/users/search', { params, signal: options?.signal });
  }

  /**
   * 获取用户活动时间线
   */
  async getUserActivityTimeline(
    userId: string,
    limit: number = 20,
    options?: { signal?: AbortSignal },
  ): Promise<UserActivityTimelineResponse> {
    return this.get(`/users/${userId}/activity-timeline`, { params: { limit }, signal: options?.signal });
  }

  /**
   * 为用户添加标签
   */
  async addUserTag(
    userId: string,
    tag: string,
    note?: string,
  ): Promise<{ status: string }> {
    return this.post(`/users/${userId}/tags`, { tag, note });
  }

  /**
   * 移除用户标签
   */
  async removeUserTag(userId: string, tag: string): Promise<{ status: string }> {
    return this.delete(`/users/${userId}/tags/${tag}`);
  }

  /**
   * 获取成功指标
   */
  async getSuccessMetrics(options?: { signal?: AbortSignal }): Promise<SuccessMetrics> {
    return this.get<SuccessMetrics>('/success-metrics', { signal: options?.signal });
  }

  /**
   * 提交 NPS 反馈
   */
  async submitNpsFeedback(payload: NpsFeedbackRequest): Promise<void> {
    return this.post('/success-metrics/nps-feedback', payload);
  }
}

export const userManagementClient = new UserManagementClient();
