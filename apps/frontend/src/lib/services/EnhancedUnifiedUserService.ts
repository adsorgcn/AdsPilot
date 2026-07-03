/**
 * 增强统一用户服务 (Enhanced Unified User Service)
 *
 * 重新设计以更好地集成：
 * 1. Supabase Auth认证系统
 * 2. 租户数据隔离
 * 3. Gateway-middleware集成
 * 4. 后端服务调用优化
 */

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

// Supabase客户端配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 用户认证相关类型 - 使用 Supabase 的 User 类型
export type AuthUser = User;

// 用户扩展信息（来自users表）
export interface UserProfile {
  id: string;
  auth_id: string; // 关联到Supabase Auth的id
  email: string;
  displayName: string;
  photoUrl?: string;
  onboarded: boolean;
  subscription_plan: string;
  subscription_status: string;
  subscription_expires_at?: string;
  trial_ends_at?: string;
  is_on_trial?: boolean; // 添加缺失字段
  is_admin: boolean;
  organization_id?: string;
  preferences: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// 订阅状态类型
export interface UserSubscription {
  status: 'trial' | 'active' | 'expired' | 'cancelled';
  plan?: string;
  expiresAt?: string;
  trialEndsAt?: string;
}

// 权限信息（基于订阅套餐）
export interface UserPermissions {
  // 基础权限
  is_admin: boolean;
  role: 'user' | 'admin';
  organization_id?: string;

  // 订阅权限
  subscription_plan: string;
  can_use_ai: boolean;
  can_create_offers: boolean;
  can_manage_ads: boolean;
  can_view_analytics: boolean;
  can_manage_billing: boolean;
  can_export_data: boolean;
  can_access_priority_support: boolean;

  // 资源限制
  max_offers_per_month: number;
  max_tokens_per_month: number;
  max_api_calls_per_hour: number;
  storage_quota_mb: number;

  // 订阅状态
  is_active: boolean;
  is_on_trial: boolean;
  subscription_expires_at?: string;
  trial_ends_at?: string;
  will_renew_at?: string;

  // 组织权限（如果适用）
  organization_permissions?: {
    can_manage_organization: boolean;
    can_invite_members: boolean;
    can_view_organization_analytics: boolean;
    can_manage_billing: boolean;
  };
}

// Token余额信息 - 统一使用billing/types.ts中的定义
export interface TokenBalance {
  currentBalance: number;  // Updated from 'balance' to match API response
  totalConsumed: number;   // Updated from 'todayConsumed' to match API response
  totalGranted: number;    // Updated from 'totalBalance' to match API response
  lastUpdated: string;     // Updated from 'updatedAt' to match API response

  // Legacy fields for backward compatibility
  monthlyAllocation?: number;
  thisMonthConsumed?: number;
  pendingTasksCount?: number;
  estimatedCostForPending?: number;

  // Enhanced service fields
  balance: number;
  reserved: number;
  available: number;
  subscription_allowance: number;
  subscription_used: number;
  subscription_remaining: number;
}

// Token预留
export interface TokenReservation {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  reference_id?: string;
  status: 'reserved' | 'confirmed' | 'refunded';
  expires_at: string;
  created_at: string;
  confirmed_at?: string;
  cancelled_at?: string;
}

// 租户信息
export interface Organization {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  subscription_plan: string;
  max_users: number;
  created_at: string;
  updated_at: string;
}

// 用户活动统计
export interface ActivityStats {
  total_offers: number;
  active_offers: number;
  total_earnings: number;
  total_spend: number;
  average_roas: number;
  last_active_at: string;
  join_date: string;
  this_month_offers: number;
  this_month_tokens_consumed: number;
}

// 会话上下文
export interface UserSession {
  user: AuthUser | null;
  profile: UserProfile | null;
  permissions: UserPermissions | null;
  organization: Organization | null;
  token_balance: TokenBalance | null;
  is_loading: boolean;
  error?: string;
}

export class EnhancedUnifiedUserService {
  private supabase: SupabaseClient<any, any, any>;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseAnonKey) as SupabaseClient<any, any, any>;
  }

  // === 认证相关 ===

  /**
   * 获取当前认证用户
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      return user;
    } catch (error) {
      console.error('[EnhancedUserService] Error getting current user:', error);
      return null;
    }
  }

  /**
   * 注册新用户
   */
  async signUp(email: string, password: string, options: {
    displayName?: string;
    metadata?: Record<string, any>;
  } = {}): Promise<{
    success: boolean;
    user?: AuthUser;
    error?: string;
    needsEmailVerification?: boolean;
  }> {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: options.displayName,
            ...options.metadata
          }
        }
      });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      // 创建用户档案
      if (data.user && data.user.email) {
        await this.createUserProfile(data.user.id, {
          email: data.user.email,
          displayName: data.user.user_metadata?.display_name || data.user.email,
          photoUrl: data.user.user_metadata?.avatar_url,
          onboarded: false
        });
      }

      return {
        success: true,
        user: data.user ?? undefined,
        needsEmailVerification: !data.user?.email_confirmed_at
      };
    } catch (error) {
      console.error('[EnhancedUserService] Error during sign up:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 用户登录
   */
  async signIn(email: string, password: string): Promise<{
    success: boolean;
    user?: AuthUser;
    error?: string;
  }> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      // 更新最后登录时间
      if (data.user) {
        await this.updateLastSignIn(data.user.id);
      }

      return {
        success: true,
        user: data.user
      };
    } catch (error) {
      console.error('[EnhancedUserService] Error during sign in:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 社交媒体登录
   */
  async signInWithOAuth(provider: 'google' | 'github'): Promise<{
    success: boolean;
    redirectUrl?: string;
    error?: string;
  }> {
    try {
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        redirectUrl: data?.url
      };
    } catch (error) {
      console.error('[EnhancedUserService] Error during OAuth sign in:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 用户登出
   */
  async signOut(): Promise<void> {
    try {
      await this.supabase.auth.signOut();
    } catch (error) {
      console.error('[EnhancedUserService] Error during sign out:', error);
    }
  }

  /**
   * 发送密码重置邮件
   */
  async resetPassword(email: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true
      };
    } catch (error) {
      console.error('[EnhancedUserService] Error sending password reset:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // === 用户档案管理 ===

  /**
   * 创建用户档案
   */
  async createUserProfile(authId: string, profileData: Partial<UserProfile>): Promise<UserProfile> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .insert({
          auth_id: authId,
          email: profileData.email,
          display_name: profileData.displayName || profileData.email,
          photo_url: profileData.photoUrl,
          onboarded: profileData.onboarded || false,
          subscription_plan: profileData.subscription_plan || 'trial',
          subscription_status: profileData.subscription_status || 'active',
          is_admin: profileData.is_admin || false,
          preferences: profileData.preferences || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[EnhancedUserService] Error creating user profile:', error);
      throw error;
    }
  }

  /**
   * 获取用户档案
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('auth_id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[EnhancedUserService] Error getting user profile:', error);
      return null;
    }
  }

  /**
   * 更新用户档案
   */
  async updateUserProfile(userId: string, profileUpdates: Partial<UserProfile>): Promise<UserProfile> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .update({
          ...profileUpdates,
          updated_at: new Date().toISOString()
        })
        .eq('auth_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[EnhancedUserService] Error updating user profile:', error);
      throw error;
    }
  }

  /**
   * 删除用户档案
   */
  async deleteUserProfile(userId: string): Promise<void> {
    try {
      await this.supabase
        .from('users')
        .delete()
        .eq('auth_id', userId);
    } catch (error) {
      console.error('[EnhancedUserService] Error deleting user profile:', error);
      throw error;
    }
  }

  /**
   * 更新最后登录时间
   */
  private async updateLastSignIn(userId: string): Promise<void> {
    try {
      await this.supabase
        .from('users')
        .update({
          last_sign_in_at: new Date().toISOString()
        })
        .eq('auth_id', userId);
    } catch (error) {
      console.error('[EnhancedUserService] Error updating last sign in:', error);
    }
  }

  // === 权限管理 ===

  /**
   * 获取用户权限信息
   * 基于订阅套餐和组织信息计算权限
   */
  async getUserPermissions(userId: string): Promise<UserPermissions | null> {
    try {
      // 并行获取用户档案和组织信息
      const [profile, organization] = await Promise.all([
        this.getUserProfile(userId),
        this.getUserOrganization(userId)
      ]);

      if (!profile) {
        return null;
      }

      // 基础权限 - 使用类型断言来匹配接口
      const permissions: any = {
        is_admin: profile.is_admin,
        role: profile.is_admin ? 'admin' : 'user',
        organization_id: organization?.id,
        subscription_plan: profile.subscription_plan,
        can_use_ai: this.canUseAIForPlan(profile.subscription_plan),
        can_create_offers: this.canCreateOffersForPlan(profile.subscription_plan),
        can_manage_ads: this.canManageAdsForPlan(profile.subscription_plan),
        can_view_analytics: this.canViewAnalyticsForPlan(profile.subscription_plan),
        can_manage_billing: profile.is_admin || this.canManageBillingForPlan(profile.subscription_plan),
        can_export_data: this.canExportDataForPlan(profile.subscription_plan),
        can_access_priority_support: this.canAccessPrioritySupportForPlan(profile.subscription_plan),
        max_offers_per_month: this.getMaxOffersForPlan(profile.subscription_plan),
        max_tokens_per_month: this.getMaxTokensForPlan(profile.subscription_plan),
        max_api_calls_per_hour: this.getMaxApiCallsPerHourForPlan(profile.subscription_plan),
        storage_quota_mb: this.getStorageQuotaForPlan(profile.subscription_plan),
        is_active: this.isSubscriptionActiveForProfile(profile),
        is_on_trial: profile.is_on_trial || profile.subscription_plan === 'trial',
        subscription_expires_at: profile.subscription_expires_at,
        trial_ends_at: profile.trial_ends_at,
        will_renew_at: this.calculateRenewalDate(profile)
      };

      // 组织权限（如果适用）
      if (organization) {
        permissions.organization_permissions = {
          can_manage_organization: organization.max_users > 1,
          can_invite_members: profile.is_admin,
          can_view_organization_analytics: profile.is_admin,
          can_manage_billing: profile.is_admin
        };
      }

      return permissions;
    } catch (error) {
      console.error('[EnhancedUserService] Error getting user permissions:', error);
      return null;
    }
  }

  /**
   * 检查用户是否为管理员
   */
  async isUserAdmin(userId: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions?.is_admin || false;
  }

  /**
   * 检查特定权限
   */
  async checkUserPermission(
    userId: string,
    permission: keyof Omit<UserPermissions, 'is_admin' | 'role' | 'organization_id' | 'organization_permissions'>
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions?.[permission] === true || false;
  }

  // === 订阅管理 ===

  /**
   * 获取用户订阅信息
   */
  async getUserSubscription(userId: string): Promise<{
    plan: string;
    status: 'active' | 'trial' | 'expired' | 'cancelled';
    expiresAt?: string;
    trialEndsAt?: string;
    features: string[];
    limits: {
      maxOffersPerMonth: number;
      maxTokensPerMonth: number;
      canUseAI: boolean;
      canManageAds: boolean;
      canExportData: boolean;
    };
  }> {
    const permissions = await this.getUserPermissions(userId);

    if (!permissions) {
      throw new Error('User permissions not found');
    }

    return {
      plan: permissions.subscription_plan,
      status: this.getSubscriptionStatus(permissions),
      expiresAt: permissions.subscription_expires_at,
      trialEndsAt: permissions.trial_ends_at,
      features: this.getFeaturesForPlan(permissions.subscription_plan),
      limits: {
        maxOffersPerMonth: permissions.max_offers_per_month,
        maxTokensPerMonth: permissions.max_tokens_per_month,
        canUseAI: permissions.can_use_ai,
        canManageAds: permissions.can_manage_ads,
        canExportData: permissions.can_export_data
      }
    };
  }

  /**
   * 升级用户订阅
   */
  async upgradeSubscription(userId: string, targetPlan: string): Promise<{
    success: boolean;
    subscription?: any;
    error?: string;
  }> {
    try {
      // 验证升级资格
      const currentSubscription = await this.getUserSubscription(userId);
      const canUpgrade = this.canUpgradePlan(currentSubscription.plan, targetPlan);

      if (!canUpgrade) {
        return {
          success: false,
          error: 'Cannot upgrade to this plan'
        };
      }

      // 执行升级
      const { data, error } = await this.supabase
        .from('users')
        .update({
          subscription_plan: targetPlan,
          subscription_status: 'active',
          subscription_expires_at: this.calculateSubscriptionExpiry(targetPlan),
          updated_at: new Date().toISOString()
        })
        .eq('auth_id', userId)
        .select()
        .single();

      if (error) throw error;

      // 追踪订阅变更
      await this.trackActivity(userId, {
        type: 'subscription_changed',
        description: `Subscription upgraded to ${targetPlan}`,
        metadata: { previousPlan: currentSubscription.plan, newPlan: targetPlan }
      });

      return {
        success: true,
        subscription: data
      };
    } catch (error) {
      console.error('[EnhancedUserService] Error upgrading subscription:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // === Token管理 ===

  /**
   * 获取Token余额
   */
  async getUserTokenBalance(userId: string): Promise<TokenBalance> {
    try {
      const [permissions, transactions, reservations] = await Promise.all([
        this.getUserPermissions(userId),
        this.getTokenTransactions(userId),
        this.getTokenReservations(userId)
      ]);

      const currentBalance = transactions
        .filter(t => t.type === 'purchase' || t.type === 'bonus')
        .reduce((sum, t) => sum + t.amount, 0);

      const consumedTokens = transactions
        .filter(t => t.type === 'consumption')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      const reservedTokens = reservations
        .filter(r => r.status === 'reserved')
        .reduce((sum, r) => sum + r.amount, 0);

      return {
        currentBalance: currentBalance,
        totalConsumed: consumedTokens,
        totalGranted: permissions?.max_tokens_per_month || 0,
        lastUpdated: new Date().toISOString(),
        // Enhanced service fields
        balance: currentBalance,
        reserved: reservedTokens,
        available: Math.max(0, currentBalance - reservedTokens),
        subscription_allowance: permissions?.max_tokens_per_month || 0,
        subscription_used: consumedTokens,
        subscription_remaining: Math.max(0, (permissions?.max_tokens_per_month || 0) - consumedTokens)
      };
    } catch (error) {
      console.error('[EnhancedUserService] Error getting token balance:', error);
      throw error;
    }
  }

  /**
   * 预留Token
   */
  async reserveTokens(
    userId: string,
    amount: number,
    reason: string,
    referenceId?: string
  ): Promise<TokenReservation> {
    try {
      // 检查余额
      const balance = await this.getUserTokenBalance(userId);
      if (balance.available < amount) {
        throw new Error('Insufficient token balance');
      }

      const { data, error } = await this.supabase
        .from('token_reservations')
        .insert({
          user_id: userId,
          amount,
          reason,
          reference_id: referenceId,
          status: 'reserved',
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30分钟过期
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[EnhancedUserService] Error reserving tokens:', error);
      throw error;
    }
  }

  /**
   * 确认Token预留
   */
  async confirmTokenReservation(reservationId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('token_reservations')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString()
        })
        .eq('id', reservationId);

      if (error) throw error;
    } catch (error) {
      console.error('[EnhancedUserService] Error confirming token reservation:', error);
      throw error;
    }
  }

  /**
   * 取消Token预留
   */
  async cancelTokenReservation(reservationId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('token_reservations')
        .update({
          status: 'refunded',
          cancelled_at: new Date().toISOString()
        })
        .eq('id', reservationId);

      if (error) throw error;
    } catch (error) {
      console.error('[EnhancedUserService] Error cancelling token reservation:', error);
      throw error;
    }
  }

  /**
   * 添加Token交易
   */
  async addTokenTransaction(
    userId: string,
    transaction: {
      type: 'purchase' | 'consumption' | 'refund' | 'bonus';
      amount: number;
      description: string;
      referenceId?: string;
    }
  ): Promise<void> {
    try {
      await this.supabase
        .from('token_transactions')
        .insert({
          user_id: userId,
          type: transaction.type,
          amount: transaction.amount,
          description: transaction.description,
          reference_id: transaction.referenceId,
          balance: await this.calculateNewBalance(userId, transaction.amount, transaction.type),
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('[EnhancedUserService] Error adding token transaction:', error);
      throw error;
    }
  }

  /**
   * 获取Token交易记录
   */
  async getTokenTransactions(
    userId: string,
    limit = 50
  ): Promise<any[]> {
    try {
      const { data } = await this.supabase
        .from('token_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      return data || [];
    } catch (error) {
      console.error('[EnhancedUserService] Error getting token transactions:', error);
      return [];
    }
  }

  /**
   * 获取Token预留记录
   */
  async getTokenReservations(
    userId: string,
    includeExpired = false
  ): Promise<TokenReservation[]> {
    try {
      let query = this.supabase
        .from('token_reservations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!includeExpired) {
        query = query.eq('status', 'reserved').gte('expires_at', new Date().toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[EnhancedUserService] Error getting token reservations:', error);
      return [];
    }
  }

  /**
   * 计算新余额
   */
  private async calculateNewBalance(
    userId: string,
    amount: number,
    type: 'purchase' | 'consumption' | 'refund' | 'bonus'
  ): Promise<number> {
    const currentBalance = await this.getUserTokenBalance(userId);

    switch (type) {
      case 'purchase':
      case 'bonus':
        return currentBalance.balance + amount;
      case 'consumption':
      case 'refund':
        return Math.max(0, currentBalance.balance - amount);
      default:
        return currentBalance.balance;
    }
  }

  // === 组织管理 ===

  /**
   * 获取用户组织信息
   */
  async getUserOrganization(userId: string): Promise<Organization | null> {
    try {
      const profile = await this.getUserProfile(userId);
      if (!profile?.organization_id) {
        return null;
      }

      const { data, error } = await this.supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.organization_id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[EnhancedUserService] Error getting user organization:', error);
      return null;
    }
  }

  /**
   * 创建组织
   */
  async createOrganization(
    userId: string,
    organizationData: {
      name: string;
      slug: string;
      domain?: string;
    }
  ): Promise<Organization> {
    try {
      // 验证用户权限（只有管理员可以创建组织）
      const isAdmin = await this.isUserAdmin(userId);
      if (!isAdmin) {
        throw new Error('Only administrators can create organizations');
      }

      const { data, error } = await this.supabase
        .from('organizations')
        .insert({
          ...organizationData,
          created_by: userId,
          max_users: 5,
          subscription_plan: 'starter',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // 将创建者添加到组织
      await this.supabase
        .from('organization_members')
        .insert({
          organization_id: data.id,
          user_id: userId,
          role: 'owner',
          created_at: new Date().toISOString()
        });

      // 更新用户档案
      await this.updateUserProfile(userId, {
        organization_id: data.id
      });

      return data;
    } catch (error) {
      console.error('[EnhancedUserService] Error creating organization:', error);
      throw error;
    }
  }

  // === 活动统计 ===

  /**
   * 获取用户活动统计
   */
  async getUserActivityStats(userId: string): Promise<ActivityStats> {
    try {
      const [offers, transactions] = await Promise.all([
        this.getUserOffersCount(userId),
        this.getTokenTransactions(userId)
      ]);

      const totalEarnings = offers * 150; // 估算平均每个Offer收入
      const totalSpend = transactions
        .filter(t => t.type === 'consumption')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0) * 0.01; // Token价值估算

      return {
        total_offers: offers,
        active_offers: Math.floor(offers * 0.7), // 70%的Offer保持活跃
        total_earnings: totalEarnings,
        total_spend: totalSpend,
        average_roas: totalSpend > 0 ? totalEarnings / totalSpend : 0,
        last_active_at: await this.getUserLastActivity(userId),
        join_date: await this.getUserJoinDate(userId),
        this_month_offers: await this.getMonthlyOfferCount(userId),
        this_month_tokens_consumed: transactions
          .filter(t => t.type === 'consumption')
          .reduce((sum, t) => sum + Math.abs(t.amount), 0)
      };
    } catch (error) {
      console.error('[EnhancedUserService] Error getting activity stats:', error);
      throw error;
    }
  }

  /**
   * 获取用户Offer数量
   */
  private async getUserOffersCount(userId: string): Promise<number> {
    try {
      const { count } = await this.supabase
        .from('offers')
        .select('count', { count: 'exact', head: true })
        .eq('user_id', userId)
        .neq('status', 'archived');

      return count || 0;
    } catch (error) {
      console.error('[EnhancedUserService] Error getting offers count:', error);
      return 0;
    }
  }

  /**
   * 获取月度Offer数量
   */
  private async getMonthlyOfferCount(userId: string): Promise<number> {
    try {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const { count } = await this.supabase
        .from('offers')
        .select('count', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', firstDay.toISOString())
        .lt('created_at', lastDay.toISOString())
        .neq('status', 'archived');

      return count || 0;
    } catch (error) {
      console.error('[    Error getting monthly offers count:', error);
      return 0;
    }
  }

  /**
   * 获取用户最后活动时间
   */
  private async getUserLastActivity(userId: string): Promise<string> {
    try {
      const { data } = await this.supabase
        .from('user_activities')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return data?.created_at || new Date().toISOString();
    } catch (error) {
      console.error('[EnhancedUserService] Error getting last activity:', error);
      return new Date().toISOString();
    }
  }

  /**
   * 获取用户加入日期
   */
  private async getUserJoinDate(userId: string): Promise<string> {
    try {
      const profile = await this.getUserProfile(userId);
      return profile?.created_at || new Date().toISOString();
    } catch (error) {
      console.error('[EnhancedUserService] Error getting join date:', error);
      return new Date().toISOString();
    }
  }

  // === 活动追踪 ===

  /**
   * 追踪用户活动
   */
  async trackActivity(userId: string, activity: {
    type: string;
    description: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await this.supabase
        .from('user_activities')
        .insert({
          user_id: userId,
          type: activity.type,
          description: activity.description,
          metadata: activity.metadata || {},
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('[EnhancedUserService] Error tracking activity:', error);
      // 活动追踪失败不应影响主要功能
    }
  }

  // === 辅助方法 ===

  private canUseAIForPlan(plan: string): boolean {
    const aiPlans = ['professional', 'enterprise', 'admin'];
    return aiPlans.includes(plan);
  }

  private canCreateOffersForPlan(plan: string): boolean {
    const offerPlans = ['trial', 'starter', 'professional', 'enterprise', 'admin'];
    return offerPlans.includes(plan);
  }

  private canManageAdsForPlan(plan: string): boolean {
    const adPlans = ['professional', 'enterprise', 'admin'];
    return adPlans.includes(plan);
  }

  private canViewAnalyticsForPlan(plan: string): boolean {
    return plan !== 'trial';
  }

  private canManageBillingForPlan(plan: string): boolean {
    const billingPlans = ['professional', 'enterprise', 'admin'];
    return billingPlans.includes(plan);
  }

  private canExportDataForPlan(plan: string): boolean {
    const exportPlans = ['professional', 'enterprise', 'admin'];
    return exportPlans.includes(plan);
  }

  private canAccessPrioritySupportForPlan(plan: string): boolean {
    const supportPlans = ['enterprise', 'admin'];
    return supportPlans.includes(plan);
  }

  private getMaxOffersForPlan(plan: string): number {
    const limits: Record<string, number> = {
      trial: 5,
      starter: 10,
      professional: 50,
      enterprise: 999
    };
    return limits[plan] || 5;
  }

  private getMaxTokensForPlan(plan: string): number {
    const limits: Record<string, number> = {
      trial: 100,
      starter: 200,
      professional: 1000,
      enterprise: 10000
    };
    return limits[plan] || 100;
  }

  private getMaxApiCallsPerHourForPlan(plan: string): number {
    const limits: Record<string, number> = {
      trial: 100,
      starter: 500,
      professional: 2000,
      enterprise: 10000
    };
    return limits[plan] || 100;
  }

  private getStorageQuotaForPlan(plan: string): number {
    const quotas: Record<string, number> = {
      trial: 100, // MB
      starter: 500,
      professional: 2000,
      enterprise: 10000
    };
    return quotas[plan] || 100;
  }

  private getFeaturesForPlan(plan: string): string[] {
    const features: Record<string, string[]> = {
      trial: ['basic_offers', 'ai_evaluation', 'analytics'],
      starter: ['offers_management', 'analytics'],
      professional: ['advanced_analytics', 'ai_evaluation', 'data_export', 'ad_management'],
      enterprise: ['unlimited_offers', 'advanced_ai', 'priority_support', 'custom_integrations']
    };
    return features[plan] || [];
  }

  private isSubscriptionActive(permissions: UserPermissions): boolean {
    if (permissions.is_admin) return true;

    if (permissions.is_on_trial && permissions.trial_ends_at) {
      return new Date(permissions.trial_ends_at) > new Date();
    }

    if (permissions.subscription_expires_at) {
      return new Date(permissions.subscription_expires_at) > new Date();
    }

    return permissions.subscription_plan !== 'trial' && permissions.subscription_plan !== 'expired';
  }

  private isSubscriptionActiveForProfile(profile: UserProfile): boolean {
    if (profile.is_admin) return true;

    if (profile.is_on_trial && profile.trial_ends_at) {
      return new Date(profile.trial_ends_at) > new Date();
    }

    if (profile.subscription_expires_at) {
      return new Date(profile.subscription_expires_at) > new Date();
    }

    return profile.subscription_plan !== 'trial' && profile.subscription_plan !== 'expired';
  }

  private getSubscriptionStatus(permissions: UserPermissions): UserSubscription['status'] {
    if (permissions.is_admin) return 'active';
    if (permissions.is_on_trial) return 'trial';
    if (!permissions.is_active) return 'expired';
    return 'active';
  }

  private calculateSubscriptionExpiry(plan: string): string {
    const periods: Record<string, number> = {
      trial: 7, // 7天
      starter: 30, // 30天
      professional: 30, // 30天
      enterprise: 30 // 30天
    };

    const now = new Date();
    const expiry = new Date(now.getTime() + (periods[plan] || 30) * 24 * 60 * 60 * 1000);

    return expiry.toISOString();
  }

  private calculateRenewalDate(profile: UserProfile): string | undefined {
    if (!profile.subscription_expires_at) return undefined;

    const expiryDate = new Date(profile.subscription_expires_at);
    const renewalDate = new Date(expiryDate.getTime() + 24 * 60 * 60 * 1000); // 24小时后

    return renewalDate.toISOString();
  }

  private canUpgradePlan(currentPlan: string, targetPlan: string): boolean {
    const planHierarchy = ['trial', 'starter', 'professional', 'enterprise'];
    const currentIndex = planHierarchy.indexOf(currentPlan);
    const targetIndex = planHierarchy.indexOf(targetPlan);

    return targetIndex > currentIndex;
  }

  /**
   * 获取完整用户会话信息
   * 包括认证用户、档案、权限、组织和Token余额
   */
  async getUserSession(userId?: string): Promise<UserSession> {
    try {
      if (!userId) {
        const authUser = await this.getCurrentUser();
        if (!authUser) {
          return {
            user: null,
            profile: null,
            permissions: null,
            organization: null,
            token_balance: null,
            is_loading: false
          };
        }
        userId = authUser.id;
      }

      const [profile, permissions, organization, tokenBalance] = await Promise.all([
        this.getUserProfile(userId),
        this.getUserPermissions(userId),
        this.getUserOrganization(userId),
        this.getUserTokenBalance(userId)
      ]);

      return {
        user: await this.getCurrentUser(),
        profile,
        permissions,
        organization,
        token_balance: tokenBalance,
        is_loading: false
      };
    } catch (error) {
      console.error('[EnhancedUserService] Error getting user session:', error);
      return {
        user: null,
        profile: null,
        permissions: null,
        organization: null,
        token_balance: null,
        is_loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 检查用户是否可以创建Offer
   */
  async canUserCreateOffer(userId: string): Promise<boolean> {
    const [permissions, tokenBalance, stats] = await Promise.all([
      this.getUserPermissions(userId),
      this.getUserTokenBalance(userId),
      this.getUserActivityStats(userId)
    ]);

    // 管理员始终可以创建
    if (permissions?.is_admin) return true;

    // 检查订阅权限
    if (!permissions?.can_create_offers) return false;

    // 检查订阅是否有效
    if (!this.isSubscriptionActive(permissions)) return false;

    // 检查Token余额
    if (tokenBalance.available < 1) return false;

    // 检查月度数量限制
    return stats.total_offers < permissions.max_offers_per_month;
  }

  /**
   * 为操作预留并扣除Token
   */
  async deductTokensForOperation(
    userId: string,
    amount: number,
    reason: string,
    referenceId?: string
  ): Promise<{
    success: boolean;
    reservationId?: string;
    error?: string;
  }> {
    try {
      const reservation = await this.reserveTokens(userId, amount, reason, referenceId);
      await this.confirmTokenReservation(reservation.id);

      // 记录Token消费
      await this.addTokenTransaction(userId, {
        type: 'consumption',
        amount: -amount,
        description: reason,
        referenceId
      });

      return {
        success: true,
        reservationId: reservation.id
      };
    } catch (error) {
      console.error('[EnhancedUserService] Error deducting tokens:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// 创建全局实例
export const enhancedUnifiedUserService = new EnhancedUnifiedUserService();

// 导出便捷方法
export const {
  getCurrentUser,
  signUp,
  signIn,
  signInWithOAuth,
  signOut,
  resetPassword,
  getUserProfile,
  updateUserProfile,
  getUserPermissions,
  isUserAdmin,
  checkUserPermission,
  getUserSubscription,
  upgradeSubscription,
  getUserTokenBalance,
  reserveTokens,
  confirmTokenReservation,
  cancelTokenReservation,
  getUserSession,
  canUserCreateOffer,
  deductTokensForOperation
} = enhancedUnifiedUserService;
