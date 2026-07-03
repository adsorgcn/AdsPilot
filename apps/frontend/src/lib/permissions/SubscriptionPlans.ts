/**
 * 订阅套餐权限配置
 *
 * 定义不同订阅套餐的业务权限和限制
 * 用户只有2个角色：普通用户、管理员
 * 业务权限通过订阅套餐实现
 */

import type { UserPermissions } from '../api/services/UnifiedUserService';

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  billingCycle: 'monthly' | 'yearly';
  features: UserPermissions;
  uiConfig: {
    color: string;
    icon: string;
    badge: string;
    description: string;
  };
}

// 订阅套餐权限配置
export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  // 试用套餐
  trial: {
    id: 'trial',
    name: '试用套餐',
    price: 0,
    billingCycle: 'monthly',
    features: {
      isAdmin: false,
      role: 'user',
      subscriptionPlan: 'trial',
      canUseAI: true,
      canCreateOffers: true,
      canManageAds: false,
      canViewAnalytics: true,
      canManageBilling: false,
      maxOffersPerMonth: 5,
      maxTokensPerMonth: 100,
      canExportData: false,
      canAccessPrioritySupport: false,
      isOnTrial: true,
      trialEndsAt: undefined, // 动态设置
      isSubscriptionValid: true
    },
    uiConfig: {
      color: 'blue',
      icon: '🧪',
      badge: '试用',
      description: '7天免费试用，体验所有基础功能'
    }
  },

  // 基础套餐
  starter: {
    id: 'starter',
    name: '基础版',
    price: 9.99,
    billingCycle: 'monthly',
    features: {
      isAdmin: false,
      role: 'user',
      subscriptionPlan: 'starter',
      canUseAI: false,
      canCreateOffers: true,
      canManageAds: false,
      canViewAnalytics: true,
      canManageBilling: false,
      maxOffersPerMonth: 10,
      maxTokensPerMonth: 200,
      canExportData: false,
      canAccessPrioritySupport: false,
      isOnTrial: false,
      isSubscriptionValid: true
    },
    uiConfig: {
      color: 'green',
      icon: '🌱',
      badge: '基础',
      description: '适合个人用户和小型项目'
    }
  },

  // 专业套餐
  professional: {
    id: 'professional',
    name: '专业版',
    price: 29.99,
    billingCycle: 'monthly',
    features: {
      isAdmin: false,
      role: 'user',
      subscriptionPlan: 'professional',
      canUseAI: true,
      canCreateOffers: true,
      canManageAds: true,
      canViewAnalytics: true,
      canManageBilling: true,
      maxOffersPerMonth: 50,
      maxTokensPerMonth: 1000,
      canExportData: true,
      canAccessPrioritySupport: false,
      isOnTrial: false,
      isSubscriptionValid: true
    },
    uiConfig: {
      color: 'purple',
      icon: '⭐',
      badge: '专业',
      description: '适合专业用户和成长型企业'
    }
  },

  // 企业套餐
  enterprise: {
    id: 'enterprise',
    name: '企业版',
    price: 99.99,
    billingCycle: 'monthly',
    features: {
      isAdmin: false,
      role: 'user',
      subscriptionPlan: 'enterprise',
      canUseAI: true,
      canCreateOffers: true,
      canManageAds: true,
      canViewAnalytics: true,
      canManageBilling: true,
      maxOffersPerMonth: 999, // 无限制
      maxTokensPerMonth: 10000,
      canExportData: true,
      canAccessPrioritySupport: true,
      isOnTrial: false,
      isSubscriptionValid: true
    },
    uiConfig: {
      color: 'orange',
      icon: '🏢',
      badge: '企业',
      description: '适合大型企业和团队协作'
    }
  },

  // 管理员（特殊角色）
  admin: {
    id: 'admin',
    name: '管理员',
    price: 0,
    billingCycle: 'monthly',
    features: {
      isAdmin: true,
      role: 'admin',
      subscriptionPlan: 'admin',
      canUseAI: true,
      canCreateOffers: true,
      canManageAds: true,
      canViewAnalytics: true,
      canManageBilling: true,
      maxOffersPerMonth: 999, // 无限制
      maxTokensPerMonth: 99999, // 无限制
      canExportData: true,
      canAccessPrioritySupport: true,
      isOnTrial: false,
      isSubscriptionValid: true
    },
    uiConfig: {
      color: 'red',
      icon: '👑',
      badge: '管理员',
      description: '系统管理员，拥有所有权限'
    }
  }
};

// 获取用户权限（基于订阅套餐）
export function getUserPermissionsByPlan(
  planId: string,
  additionalData?: {
    subscriptionExpiresAt?: string;
    trialEndsAt?: string;
  }
): UserPermissions {
  const plan = SUBSCRIPTION_PLANS[planId];
  if (!plan) {
    throw new Error(`Unknown subscription plan: ${planId}`);
  }

  return {
    ...plan.features,
    ...(additionalData?.subscriptionExpiresAt && { subscriptionExpiresAt: additionalData.subscriptionExpiresAt }),
    ...(additionalData?.trialEndsAt && { trialEndsAt: additionalData.trialEndsAt })
  };
}

// 检查权限升级路径
export function canUpgradePlan(currentPlanId: string, targetPlanId: string): boolean {
  const planHierarchy = ['trial', 'starter', 'professional', 'enterprise'];
  const currentIndex = planHierarchy.indexOf(currentPlanId);
  const targetIndex = planHierarchy.indexOf(targetPlanId);

  return targetIndex > currentIndex;
}

// 获取套餐升级建议
export function getUpgradeSuggestions(currentPlanId: string): SubscriptionPlan[] {
  const planHierarchy = ['trial', 'starter', 'professional', 'enterprise'];
  const currentIndex = planHierarchy.indexOf(currentPlanId);

  return planHierarchy
    .slice(currentIndex + 1)
    .map(planId => SUBSCRIPTION_PLANS[planId])
    .filter(Boolean);
}

// 权限检查函数
export const PermissionChecks = {
  // AI功能权限
  canUseAI: (permissions: UserPermissions): boolean =>
    permissions.canUseAI && permissions.isAdmin ||
    (permissions.canUseAI && (permissions.isSubscriptionValid || permissions.isOnTrial)),

  // Offer创建权限
  canCreateOffers: (permissions: UserPermissions): boolean =>
    permissions.canCreateOffers && (
      permissions.isAdmin ||
      (permissions.isSubscriptionValid || permissions.isOnTrial)
    ),

  // 广告管理权限
  canManageAds: (permissions: UserPermissions): boolean =>
    permissions.canManageAds && (
      permissions.isAdmin ||
      (permissions.isSubscriptionValid || permissions.isOnTrial)
    ),

  // 高级功能权限
  canAccessAdvancedFeatures: (permissions: UserPermissions): boolean =>
    permissions.isAdmin ||
    (permissions.subscriptionPlan !== 'starter' && permissions.subscriptionPlan !== 'trial'),

  // 数据导出权限
  canExportData: (permissions: UserPermissions): boolean =>
    permissions.canExportData && (
      permissions.isAdmin ||
      (permissions.isSubscriptionValid || permissions.isOnTrial)
    ),

  // 优先支持权限
  canAccessPrioritySupport: (permissions: UserPermissions): boolean =>
    permissions.canAccessPrioritySupport &&
    (permissions.isAdmin || permissions.isSubscriptionValid)
};

export default SUBSCRIPTION_PLANS;