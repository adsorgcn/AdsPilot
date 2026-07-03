import { useQuery } from '@tanstack/react-query';

import { apiGet } from '~/lib/api';
import { API_ENDPOINTS } from '~/lib/api/endpoints';

import type { Offer } from '../types';
import { mapOfferToFullType } from '../utils/offer-mappers';

/**
 * 获取单个Offer详情
 */
export function useOfferDetail(offerId?: string) {
  const endpoint = offerId ? `${API_ENDPOINTS.OFFERS}/${offerId}` : null;

  const query = useQuery<Offer>({
    queryKey: ['offer', offerId],
    queryFn: async () => {
      if (!endpoint) throw new Error('Offer ID is required');
      const data = await apiGet<any>(endpoint);
      return mapOfferToFullType(data);
    },
    enabled: !!offerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    offer: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}