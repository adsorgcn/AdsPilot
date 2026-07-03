/**
 * 清理版统一用户服务 (Clean Unified User Service)
 *
 * 完全移除Supabase直接查询，所有用户数据通过Backend API获取
 * 保持与现有UnifiedUserService相同的接口以确保兼容性
 */

import BaseApiClient from '../api/core/BaseApiClient';

// Type definitions (copied from UnifiedUserService for compatibility)
export interface AuthUser {
  id: string;
  email: string;
  phone?: string;
  email_confirmed_at?: string;
  phone_confirmed_at?: string;
  last_sign_in_at?: string;
  created_at: string;
  updated_at: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}

export interface UserProfile {
  id: string;
  displayName: string;
  photoUrl?: string;
  onboarded: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserPermissions {
  id: string;
  userId: string;
  isAdmin: boolean;
  subscriptionPlan: 'starter' | 'professional' | 'elite';
  canUseAi: boolean;
  canCreateOffers: boolean;
  canManageAds: boolean;
  canAccessAnalytics: boolean;
  maxOffersPerMonth: number;
  maxTokensPerMonth: number;
  canExportData: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TokenBalance {
  id: string;
  userId: string;
  balance: number;
  reserved: number;
  available: number;
  totalEarned: number;
  totalSpent: number;
  lastUpdated: string;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: 'starter' | 'professional' | 'elite';
  status: 'active' | 'cancelled' | 'expired' | 'trial';
  isTrial: boolean;
  trialEndsAt?: string;
  currentPeriodEndsAt?: string;
  endsAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSession {
  user: AuthUser;
  profile: UserProfile;
  permissions: UserPermissions;
  tokens: TokenBalance;
  subscription: Subscription;
  lastActivityAt: string;
}

export class CleanUnifiedUserService extends BaseApiClient {
  constructor() {
    super(process.env.NEXT_PUBLIC_API_BASE_URL || '');
  }

  // === 核心用户信息 ===

  /**
   * 获取用户档案 - 完全通过Backend API获取
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      return await this.get<UserProfile>(`/api/v1/users/${userId}/profile`);
    } catch (error) {
      console.error('Error getting user profile from API:', error);
      return null;
    }
  }

  /**
   * 更新���户档案 - 完全通过Backend API更新
   */
  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    try {
      return await this.patch<UserProfile>(`/api/v1/users/${userId}/profile`, updates);
    } catch (error) {
      console.error('Error updating user profile via API:', error);
      throw error;
    }
  }

  // === 权限和认证 ===

  /**
   * 获取用户权限信息 - 通过Backend API获取
   */
  async getUserPermissions(userId: string): Promise<UserPermissions> {
    try {
      return await this.get<UserPermissions>(`/api/v1/users/${userId}/permissions`);
    } catch (error) {
      console.error('Error getting user permissions from API:', error);
      throw error;
    }
  }

  /**
   * 检查用户是否为管理员 - 通过Backend API获取
   */
  async isUserAdmin(userId: string): Promise<boolean> {
    try {
      const permissions = await this.getUserPermissions(userId);
      return permissions.isAdmin;
    } catch (error) {
      console.error('Error checking user admin status via API:', error);
      return false;
    }
  }

  /**
   * 检查用户是否有特定业务权限 - 通过Backend API获取
   */
  async checkUserPermission(userId: string, permission: keyof Omit<UserPermissions, 'isAdmin' | 'subscriptionPlan' | 'subscriptionExpiresAt' | 'isOnTrial' | 'trialEndsAt'>): Promise<boolean> {
    try {
      const permissions = await this.getUserPermissions(userId);
      return permissions[permission] === true;
    } catch (error) {
      console.error('Error checking user permission via API:', error);
      return false;
    }
  }

  /**
   * 检查用户角色 - 通过Backend API获取
   */
  async hasRole(userId: string, role: 'user' | 'admin'): Promise<boolean> {
    try {
      const permissions = await this.getUserPermissions(userId);
      return (permissions as any).role === role;
    } catch (error) {
      console.error('Error checking user role via API:', error);
      return false;
    }
  }

  /**
   * 检查用户订阅是否有效 - 通过Backend API获取
   */
  async isSubscriptionValid(userId: string): Promise<boolean> {
    try {
      const permissions = await this.getUserPermissions(userId) as any;

      if (permissions.isAdmin) return true;

      if (permissions.isOnTrial && permissions.trialEndsAt) {
        return new Date(permissions.trialEndsAt) > new Date();
      }

      if (permissions.subscriptionExpiresAt) {
        return new Date(permissions.subscriptionExpiresAt) > new Date();
      }

      return false;
    } catch (error) {
      console.error('Error checking subscription validity via API:', error);
      return false;
    }
  }

  // === Token和余额管理 ===

  /**
   * 获取用户Token余额 - 通过Backend API获取
   */
  async getUserTokenBalance(userId: string): Promise<TokenBalance> {
    try {
      return await this.get<TokenBalance>(`/api/v1/users/${userId}/tokens/balance`);
    } catch (error) {
      console.error('Error getting user token balance from API:', error);
      throw error;
    }
  }

  /**
   * 更新用户Token余额 - 通过Backend API更新
   */
  async updateUserTokenBalance(userId: string, delta: number, reason: string): Promise<void> {
    try {
      await this.post(`/api/v1/users/${userId}/tokens/balance`, {
        delta,
        reason
      });
    } catch (error) {
      console.error('Error updating user token balance via API:', error);
      throw error;
    }
  }

  /**
   * 预留Token - 通过Backend API预留
   */
  async reserveTokens(userId: string, amount: number, reason: string, referenceId?: string): Promise<{ id: string; amount: number; reason: string; status: string; created_at: string; expires_at: string }> {
    try {
      return await this.post(`/api/v1/users/${userId}/tokens/reserve`, {
        amount,
        reason,
        referenceId
      });
    } catch (error) {
      console.error('Error reserving tokens via API:', error);
      throw error;
    }
  }

  /**
   * 确认Token预留 - 通过Backend API确认
   */
  async confirmTokenReservation(reservationId: string): Promise<void> {
    try {
      await this.post(`/api/v1/users/tokens/reservations/${reservationId}/confirm`);
    } catch (error) {
      console.error('Error confirming token reservation via API:', error);
      throw error;
    }
  }

  /**
   * 取消Token预留 - 通过Backend API取消
   */
  async cancelTokenReservation(reservationId: string): Promise<void> {
    try {
      await this.post(`/api/v1/users/tokens/reservations/${reservationId}/cancel`);
    } catch (error) {
      console.error('Error canceling token reservation via API:', error);
      throw error;
    }
  }

  // === 用户状态和统计 ===

  /**
   * 获取用户活动统计 - 通过Backend API获取
   */
  async getUserActivityStats(userId: string): Promise<{ totalOffers: number; activeOffers: number; totalEarnings: number; lastActiveAt: string; joinDate: string }> {
    try {
      return await this.get(`/api/v1/users/${userId}/stats/activity`);
    } catch (error) {
      console.error('Error getting user activity stats via API:', error);
      return {
        totalOffers: 0,
        activeOffers: 0,
        totalEarnings: 0,
        lastActiveAt: '',
        joinDate: '',
      };
    }
  }

  /**
   * 获取用户订阅状态 - 通过Backend API获取
   */
  async getUserSubscriptionStatus(userId: string): Promise<{ isActive: boolean; plan: string; expiresAt?: string; isOnTrial: boolean; trialEndsAt?: string; canUseAi: boolean; limits: { offersPerMonth: number; tokensPerMonth: number; features: string[] } }> {
    try {
      return await this.get(`/api/v1/users/${userId}/subscription/status`);
    } catch (error) {
      console.error('Error getting user subscription status via API:', error);
      return {
        isActive: false,
        plan: '',
        expiresAt: undefined,
        isOnTrial: false,
        trialEndsAt: undefined,
        canUseAi: false,
        limits: {
          offersPerMonth: 0,
          tokensPerMonth: 0,
          features: [],
        },
      };
    }
  }

  /**
   * 获取用户账户限制 - 通过Backend API获取
   */
  async getUserAccountLimits(userId: string): Promise<{ maxOffers: number; maxTokensPerDay: number; maxApiCallsPerHour: number; storageQuota: number }> {
    try {
      return await this.get(`/api/v1/users/${userId}/limits`);
    } catch (error) {
      console.error('Error getting user account limits via API:', error);
      return {
        maxOffers: 0,
        maxTokensPerDay: 0,
        maxApiCallsPerHour: 0,
        storageQuota: 0,
      };
    }
  }

  // === 关系管理 ===

  /**
   * 获取用户推荐信息 - 通过Backend API获取
   */
  async getUserReferrals(userId: string): Promise<Array<{ id: string; referralCode: string; referredUsers: number; totalRewards: number; createdAt: string }>> {
    try {
      return await this.get(`/api/v1/users/${userId}/referrals`);
    } catch (error) {
      console.error('Error getting user referrals via API:', error);
      return [];
    }
  }

  /**
   * 创建推荐关系 - 通过Backend API创建
   */
  async createUserReferral(referrerId: string, referralData: { refereeEmail: string; refereeName?: string }): Promise<{ id: string; referralCode: string; referredUsers: number; totalRewards: number; createdAt: string }> {
    try {
      return await this.post(`/api/v1/users/${referrerId}/referrals`, referralData);
    } catch (error) {
      console.error('Error creating user referral via API:', error);
      throw error;
    }
  }

  // === 组合方法 - 简化常见操作 ===

  /**
   * 获取用户完整信息 (档案 + 权限 + 订阅状态) - 完全通过Backend API获取
   */
  async getUserCompleteInfo(userId: string) {
    try {
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
    } catch (error) {
      console.error('Error getting complete user info via API:', error);
      throw error;
    }
  }

  /**
   * 检查用户是否可以创建Offer - 完全通过Backend API检查
   */
  async canUserCreateOffer(userId: string): Promise<boolean> {
    try {
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
    } catch (error) {
      console.error('Error checking if user can create offer via API:', error);
      return false;
    }
  }

  /**
   * 为用户操作预留并扣除Token - 完全通过Backend API处理
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
      console.error('Error deducting tokens for operation via API:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// 创建全局实例
export const cleanUnifiedUserService = new CleanUnifiedUserService();

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
} = cleanUnifiedUserService;
