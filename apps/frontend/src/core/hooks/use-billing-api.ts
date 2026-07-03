/**
 * Enhanced React Hooks for Billing API Integration
 *
 * 提供与billing服务交互的React hooks，使用统一用户服务
 */

import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { SubscriptionPermissions, TokenCostConfig, PricingConfig } from '~/lib/types/subscription';
import { createBillingApiClient } from '~/lib/billing-api-client';
import { enhancedUnifiedUserService } from '~/lib/services/EnhancedUnifiedUserService';
import type {
  SubscriptionInfo,
  SubscriptionConfig,
  TokenCostConfig,
  PricingConfig
} from '~/lib/types/subscription';

/**
 * Enhanced hook for fetching user subscription information using unified user service
 *
 * @example
 * ```tsx
 * const { data: subscription, isLoading, error } = useSubscription();
 *
 * if (subscription?.canUseAI) {
 *   // Show AI features
 * }
 * ```
 */
export function useSubscription() {
  const client = createBillingApiClient();

  const query = useQuery({
    queryKey: ['billing-subscription'],
    queryFn: async () => {
      try {
        // First try to get subscription from unified user service
        const userSession = await enhancedUnifiedUserService.getUserSession();
        const subscriptionData = await enhancedUnifiedUserService.getUserSubscription(userSession.user.id);
        const tokenBalance = await enhancedUnifiedUserService.getUserTokenBalance(userSession.user.id);

        // Transform the unified service response to match SubscriptionInfo interface
        return transformUnifiedSubscriptionData(subscriptionData, tokenBalance);
      } catch (unifiedError) {
        console.warn('[useSubscription] Unified service failed, falling back to billing client:', unifiedError);
        // Fallback to billing client
        return client.getSubscription();
      }
    },
    staleTime: 60 * 1000, // 1 minute - subscription changes slowly
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // 1 minute polling
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Transform unified service subscription data to match SubscriptionInfo interface
 */
function transformUnifiedSubscriptionData(
  data: {
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
  },
  tokenBalance?: { balance: number }
): SubscriptionInfo {
  const tier = data.plan as SubscriptionTier;
  const isElite = tier === 'elite';
  const isActive = data.status === 'active';
  const isOnTrial = data.status === 'trial';

  return {
    tier,
    isActive,
    isElite,
    canUseAI: data.limits.canUseAI,
    monthlyTokenAllocation: data.limits.maxTokensPerMonth,
    currentTokenBalance: tokenBalance?.balance ?? data.limits.maxTokensPerMonth,
    subscriptionEndDate: data.expiresAt || null,
    trialEndDate: data.trialEndsAt || null,
    isOnTrial,
    daysRemaining: data.expiresAt || data.trialEndsAt
      ? Math.ceil((new Date(data.expiresAt || data.trialEndsAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null,
    features: data.features,
    canUpgrade: tier !== 'elite', // Can upgrade if not already elite
    availableUpgrades: tier === 'trial' ? ['pro', 'max', 'elite'] :
                      tier === 'pro' ? ['max', 'elite'] :
                      tier === 'max' ? ['elite'] : [],
  };
}

/**
 * Enhanced hook for fetching token balance information using unified user service
 */
export function useTokenBalance() {
  const client = createBillingApiClient();

  const query = useQuery({
    queryKey: ['billing-token-balance'],
    queryFn: async () => {
      try {
        // First try to get token balance from unified user service
        const userSession = await enhancedUnifiedUserService.getUserSession();
        return await enhancedUnifiedUserService.getTokenBalance(userSession.user.id);
      } catch (unifiedError) {
        console.warn('[useTokenBalance] Unified service failed, falling back to billing client:', unifiedError);
        // Fallback to billing client
        return client.getTokenBalance();
      }
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30 * 1000, // 30 seconds polling
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook for fetching subscription configurations
 */
export function useSubscriptionConfigs() {
  const client = createBillingApiClient();

  const query = useQuery({
    queryKey: ['billing-subscription-configs'],
    queryFn: () => client.getSubscriptionConfigs(),
    staleTime: 30 * 60 * 1000, // 30 minutes - configs rarely change
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    retry: 2,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook for fetching token cost configurations
 */
export function useTokenCostConfigs() {
  const client = createBillingApiClient();

  const query = useQuery({
    queryKey: ['billing-token-cost-configs'],
    queryFn: () => client.getTokenCostConfigs(),
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    retry: 2,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook for fetching pricing configurations
 */
export function usePricingConfigs() {
  const client = createBillingApiClient();

  const query = useQuery({
    queryKey: ['billing-pricing-configs'],
    queryFn: () => client.getPricingConfigs(),
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    retry: 2,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// Note: Mutation hooks remain unchanged as they use useMutation pattern
// which is similar between SWR and TanStack Query

/**
 * Hook for fetching token costs
 */
export function useTokenCosts() {
  const client = createBillingApiClient();

  const query = useQuery({
    queryKey: ['billing-token-costs'],
    queryFn: () => client.getTokenCosts(),
    staleTime: 30 * 60 * 1000, // 30 minutes - costs don't change frequently
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    retry: 2,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Enhanced hook for checking user permissions using unified user service
 */
export function usePermissions() {
  const client = createBillingApiClient();

  const query = useQuery({
    queryKey: ['billing-permissions'],
    queryFn: async () => {
      try {
        // First try to get permissions from unified user service
        const userSession = await enhancedUnifiedUserService.getUserSession();
        return await enhancedUnifiedUserService.getUserPermissions(userSession.user.id);
      } catch (unifiedError) {
        console.warn('[usePermissions] Unified service failed, falling back to billing client:', unifiedError);
        // Fallback to billing client
        return client.checkPermissions();
      }
    },
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // 1 minute polling
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook for creating trial subscription
 */
export function useCreateTrialSubscription() {
  const client = createBillingApiClient();
  const { mutate: mutateSubscription } = useSubscription();

  const createTrial = useCallback(async () => {
    try {
      const result = await client.createTrialSubscription();

      if (result.success) {
        // Refresh subscription data
        mutateSubscription();
      }

      return result;
    } catch (error) {
      console.error('Failed to create trial subscription:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }, [client, mutateSubscription]);

  return createTrial;
}

/**
 * Hook for upgrading subscription
 */
export function useUpgradeSubscription() {
  const client = createBillingApiClient();
  const { mutate: mutateSubscription } = useSubscription();

  const upgradeSubscription = useCallback(async (planId: string) => {
    try {
      const result = await client.upgradeSubscription(planId);

      if (result.success) {
        // Refresh subscription data
        mutateSubscription();
      }

      return result;
    } catch (error) {
      console.error('Failed to upgrade subscription:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }, [client, mutateSubscription]);

  return upgradeSubscription;
}

/**
 * Hook for getting subscription status with loading states
 */
export function useSubscriptionStatus() {
  const { data: subscription, isLoading, error } = useSubscription();
  const { data: permissions } = usePermissions();

  return {
    subscription,
    permissions,
    isLoading,
    error,
    // Convenience flags
    canUseAI: subscription?.canUseAI ?? false,
    canCreateOffers: permissions?.canCreateOffers ?? false,
    canManageAds: permissions?.canManageAds ?? false,
    isOnTrial: subscription?.isOnTrial ?? false,
    isExpired: subscription ? !subscription.isActive && !subscription.isOnTrial : false,
    needsUpgrade: subscription ? !subscription.canUseAI && !subscription.isOnTrial : false,
  };
}

/**
 * Enhanced subscription hook with all flags and data
 * Alias for useSubscriptionStatus for backward compatibility
 */
export function useEnhancedSubscription() {
  return useSubscriptionStatus();
}

// ========================================
// Admin Hooks for Configuration Management
// ========================================

/**
 * Hook for fetching subscription permissions configuration (Admin)
 */
export function useSubscriptionPermissions() {
  const client = createBillingApiClient();

  return useQuery({
    queryKey: ['billing-admin-permissions'],
    queryFn: () => client.getAllPermissions(),
    refetchInterval: 60000, // Refresh every minute
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook for fetching token cost configuration (Admin)
 */
export function useSubscriptionTokenCosts() {
  const client = createBillingApiClient();

  return useQuery({
    queryKey: ['billing-admin-token-costs'],
    queryFn: () => client.getAllTokenCosts(),
    refetchInterval: 60000, // Refresh every minute
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook for fetching subscription pricing configuration (Admin)
 */
export function useSubscriptionPricing() {
  const client = createBillingApiClient();

  return useQuery({
    queryKey: ['billing-admin-pricing'],
    queryFn: () => client.getAllPricing(),
    refetchInterval: 60000, // Refresh every minute
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook for fetching configuration history
 */
export function useConfigHistory() {
  const client = createBillingApiClient();

  return useQuery({
    queryKey: ['billing-config-history'],
    queryFn: () => client.getConfigHistory(),
    refetchInterval: 300000, // Refresh every 5 minutes
    refetchOnWindowFocus: true,
  });
}
