/**
 * Offer Management Client
 * 处理Offer相关的所有API操作
 */

import BaseApiClient from '../../core/BaseApiClient';
import type {
  Offer,
  OfferStats,
  OfferQualityMetrics,
  FailureReasonsResponse,
  ProblemOffersResponse,
} from '../../types/console';

const CONSOLE_API_BASE_URL =
  process.env.NEXT_PUBLIC_CONSOLE_API_URL ||
  'https://console-yt54xvsg5q-an.a.run.app/api/v1/console';

export class OfferManagementClient extends BaseApiClient {
  constructor() {
    super(CONSOLE_API_BASE_URL);
  }

  /**
   * 获取 Offer 统计信息
   */
  async getOfferStats(options?: { signal?: AbortSignal }): Promise<OfferStats> {
    return this.get<OfferStats>('/offers/stats', { signal: options?.signal });
  }

  /**
   * 获取 Offer 列表
   */
  async getOffers(
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
    return this.get('/offers', { params, signal: options?.signal });
  }

  /**
   * 批量归档 Offer
   */
  async batchArchiveOffers(data: {
    offerIds: string[];
    reason: string;
  }): Promise<void> {
    return this.post('/offers/batch-archive', data);
  }

  /**
   * 获取Offer质量指标
   */
  async getOfferQualityMetrics(options?: { signal?: AbortSignal }): Promise<OfferQualityMetrics> {
    return this.get<OfferQualityMetrics>('/offers/quality-metrics', { signal: options?.signal });
  }

  /**
   * 获取失败原因分析
   */
  async getFailureReasons(options?: { signal?: AbortSignal }): Promise<FailureReasonsResponse> {
    return this.get<FailureReasonsResponse>('/offers/failure-reasons', { signal: options?.signal });
  }

  /**
   * 获取问题Offer列表
   */
  async getProblemOffers(options?: { signal?: AbortSignal }): Promise<ProblemOffersResponse> {
    return this.get<ProblemOffersResponse>('/offers/problem-offers', { signal: options?.signal });
  }
}

export const offerManagementClient = new OfferManagementClient();
