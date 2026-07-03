import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

import { apiGet, apiPost } from '~/lib/api';
import { API_ENDPOINTS } from '~/lib/api/endpoints';
import useSupabase from '~/core/hooks/use-supabase';
import { createLogger } from '~/lib/utils/logger';

const logger = createLogger('Dashboard');

import type {
  ConsoleDashboardData,
  DashboardData,
  DashboardMetrics,
  DashboardParams,
  DashboardTrends,
  OnboardingChecklist,
  MarkAlertReadRequest,
  RiskAlert,
  TopOffer,
} from './types';

type Period = DashboardParams['period'];

/**
 * Hook to fetch Console Dashboard data from aggregation endpoint
 * Uses Console service: GET /api/v1/console/dashboard/:userId
 * Features: 30s caching, concurrent service calls, partial failure tolerance
 *
 * @param options - SWR configuration options
 * @returns Dashboard data with offers, tokens, accounts, and recent activity
 *
 * Ref: Package B - Task B1-2
 * Ref: /services/console/internal/handlers/aggregation.go
 */
export function useConsoleDashboard(options?: {
  refreshInterval?: number;
  fallbackData?: ConsoleDashboardData;
}) {
  const client = useSupabase();

  const fetcher = useCallback(async () => {
    // Get current user ID
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Call Console service aggregation endpoint
    const endpoint = API_ENDPOINTS.CONSOLE.DASHBOARD_(user.id);
    const data = await apiGet<ConsoleDashboardData>(endpoint);

    // Log dashboard load time for monitoring (Ref: Task B4-3)
    logger.debug('Loaded dashboard data', {
      userId: user.id,
      offersTotal: data.offers?.total,
      tokensBalance: data.tokens?.balance.available,
      accountsTotal: data.accounts?.total,
      hasErrors: Object.keys(data.errors || {}).length > 0,
      errors: data.errors,
      timestamp: new Date().toISOString(),
    });

    return data;
  }, [client]);

  return useQuery<ConsoleDashboardData>({
    queryKey: ['console-dashboard'],
    queryFn: fetcher,
    refetchInterval: options?.refreshInterval ?? 30000, // 30s default
    refetchOnWindowFocus: true,
    placeholderData: options?.fallbackData,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useOnboardingChecklist(options?: { refreshInterval?: number }) {
  const client = useSupabase();

  const fetcher = useCallback(async () => {
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const endpoint = `/console/onboarding/${user.id}`;
    return apiGet<OnboardingChecklist>(endpoint);
  }, [client]);

  return useQuery<OnboardingChecklist>({
    queryKey: ['console-onboarding'],
    queryFn: fetcher,
    refetchInterval: options?.refreshInterval ?? 60000,
    refetchOnWindowFocus: true,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * ❌ 已废弃 - 用户Dashboard不应调用Console服务
 *
 * 架构说明：
 * - Console服务仅用于管理后台（/manage）
 * - 用户Dashboard应直接调用微服务API（Offers、Billing等）
 *
 * 替代方案：
 * - 使用 useOffersStats() from '~/lib/offers/hooks'
 * - 使用 useBillingTokenBalance() from '~/lib/billing/hooks'
 *
 * @deprecated Use useOffersStats instead
 */

/**
 * Legacy hook for backward compatibility
 */
export function useDashboard(params: DashboardParams = {}) {
  const endpoint = buildDashboardEndpoint('/dashboard', params);

  return useQuery<DashboardData>({
    queryKey: ['dashboard', params],
    queryFn: () => apiGet<DashboardData>(endpoint),
    refetchInterval: 10000, // 10 seconds for realtime
    staleTime: 10 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Legacy hooks - organizationId parameter removed during user-centric refactoring
 * These hooks are kept for backward compatibility but no longer use organization context
 */

export function useDashboardMetrics() {
  return useQuery<DashboardMetrics>({
    queryKey: ['dashboard/metrics'],
    queryFn: () => apiGet<DashboardMetrics>('/dashboard/metrics'),
    refetchInterval: 10000, // 10 seconds for realtime
    staleTime: 10 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useRiskAlerts() {
  const query = useQuery<RiskAlert[]>({
    queryKey: ['dashboard/risk-alerts'],
    queryFn: () => apiGet<RiskAlert[]>('/dashboard/risk-alerts'),
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    staleTime: 10 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  return {
    ...query,
    alerts: query.data ?? [],
    unreadCount: query.data?.filter((item) => !item.is_read).length ?? 0,
  };
}

export function useTopOffers(limit = 10) {
  return useQuery<TopOffer[]>({
    queryKey: ['dashboard/top-offers', limit],
    queryFn: () => apiGet<TopOffer[]>(`/dashboard/top-offers?limit=${limit}`),
    refetchInterval: 30000,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useDashboardTrends(
  period: Period = '7d',
) {
  return useQuery<DashboardTrends>({
    queryKey: ['dashboard/trends', period],
    queryFn: () => apiGet<DashboardTrends>(`/dashboard/trends?period=${period}`),
    refetchInterval: 30000, // 30 seconds polling
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useMarkAlertRead() {
  return useCallback(
    async (request: MarkAlertReadRequest) => {
      await apiPost(`/dashboard/risk-alerts/${request.alert_id}/read`, {});
    },
    [],
  );
}

function buildDashboardEndpoint(
  endpoint: string,
  params: DashboardParams,
) {
  const url = new URL(endpoint, 'http://dummy');

  if (params.period) {
    url.searchParams.set('period', params.period);
  }

  if (params.include_alerts !== undefined) {
    url.searchParams.set('include_alerts', `${params.include_alerts}`);
  }

  if (params.include_top_offers !== undefined) {
    url.searchParams.set('include_top_offers', `${params.include_top_offers}`);
  }

  if (params.include_trends !== undefined) {
    url.searchParams.set('include_trends', `${params.include_trends}`);
  }

  // organization_id parameter removed during user-centric refactoring

  return `${url.pathname}${url.search}`;
}
