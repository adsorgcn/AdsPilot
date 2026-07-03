import { useQuery } from '@tanstack/react-query';

import { apiGet } from '~/lib/api';
import { API_ENDPOINTS } from '~/lib/api/endpoints';
import { mapTokenBalance } from '~/lib/billing/mappers';

import type { RawTokenBalance } from '../types';

/**
 * 查询Token余额 - 实时更新
 * 使用 10 秒轮询以保持余额实时性
 */
export function useTokenBalance() {
  const endpoint = API_ENDPOINTS.BILLING.TOKENS_BALANCE;

  const query = useQuery({
    queryKey: ['token-balance'],
    queryFn: async () => {
      const data = await apiGet<RawTokenBalance>(endpoint);
      return mapTokenBalance(data);
    },
    staleTime: 10 * 1000, // 10 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 1000, // 10 seconds polling
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  return {
    balance: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}