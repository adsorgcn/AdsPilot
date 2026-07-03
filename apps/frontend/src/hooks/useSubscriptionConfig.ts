import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import useUser from '~/core/hooks/use-user';
import useSupabase from '~/core/hooks/use-supabase';

export interface SubscriptionPermission {
  feature: string;
  featureName: string;
  category: string;
  starterValue: any;
  professionalValue: any;
  eliteValue: any;
  displayOnly: boolean;
}

export interface TokenCost {
  action: string;
  actionName: string;
  category: string;
  starterCost: number | 'unsupported';
  professionalCost: number | 'unsupported';
  eliteCost: number | 'unsupported';
}

export interface PricingPlan {
  plan: string;
  displayName: string;
  description: string;
  badge?: string;
  recommended: boolean;
  tokenQuota: number;
  monthlyAmount: number;
  monthlyStripePriceId: string;
  yearlyAmount: number;
  yearlyStripePriceId: string;
  yearlyDiscount?: number;
}

export interface SubscriptionConfig {
  permissions: SubscriptionPermission[];
  tokenCosts: TokenCost[];
  pricing: PricingPlan[];
  version: string;
}

/**
 * Hook to fetch and cache subscription configuration
 * Supports SSE for real-time updates
 */
export function useSubscriptionConfig() {
  const { data: user } = useUser();
  const client = useSupabase();
  const [liveConfig, setLiveConfig] = useState<SubscriptionConfig | null>(null);

  // Fetch configuration using React Query
  const query = useQuery<SubscriptionConfig>({
    queryKey: ['subscription-config'],
    queryFn: async () => {
      const { data } = await client.auth.getSession();
      const token = data.session?.access_token || null;
      const response = await fetch('/api/v1/billing/config/all', {
        headers: token ? {
          'Authorization': `Bearer ${token}`,
        } : {},
      });

      if (!response.ok) {
        throw new Error('Failed to fetch subscription config');
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
  });

  // Set up SSE for real-time updates
  useEffect(() => {
    if (!user) return;

    let eventSource: EventSource | null = null;

    const setupSSE = async () => {
      try {
        const { data } = await client.auth.getSession();
        const token = data.session?.access_token || null;
        if (!token) return;
        
        // Create EventSource with auth token in URL (SSE doesn't support custom headers)
        eventSource = new EventSource(`/api/v1/billing/config/updates?token=${token}`);

        eventSource.onmessage = (event) => {
          try {
            const update = JSON.parse(event.data);
            console.log('Received config update:', update);

            // Refetch configuration
            query.refetch();

            // Update live config
            if (update.config) {
              setLiveConfig(update.config);
            }
          } catch (err) {
            console.error('Failed to parse SSE message:', err);
          }
        };

        eventSource.onerror = (error) => {
          console.error('SSE connection error:', error);
          eventSource?.close();
          
          // Retry connection after 5 seconds
          setTimeout(setupSSE, 5000);
        };
      } catch (err) {
        console.error('Failed to setup SSE:', err);
      }
    };

    setupSSE();

    return () => {
      eventSource?.close();
    };
  }, [user, query]);

  return {
    config: liveConfig || query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook to get pricing plans with currency formatting
 */
export function usePricingPlans(currency: 'CNY' | 'USD' = 'CNY') {
  const { config, isLoading, isError } = useSubscriptionConfig();

  const formatPrice = (amount: number) => {
    if (currency === 'CNY') {
      return `¥${(amount / 100).toFixed(0)}`;
    } else {
      return `$${(amount / 100).toFixed(2)}`;
    }
  };

  const plans = config?.pricing.map(plan => ({
    ...plan,
    monthlyPrice: formatPrice(plan.monthlyAmount),
    yearlyPrice: formatPrice(plan.yearlyAmount),
    monthlyPriceRaw: plan.monthlyAmount / 100,
    yearlyPriceRaw: plan.yearlyAmount / 100,
  }));

  return {
    plans,
    isLoading,
    isError,
  };
}

/**
 * Hook to get permissions for a specific plan
 */
export function usePlanPermissions(plan: 'starter' | 'professional' | 'elite') {
  const { config } = useSubscriptionConfig();

  if (!config) return null;

  const permissions: Record<string, any> = {};

  config.permissions.forEach(perm => {
    const key = perm.feature;
    switch (plan) {
      case 'starter':
        permissions[key] = perm.starterValue;
        break;
      case 'professional':
        permissions[key] = perm.professionalValue;
        break;
      case 'elite':
        permissions[key] = perm.eliteValue;
        break;
    }
  });

  return permissions;
}

/**
 * Hook to get token costs for a specific plan
 */
export function usePlanTokenCosts(plan: 'starter' | 'professional' | 'elite') {
  const { config } = useSubscriptionConfig();

  if (!config) return null;

  const costs: Record<string, number | 'unsupported'> = {};

  config.tokenCosts.forEach(cost => {
    const key = cost.action;
    switch (plan) {
      case 'starter':
        costs[key] = cost.starterCost;
        break;
      case 'professional':
        costs[key] = cost.professionalCost;
        break;
      case 'elite':
        costs[key] = cost.eliteCost;
        break;
    }
  });

  return costs;
}
