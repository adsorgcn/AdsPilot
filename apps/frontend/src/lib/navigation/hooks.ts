import { useQuery } from '@tanstack/react-query';

import { apiGet } from '~/lib/api';
import type { NavigationResponse } from './types';

/**
 * Fetch navigation config from Console API
 * Note: organizationId parameter removed during user-centric refactoring
 * 导航配置很少变化，使用较长的缓存时间
 */
export function useNavigationConfig() {
  const query = useQuery({
    queryKey: ['navigation-config'],
    queryFn: () => apiGet<NavigationResponse>(`/console/navigation`),
    staleTime: 60 * 60 * 1000, // 1 hour - navigation rarely changes
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  if (query.error) {
    console.error('[navigation] failed to load navigation config', {
      error:
        query.error instanceof Error
          ? query.error.message
          : String(query.error),
      timestamp: new Date().toISOString(),
    });
  }

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}