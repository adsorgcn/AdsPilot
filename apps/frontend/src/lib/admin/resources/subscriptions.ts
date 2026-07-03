/**
 * Subscription Admin Resources
 * 订阅管理相关的后台资源hooks
 */

import { createParamResource, createStaticResource } from '~/lib/api/resources';
import { useMutation } from '@tanstack/react-query';
import getSupabaseBrowserClient from '~/core/supabase/browser-client';
import type {
  SubscriptionStats,
  SubscriptionWithUser,
  AdjustSubscriptionRequest,
} from '~/lib/api/types/console';

/**
 * Fetch subscription statistics
 */
async function fetchSubscriptionStats(signal?: AbortSignal): Promise<SubscriptionStats> {
  const client = getSupabaseBrowserClient();
  const { data: session } = await client.auth.getSession();

  if (!session?.session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/v1/console/subscriptions/stats', {
    headers: {
      Authorization: `Bearer ${session.session.access_token}`,
    },
    signal,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch subscription stats');
  }

  return response.json();
}

/**
 * Fetch subscription list
 */
async function fetchSubscriptions(
  params: {
    page?: number;
    pageSize?: number;
    search?: string;
    plan?: string;
    status?: string;
  },
  signal?: AbortSignal,
): Promise<{
  items: SubscriptionWithUser[];
  totalCount: number;
  page: number;
  pageSize: number;
}> {
  const client = getSupabaseBrowserClient();
  const { data: session } = await client.auth.getSession();

  if (!session?.session?.access_token) {
    throw new Error('Not authenticated');
  }

  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set('page', params.page.toString());
  if (params.pageSize) queryParams.set('pageSize', params.pageSize.toString());
  if (params.search) queryParams.set('search', params.search);
  if (params.plan) queryParams.set('plan', params.plan);
  if (params.status) queryParams.set('status', params.status);

  const response = await fetch(`/api/v1/console/subscriptions?${queryParams.toString()}`, {
    headers: {
      Authorization: `Bearer ${session.session.access_token}`,
    },
    signal,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch subscriptions');
  }

  return response.json();
}

/**
 * Fetch single subscription detail
 */
async function fetchSubscriptionDetail(
  subscriptionId: string,
  signal?: AbortSignal,
): Promise<SubscriptionWithUser> {
  const client = getSupabaseBrowserClient();
  const { data: session } = await client.auth.getSession();

  if (!session?.session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/v1/console/subscriptions/${subscriptionId}`, {
    headers: {
      Authorization: `Bearer ${session.session.access_token}`,
    },
    signal,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch subscription detail');
  }

  return response.json();
}

/**
 * Adjust subscription
 */
async function adjustSubscription(
  subscriptionId: string,
  updates: AdjustSubscriptionRequest,
): Promise<SubscriptionWithUser> {
  const client = getSupabaseBrowserClient();
  const { data: session } = await client.auth.getSession();

  if (!session?.session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/v1/console/subscriptions/${subscriptionId}/adjust`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.session.access_token}`,
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to adjust subscription');
  }

  return response.json();
}

/**
 * Hook: Get subscription statistics
 */
export const useConsoleSubscriptionStats = createStaticResource<SubscriptionStats>(
  ['console', 'subscriptions', 'stats'],
  fetchSubscriptionStats,
  {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  },
);

/**
 * Hook: Get subscription list
 */
export const useConsoleSubscriptions = createParamResource<
  {
    page?: number;
    pageSize?: number;
    search?: string;
    plan?: string;
    status?: string;
  },
  {
    items: SubscriptionWithUser[];
    totalCount: number;
    page: number;
    pageSize: number;
  }
>(
  (params) => ['console', 'subscriptions', 'list', params],
  (params, signal) => fetchSubscriptions(params, signal),
  {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  },
);

/**
 * Hook: Get subscription detail
 */
export function useConsoleSubscriptionDetail(subscriptionId: string) {
  return createStaticResource<SubscriptionWithUser>(
    ['console', 'subscriptions', 'detail', subscriptionId],
    (signal) => fetchSubscriptionDetail(subscriptionId, signal),
    {
      revalidateOnFocus: true,
    },
  )();
}

/**
 * Hook: Adjust subscription
 */
export function useAdjustSubscription(subscriptionId: string) {
  return useMutation({
    mutationFn: (updates: AdjustSubscriptionRequest) => adjustSubscription(subscriptionId, updates),
  });
}
