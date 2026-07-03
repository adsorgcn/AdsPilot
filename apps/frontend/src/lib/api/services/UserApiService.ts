/**
 * 用户API服务 (User API Service)
 *
 * 专门用于通过Backend API获取用户数据的服务
 * 不再依赖Supabase直接查询，完全通过API获取数据
 * 保持了与UnifiedUserService相同的接口以确保兼容性
 */

import BaseApiClient from '../core/BaseApiClient';

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

export class UserApiService extends BaseApiClient {
  constructor() {
    super(process.env.NEXT_PUBLIC_API_BASE_URL || '');
  }

  // === 核心用户信息 ===

  /**
   * 获取用户档案
   */
  async getUserProfile(userId: string): Promise<UserProfile> {
    return this.get<UserProfile>(`/api/v1/users/${userId}/profile`);
  }

  /**
   * 更新用户档案
   */
  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    return this.patch<UserProfile>(`/api/v1/users/${userId}/profile`, updates);
  }

  /**
   * 获取用户权限信息
   */
  async getUserPermissions(userId: string): Promise<UserPermissions> {
    return this.get<UserPermissions>(`/api/v1/users/${userId}/permissions`);
  }

  /**
   * 获取用户Token余额
   */
  async getUserTokenBalance(userId: string): Promise<TokenBalance> {
    return this.get<TokenBalance>(`/api/v1/users/${userId}/tokens/balance`);
  }

  /**
   * 获取用户订阅状态
   */
  async getUserSubscription(userId: string): Promise<Subscription> {
    return this.get<Subscription>(`/api/v1/users/${userId}/subscription`);
  }

  /**
   * 获取用户完整信息 (档案 + 权限 + 订阅状态)
   */
  async getUserCompleteInfo(userId: string): Promise<UserSession> {
    const [profile, permissions, tokens, subscription] = await Promise.all([
      this.getUserProfile(userId),
      this.getUserPermissions(userId),
      this.getUserTokenBalance(userId),
      this.getUserSubscription(userId)
    ]);

    return {
      user: {
        id: userId,
        email: '', // Will be filled by caller
        created_at: profile.createdAt,
        updated_at: profile.updatedAt,
      },
      profile,
      permissions,
      tokens,
      subscription,
      lastActivityAt: new Date().toISOString(),
    };
  }
}

// 创建全局实例
export const userApiService = new UserApiService();

// 导出便捷方法
export const {
  getUserProfile,
  updateUserProfile,
  getUserPermissions,
  getUserTokenBalance,
  getUserSubscription,
  getUserCompleteInfo
} = userApiService;