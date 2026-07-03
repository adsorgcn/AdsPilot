/**
 * Analytics Admin Resources
 * 分析数据相关的后台资源hooks
 */

import { createParamResource } from '~/lib/api/resources';
import getSupabaseBrowserClient from '~/core/supabase/browser-client';

interface AnalyticsParams {
  period?: 'daily' | 'weekly' | 'monthly';
  days?: number;
}

interface DataPoint {
  date: string;
  value: number;
}

export interface UserGrowthData {
  todayNewUsers: number;
  weekNewUsers: number;
  monthNewUsers: number;
  dau: number;
  wau: number;
  mau: number;
  dataPoints: DataPoint[];
}

export interface TokenConsumptionData {
  totalConsumed: number;
  todayConsumed: number;
  weekConsumed: number;
  monthConsumed: number;
  topConsumers: Array<{
    userId: string;
    userEmail: string;
    consumed: number;
  }>;
  dataPoints: DataPoint[];
}

export interface RevenueData {
  mrr: number;
  arr: number;
  activeSubscribers: number;
  dataPoints: DataPoint[];
}

export interface ActivityData {
  dau: number;
  wau: number;
  mau: number;
  totalOffers: number;
  totalEvaluations: number;
  activeOffers: number;
  dataPoints: DataPoint[];
}

/**
 * Fetch user growth analytics
 */
async function fetchUserGrowth(
  params: AnalyticsParams,
  signal?: AbortSignal,
): Promise<UserGrowthData> {
  const client = getSupabaseBrowserClient();
  const { data: session } = await client.auth.getSession();

  if (!session?.session?.access_token) {
    throw new Error('Not authenticated');
  }

  const queryParams = new URLSearchParams();
  if (params.period) queryParams.set('period', params.period);
  if (params.days) queryParams.set('days', params.days.toString());

  const response = await fetch(`/api/v1/console/analytics/users?${queryParams.toString()}`, {
    headers: {
      Authorization: `Bearer ${session.session.access_token}`,
    },
    signal,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user growth analytics');
  }

  return response.json();
}

/**
 * Fetch token consumption analytics
 */
async function fetchTokenConsumption(
  params: AnalyticsParams,
  signal?: AbortSignal,
): Promise<TokenConsumptionData> {
  const client = getSupabaseBrowserClient();
  const { data: session } = await client.auth.getSession();

  if (!session?.session?.access_token) {
    throw new Error('Not authenticated');
  }

  const queryParams = new URLSearchParams();
  if (params.period) queryParams.set('period', params.period);
  if (params.days) queryParams.set('days', params.days.toString());

  const response = await fetch(`/api/v1/console/analytics/tokens?${queryParams.toString()}`, {
    headers: {
      Authorization: `Bearer ${session.session.access_token}`,
    },
    signal,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch token consumption analytics');
  }

  return response.json();
}

/**
 * Fetch revenue analytics
 */
async function fetchRevenue(
  params: AnalyticsParams,
  signal?: AbortSignal,
): Promise<RevenueData> {
  const client = getSupabaseBrowserClient();
  const { data: session } = await client.auth.getSession();

  if (!session?.session?.access_token) {
    throw new Error('Not authenticated');
  }

  const queryParams = new URLSearchParams();
  if (params.period) queryParams.set('period', params.period);
  if (params.days) queryParams.set('days', params.days.toString());

  const response = await fetch(`/api/v1/console/analytics/revenue?${queryParams.toString()}`, {
    headers: {
      Authorization: `Bearer ${session.session.access_token}`,
    },
    signal,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch revenue analytics');
  }

  return response.json();
}

/**
 * Fetch activity analytics
 */
async function fetchActivity(
  params: { days?: number },
  signal?: AbortSignal,
): Promise<ActivityData> {
  const client = getSupabaseBrowserClient();
  const { data: session } = await client.auth.getSession();

  if (!session?.session?.access_token) {
    throw new Error('Not authenticated');
  }

  const queryParams = new URLSearchParams();
  if (params.days) queryParams.set('days', params.days.toString());

  const response = await fetch(`/api/v1/console/analytics/activity?${queryParams.toString()}`, {
    headers: {
      Authorization: `Bearer ${session.session.access_token}`,
    },
    signal,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch activity analytics');
  }

  return response.json();
}

/**
 * Hook: Get user growth analytics
 */
export const useConsoleUserGrowth = createParamResource<AnalyticsParams, UserGrowthData>(
  (params) => ['console', 'analytics', 'users', params],
  (params, signal) => fetchUserGrowth(params, signal),
  {
    refreshInterval: 60_000, // 1 minute
    revalidateOnFocus: true,
  },
);

/**
 * Hook: Get token consumption analytics
 */
export const useConsoleTokenConsumption = createParamResource<AnalyticsParams, TokenConsumptionData>(
  (params) => ['console', 'analytics', 'tokens', params],
  (params, signal) => fetchTokenConsumption(params, signal),
  {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  },
);

/**
 * Hook: Get revenue analytics
 */
export const useConsoleRevenue = createParamResource<AnalyticsParams, RevenueData>(
  (params) => ['console', 'analytics', 'revenue', params],
  (params, signal) => fetchRevenue(params, signal),
  {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  },
);

/**
 * Hook: Get activity analytics
 */
export const useConsoleActivity = createParamResource<{ days?: number }, ActivityData>(
  (params) => ['console', 'analytics', 'activity', params],
  (params, signal) => fetchActivity(params, signal),
  {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  },
);
