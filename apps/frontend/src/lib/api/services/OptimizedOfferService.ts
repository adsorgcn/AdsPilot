/**
 * 优化后的Offer服务
 *
 * 专注于Offer创建、评估、管理等核心业务逻辑
 * 通过统一用户服务获取用户权限和资源信息
 */

import { BaseApiClient } from '../core/BaseApiClient';
import { unifiedUserService } from './UnifiedUserService';
import { userActivityService } from './UserActivityService';

export interface Offer {
  id: string;
  userId: string;
  name: string;
  originalUrl: string;
  domain: string;
  brandName?: string;
  description?: string;
  targetCountries: string[];
  status: 'pending_evaluation' | 'evaluating' | 'evaluation_failed' | 'evaluated' | 'click_task_running' | 'ready_to_deploy' | 'deploying' | 'deployed' | 'archived';
  siterankScore?: number;
  aiRecommendationScore?: number;
  aiRecommendationReasons?: string[];
  similarwebData?: any;
  redirectChain?: any;
  createdAt: string;
  updatedAt: string;
  evaluationCompletedAt?: string;
}

export interface OfferEvaluation {
  id: string;
  offerId: string;
  score: number;
  brandName: string;
  similarwebData: any;
  redirectChain: any;
  aiRecommendationScore: number;
  aiRecommendationReasons: string[];
  tokensConsumed: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface OfferMetrics {
  id: string;
  offerId: string;
  impressions: number;
  clicks: number;
  ctr: number;
  avgCpc: number;
  totalRevenue: number;
  totalSpend: number;
  roas: number;
  date: string;
}

export interface OfferFilters {
  status?: Offer['status'][];
  userId?: string;
  domain?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  sortBy?: 'createdAt' | 'updatedAt' | 'siterankScore' | 'aiRecommendationScore';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  perPage?: number;
}

export interface OfferCreationRequest {
  name: string;
  originalUrl: string;
  description?: string;
  targetCountries: string[];
  autoEvaluate?: boolean;
}

export class OptimizedOfferService extends BaseApiClient {
  constructor() {
    super(process.env.NEXT_PUBLIC_API_BASE_URL || '');
  }

  // === Offer管理 ===

  /**
   * 创建新Offer
   * 通过统一用户服务检查权限和资源
   */
  async createOffer(userId: string, data: OfferCreationRequest): Promise<{
    success: boolean;
    offer?: Offer;
    error?: string;
    requiresToken?: boolean;
    insufficientBalance?: boolean;
  }> {
    try {
      // 1. 检查用户是否可以创建Offer
      const canCreate = await unifiedUserService.canUserCreateOffer(userId);
      if (!canCreate) {
        return {
          success: false,
          error: 'You do not have permission to create offers',
          requiresToken: false
        };
      }

      // 2. 检查是否需要Token预留
      const permissions = await unifiedUserService.getUserPermissions(userId);
      const requiresToken = permissions.canUseAI && data.autoEvaluate;

      let reservationId: string | undefined;

      if (requiresToken) {
        // 3. 预留Token用于AI评估
        const reservation = await unifiedUserService.reserveTokens(
          userId,
          3, // AI评估消耗3个Token
          'AI evaluation for new offer'
        );
        reservationId = reservation.id;
      }

      try {
        // 4. 创建Offer
        const offer = await this.post<Offer>('/api/v1/offers', {
          ...data,
          userId,
          tokenReservationId: reservationId
        });

        // 5. 确认Token预留
        if (reservationId) {
          await unifiedUserService.confirmTokenReservation(reservationId);
        }

        // 6. 追踪活动
        await userActivityService.trackOfferActivity(userId, offer.id, 'created', {
          autoEvaluate: data.autoEvaluate,
          tokenCost: requiresToken ? 3 : 0
        });

        return {
          success: true,
          offer,
          requiresToken
        };
      } catch (error) {
        // 7. 失败时取消Token预留
        if (reservationId) {
          await unifiedUserService.cancelTokenReservation(reservationId);
        }

        throw error;
      }
    } catch (error) {
      console.error('[OptimizedOfferService] Error creating offer:', error);

      // 提供具体的错误信息
      let errorMessage = 'Failed to create offer';
      if (error instanceof Error) {
        if (error.message.includes('Insufficient balance')) {
          errorMessage = 'Insufficient token balance';
        } else if (error.message.includes('permission')) {
          errorMessage = 'Permission denied';
        } else {
          errorMessage = error.message;
        }
      }

      return {
        success: false,
        error: errorMessage,
        requiresToken: data.autoEvaluate,
        insufficientBalance: errorMessage.includes('Insufficient')
      };
    }
  }

  /**
   * 获取用户Offers列表
   */
  async getUserOffers(userId: string, filters: OfferFilters = {}): Promise<{
    offers: Offer[];
    pagination: {
      total: number;
      page: number;
      perPage: number;
      hasMore: boolean;
    };
  }> {
    const params = new URLSearchParams();

    if (filters.status?.length) params.set('status', filters.status.join(','));
    if (filters.domain) params.set('domain', filters.domain);
    if (filters.dateRange) {
      params.set('start_date', filters.dateRange.start);
      params.set('end_date', filters.dateRange.end);
    }
    if (filters.sortBy) params.set('sort_by', filters.sortBy);
    if (filters.sortOrder) params.set('sort_order', filters.sortOrder);
    params.set('page', String(filters.page || 1));
    params.set('per_page', String(filters.perPage || 20));

    return this.get(`/api/v1/offers/user/${userId}?${params.toString()}`);
  }

  /**
   * 获取单个Offer详情
   */
  async getOffer(offerId: string): Promise<Offer> {
    return this.get<Offer>(`/api/v1/offers/${offerId}`);
  }

  /**
   * 更新Offer信息
   */
  async updateOffer(offerId: string, userId: string, data: Partial<Offer>): Promise<Offer> {
    // 验证用户权限
    const offer = await this.getOffer(offerId);
    if (offer.userId !== userId) {
      throw new Error('Permission denied: You can only update your own offers');
    }

    const updatedOffer = await this.patch<Offer>(`/api/v1/offers/${offerId}`, data);

    // 追踪更新活动
    await userActivityService.trackOfferActivity(userId, offerId, 'updated', {
      fields: Object.keys(data)
    });

    return updatedOffer;
  }

  /**
   * 删除Offer
   */
  async deleteOffer(offerId: string, userId: string): Promise<void> {
    // 验证用户权限
    const offer = await this.getOffer(offerId);
    if (offer.userId !== userId) {
      throw new Error('Permission denied: You can only delete your own offers');
    }

    await this.delete(`/api/v1/offers/${offerId}`);

    // 追踪删除活动
    await userActivityService.trackOfferActivity(userId, offerId, 'deleted');
  }

  // === Offer评估 ===

  /**
   * 启动AI评估
   * 通过统一用户服务管理Token
   */
  async startAIEvaluation(offerId: string, userId: string): Promise<{
    success: boolean;
    evaluation?: OfferEvaluation;
    error?: string;
    insufficientBalance?: boolean;
  }> {
    try {
      // 1. 检查AI使用权限
      const canUseAI = await unifiedUserService.checkUserPermission(userId, 'canUseAI');
      if (!canUseAI) {
        return {
          success: false,
          error: 'Your subscription plan does not include AI evaluation features'
        };
      }

      // 2. 预留Token
      const reservation = await unifiedUserService.reserveTokens(
        userId,
        3,
        `AI evaluation for offer ${offerId}`,
        offerId
      );

      try {
        // 3. 启动评估
        const evaluation = await this.post<OfferEvaluation>(`/api/v1/offers/${offerId}/evaluate`, {
          tokenReservationId: reservation.id
        });

        // 4. 确认Token扣除
        await unifiedUserService.confirmTokenReservation(reservation.id);

        // 5. 追踪评估活动
        await userActivityService.trackActivity(userId, {
          type: 'feature_used',
          description: `AI evaluation started for offer ${offerId}`,
          metadata: { offerId, tokenCost: 3 }
        });

        return {
          success: true,
          evaluation
        };
      } catch (error) {
        // 6. 失败时取消预留
        await unifiedUserService.cancelTokenReservation(reservation.id);
        throw error;
      }
    } catch (error) {
      console.error('[OptimizedOfferService] Error starting AI evaluation:', error);

      let errorMessage = 'Failed to start AI evaluation';
      let insufficientBalance = false;

      if (error instanceof Error) {
        if (error.message.includes('Insufficient balance')) {
          errorMessage = 'Insufficient token balance for AI evaluation';
          insufficientBalance = true;
        } else if (error.message.includes('permission')) {
          errorMessage = 'Your subscription plan does not include AI evaluation features';
        } else {
          errorMessage = error.message;
        }
      }

      return {
        success: false,
        error: errorMessage,
        insufficientBalance
      };
    }
  }

  /**
   * 获取Offer评估结果
   */
  async getOfferEvaluation(offerId: string): Promise<OfferEvaluation | null> {
    return this.get<OfferEvaluation>(`/api/v1/offers/${offerId}/evaluation`).catch(() => null);
  }

  /**
   * 获取所有评估结果
   */
  async getOfferEvaluations(offerId: string): Promise<OfferEvaluation[]> {
    return this.get<OfferEvaluation[]>(`/api/v1/offers/${offerId}/evaluations`);
  }

  // === Offer指标 ===

  /**
   * 获取Offer性能指标
   */
  async getOfferMetrics(offerId: string, dateRange?: { start: string; end: string }): Promise<OfferMetrics[]> {
    const params = new URLSearchParams();
    if (dateRange) {
      params.set('start_date', dateRange.start);
      params.set('end_date', dateRange.end);
    }

    return this.get<OfferMetrics[]>(`/api/v1/offers/${offerId}/metrics?${params.toString()}`);
  }

  /**
   * 获取用户所有Offer的总指标
   */
  async getUserMetricsSummary(userId: string): Promise<{
    totalOffers: number;
    activeOffers: number;
    totalEarnings: number;
    totalSpend: number;
    averageROAS: number;
    topPerformingOffers: Array<{
      offerId: string;
      name: string;
      revenue: number;
      roas: number;
    }>;
  }> {
    return this.get(`/api/v1/offers/user/${userId}/metrics-summary`);
  }

  // === Offer搜索和发现 ===

  /**
   * 搜索Offers
   */
  async searchOffers(query: string, filters: {
    domain?: string;
    status?: Offer['status'][];
    minScore?: number;
    dateRange?: { start: string; end: string };
  } = {}): Promise<{
    offers: Offer[];
    total: number;
    facets: {
      domains: Array<{ domain: string; count: number }>;
      status: Array<{ status: string; count: number }>;
    };
  }> {
    const params = new URLSearchParams();
    params.set('q', query);

    if (filters.domain) params.set('domain', filters.domain);
    if (filters.status?.length) params.set('status', filters.status.join(','));
    if (filters.minScore) params.set('min_score', String(filters.minScore));
    if (filters.dateRange) {
      params.set('start_date', filters.dateRange.start);
      params.set('end_date', filters.dateRange.end);
    }

    return this.get(`/api/v1/offers/search?${params.toString()}`);
  }

  /**
   * 获取推荐Offers
   */
  async getRecommendedOffers(userId: string, limit = 10): Promise<{
    offers: Offer[];
    reason: string;
  }> {
    return this.get(`/api/v1/offers/recommendations/${userId}?limit=${limit}`);
  }

  // === 权限和资源检查 ===

  /**
   * 检查用户是否可以创建Offer
   * 委托给统一用户服务
   */
  async canUserCreateOffer(userId: string): Promise<boolean> {
    return unifiedUserService.canUserCreateOffer(userId);
  }

  /**
   * 检查用户是否可以使用AI功能
   * 委托给统一用户服务
   */
  async canUserUseAI(userId: string): Promise<boolean> {
    return unifiedUserService.checkUserPermission(userId, 'canUseAI');
  }

  /**
   * 获取用户Offer创建限制
   */
  async getUserOfferLimits(userId: string): Promise<{
    maxOffersPerMonth: number;
    currentOffers: number;
    remainingOffers: number;
    canCreateMore: boolean;
    nextResetDate: string;
  }> {
    const [permissions, stats] = await Promise.all([
      unifiedUserService.getUserPermissions(userId),
      unifiedUserService.getUserActivityStats(userId)
    ]);

    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return {
      maxOffersPerMonth: permissions.maxOffersPerMonth,
      currentOffers: stats.totalOffers,
      remainingOffers: Math.max(0, permissions.maxOffersPerMonth - stats.totalOffers),
      canCreateMore: stats.totalOffers < permissions.maxOffersPerMonth,
      nextResetDate: nextMonth.toISOString()
    };
  }
}

// 创建全局实例
export const optimizedOfferService = new OptimizedOfferService();

// 导出便捷方法
export const {
  createOffer,
  getUserOffers,
  getOffer,
  updateOffer,
  deleteOffer,
  startAIEvaluation,
  getOfferEvaluation,
  getOfferMetrics,
  searchOffers,
  getRecommendedOffers,
  canUserCreateOffer,
  canUserUseAI,
  getUserOfferLimits
} = optimizedOfferService;