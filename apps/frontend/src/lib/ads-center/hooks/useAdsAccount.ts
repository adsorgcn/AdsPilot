import { useQuery } from '@tanstack/react-query';

import { apiGet } from '~/lib/api';

import type { AdsAccountDetail } from '../types';
import { mapAccountDetail } from '../utils/accounts-helpers';

/**
 * 获取单个广告账号详情
 */
export function useAdsAccount(accountId?: string) {
  const endpoint = accountId
    ? `/api/v1/adscenter/accounts/${accountId}`
    : null;

  const query = useQuery({
    queryKey: ['ads-account', accountId],
    queryFn: async () => {
      if (!endpoint) return undefined;
      const data = await apiGet<any>(endpoint);
      return mapAccountDetail(data);
    },
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    account: query.data as AdsAccountDetail | undefined,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}