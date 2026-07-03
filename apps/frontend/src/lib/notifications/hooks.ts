import { useQuery } from '@tanstack/react-query';

import { apiGet } from '~/lib/api';

import type { NotificationsResponse } from './types';

const DEFAULT_LIMIT = 20;

/**
 * 获取通知列表
 * 使用 1 分钟轮询以保持通知实时性
 */
export function useNotifications(limit = DEFAULT_LIMIT) {
  const endpoint = `/api/v1/notifications/recent?limit=${limit}`;

  const query = useQuery({
    queryKey: ['notifications', limit],
    queryFn: () => apiGet<NotificationsResponse>(endpoint),
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // 1 minute polling
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}