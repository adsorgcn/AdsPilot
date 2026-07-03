import { useQuery } from '@tanstack/react-query';

import { apiGet, apiPost } from '~/lib/api';
import { API_ENDPOINTS } from '~/lib/api/endpoints';

import { mapTokenBalance } from './mappers';
import type {
  CheckinStatus,
  PerformCheckinResponse,
  RawTokenBalance,
  ReferralSummary,
  SubscriptionInfo,
  TokenBalance,
  TokenTransaction,
  TokenUsageSummary,
} from './types';
import { estimateTokenCosts } from './token-cost-estimator';

type UsageSummaryParams = {
  startDate: string;
  endDate: string;
};

export function useBillingTokenBalance() {
  const endpoint = API_ENDPOINTS.BILLING.TOKENS_BALANCE;

  return useQuery<TokenBalance>({
    queryKey: ['billing-token-balance'],
    queryFn: async () => {
      const data = await apiGet<RawTokenBalance>(endpoint);
      return mapTokenBalance(data);
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useTokenTransactions() {
  const endpoint = API_ENDPOINTS.BILLING.TOKENS_TRANSACTIONS;

  return useQuery<TokenTransaction[]>({
    queryKey: ['billing-token-transactions'],
    queryFn: async () => {
      const data = await apiGet<TokenTransaction[]>(endpoint);
      return (data ?? []).map(mapTransaction);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useTokenUsageSummary(params: UsageSummaryParams) {
  const endpoint = buildUsageEndpoint(params);

  return useQuery<TokenUsageSummary>({
    queryKey: ['billing-token-usage', params],
    queryFn: async () => {
      const data = await apiGet<TokenUsageSummary>(endpoint);
      return normalizeUsageSummary(data);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useSubscriptionInfo() {
  const endpoint = API_ENDPOINTS.BILLING.SUBSCRIPTIONS_ME;

  return useQuery<SubscriptionInfo | null>({
    queryKey: ['billing-subscription'],
    queryFn: async () => {
      try {
        const data = await apiGet<SubscriptionInfo>(endpoint);
        return {
          ...data,
          currentPeriodEnd: normalizeDate(data.currentPeriodEnd),
        } satisfies SubscriptionInfo;
      } catch (error) {
        console.warn('[billing] 获取订阅信息失败', error);
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

function mapTransaction(record: TokenTransaction): TokenTransaction {
  return {
    id: record.id,
    type: record.type,
    amount: record.amount,
    description: record.description ?? '',
    createdAt: normalizeDate(record.createdAt),
  };
}

function normalizeUsageSummary(summary: TokenUsageSummary) {
  return {
    userId: summary.userId,
    totalConsumed: summary.totalConsumed ?? 0,
    totalTopUp: summary.totalTopUp ?? 0,
    byService: summary.byService ?? {},
    startDate: normalizeDate(summary.startDate),
    endDate: normalizeDate(summary.endDate),
  } satisfies TokenUsageSummary;
}

function buildUsageEndpoint(params: UsageSummaryParams) {
  const search = new URLSearchParams();
  search.set('startDate', params.startDate);
  search.set('endDate', params.endDate);

  return `${API_ENDPOINTS.BILLING.TOKENS_USAGE}?${search.toString()}`;
}

function normalizeDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString();
}

export function useUserSubscription() {
  const query = useSubscriptionInfo();

  const plan = query.data?.planName?.toLowerCase() ?? null;

  const tier = normalizePlan(plan);

  return {
    ...query,
    tier,
    isTrial: tier === 'trial',
    isPro: tier === 'pro',
    isMax: tier === 'max',
    isElite: tier === 'elite',
    canUseAI: tier === 'elite',
  } as const;
}

export function useTokenCostEstimator() {
  return estimateTokenCosts;
}

export function useCheckinStatus() {
  const endpoint = API_ENDPOINTS.USERACTIVITY.CHECKIN_STATUS;

  return useQuery<CheckinStatus>({
    queryKey: ['billing-checkin-status'],
    queryFn: () => apiGet<CheckinStatus>(endpoint),
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });
}

export function performDailyCheckin() {
  return apiPost<PerformCheckinResponse>(API_ENDPOINTS.USERACTIVITY.CHECKIN);
}

export function useReferralSummary() {
  const endpoint = API_ENDPOINTS.USERACTIVITY.REFERRAL;

  return useQuery<ReferralSummary>({
    queryKey: ['useractivity-referral-summary'],
    queryFn: () => apiGet<ReferralSummary>(endpoint),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function refreshReferralSummary() {
  return apiGet<ReferralSummary>(`${API_ENDPOINTS.USERACTIVITY.REFERRAL}?refresh=true`);
}

function normalizePlan(plan: string | null) {
  if (!plan) {
    return 'trial';
  }

  const normalized = plan.toLowerCase().trim();

  if (normalized === 'elite' || normalized === 'max' || normalized === 'pro' || normalized === 'trial') {
    return normalized;
  }

  return 'trial';
}
