/**
 * 优化后的Billing服务
 *
 * 专注于计费、订阅、定价策略等核心业务逻辑
 * 通过统一用户服务获取用户信息和权限
 */

import { BaseApiClient } from '../core/BaseApiClient';
import { unifiedUserService } from './UnifiedUserService';
import type { UserPermissions } from './UnifiedUserService';

export interface SubscriptionInfo {
  id: string;
  plan: string;
  status: 'active' | 'cancelled' | 'expired' | 'trial';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEndsAt?: string;
  renewsAt?: string;
}

export interface TokenCost {
  aiEvaluation: number;
  basicEvaluation: number;
  offerCreation: number;
  advancedAnalysis: number;
  dataExport: number;
}

export interface PricingConfig {
  id: string;
  name: string;
  price: number;
  billingCycle: 'monthly' | 'yearly';
  features: string[];
  tokensPerMonth: number;
  maxOffersPerMonth: number;
  canUseAI: boolean;
  canManageAds: boolean;
  canExportData: boolean;
}

export interface TokenTransaction {
  id: string;
  userId: string;
  type: 'purchase' | 'consumption' | 'refund' | 'bonus';
  amount: number;
  balance: number;
  description: string;
  referenceId?: string;
  createdAt: string;
}

export interface UsageMetrics {
  currentPeriodUsage: {
    tokensUsed: number;
    offersCreated: number;
    aiEvaluations: number;
    dataExports: number;
  };
  periodStart: string;
  periodEnd: string;
  allowances: {
    tokensPerMonth: number;
    maxOffersPerMonth: number;
  };
}

export class OptimizedBillingService extends BaseApiClient {
  constructor() {
    super(process.env.NEXT_PUBLIC_API_BASE_URL || '');
  }

  // === 订阅管理 ===

  /**
   * 获取用户订阅信息
   * 通过统一用户服务获取权限信息
   */
  async getUserSubscription(userId: string): Promise<SubscriptionInfo | null> {
    try {
      // 首先从统一用户服务获取权限信息
      const permissions = await unifiedUserService.getUserPermissions(userId);

      if (!permissions) {
        return null;
      }

      // 构建订阅信息
      const subscriptionInfo: SubscriptionInfo = {
        id: permissions.subscriptionPlan,
        plan: permissions.subscriptionPlan,
        status: this.getSubscriptionStatus(permissions),
        currentPeriodStart: this.getPeriodStart(),
        currentPeriodEnd: this.getPeriodEnd(permissions),
        cancelAtPeriodEnd: false,
        trialEndsAt: permissions.trialEndsAt,
        renewsAt: permissions.subscriptionExpiresAt
      };

      return subscriptionInfo;
    } catch (error) {
      console.error('[OptimizedBillingService] Error getting user subscription:', error);
      return null;
    }
  }

  /**
   * 检查用户是否可以订阅特定套餐
   */
  async canSubscribeToPlan(userId: string, planId: string): Promise<boolean> {
    try {
      const [currentPermissions, userPermissions] = await Promise.all([
        unifiedUserService.getUserPermissions(userId),
        unifiedUserService.getUserPermissions(userId)
      ]);

      // 管理员无需订阅
      if (currentPermissions.isAdmin) {
        return false;
      }

      // 检查是否可以升级
      return this.canUpgradePlan(currentPermissions.subscriptionPlan, planId);
    } catch (error) {
      console.error('[OptimizedBillingService] Error checking subscription eligibility:', error);
      return false;
    }
  }

  /**
   * 创建订阅
   */
  async createSubscription(userId: string, planId: string, paymentMethodId: string): Promise<{
    success: boolean;
    subscription?: SubscriptionInfo;
    error?: string;
  }> {
    try {
      // 检查订阅资格
      const canSubscribe = await this.canSubscribeToPlan(userId, planId);
      if (!canSubscribe) {
        return {
          success: false,
          error: 'Not eligible for this subscription plan'
        };
      }

      // 执行订阅创建
      const subscription = await this.post<SubscriptionInfo>('/api/v1/billing/subscriptions', {
        userId,
        planId,
        paymentMethodId
      });

      return {
        success: true,
        subscription
      };
    } catch (error) {
      console.error('[OptimizedBillingService] Error creating subscription:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // === Token管理 ===

  /**
   * 获取用户Token余额
   * 委托给统一用户服务
   */
  async getUserTokenBalance(userId: string) {
    return unifiedUserService.getUserTokenBalance(userId);
  }

  /**
   * 扣除Token用于操作
   * 委托给统一用户服务
   */
  async deductTokensForOperation(
    userId: string,
    operation: 'ai_evaluation' | 'offer_creation' | 'data_export' | 'advanced_analysis',
    referenceId?: string
  ) {
    const costs = await this.getTokenCosts();
    const amount = costs[operation] || 1;

    return unifiedUserService.deductTokensForOperation(
      userId,
      amount,
      `Token deduction for ${operation}`,
      referenceId
    );
  }

  /**
   * 获取Token交易记录
   */
  async getTokenTransactions(userId: string, limit = 50): Promise<TokenTransaction[]> {
    return this.get<TokenTransaction[]>(`/api/v1/billing/tokens/transactions?userId=${userId}&limit=${limit}`);
  }

  // === 定价管理 ===

  /**
   * 获取Token成本配置
   */
  async getTokenCosts(): Promise<TokenCost> {
    return this.get<TokenCost>('/api/v1/billing/config/token-costs');
  }

  /**
   * 获取定价配置
   */
  async getPricingConfigs(): Promise<PricingConfig[]> {
    return this.get<PricingConfig[]>('/api/v1/billing/config/pricing');
  }

  /**
   * 获取使用指标
   */
  async getUsageMetrics(userId: string): Promise<UsageMetrics> {
    try {
      // 从统一用户服务获取权限信息
      const permissions = await unifiedUserService.getUserPermissions(userId);
      const stats = await unifiedUserService.getUserActivityStats(userId);

      // 获取实际使用数据
      const transactions = await this.getTokenTransactions(userId, 1000);

      // 计算当期使用量
      const periodStart = this.getPeriodStart();
      const currentPeriodTransactions = transactions.filter(
        t => new Date(t.createdAt) >= new Date(periodStart)
      );

      const currentPeriodUsage = {
        tokensUsed: currentPeriodTransactions
          .filter(t => t.type === 'consumption')
          .reduce((sum, t) => sum + Math.abs(t.amount), 0),
        offersCreated: stats.totalOffers,
        aiEvaluations: currentPeriodTransactions
          .filter(t => t.description.includes('ai_evaluation'))
          .length,
        dataExports: currentPeriodTransactions
          .filter(t => t.description.includes('data_export'))
          .length
      };

      return {
        currentPeriodUsage,
        periodStart,
        periodEnd: this.getPeriodEnd(permissions),
        allowances: {
          tokensPerMonth: permissions.maxTokensPerMonth,
          maxOffersPerMonth: permissions.maxOffersPerMonth
        }
      };
    } catch (error) {
      console.error('[OptimizedBillingService] Error getting usage metrics:', error);
      throw error;
    }
  }

  // === 权限和套餐管理 ===

  /**
   * 检查用户功能权限
   * 委托给统一用户服务
   */
  async checkUserPermission(userId: string, permission: keyof UserPermissions): Promise<boolean> {
    return unifiedUserService.checkUserPermission(userId, permission);
  }

  /**
   * 检查用户是否可以使用AI
   */
  async canUserUseAI(userId: string): Promise<boolean> {
    return unifiedUserService.checkUserPermission(userId, 'canUseAI');
  }

  /**
   * 检查用户是否可以创建Offer
   * 委托给统一用户服务
   */
  async canUserCreateOffer(userId: string): Promise<boolean> {
    return unifiedUserService.canUserCreateOffer(userId);
  }

  /**
   * 获取可用套餐升级选项
   */
  async getUpgradeOptions(userId: string): Promise<string[]> {
    try {
      const permissions = await unifiedUserService.getUserPermissions(userId);

      if (permissions.isAdmin) {
        return [];
      }

      const planHierarchy = ['trial', 'starter', 'professional', 'enterprise'];
      const currentIndex = planHierarchy.indexOf(permissions.subscriptionPlan);

      return planHierarchy.slice(currentIndex + 1);
    } catch (error) {
      console.error('[OptimizedBillingService] Error getting upgrade options:', error);
      return [];
    }
  }

  // === 辅助方法 ===

  private getSubscriptionStatus(permissions: UserPermissions): SubscriptionInfo['status'] {
    if (permissions.isAdmin) return 'active';
    if (permissions.isOnTrial && permissions.trialEndsAt) {
      return new Date(permissions.trialEndsAt) > new Date() ? 'trial' : 'expired';
    }
    if (permissions.subscriptionExpiresAt) {
      return new Date(permissions.subscriptionExpiresAt) > new Date() ? 'active' : 'expired';
    }
    return 'cancelled';
  }

  private getPeriodStart(): string {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return firstDay.toISOString();
  }

  private getPeriodEnd(permissions: UserPermissions): string {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // 如果是试用，使用试用结束时间
    if (permissions.isOnTrial && permissions.trialEndsAt) {
      return permissions.trialEndsAt;
    }

    // 如果有订阅结束时间，使用订阅结束时间
    if (permissions.subscriptionExpiresAt) {
      return permissions.subscriptionExpiresAt;
    }

    // 否则使用月底
    return lastDay.toISOString();
  }

  private canUpgradePlan(currentPlan: string, targetPlan: string): boolean {
    const planHierarchy = ['trial', 'starter', 'professional', 'enterprise'];
    const currentIndex = planHierarchy.indexOf(currentPlan);
    const targetIndex = planHierarchy.indexOf(targetPlan);

    return targetIndex > currentIndex;
  }
}

// 创建全局实例
export const optimizedBillingService = new OptimizedBillingService();

// 导出便捷方法
export const {
  getUserSubscription,
  canSubscribeToPlan,
  createSubscription,
  getUserTokenBalance,
  deductTokensForOperation,
  getTokenTransactions,
  checkUserPermission,
  canUserUseAI,
  canUserCreateOffer,
  getUpgradeOptions
} = optimizedBillingService;