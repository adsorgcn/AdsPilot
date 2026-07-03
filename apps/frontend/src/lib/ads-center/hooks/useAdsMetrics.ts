import { useQuery } from '@tanstack/react-query';

import { apiGet } from '~/lib/api';
import { API_ENDPOINTS } from '~/lib/api/endpoints';

import type { AdsStrategy, AdsExecutionReport } from '../types';

type StrategiesResponse = {
  items?: AdsStrategy[];
  updatedAt?: string;
};

type ExecutionReportResponse = {
  days?: number;
  items?: AdsExecutionReport['items'];
  updatedAt?: string;
  updated_at?: string;
};

/**
 * 获取广告策略列表
 * 使用 30 秒轮询以保持数据实时性
 */
export function useAdsStrategies() {
  const query = useQuery({
    queryKey: ['ads-strategies'],
    queryFn: async () => {
      const data = await apiGet<StrategiesResponse>(
        API_ENDPOINTS.ADSCENTER.STRATEGIES,
      );

      return {
        items: data.items ?? [],
        updatedAt: data.updatedAt ?? new Date().toISOString(),
      };
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30 * 1000, // 30 seconds polling
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  return {
    strategies: query.data?.items ?? [],
    updatedAt: query.data?.updatedAt,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * 获取广告执行报告
 * 使用 30 秒轮询以保持数据实时性
 */
export function useAdsExecutionReport(days = 7) {
  const endpoint = `${API_ENDPOINTS.ADSCENTER.EXECUTION_REPORT}?days=${days}`;

  const query = useQuery({
    queryKey: ['ads-execution-report', days],
    queryFn: async () => {
      const data = await apiGet<ExecutionReportResponse>(endpoint);

      return {
        days: data.days ?? days,
        items: data.items ?? [],
        updatedAt:
          data.updatedAt ?? data.updated_at ?? new Date().toISOString(),
      } satisfies AdsExecutionReport;
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30 * 1000, // 30 seconds polling
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  return {
    report: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}