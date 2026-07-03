import { useMemo } from 'react';

import useUserSession from '~/core/hooks/use-user-session';
import useUserSubscription from '~/core/hooks/use-user-subscription';
import configuration from '~/configuration';

import type { UserRole } from '~/core/session/types/user-session';
import type { SubscriptionTier } from '~/lib/types/subscription';

export type NavigationFeatureFlags = typeof configuration.features;

export interface NavigationContextValue {
  role?: UserRole;
  subscriptionTier?: SubscriptionTier;
  featureFlags: NavigationFeatureFlags;
  isSubscriptionLoading: boolean;
}

export default function useNavigationContext(): NavigationContextValue {
  const session = useUserSession();
  const { data: subscription, isLoading } = useUserSubscription();

  return useMemo(
    () => ({
      role: session?.role ?? undefined,
      subscriptionTier: subscription?.tier ?? undefined,
      featureFlags: configuration.features,
      isSubscriptionLoading: isLoading,
    }),
    [session?.role, subscription?.tier, isLoading],
  );
}
