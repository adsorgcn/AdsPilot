/**
 * Billing Service API Client
 *
 * 提供与后端billing服务通信的接口
 * 支持订阅管理、Token查询、套餐配置等功能
 */

import type {
  SubscriptionInfo,
  SubscriptionTier,
  SubscriptionConfig,
  TokenCostConfig,
  PricingConfig,
} from "~/lib/types/subscription";

export interface BillingApiClient {
  /**
   * 获取用户当前订阅信息
   */
  getSubscription(): Promise<SubscriptionInfo | null>;

  /**
   * 获取用户Token余额和消耗记录
   */
  getTokenBalance(): Promise<{
    currentBalance: number;
    totalConsumed: number;
    totalGranted: number;
    lastUpdated: string;
  }>;

  /**
   * 获取所有可用的订阅套餐配置
   */
  getSubscriptionConfigs(): Promise<SubscriptionConfig[]>;

  /**
   * 获取Token消耗配置
   */
  getTokenCosts(): Promise<TokenCostConfig>;

  /**
   * 获取定价配置
   */
  getPricingConfigs(): Promise<PricingConfig[]>;

  /**
   * 创建试用订阅
   */
  createTrialSubscription(): Promise<{
    success: boolean;
    subscriptionId?: string;
    endDate?: string;
    error?: string;
  }>;

  /**
   * 升级订阅套餐
   */
  upgradeSubscription(planId: string): Promise<{
    success: boolean;
    subscriptionId?: string;
    error?: string;
  }>;

  /**
   * 查询用户权限（是否可以使用AI功能等）
   */
  checkPermissions(): Promise<{
    canUseAI: boolean;
    canCreateOffers: boolean;
    canManageAds: boolean;
    restrictions: string[];
  }>;

  // ========================================
  // Admin Configuration Management Methods
  // ========================================

  /**
   * 获取权限配置列表（管理员）
   */
  getAllPermissions(): Promise<
    Array<{
      id: string;
      feature: string;
      category: string;
      description: string;
      starter: boolean;
      professional: boolean;
      elite: boolean;
    }>
  >;

  /**
   * 获取Token消耗配置列表（管理员）
   */
  getAllTokenCosts(): Promise<
    Array<{
      id: string;
      action: string;
      category: string;
      description: string;
      starterCost: number;
      professionalCost: number;
      eliteCost: number;
      unit: string;
      isActive: boolean;
    }>
  >;

  /**
   * 获取定价配置列表（管理员）
   */
  getAllPricing(): Promise<
    Array<{
      id: string;
      name: string;
      tier: string;
      monthlyPrice: number;
      yearlyPrice: number;
      currency: string;
      features: string[];
      monthlyTokens: number;
      maxUsers: number;
      isActive: boolean;
      sortOrder: number;
      highlighted: boolean;
    }>
  >;

  /**
   * 获取配置变更历史（管理员）
   */
  getConfigHistory(): Promise<
    Array<{
      id: string;
      configType: "permission" | "token_cost" | "pricing";
      configId: string;
      configName: string;
      action: "create" | "update" | "delete";
      oldValue: any;
      newValue: any;
      changedBy: string;
      changedByName: string;
      changedAt: string;
      description: string;
    }>
  >;
}

/**
 * 创建Billing API客户端实例
 */
export function createBillingApiClient(): BillingApiClient {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";

  if (!baseUrl) {
    console.warn("NEXT_PUBLIC_API_BASE_URL not configured, using mock client");
    return createMockBillingClient();
  }

  return new HttpBillingApiClient(baseUrl);
}

/**
 * HTTP实现 - 通过API Gateway调用billing服务
 */
class HttpBillingApiClient implements BillingApiClient {
  constructor(private readonly baseUrl: string) {}

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}/billing${path}`;

    // 获取当前用户的认证token
    const token = await this.getAuthToken();

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Billing API error: ${response.status} ${response.statusText}`,
      );
    }

    return response.json();
  }

  private async getAuthToken(): Promise<string> {
    // 从Supabase获取JWT token
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw new Error("User not authenticated");
    }

    return data.session.access_token;
  }

  async getSubscription(): Promise<SubscriptionInfo | null> {
    try {
      const data = await this.request<any>("/subscriptions/current");
      return this.mapSubscriptionData(data);
    } catch (error) {
      console.error("Failed to fetch subscription:", error);
      return null;
    }
  }

  async getTokenBalance(): Promise<{
    currentBalance: number;
    totalConsumed: number;
    totalGranted: number;
    lastUpdated: string;
  }> {
    return this.request("/tokens/balance");
  }

  async getSubscriptionConfigs(): Promise<SubscriptionConfig[]> {
    return this.request("/configs/subscriptions");
  }

  async getTokenCosts(): Promise<TokenCostConfig> {
    return this.request("/configs/token-costs");
  }

  async getPricingConfigs(): Promise<PricingConfig[]> {
    return this.request("/configs/pricing");
  }

  async createTrialSubscription(): Promise<{
    success: boolean;
    subscriptionId?: string;
    endDate?: string;
    error?: string;
  }> {
    try {
      const result = await this.request<any>("/subscriptions/trial", {
        method: "POST",
      });
      return {
        success: true,
        subscriptionId: result.id,
        endDate: result.end_date,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create trial subscription",
      };
    }
  }

  async upgradeSubscription(planId: string): Promise<{
    success: boolean;
    subscriptionId?: string;
    error?: string;
  }> {
    try {
      const result = await this.request<any>("/subscriptions/upgrade", {
        method: "POST",
        body: JSON.stringify({ plan_id: planId }),
      });
      return {
        success: true,
        subscriptionId: result.id,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to upgrade subscription",
      };
    }
  }

  async checkPermissions(): Promise<{
    canUseAI: boolean;
    canCreateOffers: boolean;
    canManageAds: boolean;
    restrictions: string[];
  }> {
    /**
     * TODO: 实现proper batch permission check
     * 
     * 理想实现:
     * 1. 后端提供批量权限检查API: POST /api/v1/billing/permissions/check
     * 2. 请求体: { permissions: ['useAI', 'createOffers', 'manageAds'] }
     * 3. 响应: { permissions: { useAI: true, createOffers: true, ... }, restrictions: [] }
     * 
     * 当前方案: 基于订阅套餐推断权限（fallback逻辑）
     */
    console.info("[Billing] Checking permissions based on subscription tier (fallback)");

    try {
      const subscription = await this.getSubscription();

      if (!subscription) {
        // No subscription - apply "default allow" principle
        // Basic features are allowed, premium features are restricted
        return {
          canUseAI: false, // Premium feature - requires subscription
          canCreateOffers: true, // Basic feature - default allow ✅
          canManageAds: false, // Premium feature - requires subscription
          restrictions: ["Please subscribe to access premium features"],
        };
      }

      const tier = subscription.tier.toLowerCase();
      const restrictions: string[] = [];

      // Only check permissions for premium features
      // Basic features (like createOffers) are always allowed
      const canUseAI = tier === "elite" || tier === "professional";
      const canManageAds = tier === "elite";

      if (!canUseAI) {
        restrictions.push(
          "AI features require Professional or Elite subscription",
        );
      }
      if (!canManageAds) {
        restrictions.push("Ads management requires Elite subscription");
      }

      return {
        canUseAI,
        canCreateOffers: true, // Basic feature - always allowed (default allow principle)
        canManageAds,
        restrictions,
      };
    } catch (error) {
      console.error("[Billing] Failed to check permissions:", error);
      // Fallback: Apply "default allow" principle
      // Allow basic features, deny premium features for safety
      return {
        canUseAI: false, // Premium: fail-closed
        canCreateOffers: true, // Basic: fail-open ✅
        canManageAds: false, // Premium: fail-closed
        restrictions: ["Failed to load permissions - using safe defaults"],
      };
    }
  }

  // Admin methods
  async getAllPermissions(): Promise<
    Array<{
      id: string;
      feature: string;
      category: string;
      description: string;
      starter: boolean;
      professional: boolean;
      elite: boolean;
    }>
  > {
    return this.request("/admin/permissions");
  }

  async getAllTokenCosts(): Promise<
    Array<{
      id: string;
      action: string;
      category: string;
      description: string;
      starterCost: number;
      professionalCost: number;
      eliteCost: number;
      unit: string;
      isActive: boolean;
    }>
  > {
    return this.request("/admin/token-costs");
  }

  async getAllPricing(): Promise<
    Array<{
      id: string;
      name: string;
      tier: string;
      monthlyPrice: number;
      yearlyPrice: number;
      currency: string;
      features: string[];
      monthlyTokens: number;
      maxUsers: number;
      isActive: boolean;
      sortOrder: number;
      highlighted: boolean;
    }>
  > {
    return this.request("/admin/pricing");
  }

  async getConfigHistory(): Promise<
    Array<{
      id: string;
      configType: "permission" | "token_cost" | "pricing";
      configId: string;
      configName: string;
      action: "create" | "update" | "delete";
      oldValue: any;
      newValue: any;
      changedBy: string;
      changedByName: string;
      changedAt: string;
      description: string;
    }>
  > {
    return this.request("/admin/config-history");
  }

  private mapSubscriptionData(data: any): SubscriptionInfo {
    const now = new Date();
    const tier = data.plan_type || "trial";
    const endDate = data.end_date ? new Date(data.end_date) : null;
    const trialEnd = data.trial_end ? new Date(data.trial_end) : null;

    const isActive = endDate ? endDate > now : false;
    const isOnTrial = tier === "trial" && trialEnd ? trialEnd > now : false;

    let daysRemaining: number | null = null;
    if (isOnTrial && trialEnd) {
      daysRemaining = Math.ceil(
        (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
    } else if (endDate) {
      daysRemaining = Math.ceil(
        (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
    }

    return {
      tier,
      isActive,
      isElite: tier === "elite",
      canUseAI: isActive && tier === "elite",
      monthlyTokenAllocation:
        data.monthly_token_allowance || this.getDefaultTokens(tier),
      currentTokenBalance: data.token_balance || 0,
      subscriptionEndDate: data.end_date || null,
      trialEndDate: data.trial_end || null,
      isOnTrial,
      daysRemaining,
    };
  }

  private getDefaultTokens(tier: SubscriptionTier): number {
    const defaults = {
      trial: 100,
      pro: 500,
      max: 2000,
      elite: 10000,
    };
    return defaults[tier] || 100;
  }
}

/**
 * Mock实现 - 用于开发环境或API不可用时
 */
function createMockBillingClient(): BillingApiClient {
  return {
    async getSubscription(): Promise<SubscriptionInfo | null> {
      // 返回模拟的试用订��数据
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7); // 7天试用

      return {
        tier: "trial",
        isActive: true,
        isElite: false,
        canUseAI: false,
        monthlyTokenAllocation: 100,
        currentTokenBalance: 85,
        subscriptionEndDate: null,
        trialEndDate: trialEnd.toISOString(),
        isOnTrial: true,
        daysRemaining: 7,
      };
    },

    async getTokenBalance() {
      return {
        currentBalance: 85,
        totalConsumed: 15,
        totalGranted: 100,
        lastUpdated: new Date().toISOString(),
      };
    },

    async getSubscriptionConfigs(): Promise<SubscriptionConfig[]> {
      return [
        {
          id: "trial",
          name: "Trial",
          description: "Perfect for getting started",
          monthlyTokens: 100,
          features: ["Basic evaluation", "Limited offers"],
          sortOrder: 0,
          isActive: true,
        },
        {
          id: "pro",
          name: "Pro",
          description: "For professional marketers",
          monthlyTokens: 500,
          features: [
            "Advanced evaluation",
            "Unlimited offers",
            "Email support",
          ],
          sortOrder: 1,
          isActive: true,
        },
        {
          id: "max",
          name: "Max",
          description: "For growing businesses",
          monthlyTokens: 2000,
          features: [
            "AI evaluation",
            "Priority support",
            "Custom integrations",
          ],
          sortOrder: 2,
          isActive: true,
        },
        {
          id: "elite",
          name: "Elite",
          description: "For enterprise teams",
          monthlyTokens: 10000,
          features: ["Premium AI", "Dedicated support", "Custom features"],
          sortOrder: 3,
          isActive: true,
        },
      ];
    },

    async getTokenCosts(): Promise<TokenCostConfig> {
      return {
        basicEvaluation: 1,
        aiEvaluation: 3,
        offerCreation: 2,
        advancedAnalysis: 5,
      };
    },

    async getPricingConfigs(): Promise<PricingConfig[]> {
      return [
        { planId: "trial", amount: 0, currency: "USD", interval: "month" },
        { planId: "pro", amount: 4900, currency: "USD", interval: "month" }, // $49.00
        { planId: "max", amount: 7900, currency: "USD", interval: "month" }, // $79.00
        { planId: "elite", amount: 9900, currency: "USD", interval: "month" }, // $99.00
      ];
    },

    async createTrialSubscription() {
      return {
        success: true,
        subscriptionId: "mock-trial-id",
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
    },

    async upgradeSubscription(planId: string) {
      return {
        success: true,
        subscriptionId: `mock-subscription-${planId}`,
      };
    },

    async checkPermissions() {
      return {
        canUseAI: false,
        canCreateOffers: true,
        canManageAds: true,
        restrictions: ["AI features require Elite subscription"],
      };
    },

    // ========================================
    // Admin Configuration Management Methods
    // ========================================

    async getAllPermissions() {
      return [
        {
          id: "perm-1",
          feature: "AI评估",
          category: "AI功能",
          description: "使用AI进行Offer评估分析",
          starter: false,
          professional: true,
          elite: true,
        },
        {
          id: "perm-2",
          feature: "创建Offer",
          category: "基础功能",
          description: "创建新的营销Offer",
          starter: true,
          professional: true,
          elite: true,
        },
        {
          id: "perm-3",
          feature: "数据导出",
          category: "数据功能",
          description: "导出分析报告和数据",
          starter: false,
          professional: true,
          elite: true,
        },
        {
          id: "perm-4",
          feature: "批量操作",
          category: "高级功能",
          description: "批量处理多个Offer或账号",
          starter: false,
          professional: false,
          elite: true,
        },
      ];
    },

    async getAllTokenCosts() {
      return [
        {
          id: "cost-1",
          action: "AI评估",
          category: "AI功能",
          description: "使用AI模型进行Offer评估",
          starterCost: 0,
          professionalCost: 50,
          eliteCost: 30,
          unit: "tokens",
          isActive: true,
        },
        {
          id: "cost-2",
          action: "创建Offer",
          category: "基础功能",
          description: "创建新的Offer记录",
          starterCost: 10,
          professionalCost: 5,
          eliteCost: 3,
          unit: "tokens",
          isActive: true,
        },
        {
          id: "cost-3",
          action: "数据导出",
          category: "数据功能",
          description: "导出分析报告",
          starterCost: 20,
          professionalCost: 10,
          eliteCost: 5,
          unit: "tokens",
          isActive: true,
        },
      ];
    },

    async getAllPricing() {
      return [
        {
          id: "plan-1",
          name: "Starter",
          tier: "starter",
          monthlyPrice: 298,
          yearlyPrice: 2980,
          currency: "CNY",
          features: ["基础功能", "每月1000 Token", "邮件支持"],
          monthlyTokens: 1000,
          maxUsers: 1,
          isActive: true,
          sortOrder: 1,
          highlighted: false,
        },
        {
          id: "plan-2",
          name: "Professional",
          tier: "professional",
          monthlyPrice: 998,
          yearlyPrice: 9980,
          currency: "CNY",
          features: ["高级功能", "每月5000 Token", "AI评估", "优先支持"],
          monthlyTokens: 5000,
          maxUsers: 5,
          isActive: true,
          sortOrder: 2,
          highlighted: true,
        },
        {
          id: "plan-3",
          name: "Elite",
          tier: "elite",
          monthlyPrice: 2998,
          yearlyPrice: 29980,
          currency: "CNY",
          features: ["全部功能", "无限Token", "AI评估", "专属支持", "定制服务"],
          monthlyTokens: 20000,
          maxUsers: -1,
          isActive: true,
          sortOrder: 3,
          highlighted: false,
        },
      ];
    },

    async getConfigHistory() {
      return [
        {
          id: "hist-1",
          configType: "permission",
          configId: "perm-1",
          configName: "AI评估权限",
          action: "update",
          oldValue: { starter: false, professional: true, elite: true },
          newValue: { starter: false, professional: true, elite: true },
          changedBy: "admin-1",
          changedByName: "系统管理员",
          changedAt: new Date(
            Date.now() - 2 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          description: "更新AI评估权限配置",
        },
        {
          id: "hist-2",
          configType: "token_cost",
          configId: "cost-1",
          configName: "AI评估Token消耗",
          action: "update",
          oldValue: { professionalCost: 100, eliteCost: 50 },
          newValue: { professionalCost: 50, eliteCost: 30 },
          changedBy: "admin-1",
          changedByName: "系统管理员",
          changedAt: new Date(
            Date.now() - 3 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          description: "降低AI评估功能的Token消耗",
        },
        {
          id: "hist-3",
          configType: "pricing",
          configId: "plan-2",
          configName: "Professional套餐",
          action: "update",
          oldValue: { monthlyPrice: 898, yearlyPrice: 8980 },
          newValue: { monthlyPrice: 998, yearlyPrice: 9980 },
          changedBy: "admin-1",
          changedByName: "系统管理员",
          changedAt: new Date(
            Date.now() - 5 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          description: "调整Professional套餐价格",
        },
      ];
    },
  };
}
