import { useQuery } from '@tanstack/react-query';

import { apiGet } from '~/lib/api';

import type { OfferListParams, OfferListResult } from '../types';
import { buildListEndpoint, mapOfferRecord } from '../utils/offer-mappers';

const DEFAULT_PAGE_SIZE = 20;

/**
 * 获取Offer列表（支持分页、筛选、排序）
 *
 * 支持两种后端响应格式:
 * - 新格式: { items, totalCount, page, limit, totalPages }
 * - 旧格式: 直接返回数组
 */
export function useOffersList(params: OfferListParams = {}) {
  const page = params.page ?? 1;
  const limit = params.limit ?? DEFAULT_PAGE_SIZE;
  const endpoint = buildListEndpoint({
    ...params,
    page,
    limit,
  });

  const query = useQuery<OfferListResult>({
    queryKey: ['offers', endpoint],
    queryFn: async () => {
      const response = await apiGet<any>(endpoint);

      // 新格式: { items, totalCount, page, limit, totalPages }
      if (response && typeof response === 'object' && 'items' in response) {
        const items = Array.isArray(response.items)
          ? response.items.map(mapOfferRecord)
          : [];

        const total =
          typeof response.totalCount === 'number'
            ? response.totalCount
            : items.length;

        const limitValue =
          typeof response.limit === 'number' ? response.limit : limit;

        const totalPages =
          typeof response.totalPages === 'number'
            ? response.totalPages
            : Math.max(1, Math.ceil(total / limitValue));

        return {
          items,
          total,
          page: typeof response.page === 'number' ? response.page : page,
          limit: limitValue,
          totalPages,
        };
      }

      // 旧格式: 直接返回数组
      if (Array.isArray(response)) {
        const items = response.map(mapOfferRecord);
        const total = items.length;
        const limitValue = Math.max(limit, items.length || DEFAULT_PAGE_SIZE);
        return {
          items,
          total,
          page,
          limit: limitValue,
          totalPages: Math.max(1, Math.ceil(total / limitValue)),
        };
      }

      // 兜底
      return {
        items: [],
        total: 0,
        page,
        limit,
        totalPages: 1,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    items: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    page: query.data?.page,
    limit: query.data?.limit,
    totalPages: query.data?.totalPages ?? 1,
    isLoading: query.isLoading,
    isValidating: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}