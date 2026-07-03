'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useDataCache, usePerformanceMetrics } from './GlobalStateProvider';

// 缓存配置接口
interface CacheConfig {
  maxAge: number; // 缓存最大年龄（毫秒）
  maxSize: number; // 最大缓存条目数
  strategy: 'lru' | 'fifo' | 'ttl'; // 缓存策略
  compressThreshold: number; // 压缩阈值（字节）
}

// 缓存条目接口
interface CacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  compressed?: boolean;
}

// 预取策略接口
interface PrefetchStrategy {
  enabled: boolean;
  delay: number; // 延迟时间（毫秒）
  priority: 'low' | 'medium' | 'high';
  conditions: Array<(context: PrefetchContext) => boolean>;
}

// 预取上下文
interface PrefetchContext {
  currentPage: string;
  userRole?: string;
  connectionType: 'slow' | 'fast' | 'unknown';
  deviceType: 'mobile' | 'desktop' | 'tablet';
  batteryLevel?: 'low' | 'medium' | 'high';
}

// 默认缓存配置
const DEFAULT_CACHE_CONFIGS: Record<string, CacheConfig> = {
  offers: {
    maxAge: 5 * 60 * 1000, // 5分钟
    maxSize: 100,
    strategy: 'lru',
    compressThreshold: 1024 * 10, // 10KB
  },
  tasks: {
    maxAge: 3 * 60 * 1000, // 3分钟
    maxSize: 200,
    strategy: 'lru',
    compressThreshold: 1024 * 5, // 5KB
  },
  analytics: {
    maxAge: 10 * 60 * 1000, // 10分钟
    maxSize: 50,
    strategy: 'ttl',
    compressThreshold: 1024 * 20, // 20KB
  },
  user: {
    maxAge: 30 * 60 * 1000, // 30分钟
    maxSize: 10,
    strategy: 'lru',
    compressThreshold: 1024, // 1KB
  },
};

// 预取策略配置
const DEFAULT_PREFETCH_STRATEGIES: Record<string, PrefetchStrategy> = {
  'dashboard->offers': {
    enabled: true,
    delay: 2000,
    priority: 'high',
    conditions: [
      (ctx) => ctx.connectionType === 'fast',
      (ctx) => ctx.deviceType !== 'mobile',
    ],
  },
  'dashboard->tasks': {
    enabled: true,
    delay: 3000,
    priority: 'medium',
    conditions: [
      (ctx) => ctx.connectionType !== 'slow',
    ],
  },
  'offers->tasks': {
    enabled: true,
    delay: 1500,
    priority: 'medium',
    conditions: [
      (ctx) => ctx.userRole !== 'free',
    ],
  },
};

// 智能缓存管理器Hook
export function useSmartCacheManager() {
  const cache = useDataCache();
  const { recordApiResponse, recordInteraction, recordError } = usePerformanceMetrics();
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const prefetchTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // 估算数据大小
  const estimateSize = (data: any): number => {
    if (data === null || data === undefined) return 0;
    if (typeof data === 'string') return data.length * 2;
    if (typeof data === 'number') return 8;
    if (typeof data === 'boolean') return 4;
    if (Array.isArray(data)) return data.reduce((sum, item) => sum + estimateSize(item), 0);
    if (typeof data === 'object') {
      return Object.keys(data).reduce((sum, key) =>
        sum + key.length * 2 + estimateSize((data as any)[key]), 0);
    }
    return 0;
  };

  // 压缩数据（简单实现）
  const compressData = (data: any): any => {
    // 这里可以实现真正的压缩算法，如LZ-string
    // 现在只是标记为压缩
    return { _compressed: true, data };
  };

  // 解压数据
  const decompressData = (compressed: any): any => {
    if (compressed?._compressed) {
      return compressed.data;
    }
    return compressed;
  };

  // LRU策略清理
  const evictLRU = (maxSize: number) => {
    const entries = Array.from(cacheRef.current.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    const toRemove = entries.length - maxSize;
    if (toRemove > 0) {
      entries.slice(0, toRemove).forEach(([key]) => {
        cacheRef.current.delete(key);
      });
    }
  };

  // FIFO策略清理
  const evictFIFO = (maxSize: number) => {
    const entries = Array.from(cacheRef.current.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = entries.length - maxSize;
    if (toRemove > 0) {
      entries.slice(0, toRemove).forEach(([key]) => {
        cacheRef.current.delete(key);
      });
    }
  };

  // 缓存清理
  const evictCache = (strategy: string, maxSize: number) => {
    if (strategy === 'lru') {
      evictLRU(maxSize);
    } else if (strategy === 'fifo') {
      evictFIFO(maxSize);
    }
    // TTL策略在获取时自动检查
  };

  // 设置缓存数据
  const setCachedData = useCallback((
    category: string,
    key: string,
    data: any,
    customConfig?: Partial<CacheConfig>
  ) => {
    const config = { ...DEFAULT_CACHE_CONFIGS[category], ...customConfig };
    const now = Date.now();
    const size = estimateSize(data);

    let finalData = data;
    let compressed = false;

    // 如果数据超过压缩阈值，进行压缩
    if (size > config.compressThreshold) {
      finalData = compressData(data);
      compressed = true;
    }

    const entry: CacheEntry = {
      key,
      data: finalData,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
      size: compressed ? size / 2 : size, // 估算压缩后大小
      compressed,
    };

    cacheRef.current.set(`${category}:${key}`, entry);

    // 更新全局状态
    if (category === 'offers') {
      cache.setCacheData('offers', { ...cache.offers, data });
    } else if (category === 'tasks') {
      cache.setCacheData('tasks', { ...cache.tasks, data });
    } else if (category === 'analytics') {
      cache.setCacheData('analytics', { ...cache.analytics, data });
    }

    // 清理过期和超出限制的缓存
    evictCache(config.strategy, config.maxSize);

    return entry;
  }, [cache, evictCache]); // eslint-disable-line react-hooks/exhaustive-deps

  // 获取缓存数据
  const getCachedData = useCallback((
    category: string,
    key: string,
    customConfig?: Partial<CacheConfig>
  ): any | null => {
    const config = { ...DEFAULT_CACHE_CONFIGS[category], ...customConfig };
    const entry = cacheRef.current.get(`${category}:${key}`);

    if (!entry) {
      return null;
    }

    const now = Date.now();

    // TTL策略：检查是否过期
    if (config.strategy === 'ttl' && (now - entry.timestamp) > config.maxAge) {
      cacheRef.current.delete(`${category}:${key}`);
      return null;
    }

    // 更新访问信息
    entry.accessCount++;
    entry.lastAccessed = now;

    // 如果数据被压缩，解压
    let data = entry.data;
    if (entry.compressed) {
      data = decompressData(entry.data);
    }

    return data;
  }, [cache, decompressData]);

  // 智能预取
  const prefetchData = useCallback((
    fromPage: string,
    toPage: string,
    dataFetcher: () => Promise<any>,
    context: PrefetchContext
  ) => {
    const strategyKey = `${fromPage}->${toPage}`;
    const strategy = DEFAULT_PREFETCH_STRATEGIES[strategyKey];

    if (!strategy?.enabled) {
      return;
    }

    // 检查预取条件
    const shouldPrefetch = strategy.conditions.every(condition => condition(context));
    if (!shouldPrefetch) {
      return;
    }

    // 清除之前的预取定时器
    const existingTimeout = prefetchTimeoutsRef.current.get(strategyKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // 设置新的预取定时器
    const timeout = setTimeout(async () => {
      try {
        const startTime = Date.now();
        const data = await dataFetcher();
        const endTime = Date.now();

        // 缓存预取的数据
        setCachedData(toPage, 'prefetch', data, {
          maxAge: 2 * 60 * 1000, // 预取数据缓存时间较短
        });

        // 记录性能指标
        recordApiResponse(`prefetch:${toPage}`, endTime - startTime);
        recordInteraction('cache_prefetch', endTime - startTime);

      } catch (error) {
        recordError('prefetch_error');
        console.warn('Prefetch failed for', toPage, error);
      } finally {
        prefetchTimeoutsRef.current.delete(strategyKey);
      }
    }, strategy.delay);

    prefetchTimeoutsRef.current.set(strategyKey, timeout);
  }, [setCachedData, recordApiResponse, recordInteraction, recordError]);

  // 清理缓存
  const clearCache = useCallback((category?: string) => {
    if (category) {
      // 清理特定类别的缓存
      const keysToDelete = Array.from(cacheRef.current.keys())
        .filter(key => key.startsWith(`${category}:`));

      keysToDelete.forEach(key => cacheRef.current.delete(key));

      // 更新全局状态
      if (category === 'offers') {
        cache.invalidateCache('offers');
      } else if (category === 'tasks') {
        cache.invalidateCache('tasks');
      } else if (category === 'analytics') {
        cache.invalidateCache('analytics');
      }
    } else {
      // 清理所有缓存
      cacheRef.current.clear();
      cache.invalidateCache();
    }

    // 清理所有预取定时器
    prefetchTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    prefetchTimeoutsRef.current.clear();
  }, [cache]);

  // 缓存统计
  const getCacheStats = useCallback(() => {
    const stats = {
      totalEntries: cacheRef.current.size,
      totalSize: 0,
      hitRate: 0,
      entriesByCategory: {} as Record<string, number>,
      oldestEntry: 0,
      newestEntry: 0,
    };

    cacheRef.current.forEach((entry, key) => {
      const category = key.split(':')[0];
      stats.totalSize += entry.size;
      stats.entriesByCategory[category] = (stats.entriesByCategory[category] || 0) + 1;

      if (stats.oldestEntry === 0 || entry.timestamp < stats.oldestEntry) {
        stats.oldestEntry = entry.timestamp;
      }
      if (entry.timestamp > stats.newestEntry) {
        stats.newestEntry = entry.timestamp;
      }
    });

    return stats;
  }, []);

  // 缓存预热
  const warmupCache = useCallback(async (
    category: string,
    dataFetchers: Array<{ key: string; fetcher: () => Promise<any> }>
  ) => {
    const warmupPromises = dataFetchers.map(async ({ key, fetcher }) => {
      try {
        const startTime = Date.now();
        const data = await fetcher();
        const endTime = Date.now();

        setCachedData(category, key, data);
        recordApiResponse(`warmup:${category}:${key}`, endTime - startTime);

        return { key, success: true };
      } catch (error) {
        recordError('warmup_error');
        return { key, success: false, error };
      }
    });

    return Promise.all(warmupPromises);
  }, [setCachedData, recordApiResponse, recordError]);

  // 清理过期的预取定时器
  useEffect(() => {
    return () => {
      const timeouts = prefetchTimeoutsRef.current;
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  return {
    // 核心操作
    setCachedData,
    getCachedData,
    prefetchData,
    clearCache,

    // 统计和管理
    getCacheStats,
    warmupCache,

    // 配置访问
    DEFAULT_CACHE_CONFIGS,
    DEFAULT_PREFETCH_STRATEGIES,
  };
}

// 缓存性能监控Hook
export function useCachePerformanceMonitor() {
  const { getCacheStats } = useSmartCacheManager();
  const { recordInteraction } = usePerformanceMetrics();

  useEffect(() => {
    const interval = setInterval(() => {
      const stats = getCacheStats();
      recordInteraction('cache_stats_check', 0);

      // 如果缓存过大，发出警告
      if (stats.totalSize > 50 * 1024 * 1024) { // 50MB
        console.warn('Cache size is large:', stats.totalSize / 1024 / 1024, 'MB');
      }
    }, 30000); // 每30秒检查一次

    return () => clearInterval(interval);
  }, [getCacheStats, recordInteraction]);

  return {
    getCacheStats,
  };
}