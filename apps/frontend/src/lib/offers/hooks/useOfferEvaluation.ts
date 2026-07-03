import { useCallback } from 'react';

import { apiPost } from '~/lib/api';

import type {
  EvaluateOfferRequest,
  EvaluateOfferResponse,
} from '../types';

/**
 * 评估单个Offer
 *
 * Features:
 * - Automatic Supabase auth token injection (via apiPost)
 * - Idempotency-Key header to prevent duplicate evaluations
 * - Token cost calculation (1 for basic, 3 for AI)
 * - Error handling with detailed messages
 */
export function useEvaluateOffer() {
  return useCallback(
    async (id: string, options: EvaluateOfferRequest = {}) => {
      // Generate idempotency key based on offer ID and timestamp (5-minute window)
      const timestamp = Math.floor(Date.now() / (5 * 60 * 1000));
      const idempotencyKey = `evaluate-${id}-${timestamp}`;

      const payload: EvaluateOfferRequest = {
        enableAI: Boolean(options.enableAI),
        forceRefresh: Boolean(options.forceRefresh),
      };

      // Call backend API with idempotency key in headers
      return apiPost<EvaluateOfferResponse>(
        `/api/v1/offers/${id}/evaluate`,
        payload,
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        },
      );
    },
    [],
  );
}

/**
 * 批量评估Offers
 */
export function useBatchEvaluateOffers() {
  return useCallback(async (offerIds: string[]) => {
    return apiPost<{ task_ids: string[] }>('/siterank/batch-evaluate', {
      offer_ids: offerIds,
    });
  }, []);
}
