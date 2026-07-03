/**
 * Subscription Management API
 */

import type BaseApiClient from '../../core/BaseApiClient';
import type { Subscription, SubscriptionStats } from '../../types/console';

export class SubscriptionManagementApi {
  constructor(private client: BaseApiClient) {}

  async getStats(options?: { signal?: AbortSignal }): Promise<SubscriptionStats> {
    return this.client.get<SubscriptionStats>('/subscriptions/stats', {
      signal: options?.signal,
    });
  }

  async getList(
    params?: {
      page?: number;
      pageSize?: number;
      status?: string;
      search?: string;
    },
    options?: { signal?: AbortSignal },
  ): Promise<{ items: Subscription[]; total: number; totalPages: number }> {
    return this.client.get('/subscriptions', { params, signal: options?.signal });
  }

  async updateStatus(
    subscriptionId: string,
    data: {
      status: string;
      reason?: string;
    },
  ): Promise<void> {
    return this.client.post(`/subscriptions/${subscriptionId}/status`, data);
  }
}
