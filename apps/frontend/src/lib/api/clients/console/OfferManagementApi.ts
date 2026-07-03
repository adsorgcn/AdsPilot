/**
 * Offer Management API
 * Console API 的 Offer 管理功能
 */

import type BaseApiClient from '../../core/BaseApiClient';
import type { Offer, OfferStats } from '../../types/console';

export class OfferManagementApi {
  constructor(private client: BaseApiClient) {}

  /**
   * 获取 Offer 统计信息
   */
  async getStats(options?: { signal?: AbortSignal }): Promise<OfferStats> {
    return this.client.get<OfferStats>('/offers/stats', {
      signal: options?.signal,
    });
  }

  /**
   * 获取 Offer 列表
   */
  async getList(
    params?: {
      page?: number;
      pageSize?: number;
      status?: string;
      search?: string;
      userEmail?: string;
      minScore?: number;
      maxScore?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
    options?: { signal?: AbortSignal },
  ): Promise<{ items: Offer[]; total: number; totalPages: number }> {
    return this.client.get('/offers', { params, signal: options?.signal });
  }

  /**
   * 批量归档 Offer
   */
  async batchArchive(data: {
    offerIds: string[];
    reason: string;
  }): Promise<void> {
    return this.client.post('/offers/batch-archive', data);
  }
}
