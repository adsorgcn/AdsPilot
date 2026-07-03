import { useQuery } from '@tanstack/react-query';

import { apiGet } from '~/lib/api';
import { API_ENDPOINTS } from '~/lib/api/endpoints';

import type { LinkedAccount, OfferAccountsResponse } from '../types';

/**
 * 获取Offer关联的广告账号
 */
export function useOfferAccounts(offerId?: string) {
  const endpoint = offerId
    ? `${API_ENDPOINTS.OFFERS}/${offerId}/linked-accounts`
    : null;

  const query = useQuery<LinkedAccount[]>({
    queryKey: ['offer-accounts', offerId],
    queryFn: async () => {
      if (!endpoint) throw new Error('Offer ID is required');
      const data = await apiGet<OfferAccountsResponse>(endpoint);
      return data.accounts ?? [];
    },
    enabled: !!offerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    accounts: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}