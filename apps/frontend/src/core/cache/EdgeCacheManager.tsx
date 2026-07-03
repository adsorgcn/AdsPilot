'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { usePerformanceMetrics } from '~/core/state/GlobalStateProvider';

// Edge缓存策略类型
export type CacheStrategy = 'no-cache' | 'cache-first' | 'network-first' | 'stale-while-revalidate' | 'stale-if-error';

// 缓存配置
interface CacheConfig {
  strategy: CacheStrategy;
  maxAge: number; // 缓存时间（秒）
  maxStale: number; // 过期后仍可使用的时间（秒）
  varyOn: string[]; // 缓存变化因素（如设备类型、地理位置等）
  compression: boolean; // 是否启用压缩
  etag: boolean; // 是否启用ETag验证
  lastModified: boolean; // 是否启用Last-Modified验证
}

// 缓存规则
interface CacheRule {
  pattern: string | RegExp;
  config: CacheConfig;
  priority: number; // 优先级（数字越大优先级越高）
  description: string;
}

// Edge缓存管理器配置
interface EdgeCacheConfig {
  // 默认缓存策略
  defaultStrategy: CacheStrategy;
  defaultMaxAge: number;
  defaultMaxStale: number;

  // 预定义缓存规则
  rules: CacheRule[];

  // 缓存键生成
  keyGenerator: (url: string, varyOn: string[]) => string;

  // 缓存验证
  validateCache: (response: Response, cachedResponse: Response) => boolean;

  // 缓存统计
  enableStats: boolean;

  // 边缘节点配置
  edgeNodes: Array<{
    region: string;
    endpoint: string;
    priority: number;
  }>;

  // 地理位置缓存
  geoBasedCache: boolean;

  // 设备类型缓存
  deviceBasedCache: boolean;
}

// 默认配置
const DEFAULT_CONFIG: EdgeCacheConfig = {
  defaultStrategy: 'stale-while-revalidate',
  defaultMaxAge: 300, // 5分钟
  defaultMaxStale: 86400, // 24小时
  rules: [
    // 静态资源 - 长期缓存
    {
      pattern: /\.(css|js|woff|woff2|ttf|eot)$/i,
      config: {
        strategy: 'cache-first',
        maxAge: 86400 * 365, // 1年
        maxStale: 86400 * 30, // 30天
        varyOn: ['accept-encoding'],
        compression: true,
        etag: true,
        lastModified: true,
      },
      priority: 100,
      description: 'Static assets',
    },
    // 图片 - 中期缓存
    {
      pattern: /\.(png|jpg|jpeg|gif|webp|avif|svg)$/i,
      config: {
        strategy: 'stale-while-revalidate',
        maxAge: 86400 * 7, // 7天
        maxStale: 86400 * 30, // 30天
        varyOn: ['accept', 'accept-encoding'],
        compression: true,
        etag: true,
        lastModified: false,
      },
      priority: 90,
      description: 'Images',
    },
    // API数据 - 短期缓存
    {
      pattern: /^\/api\//,
      config: {
        strategy: 'network-first',
        maxAge: 60, // 1分钟
        maxStale: 300, // 5分钟
        varyOn: ['authorization', 'accept-encoding'],
        compression: true,
        etag: true,
        lastModified: true,
      },
      priority: 80,
      description: 'API responses',
    },
    // HTML页面 - 很短缓存
    {
      pattern: /\.(html|htm)$/i,
      config: {
        strategy: 'stale-while-revalidate',
        maxAge: 60, // 1分钟
        maxStale: 300, // 5分钟
        varyOn: ['accept-encoding', 'cookie'],
        compression: true,
        etag: true,
        lastModified: true,
      },
      priority: 70,
      description: 'HTML pages',
    },
    // 用户特定数据 - 不缓存
    {
      pattern: /^\/api\/(user|profile|settings)/,
      config: {
        strategy: 'no-cache',
        maxAge: 0,
        maxStale: 0,
        varyOn: ['authorization'],
        compression: false,
        etag: false,
        lastModified: false,
      },
      priority: 60,
      description: 'User-specific data',
    },
  ],
  keyGenerator: defaultKeyGenerator,
  validateCache: defaultCacheValidator,
  enableStats: true,
  edgeNodes: [
    { region: 'us-east-1', endpoint: 'https://cache.us-east-1.gm.com', priority: 1 },
    { region: 'us-west-2', endpoint: 'https://cache.us-west-2.gm.com', priority: 2 },
    { region: 'eu-west-1', endpoint: 'https://cache.eu-west-1.gm.com', priority: 2 },
    { region: 'ap-southeast-1', endpoint: 'https://cache.ap-southeast-1.gm.com', priority: 3 },
  ],
  geoBasedCache: true,
  deviceBasedCache: true,
};

// 默认缓存键生成器
function defaultKeyGenerator(url: string, varyOn: string[]): string {
  const urlObj = new URL(url);
  let key = urlObj.pathname + urlObj.search;

  varyOn.forEach(header => {
    const value = getHeaderValue(header);
    if (value) {
      key += `|${header}:${value}`;
    }
  });

  return key;
}

// 获取请求头值
function getHeaderValue(header: string): string {
  if (typeof window === 'undefined') return '';

  // 在客户端环境中无法直接获取所有请求头
  // 这里使用一些常见的客户端信息作为替代
  switch (header.toLowerCase()) {
    case 'user-agent':
      return navigator.userAgent;
    case 'accept-language':
      return navigator.language;
    case 'accept-encoding':
      return 'gzip, deflate, br';
    case 'accept':
      return 'application/json, text/plain, */*';
    default:
      return '';
  }
}

// 默认缓存验证器
function defaultCacheValidator(response: Response, cachedResponse: Response): boolean {
  // 检查响应状态
  if (response.status !== cachedResponse.status) {
    return false;
  }

  // 检查Content-Type
  const responseContentType = response.headers.get('content-type');
  const cachedContentType = cachedResponse.headers.get('content-type');
  if (responseContentType !== cachedContentType) {
    return false;
  }

  // 检查ETag
  const responseETag = response.headers.get('etag');
  const cachedETag = cachedResponse.headers.get('etag');
  if (responseETag && cachedETag && responseETag !== cachedETag) {
    return false;
  }

  return true;
}

// Edge缓存管理器Hook
export function useEdgeCacheManager(customConfig: Partial<EdgeCacheConfig> = {}) {
  const config = useMemo(() => ({ ...DEFAULT_CONFIG, ...customConfig }), [customConfig]);
  const { recordInteraction, recordApiResponse } = usePerformanceMetrics();

  // 缓存状态
  const [cacheStats, setCacheStats] = useState({
    hits: 0,
    misses: 0,
    updates: 0,
    errors: 0,
    totalSize: 0,
    hitRate: 0,
  });

  // 缓存存储（内存中的简单实现）
  const cacheStore = useRef<Map<string, {
    response: Response;
    timestamp: number;
    etag?: string;
    lastModified?: string;
    rule: CacheRule;
  }>>(new Map());

  // 获取缓存规则
  const getCacheRule = useCallback((url: string): CacheRule => {
    let bestMatch: CacheRule | null = null;
    let highestPriority = -1;

    for (const rule of config.rules) {
      let matches = false;

      if (typeof rule.pattern === 'string') {
        matches = url.includes(rule.pattern);
      } else if (rule.pattern instanceof RegExp) {
        matches = rule.pattern.test(url);
      }

      if (matches && rule.priority > highestPriority) {
        bestMatch = rule;
        highestPriority = rule.priority;
      }
    }

    return bestMatch || {
      pattern: 'default',
      config: {
        strategy: config.defaultStrategy,
        maxAge: config.defaultMaxAge,
        maxStale: config.defaultMaxStale,
        varyOn: [],
        compression: false,
        etag: false,
        lastModified: false,
      },
      priority: 0,
      description: 'Default rule',
    };
  }, [config.defaultTTL, config.defaultStrategy, config.enableCompression, config]);

  // 生成缓存键
  const generateCacheKey = useCallback((url: string, rule: CacheRule): string => {
    let varyOn = [...rule.config.varyOn];

    // 添加地理位置变化因素
    if (config.geoBasedCache) {
      varyOn.push('geo-country', 'geo-region');
    }

    // 添加设备类型变化因素
    if (config.deviceBasedCache) {
      varyOn.push('device-type', 'screen-width');
    }

    return config.keyGenerator(url, varyOn);
  }, [config, config.geoBasedCache, config.deviceBasedCache, config.keyGenerator]);

  // 检查缓存是否有效
  const isCacheValid = useCallback((
    cacheEntry: { timestamp: number; rule: CacheRule },
    allowStale: boolean = false
  ): boolean => {
    const now = Date.now();
    const age = (now - cacheEntry.timestamp) / 1000; // 转换为秒

    if (age <= cacheEntry.rule.config.maxAge) {
      return true;
    }

    if (allowStale && age <= cacheEntry.rule.config.maxAge + cacheEntry.rule.config.maxStale) {
      return true;
    }

    return false;
  }, []);

  // 从网络获取数据（移到前面避免循环依赖）
  const fetchFromNetwork = useCallback(async (
    url: string,
    request: Request,
    rule: CacheRule,
    startTime: number
  ): Promise<Response> => {
    try {
      const cacheHeaders: Record<string, string> = {};

      if (rule.config.etag) {
        const cachedEntry = cacheStore.current.get(generateCacheKey(url, rule));
        if (cachedEntry?.etag) {
          cacheHeaders['If-None-Match'] = cachedEntry.etag;
        }
      }

      if (rule.config.lastModified) {
        const cachedEntry = cacheStore.current.get(generateCacheKey(url, rule));
        if (cachedEntry?.lastModified) {
          cacheHeaders['If-Modified-Since'] = cachedEntry.lastModified;
        }
      }

      const newRequest = new Request(request, {
        headers: {
          ...Object.fromEntries(request.headers.entries()),
          ...cacheHeaders,
        },
      });

      const response = await fetch(newRequest);

      if (response.status === 304) {
        const cachedEntry = cacheStore.current.get(generateCacheKey(url, rule));
        if (cachedEntry) {
          setCacheStats(prev => ({
            ...prev,
            hits: prev.hits + 1,
            hitRate: ((prev.hits + 1) / (prev.hits + prev.misses + 1)) * 100,
          }));
          recordInteraction('edge_cache_304');
          recordApiResponse('edge_cache_304', performance.now() - startTime);
          return cachedEntry.response.clone();
        }
      }

      if (!response.ok) {
        setCacheStats(prev => ({ ...prev, errors: prev.errors + 1 }));
        throw new Error(`Network error: ${response.status}`);
      }

      const cacheKey = generateCacheKey(url, rule);
      cacheStore.current.set(cacheKey, {
        response: response.clone(),
        timestamp: Date.now(),
        etag: response.headers.get('etag') || undefined,
        lastModified: response.headers.get('last-modified') || undefined,
        rule,
      });

      setCacheStats(prev => ({
        ...prev,
        misses: prev.misses + 1,
        hitRate: (prev.hits / (prev.hits + prev.misses + 1)) * 100,
      }));

      recordInteraction('edge_cache_miss');
      recordApiResponse('edge_cache_miss', performance.now() - startTime);

      return response;
    } catch (error) {
      setCacheStats(prev => ({ ...prev, errors: prev.errors + 1 }));
      recordInteraction('edge_cache_error');
      throw error;
    }
  }, [generateCacheKey, recordInteraction, recordApiResponse]);

  // 缓存策略处理器
  const handleCacheStrategy = useCallback(async (
    url: string,
    request: Request,
    rule: CacheRule
  ): Promise<Response> => {
    const cacheKey = generateCacheKey(url, rule);
    const cachedEntry = cacheStore.current.get(cacheKey);

    const startTime = performance.now();

    switch (rule.config.strategy) {
      case 'no-cache':
        return await fetchFromNetwork(url, request, rule, startTime);

      case 'cache-first':
        return await handleCacheFirst(url, request, rule, cacheKey, cachedEntry, startTime);

      case 'network-first':
        return await handleNetworkFirst(url, request, rule, cacheKey, cachedEntry, startTime);

      case 'stale-while-revalidate':
        return await handleStaleWhileRevalidate(url, request, rule, cacheKey, cachedEntry, startTime);

      case 'stale-if-error':
        return await handleStaleIfError(url, request, rule, cacheKey, cachedEntry, startTime);

      default:
        return await fetchFromNetwork(url, request, rule, startTime);
    }
  }, [generateCacheKey, fetchFromNetwork]);

  // Cache First策略
  const handleCacheFirst = useCallback(async (
    url: string,
    request: Request,
    rule: CacheRule,
    cacheKey: string,
    cachedEntry: any,
    startTime: number
  ): Promise<Response> => {
    if (cachedEntry && isCacheValid(cachedEntry)) {
      setCacheStats(prev => ({
        ...prev,
        hits: prev.hits + 1,
        hitRate: ((prev.hits + 1) / (prev.hits + prev.misses + 1)) * 100,
      }));

      recordInteraction('edge_cache_hit');
      recordApiResponse('edge_cache', performance.now() - startTime);

      return cachedEntry.response.clone();
    }

    return await fetchFromNetwork(url, request, rule, startTime);
  }, [fetchFromNetwork, isCacheValid, recordInteraction, recordApiResponse]);

  // Network First策略
  const handleNetworkFirst = useCallback(async (
    url: string,
    request: Request,
    rule: CacheRule,
    cacheKey: string,
    cachedEntry: any,
    startTime: number
  ): Promise<Response> => {
    try {
      const response = await fetchFromNetwork(url, request, rule, startTime);
      return response;
    } catch (error) {
      if (cachedEntry && isCacheValid(cachedEntry, true)) {
        setCacheStats(prev => ({
          ...prev,
          hits: prev.hits + 1,
          hitRate: ((prev.hits + 1) / (prev.hits + prev.misses + 1)) * 100,
        }));

        recordInteraction('edge_cache_fallback');
        return cachedEntry.response.clone();
      }

      throw error;
    }
  }, [fetchFromNetwork, isCacheValid, recordInteraction]);

  // Stale While Revalidate策略
  const handleStaleWhileRevalidate = useCallback(async (
    url: string,
    request: Request,
    rule: CacheRule,
    cacheKey: string,
    cachedEntry: any,
    startTime: number
  ): Promise<Response> => {
    if (cachedEntry && isCacheValid(cachedEntry, true)) {
      // 异步更新缓存
      fetchFromNetwork(url, request, rule, performance.now()).then(response => {
        cacheStore.current.set(cacheKey, {
          response,
          timestamp: Date.now(),
          etag: response.headers.get('etag') || undefined,
          lastModified: response.headers.get('last-modified') || undefined,
          rule,
        });

        setCacheStats(prev => ({ ...prev, updates: prev.updates + 1 }));
      }).catch(error => {
        console.error('Cache update failed:', error);
        setCacheStats(prev => ({ ...prev, errors: prev.errors + 1 }));
      });

      setCacheStats(prev => ({
        ...prev,
        hits: prev.hits + 1,
        hitRate: ((prev.hits + 1) / (prev.hits + prev.misses + 1)) * 100,
      }));

      recordInteraction('edge_cache_stale');
      return cachedEntry.response.clone();
    }

    return await fetchFromNetwork(url, request, rule, startTime);
  }, [fetchFromNetwork, isCacheValid, recordInteraction]);

  // Stale If Error策略
  const handleStaleIfError = useCallback(async (
    url: string,
    request: Request,
    rule: CacheRule,
    cacheKey: string,
    cachedEntry: any,
    startTime: number
  ): Promise<Response> => {
    try {
      return await fetchFromNetwork(url, request, rule, startTime);
    } catch (error) {
      if (cachedEntry && isCacheValid(cachedEntry, true)) {
        setCacheStats(prev => ({
          ...prev,
          hits: prev.hits + 1,
          hitRate: ((prev.hits + 1) / (prev.hits + prev.misses + 1)) * 100,
        }));

        recordInteraction('edge_cache_stale_error');
        return cachedEntry.response.clone();
      }

      throw error;
    }
  }, [fetchFromNetwork, isCacheValid, recordInteraction]);

  // 缓存请求
  const cachedFetch = useCallback(async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    const request = new Request(url, options);
    const rule = getCacheRule(url);

    return await handleCacheStrategy(url, request, rule);
  }, [getCacheRule, handleCacheStrategy]);

  // 预热缓存
  const warmupCache = useCallback(async (urls: string[]): Promise<void> => {
    const warmupPromises = urls.map(async (url) => {
      try {
        await cachedFetch(url, { method: 'HEAD' });
        recordInteraction('edge_cache_warmup', { url });
      } catch (error) {
        console.error(`Failed to warmup cache for ${url}:`, error);
      }
    });

    await Promise.all(warmupPromises);
  }, [cachedFetch, recordInteraction]);

  // 清理过期缓存
  const cleanupExpiredCache = useCallback((): number => {
    let cleanedCount = 0;
    const now = Date.now();

    for (const [key, entry] of cacheStore.current.entries()) {
      if (!isCacheValid(entry, false)) {
        cacheStore.current.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      recordInteraction('edge_cache_cleanup', { count: cleanedCount });
    }

    return cleanedCount;
  }, [isCacheValid, recordInteraction]);

  // 获取缓存统计
  const getDetailedStats = useCallback(() => {
    const cacheEntries = Array.from(cacheStore.current.entries());
    const totalSize = cacheEntries.reduce((sum, [_, entry]) => {
      return sum + JSON.stringify(entry.response).length;
    }, 0);

    const rulesUsage = new Map<string, number>();
    cacheEntries.forEach(([_, entry]) => {
      const count = rulesUsage.get(entry.rule.description) || 0;
      rulesUsage.set(entry.rule.description, count + 1);
    });

    return {
      ...cacheStats,
      totalEntries: cacheEntries.length,
      totalSize,
      rulesUsage: Object.fromEntries(rulesUsage),
      cacheKeys: cacheEntries.map(([key, _]) => key),
    };
  }, [cacheStats]);

  // 定期清理过期缓存
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const cleanupInterval = setInterval(cleanupExpiredCache, 60000); // 每分钟清理一次

    return () => clearInterval(cleanupInterval);
  }, [cleanupExpiredCache]);

  return {
    // 核心功能
    cachedFetch,
    warmupCache,
    cleanupExpiredCache,

    // 配置和状态
    config,
    cacheStats,
    getDetailedStats,

    // 工具方法
    getCacheRule,
    generateCacheKey,
    isCacheValid,
  };
}

// Edge缓存统计组件
interface EdgeCacheStatsProps {
  enabled?: boolean;
  className?: string;
}

export function EdgeCacheStats({ enabled = true, className = '' }: EdgeCacheStatsProps) {
  const { getDetailedStats } = useEdgeCacheManager();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      setStats(getDetailedStats());
    }, 2000);

    return () => clearInterval(interval);
  }, [enabled, getDetailedStats]);

  if (!enabled || !stats) {
    return null;
  }

  return (
    <div className={`p-4 bg-white rounded-lg border ${className}`}>
      <h3 className="text-lg font-semibold mb-3">Edge缓存统计</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-gray-600">命中率</p>
          <p className="font-semibold text-green-600">{stats.hitRate.toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-gray-600">命中次数</p>
          <p className="font-semibold">{stats.hits}</p>
        </div>
        <div>
          <p className="text-gray-600">未命中</p>
          <p className="font-semibold text-orange-600">{stats.misses}</p>
        </div>
        <div>
          <p className="text-gray-600">更新次数</p>
          <p className="font-semibold text-blue-600">{stats.updates}</p>
        </div>
      </div>
    </div>
  );
}