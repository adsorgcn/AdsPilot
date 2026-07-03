/**
 * 统一用户服务 (Unified User Service)
 *
 * 作为所有用户相关操作的单一入口，消除API职责重叠
 * 负责用户信息、权限、Token管理、状态查询等核��功能
 */

import { BaseApiClient } from '../core/BaseApiClient';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  onboarded: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  notifications: {
    email: boolean;
    push: boolean;
    marketing: boolean;
  };
}

export interface UserPermissions {
  // 基础权限
  isAdmin: boolean;
  role: 'user' | 'admin';

  // 订阅套餐权限
  subscriptionPlan: string;
  canUseAI: boolean;
  canCreateOffers: boolean;
  canManageAds: boolean;
  canViewAnalytics: boolean;
  canManageBilling: boolean;

  // 权限限制
  maxOffersPerMonth: number;
  maxTokensPerMonth: number;
  canExportData: boolean;
  canAccessPrioritySupport: boolean;

  // 权限元数据
  subscriptionExpiresAt?: string;
  isOnTrial: boolean;
  trialEndsAt?: string;
  isSubscriptionValid: boolean;
}

export interface TokenBalance {
  balance: number;
  reserved: number;
  available: number;
  lastUpdated: string;
}

export interface TokenReservation {
  id: string;
  amount: number;
  reason: string;
  referenceId?: string;
  status: 'reserved' | 'confirmed' | 'refunded';
  createdAt: string;
  expiresAt: string;
}

export interface ActivityStats {
  totalOffers: number;
  activeOffers: number;
  totalEarnings: number;
  lastActiveAt: string;
  joinDate: string;
}

export interface SubscriptionStatus {
  isActive: boolean;
  plan: string;
  expiresAt?: string;
  isOnTrial: boolean;
  trialEndsAt?: string;
  canUseAI: boolean;
  limits: {
    offersPerMonth: number;
    tokensPerMonth: number;
    features: string[];
  };
}

export interface AccountLimits {
  maxOffers: number;
  maxTokensPerDay: number;
  maxApiCallsPerHour: number;
  storageQuota: number;
}

export interface ReferralInfo {
  id: string;
  referralCode: string;
  referredUsers: number;
  totalRewards: number;
  createdAt: string;
}

export class UnifiedUserService extends BaseApiClient {
  constructor() {
    super(process.env.NEXT_PUBLIC_API_BASE_URL || '');
  }

  // === 用户身份和基础信息 ===

  /**
   * 获取用户完整档案
   */
  async getUserProfile(userId: string): Promise<UserProfile> {
    return this.get<UserProfile>(`/api/v1/users/${userId}/profile`);
  }

  /**
   * 更新用户档案
   */
  async updateUserProfile(userId: string, profile: Partial<UserProfile>): Promise<UserProfile> {
    return this.patch<UserProfile>(`/api/v1/users/${userId}/profile`, profile);
  }

  /**
   * 获取用户偏好设置
   */
  async getUserPreferences(userId: string): Promise<UserPreferences> {
    return this.get<UserPreferences>(`/api/v1/users/${userId}/preferences`);
  }

  /**
   * 更新用户偏好设置
   */
  async updateUserPreferences(userId: string, prefs: Partial<UserPreferences>): Promise<void> {
    await this.patch(`/api/v1/users/${userId}/preferences`, prefs);
  }

  // === 权限和认证 ===

  /**
   * 获取用户权限信息
   * 权限基于订阅套餐实现，用户只有2个角色：普通用户、管理员
   */
  async getUserPermissions(userId: string): Promise<UserPermissions> {
    return this.get<UserPermissions>(`/api/v1/users/${userId}/permissions`);
  }

  /**
   * 检查用户是否为管理员
   */
  async isUserAdmin(userId: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.isAdmin;
  }

  /**
   * 检查用户是否有特定业务权限
   * 权限基于订阅套餐决定
   */
  async checkUserPermission(userId: string, permission: keyof Omit<UserPermissions, 'isAdmin' | 'role' | 'subscriptionPlan' | 'subscriptionExpiresAt' | 'isOnTrial' | 'trialEndsAt'>): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions[permission] === true;
  }

  /**
   * 检查用户角色
   */
  async hasRole(userId: string, role: 'user' | 'admin'): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.role === role;
  }

  /**
   * 检查用户订阅是否有效
   */
  async isSubscriptionValid(userId: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);

    if (permissions.isAdmin) return true;

    if (permissions.isOnTrial && permissions.trialEndsAt) {
      return new Date(permissions.trialEndsAt) > new Date();
    }

    if (permissions.subscriptionExpiresAt) {
      return new Date(permissions.subscriptionExpiresAt) > new Date();
    }

    return false;
  }

  // === Token和余额管理 ===

  /**
   * 获取用户Token余额
   */
  async getUserTokenBalance(userId: string): Promise<TokenBalance> {
    return this.get<TokenBalance>(`/api/v1/users/${userId}/tokens/balance`);
  }

  /**
   * 更新用户Token余额
   */
  async updateUserTokenBalance(userId: string, delta: number, reason: string): Promise<void> {
    await this.post(`/api/v1/users/${userId}/tokens/balance`, {
      delta,
      reason
    });
  }

  /**
   * 预留Token
   */
  async reserveTokens(userId: string, amount: number, reason: string, referenceId?: string): Promise<TokenReservation> {
    return this.post<TokenReservation>(`/api/v1/users/${userId}/tokens/reserve`, {
      amount,
      reason,
      referenceId
    });
  }

  /**
   * 确认Token预留
   */
  async confirmTokenReservation(reservationId: string): Promise<void> {
    await this.post(`/api/v1/users/tokens/reservations/${reservationId}/confirm`);
  }

  /**
   * 取消Token预留
   */
  async cancelTokenReservation(reservationId: string): Promise<void> {
    await this.post(`/api/v1/users/tokens/reservations/${reservationId}/cancel`);
  }

  // === 用户状态和统计 ===

  /**
   * 获取用户活动统计
   */
  async getUserActivityStats(userId: string): Promise<ActivityStats> {
    return this.get<ActivityStats>(`/api/v1/users/${userId}/stats/activity`);
  }

  /**
   * 获取用户订阅状态
   */
  async getUserSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
    return this.get<SubscriptionStatus>(`/api/v1/users/${userId}/subscription/status`);
  }

  /**
   * 获取用户账户限制
   */
  async getUserAccountLimits(userId: string): Promise<AccountLimits> {
    return this.get<AccountLimits>(`/api/v1/users/${userId}/limits`);
  }

  // === 关系管理 ===

  /**
   * 获取用户推荐信息
   */
  async getUserReferrals(userId: string): Promise<ReferralInfo[]> {
    return this.get<ReferralInfo[]>(`/api/v1/users/${userId}/referrals`);
  }

  /**
   * 创建推荐关系
   */
  async createUserReferral(referrerId: string, referralData: {
    refereeEmail: string;
    refereeName?: string;
  }): Promise<ReferralInfo> {
    return this.post<ReferralInfo>(`/api/v1/users/${referrerId}/referrals`, referralData);
  }

  // === 组合方法 - 简化常见操作 ===

  /**
   * 获取用户完整信息 (档案 + 权限 + 订阅状态)
   */
  async getUserCompleteInfo(userId: string) {
    const [profile, permissions, subscription, tokenBalance] = await Promise.all([
      this.getUserProfile(userId),
      this.getUserPermissions(userId),
      this.getUserSubscriptionStatus(userId),
      this.getUserTokenBalance(userId)
    ]);

    return {
      profile,
      permissions,
      subscription,
      tokenBalance
    };
  }

  /**
   * 检查用户是否可以创建Offer
   * 基于订阅套餐权限和资源限制
   */
  async canUserCreateOffer(userId: string): Promise<boolean> {
    const [permissions, tokenBalance, stats] = await Promise.all([
      this.getUserPermissions(userId),
      this.getUserTokenBalance(userId),
      this.getUserActivityStats(userId)
    ]);

    // 管理员始终可以创建
    if (permissions.isAdmin) return true;

    // 检查订阅权限
    if (!permissions.canCreateOffers) return false;

    // 检查订阅是否有效
    const isSubscriptionValid = await this.isSubscriptionValid(userId);
    if (!isSubscriptionValid) return false;

    // 检查Token余额
    if (tokenBalance.available < 1) return false;

    // 检查月度数量限制
    if (stats.totalOffers >= permissions.maxOffersPerMonth) return false;

    return true;
  }

  /**
   * 为用户操作预留并扣除Token
   */
  async deductTokensForOperation(
    userId: string,
    amount: number,
    reason: string,
    referenceId?: string
  ): Promise<{ success: boolean; reservationId?: string; error?: string }> {
    try {
      // 先预留Token
      const reservation = await this.reserveTokens(userId, amount, reason, referenceId);

      // 确认扣费
      await this.confirmTokenReservation(reservation.id);

      return { success: true, reservationId: reservation.id };
    } catch (error) {
      console.error('[UnifiedUserService] Token deduction failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// 创建全局实例
export const unifiedUserService = new UnifiedUserService();

// 导出便捷方法
export const {
  getUserProfile,
  updateUserProfile,
  getUserPermissions,
  checkUserPermission,
  getUserTokenBalance,
  reserveTokens,
  canUserCreateOffer,
  deductTokensForOperation
} = unifiedUserService;