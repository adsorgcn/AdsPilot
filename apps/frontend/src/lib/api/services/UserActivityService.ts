/**
 * 用户活动服务 (UserActivity Service)
 *
 * 专门处理用户行为追踪、活动时间线、统计数据分析
 * 与统一用户服务协同工作，避免功��重复
 */

import { BaseApiClient } from '../core/BaseApiClient';
import { unifiedUserService } from './UnifiedUserService';

export interface ActivityEvent {
  id: string;
  userId: string;
  type: 'login' | 'logout' | 'offer_created' | 'offer_evaluated' | 'token_purchased' | 'token_consumed' | 'subscription_changed' | 'feature_used';
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface ActivityTimeline {
  events: ActivityEvent[];
  pagination: {
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  };
}

export interface ActivityMetrics {
  userId: string;
  period: 'daily' | 'weekly' | 'monthly';
  startDate: string;
  endDate: string;
  metrics: {
    totalEvents: number;
    loginCount: number;
    offersCreated: number;
    offersEvaluated: number;
    tokensConsumed: number;
    tokensPurchased: number;
    activeDays: number;
    avgDailyActivity: number;
    mostActiveHour: number;
    lastActivityAt: string;
  };
  trends: Array<{
    date: string;
    events: number;
    logins: number;
    offers: number;
    tokens: number;
  }>;
}

export interface UserBehaviorProfile {
  userId: string;
  patterns: {
    activityFrequency: 'daily' | 'weekly' | 'monthly' | 'rare';
    peakActivityHours: number[];
    preferredFeatures: string[];
    usagePatterns: {
      aiEvaluationUsage: number;
      dataExportUsage: number;
      collaborationFeatures: number;
    };
  };
  engagement: {
    dailyStreakDays: number;
    longestStreakDays: number;
    totalActiveDays: number;
    averageSessionDuration: number;
    bounceRate: number;
  };
  predictions: {
    churnRisk: 'low' | 'medium' | 'high';
    likelyToUpgrade: boolean;
    recommendedFeatures: string[];
    nextMilestone: string;
  };
}

export class UserActivityService extends BaseApiClient {
  constructor() {
    super(process.env.NEXT_PUBLIC_API_BASE_URL || '');
  }

  // === 活动追踪 ===

  /**
   * 记录用户活动事件
   */
  async trackActivity(userId: string, event: {
    type: ActivityEvent['type'];
    description: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await this.post('/api/v1/users/activity/track', {
        userId,
        type: event.type,
        description: event.description,
        metadata: event.metadata,
        timestamp: new Date().toISOString(),
        // 自动添加基础信息
        context: {
          userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
          url: typeof window !== 'undefined' ? window.location.href : undefined,
        }
      });
    } catch (error) {
      console.error('[UserActivityService] Failed to track activity:', error);
      // 活动追踪失败不应影响主要功能
    }
  }

  /**
   * 获取用户活动时间线
   */
  async getUserActivityTimeline(
    userId: string,
    options: {
      page?: number;
      perPage?: number;
      eventTypes?: ActivityEvent['type'][];
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<ActivityTimeline> {
    const params = new URLSearchParams();

    if (options.page) params.set('page', String(options.page));
    if (options.perPage) params.set('per_page', String(options.perPage));
    if (options.eventTypes?.length) params.set('event_types', options.eventTypes.join(','));
    if (options.startDate) params.set('start_date', options.startDate);
    if (options.endDate) params.set('end_date', options.endDate);

    return this.get<ActivityTimeline>(
      `/api/v1/users/${userId}/activity/timeline?${params.toString()}`
    );
  }

  /**
   * 获取用户活动指标
   * 与统一用户服务的统计信息协同
   */
  async getActivityMetrics(
    userId: string,
    period: 'daily' | 'weekly' | 'monthly' = 'weekly'
  ): Promise<ActivityMetrics> {
    // 从统一用户服务获取基础统计
    const basicStats = await unifiedUserService.getUserActivityStats(userId);

    // 获取详细的活动指标
    const detailedMetrics = await this.get<ActivityMetrics>(
      `/api/v1/users/${userId}/activity/metrics?period=${period}`
    );

    // 合并基础统计和详细指标
    return {
      ...detailedMetrics,
      metrics: {
        ...detailedMetrics.metrics,
        // 使用统一用户服务的数据作为补充
        totalOffers: basicStats.totalOffers,
        totalEarnings: basicStats.totalEarnings,
        lastActiveAt: basicStats.lastActiveAt
      }
    };
  }

  // === 用户行为分析 ===

  /**
   * 获取用户行为画像
   */
  async getUserBehaviorProfile(userId: string): Promise<UserBehaviorProfile> {
    return this.get<UserBehaviorProfile>(`/api/v1/users/${userId}/behavior/profile`);
  }

  /**
   * 预测用户行为趋势
   */
  async predictUserBehavior(userId: string): Promise<{
    churnRisk: 'low' | 'medium' | 'high';
    upgradeLikelihood: 'low' | 'medium' | 'high';
    recommendedActions: string[];
    nextMilestonePrediction: string;
  }> {
    return this.get(`/api/v1/users/${userId}/behavior/predictions`);
  }

  // === 管理后台功能 ===

  /**
   * 获取多用户活动概览
   */
  async getActivityOverview(options: {
    userIds?: string[];
    dateRange: { start: string; end: string };
    groupBy?: 'user' | 'date' | 'eventType';
  } = {}): Promise<{
    summary: {
      totalEvents: number;
      activeUsers: number;
      topEventTypes: Array<{ type: string; count: number }>;
      dailyActivity: Array<{ date: string; events: number; users: number }>;
    };
    details: any;
  }> {
    const params = new URLSearchParams();

    if (options.userIds?.length) params.set('user_ids', options.userIds.join(','));
    params.set('start_date', options.dateRange.start);
    params.set('end_date', options.dateRange.end);
    if (options.groupBy) params.set('group_by', options.groupBy);

    return this.get(`/api/v1/admin/activity/overview?${params.toString()}`);
  }

  /**
   * 获取用户活跃度报告
   */
  async getEngagementReport(options: {
    period: 'daily' | 'weekly' | 'monthly';
    includeInactive?: boolean;
  } = {}): Promise<{
      period: string;
      totalUsers: number;
      activeUsers: number;
      inactiveUsers: number;
      engagementRate: number;
      dailyActiveUsers: Array<{
        date: string;
        activeUsers: number;
        newUsers: number;
        returningUsers: number;
      }>;
      userSegments: Array<{
        segment: string;
        count: number;
        percentage: number;
        characteristics: string[];
      }>;
    }> {
    const params = new URLSearchParams();
    params.set('period', options.period);
    if (options.includeInactive !== undefined) {
      params.set('include_inactive', String(options.includeInactive));
    }

    return this.get(`/api/v1/admin/activity/engagement?${params.toString()}`);
  }

  // === 便捷方法 ===

  /**
   * 追踪Offer相关活动
   */
  async trackOfferActivity(userId: string, offerId: string, action: string, metadata?: any) {
    await this.trackActivity(userId, {
      type: action.includes('created') ? 'offer_created' : 'offer_evaluated',
      description: `Offer ${action}: ${offerId}`,
      metadata: {
        offerId,
        action,
        ...metadata
      }
    });
  }

  /**
   * 追踪Token相关活动
   */
  async trackTokenActivity(userId: string, amount: number, type: 'purchased' | 'consumed', reason: string) {
    await this.trackActivity(userId, {
      type: type === 'purchased' ? 'token_purchased' : 'token_consumed',
      description: `Token ${type}: ${amount} (${reason})`,
      metadata: { amount, type, reason }
    });
  }

  /**
   * 追踪订阅相关活动
   */
  async trackSubscriptionActivity(userId: string, action: string, plan?: string) {
    await this.trackActivity(userId, {
      type: 'subscription_changed',
      description: `Subscription ${action}${plan ? ` to ${plan}` : ''}`,
      metadata: { action, plan }
    });
  }

  /**
   * 追踪功能使用情况
   */
  async trackFeatureUsage(userId: string, feature: string, details?: any) {
    await this.trackActivity(userId, {
      type: 'feature_used',
      description: `Feature used: ${feature}`,
      metadata: { feature, ...details }
    });
  }

  // === 与统一用户服务的协同 ===

  /**
   * 获取用户完整活动信息
   * 结合统一用户服务的基础信息和活动服务的详细行为数据
   */
  async getUserCompleteActivityInfo(userId: string) {
    try {
      // 并行获取基础信息和活动数据
      const [userInfo, permissions, activityMetrics, behaviorProfile] = await Promise.all([
        unifiedUserService.getUserProfile(userId),
        unifiedUserService.getUserPermissions(userId),
        this.getActivityMetrics(userId, 'weekly'),
        this.getUserBehaviorProfile(userId)
      ]);

      return {
        user: userInfo,
        permissions,
        activity: activityMetrics,
        behavior: behaviorProfile,
        insights: {
          engagement: behaviorProfile.engagement,
          predictions: behaviorProfile.predictions,
          recommendations: this.generateRecommendations(userInfo, permissions, behaviorProfile)
        }
      };
    } catch (error) {
      console.error('[UserActivityService] Error getting complete activity info:', error);
      throw error;
    }
  }

  /**
   * 生成用户推荐
   */
  private generateRecommendations(
    userProfile: any,
    permissions: any,
    behaviorProfile: UserBehaviorProfile
  ): string[] {
    const recommendations: string[] = [];

    // 基于使用模式的推荐
    if (behaviorProfile.patterns.usagePatterns.aiEvaluationUsage > 5) {
      recommendations.push('考虑升级到专业版以获得更多AI评估额度');
    }

    if (behaviorProfile.patterns.usagePatterns.dataExportUsage > 10) {
      recommendations.push('升级套餐以解锁高级数据导出功能');
    }

    // 基于活跃度的推荐
    if (behaviorProfile.engagement.dailyStreakDays > 7) {
      recommendations.push('保持优秀的使用习惯！查看我们的高级功能');
    }

    if (behaviorProfile.engagement.bounceRate > 0.7) {
      recommendations.push('探索更多功能以获得更好的使用体验');
    }

    // 基于预测的推荐
    if (behaviorProfile.predictions.churnRisk === 'high') {
      recommendations.push('联系我们的客户成功团队以获得帮助');
    }

    return recommendations;
  }
}

// 创建全局实例
export const userActivityService = new UserActivityService();

// 导出便捷方法
export const {
  trackActivity,
  getUserActivityTimeline,
  getActivityMetrics,
  getUserBehaviorProfile,
  trackOfferActivity,
  trackTokenActivity,
  trackSubscriptionActivity,
  trackFeatureUsage,
  getUserCompleteActivityInfo
} = userActivityService;