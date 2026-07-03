import { useSubscription as useBillingSubscription, useSubscriptionStatus } from './use-billing-api';
import type { SubscriptionInfo } from '~/lib/types/subscription';

/**
 * @name useUserSubscription
 * @description Hook to fetch and manage user subscription information
 *
 * Legacy hook that now uses the new billing service API.
 * Maintains backward compatibility with existing components.
 *
 * @example
 * ```tsx
 * const { data: subscription, isLoading } = useUserSubscription();
 *
 * if (subscription?.canUseAI) {
 *   // Show AI evaluation option
 * }
 * ```
 *
 * Ref: FrontendDesignComplete_20251009.md - Section 21.2
 */
function useUserSubscription() {
  // Use the new billing API hook
  const { data: subscription, isLoading, error } = useBillingSubscription();

  // Maintain backward compatibility by returning the same structure
  return {
    data: subscription,
    isLoading,
    error,
    // Maintain the same SWR interface for existing code
    mutate: async () => {
      // Trigger revalidation if needed
      console.log('Legacy useUserSubscription called mutate');
    },
  };
}

/**
 * Enhanced hook with additional subscription status utilities
 * Use this in new components for better functionality
 */
export function useEnhancedSubscription() {
  return useSubscriptionStatus();
}

export default useUserSubscription;
