import { useQuery } from '@tanstack/react-query';
import { enhancedUnifiedUserService } from '~/lib/services/EnhancedUnifiedUserService';
import { useUserSession } from '~/core/hooks/use-user';

interface Subscription {
  id: string;
  userId: string;
  plan: 'starter' | 'professional' | 'elite';
  status: 'active' | 'inactive' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

interface TokenBalance {
  userId: string;
  available: number;
  reserved: number;
  total: number;
}

/**
 * Enhanced subscription hook using the unified user service
 * Provides subscription data and plan permissions based on user session
 */
export function useSubscription() {
  const { data: userSession, isLoading: sessionLoading, error: sessionError } = useUserSession();

  const query = useQuery<Subscription>({
    queryKey: ['subscription', userSession?.user.id],
    queryFn: async () => {
      if (!userSession) throw new Error('User session not available');

      try {
        const subscriptionData = await enhancedUnifiedUserService.getUserSubscription(userSession.user.id);
        return subscriptionData;
      } catch (error) {
        console.error('[useSubscription] Error fetching subscription:', error);
        throw error;
      }
    },
    enabled: !!userSession,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const subscription = query.data;

  // Check plan permissions
  const isStarter = subscription?.plan === 'starter';
  const isProfessional = subscription?.plan === 'professional';
  const isElite = subscription?.plan === 'elite';

  // AI evaluation is available for Professional and Elite only
  const canUseAI = isProfessional || isElite;

  // Unlimited offers for Elite only
  const hasUnlimitedOffers = isElite;

  return {
    subscription,
    isLoading: query.isLoading || sessionLoading,
    error: query.error || sessionError,
    refetch: query.refetch,
    // Plan checks
    isStarter,
    isProfessional,
    isElite,
    // Feature checks
    canUseAI,
    hasUnlimitedOffers,
  };
}

/**
 * Enhanced token balance hook using the unified user service
 */
export function useTokenBalance() {
  const { data: userSession, isLoading: sessionLoading, error: sessionError } = useUserSession();

  const query = useQuery<TokenBalance>({
    queryKey: ['token-balance', userSession?.user.id],
    queryFn: async () => {
      if (!userSession) throw new Error('User session not available');

      try {
        return await enhancedUnifiedUserService.getTokenBalance(userSession.user.id);
      } catch (error) {
        console.error('[useTokenBalance] Error fetching balance:', error);
        throw error;
      }
    },
    enabled: !!userSession,
    staleTime: 2 * 60 * 1000, // 2 minutes (更频繁更新)
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    balance: query.data,
    isLoading: query.isLoading || sessionLoading,
    error: query.error || sessionError,
    refetch: query.refetch,
  };
}

/**
 * Hook for checking user permissions and access rights
 */
export function useUserAccess() {
  const { data: userSession, isLoading: sessionLoading } = useUserSession();

  const query = useQuery({
    queryKey: ['user-access', userSession?.user.id],
    queryFn: async () => {
      if (!userSession) return null;

      try {
        return await enhancedUnifiedUserService.getUserPermissions(userSession.user.id);
      } catch (error) {
        console.error('[useUserAccess] Error fetching permissions:', error);
        throw error;
      }
    },
    enabled: !!userSession,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const permissions = query.data;

  // Convenience access checks
  const canCreateOffer = permissions?.canCreateOffers ?? false;
  const canUseAI = permissions?.canUseAI ?? false;
  const isAdmin = permissions?.isAdmin ?? false;
  const maxOffersPerMonth = permissions?.maxOffersPerMonth ?? 0;

  return {
    permissions,
    isLoading: query.isLoading || sessionLoading,
    error: query.error,
    refetch: query.refetch,
    // Access checks
    canCreateOffer,
    canUseAI,
    isAdmin,
    maxOffersPerMonth,
  };
}

/**
 * Hook for user activity statistics
 */
export function useUserActivity() {
  const { data: userSession, isLoading: sessionLoading } = useUserSession();

  const query = useQuery({
    queryKey: ['user-activity', userSession?.user.id],
    queryFn: async () => {
      if (!userSession) return null;

      try {
        return await enhancedUnifiedUserService.getUserActivityStats(userSession.user.id);
      } catch (error) {
        console.error('[useUserActivity] Error fetching activity:', error);
        throw error;
      }
    },
    enabled: !!userSession,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    activity: query.data,
    isLoading: query.isLoading || sessionLoading,
    error: query.error,
    refetch: query.refetch,
  };
}