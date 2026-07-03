'use client';

import { useQuery } from '@tanstack/react-query';

import { apiGet } from '~/lib/api';

import type { MarketingSummary } from './types';

const MARKETING_SUMMARY_ENDPOINT = '/public/marketing/summary';

/**
 * 获取营销摘要数据
 * 营销数据变化较慢，使用较长的缓存时间
 */
export function useMarketingSummary(initialData?: MarketingSummary | null) {
  const query = useQuery({
    queryKey: ['marketing-summary'],
    queryFn: () =>
      apiGet<MarketingSummary>(MARKETING_SUMMARY_ENDPOINT, {
        requireAuth: false,
      }),
    staleTime: 30 * 60 * 1000, // 30 minutes - marketing data changes slowly
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    initialData: initialData ?? undefined,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}