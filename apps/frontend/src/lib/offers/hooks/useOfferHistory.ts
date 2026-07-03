import { useQuery } from '@tanstack/react-query';

import { apiGet } from '~/lib/api';
import { API_ENDPOINTS } from '~/lib/api/endpoints';

import type {
  OfferEvaluationHistoryItem,
  OfferEvaluationHistoryResponse,
} from '../types';
import { mapEvaluationRecord } from '../utils/offer-mappers';

/**
 * 获取Offer评估历史
 */
export function useOfferHistory(offerId?: string, limit = 10) {
  const endpoint = offerId
    ? `${API_ENDPOINTS.OFFERS}/${offerId}/evaluations?limit=${limit}`
    : null;

  const query = useQuery<OfferEvaluationHistoryItem[]>({
    queryKey: ['offer-history', offerId, limit],
    queryFn: async () => {
      if (!endpoint) throw new Error('Offer ID is required');
      const data = await apiGet<OfferEvaluationHistoryResponse>(endpoint);
      return (data.items ?? []).map(mapEvaluationRecord);
    },
    enabled: !!offerId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    history: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}