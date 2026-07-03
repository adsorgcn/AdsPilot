/**
 * Offer Admin Resources
 * Offer管理相关的后台资源hooks
 */

import { createParamResource, createStaticResource } from '~/lib/api/resources';
import type {
  OfferStats,
  Offer,
  OfferQualityMetrics,
  FailureReasonsResponse,
  ProblemOffersResponse,
} from '~/lib/api/types/console';
import {
  fetchOfferStats,
  fetchOffers,
  fetchOfferQualityMetrics,
  fetchFailureReasons,
  fetchProblemOffers,
} from '~/lib/api/console';

export const useConsoleOfferStats = createStaticResource<OfferStats>(
  ['console', 'offers', 'stats'],
  fetchOfferStats,
  {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  },
);

export const useConsoleOffers = createParamResource<
  {
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
    minScore?: number;
    maxScore?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  },
  { items: Offer[]; total: number; totalPages: number }
>(
  (params) => ['console', 'offers', params],
  (params, signal) => fetchOffers(params, signal),
  {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  },
);

export const useConsoleOfferQualityMetrics =
  createStaticResource<OfferQualityMetrics>(
    ['console', 'offers', 'quality-metrics'],
    fetchOfferQualityMetrics,
    {
      refreshInterval: 120_000,
      revalidateOnFocus: true,
    },
  );

export const useConsoleOfferFailureReasons = createParamResource<
  { limit?: number },
  FailureReasonsResponse
>(
  ({ limit }) => ['console', 'offers', 'failure-reasons', limit ?? 10],
  ({ limit }, signal) => fetchFailureReasons(limit ?? 10, signal),
  {
    refreshInterval: 120_000,
    revalidateOnFocus: false,
  },
);

// Alias for backward compatibility
export const useConsoleFailureReasons = useConsoleOfferFailureReasons;

export const useConsoleProblemOffers = createParamResource<
  { limit?: number },
  ProblemOffersResponse
>(
  ({ limit }) => ['console', 'offers', 'problems', limit ?? 20],
  ({ limit }, signal) => fetchProblemOffers(limit ?? 20, signal),
  {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  },
);
