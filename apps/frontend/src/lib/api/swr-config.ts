import type { UseQueryOptions } from '@tanstack/react-query';

import { apiGet, ApiError } from './client';
import { smartCacheConfig } from './optimization/CacheStrategy';
import { batchedSWRFetcher } from './optimization/RequestBatcher';

/**
 * TanStack Query Fetcher with AbortSignal support and智能缓存策略
 * Automatically cancels requests when component unmounts or key changes
 * 使用批处理机制来优化重复请求
 */
export const queryFetcher = (endpoint: string, options?: { signal?: AbortSignal }) => {
  // 记录端点使用情况用于自适应缓存
  if (typeof window !== 'undefined') {
    import('./optimization/CacheStrategy').then(({ adaptiveCacheStrategy }) => {
      adaptiveCacheStrategy.recordUsage(endpoint);
    });
  }

  // 使用批处理fetcher以提高性能
  return batchedSWRFetcher(endpoint, options);
};

/**
 * 智能TanStack Query配置生成器
 * 根据端点自动选择最佳缓存策略
 */
export function createSmartQueryConfig(endpoint: string, customConfig?: Partial<UseQueryOptions>): UseQueryOptions {
  const cacheConfig = smartCacheConfig.getConfig(endpoint);

  return {
    queryFn: () => queryFetcher(endpoint),
    staleTime: cacheConfig.ttl,
    refetchOnWindowFocus: cacheConfig.revalidateOnFocus,
    refetchOnReconnect: cacheConfig.revalidateOnReconnect,
    refetchOnMount: cacheConfig.revalidateOnMount,
    gcTime: cacheConfig.ttl * 2, // 2倍stale time
    retry: cacheConfig.errorRetryCount,
    retryDelay: cacheConfig.errorRetryInterval,
    networkMode: 'online',
    retry: (failureCount, error) => {
      // 智能重试：区分错误类型
      if (error instanceof ApiError) {
        // 认证错误不重试
        if (error.status === 401 || error.status === 403) {
          return false;
        }
        // 客户端错误（4xx）不重试
        if (error.status >= 400 && error.status < 500) {
          return false;
        }
        // 只重试服务器错误（5xx）和网络错误
        return error.status >= 500 || error.status === 0;
      }
      // 未知错误默认重试
      return failureCount < (cacheConfig.errorRetryCount || 3);
    },
    onError: (error) => {
      // 更详细的错误日志
      if (error instanceof ApiError) {
        console.error(`[Query] ${endpoint} 失败 [${error.status}]: ${error.message}`, {
          code: error.code,
          details: error.details,
          cacheStrategy: getCacheStrategyName(endpoint)
        });
      } else {
        console.error(`[Query] ${endpoint} 请求失败:`, error);
      }
    },
    ...customConfig
  };
}

/**
 * 获取缓存策略名称（用于日志）
 */
function getCacheStrategyName(endpoint: string): string {
  const strategy = smartCacheConfig.getConfig(endpoint);

  if (strategy.ttl >= 10 * 60 * 1000) return 'static';
  if (strategy.ttl >= 2 * 60 * 1000) return 'dynamic';
  if (strategy.ttl >= 30 * 1000) return 'realtime';
  return 'polling';
}

/**
 * 默认 TanStack Query 配置
 * 适用于大多数数据获取场景
 */
export const defaultQueryConfig: UseQueryOptions = {
  retry: 2,
  retryDelay: 3000,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 10 * 60 * 1000, // 10 minutes
  networkMode: 'online',
  retry: (failureCount, error) => {
    // 智能重试：区分错误类型
    if (error instanceof ApiError) {
      // 认证错误不重试
      if (error.status === 401 || error.status === 403) {
        return false;
      }
      // 客户端错误（4xx）不重试
      if (error.status >= 400 && error.status < 500) {
        return false;
      }
      // 只重试服务器错误（5xx）和网络错误
      return error.status >= 500 || error.status === 0;
    }
    // 未知错误默认重试
    return failureCount < 3;
  },
  onError: (error) => {
    // 更详细的错误日志
    if (error instanceof ApiError) {
      console.error(`[Query] 失败 [${error.status}]: ${error.message}`, {
        code: error.code,
        details: error.details,
      });
    } else {
      console.error(`[Query] 请求失败:`, error);
    }
  },
};

/**
 * 轮询配置
 * 适用于需要定期刷新的数据（如任务状态）
 * ⚠️ 使用时需注意性能影响
 */
export const pollingQueryConfig: UseQueryOptions = {
  ...defaultQueryConfig,
  refetchInterval: 10000, // ✅ 延长到 10 秒：减少服务器压力
  refetchOnWindowFocus: false, // ✅ 关闭：已有轮询，避免重复
  staleTime: 5000, // ✅ 减少stale time：数据更实时
  gcTime: 15000,
};

/**
 * 实时配置
 * 适用于需要较高实时性的数据（如通知）
 */
export const realtimeQueryConfig: UseQueryOptions = {
  ...defaultQueryConfig,
  refetchInterval: 5000,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  staleTime: 2000,
  gcTime: 10000,
};

/**
 * 静态配置
 * 适用于不常变化的数据（如配置项、静态列表）
 */
export const staticQueryConfig: UseQueryOptions = {
  ...defaultQueryConfig,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  staleTime: 10 * 60 * 1000, // 10 分钟
  gcTime: 20 * 60 * 1000, // 20 分钟
};